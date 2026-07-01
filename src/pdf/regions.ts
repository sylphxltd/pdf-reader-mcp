import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PNG } from 'pngjs';
import type {
  ExtractRegionsOptions,
  PdfPageRenderData,
  PdfRegionBoundingBox,
  PdfRegionCropData,
  PdfRegionCropPixels,
  PdfRegionRequest,
} from '../types/pdf.js';
import { ErrorCode, PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { destroyLoadingTask } from '../utils/pdfjs.js';
import { loadPdfDocument } from './loader.js';
import { DEFAULT_MAX_RENDER_PIXELS, DEFAULT_RENDER_SCALE, renderPdfPage } from './renderer.js';

export const DEFAULT_MAX_REGIONS = 20;

const logger = createLogger('Regions');

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const validBoundingBox = (box: PdfRegionBoundingBox): boolean =>
  Number.isFinite(box.left) &&
  Number.isFinite(box.bottom) &&
  Number.isFinite(box.right) &&
  Number.isFinite(box.top) &&
  box.right > box.left &&
  box.top > box.bottom;

export const buildRegionWarnings = (
  invalidPages: number[],
  truncatedCount: number,
  totalPages: number,
  maxRegions: number
): string[] => {
  const warnings: string[] = [];

  if (invalidPages.length > 0) {
    warnings.push(
      `Requested region pages ${[...new Set(invalidPages)].sort((a, b) => a - b).join(', ')} exceed document page count ${String(totalPages)}.`
    );
  }

  if (truncatedCount > 0) {
    warnings.push(
      `Cropped first ${String(maxRegions)} valid regions; skipped ${String(truncatedCount)} due to max_regions.`
    );
  }

  return warnings;
};

export const selectRegionsToCrop = (
  regions: PdfRegionRequest[],
  totalPages: number,
  maxRegions: number
): {
  regionsToCrop: Array<PdfRegionRequest & { regionIndex: number }>;
  invalidPages: number[];
  truncatedCount: number;
} => {
  const validRegions: Array<PdfRegionRequest & { regionIndex: number }> = [];
  const invalidPages: number[] = [];

  regions.forEach((region, index) => {
    if (region.page > totalPages) {
      invalidPages.push(region.page);
      return;
    }

    validRegions.push({ ...region, regionIndex: index + 1 });
  });

  return {
    regionsToCrop: validRegions.slice(0, maxRegions),
    invalidPages,
    truncatedCount: Math.max(0, validRegions.length - maxRegions),
  };
};

export const cropPixelsForBoundingBox = (
  page: PdfPageRenderData,
  box: PdfRegionBoundingBox,
  padding = 0
): PdfRegionCropPixels => {
  if (!validBoundingBox(box)) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      'Region bounding_box must have right > left and top > bottom.'
    );
  }

  const left = Math.floor((box.left - padding) * page.scale);
  const right = Math.ceil((box.right + padding) * page.scale);
  const top = Math.floor(page.height - (box.top + padding) * page.scale);
  const bottom = Math.ceil(page.height - (box.bottom - padding) * page.scale);

  const clampedLeft = clamp(left, 0, page.width);
  const clampedTop = clamp(top, 0, page.height);
  const clampedRight = clamp(right, 0, page.width);
  const clampedBottom = clamp(bottom, 0, page.height);
  const width = clampedRight - clampedLeft;
  const height = clampedBottom - clampedTop;

  if (width <= 0 || height <= 0) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      'Region bounding_box does not intersect the rendered page.'
    );
  }

  return {
    left: clampedLeft,
    top: clampedTop,
    width,
    height,
  };
};

export const cropRenderedPagePng = (
  page: PdfPageRenderData,
  crop: PdfRegionCropPixels
): { data: string; byteLength: number } => {
  const source = PNG.sync.read(Buffer.from(page.data, 'base64'));
  const target = new PNG({ width: crop.width, height: crop.height });

  for (let y = 0; y < crop.height; y++) {
    const sourceStart = ((crop.top + y) * source.width + crop.left) * 4;
    const targetStart = y * crop.width * 4;
    source.data.copy(target.data, targetStart, sourceStart, sourceStart + crop.width * 4);
  }

  const buffer = PNG.sync.write(target);
  return { data: buffer.toString('base64'), byteLength: buffer.byteLength };
};

const groupRegionsByPage = (
  regions: Array<PdfRegionRequest & { regionIndex: number }>
): Map<number, Array<PdfRegionRequest & { regionIndex: number }>> => {
  const byPage = new Map<number, Array<PdfRegionRequest & { regionIndex: number }>>();
  for (const region of regions) {
    const pageRegions = byPage.get(region.page);
    if (pageRegions) {
      pageRegions.push(region);
    } else {
      byPage.set(region.page, [region]);
    }
  }
  return byPage;
};

export const cropRegionsFromRenderedPage = (
  renderedPage: PdfPageRenderData,
  regions: Array<PdfRegionRequest & { regionIndex: number }>
): PdfRegionCropData[] =>
  regions.map((region) => {
    const cropPixels = cropPixelsForBoundingBox(
      renderedPage,
      region.bounding_box,
      region.padding ?? 0
    );
    const crop = cropRenderedPagePng(renderedPage, cropPixels);
    const regionId = region.id ?? `region-${String(region.regionIndex)}`;

    return {
      region_id: regionId,
      page: region.page,
      evidence_id: `page-${String(region.page)}-${regionId}-crop-scale-${String(renderedPage.scale)}`,
      source_bounding_box: region.bounding_box,
      crop_pixels: cropPixels,
      scale: renderedPage.scale,
      byte_length: crop.byteLength,
      format: 'png',
      mime_type: 'image/png',
      provenance: {
        engine: 'pdfjs',
        renderer: '@napi-rs/canvas',
        source: 'region-crop',
        page_render_evidence_id: renderedPage.evidence_id,
      },
      data: crop.data,
    };
  });

export const extractRegionCropsFromSource = async (
  source: { path?: string | undefined; url?: string | undefined; regions: PdfRegionRequest[] },
  options: ExtractRegionsOptions
): Promise<{
  source: string;
  numPages: number;
  regions: PdfRegionCropData[];
  warnings: string[];
}> => {
  const sourceDescription = source.path ?? source.url ?? 'unknown source';
  let pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;

  try {
    pdfDocument = await loadPdfDocument({ path: source.path, url: source.url }, sourceDescription);
    const totalPages = pdfDocument.numPages;
    const { regionsToCrop, invalidPages, truncatedCount } = selectRegionsToCrop(
      source.regions,
      totalPages,
      options.max_regions
    );

    if (regionsToCrop.length === 0) {
      throw new PdfError(
        ErrorCode.InvalidRequest,
        `No valid regions to crop for source ${sourceDescription}.`
      );
    }

    const warnings = buildRegionWarnings(
      invalidPages,
      truncatedCount,
      totalPages,
      options.max_regions
    );
    const crops: PdfRegionCropData[] = [];

    for (const [pageNumber, pageRegions] of groupRegionsByPage(regionsToCrop)) {
      const renderedPage = await renderPdfPage(pdfDocument, pageNumber, {
        scale: options.scale,
        max_pixels_per_page: options.max_pixels_per_page,
      });
      crops.push(...cropRegionsFromRenderedPage(renderedPage, pageRegions));
    }

    return { source: sourceDescription, numPages: totalPages, regions: crops, warnings };
  } finally {
    const loadingTask = pdfDocument?.loadingTask;
    await destroyLoadingTask(loadingTask, logger, 'region crop PDF document', {
      sourceDescription,
    });
  }
};

export const defaultExtractRegionsOptions = (): ExtractRegionsOptions => ({
  scale: DEFAULT_RENDER_SCALE,
  max_regions: DEFAULT_MAX_REGIONS,
  max_pixels_per_page: DEFAULT_MAX_RENDER_PIXELS,
  include_image: true,
});
