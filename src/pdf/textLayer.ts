import type {
  BoundingBox,
  PageContentItem,
  PdfTextLayer,
  PdfTextLayerLine,
  PdfTextLayerPage,
  PdfTextLayerWord,
} from '../types/pdf.js';

const TEXT_LAYER_VERSION = '2026-06-15' as const;

interface BuildTextLayerInput {
  selectedPages: number[];
  pageContents: Array<{ page: number; items: PageContentItem[] }>;
}

const estimateWordBoundingBox = (
  lineBox: BoundingBox | undefined,
  lineText: string,
  wordStartInLine: number,
  wordEndInLine: number
): BoundingBox | undefined => {
  if (!lineBox || lineText.length === 0 || wordEndInLine <= wordStartInLine) return undefined;

  const width = lineBox.right - lineBox.left;
  if (!Number.isFinite(width) || width <= 0) return undefined;

  const startRatio = Math.max(0, Math.min(1, wordStartInLine / lineText.length));
  const endRatio = Math.max(startRatio, Math.min(1, wordEndInLine / lineText.length));

  return {
    left: lineBox.left + width * startRatio,
    bottom: lineBox.bottom,
    right: lineBox.left + width * endRatio,
    top: lineBox.top,
  };
};

const buildWords = (
  lineText: string,
  pageCharStart: number,
  lineBox: BoundingBox | undefined
): PdfTextLayerWord[] => {
  const words: PdfTextLayerWord[] = [];
  const matches = lineText.matchAll(/\S+/g);

  for (const match of matches) {
    const text = match[0];
    const index = match.index ?? 0;
    const charStart = pageCharStart + index;
    const charEnd = charStart + text.length;
    const boundingBox = estimateWordBoundingBox(lineBox, lineText, index, index + text.length);

    words.push({
      index: words.length,
      text,
      char_start: charStart,
      char_end: charEnd,
      ...(boundingBox ? { bounding_box: boundingBox, confidence: 0.68 } : {}),
    });
  }

  return words;
};

const buildPage = (
  pageContent: { page: number; items: PageContentItem[] },
  warnings: string[]
): PdfTextLayerPage => {
  const lines: PdfTextLayerLine[] = [];
  const textParts: string[] = [];
  let pageCharOffset = 0;

  for (const item of pageContent.items) {
    if (item.type !== 'text' || !item.textContent?.trim()) continue;

    if (textParts.length > 0) {
      textParts.push('\n');
      pageCharOffset += 1;
    }

    const lineText = item.textContent;
    const lineStart = pageCharOffset;
    const lineEnd = lineStart + lineText.length;
    const words = buildWords(lineText, lineStart, item.bounding_box);
    const hasWordBoxes = words.some((word) => word.bounding_box);

    if (!item.bounding_box) {
      warnings.push(
        `Page ${String(pageContent.page)} line ${String(lines.length)} has no bounding box.`
      );
    }

    lines.push({
      id: `p${String(pageContent.page)}-line-${String(lines.length + 1)}`,
      index: lines.length,
      text: lineText,
      char_start: lineStart,
      char_end: lineEnd,
      ...(item.bounding_box ? { bounding_box: item.bounding_box } : {}),
      words,
      provenance: {
        engine: 'pdfjs',
        source: 'text-content',
        bounding_box_level: hasWordBoxes ? 'word_estimated' : 'line',
      },
    });

    textParts.push(lineText);
    pageCharOffset = lineEnd;
  }

  const text = textParts.join('');

  return {
    page: pageContent.page,
    text,
    char_count: text.length,
    line_count: lines.length,
    word_count: lines.reduce((sum, line) => sum + line.words.length, 0),
    lines,
  };
};

export const buildTextLayer = (input: BuildTextLayerInput): PdfTextLayer => {
  const selectedPages = [...new Set(input.selectedPages)].sort((a, b) => a - b);
  const warnings: string[] = [];
  const pages = input.pageContents
    .filter((pageContent) => selectedPages.includes(pageContent.page))
    .sort((a, b) => a.page - b.page)
    .map((pageContent) => buildPage(pageContent, warnings));

  const lines = pages.flatMap((page) => page.lines);
  const words = lines.flatMap((line) => line.words);

  return {
    version: TEXT_LAYER_VERSION,
    profile: 'pdf_text_layer',
    pages,
    summary: {
      selected_pages: selectedPages,
      page_count: pages.length,
      line_count: lines.length,
      word_count: words.length,
      char_count: pages.reduce((sum, page) => sum + page.char_count, 0),
      lines_with_bounding_boxes: lines.filter((line) => line.bounding_box).length,
      words_with_bounding_boxes: words.filter((word) => word.bounding_box).length,
    },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};
