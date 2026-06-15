import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it, vi } from 'vitest';
import { buildRenderWarnings, renderPdfPage, resolvePagesToRender } from '../../src/pdf/renderer.js';

const pngSignature = '89504e470d0a1a0a';

const buildMockDocument = () =>
  ({
    getPage: vi.fn().mockResolvedValue({
      getViewport: vi.fn(({ scale }: { scale: number }) => ({
        width: 612 * scale,
        height: 792 * scale,
        rotation: 0,
      })),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
      rotate: 0,
    }),
  }) as unknown as pdfjsLib.PDFDocumentProxy;

describe('renderer', () => {
  it('should default to the first page when no pages are specified', () => {
    expect(resolvePagesToRender(undefined, 10, 5)).toEqual({
      pagesToRender: [1],
      invalidPages: [],
      truncatedPages: [],
    });
  });

  it('should dedupe, sort, truncate, and report invalid render pages', () => {
    expect(resolvePagesToRender([2, 99, 1, 2], 3, 1)).toEqual({
      pagesToRender: [1],
      invalidPages: [99],
      truncatedPages: [2],
    });
  });

  it('should build bounded render warnings', () => {
    expect(buildRenderWarnings([99], [2, 3], 10, 1)).toEqual([
      'Requested pages 99 exceed document page count 10.',
      'Rendered first 1 selected pages; skipped 2, 3 due to max_pages.',
    ]);
  });

  it('should render a PDF page as PNG visual evidence', async () => {
    const document = buildMockDocument();
    const page = await renderPdfPage(document, 1, {
      scale: 1,
      max_pixels_per_page: 16_000_000,
    });

    expect(page).toMatchObject({
      page: 1,
      width: 612,
      height: 792,
      scale: 1,
      format: 'png',
      mime_type: 'image/png',
      provenance: {
        engine: 'pdfjs',
        renderer: '@napi-rs/canvas',
        source: 'page-render',
      },
    });
    expect(page?.data).not.toHaveLength(0);
    expect(
      Buffer.from(page?.data ?? '', 'base64')
        .subarray(0, 8)
        .toString('hex')
    ).toBe(pngSignature);
  });

  it('should reject page renders that exceed the pixel budget', async () => {
    const document = buildMockDocument();

    await expect(
      renderPdfPage(document, 1, {
        scale: 4,
        max_pixels_per_page: 10_000,
      })
    ).rejects.toThrow(/exceeding max_pixels_per_page/i);
  });
});
