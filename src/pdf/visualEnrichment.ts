import type {
  BoundingBox,
  PdfDocumentElement,
  PdfPageGeometry,
  PdfRegionAnalysisKind,
  PdfRegionRequest,
  PdfSource,
  PdfVisualEnrichment,
  PdfVisualEnrichmentCandidate,
  PdfVisualEnrichmentTargetType,
} from '../types/pdf.js';
import { PdfError } from '../utils/errors.js';
import {
  analyzePdfRegionsFromSource,
  defaultAnalyzeRegionsOptions,
  getRegionAnalysisProviderStatus,
} from './regionAnalysis.js';

export const DEFAULT_VISUAL_ENRICHMENT_MAX_REGIONS = 8;

type VisualTargetElement = Extract<PdfDocumentElement, { type: 'image' | 'table' }> & {
  bounding_box: NonNullable<PdfDocumentElement['bounding_box']>;
};

type CaptionElement = Extract<PdfDocumentElement, { type: 'text' }> & {
  bounding_box: NonNullable<PdfDocumentElement['bounding_box']>;
};

type CaptionVisualKind = Extract<
  PdfRegionAnalysisKind,
  'table' | 'figure' | 'chart' | 'formula' | 'image' | 'diagram'
>;

export interface VisualEnrichmentCandidate {
  element?: VisualTargetElement | undefined;
  region: PdfRegionRequest;
  target_element_id: string;
  target_element_type: PdfVisualEnrichmentTargetType;
  source_caption_element_id?: string | undefined;
  source_caption_text?: string | undefined;
  candidate_signals?: string[] | undefined;
}

export interface BuildVisualEnrichmentsInput {
  source: PdfSource;
  sourceDescription: string;
  elements: PdfDocumentElement[];
  pageGeometry?: PdfPageGeometry[] | undefined;
  maxVisualEnrichments: number;
}

export interface BuildVisualEnrichmentsOutput {
  visualEnrichmentCandidates: PdfVisualEnrichmentCandidate[];
  visualEnrichments: PdfVisualEnrichment[];
  warnings: string[];
}

const visualTargetElement = (element: PdfDocumentElement): element is VisualTargetElement =>
  (element.type === 'image' || element.type === 'table') && element.bounding_box !== undefined;

const captionVisualKind = (text: string): CaptionVisualKind | undefined => {
  const match = text.trim().match(/^(fig(?:ure)?|table|chart|formula|image|diagram)\b/iu);
  const rawKind = match?.[1]?.toLowerCase();
  if (!rawKind) return undefined;
  if (rawKind === 'fig') return 'figure';
  return rawKind as CaptionVisualKind;
};

const captionElement = (element: PdfDocumentElement): element is CaptionElement =>
  element.type === 'text' &&
  element.bounding_box !== undefined &&
  captionVisualKind(element.content) !== undefined &&
  !['footer', 'header', 'heading', 'list_item'].includes(element.semantic_hint?.role ?? '');

const pageBoundsFromGeometry = (geometry: PdfPageGeometry | undefined): BoundingBox | undefined => {
  if (!geometry) return undefined;

  const left = geometry.view_box?.left ?? 0;
  const bottom = geometry.view_box?.bottom ?? 0;
  const right = geometry.view_box?.right ?? geometry.width;
  const top = geometry.view_box?.top ?? geometry.height;
  if (
    !Number.isFinite(left) ||
    !Number.isFinite(bottom) ||
    !Number.isFinite(right) ||
    !Number.isFinite(top) ||
    right <= left ||
    top <= bottom
  ) {
    return undefined;
  }

  return { left, bottom, right, top };
};

const unionBox = (boxes: BoundingBox[]): BoundingBox | undefined => {
  if (boxes.length === 0) return undefined;

  return {
    left: Math.min(...boxes.map((box) => box.left)),
    bottom: Math.min(...boxes.map((box) => box.bottom)),
    right: Math.max(...boxes.map((box) => box.right)),
    top: Math.max(...boxes.map((box) => box.top)),
  };
};

const buildPageBoundsIndex = (
  elements: PdfDocumentElement[],
  pageGeometry: PdfPageGeometry[] | undefined
): Map<number, BoundingBox> => {
  const bounds = new Map<number, BoundingBox>();

  for (const geometry of pageGeometry ?? []) {
    const geometryBounds = pageBoundsFromGeometry(geometry);
    if (geometryBounds) bounds.set(geometry.page, geometryBounds);
  }

  const boxesByPage = new Map<number, BoundingBox[]>();
  for (const element of elements) {
    if (!element.bounding_box || bounds.has(element.page)) continue;
    const boxes = boxesByPage.get(element.page) ?? [];
    boxes.push(element.bounding_box);
    boxesByPage.set(element.page, boxes);
  }

  for (const [page, boxes] of boxesByPage) {
    const fallbackBounds = unionBox(boxes);
    if (fallbackBounds) bounds.set(page, fallbackBounds);
  }

  return bounds;
};

const buildElementsByPage = (elements: PdfDocumentElement[]): Map<number, PdfDocumentElement[]> => {
  const byPage = new Map<number, PdfDocumentElement[]>();
  for (const element of elements) {
    const pageElements = byPage.get(element.page) ?? [];
    pageElements.push(element);
    byPage.set(element.page, pageElements);
  }
  return byPage;
};

const horizontalOverlapRatio = (left: BoundingBox, right: BoundingBox): number => {
  const overlap = Math.min(left.right, right.right) - Math.max(left.left, right.left);
  if (overlap <= 0) return 0;

  const denominator = Math.min(left.right - left.left, right.right - right.left);
  return denominator > 0 ? overlap / denominator : 0;
};

const verticalGap = (left: BoundingBox, right: BoundingBox): number => {
  if (left.top < right.bottom) return right.bottom - left.top;
  if (right.top < left.bottom) return left.bottom - right.top;
  return 0;
};

const isDirectKindMatch = (kind: CaptionVisualKind, element: VisualTargetElement): boolean => {
  if (kind === 'table') return element.type === 'table';
  if (kind === 'formula') return false;
  return element.type === 'image';
};

const hasNearbyDirectTarget = (
  caption: CaptionElement,
  kind: CaptionVisualKind,
  directTargets: VisualTargetElement[]
): boolean =>
  directTargets.some(
    (target) =>
      target.page === caption.page &&
      isDirectKindMatch(kind, target) &&
      horizontalOverlapRatio(caption.bounding_box, target.bounding_box) >= 0.12 &&
      verticalGap(caption.bounding_box, target.bounding_box) <= 112
  );

const captionRegionMaxGap = (kind: CaptionVisualKind, pageBounds: BoundingBox): number => {
  const pageHeight = pageBounds.top - pageBounds.bottom;
  if (kind === 'formula') return Math.min(Math.max(84, pageHeight * 0.16), 132);
  if (kind === 'table') return Math.min(Math.max(128, pageHeight * 0.24), 220);
  return Math.min(Math.max(168, pageHeight * 0.32), 280);
};

const visualRegionMargin = (kind: CaptionVisualKind, pageBounds: BoundingBox): number => {
  const pageWidth = pageBounds.right - pageBounds.left;
  if (kind === 'formula') return Math.min(Math.max(12, pageWidth * 0.025), 24);
  return Math.min(Math.max(16, pageWidth * 0.035), 36);
};

const expandAndClampBox = (
  box: BoundingBox,
  pageBounds: BoundingBox,
  margin: number
): BoundingBox => ({
  left: Math.max(pageBounds.left, box.left - margin),
  bottom: Math.max(pageBounds.bottom, box.bottom - margin),
  right: Math.min(pageBounds.right, box.right + margin),
  top: Math.min(pageBounds.top, box.top + margin),
});

const isUsefulRegionBox = (box: BoundingBox): boolean =>
  box.right - box.left >= 12 && box.top - box.bottom >= 8;

const candidateNeighborElements = (
  caption: CaptionElement,
  elementsOnPage: PdfDocumentElement[],
  pageBounds: BoundingBox,
  kind: CaptionVisualKind
): { boxes: BoundingBox[]; signals: string[] } => {
  const maxGap = captionRegionMaxGap(kind, pageBounds);
  const positioned = elementsOnPage.filter((element) => {
    if (element.id === caption.id || !element.bounding_box) return false;
    if (element.type !== 'text') return true;
    return !['caption', 'header', 'footer'].includes(element.semantic_hint?.role ?? '');
  });

  const above: Array<{ box: BoundingBox; gap: number }> = [];
  const below: Array<{ box: BoundingBox; gap: number }> = [];
  for (const element of positioned) {
    const box = element.bounding_box;
    if (!box || horizontalOverlapRatio(caption.bounding_box, box) < 0.06) continue;

    if (box.bottom >= caption.bounding_box.top) {
      const gap = box.bottom - caption.bounding_box.top;
      if (gap <= maxGap) above.push({ box, gap });
    } else if (box.top <= caption.bounding_box.bottom) {
      const gap = caption.bounding_box.bottom - box.top;
      if (gap <= maxGap) below.push({ box, gap });
    } else if (verticalGap(caption.bounding_box, box) === 0) {
      above.push({ box, gap: 0 });
    }
  }

  const minAboveGap = Math.min(...above.map((entry) => entry.gap), Number.POSITIVE_INFINITY);
  const minBelowGap = Math.min(...below.map((entry) => entry.gap), Number.POSITIVE_INFINITY);
  const selected =
    above.length > 0 && (below.length === 0 || minAboveGap <= minBelowGap + 24) ? above : below;

  return {
    boxes: selected.map((entry) => entry.box),
    signals:
      selected.length > 0
        ? [
            'nearby-positioned-evidence',
            selected === above ? 'caption-target-above' : 'caption-target-below',
          ]
        : [],
  };
};

const fallbackCaptionRegionBox = (
  caption: CaptionElement,
  pageBounds: BoundingBox,
  kind: CaptionVisualKind
): BoundingBox => {
  const pageWidth = pageBounds.right - pageBounds.left;
  const pageHeight = pageBounds.top - pageBounds.bottom;
  const captionBox = caption.bounding_box;
  const captionHeight = captionBox.top - captionBox.bottom;
  const captionCenterX = (captionBox.left + captionBox.right) / 2;
  const captionCenterY = (captionBox.bottom + captionBox.top) / 2;
  const verticalSpan =
    kind === 'formula'
      ? Math.min(Math.max(64, captionHeight * 5), pageHeight * 0.22)
      : Math.min(Math.max(150, pageHeight * 0.26), pageHeight * 0.42);
  const halfWidth =
    kind === 'formula'
      ? Math.min(Math.max((captionBox.right - captionBox.left) / 2 + 48, 120), pageWidth / 2)
      : Math.min(Math.max(pageWidth * 0.38, 220), pageWidth / 2);
  const left = Math.max(pageBounds.left, captionCenterX - halfWidth);
  const right = Math.min(pageBounds.right, captionCenterX + halfWidth);
  const hasRoomAbove = captionBox.top + verticalSpan <= pageBounds.top;
  const preferAbove = hasRoomAbove || captionCenterY <= pageBounds.bottom + (pageHeight * 2) / 3;

  if (preferAbove) {
    return {
      left,
      bottom: captionBox.bottom,
      right,
      top: Math.min(pageBounds.top, captionBox.top + verticalSpan),
    };
  }

  return {
    left,
    bottom: Math.max(pageBounds.bottom, captionBox.bottom - verticalSpan),
    right,
    top: captionBox.top,
  };
};

const buildCaptionRegionCandidate = (
  caption: CaptionElement,
  kind: CaptionVisualKind,
  elementsOnPage: PdfDocumentElement[],
  pageBounds: BoundingBox
): VisualEnrichmentCandidate | undefined => {
  const neighboring = candidateNeighborElements(caption, elementsOnPage, pageBounds, kind);
  const sourceBox =
    neighboring.boxes.length > 0
      ? unionBox([caption.bounding_box, ...neighboring.boxes])
      : fallbackCaptionRegionBox(caption, pageBounds, kind);
  if (!sourceBox) return undefined;

  const boundingBox = expandAndClampBox(
    sourceBox,
    pageBounds,
    visualRegionMargin(kind, pageBounds)
  );
  if (!isUsefulRegionBox(boundingBox)) return undefined;

  const regionId = `${caption.id}-${kind}-region`;
  const signals = [
    `caption-prefix-${kind}`,
    'caption-bounding-box',
    ...neighboring.signals,
    ...(neighboring.boxes.length === 0 ? ['caption-region-expansion'] : []),
  ];

  return {
    region: {
      id: regionId,
      page: caption.page,
      bounding_box: boundingBox,
    },
    target_element_id: regionId,
    target_element_type: kind,
    source_caption_element_id: caption.id,
    source_caption_text: caption.content.trim(),
    candidate_signals: signals,
  };
};

export function selectVisualEnrichmentCandidates(
  elements: PdfDocumentElement[],
  maxVisualEnrichments: number,
  options: { pageGeometry?: PdfPageGeometry[] | undefined } = {}
): VisualEnrichmentCandidate[] {
  const maxCandidates = Math.max(1, maxVisualEnrichments);
  const directTargets = elements.filter(visualTargetElement);
  const pageBounds = buildPageBoundsIndex(elements, options.pageGeometry);
  const elementsByPage = buildElementsByPage(elements);
  const candidates: Array<VisualEnrichmentCandidate & { order: number }> = [];

  for (const [index, element] of elements.entries()) {
    if (visualTargetElement(element)) {
      candidates.push({
        order: index,
        element,
        region: {
          id: element.id,
          page: element.page,
          bounding_box: element.bounding_box,
        },
        target_element_id: element.id,
        target_element_type: element.type,
        candidate_signals: [`${element.type}-element`, 'element-bounding-box'],
      });
      continue;
    }

    if (!captionElement(element)) continue;
    const kind = captionVisualKind(element.content);
    const bounds = pageBounds.get(element.page);
    if (!kind || !bounds || hasNearbyDirectTarget(element, kind, directTargets)) continue;

    const candidate = buildCaptionRegionCandidate(
      element,
      kind,
      elementsByPage.get(element.page) ?? [],
      bounds
    );
    if (candidate) candidates.push({ ...candidate, order: index });
  }

  return candidates
    .sort((left, right) => left.order - right.order)
    .slice(0, maxCandidates)
    .map(({ order: _order, ...candidate }) => candidate);
}

const toPdfVisualEnrichmentCandidate = (
  candidate: VisualEnrichmentCandidate
): PdfVisualEnrichmentCandidate => ({
  id: candidate.region.id ?? candidate.target_element_id,
  page: candidate.region.page,
  region: candidate.region,
  target_element_id: candidate.target_element_id,
  target_element_type: candidate.target_element_type,
  ...(candidate.element ? { source_element_id: candidate.element.id } : {}),
  ...(candidate.source_caption_element_id
    ? { source_caption_element_id: candidate.source_caption_element_id }
    : {}),
  ...(candidate.source_caption_text ? { source_caption_text: candidate.source_caption_text } : {}),
  candidate_signals: candidate.candidate_signals ?? [],
});

export const buildVisualEnrichmentsForSource = async (
  input: BuildVisualEnrichmentsInput
): Promise<BuildVisualEnrichmentsOutput> => {
  const candidates = selectVisualEnrichmentCandidates(
    input.elements,
    Math.max(1, input.maxVisualEnrichments),
    { pageGeometry: input.pageGeometry }
  );
  const visualEnrichmentCandidates = candidates.map(toPdfVisualEnrichmentCandidate);

  const providerStatus = getRegionAnalysisProviderStatus();
  if (providerStatus.readiness !== 'ready') {
    return {
      visualEnrichmentCandidates,
      visualEnrichments: [],
      warnings: [
        `Visual enrichment skipped: analyze_regions provider is ${providerStatus.readiness}.`,
        ...(providerStatus.warnings ?? []),
      ],
    };
  }

  if (candidates.length === 0) {
    return {
      visualEnrichmentCandidates,
      visualEnrichments: [],
      warnings: [
        'Visual enrichment requested, but no table, image, or caption-derived visual regions with bounding boxes were available.',
      ],
    };
  }

  const candidatesByRegionId = new Map(
    candidates.map((candidate) => [candidate.region.id as string, candidate])
  );
  const options = {
    ...defaultAnalyzeRegionsOptions(),
    max_regions: Math.max(1, input.maxVisualEnrichments),
  };

  try {
    const analyzed = await analyzePdfRegionsFromSource(
      {
        path: input.source.path,
        url: input.source.url,
        regions: candidates.map((candidate) => candidate.region),
      },
      options
    );

    return {
      visualEnrichmentCandidates,
      visualEnrichments: analyzed.analyses.map((analysis): PdfVisualEnrichment => {
        const candidate = candidatesByRegionId.get(analysis.region_id);
        const targetElement = candidate?.element;

        return {
          id: `visual-${analysis.region_id}`,
          target_element_id:
            candidate?.target_element_id ?? targetElement?.id ?? analysis.region_id,
          target_element_type:
            candidate?.target_element_type ??
            targetElement?.type ??
            (analysis.kind === 'unknown' || analysis.kind === 'text'
              ? 'visual_region'
              : analysis.kind),
          ...(candidate?.source_caption_element_id
            ? { source_caption_element_id: candidate.source_caption_element_id }
            : {}),
          ...(candidate?.source_caption_text
            ? { source_caption_text: candidate.source_caption_text }
            : {}),
          ...(candidate?.candidate_signals
            ? { candidate_signals: candidate.candidate_signals }
            : {}),
          ...analysis,
        };
      }),
      warnings: analyzed.warnings,
    };
  } catch (error: unknown) {
    const message = error instanceof PdfError ? error.message : String(error);
    return {
      visualEnrichmentCandidates,
      visualEnrichments: [],
      warnings: [`Visual enrichment unavailable for ${input.sourceDescription}: ${message}`],
    };
  }
};
