// PDF processing constants

/**
 * Maximum number of pages to process concurrently
 * Prevents memory exhaustion on large PDFs
 */
export const MAX_CONCURRENT_PAGES = 5;

/**
 * Maximum number of PDF sources to process concurrently
 * Prevents memory exhaustion when processing multiple PDFs
 */
export const MAX_CONCURRENT_SOURCES = 3;

/**
 * Maximum PDF file size: 100MB
 * Prevents memory exhaustion from loading extremely large files
 */
export const MAX_PDF_SIZE = 100 * 1024 * 1024; // 100MB in bytes

/**
 * Maximum range size for page ranges
 * Prevents infinite loops for open-ended ranges
 */
export const MAX_RANGE_SIZE = 10000;

/**
 * PDF.js image kind constants
 */
export const ImageKind = {
  GRAYSCALE: 1,
  RGB: 2,
  RGBA: 3,
} as const;

/**
 * Number of channels for each image kind
 */
export const IMAGE_CHANNELS = {
  [ImageKind.GRAYSCALE]: 1,
  [ImageKind.RGB]: 3,
  [ImageKind.RGBA]: 4,
} as const;

/**
 * Image format names for each kind
 */
export const IMAGE_FORMATS = {
  [ImageKind.GRAYSCALE]: 'grayscale',
  [ImageKind.RGB]: 'rgb',
  [ImageKind.RGBA]: 'rgba',
} as const;
