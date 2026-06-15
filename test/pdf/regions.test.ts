import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import {
  buildRegionWarnings,
  cropPixelsForBoundingBox,
  cropRegionsFromRenderedPage,
  cropRenderedPagePng,
  selectRegionsToCrop,
} from '../../src/pdf/regions.js';
import type { PdfPageRenderData } from '../../src/types/pdf.js';

const pngSignature = '89504e470d0a1a0a';

const buildRenderedPage = (): PdfPageRenderData => {
  const png = new PNG({ width: 10, height: 10 });
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const index = (y * png.width + x) * 4;
      png.data[index] = x * 20;
      png.data[index + 1] = y * 20;
      png.data[index + 2] = 128;
      png.data[index + 3] = 255;
    }
  }

  return {
    page: 1,
    evidence_id: 'page-1-render-scale-1',
    width: 10,
    height: 10,
    scale: 1,
    pixel_count: 100,
    byte_length: 100,
    format: 'png',
    mime_type: 'image/png',
    rotation: 0,
    provenance: {
      engine: 'pdfjs',
      renderer: '@napi-rs/canvas',
      source: 'page-render',
    },
    data: PNG.sync.write(png).toString('base64'),
  };
};

describe('regions', () => {
  it('should select valid regions, report invalid pages, and truncate by budget', () => {
    expect(
      selectRegionsToCrop(
        [
          { page: 2, bounding_box: { left: 0, bottom: 0, right: 1, top: 1 } },
          { page: 99, bounding_box: { left: 0, bottom: 0, right: 1, top: 1 } },
          { page: 1, bounding_box: { left: 0, bottom: 0, right: 1, top: 1 } },
        ],
        3,
        1
      )
    ).toEqual({
      regionsToCrop: [
        {
          page: 2,
          bounding_box: { left: 0, bottom: 0, right: 1, top: 1 },
          regionIndex: 1,
        },
      ],
      invalidPages: [99],
      truncatedCount: 1,
    });
  });

  it('should build region warnings', () => {
    expect(buildRegionWarnings([99, 99, 101], 3, 10, 20)).toEqual([
      'Requested region pages 99, 101 exceed document page count 10.',
      'Cropped first 20 valid regions; skipped 3 due to max_regions.',
    ]);
  });

  it('should convert PDF coordinates to clamped pixel crops', () => {
    const page = buildRenderedPage();

    expect(cropPixelsForBoundingBox(page, { left: 2, bottom: 2, right: 6, top: 6 }, 1)).toEqual({
      left: 1,
      top: 3,
      width: 6,
      height: 6,
    });
  });

  it('should crop rendered PNG bytes', () => {
    const page = buildRenderedPage();
    const crop = cropRenderedPagePng(page, { left: 2, top: 3, width: 4, height: 5 });
    const decoded = PNG.sync.read(Buffer.from(crop.data, 'base64'));

    expect(Buffer.from(crop.data, 'base64').subarray(0, 8).toString('hex')).toBe(pngSignature);
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(5);
    expect(crop.byteLength).toBeGreaterThan(0);
  });

  it('should build region crop evidence without embedding page render data', () => {
    const page = buildRenderedPage();
    const regions = cropRegionsFromRenderedPage(page, [
      {
        id: 'table-1',
        page: 1,
        bounding_box: { left: 2, bottom: 2, right: 6, top: 6 },
        regionIndex: 1,
      },
    ]);

    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({
      region_id: 'table-1',
      page: 1,
      evidence_id: 'page-1-table-1-crop-scale-1',
      source_bounding_box: { left: 2, bottom: 2, right: 6, top: 6 },
      crop_pixels: { left: 2, top: 4, width: 4, height: 4 },
      provenance: {
        engine: 'pdfjs',
        renderer: '@napi-rs/canvas',
        source: 'region-crop',
        page_render_evidence_id: 'page-1-render-scale-1',
      },
    });
    expect(regions[0]?.data).not.toHaveLength(0);
  });
});
