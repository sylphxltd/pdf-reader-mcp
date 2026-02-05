// Page range parsing utilities

import { MAX_RANGE_SIZE } from '../constants/pdf.js';
import { ErrorCode, PdfError } from '../utils/errors.js';
import { extractErrorMessage } from '../utils/errorUtils.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Parser');

/**
 * Parse a single range part (e.g., "1-3", "5", "7-")
 */
const parseRangePart = (part: string, pages: Set<number>): void => {
  const trimmedPart = part.trim();

  if (trimmedPart.includes('-')) {
    const splitResult = trimmedPart.split('-');
    const startStr = splitResult[0] || '';
    const endStr = splitResult[1];

    const start = parseInt(startStr, 10);
    const end = endStr === '' || endStr === undefined ? Infinity : parseInt(endStr, 10);

    if (Number.isNaN(start) || Number.isNaN(end) || start <= 0 || start > end) {
      throw new Error(`Invalid page range values: ${trimmedPart}`);
    }

    const practicalEnd = Math.min(end, start + MAX_RANGE_SIZE);
    for (let i = start; i <= practicalEnd; i++) {
      pages.add(i);
    }

    if (end === Infinity && practicalEnd === start + MAX_RANGE_SIZE) {
      logger.warn('Open-ended range truncated', { start, practicalEnd });
    }
  } else {
    const page = parseInt(trimmedPart, 10);
    if (Number.isNaN(page) || page <= 0) {
      throw new Error(`Invalid page number: ${trimmedPart}`);
    }
    pages.add(page);
  }
};

/**
 * Parse page range string into array of page numbers
 * @param ranges - Range string (e.g., "1-3,5,7-10")
 * @returns Sorted array of unique page numbers
 */
export const parsePageRanges = (ranges: string): number[] => {
  const pages = new Set<number>();
  const parts = ranges.split(',');

  for (const part of parts) {
    parseRangePart(part, pages);
  }

  // This should never happen as parseRangePart would have thrown an error
  // if no valid pages were found, but we keep this as a safety check
  /* c8 ignore next */
  if (pages.size === 0) {
    throw new Error('Page range string resulted in zero valid pages.');
  }

  return Array.from(pages).sort((a, b) => a - b);
};

/**
 * Get target pages from page specification
 * @param sourcePages - Page specification (string or array)
 * @param sourceDescription - Description for error messages
 * @returns Array of page numbers or undefined
 */
export const getTargetPages = (
  sourcePages: string | number[] | undefined,
  sourceDescription: string
): number[] | undefined => {
  if (!sourcePages) {
    return undefined;
  }

  try {
    if (typeof sourcePages === 'string') {
      return parsePageRanges(sourcePages);
    }

    // Array of page numbers
    if (sourcePages.some((p) => !Number.isInteger(p) || p <= 0)) {
      throw new Error('Page numbers in array must be positive integers.');
    }

    const uniquePages = [...new Set(sourcePages)].sort((a, b) => a - b);
    if (uniquePages.length === 0) {
      throw new Error('Page specification resulted in an empty set of pages.');
    }

    return uniquePages;
  } catch (error: unknown) {
    const message = extractErrorMessage(error);
    throw new PdfError(
      ErrorCode.InvalidParams,
      `Invalid page specification for source ${sourceDescription}: ${message}`
    );
  }
};

/**
 * Determine which pages to process based on target pages and document size
 */
export const determinePagesToProcess = (
  targetPages: number[] | undefined,
  totalPages: number,
  includeFullText: boolean
): { pagesToProcess: number[]; invalidPages: number[] } => {
  if (targetPages) {
    const pagesToProcess = targetPages.filter((p) => p <= totalPages);
    const invalidPages = targetPages.filter((p) => p > totalPages);
    return { pagesToProcess, invalidPages };
  }

  if (includeFullText) {
    const pagesToProcess = Array.from({ length: totalPages }, (_, i) => i + 1);
    return { pagesToProcess, invalidPages: [] };
  }

  return { pagesToProcess: [], invalidPages: [] };
};
