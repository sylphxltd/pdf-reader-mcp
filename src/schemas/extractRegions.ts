import {
  array,
  bool,
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

const regionBoundingBoxSchema = object({
  left: num(gte(0), description('Left PDF coordinate of the region bounding box.')),
  bottom: num(gte(0), description('Bottom PDF coordinate of the region bounding box.')),
  right: num(gte(0), description('Right PDF coordinate of the region bounding box.')),
  top: num(gte(0), description('Top PDF coordinate of the region bounding box.')),
});

export const pdfRegionSchema = object({
  id: optional(str(description('Optional caller-provided region ID for stable evidence mapping.'))),
  page: num(int, gte(1), description('1-indexed PDF page containing the region.')),
  bounding_box: regionBoundingBoxSchema,
  padding: optional(
    num(
      gte(0),
      lte(200),
      description('Padding around the region in PDF points before scaling. Defaults to 0.')
    )
  ),
});

export const pdfRegionSourceSchema = object({
  path: optional(str(description('Path to the local PDF file (absolute or relative to cwd).'))),
  url: optional(str(description('URL of the PDF file.'))),
  regions: array(pdfRegionSchema),
});

export const extractRegionsArgsSchema = object({
  sources: array(pdfRegionSourceSchema),
  scale: optional(
    num(gte(0.25), lte(4), description('Render scale relative to PDF points. Defaults to 2.'))
  ),
  max_regions: optional(
    num(
      int,
      gte(1),
      lte(100),
      description('Maximum regions to crop per source. Defaults to 20 and is capped at 100.')
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
  include_image: optional(
    bool(
      description(
        'Return cropped regions as MCP image parts. Defaults to true; JSON metadata is always returned.'
      )
    )
  ),
});

export type ExtractRegionsArgs = InferOutput<typeof extractRegionsArgsSchema>;
export type PdfRegionSource = InferOutput<typeof pdfRegionSourceSchema>;
