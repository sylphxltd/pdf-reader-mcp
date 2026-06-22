import { tool, toolError } from '../mcp.js';
import { type PdfEvidenceArgs, pdfEvidenceArgsSchema } from '../schemas/pdfEvidence.js';
import { analyzeRegions } from './analyzeRegions.js';
import { extractRegions } from './extractRegions.js';
import { inspectPdf } from './inspectPdf.js';
import { ocrPages } from './ocrPages.js';
import { renderPage } from './renderPage.js';

type EvidenceSource = PdfEvidenceArgs['sources'][number];

const toPdfSources = (sources: EvidenceSource[]) =>
  sources.map((source) => ({
    ...(source.path !== undefined ? { path: source.path } : {}),
    ...(source.url !== undefined ? { url: source.url } : {}),
    ...(source.pages !== undefined ? { pages: source.pages } : {}),
  }));

const toRegionSources = (sources: EvidenceSource[]) => {
  const missingRegions = sources.find((source) => !source.regions || source.regions.length === 0);
  if (missingRegions) {
    return {
      success: false as const,
      error:
        'pdf_evidence operation requires sources[].regions for extract_regions and analyze_regions.',
    };
  }

  return {
    success: true as const,
    sources: sources.map((source) => ({
      ...(source.path !== undefined ? { path: source.path } : {}),
      ...(source.url !== undefined ? { url: source.url } : {}),
      regions: source.regions ?? [],
    })),
  };
};

const imageOptions = (input: PdfEvidenceArgs) => ({
  ...(input.scale !== undefined ? { scale: input.scale } : {}),
  ...(input.max_pages !== undefined ? { max_pages: input.max_pages } : {}),
  ...(input.max_regions !== undefined ? { max_regions: input.max_regions } : {}),
  ...(input.max_pixels_per_page !== undefined
    ? { max_pixels_per_page: input.max_pixels_per_page }
    : {}),
  ...(input.include_image !== undefined ? { include_image: input.include_image } : {}),
});

const providerOptions = (input: PdfEvidenceArgs) => ({
  ...(input.scale !== undefined ? { scale: input.scale } : {}),
  ...(input.max_pages !== undefined ? { max_pages: input.max_pages } : {}),
  ...(input.max_regions !== undefined ? { max_regions: input.max_regions } : {}),
  ...(input.max_pixels_per_page !== undefined
    ? { max_pixels_per_page: input.max_pixels_per_page }
    : {}),
  ...(input.timeout_ms !== undefined ? { timeout_ms: input.timeout_ms } : {}),
  ...(input.max_output_chars !== undefined ? { max_output_chars: input.max_output_chars } : {}),
  ...(input.languages !== undefined ? { languages: input.languages } : {}),
});

export const pdfEvidence = tool()
  .description(
    'Runs focused PDF evidence operations behind one V3 tool: inspect, render pages, crop regions, OCR pages, or analyze visual regions.'
  )
  .input(pdfEvidenceArgsSchema)
  .handler(async ({ input, ctx }) => {
    if (input.operation === 'inspect') {
      return inspectPdf.handler({
        input: {
          sources: toPdfSources(input.sources),
          ...(input.sample_pages !== undefined ? { sample_pages: input.sample_pages } : {}),
          ...(input.include_metadata !== undefined
            ? { include_metadata: input.include_metadata }
            : {}),
        },
        ctx,
      });
    }

    if (input.operation === 'render_page') {
      return renderPage.handler({
        input: {
          sources: toPdfSources(input.sources),
          ...imageOptions(input),
        },
        ctx,
      });
    }

    if (input.operation === 'ocr_pages') {
      return ocrPages.handler({
        input: {
          sources: toPdfSources(input.sources),
          ...providerOptions(input),
        },
        ctx,
      });
    }

    const regionSources = toRegionSources(input.sources);
    if (!regionSources.success) {
      return toolError(regionSources.error);
    }

    if (input.operation === 'extract_regions') {
      return extractRegions.handler({
        input: {
          sources: regionSources.sources,
          ...imageOptions(input),
        },
        ctx,
      });
    }

    return analyzeRegions.handler({
      input: {
        sources: regionSources.sources,
        ...providerOptions(input),
      },
      ctx,
    });
  });
