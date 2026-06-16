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
  engine: 'pdfjs';
  source: 'text-content' | 'image-xobject' | 'table-detector';
}

export type PdfTextSemanticRole = 'heading' | 'list_item' | 'paragraph';

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
export interface PageContentItem {
  type: 'text' | 'image';
  yPosition: number;
  xPosition?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  bounding_box?: BoundingBox | undefined;
  textContent?: string;
  imageData?: ExtractedImage;
}
