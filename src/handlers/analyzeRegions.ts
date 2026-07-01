import { text, tool, toolError } from '../mcp.js';
import {
  analyzePdfRegionsFromSource,
  defaultAnalyzeRegionsOptions,
} from '../pdf/regionAnalysis.js';
import { analyzeRegionsArgsSchema } from '../schemas/analyzeRegions.js';
import type { AnalyzeRegionsOptions, PdfRegionAnalysisSourceResult } from '../types/pdf.js';
import { safeErrorMessage } from '../utils/errorHandling.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('AnalyzeRegions');

const buildOptions = (input: {
  scale?: number | undefined;
  max_regions?: number | undefined;
  max_pixels_per_page?: number | undefined;
  timeout_ms?: number | undefined;
  max_output_chars?: number | undefined;
  languages?: string[] | undefined;
}): AnalyzeRegionsOptions => ({
  ...defaultAnalyzeRegionsOptions(),
  ...(input.scale !== undefined ? { scale: input.scale } : {}),
  ...(input.max_regions !== undefined ? { max_regions: input.max_regions } : {}),
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
    regions: Array<{
      id?: string | undefined;
      page: number;
      bounding_box: { left: number; bottom: number; right: number; top: number };
      padding?: number | undefined;
    }>;
  },
  options: AnalyzeRegionsOptions
): Promise<PdfRegionAnalysisSourceResult> => {
  const sourceDescription = source.path ?? source.url ?? 'unknown source';

  try {
    const analyzed = await analyzePdfRegionsFromSource(source, options);
    return {
      source: analyzed.source,
      success: true,
      num_pages: analyzed.numPages,
      region_analyses: analyzed.analyses,
      ...(analyzed.warnings.length > 0 ? { warnings: analyzed.warnings } : {}),
    };
  } catch (error: unknown) {
    const errorMessage = safeErrorMessage(
      error,
      `Failed to analyze regions from ${sourceDescription}.`,
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

const buildRegionAnalysisResponse = (
  options: AnalyzeRegionsOptions,
  results: PdfRegionAnalysisSourceResult[]
): ReturnType<typeof text> =>
  text(
    JSON.stringify(
      {
        profile: 'region_analysis',
        analysis_options: options,
        results,
      },
      null,
      2
    )
  );

export const analyzeRegions = tool()
  .description(
    'Analyzes selected PDF visual regions with a configured local provider for tables, charts, formulas, figures, or image descriptions.'
  )
  .input(analyzeRegionsArgsSchema)
  .handler(async ({ input }) => {
    const options = buildOptions(input);
    const results: PdfRegionAnalysisSourceResult[] = [];

    for (const source of input.sources) {
      results.push(await processSource(source, options));
    }

    if (results.every((result) => !result.success)) {
      const errorMessages = results.map((result) => result.error).join('; ');
      return toolError(`All PDF sources failed region analysis: ${errorMessages}`);
    }

    return buildRegionAnalysisResponse(options, results);
  });
