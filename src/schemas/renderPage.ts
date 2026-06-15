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
} from '../schema.js';
import { pdfSourceSchema } from './readPdf.js';

export const renderPageArgsSchema = object({
  sources: array(pdfSourceSchema),
  scale: optional(
    num(
      gte(0.25),
      lte(4),
      description(
        'Render scale relative to PDF points. Defaults to 2 for readable local evidence images.'
      )
    )
  ),
  max_pages: optional(
    num(
      int,
      gte(1),
      lte(20),
      description('Maximum pages to render per source. Defaults to 5 and is capped at 20.')
    )
  ),
  max_pixels_per_page: optional(
    num(
      int,
      gte(10_000),
      lte(64_000_000),
      description('Maximum rendered pixels per page. Defaults to 16,000,000 to bound memory use.')
    )
  ),
  include_image: optional(
    bool(
      description(
        'Return rendered PNG pages as MCP image parts. Defaults to true; JSON metadata is always returned.'
      )
    )
  ),
});

export type RenderPageArgs = InferOutput<typeof renderPageArgsSchema>;
