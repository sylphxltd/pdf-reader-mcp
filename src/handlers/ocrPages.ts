import { text, tool, toolError } from '../mcp.js';
import { defaultOcrPagesOptions, ocrPdfSourcePages } from '../pdf/ocr.js';
import { ocrPagesArgsSchema } from '../schemas/ocrPages.js';
import type { OcrPagesOptions, PdfOcrSourceResult } from '../types/pdf.js';
import { PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('OcrPages');

const buildOptions = (input: {
  scale?: number | undefined;
  max_pages?: number | undefined;
  max_pixels_per_page?: number | undefined;
  timeout_ms?: number | undefined;
  max_output_chars?: number | undefined;
  languages?: string[] | undefined;
}): OcrPagesOptions => ({
  ...defaultOcrPagesOptions(),
  ...(input.scale !== undefined ? { scale: input.scale } : {}),
  ...(input.max_pages !== undefined ? { max_pages: input.max_pages } : {}),
  ...(input.max_pixels_per_page !== undefined
    ? { max_pixels_per_page: input.max_pixels_per_page }
    : {}),
  ...(input.timeout_ms !== undefined ? { timeout_ms: input.timeout_ms } : {}),
  ...(input.max_output_chars !== undefined ? { max_output_chars: input.max_output_chars } : {}),
  ...(input.languages !== undefined ? { languages: input.languages } : {}),
});

const processSource = async (
  source: {
    path?: string | undefined;
    url?: string | undefined;
    pages?: string | number[] | undefined;
  },
  options: OcrPagesOptions
): Promise<PdfOcrSourceResult> => {
  const sourceDescription = source.path ?? source.url ?? 'unknown source';

  try {
    const ocr = await ocrPdfSourcePages(source, options);
    return {
      source: ocr.source,
      success: true,
      num_pages: ocr.numPages,
      ocr_pages: ocr.pages,
      ...(ocr.warnings.length > 0 ? { warnings: ocr.warnings } : {}),
    };
  } catch (error: unknown) {
    let errorMessage: string;
    if (error instanceof PdfError) {
      errorMessage = error.message;
    } else {
      const detail = error instanceof Error ? error.message : String(error);
      logger.error('Unexpected error running OCR pages', {
        sourceDescription,
        error: detail,
      });
      errorMessage = `Failed to OCR pages from ${sourceDescription}.`;
    }

    return {
      source: sourceDescription,
      success: false,
      error: errorMessage,
    };
  }
};

const buildOcrResponse = (
  options: OcrPagesOptions,
  results: PdfOcrSourceResult[]
): ReturnType<typeof text> =>
  text(
    JSON.stringify(
      {
        profile: 'ocr_text_layer',
        ocr_options: options,
        results,
      },
      null,
      2
    )
  );

export const ocrPages = tool()
  .description(
    'Runs selected rendered PDF pages through a configured local OCR provider and returns normalized text with provenance.'
  )
  .input(ocrPagesArgsSchema)
  .handler(async ({ input }) => {
    const options = buildOptions(input);
    const results: PdfOcrSourceResult[] = [];

    for (const source of input.sources) {
      results.push(await processSource(source, options));
    }

    if (results.every((result) => !result.success)) {
      const errorMessages = results.map((result) => result.error).join('; ');
      return toolError(`All PDF sources failed OCR: ${errorMessages}`);
    }

    return buildOcrResponse(options, results);
  });
