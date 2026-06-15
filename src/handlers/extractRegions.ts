import { image, text, tool, toolError } from '@sylphx/mcp-server-sdk';
import { defaultExtractRegionsOptions, extractRegionCropsFromSource } from '../pdf/regions.js';
import { extractRegionsArgsSchema, type PdfRegionSource } from '../schemas/extractRegions.js';
import type {
  ExtractRegionsOptions,
  PdfRegionCropData,
  PdfRegionCropSourceResult,
  PdfRegionCropSummary,
} from '../types/pdf.js';
import { PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ExtractRegions');

interface RegionSourceOutput {
  result: PdfRegionCropSourceResult;
  regions: PdfRegionCropData[];
}

const buildOptions = (input: {
  scale?: number | undefined;
  max_regions?: number | undefined;
  max_pixels_per_page?: number | undefined;
  include_image?: boolean | undefined;
}): ExtractRegionsOptions => ({
  ...defaultExtractRegionsOptions(),
  ...(input.scale !== undefined ? { scale: input.scale } : {}),
  ...(input.max_regions !== undefined ? { max_regions: input.max_regions } : {}),
  ...(input.max_pixels_per_page !== undefined
    ? { max_pixels_per_page: input.max_pixels_per_page }
    : {}),
  ...(input.include_image !== undefined ? { include_image: input.include_image } : {}),
});

const summarizeRegion = (
  region: PdfRegionCropData,
  imageContentIndex: number | undefined
): PdfRegionCropSummary => {
  const { data: _data, ...summary } = region;
  return {
    ...summary,
    ...(imageContentIndex !== undefined ? { image_content_index: imageContentIndex } : {}),
  };
};

const processSource = async (
  source: PdfRegionSource,
  options: ExtractRegionsOptions
): Promise<RegionSourceOutput> => {
  const sourceDescription = source.path ?? source.url ?? 'unknown source';

  try {
    const cropped = await extractRegionCropsFromSource(source, options);
    return {
      result: {
        source: cropped.source,
        success: true,
        num_pages: cropped.numPages,
        regions: [],
        ...(cropped.warnings.length > 0 ? { warnings: cropped.warnings } : {}),
      },
      regions: cropped.regions,
    };
  } catch (error: unknown) {
    let errorMessage: string;
    if (error instanceof PdfError) {
      errorMessage = error.message;
    } else {
      const detail = error instanceof Error ? error.message : String(error);
      logger.error('Unexpected error extracting PDF regions', {
        sourceDescription,
        error: detail,
      });
      errorMessage = `Failed to extract regions from ${sourceDescription}.`;
    }

    return {
      result: {
        source: sourceDescription,
        success: false,
        error: errorMessage,
      },
      regions: [],
    };
  }
};

const attachRegionSummaries = (
  outputs: RegionSourceOutput[],
  includeImage: boolean
): PdfRegionCropSourceResult[] => {
  let nextImageContentIndex = 1;

  return outputs.map(({ result, regions }) => {
    if (!result.success) return result;

    return {
      ...result,
      regions: regions.map((region) => {
        const imageContentIndex = includeImage ? nextImageContentIndex++ : undefined;
        return summarizeRegion(region, imageContentIndex);
      }),
    };
  });
};

const buildContent = (
  outputs: RegionSourceOutput[],
  results: PdfRegionCropSourceResult[],
  options: ExtractRegionsOptions
): Array<ReturnType<typeof text> | ReturnType<typeof image>> => {
  const content: Array<ReturnType<typeof text> | ReturnType<typeof image>> = [
    text(
      JSON.stringify(
        {
          profile: 'region_crop_evidence',
          crop_options: options,
          results,
        },
        null,
        2
      )
    ),
  ];

  if (!options.include_image) return content;

  for (const output of outputs) {
    if (!output.result.success) continue;
    for (const region of output.regions) {
      content.push(image(region.data, region.mime_type));
    }
  }

  return content;
};

export const extractRegions = tool()
  .description(
    'Extracts bounded visual crops from selected PDF page regions using PDF-coordinate bounding boxes.'
  )
  .input(extractRegionsArgsSchema)
  .handler(async ({ input }) => {
    const options = buildOptions(input);
    const outputs: RegionSourceOutput[] = [];

    for (const source of input.sources) {
      outputs.push(await processSource(source, options));
    }

    const results = attachRegionSummaries(outputs, options.include_image);
    if (results.every((result) => !result.success)) {
      const errorMessages = results.map((result) => result.error).join('; ');
      return toolError(`All PDF sources failed region extraction: ${errorMessages}`);
    }

    return buildContent(outputs, results, options);
  });
