// PDF text layer type definitions

import type { BoundingBox } from './geometry.js';

export interface PdfTextLayerWord {
  index: number;
  text: string;
  char_start: number;
  char_end: number;
  bounding_box?: BoundingBox | undefined;
  confidence?: number | undefined;
}

export interface PdfTextLayerLine {
  id: string;
  index: number;
  text: string;
  char_start: number;
  char_end: number;
  bounding_box?: BoundingBox | undefined;
  words: PdfTextLayerWord[];
  provenance: {
    engine: 'pdfjs';
    source: 'text-content';
    bounding_box_level: 'line' | 'word_estimated';
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
  line_count: number;
  word_count: number;
  char_count: number;
  lines_with_bounding_boxes: number;
  words_with_bounding_boxes: number;
}

export interface PdfTextLayer {
  version: '2026-06-15';
  profile: 'pdf_text_layer';
  pages: PdfTextLayerPage[];
  summary: PdfTextLayerSummary;
  warnings?: string[] | undefined;
}
