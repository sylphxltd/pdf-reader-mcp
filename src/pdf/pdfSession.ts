// Request-scoped PDF document session — one parse per source per MCP request.

import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createLogger } from '../utils/logger.js';
import { destroyLoadingTask } from '../utils/pdfjs.js';
import { loadPdfDocumentCore } from './loader.js';

const logger = createLogger('PdfSession');

export const pdfSessionKey = (source: {
  path?: string | undefined;
  url?: string | undefined;
}): string => source.path ?? source.url ?? '';

type SessionEntry = {
  pdfDocument: pdfjsLib.PDFDocumentProxy;
  refCount: number;
};

/**
 * Holds parsed PDF documents for the lifetime of one MCP tool request so
 * inspection, extraction, OCR, and region crops reuse the same pdfjs parse.
 */
export class PdfSessionScope {
  private readonly entries = new Map<string, SessionEntry>();

  async acquire(
    source: { path?: string | undefined; url?: string | undefined },
    sourceDescription: string
  ): Promise<pdfjsLib.PDFDocumentProxy> {
    const key = pdfSessionKey(source);
    const existing = this.entries.get(key);
    if (existing) {
      existing.refCount += 1;
      return existing.pdfDocument;
    }

    const pdfDocument = await loadPdfDocumentCore(source, sourceDescription);
    this.entries.set(key, { pdfDocument, refCount: 1 });
    return pdfDocument;
  }

  release(source: { path?: string | undefined; url?: string | undefined }): void {
    const key = pdfSessionKey(source);
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.refCount = Math.max(0, entry.refCount - 1);
  }

  async destroyAll(): Promise<void> {
    for (const [, entry] of this.entries) {
      await destroyLoadingTask(entry.pdfDocument.loadingTask, logger, 'PDF session document');
    }
    this.entries.clear();
  }

  /** Test helper: number of distinct parsed sources currently held. */
  activeSourceCount(): number {
    return this.entries.size;
  }
}
