import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAutoExtractionPages,
  buildAutoReadArgs,
  buildReadOptions,
} from '../../src/pdf/autoReadPolicy.js';
import * as loader from '../../src/pdf/loader.js';
import { PdfSessionScope } from '../../src/pdf/pdfSession.js';
import type { PdfInspectionSourceResult } from '../../src/types/pdf.js';

const SAMPLE_PDF = path.resolve('test/fixtures/sample.pdf');

describe('read_pdf overhead optimizations', () => {
  it('bounds balanced auto-read extraction pages to the sample budget', () => {
    const inspection: PdfInspectionSourceResult = {
      source: SAMPLE_PDF,
      success: true,
      data: {
        profile: 'digital_text',
        num_pages: 100,
        sampled_pages: [1, 26, 51, 76, 100],
        page_signals: [],
        document_signals: {
          has_outline: false,
          has_page_labels: false,
          has_permissions: false,
          has_mark_info: false,
          has_form_fields: false,
          has_attachments: false,
          has_structure_tree: false,
        },
        recommendation: {
          workflow: 'agentic_rag',
          needs_ocr: false,
          reason: 'test',
          read_pdf_arguments: {},
          next_tools: [],
        },
        provider_status: {
          ocr_pages: {
            readiness: 'not_configured',
            provider: 'command',
            command_configured: false,
            health: 'not_checked',
            health_check: 'not_checked',
          },
          analyze_regions: {
            readiness: 'not_configured',
            provider: 'command',
            command_configured: false,
            health: 'not_checked',
            health_check: 'not_checked',
          },
        },
      },
    };

    const args = buildAutoReadArgs(
      { path: SAMPLE_PDF },
      inspection,
      { sources: [{ path: SAMPLE_PDF }] },
      'balanced'
    );

    expect(args.sources[0]?.pages?.length).toBe(5);
    expect(args.sources[0]?.pages?.every((page) => page >= 1 && page <= 100)).toBe(true);
  });

  it('processes all pages for full auto_detail', () => {
    const pages = buildAutoExtractionPages(12, 5, 'full');
    expect(pages).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('enables markdown and chunks for default auto-read options', () => {
    expect(
      buildReadOptions({ sources: [{ path: SAMPLE_PDF }], include_markdown: true }).includeMarkdown
    ).toBe(true);
  });
});

describe('PdfSessionScope', () => {
  let loadCoreSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    loadCoreSpy?.mockRestore();
  });

  it('deduplicates concurrent acquire for the same source key', async () => {
    const session = new PdfSessionScope();
    const destroyLoadingTask = vi.fn().mockResolvedValue(undefined);
    const fakeDoc = {
      numPages: 1,
      loadingTask: { destroy: destroyLoadingTask },
    };

    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });

    loadCoreSpy = vi.spyOn(loader, 'loadPdfDocumentCore').mockImplementation(async () => {
      await gate;
      return fakeDoc as unknown as Awaited<ReturnType<typeof loader.loadPdfDocumentCore>>;
    });

    const first = session.acquire({ path: SAMPLE_PDF }, SAMPLE_PDF);
    const second = session.acquire({ path: SAMPLE_PDF }, SAMPLE_PDF);
    releaseGate();
    const [docA, docB] = await Promise.all([first, second]);

    expect(docA).toBe(docB);
    expect(loadCoreSpy).toHaveBeenCalledTimes(1);
    expect(session.activeSourceCount()).toBe(1);

    await session.destroyAll();
  });

  it('does not throw when destroyAll races an in-flight acquire', async () => {
    const session = new PdfSessionScope();
    const destroyLoadingTask = vi.fn().mockResolvedValue(undefined);
    const fakeDoc = {
      numPages: 1,
      loadingTask: { destroy: destroyLoadingTask },
    };

    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });

    loadCoreSpy = vi.spyOn(loader, 'loadPdfDocumentCore').mockImplementation(async () => {
      await gate;
      return fakeDoc as unknown as Awaited<ReturnType<typeof loader.loadPdfDocumentCore>>;
    });

    const acquirePromise = session.acquire({ path: SAMPLE_PDF }, SAMPLE_PDF);
    const destroyPromise = session.destroyAll();
    releaseGate();

    await expect(acquirePromise).resolves.toBe(fakeDoc);
    await expect(destroyPromise).resolves.toBeUndefined();
    expect(session.activeSourceCount()).toBe(0);
  });

  it('tracks a single active source across acquire/release', async () => {
    const session = new PdfSessionScope();
    const destroyLoadingTask = vi.fn().mockResolvedValue(undefined);
    const fakeDoc = {
      numPages: 1,
      loadingTask: { destroy: destroyLoadingTask },
    };
    loadCoreSpy = vi
      .spyOn(loader, 'loadPdfDocumentCore')
      .mockResolvedValue(
        fakeDoc as unknown as Awaited<ReturnType<typeof loader.loadPdfDocumentCore>>
      );

    const first = await session.acquire({ path: SAMPLE_PDF }, SAMPLE_PDF);
    const second = await session.acquire({ path: SAMPLE_PDF }, SAMPLE_PDF);

    expect(first).toBe(second);
    expect(loadCoreSpy).toHaveBeenCalledTimes(1);
    expect(session.activeSourceCount()).toBe(1);

    session.release({ path: SAMPLE_PDF });
    session.release({ path: SAMPLE_PDF });
    expect(session.activeSourceCount()).toBe(1);

    await session.destroyAll();
    expect(session.activeSourceCount()).toBe(0);
    expect(destroyLoadingTask).toHaveBeenCalledTimes(1);
  });
});
