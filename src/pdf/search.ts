import {
  mapRustMatchesToPdfSearchMatches,
  searchPdfTextViaRustEngine,
  shouldUseRustTextSearchEngine,
} from '../engine/rust-text-search.js';
import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {
  PageContentItem,
  PdfOcrPageData,
  PdfOcrWord,
  PdfSearchMatch,
  PdfSearchSourceResult,
  PdfSource,
  SearchPdfOptions,
} from '../types/pdf.js';
import { ErrorCode, PdfError } from '../utils/errors.js';
import { mergeBoundingBoxes } from '../utils/geometry.js';
import { createLogger } from '../utils/logger.js';
import { destroyLoadingTask } from '../utils/pdfjs.js';
import { buildWarnings, extractPageContent } from './extractor.js';
import { loadPdfDocument } from './loader.js';
import { defaultOcrPagesOptions, ocrPdfSourcePages } from './ocr.js';
import { getTargetPages } from './parser.js';

const logger = createLogger('Search');

const DEFAULT_SEARCH_MAX_PAGES = 100;
const DEFAULT_SEARCH_MAX_MATCHES = 50;
const DEFAULT_SEARCH_CONTEXT_CHARS = 120;

const ASCII_WORD = /[A-Za-z0-9_]/;

export const defaultSearchPdfOptions = (query: string): SearchPdfOptions => ({
  query,
  case_sensitive: false,
  whole_word: false,
  max_pages: DEFAULT_SEARCH_MAX_PAGES,
  max_matches_per_source: DEFAULT_SEARCH_MAX_MATCHES,
  context_chars: DEFAULT_SEARCH_CONTEXT_CHARS,
  include_ocr_text_layer: false,
});

export const resolvePagesToSearch = (
  targetPages: number[] | undefined,
  totalPages: number,
  maxPages: number
): { pagesToSearch: number[]; invalidPages: number[]; truncatedPages: number[] } => {
  const requestedPages =
    targetPages && targetPages.length > 0
      ? [...new Set(targetPages)].sort((a, b) => a - b)
      : Array.from({ length: totalPages }, (_, index) => index + 1);
  const validPages = requestedPages.filter((page) => page <= totalPages);
  const invalidPages = requestedPages.filter((page) => page > totalPages);

  return {
    pagesToSearch: validPages.slice(0, maxPages),
    invalidPages,
    truncatedPages: validPages.slice(maxPages),
  };
};

const isWordChar = (value: string | undefined): boolean =>
  value !== undefined && ASCII_WORD.test(value);

const isWholeWordMatch = (text: string, start: number, end: number): boolean =>
  !isWordChar(text[start - 1]) && !isWordChar(text[end]);

const normalizeForSearch = (value: string, caseSensitive: boolean): string =>
  caseSensitive ? value : value.toLocaleLowerCase();

const buildSnippet = (text: string, start: number, end: number, contextChars: number): string => {
  const snippetStart = Math.max(0, start - contextChars);
  const snippetEnd = Math.min(text.length, end + contextChars);
  const prefix = snippetStart > 0 ? '...' : '';
  const suffix = snippetEnd < text.length ? '...' : '';
  return `${prefix}${text.slice(snippetStart, snippetEnd)}${suffix}`;
};

const findMatchesInText = (
  text: string,
  query: string,
  options: Pick<SearchPdfOptions, 'case_sensitive' | 'whole_word'>
): Array<{ start: number; end: number }> => {
  if (query.length === 0) return [];

  const searchableText = normalizeForSearch(text, options.case_sensitive);
  const searchableQuery = normalizeForSearch(query, options.case_sensitive);
  const matches: Array<{ start: number; end: number }> = [];
  let searchFrom = 0;

  while (searchFrom <= searchableText.length - searchableQuery.length) {
    const start = searchableText.indexOf(searchableQuery, searchFrom);
    if (start === -1) break;

    const end = start + searchableQuery.length;
    if (!options.whole_word || isWholeWordMatch(searchableText, start, end)) {
      matches.push({ start, end });
    }
    searchFrom = Math.max(end, start + 1);
  }

  return matches;
};

interface OcrWordOffset {
  word: PdfOcrWord;
  index: number;
  start: number;
  end: number;
}

const buildOcrSearchText = (
  page: PdfOcrPageData
): { text: string; wordOffsets: OcrWordOffset[] } => {
  if (!page.words || page.words.length === 0) {
    return { text: page.text, wordOffsets: [] };
  }

  let cursor = 0;
  const parts: string[] = [];
  const wordOffsets: OcrWordOffset[] = [];

  page.words.forEach((word, index) => {
    if (parts.length > 0) {
      parts.push(' ');
      cursor++;
    }

    const start = cursor;
    parts.push(word.text);
    cursor += word.text.length;
    wordOffsets.push({ word, index, start, end: cursor });
  });

  return { text: parts.join(''), wordOffsets };
};

const matchOcrBoundingBox = (
  wordOffsets: OcrWordOffset[],
  start: number,
  end: number
):
  | {
      bounding_box: NonNullable<PageContentItem['bounding_box']>;
      first_word_index: number;
    }
  | undefined => {
  const overlappingWords = wordOffsets.filter(
    (wordOffset) => wordOffset.end > start && wordOffset.start < end
  );
  const boundingBox = mergeBoundingBoxes(
    overlappingWords.map((wordOffset) => wordOffset.word.bounding_box)
  );
  const firstWordIndex = overlappingWords[0]?.index;

  return boundingBox && firstWordIndex !== undefined
    ? { bounding_box: boundingBox, first_word_index: firstWordIndex }
    : undefined;
};

const matchBoundingBox = (
  item: PageContentItem,
  start: number,
  end: number
):
  | {
      bounding_box: NonNullable<PageContentItem['bounding_box']>;
      level: 'char_estimated' | 'text_item';
    }
  | undefined => {
  const charBoxes = (item.textRuns ?? [])
    .flatMap((run) => run.chars)
    .filter(
      (char) =>
        !char.is_whitespace &&
        char.item_char_start >= start &&
        char.item_char_end <= end &&
        char.bounding_box
    )
    .map((char) => char.bounding_box);
  const charBoundingBox = mergeBoundingBoxes(charBoxes);
  if (charBoundingBox) {
    return { bounding_box: charBoundingBox, level: 'char_estimated' };
  }

  return item.bounding_box ? { bounding_box: item.bounding_box, level: 'text_item' } : undefined;
};

export const searchOcrPage = (
  page: PdfOcrPageData,
  options: SearchPdfOptions,
  matchOffset: number
): PdfSearchMatch[] => {
  const matches: PdfSearchMatch[] = [];
  const { text, wordOffsets } = buildOcrSearchText(page);
  const ocrMatches = findMatchesInText(text, options.query, options);

  for (const ocrMatch of ocrMatches) {
    const matchedText = text.slice(ocrMatch.start, ocrMatch.end);
    const matchBox = matchOcrBoundingBox(wordOffsets, ocrMatch.start, ocrMatch.end);
    matches.push({
      id: `p${String(page.page)}-ocr-match-${String(matchOffset + matches.length + 1)}`,
      page: page.page,
      text: matchedText,
      snippet: buildSnippet(text, ocrMatch.start, ocrMatch.end, options.context_chars),
      match_start: ocrMatch.start,
      match_end: ocrMatch.end,
      ...(matchBox
        ? {
            ocr_word_index: matchBox.first_word_index,
            bounding_box: matchBox.bounding_box,
            bounding_box_level: 'ocr_word',
          }
        : {}),
      source_render_evidence_id: page.source_render_evidence_id,
      provenance: {
        engine: 'external-command',
        source: 'ocr-provider',
      },
    });
  }

  return matches;
};

export const searchPageContentItems = (
  page: number,
  items: PageContentItem[],
  options: SearchPdfOptions,
  matchOffset: number
): PdfSearchMatch[] => {
  const matches: PdfSearchMatch[] = [];
  const textItems = items.filter((item) => item.type === 'text' && item.textContent !== undefined);

  for (let textItemIndex = 0; textItemIndex < textItems.length; textItemIndex++) {
    const item = textItems[textItemIndex];
    if (!item?.textContent) continue;

    const itemMatches = findMatchesInText(item.textContent, options.query, options);
    for (const itemMatch of itemMatches) {
      const matchedText = item.textContent.slice(itemMatch.start, itemMatch.end);
      const matchBox = matchBoundingBox(item, itemMatch.start, itemMatch.end);
      matches.push({
        id: `p${String(page)}-match-${String(matchOffset + matches.length + 1)}`,
        page,
        text: matchedText,
        snippet: buildSnippet(
          item.textContent,
          itemMatch.start,
          itemMatch.end,
          options.context_chars
        ),
        match_start: itemMatch.start,
        match_end: itemMatch.end,
        text_item_index: textItemIndex,
        ...(matchBox
          ? { bounding_box: matchBox.bounding_box, bounding_box_level: matchBox.level }
          : {}),
        provenance: {
          engine: 'pdfjs',
          source: 'text-content',
        },
      });
    }
  }

  return matches;
};

export const searchPdfSource = async (
  source: PdfSource,
  options: SearchPdfOptions
): Promise<PdfSearchSourceResult> => {
  const sourceDescription = source.path ?? source.url ?? 'unknown source';

  if (
    source.path &&
    shouldUseRustTextSearchEngine(options.prefer_speed === true) &&
    !options.include_ocr_text_layer
  ) {
    const rustSearch = searchPdfTextViaRustEngine(source.path, options);
    if (rustSearch.ok) {
      return {
        source: sourceDescription,
        success: true,
        num_pages: rustSearch.result.numPages,
        searched_pages: rustSearch.result.searchedPages,
        total_matches: rustSearch.result.totalMatches,
        matches: mapRustMatchesToPdfSearchMatches(rustSearch.result.matches),
        ...(rustSearch.result.truncated ? { truncated: true } : {}),
        warnings: [
          'Search route: rust-text-index via literal PDF text extraction. Bounding boxes are unavailable on this route; use read_pdf or pdf_evidence for geometry-backed evidence.',
        ],
      };
    }
  }

  let pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;

  try {
    const targetPages = getTargetPages(source.pages, sourceDescription);
    const { pages: _pages, ...loadArgs } = source;
    pdfDocument = await loadPdfDocument(loadArgs, sourceDescription);
    const totalPages = pdfDocument.numPages;
    const { pagesToSearch, invalidPages, truncatedPages } = resolvePagesToSearch(
      targetPages,
      totalPages,
      options.max_pages
    );

    if (pagesToSearch.length === 0) {
      throw new PdfError(
        ErrorCode.InvalidRequest,
        `No valid pages to search for source ${sourceDescription}.`
      );
    }

    const warnings = buildWarnings(invalidPages, totalPages);
    if (truncatedPages.length > 0) {
      warnings.push(
        `Searched first ${String(options.max_pages)} selected pages; skipped ${truncatedPages.join(', ')} due to max_pages.`
      );
    }

    const matches: PdfSearchMatch[] = [];
    let truncated = false;

    for (const page of pagesToSearch) {
      const items = await extractPageContent(pdfDocument, page, false, sourceDescription);
      const pageMatches = searchPageContentItems(page, items, options, matches.length);
      for (const match of pageMatches) {
        if (matches.length >= options.max_matches_per_source) {
          truncated = true;
          break;
        }
        matches.push(match);
      }
      if (truncated) break;
    }

    if (
      !truncated &&
      options.include_ocr_text_layer &&
      matches.length < options.max_matches_per_source
    ) {
      try {
        const ocr = await ocrPdfSourcePages(
          { ...source, pages: pagesToSearch },
          defaultOcrPagesOptions()
        );
        warnings.push(...ocr.warnings);

        for (const page of ocr.pages) {
          const pageMatches = searchOcrPage(page, options, matches.length);
          for (const match of pageMatches) {
            if (matches.length >= options.max_matches_per_source) {
              truncated = true;
              break;
            }
            matches.push(match);
          }
          if (truncated) break;
        }
      } catch (error: unknown) {
        const message =
          error instanceof PdfError
            ? error.message
            : 'OCR provider failed before returning searchable text.';
        warnings.push(`OCR search unavailable: ${message}`);
      }
    }

    if (truncated) {
      warnings.push(
        `Search results truncated to ${String(options.max_matches_per_source)} matches for this source.`
      );
    }

    return {
      source: sourceDescription,
      success: true,
      num_pages: totalPages,
      searched_pages: pagesToSearch,
      total_matches: matches.length,
      matches,
      ...(truncated ? { truncated } : {}),
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } finally {
    const loadingTask = pdfDocument?.loadingTask;
    await destroyLoadingTask(loadingTask, logger, 'searched PDF document', { sourceDescription });
  }
};
