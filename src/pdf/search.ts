import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {
  PageContentItem,
  PdfSearchMatch,
  PdfSearchSourceResult,
  PdfSource,
  SearchPdfOptions,
} from '../types/pdf.js';
import { ErrorCode, PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { buildWarnings, extractPageContent } from './extractor.js';
import { loadPdfDocument } from './loader.js';
import { getTargetPages } from './parser.js';

const logger = createLogger('Search');

export const DEFAULT_SEARCH_MAX_PAGES = 100;
export const DEFAULT_SEARCH_MAX_MATCHES = 50;
export const DEFAULT_SEARCH_CONTEXT_CHARS = 120;

const ASCII_WORD = /[A-Za-z0-9_]/;

export const defaultSearchPdfOptions = (query: string): SearchPdfOptions => ({
  query,
  case_sensitive: false,
  whole_word: false,
  max_pages: DEFAULT_SEARCH_MAX_PAGES,
  max_matches_per_source: DEFAULT_SEARCH_MAX_MATCHES,
  context_chars: DEFAULT_SEARCH_CONTEXT_CHARS,
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
        ...(item.bounding_box
          ? { bounding_box: item.bounding_box, bounding_box_level: 'text_item' as const }
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
    if (loadingTask && typeof loadingTask.destroy === 'function') {
      try {
        await loadingTask.destroy();
      } catch (destroyError: unknown) {
        const message = destroyError instanceof Error ? destroyError.message : String(destroyError);
        logger.warn('Error destroying searched PDF document', {
          sourceDescription,
          error: message,
        });
      }
    }
  }
};
