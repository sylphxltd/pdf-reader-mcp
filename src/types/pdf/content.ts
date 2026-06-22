// PDF content element type definitions (text, images, elements, chunks)

import type { BoundingBox } from './geometry.js';
import type { ExtractedTable } from './tables.js';

export interface ExtractedPageText {
  page: number;
  text: string;
}

export interface ExtractedImage {
  page: number;
  index: number;
  width: number;
  height: number;
  format: string;
  data: string; // base64 encoded image data
  bounding_box?: BoundingBox | undefined;
}

export interface PdfElementProvenance {
  engine: 'pdfjs' | 'external-command';
  source: 'text-content' | 'image-xobject' | 'table-detector' | 'ocr-table-detector';
  ocr_source_render_evidence_id?: string | undefined;
}

export type PdfTextSemanticRole =
  | 'heading'
  | 'list_item'
  | 'paragraph'
  | 'caption'
  | 'header'
  | 'footer';

export interface PdfTextSemanticHint {
  role: PdfTextSemanticRole;
  confidence: number;
  signals: string[];
  level?: number | undefined;
}

export interface BasePdfElement {
  id: string;
  type: 'text' | 'image' | 'table';
  page: number;
  bounding_box?: BoundingBox | undefined;
  confidence?: number | undefined;
  provenance: PdfElementProvenance;
}

export interface PdfTextElement extends BasePdfElement {
  type: 'text';
  content: string;
  semantic_hint?: PdfTextSemanticHint | undefined;
}

export interface PdfImageElement extends BasePdfElement {
  type: 'image';
  image: Omit<ExtractedImage, 'data'>;
}

export interface PdfTableElement extends BasePdfElement {
  type: 'table';
  table: Omit<ExtractedTable, 'page' | 'tableIndex'>;
}

export type PdfDocumentElement = PdfTextElement | PdfImageElement | PdfTableElement;

export interface PdfChunk {
  id: string;
  page_start: number;
  page_end: number;
  text: string;
  element_ids: string[];
  strategy?: 'page' | 'semantic' | 'size' | 'table' | undefined;
  heading?: string | undefined;
  bounding_boxes?: BoundingBox[] | undefined;
}

// Content item with position for ordering
export interface PageTextRunCharEvidence {
  index: number;
  text: string;
  item_char_start: number;
  item_char_end: number;
  is_whitespace: boolean;
  bounding_box?: BoundingBox | undefined;
  confidence?: number | undefined;
}

export interface PageTextRunEvidence {
  index: number;
  text: string;
  item_char_start: number;
  item_char_end: number;
  bounding_box?: BoundingBox | undefined;
  font_name?: string | undefined;
  direction?: string | undefined;
  transform?: number[] | undefined;
  has_eol?: boolean | undefined;
  chars: PageTextRunCharEvidence[];
}

export interface PageContentItem {
  type: 'text' | 'image';
  yPosition: number;
  xPosition?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  bounding_box?: BoundingBox | undefined;
  textContent?: string;
  textRuns?: PageTextRunEvidence[] | undefined;
  imageData?: ExtractedImage;
}
