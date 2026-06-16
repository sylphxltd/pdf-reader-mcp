// PDF search type definitions

import type { BoundingBox } from './geometry.js';

export interface PdfSearchMatch {
  id: string;
  page: number;
  text: string;
  snippet: string;
  match_start: number;
  match_end: number;
  text_item_index: number;
  bounding_box?: BoundingBox | undefined;
  bounding_box_level?: 'text_item' | undefined;
  provenance: {
    engine: 'pdfjs';
    source: 'text-content';
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
}
