import { wrapPdfEvidenceResponse } from '../evidence/wrapResponse.js';
import { text, tool, toolError } from '../mcp.js';
import { defaultSearchPdfOptions, searchPdfSource } from '../pdf/search.js';
import { searchPdfArgsSchema } from '../schemas/searchPdf.js';
import type { PdfSearchSourceResult, SearchPdfOptions } from '../types/pdf.js';
import { safeErrorMessage } from '../utils/errorHandling.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('SearchPdf');

const buildOptions = (input: {
  query: string;
  case_sensitive?: boolean | undefined;
  whole_word?: boolean | undefined;
  include_ocr_text_layer?: boolean | undefined;
  max_pages?: number | undefined;
  max_matches_per_source?: number | undefined;
  context_chars?: number | undefined;
  prefer_speed?: boolean | undefined;
}): SearchPdfOptions => ({
  ...defaultSearchPdfOptions(input.query),
  ...(input.case_sensitive !== undefined ? { case_sensitive: input.case_sensitive } : {}),
  ...(input.whole_word !== undefined ? { whole_word: input.whole_word } : {}),
  ...(input.include_ocr_text_layer !== undefined
    ? { include_ocr_text_layer: input.include_ocr_text_layer }
    : {}),
  ...(input.max_pages !== undefined ? { max_pages: input.max_pages } : {}),
  ...(input.max_matches_per_source !== undefined
    ? { max_matches_per_source: input.max_matches_per_source }
    : {}),
  ...(input.context_chars !== undefined ? { context_chars: input.context_chars } : {}),
  ...(input.prefer_speed !== undefined ? { prefer_speed: input.prefer_speed } : {}),
});

const processSource = async (
  source: {
    path?: string | undefined;
    url?: string | undefined;
    pages?: string | number[] | undefined;
  },
  options: SearchPdfOptions
): Promise<PdfSearchSourceResult> => {
  const sourceDescription = source.path ?? source.url ?? 'unknown source';

  try {
    return await searchPdfSource(source, options);
  } catch (error: unknown) {
    const errorMessage = safeErrorMessage(
      error,
      `Failed to search PDF source ${sourceDescription}.`,
      logger,
      { sourceDescription }
    );
    return {
      source: sourceDescription,
      success: false,
      error: errorMessage,
    };
  }
};

export const searchPdf = tool()
  .description(
    'Searches extracted PDF text with page, snippet, bounding-box, and provenance evidence for agent retrieval.'
  )
  .input(searchPdfArgsSchema)
  .handler(async ({ input }) => {
    const options = buildOptions(input);
    const results: PdfSearchSourceResult[] = [];

    for (const source of input.sources) {
      results.push(await processSource(source, options));
    }

    if (results.every((result) => !result.success)) {
      const errorMessages = results.map((result) => result.error).join('; ');
      return toolError(`All PDF sources failed search: ${errorMessages}`);
    }

    return wrapPdfEvidenceResponse({
      tool: 'search_pdf',
      sources: input.sources,
      route: 'pdf-text-index-v3',
      response: text(
        JSON.stringify(
          {
            profile: 'pdf_search_results',
            search_options: options,
            results,
          },
          null,
          2
        )
      ),
    });
  });
