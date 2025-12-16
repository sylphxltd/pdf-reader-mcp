// PDF document loading utilities

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ErrorCode, PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { resolvePath } from '../utils/pathUtils.js';

const logger = createLogger('Loader');

// Resolve CMap path relative to pdfjs-dist package location
// This ensures CMap files are found regardless of the current working directory
const require = createRequire(import.meta.url);
const CMAP_URL = require.resolve('pdfjs-dist/package.json').replace('package.json', 'cmaps/');

// Maximum PDF file size: 100MB
// Prevents memory exhaustion from loading extremely large files
const MAX_PDF_SIZE = 100 * 1024 * 1024;

/**
 * Load a PDF document from a local file path or URL
 * @param source - Object containing either path or url
 * @param sourceDescription - Description for error messages
 * @returns PDF document proxy
 */
export const loadPdfDocument = async (
  source: { path?: string | undefined; url?: string | undefined },
  sourceDescription: string
): Promise<pdfjsLib.PDFDocumentProxy> => {
  let pdfDataSource: Uint8Array | { url: string };

  try {
    if (source.path) {
      const safePath = resolvePath(source.path);
      const buffer = await fs.readFile(safePath);

      // Security: Check file size to prevent memory exhaustion
      if (buffer.length > MAX_PDF_SIZE) {
        throw new PdfError(
          ErrorCode.InvalidRequest,
          `PDF file exceeds maximum size of ${MAX_PDF_SIZE} bytes (${(MAX_PDF_SIZE / 1024 / 1024).toFixed(0)}MB). File size: ${buffer.length} bytes.`
        );
      }

      pdfDataSource = new Uint8Array(buffer);
    } else if (source.url) {
      pdfDataSource = { url: source.url };
    } else {
      throw new PdfError(
        ErrorCode.InvalidParams,
        `Source ${sourceDescription} missing 'path' or 'url'.`
      );
    }
  } catch (err: unknown) {
    if (err instanceof PdfError) {
      throw err;
    }

    const message = err instanceof Error ? err.message : String(err);
    const errorCode = ErrorCode.InvalidRequest;

    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      err.code === 'ENOENT' &&
      source.path
    ) {
      throw new PdfError(errorCode, `File not found at '${source.path}'.`, {
        cause: err instanceof Error ? err : undefined,
      });
    }

    throw new PdfError(
      errorCode,
      `Failed to prepare PDF source ${sourceDescription}. Reason: ${message}`,
      { cause: err instanceof Error ? err : undefined }
    );
  }

  const documentParams =
    pdfDataSource instanceof Uint8Array ? { data: pdfDataSource } : pdfDataSource;

  const loadingTask = getDocument({
    ...documentParams,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
  });

  try {
    return await loadingTask.promise;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('PDF.js loading error', { sourceDescription, error: message });
    throw new PdfError(
      ErrorCode.InvalidRequest,
      `Failed to load PDF document from ${sourceDescription}. Reason: ${message || 'Unknown loading error'}`,
      { cause: err instanceof Error ? err : undefined }
    );
  }
};
