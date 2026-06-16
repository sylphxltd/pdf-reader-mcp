// PDF semantic document AST type definitions

import type { PdfTextSemanticRole } from './content.js';
import type { BoundingBox } from './geometry.js';
import type { TableContinuationCandidate, TableQuality } from './tables.js';

export type PdfDocumentAstVersion = '2026-06-15';

export type PdfDocumentAstNodeType =
  | 'document'
  | 'page'
  | 'section'
  | 'paragraph'
  | 'list_item'
  | 'table'
  | 'image';

export interface PdfDocumentAstTable {
  rows: string[][];
  rowCount: number;
  colCount: number;
  confidence: number;
  quality?: TableQuality | undefined;
  continuation?: TableContinuationCandidate | undefined;
}

export interface PdfDocumentAstImage {
  index: number;
  width: number;
  height: number;
  format: string;
}

export interface PdfDocumentAstNode {
  id: string;
  type: PdfDocumentAstNodeType;
  page_start: number;
  page_end: number;
  element_ids: string[];
  chunk_ids?: string[] | undefined;
  bounding_boxes?: BoundingBox[] | undefined;
  title?: string | undefined;
  text?: string | undefined;
  level?: number | undefined;
  confidence?: number | undefined;
  semantic_role?: PdfTextSemanticRole | undefined;
  table?: PdfDocumentAstTable | undefined;
  image?: PdfDocumentAstImage | undefined;
  children?: PdfDocumentAstNode[] | undefined;
}

export interface PdfDocumentAstSummary {
  selected_pages: number[];
  page_count: number;
  node_count: number;
  section_count: number;
  paragraph_count: number;
  list_item_count: number;
  table_count: number;
  image_count: number;
  max_depth: number;
}

export interface PdfDocumentAst {
  version: PdfDocumentAstVersion;
  profile: 'document_ast';
  root: PdfDocumentAstNode;
  summary: PdfDocumentAstSummary;
  warnings?: string[] | undefined;
}
