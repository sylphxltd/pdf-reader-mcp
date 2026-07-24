import {
  array,
  bool,
  description,
  gte,
  type InferOutput,
  int,
  literal,
  lte,
  min,
  num,
  object,
  optional,
  str,
  union,
} from '../schema.js';
import { pdfRegionSchema } from './extractRegions.js';
import { pageSpecifierSchema } from './readPdf.js';

export const pdfEvidenceOperationSchema = union(
  literal('inspect'),
  literal('render_page'),
  literal('extract_regions'),
  literal('ocr_pages'),
  literal('analyze_regions')
);

export const pdfEvidenceSourceSchema = object({
  path: optional(
    str(
      min(1),
      description('Path to the local PDF file. Provide exactly one of path or url (not both).')
    )
  ),
  url: optional(
    str(min(1), description('URL of the PDF file. Provide exactly one of path or url (not both).'))
  ),
  pages: optional(pageSpecifierSchema),
  regions: optional(
    array(
      pdfRegionSchema,
      description('PDF-coordinate regions for extract_regions and analyze_regions operations.')
    )
  ),
}).refine((source) => Boolean(source.path) !== Boolean(source.url), {
  message: 'Provide exactly one of path or url for each PDF evidence source.',
});

export const pdfEvidenceArgsSchema = object({
  operation: pdfEvidenceOperationSchema.describe(
    'Evidence operation to run: inspect, render_page, extract_regions, ocr_pages, or analyze_regions.'
  ),
  sources: array(pdfEvidenceSourceSchema),
  sample_pages: optional(
    num(int, gte(1), lte(20), description('Maximum pages to sample for inspect. Defaults to 5.'))
  ),
  include_metadata: optional(bool(description('Include PDF metadata in inspect responses.'))),
  scale: optional(
    num(
      gte(0.25),
      lte(4),
      description('Render scale for render, crop, OCR, and region analysis operations.')
    )
  ),
  max_pages: optional(
    num(int, gte(1), lte(20), description('Maximum pages for render_page or ocr_pages operations.'))
  ),
  max_regions: optional(
    num(
      int,
      gte(1),
      lte(100),
      description('Maximum regions for extract_regions or analyze_regions operations.')
    )
  ),
  max_pixels_per_page: optional(
    num(
      int,
      gte(10_000),
      lte(64_000_000),
      description('Maximum rendered pixels per page before image-producing operations.')
    )
  ),
  include_image: optional(
    bool(
      description(
        'Return rendered or cropped PNGs as MCP image parts for render_page and extract_regions.'
      )
    )
  ),
  timeout_ms: optional(
    num(
      int,
      gte(1_000),
      lte(300_000),
      description('Timeout per OCR page or analyzed region in milliseconds.')
    )
  ),
  max_output_chars: optional(
    num(
      int,
      gte(1_000),
      lte(1_000_000),
      description('Maximum OCR or visual-provider output characters returned per unit.')
    )
  ),
  languages: optional(
    array(str(description('Optional language tags passed to configured OCR or visual providers.')))
  ),
});

export type PdfEvidenceArgs = InferOutput<typeof pdfEvidenceArgsSchema>;
export type PdfEvidenceOperation = InferOutput<typeof pdfEvidenceOperationSchema>;
