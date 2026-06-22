import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PdfPageRenderData, PdfSource, RenderPageOptions } from '../types/pdf.js';
import { ErrorCode, PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { loadPdfDocument } from './loader.js';
import { getTargetPages } from './parser.js';

export const DEFAULT_RENDER_SCALE = 2;
export const DEFAULT_MAX_RENDER_PAGES = 5;
export const DEFAULT_MAX_RENDER_PIXELS = 16_000_000;

const logger = createLogger('Renderer');
const require = createRequire(import.meta.url);
const requireFromPdfjs = createRequire(require.resolve('pdfjs-dist/package.json'));

interface CanvasLike {
  getContext(type: '2d'): unknown;
  toBuffer(mimeType: 'image/png'): Buffer;
}

type CanvasModule = {
  createCanvas(width: number, height: number): CanvasLike;
};

type PageViewportLike = {
  width: number;
  height: number;
  rotation?: number | undefined;
};

type PageRenderable = pdfjsLib.PDFPageProxy & {
  rotate?: number | undefined;
  render(params: { canvasContext: unknown; viewport: PageViewportLike }): {
    promise: Promise<unknown>;
  };
};

const loadCanvasModule = async (): Promise<CanvasModule> => {
  try {
    const canvasEntry = requireFromPdfjs.resolve('@napi-rs/canvas');
    const imported = (await import(pathToFileURL(canvasEntry).href)) as
      | CanvasModule
      | { default?: CanvasModule };
    const canvasModule = 'createCanvas' in imported ? imported : imported.default;
    if (!canvasModule || typeof canvasModule.createCanvas !== 'function') {
      throw new Error('Canvas backend does not expose createCanvas.');
    }
    return canvasModule;
  } catch (error: unknown) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      'Page rendering requires the optional pdfjs native canvas backend. Install with optional dependencies enabled, or use read_pdf or pdf_evidence operation inspect without visual rendering.',
      { cause: error instanceof Error ? error : undefined }
    );
  }
};

const formatPixels = (pixels: number): string => `${(pixels / 1_000_000).toFixed(1)}MP`;

const finitePositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export const resolvePagesToRender = (
  targetPages: number[] | undefined,
  totalPages: number,
  maxPages: number
): { pagesToRender: number[]; invalidPages: number[]; truncatedPages: number[] } => {
  const requestedPages =
    targetPages && targetPages.length > 0
      ? [...new Set(targetPages)].sort((a, b) => a - b)
      : totalPages > 0
        ? [1]
        : [];

  const validPages = requestedPages.filter((page) => page <= totalPages);
  const invalidPages = requestedPages.filter((page) => page > totalPages);
  const pagesToRender = validPages.slice(0, maxPages);
  const truncatedPages = validPages.slice(maxPages);

  return { pagesToRender, invalidPages, truncatedPages };
};

export const buildRenderWarnings = (
  invalidPages: number[],
  truncatedPages: number[],
  totalPages: number,
  maxPages: number
): string[] => {
  const warnings: string[] = [];

  if (invalidPages.length > 0) {
    warnings.push(
      `Requested pages ${invalidPages.join(', ')} exceed document page count ${String(totalPages)}.`
    );
  }

  if (truncatedPages.length > 0) {
    warnings.push(
      `Rendered first ${String(maxPages)} selected pages; skipped ${truncatedPages.join(', ')} due to max_pages.`
    );
  }

  return warnings;
};

const assertRenderableDimensions = (
  width: number,
  height: number,
  maxPixels: number,
  pageNumber: number,
  scale: number
) => {
  if (!finitePositiveNumber(width) || !finitePositiveNumber(height)) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      `Page ${String(pageNumber)} has invalid render dimensions.`
    );
  }

  const pixelCount = width * height;
  if (pixelCount > maxPixels) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      `Page ${String(pageNumber)} would render ${formatPixels(pixelCount)} at scale ${String(scale)}, exceeding max_pixels_per_page ${formatPixels(maxPixels)}. Lower scale or raise max_pixels_per_page.`
    );
  }
};

export const renderPdfPage = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  options: Pick<RenderPageOptions, 'scale' | 'max_pixels_per_page'>
): Promise<PdfPageRenderData> => {
  const canvasModule = await loadCanvasModule();
  const page = (await pdfDocument.getPage(pageNumber)) as PageRenderable;
  const viewport = page.getViewport({ scale: options.scale }) as PageViewportLike;
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);

  assertRenderableDimensions(width, height, options.max_pixels_per_page, pageNumber, options.scale);

  const canvas = canvasModule.createCanvas(width, height);
  const canvasContext = canvas.getContext('2d');
  await page.render({ canvasContext, viewport }).promise;

  const buffer = canvas.toBuffer('image/png');
  const pixelCount = width * height;

  return {
    page: pageNumber,
    evidence_id: `page-${String(pageNumber)}-render-scale-${String(options.scale)}`,
    width,
    height,
    scale: options.scale,
    pixel_count: pixelCount,
    byte_length: buffer.byteLength,
    format: 'png',
    mime_type: 'image/png',
    rotation: page.rotate ?? viewport.rotation ?? 0,
    provenance: {
      engine: 'pdfjs',
      renderer: '@napi-rs/canvas',
      source: 'page-render',
    },
    data: buffer.toString('base64'),
  };
};

export const renderPdfSourcePages = async (
  source: PdfSource,
  options: RenderPageOptions
): Promise<{
  source: string;
  numPages: number;
  pages: PdfPageRenderData[];
  warnings: string[];
}> => {
  const sourceDescription = source.path ?? source.url ?? 'unknown source';
  let pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;

  try {
    const targetPages = getTargetPages(source.pages, sourceDescription);
    const { pages: _pages, ...loadArgs } = source;
    pdfDocument = await loadPdfDocument(loadArgs, sourceDescription);
    const totalPages = pdfDocument.numPages;
    const { pagesToRender, invalidPages, truncatedPages } = resolvePagesToRender(
      targetPages,
      totalPages,
      options.max_pages
    );

    if (pagesToRender.length === 0) {
      throw new PdfError(
        ErrorCode.InvalidRequest,
        `No valid pages to render for source ${sourceDescription}.`
      );
    }

    const warnings = buildRenderWarnings(
      invalidPages,
      truncatedPages,
      totalPages,
      options.max_pages
    );
    const pages: PdfPageRenderData[] = [];

    for (const pageNumber of pagesToRender) {
      pages.push(
        await renderPdfPage(pdfDocument, pageNumber, {
          scale: options.scale,
          max_pixels_per_page: options.max_pixels_per_page,
        })
      );
    }

    return { source: sourceDescription, numPages: totalPages, pages, warnings };
  } finally {
    const loadingTask = pdfDocument?.loadingTask;
    if (loadingTask && typeof loadingTask.destroy === 'function') {
      try {
        await loadingTask.destroy();
      } catch (destroyError: unknown) {
        const message = destroyError instanceof Error ? destroyError.message : String(destroyError);
        logger.warn('Error destroying rendered PDF document', {
          sourceDescription,
          error: message,
        });
      }
    }
  }
};
