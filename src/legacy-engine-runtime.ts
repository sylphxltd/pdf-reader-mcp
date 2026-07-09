#!/usr/bin/env node
/**
 * Phase 1-3 legacy V3 engine runtime invoked only through pdf-reader-cli.
 * Not an MCP adapter — Rust rmcp owns MCP protocol; this script is temporary
 * migration glue for read_pdf/pdf_evidence until those paths live in Rust core.
 */

import { pdfEvidence } from './handlers/pdfEvidence.js';
import { readPdf } from './handlers/readPdf.js';
import { searchPdf } from './handlers/searchPdf.js';
import type { PdfEvidenceArgs } from './schemas/pdfEvidence.js';
import type { ReadPdfArgs } from './schemas/readPdf.js';
import type { SearchPdfArgs } from './schemas/searchPdf.js';
import type { CallToolResult, ContentBlock } from '@modelcontextprotocol/sdk/types.js';

type LegacyEngineRequest = {
  tool: string;
  arguments: unknown;
};

const tools = {
  read_pdf: readPdf,
  search_pdf: searchPdf,
  pdf_evidence: pdfEvidence,
} as const;

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
};

const isCallToolResult = (result: unknown): result is CallToolResult =>
  typeof result === 'object' && result !== null && 'content' in result;

const isContentArray = (result: unknown): result is readonly ContentBlock[] => Array.isArray(result);

const normalizeToolResult = (result: unknown): CallToolResult => {
  if (isContentArray(result)) {
    return { content: [...result] };
  }
  if (isCallToolResult(result)) {
    return result;
  }
  if (typeof result === 'object' && result !== null && 'type' in result) {
    return { content: [result as ContentBlock] };
  }
  return {
    content: [{ type: 'text', text: String(result) }],
  };
};

async function main(): Promise<void> {
  const payload = await readStdin();
  const request = JSON.parse(payload) as LegacyEngineRequest;
  const definition = tools[request.tool as keyof typeof tools];

  if (!definition) {
    console.log(
      JSON.stringify({
        content: [{ type: 'text', text: `Unsupported legacy engine tool: ${request.tool}` }],
        isError: true,
      } satisfies CallToolResult)
    );
    return;
  }

  try {
    const result = await (async () => {
      switch (request.tool) {
        case 'read_pdf':
          return readPdf.handler({ input: request.arguments as ReadPdfArgs, ctx: {} });
        case 'search_pdf':
          return searchPdf.handler({ input: request.arguments as SearchPdfArgs, ctx: {} });
        case 'pdf_evidence':
          return pdfEvidence.handler({ input: request.arguments as PdfEvidenceArgs, ctx: {} });
        default:
          throw new Error(`Unsupported legacy engine tool: ${request.tool}`);
      }
    })();
    console.log(JSON.stringify(normalizeToolResult(result)));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(
      JSON.stringify({
        content: [{ type: 'text', text: message }],
        isError: true,
      } satisfies CallToolResult)
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.log(
    JSON.stringify({
      content: [{ type: 'text', text: `Legacy engine runtime failed: ${message}` }],
      isError: true,
    } satisfies CallToolResult)
  );
  process.exit(1);
});