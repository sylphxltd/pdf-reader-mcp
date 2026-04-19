// PDF document loading utilities

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ErrorCode, PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { resolvePath } from '../utils/pathUtils.js';

const logger = createLogger('Loader');

// Resolve pdfjs-dist resource paths relative to the installed package.
//
// pdfjs-dist ships data files (CMaps, standard fonts, WASM decoders, ICC
// profiles) alongside its code. In Node.js these are loaded from the local
// filesystem, so each URL must be an absolute path to the directory — with a
// trailing slash — regardless of the current working directory.
//
// Why all four URLs matter:
//   - cMapUrl:            predefined Adobe CMaps for CJK/special encodings
//   - standardFontDataUrl: PDF standard fonts (Helvetica, Times, etc.)
//   - wasmUrl:            OpenJPEG (JPEG 2000) + QCMS (color management) WASM
//   - iccUrl:             ICC color profiles
//
// If any URL is omitted, pdfjs-dist logs "Ensure that the `<name>` API
// parameter is provided" and — worse — some code paths concatenate `null`
// with the filename (e.g. `nullopenjpeg_nowasm_fallback.js`), producing an
// ERR_MODULE_NOT_FOUND that breaks image decoding entirely (issue #271).
const require = createRequire(import.meta.url);
const PDFJS_ROOT = require.resolve('pdfjs-dist/package.json').replace('package.json', '');
const CMAP_URL = `${PDFJS_ROOT}cmaps/`;
const STANDARD_FONT_DATA_URL = `${PDFJS_ROOT}standard_fonts/`;
const WASM_URL = `${PDFJS_ROOT}wasm/`;
const ICC_URL = `${PDFJS_ROOT}iccs/`;

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
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    wasmUrl: WASM_URL,
    iccUrl: ICC_URL,
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
