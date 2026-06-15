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
import { pdfSourceSchema } from './readPdf.js';

export const ocrPagesArgsSchema = object({
  sources: array(pdfSourceSchema),
  scale: optional(
    num(gte(0.25), lte(4), description('Render scale used before OCR. Defaults to 2.'))
  ),
  max_pages: optional(
    num(
      int,
      gte(1),
      lte(20),
      description('Maximum pages to OCR per source. Defaults to 5 and is capped at 20.')
    )
  ),
  max_pixels_per_page: optional(
    num(
      int,
      gte(10_000),
      lte(64_000_000),
      description('Maximum rendered pixels per page before OCR. Defaults to 16,000,000.')
    )
  ),
  timeout_ms: optional(
    num(
      int,
      gte(1_000),
      lte(300_000),
      description('Timeout per OCR page in milliseconds. Defaults to 60,000.')
    )
  ),
  max_output_chars: optional(
    num(
      int,
      gte(1_000),
      lte(1_000_000),
      description('Maximum OCR text characters returned per page. Defaults to 200,000.')
    )
  ),
  languages: optional(
    array(str(description('Optional OCR language tags passed to the configured provider.')))
  ),
});

export type OcrPagesArgs = InferOutput<typeof ocrPagesArgsSchema>;
