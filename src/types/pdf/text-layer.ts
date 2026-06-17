// PDF text layer type definitions

import type { BoundingBox } from './geometry.js';

export interface PdfTextLayerWord {
  index: number;
  text: string;
  char_start: number;
  char_end: number;
  bounding_box?: BoundingBox | undefined;
  bounding_box_level?: 'char_estimated' | 'word_estimated' | undefined;
  confidence?: number | undefined;
}

export interface PdfTextLayerChar {
  index: number;
  text: string;
  char_start: number;
  char_end: number;
  run_index: number;
  is_whitespace: boolean;
  bounding_box?: BoundingBox | undefined;
  bounding_box_level?: 'char_estimated' | undefined;
  confidence?: number | undefined;
}

export interface PdfTextLayerRun {
  index: number;
  text: string;
  char_start: number;
  char_end: number;
  bounding_box?: BoundingBox | undefined;
  font_name?: string | undefined;
  direction?: string | undefined;
  transform?: number[] | undefined;
  has_eol?: boolean | undefined;
  chars: PdfTextLayerChar[];
  provenance: {
    engine: 'pdfjs';
    source: 'text-content';
    bounding_box_level: 'text_run' | 'char_estimated';
  };
}

export interface PdfTextLayerLine {
  id: string;
  index: number;
  text: string;
  char_start: number;
  char_end: number;
  bounding_box?: BoundingBox | undefined;
  runs: PdfTextLayerRun[];
  words: PdfTextLayerWord[];
  chars: PdfTextLayerChar[];
  provenance: {
    engine: 'pdfjs';
    source: 'text-content';
    bounding_box_level: 'line' | 'word_estimated' | 'char_estimated';
  };
}

export interface PdfTextLayerPage {
  page: number;
  text: string;
  char_count: number;
  line_count: number;
  word_count: number;
  lines: PdfTextLayerLine[];
}

export interface PdfTextLayerSummary {
  selected_pages: number[];
  page_count: number;
  run_count: number;
  line_count: number;
  word_count: number;
  char_count: number;
  chars_with_bounding_boxes: number;
  runs_with_bounding_boxes: number;
  lines_with_bounding_boxes: number;
  words_with_bounding_boxes: number;
  runs_with_font_metadata: number;
  runs_with_direction_metadata: number;
  runs_with_transform_metadata: number;
  runs_with_eol_metadata: number;
}

export interface PdfTextLayer {
  version: '2026-06-15';
  profile: 'pdf_text_layer';
  pages: PdfTextLayerPage[];
  summary: PdfTextLayerSummary;
  warnings?: string[] | undefined;
}
