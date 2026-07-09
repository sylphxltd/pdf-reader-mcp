import {
  array,
  bool,
  description,
  gte,
  type InferOutput,
  int,
  lte,
  min,
  num,
  object,
  optional,
  str,
} from '../schema.js';
import { pdfSourceSchema } from './readPdf.js';

export const searchPdfArgsSchema = object({
  sources: array(pdfSourceSchema),
  query: str(min(1), description('Literal text query to search for in extracted PDF text.')),
  case_sensitive: optional(bool(description('Use case-sensitive literal matching.'))),
  whole_word: optional(bool(description('Match only whole words using ASCII word boundaries.'))),
  include_ocr_text_layer: optional(
    bool(
      description(
        'Also search a configured local OCR text layer for selected pages. Disabled by default because it renders pages and runs the OCR provider.'
      )
    )
  ),
  max_pages: optional(
    num(
      int,
      gte(1),
      lte(1000),
      description('Maximum pages to search per source. Defaults to 100 and is capped at 1000.')
    )
  ),
  max_matches_per_source: optional(
    num(
      int,
      gte(1),
      lte(500),
      description('Maximum matches returned per source. Defaults to 50 and is capped at 500.')
    )
  ),
  context_chars: optional(
    num(
      int,
      gte(0),
      lte(1000),
      description('Context characters to include around each match. Defaults to 120.')
    )
  ),
  prefer_speed: optional(
    bool(
      description(
        'Prefer the Rust literal text-index route for local files. Defaults to false so search_pdf keeps page + bounding-box evidence from pdfjs.'
      )
    )
  ),
});

export type SearchPdfArgs = InferOutput<typeof searchPdfArgsSchema>;
