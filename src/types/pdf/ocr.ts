// PDF OCR type definitions

import type { BoundingBox } from './geometry.js';

export type PdfOcrProvider = 'command';

export interface PdfOcrWord {
  text: string;
  confidence?: number | undefined;
  bounding_box?: BoundingBox | undefined;
}

export interface PdfOcrPageData {
  page: number;
  text: string;
  confidence?: number | undefined;
  words?: PdfOcrWord[] | undefined;
  language?: string | undefined;
  provider: PdfOcrProvider;
  source_render_evidence_id: string;
  provenance: {
    engine: 'external-command';
    source: 'ocr-provider';
  };
  warnings?: string[] | undefined;
}

export interface PdfOcrSourceResult {
  source: string;
  success: boolean;
  num_pages?: number | undefined;
  ocr_pages?: PdfOcrPageData[] | undefined;
  warnings?: string[] | undefined;
  error?: string | undefined;
}

export interface OcrPagesOptions {
  scale: number;
  max_pages: number;
  max_pixels_per_page: number;
  timeout_ms: number;
  max_output_chars: number;
  languages?: string[] | undefined;
}
