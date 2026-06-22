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
  source_render_scale?: number | undefined;
  source_render_width?: number | undefined;
  source_render_height?: number | undefined;
  provenance: {
    engine: 'external-command';
    source: 'ocr-provider';
  };
  warnings?: string[] | undefined;
}

export interface PdfOcrTextLayerSummary {
  page_count: number;
  text_chars: number;
  word_count: number;
  words_with_bounding_boxes: number;
  source_render_count: number;
  average_confidence?: number | undefined;
}

export interface PdfOcrTextLayer {
  profile: 'ocr_text_layer';
  pages: PdfOcrPageData[];
  summary: PdfOcrTextLayerSummary;
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
