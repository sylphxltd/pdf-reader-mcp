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
} from '@sylphx/vex';
import { pdfSourceSchema } from './readPdf.js';

export const inspectPdfArgsSchema = object({
  sources: array(pdfSourceSchema),
  sample_pages: optional(
    num(
      int,
      gte(1),
      lte(20),
      description(
        'Maximum number of pages to sample per source for lightweight PDF profiling. Defaults to 5.'
      )
    )
  ),
  include_metadata: optional(
    bool(description('Include PDF metadata and info objects in the inspection response.'))
  ),
});

export type InspectPdfArgs = InferOutput<typeof inspectPdfArgsSchema>;
