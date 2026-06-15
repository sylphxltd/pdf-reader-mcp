import {
  array,
  description,
  gte,
  type InferOutput,
  int,
  lte,
  num,
  object,
  optional,
  str,
} from '@sylphx/vex';
import { pdfRegionSourceSchema } from './extractRegions.js';

export const analyzeRegionsArgsSchema = object({
  sources: array(pdfRegionSourceSchema),
  scale: optional(
    num(
      gte(0.25),
      lte(4),
      description('Render scale used before cropping and region analysis. Defaults to 2.')
    )
  ),
  max_regions: optional(
    num(
      int,
      gte(1),
      lte(100),
      description('Maximum regions to analyze per source. Defaults to 20 and is capped at 100.')
    )
  ),
  max_pixels_per_page: optional(
    num(
      int,
      gte(10_000),
      lte(64_000_000),
      description('Maximum rendered pixels per page before cropping. Defaults to 16,000,000.')
    )
  ),
  timeout_ms: optional(
    num(
      int,
      gte(1_000),
      lte(300_000),
      description('Timeout per analyzed region in milliseconds. Defaults to 60,000.')
    )
  ),
  max_output_chars: optional(
    num(
      int,
      gte(1_000),
      lte(1_000_000),
      description(
        'Maximum provider output characters returned per analyzed region. Defaults to 200,000.'
      )
    )
  ),
  languages: optional(
    array(
      str(description('Optional language tags passed to the configured region analysis provider.'))
    )
  ),
});

export type AnalyzeRegionsArgs = InferOutput<typeof analyzeRegionsArgsSchema>;
