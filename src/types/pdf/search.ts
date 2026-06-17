// PDF search type definitions

import type { BoundingBox } from './geometry.js';

export interface PdfSearchMatch {
  id: string;
  page: number;
  text: string;
  snippet: string;
  match_start: number;
  match_end: number;
  text_item_index?: number | undefined;
  ocr_word_index?: number | undefined;
  source_render_evidence_id?: string | undefined;
  bounding_box?: BoundingBox | undefined;
  bounding_box_level?: 'char_estimated' | 'text_item' | 'ocr_word' | undefined;
  provenance: {
    engine: 'pdfjs' | 'external-command';
    source: 'text-content' | 'ocr-provider';
  };
}

export interface PdfSearchSourceResult {
  source: string;
  success: boolean;
  num_pages?: number | undefined;
  searched_pages?: number[] | undefined;
  total_matches?: number | undefined;
  matches?: PdfSearchMatch[] | undefined;
  truncated?: boolean | undefined;
  warnings?: string[] | undefined;
  error?: string | undefined;
}

export interface SearchPdfOptions {
  query: string;
  case_sensitive: boolean;
  whole_word: boolean;
  max_pages: number;
  max_matches_per_source: number;
  context_chars: number;
  include_ocr_text_layer: boolean;
}
