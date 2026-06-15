import type {
  ExtractedImage,
  ExtractedTable,
  PageContentItem,
  PdfChunk,
  PdfDocumentElement,
  PdfLayoutColumn,
  PdfPageGeometry,
  PdfPageLayoutDiagnostics,
  PdfSafetyFinding,
  PdfTextElement,
  PdfTextSemanticHint,
  PdfTextSemanticRole,
} from '../types/pdf.js';
import { tablesToMarkdown } from './tableExtractor.js';

const DEFAULT_CHUNK_MAX_CHARS = 1800;
const LAYOUT_COLUMN_MIN_GAP = 48;
const LAYOUT_COLUMN_MIN_GAP_RATIO = 0.14;
const LAYOUT_SPANNING_WIDTH_RATIO = 0.72;
const LAYOUT_POSITIONED_RATIO_WARNING = 0.8;
const SEMANTIC_PAGE_EDGE_ZONE_RATIO = 0.08;
const SEMANTIC_PAGE_EDGE_MIN_POINTS = 36;
const SAFETY_TEXT_OVERLAP_RATIO = 0.65;
const SAFETY_MAX_OVERLAP_FINDINGS_PER_PAGE = 10;
const CAPTION_PREFIX_PATTERN =
  /^(?:fig(?:ure)?|table|chart|formula|image|diagram)\s*(?:\d+|[ivxlcdm]+)?\s*[:.)-]/iu;
const FOOTER_PATTERN =
  /^(?:page\s*)?\d+\s*(?:\/|of)\s*\d+$|^page\s+\d+$|copyright|all rights reserved/iu;
const HEADER_PATTERN = /\b(?:confidential|draft|internal|prepared\s+(?:for|by))\b/iu;

const buildElementId = (page: number, type: PdfDocumentElement['type'], index: number): string =>
  `p${String(page)}-${type}-${String(index)}`;

const imageElementMetadata = (imageData: ExtractedImage): Omit<ExtractedImage, 'data'> => {
  const { data: _data, ...metadata } = imageData;
  return metadata;
};

interface PageTextStats {
  maxHeight: number;
  medianHeight: number;
  textItemCount: number;
  hasPageGeometry: boolean;
  pageLeft: number;
  pageRight: number;
  pageBottom: number;
  pageTop: number;
}

const pageGeometryByPage = (
  pageGeometry: PdfPageGeometry[] | undefined
): Map<number, PdfPageGeometry> => {
  const index = new Map<number, PdfPageGeometry>();

  for (const geometry of pageGeometry ?? []) {
    index.set(geometry.page, geometry);
  }

  return index;
};

const pageBoundsFromGeometry = (
  geometry: PdfPageGeometry | undefined
):
  | Pick<PageTextStats, 'hasPageGeometry' | 'pageLeft' | 'pageRight' | 'pageBottom' | 'pageTop'>
  | undefined => {
  if (!geometry) return undefined;

  const left = geometry.view_box?.left ?? 0;
  const right = geometry.view_box?.right ?? geometry.width;
  const bottom = geometry.view_box?.bottom ?? 0;
  const top = geometry.view_box?.top ?? geometry.height;
  if (
    !Number.isFinite(left) ||
    !Number.isFinite(right) ||
    !Number.isFinite(bottom) ||
    !Number.isFinite(top) ||
    right <= left ||
    top <= bottom
  ) {
    return undefined;
  }

  return {
    hasPageGeometry: true,
    pageLeft: left,
    pageRight: right,
    pageBottom: bottom,
    pageTop: top,
  };
};

const contentBounds = (
  items: PageContentItem[]
): Pick<PageTextStats, 'hasPageGeometry' | 'pageLeft' | 'pageRight' | 'pageBottom' | 'pageTop'> => {
  const boxes = items.map((item) => item.bounding_box).filter((box) => box !== undefined);
  if (boxes.length === 0) {
    return { hasPageGeometry: false, pageLeft: 0, pageRight: 0, pageBottom: 0, pageTop: 0 };
  }

  return {
    hasPageGeometry: false,
    pageLeft: Math.min(...boxes.map((box) => box.left)),
    pageRight: Math.max(...boxes.map((box) => box.right)),
    pageBottom: Math.min(...boxes.map((box) => box.bottom)),
    pageTop: Math.max(...boxes.map((box) => box.top)),
  };
};

const buildPageTextStats = (
  items: PageContentItem[],
  geometry?: PdfPageGeometry | undefined
): PageTextStats => {
  const bounds = pageBoundsFromGeometry(geometry) ?? contentBounds(items);
  const heights = items
    .filter((item) => item.type === 'text' && item.textContent?.trim() && item.height)
    .map((item) => item.height as number)
    .sort((a, b) => a - b);

  if (heights.length === 0) {
    return { maxHeight: 0, medianHeight: 0, textItemCount: 0, ...bounds };
  }

  const midpoint = Math.floor(heights.length / 2);
  const medianHeight =
    heights.length % 2 === 0
      ? ((heights[midpoint - 1] ?? 0) + (heights[midpoint] ?? 0)) / 2
      : (heights[midpoint] ?? 0);

  return {
    maxHeight: heights.at(-1) ?? 0,
    medianHeight,
    textItemCount: heights.length,
    ...bounds,
  };
};

const compactTextHeight = (height: number, stats: PageTextStats): boolean => {
  if (height <= 0) return false;
  if (stats.medianHeight <= 0) return height <= 12;

  return height <= Math.max(stats.medianHeight * 1.25, stats.medianHeight + 2);
};

const pageEdgeRole = (
  item: PageContentItem,
  textContent: string,
  stats: PageTextStats
): PdfTextSemanticHint | undefined => {
  if (!stats.hasPageGeometry || !item.bounding_box) return undefined;

  const pageHeight = stats.pageTop - stats.pageBottom;
  if (pageHeight <= 0) return undefined;

  const edgeZone = Math.max(
    SEMANTIC_PAGE_EDGE_MIN_POINTS,
    pageHeight * SEMANTIC_PAGE_EDGE_ZONE_RATIO
  );
  const nearTop = item.bounding_box.top >= stats.pageTop - edgeZone;
  const nearBottom = item.bounding_box.bottom <= stats.pageBottom + edgeZone;
  const withinHorizontalPage =
    item.bounding_box.left >= stats.pageLeft - 4 && item.bounding_box.right <= stats.pageRight + 4;
  const height = item.height ?? item.bounding_box.top - item.bounding_box.bottom;
  const compact = compactTextHeight(height, stats);
  const shortLine = textContent.length <= 140;
  const footerPattern = FOOTER_PATTERN.test(textContent);

  if (nearBottom && withinHorizontalPage && shortLine && footerPattern) {
    return {
      role: 'footer',
      confidence: 0.88,
      signals: ['page-bottom-band', ...(compact ? ['compact-edge-text'] : []), 'footer-pattern'],
    };
  }

  if (nearTop && withinHorizontalPage && shortLine && compact && HEADER_PATTERN.test(textContent)) {
    return {
      role: 'header',
      confidence: 0.82,
      signals: ['page-top-band', 'compact-edge-text', 'header-pattern'],
    };
  }

  return undefined;
};

export const buildSemanticHint = (
  item: PageContentItem,
  stats: PageTextStats
): PdfTextSemanticHint | undefined => {
  if (item.type !== 'text' || !item.textContent?.trim()) return undefined;

  const textContent = item.textContent.trim();
  if (CAPTION_PREFIX_PATTERN.test(textContent)) {
    return {
      role: 'caption',
      confidence: 0.86,
      signals: ['caption-prefix'],
    };
  }

  const edgeRole = pageEdgeRole(item, textContent, stats);
  if (edgeRole) return edgeRole;

  if (/^([-*]\s+|\d+[.)]\s+)/.test(textContent)) {
    return {
      role: 'list_item',
      confidence: 0.92,
      signals: ['list-prefix'],
    };
  }

  const height = item.height ?? 0;
  const isShortLine = textContent.length <= 120;
  const endsLikeSentence = /[.!?]$/.test(textContent);
  const isLargeText =
    stats.textItemCount > 1 &&
    height > 0 &&
    stats.medianHeight > 0 &&
    height >= stats.medianHeight * 1.3 &&
    height >= stats.maxHeight * 0.8;

  if (isLargeText && isShortLine && !endsLikeSentence) {
    const ratio = height / stats.medianHeight;
    const level = ratio >= 1.8 ? 1 : ratio >= 1.55 ? 2 : 3;
    return {
      role: 'heading',
      level,
      confidence: 0.78,
      signals: ['larger-text', 'short-line'],
    };
  }

  return {
    role: 'paragraph',
    confidence: 0.5,
    signals: ['default-text'],
  };
};

export const contentItemToElement = (
  item: PageContentItem,
  page: number,
  index: number,
  semanticHint?: PdfTextSemanticHint | undefined
): PdfDocumentElement | undefined => {
  if (item.type === 'text' && item.textContent?.trim()) {
    return {
      id: buildElementId(page, 'text', index),
      type: 'text',
      page,
      content: item.textContent,
      bounding_box: item.bounding_box,
      provenance: {
        engine: 'pdfjs',
        source: 'text-content',
      },
      ...(semanticHint ? { semantic_hint: semanticHint } : {}),
    };
  }

  if (item.type === 'image' && item.imageData) {
    return {
      id: buildElementId(page, 'image', index),
      type: 'image',
      page,
      image: imageElementMetadata(item.imageData),
      bounding_box: item.bounding_box,
      provenance: {
        engine: 'pdfjs',
        source: 'image-xobject',
      },
    };
  }

  return undefined;
};

export const buildStructuredElements = (
  pageContents: Array<{ page: number; items: PageContentItem[] }>,
  tables: ExtractedTable[] | undefined,
  includeSemanticHints: boolean,
  pageGeometry?: PdfPageGeometry[] | undefined
): PdfDocumentElement[] => {
  const elements: PdfDocumentElement[] = [];
  const tablesByPage = new Map<number, ExtractedTable[]>();
  const geometryByPage = pageGeometryByPage(pageGeometry);

  for (const table of tables ?? []) {
    const pageTables = tablesByPage.get(table.page) ?? [];
    pageTables.push(table);
    tablesByPage.set(table.page, pageTables);
  }

  const appendTableElement = (table: ExtractedTable) => {
    elements.push({
      id: buildElementId(table.page, 'table', table.tableIndex + 1),
      type: 'table',
      page: table.page,
      table: {
        rows: table.rows,
        ...(table.cells ? { cells: table.cells } : {}),
        ...(table.bounding_box ? { bounding_box: table.bounding_box } : {}),
        rowCount: table.rowCount,
        colCount: table.colCount,
        confidence: table.confidence,
        ...(table.quality ? { quality: table.quality } : {}),
        ...(table.continuation ? { continuation: table.continuation } : {}),
        ...(table.provenance ? { provenance: table.provenance } : {}),
      },
      bounding_box: table.bounding_box,
      confidence: table.confidence,
      provenance:
        table.provenance?.source === 'ocr_text_layer'
          ? {
              engine: 'external-command',
              source: 'ocr-table-detector',
              ocr_source_render_evidence_id: table.provenance.ocr_source_render_evidence_id,
            }
          : {
              engine: 'pdfjs',
              source: 'table-detector',
            },
    });
  };

  for (const pageContent of pageContents) {
    const stats = includeSemanticHints
      ? buildPageTextStats(pageContent.items, geometryByPage.get(pageContent.page))
      : undefined;
    let elementIndex = 1;
    for (const item of pageContent.items) {
      const semanticHint = stats ? buildSemanticHint(item, stats) : undefined;
      const element = contentItemToElement(item, pageContent.page, elementIndex, semanticHint);
      if (element) {
        elements.push(element);
        elementIndex++;
      }
    }

    const pageTables = tablesByPage.get(pageContent.page);
    if (pageTables) {
      for (const table of pageTables.sort((a, b) => a.tableIndex - b.tableIndex)) {
        appendTableElement(table);
      }
      tablesByPage.delete(pageContent.page);
    }
  }

  const remainingTables = Array.from(tablesByPage.values())
    .flat()
    .sort((a, b) => a.page - b.page || a.tableIndex - b.tableIndex);
  for (const table of remainingTables) {
    appendTableElement(table);
  }

  return elements;
};

export const renderMarkdownFromPageContents = (
  pageContents: Array<{ page: number; items: PageContentItem[] }>,
  tables: ExtractedTable[] | undefined
): string => {
  const sections: string[] = [];

  for (const pageContent of pageContents) {
    const pageLines: string[] = [`## Page ${String(pageContent.page)}`, ''];

    for (const item of pageContent.items) {
      if (item.type === 'text' && item.textContent?.trim()) {
        pageLines.push(item.textContent.trim(), '');
      } else if (item.type === 'image' && item.imageData) {
        pageLines.push(
          `[Image ${String(item.imageData.index + 1)}: ${String(item.imageData.width)}x${String(
            item.imageData.height
          )} ${item.imageData.format}]`,
          ''
        );
      }
    }

    sections.push(pageLines.join('\n').trimEnd());
  }

  if (tables && tables.length > 0) {
    sections.push(tablesToMarkdown(tables));
  }

  return sections.join('\n\n').trim();
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderTablesToHtml = (tables: ExtractedTable[] | undefined): string[] => {
  if (!tables || tables.length === 0) return [];

  return tables.map((table) => {
    const rows = table.rows
      .map((row) => {
        const cells = row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('');
        return `<tr>${cells}</tr>`;
      })
      .join('\n');
    return [
      `<table data-page="${String(table.page)}" data-table-index="${String(table.tableIndex)}">`,
      '<tbody>',
      rows,
      '</tbody>',
      '</table>',
    ].join('\n');
  });
};

export const renderHtmlFromPageContents = (
  pageContents: Array<{ page: number; items: PageContentItem[] }>,
  tables: ExtractedTable[] | undefined
): string => {
  const sections = pageContents.map((pageContent) => {
    const body: string[] = [
      `<section data-page="${String(pageContent.page)}">`,
      `<h2>Page ${String(pageContent.page)}</h2>`,
    ];

    for (const item of pageContent.items) {
      if (item.type === 'text' && item.textContent?.trim()) {
        body.push(`<p>${escapeHtml(item.textContent.trim())}</p>`);
      } else if (item.type === 'image' && item.imageData) {
        body.push(
          [
            `<figure data-image-index="${String(item.imageData.index)}">`,
            `<figcaption>Image ${String(item.imageData.index + 1)}: ${String(
              item.imageData.width
            )}x${String(item.imageData.height)} ${escapeHtml(item.imageData.format)}</figcaption>`,
            '</figure>',
          ].join('\n')
        );
      }
    }

    body.push('</section>');
    return body.join('\n');
  });

  return [...sections, ...renderTablesToHtml(tables)].join('\n\n').trim();
};

interface ChunkDraft {
  pageStart: number;
  pageEnd: number;
  textParts: string[];
  elementIds: string[];
  boundingBoxes: NonNullable<PdfChunk['bounding_boxes']>;
  strategy: NonNullable<PdfChunk['strategy']>;
  heading?: string | undefined;
}

const elementText = (element: PdfDocumentElement): string | undefined => {
  if (element.type === 'text') return element.content.trim();
  if (element.type === 'table') {
    const tableText = element.table.rows
      .map((row) => row.join(' | '))
      .join('\n')
      .trim();
    return tableText.length > 0 ? tableText : undefined;
  }
  return undefined;
};

const elementRole = (element: PdfDocumentElement): PdfTextSemanticRole | undefined =>
  element.type === 'text' ? element.semantic_hint?.role : undefined;

const chunkTextLength = (draft: ChunkDraft): number =>
  draft.textParts.reduce((sum, part) => sum + part.length + 1, 0);

const createChunkDraft = (
  element: PdfDocumentElement,
  strategy: NonNullable<PdfChunk['strategy']>,
  heading?: string | undefined
): ChunkDraft => ({
  pageStart: element.page,
  pageEnd: element.page,
  textParts: [],
  elementIds: [],
  boundingBoxes: [],
  strategy,
  heading,
});

const addElementToChunk = (draft: ChunkDraft, element: PdfDocumentElement, textValue: string) => {
  draft.pageEnd = Math.max(draft.pageEnd, element.page);
  draft.textParts.push(textValue);
  draft.elementIds.push(element.id);
  if (element.bounding_box) {
    draft.boundingBoxes.push(element.bounding_box);
  }
};

const finalizeChunk = (draft: ChunkDraft, index: number): PdfChunk | undefined => {
  const textValue = draft.textParts.join('\n').trim();
  if (!textValue) return undefined;

  return {
    id:
      draft.pageStart === draft.pageEnd
        ? `p${String(draft.pageStart)}-chunk-${String(index)}`
        : `p${String(draft.pageStart)}-p${String(draft.pageEnd)}-chunk-${String(index)}`,
    page_start: draft.pageStart,
    page_end: draft.pageEnd,
    text: textValue,
    element_ids: draft.elementIds,
    strategy: draft.strategy,
    ...(draft.heading ? { heading: draft.heading } : {}),
    ...(draft.boundingBoxes.length > 0 ? { bounding_boxes: draft.boundingBoxes } : {}),
  };
};

export const buildCitationChunks = (
  elements: PdfDocumentElement[],
  options: {
    useSemanticBoundaries: boolean;
    maxChars?: number | undefined;
  }
): PdfChunk[] => {
  const maxChars = options.maxChars ?? DEFAULT_CHUNK_MAX_CHARS;
  const chunks: PdfChunk[] = [];
  let current: ChunkDraft | undefined;

  const pushCurrent = () => {
    if (!current) return;
    const chunk = finalizeChunk(current, chunks.length + 1);
    if (chunk) chunks.push(chunk);
    current = undefined;
  };

  for (const element of elements) {
    const textValue = elementText(element);
    if (!textValue) continue;

    const role = elementRole(element);
    const shouldStartSemanticChunk = options.useSemanticBoundaries && role === 'heading';
    const shouldStartTableChunk = element.type === 'table';
    const exceedsSize =
      current !== undefined &&
      current.elementIds.length > 0 &&
      chunkTextLength(current) + textValue.length > maxChars;
    const crossesPage = current !== undefined && current.pageEnd !== element.page;

    if (shouldStartSemanticChunk || shouldStartTableChunk || exceedsSize || crossesPage) {
      pushCurrent();
    }

    if (!current) {
      const strategy = shouldStartSemanticChunk ? 'semantic' : exceedsSize ? 'size' : 'page';
      const heading =
        shouldStartSemanticChunk && element.type === 'text' ? element.content.trim() : undefined;
      current = createChunkDraft(element, strategy, heading);
    }

    if (element.type === 'table' && current.elementIds.length === 0) {
      current.strategy = 'table';
    }

    addElementToChunk(current, element, textValue);

    if (element.type === 'table') {
      pushCurrent();
    }
  }

  pushCurrent();

  return chunks;
};

const roundRatio = (value: number): number => Math.round(value * 100) / 100;

const clampConfidence = (value: number): number => Math.max(0.2, Math.min(0.98, roundRatio(value)));

const boxWidth = (box: PageContentItem['bounding_box']): number =>
  box ? Math.max(0, box.right - box.left) : 0;

const boxArea = (box: PageContentItem['bounding_box']): number => {
  if (!box) return 0;
  return Math.max(0, box.right - box.left) * Math.max(0, box.top - box.bottom);
};

const boxCenterX = (box: PageContentItem['bounding_box']): number =>
  box ? (box.left + box.right) / 2 : 0;

const toLayoutColumn = (items: PageContentItem[], index: number): PdfLayoutColumn => {
  const boxes = items.map((item) => item.bounding_box).filter((box) => box !== undefined);
  return {
    index,
    left: Math.min(...boxes.map((box) => box.left)),
    right: Math.max(...boxes.map((box) => box.right)),
    item_count: items.length,
  };
};

const detectLayoutColumns = (positionedItems: PageContentItem[]): PdfLayoutColumn[] => {
  if (positionedItems.length < 4) return [];

  const left = Math.min(...positionedItems.map((item) => item.bounding_box?.left ?? 0));
  const right = Math.max(...positionedItems.map((item) => item.bounding_box?.right ?? 0));
  const pageWidth = right - left;
  if (pageWidth <= 0) return [];

  const candidates = positionedItems.filter(
    (item) => boxWidth(item.bounding_box) < pageWidth * LAYOUT_SPANNING_WIDTH_RATIO
  );
  if (candidates.length < 4) return [];

  const sorted = [...candidates].sort(
    (a, b) => (a.bounding_box?.left ?? 0) - (b.bounding_box?.left ?? 0)
  );
  let currentRight = sorted[0]?.bounding_box?.right;
  if (currentRight === undefined) return [];

  let largestGap = 0;
  let cutPosition: number | undefined;
  for (let i = 1; i < sorted.length; i++) {
    const box = sorted[i]?.bounding_box;
    if (!box) continue;

    if (box.left > currentRight) {
      const gap = box.left - currentRight;
      if (gap > largestGap) {
        largestGap = gap;
        cutPosition = (box.left + currentRight) / 2;
      }
    }
    currentRight = Math.max(currentRight, box.right);
  }

  const minGap = Math.max(LAYOUT_COLUMN_MIN_GAP, pageWidth * LAYOUT_COLUMN_MIN_GAP_RATIO);
  if (cutPosition === undefined || largestGap < minGap) return [];

  const leftColumn = candidates.filter((item) => boxCenterX(item.bounding_box) < cutPosition);
  const rightColumn = candidates.filter((item) => boxCenterX(item.bounding_box) >= cutPosition);
  if (leftColumn.length < 2 || rightColumn.length < 2) return [];

  return [toLayoutColumn(leftColumn, 1), toLayoutColumn(rightColumn, 2)];
};

const overlapArea = (
  first: PageContentItem['bounding_box'],
  second: PageContentItem['bounding_box']
): number => {
  if (!first || !second) return 0;
  const width = Math.max(
    0,
    Math.min(first.right, second.right) - Math.max(first.left, second.left)
  );
  const height = Math.max(
    0,
    Math.min(first.top, second.top) - Math.max(first.bottom, second.bottom)
  );
  return width * height;
};

const countSignificantOverlaps = (items: PageContentItem[]): number => {
  const positionedItems = items.filter((item) => item.bounding_box !== undefined).slice(0, 200);
  let overlaps = 0;

  for (let i = 0; i < positionedItems.length; i++) {
    for (let j = i + 1; j < positionedItems.length; j++) {
      const first = positionedItems[i];
      const second = positionedItems[j];
      if (!first?.bounding_box || !second?.bounding_box) continue;

      const smallerArea = Math.min(boxArea(first.bounding_box), boxArea(second.bounding_box));
      if (smallerArea <= 0) continue;

      if (overlapArea(first.bounding_box, second.bounding_box) / smallerArea > 0.45) {
        overlaps++;
      }
    }
  }

  return overlaps;
};

export const buildLayoutDiagnostics = (
  pageContents: Array<{ page: number; items: PageContentItem[] }>
): PdfPageLayoutDiagnostics[] =>
  pageContents.map((pageContent) => {
    const itemCount = pageContent.items.length;
    const textItemCount = pageContent.items.filter((item) => item.type === 'text').length;
    const imageItemCount = pageContent.items.filter((item) => item.type === 'image').length;
    const positionedItems = pageContent.items.filter((item) => item.bounding_box !== undefined);
    const positionedItemRatio =
      itemCount === 0 ? 0 : roundRatio(positionedItems.length / itemCount);
    const columns = detectLayoutColumns(positionedItems);
    const left = positionedItems.length
      ? Math.min(...positionedItems.map((item) => item.bounding_box?.left ?? 0))
      : 0;
    const right = positionedItems.length
      ? Math.max(...positionedItems.map((item) => item.bounding_box?.right ?? 0))
      : 0;
    const pageWidth = right - left;
    const spanningItemCount =
      pageWidth > 0
        ? positionedItems.filter(
            (item) => boxWidth(item.bounding_box) >= pageWidth * LAYOUT_SPANNING_WIDTH_RATIO
          ).length
        : 0;
    const overlapCount = countSignificantOverlaps(pageContent.items);
    const signals = new Set<string>();
    const warnings: string[] = [];

    if (itemCount === 0) signals.add('empty-page-content');
    if (textItemCount > 0) signals.add('text-items');
    if (imageItemCount > 0) signals.add('image-items');
    if (positionedItems.length > 0) signals.add('positioned-items');
    if (positionedItemRatio < 1 && itemCount > 0) signals.add('unpositioned-items');
    if (columns.length >= 2) signals.add('two-column-layout');
    if (spanningItemCount > 0) signals.add('spanning-items');
    if (itemCount > 0 && itemCount < 3) signals.add('sparse-page');
    if (overlapCount > 0) signals.add('overlap-risk');

    if (positionedItemRatio < LAYOUT_POSITIONED_RATIO_WARNING && itemCount > 0) {
      warnings.push(
        'Some content items are missing coordinates; reading-order confidence is reduced.'
      );
    }
    if (overlapCount > 0) {
      warnings.push(
        'Some positioned items overlap significantly; verify reading order before citation-critical use.'
      );
    }

    const profile =
      itemCount === 0
        ? 'unknown'
        : textItemCount === 0
          ? 'image_or_sparse'
          : columns.length >= 2 && spanningItemCount > 0
            ? 'mixed_layout'
            : columns.length >= 2
              ? 'multi_column'
              : positionedItems.length > 0
                ? 'single_column'
                : 'unknown';
    const readingOrder =
      profile === 'multi_column'
        ? 'columnar'
        : profile === 'mixed_layout'
          ? 'mixed'
          : profile === 'single_column'
            ? 'natural'
            : 'uncertain';
    const baseConfidence =
      profile === 'single_column'
        ? 0.92
        : profile === 'multi_column'
          ? 0.86
          : profile === 'mixed_layout'
            ? 0.78
            : profile === 'image_or_sparse'
              ? 0.42
              : 0.3;
    const confidence = clampConfidence(
      baseConfidence -
        (1 - positionedItemRatio) * 0.35 -
        (overlapCount > 0 ? 0.12 : 0) -
        (itemCount > 0 && itemCount < 3 ? 0.12 : 0)
    );

    if (confidence < 0.7 && itemCount > 0) {
      warnings.push(
        'Layout confidence is below the recommended threshold for unattended RAG chunking.'
      );
    }

    return {
      page: pageContent.page,
      profile,
      reading_order: readingOrder,
      confidence,
      item_count: itemCount,
      text_item_count: textItemCount,
      image_item_count: imageItemCount,
      positioned_item_ratio: positionedItemRatio,
      column_count: columns.length > 0 ? columns.length : positionedItems.length > 0 ? 1 : 0,
      ...(columns.length > 0 ? { columns } : {}),
      signals: [...signals],
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  });

const PROMPT_INJECTION_PATTERNS = [
  /\bignore (all )?(previous|prior|above) instructions\b/i,
  /\bdisregard (previous|prior|above) instructions\b/i,
  /\bsystem prompt\b/i,
  /\bdeveloper (message|instruction)s?\b/i,
  /\bdo not (follow|obey) .*instructions\b/i,
];

const snippetFromText = (value: string): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
};

const normalizeSafetyText = (value: string): string =>
  value.replace(/\s+/g, ' ').trim().toLowerCase();

const mergeBoxes = (
  first: PageContentItem['bounding_box'],
  second: PageContentItem['bounding_box']
): PageContentItem['bounding_box'] | undefined => {
  if (!first || !second) return first ?? second;

  return {
    left: Math.min(first.left, second.left),
    bottom: Math.min(first.bottom, second.bottom),
    right: Math.max(first.right, second.right),
    top: Math.max(first.top, second.top),
  };
};

const isOutsideViewBox = (
  box: PageContentItem['bounding_box'],
  viewBox: PdfPageGeometry['view_box']
): boolean => {
  if (!box || !viewBox) return false;
  const tolerance = 1;
  return (
    box.right < viewBox.left - tolerance ||
    box.left > viewBox.right + tolerance ||
    box.top < viewBox.bottom - tolerance ||
    box.bottom > viewBox.top + tolerance
  );
};

export const buildSafetyFindings = (
  pageContents: Array<{ page: number; items: PageContentItem[] }>,
  pageGeometry: PdfPageGeometry[] | undefined
): PdfSafetyFinding[] => {
  const findings: PdfSafetyFinding[] = [];
  const geometryByPage = new Map(pageGeometry?.map((geometry) => [geometry.page, geometry]));

  for (const pageContent of pageContents) {
    let elementIndex = 1;
    const geometry = geometryByPage.get(pageContent.page);
    const textCandidates: Array<{
      element_id: string;
      text: string;
      snippet: string;
      bounding_box: NonNullable<PageContentItem['bounding_box']>;
    }> = [];

    for (const item of pageContent.items) {
      const element = contentItemToElement(item, pageContent.page, elementIndex);
      if (!element) {
        continue;
      }

      if (element.type === 'text') {
        const textContent = element.content.trim();
        const snippet = snippetFromText(textContent);
        if (element.bounding_box) {
          textCandidates.push({
            element_id: element.id,
            text: textContent,
            snippet,
            bounding_box: element.bounding_box,
          });
        }

        if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(textContent))) {
          findings.push({
            type: 'prompt_injection_pattern',
            severity: 'high',
            page: pageContent.page,
            element_id: element.id,
            message: 'Text matches a common prompt-injection instruction pattern.',
            snippet,
            ...(element.bounding_box ? { bounding_box: element.bounding_box } : {}),
          });
        }

        if (item.height !== undefined && item.height > 0 && item.height < 2) {
          findings.push({
            type: 'tiny_text',
            severity: 'medium',
            page: pageContent.page,
            element_id: element.id,
            message: 'Text is unusually small and may be hidden, decorative, or extraction noise.',
            snippet,
            ...(element.bounding_box ? { bounding_box: element.bounding_box } : {}),
          });
        }

        if (isOutsideViewBox(element.bounding_box, geometry?.view_box)) {
          findings.push({
            type: 'off_page_text',
            severity: 'medium',
            page: pageContent.page,
            element_id: element.id,
            message: 'Text bounding box falls outside the PDF page view box.',
            snippet,
            ...(element.bounding_box ? { bounding_box: element.bounding_box } : {}),
          });
        }
      }

      elementIndex++;
    }

    let overlapFindingCount = 0;
    for (let i = 0; i < textCandidates.length; i++) {
      if (overlapFindingCount >= SAFETY_MAX_OVERLAP_FINDINGS_PER_PAGE) break;

      for (let j = i + 1; j < textCandidates.length; j++) {
        if (overlapFindingCount >= SAFETY_MAX_OVERLAP_FINDINGS_PER_PAGE) break;

        const first = textCandidates[i];
        const second = textCandidates[j];
        if (!first || !second) continue;

        const smallerArea = Math.min(boxArea(first.bounding_box), boxArea(second.bounding_box));
        if (smallerArea <= 0) continue;

        const overlapRatio = overlapArea(first.bounding_box, second.bounding_box) / smallerArea;
        if (overlapRatio < SAFETY_TEXT_OVERLAP_RATIO) continue;

        const differentText = normalizeSafetyText(first.text) !== normalizeSafetyText(second.text);
        const boundingBox = mergeBoxes(first.bounding_box, second.bounding_box);
        findings.push({
          type: 'overlapping_text',
          severity: differentText ? 'high' : 'medium',
          page: pageContent.page,
          element_id: second.element_id,
          message: differentText
            ? 'Text substantially overlaps different text, which may visually spoof or obscure content.'
            : 'Text substantially overlaps another text item; verify rendered evidence before citation-critical use.',
          snippet: snippetFromText(`${first.snippet} / ${second.snippet}`),
          ...(boundingBox ? { bounding_box: boundingBox } : {}),
        });
        overlapFindingCount++;
      }
    }
  }

  return findings;
};

export const textElementsOnly = (elements: PdfDocumentElement[]): PdfTextElement[] =>
  elements.filter((element): element is PdfTextElement => element.type === 'text');
