import { text, tool, toolError } from '@sylphx/mcp-server-sdk';
import { defaultSearchPdfOptions, searchPdfSource } from '../pdf/search.js';
import { searchPdfArgsSchema } from '../schemas/searchPdf.js';
import type { PdfSearchSourceResult, SearchPdfOptions } from '../types/pdf.js';
import { PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('SearchPdf');

const buildOptions = (input: {
  query: string;
  case_sensitive?: boolean | undefined;
  whole_word?: boolean | undefined;
  max_pages?: number | undefined;
  max_matches_per_source?: number | undefined;
  context_chars?: number | undefined;
}): SearchPdfOptions => ({
  ...defaultSearchPdfOptions(input.query),
  ...(input.case_sensitive !== undefined ? { case_sensitive: input.case_sensitive } : {}),
  ...(input.whole_word !== undefined ? { whole_word: input.whole_word } : {}),
  ...(input.max_pages !== undefined ? { max_pages: input.max_pages } : {}),
  ...(input.max_matches_per_source !== undefined
    ? { max_matches_per_source: input.max_matches_per_source }
    : {}),
  ...(input.context_chars !== undefined ? { context_chars: input.context_chars } : {}),
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
    let errorMessage: string;
    if (error instanceof PdfError) {
      errorMessage = error.message;
    } else {
      const detail = error instanceof Error ? error.message : String(error);
      logger.error('Unexpected error searching PDF source', {
        sourceDescription,
        error: detail,
      });
      errorMessage = `Failed to search PDF source ${sourceDescription}.`;
    }

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

    return text(
      JSON.stringify(
        {
          profile: 'pdf_search_results',
          search_options: options,
          results,
        },
        null,
        2
      )
    );
  });
