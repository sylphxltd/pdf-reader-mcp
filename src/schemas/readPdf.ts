// Vex validation schemas for PDF reading

import {
  array,
  bool,
  description,
  gte,
  type InferOutput,
  int,
  min,
  num,
  object,
  optional,
  str,
  union,
} from '@sylphx/vex';

// Schema for page specification (array of numbers or range string)
export const pageSpecifierSchema = union(array(num(int, gte(1))), str(min(1)));

// Schema for a single PDF source (path or URL)
// Note: XOR validation (path OR url, not both) is done in the handler
export const pdfSourceSchema = object({
  path: optional(
    str(min(1), description('Path to the local PDF file (absolute or relative to cwd).'))
  ),
  url: optional(str(min(1), description('URL of the PDF file.'))),
  pages: optional(pageSpecifierSchema),
});

// Schema for the read_pdf tool arguments
export const readPdfArgsSchema = object({
  sources: array(pdfSourceSchema),
  include_full_text: optional(
    bool(
      description(
        "Include the full text content of each PDF (only if 'pages' is not specified for that source)."
      )
    )
  ),
  include_metadata: optional(bool(description('Include metadata and info objects for each PDF.'))),
  include_page_count: optional(
    bool(description('Include the total number of pages for each PDF.'))
  ),
  include_images: optional(
    bool(
      description('Extract and include embedded images from the PDF pages as base64-encoded data.')
    )
  ),
  include_tables: optional(
    bool(
      description(
        'Detect and extract tables from PDF pages. Uses spatial clustering of text coordinates to identify tabular structures.'
      )
    )
  ),
});

export type ReadPdfArgs = InferOutput<typeof readPdfArgsSchema>;
export type PdfSource = InferOutput<typeof pdfSourceSchema>;
