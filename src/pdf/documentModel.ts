import type {
  ExtractedImage,
  ExtractedTable,
  PageContentItem,
  PdfChunk,
  PdfDocumentElement,
  PdfPageGeometry,
  PdfSafetyFinding,
  PdfTextElement,
  PdfTextSemanticHint,
  PdfTextSemanticRole,
} from '../types/pdf.js';
import { tablesToMarkdown } from './tableExtractor.js';

const DEFAULT_CHUNK_MAX_CHARS = 1800;

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
}

const buildPageTextStats = (items: PageContentItem[]): PageTextStats => {
  const heights = items
    .filter((item) => item.type === 'text' && item.textContent?.trim() && item.height)
    .map((item) => item.height as number)
    .sort((a, b) => a - b);

  if (heights.length === 0) {
    return { maxHeight: 0, medianHeight: 0, textItemCount: 0 };
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
  };
};

export const buildSemanticHint = (
  item: PageContentItem,
  stats: PageTextStats
): PdfTextSemanticHint | undefined => {
  if (item.type !== 'text' || !item.textContent?.trim()) return undefined;

  const textContent = item.textContent.trim();
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
  includeSemanticHints: boolean
): PdfDocumentElement[] => {
  const elements: PdfDocumentElement[] = [];
  const tablesByPage = new Map<number, ExtractedTable[]>();

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
      },
      bounding_box: table.bounding_box,
      confidence: table.confidence,
      provenance: {
        engine: 'pdfjs',
        source: 'table-detector',
      },
    });
  };

  for (const pageContent of pageContents) {
    const stats = includeSemanticHints ? buildPageTextStats(pageContent.items) : undefined;
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

    for (const item of pageContent.items) {
      const element = contentItemToElement(item, pageContent.page, elementIndex);
      if (!element) {
        continue;
      }

      if (element.type === 'text') {
        const textContent = element.content.trim();
        const snippet = snippetFromText(textContent);

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
  }

  return findings;
};

export const textElementsOnly = (elements: PdfDocumentElement[]): PdfTextElement[] =>
  elements.filter((element): element is PdfTextElement => element.type === 'text');
