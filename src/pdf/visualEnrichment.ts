import type {
  PdfDocumentElement,
  PdfRegionRequest,
  PdfSource,
  PdfVisualEnrichment,
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

interface VisualEnrichmentCandidate {
  element: VisualTargetElement;
  region: PdfRegionRequest;
}

export interface BuildVisualEnrichmentsInput {
  source: PdfSource;
  sourceDescription: string;
  elements: PdfDocumentElement[];
  maxVisualEnrichments: number;
}

export interface BuildVisualEnrichmentsOutput {
  visualEnrichments: PdfVisualEnrichment[];
  warnings: string[];
}

const visualTargetElement = (element: PdfDocumentElement): element is VisualTargetElement =>
  (element.type === 'image' || element.type === 'table') && element.bounding_box !== undefined;

export const selectVisualEnrichmentCandidates = (
  elements: PdfDocumentElement[],
  maxVisualEnrichments: number
): VisualEnrichmentCandidate[] => {
  const candidates: VisualEnrichmentCandidate[] = [];

  for (const element of elements) {
    if (!visualTargetElement(element)) continue;
    candidates.push({
      element,
      region: {
        id: element.id,
        page: element.page,
        bounding_box: element.bounding_box,
      },
    });
    if (candidates.length >= maxVisualEnrichments) break;
  }

  return candidates;
};

export const buildVisualEnrichmentsForSource = async (
  input: BuildVisualEnrichmentsInput
): Promise<BuildVisualEnrichmentsOutput> => {
  const providerStatus = getRegionAnalysisProviderStatus();
  if (providerStatus.readiness !== 'ready') {
    return {
      visualEnrichments: [],
      warnings: [
        `Visual enrichment skipped: analyze_regions provider is ${providerStatus.readiness}.`,
        ...(providerStatus.warnings ?? []),
      ],
    };
  }

  const candidates = selectVisualEnrichmentCandidates(
    input.elements,
    Math.max(1, input.maxVisualEnrichments)
  );
  if (candidates.length === 0) {
    return {
      visualEnrichments: [],
      warnings: [
        'Visual enrichment requested, but no table or image elements with bounding boxes were available.',
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
      visualEnrichments: analyzed.analyses.map((analysis): PdfVisualEnrichment => {
        const candidate = candidatesByRegionId.get(analysis.region_id);
        const targetElement = candidate?.element;

        return {
          id: `visual-${analysis.region_id}`,
          target_element_id: targetElement?.id ?? analysis.region_id,
          target_element_type: targetElement?.type ?? 'image',
          ...analysis,
        };
      }),
      warnings: analyzed.warnings,
    };
  } catch (error: unknown) {
    const message = error instanceof PdfError ? error.message : String(error);
    return {
      visualEnrichments: [],
      warnings: [`Visual enrichment unavailable for ${input.sourceDescription}: ${message}`],
    };
  }
};
