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
  private readonly pending = new Map<string, Promise<pdfjsLib.PDFDocumentProxy>>();

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

    let pending = this.pending.get(key);
    if (!pending) {
      pending = loadPdfDocumentCore(source, sourceDescription)
        .then(async (pdfDocument) => {
          const raced = this.entries.get(key);
          if (raced) {
            await destroyLoadingTask(pdfDocument.loadingTask, logger, 'PDF session duplicate');
            return raced.pdfDocument;
          }
          this.entries.set(key, { pdfDocument, refCount: 0 });
          return pdfDocument;
        })
        .finally(() => {
          this.pending.delete(key);
        });
      this.pending.set(key, pending);
    }

    await pending;
    const entry = this.entries.get(key);
    if (!entry) {
      throw new Error(`PDF session entry missing after acquire for ${key}`);
    }
    entry.refCount += 1;
    return entry.pdfDocument;
  }

  release(source: { path?: string | undefined; url?: string | undefined }): void {
    const key = pdfSessionKey(source);
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.refCount = Math.max(0, entry.refCount - 1);
    // Keep the parsed document at refCount 0 so later stages in the same MCP
    // request (inspection → extraction → OCR/visual) can re-acquire without
    // reparsing. destroyAll() tears everything down at request end.
  }

  async destroyAll(): Promise<void> {
    this.pending.clear();
    const entries = [...this.entries.values()];
    this.entries.clear();
    await Promise.all(
      entries.map((entry) =>
        destroyLoadingTask(entry.pdfDocument.loadingTask, logger, 'PDF session document')
      )
    );
  }

  /** Test helper: number of distinct parsed sources currently held. */
  activeSourceCount(): number {
    return this.entries.size;
  }
}
