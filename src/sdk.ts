/**
 * Citra SDK — programmatic PDF evidence API (Sylphx).
 *
 * Today this is a typed façade over the pure-Rust MCP server client.
 * Semantics match MCP tools: read_pdf, search_pdf, pdf_evidence.
 *
 * @example
 * ```ts
 * import { Citra } from '@sylphx/pdf-reader-mcp/sdk'
 * const citra = Citra.create()
 * const { payload, isError } = await citra.read({ sources: [{ path: '/abs/doc.pdf' }] })
 * ```
 */
import {
  createPureRustClient,
  type PureRustCallResult,
  PureRustClient,
  type PureRustClientOptions,
  resolvePureRustServerBinary,
} from './pure-rust.js';

export type { PureRustCallResult, PureRustClientOptions };
export { createPureRustClient, PureRustClient, resolvePureRustServerBinary };

export type PdfSource = {
  path?: string;
  url?: string;
  pages?: number[] | string;
};

export type CitraReadInput = {
  sources: PdfSource[];
  auto?: boolean;
  auto_detail?: 'fast' | 'balanced' | 'full';
  [key: string]: unknown;
};

export type CitraSearchInput = {
  sources: PdfSource[];
  query?: string;
  queries?: string[];
  [key: string]: unknown;
};

export type CitraEvidenceInput = {
  sources: PdfSource[];
  operation: string;
  [key: string]: unknown;
};

/** Citra — PDF instrument client */
export class Citra {
  private readonly client: PureRustClient;

  constructor(options: PureRustClientOptions = {}) {
    this.client = createPureRustClient(options);
  }

  static create(options?: PureRustClientOptions): Citra {
    return new Citra(options);
  }

  /** Agent Document Twin extraction (MCP: read_pdf). */
  read(input: CitraReadInput): Promise<PureRustCallResult> {
    return this.client.readPdf(input as Record<string, unknown>);
  }

  /** Cheap literal search with evidence (MCP: search_pdf). */
  search(input: CitraSearchInput): Promise<PureRustCallResult> {
    return this.client.searchPdf(input as Record<string, unknown>);
  }

  /** Focused evidence ops: inspect/render/crop/ocr/... (MCP: pdf_evidence). */
  evidence(input: CitraEvidenceInput): Promise<PureRustCallResult> {
    return this.client.pdfEvidence(input as Record<string, unknown>);
  }

  /** Escape hatch for raw tool names. */
  call(
    tool: 'read_pdf' | 'search_pdf' | 'pdf_evidence',
    args: Record<string, unknown>
  ): Promise<PureRustCallResult> {
    return this.client.callTool(tool, args);
  }
}

export default Citra;
