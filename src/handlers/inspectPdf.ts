import { text, tool, toolError } from '../mcp.js';
import { defaultInspectPdfOptions, inspectPdfSource } from '../pdf/inspector.js';
import { inspectPdfArgsSchema } from '../schemas/inspectPdf.js';
import type { PdfInspectionSourceResult } from '../types/pdf.js';

const MAX_CONCURRENT_SOURCES = 3;

export const inspectPdf = tool()
  .description(
    'Inspects one or more PDFs and recommends ordered MCP tool routing plus read_pdf options for agentic extraction, citations, safety, and OCR triage.'
  )
  .input(inspectPdfArgsSchema)
  .handler(async ({ input }) => {
    const options = {
      ...defaultInspectPdfOptions(),
      ...(input.sample_pages !== undefined ? { sample_pages: input.sample_pages } : {}),
      ...(input.include_metadata !== undefined ? { include_metadata: input.include_metadata } : {}),
    };
    const results: PdfInspectionSourceResult[] = [];

    for (let i = 0; i < input.sources.length; i += MAX_CONCURRENT_SOURCES) {
      const batch = input.sources.slice(i, i + MAX_CONCURRENT_SOURCES);
      const batchResults = await Promise.all(
        batch.map((source) => inspectPdfSource(source, options))
      );
      results.push(...batchResults);
    }

    if (results.every((result) => !result.success)) {
      const errorMessages = results.map((result) => result.error).join('; ');
      return toolError(`All PDF sources failed inspection: ${errorMessages}`);
    }

    return text(JSON.stringify({ results }, null, 2));
  });
