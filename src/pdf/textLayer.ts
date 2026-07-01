import type {
  BoundingBox,
  PageContentItem,
  PdfTextLayer,
  PdfTextLayerChar,
  PdfTextLayerLine,
  PdfTextLayerPage,
  PdfTextLayerRun,
  PdfTextLayerWord,
} from '../types/pdf.js';
import { mergeBoundingBoxes } from '../utils/geometry.js';

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

const buildFallbackChars = (
  lineText: string,
  pageCharStart: number,
  lineBox: BoundingBox | undefined
): PdfTextLayerChar[] => {
  const chars: PdfTextLayerChar[] = [];

  for (let cursor = 0; cursor < lineText.length; ) {
    const codePoint = lineText.codePointAt(cursor);
    const char = codePoint === undefined ? lineText[cursor] : String.fromCodePoint(codePoint);
    if (char === undefined) break;

    const charStartInLine = cursor;
    const charEndInLine = cursor + char.length;
    const boundingBox = estimateWordBoundingBox(lineBox, lineText, charStartInLine, charEndInLine);

    chars.push({
      index: chars.length,
      text: char,
      char_start: pageCharStart + charStartInLine,
      char_end: pageCharStart + charEndInLine,
      run_index: 0,
      is_whitespace: /\s/u.test(char),
      ...(boundingBox
        ? {
            bounding_box: boundingBox,
            bounding_box_level: 'char_estimated' as const,
            confidence: 0.6,
          }
        : {}),
    });

    cursor = charEndInLine;
  }

  return chars;
};

const buildRuns = (
  item: PageContentItem,
  lineText: string,
  pageCharStart: number
): PdfTextLayerRun[] => {
  const sourceRuns =
    item.textRuns && item.textRuns.length > 0
      ? item.textRuns
      : [
          {
            index: 0,
            text: lineText,
            item_char_start: 0,
            item_char_end: lineText.length,
            ...(item.bounding_box ? { bounding_box: item.bounding_box } : {}),
            chars: buildFallbackChars(lineText, 0, item.bounding_box).map((char) => ({
              index: char.index,
              text: char.text,
              item_char_start: char.char_start,
              item_char_end: char.char_end,
              is_whitespace: char.is_whitespace,
              ...(char.bounding_box ? { bounding_box: char.bounding_box } : {}),
              ...(char.confidence ? { confidence: char.confidence } : {}),
            })),
          },
        ];

  return sourceRuns.map((run, runIndex) => {
    const chars: PdfTextLayerChar[] = run.chars.map((char, charIndex) => ({
      index: charIndex,
      text: char.text,
      char_start: pageCharStart + char.item_char_start,
      char_end: pageCharStart + char.item_char_end,
      run_index: runIndex,
      is_whitespace: char.is_whitespace,
      ...(char.bounding_box
        ? {
            bounding_box: char.bounding_box,
            bounding_box_level: 'char_estimated' as const,
          }
        : {}),
      ...(char.confidence !== undefined ? { confidence: char.confidence } : {}),
    }));
    const hasCharBoxes = chars.some((char) => char.bounding_box);

    return {
      index: runIndex,
      text: run.text,
      char_start: pageCharStart + run.item_char_start,
      char_end: pageCharStart + run.item_char_end,
      ...(run.bounding_box ? { bounding_box: run.bounding_box } : {}),
      ...(run.font_name ? { font_name: run.font_name } : {}),
      ...(run.direction ? { direction: run.direction } : {}),
      ...(run.transform ? { transform: run.transform } : {}),
      ...(run.has_eol !== undefined ? { has_eol: run.has_eol } : {}),
      chars,
      provenance: {
        engine: 'pdfjs' as const,
        source: 'text-content' as const,
        bounding_box_level: hasCharBoxes ? ('char_estimated' as const) : ('text_run' as const),
      },
    };
  });
};

const buildWords = (
  lineText: string,
  pageCharStart: number,
  lineBox: BoundingBox | undefined,
  chars: PdfTextLayerChar[]
): PdfTextLayerWord[] => {
  const words: PdfTextLayerWord[] = [];
  const matches = lineText.matchAll(/\S+/g);

  for (const match of matches) {
    const text = match[0];
    const index = match.index ?? 0;
    const charStart = pageCharStart + index;
    const charEnd = charStart + text.length;
    const charBoxes = chars
      .filter(
        (char) =>
          !char.is_whitespace &&
          char.char_start >= charStart &&
          char.char_end <= charEnd &&
          char.bounding_box
      )
      .map((char) => char.bounding_box);
    const charDerivedBoundingBox = mergeBoundingBoxes(charBoxes);
    const boundingBox =
      charDerivedBoundingBox ??
      estimateWordBoundingBox(lineBox, lineText, index, index + text.length);

    words.push({
      index: words.length,
      text,
      char_start: charStart,
      char_end: charEnd,
      ...(boundingBox
        ? {
            bounding_box: boundingBox,
            bounding_box_level: charDerivedBoundingBox
              ? ('char_estimated' as const)
              : ('word_estimated' as const),
            confidence: charDerivedBoundingBox ? 0.74 : 0.68,
          }
        : {}),
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
    const runs = buildRuns(item, lineText, lineStart);
    const chars = runs.flatMap((run) => run.chars);
    const words = buildWords(lineText, lineStart, item.bounding_box, chars);
    const hasWordBoxes = words.some((word) => word.bounding_box);
    const hasCharBoxes = chars.some((char) => char.bounding_box);

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
      runs,
      words,
      chars,
      provenance: {
        engine: 'pdfjs',
        source: 'text-content',
        bounding_box_level: hasCharBoxes
          ? 'char_estimated'
          : hasWordBoxes
            ? 'word_estimated'
            : 'line',
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
  const runs = lines.flatMap((line) => line.runs);
  const words = lines.flatMap((line) => line.words);
  const chars = lines.flatMap((line) => line.chars);

  return {
    version: TEXT_LAYER_VERSION,
    profile: 'pdf_text_layer',
    pages,
    summary: {
      selected_pages: selectedPages,
      page_count: pages.length,
      run_count: runs.length,
      line_count: lines.length,
      word_count: words.length,
      char_count: pages.reduce((sum, page) => sum + page.char_count, 0),
      chars_with_bounding_boxes: chars.filter((char) => char.bounding_box).length,
      runs_with_bounding_boxes: runs.filter((run) => run.bounding_box).length,
      lines_with_bounding_boxes: lines.filter((line) => line.bounding_box).length,
      words_with_bounding_boxes: words.filter((word) => word.bounding_box).length,
      runs_with_font_metadata: runs.filter((run) => run.font_name !== undefined).length,
      runs_with_direction_metadata: runs.filter((run) => run.direction !== undefined).length,
      runs_with_transform_metadata: runs.filter((run) => run.transform !== undefined).length,
      runs_with_eol_metadata: runs.filter((run) => run.has_eol !== undefined).length,
    },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};
