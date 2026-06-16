// PDF agent document map type definitions

import type { PdfChunk, PdfDocumentElement } from './content.js';
import type { PdfPageGeometry } from './geometry.js';
import type { PdfPageLayoutDiagnostics } from './layout.js';
import type { PdfSafetyFinding } from './safety.js';

export type PdfDocumentMapVersion = '2026-06-15';

export type PdfDocumentMapLayer =
  | 'selectable_text'
  | 'image_metadata'
  | 'table_structure'
  | 'semantic_hints'
  | 'citation_chunks'
  | 'layout_diagnostics'
  | 'content_safety'
  | 'page_geometry';

export interface PdfDocumentMapPage {
  page: number;
  geometry?: PdfPageGeometry | undefined;
  layout?: PdfPageLayoutDiagnostics | undefined;
  element_ids: string[];
  chunk_ids: string[];
  safety_finding_indexes: number[];
  text_chars: number;
  text_item_count: number;
  image_count: number;
  table_count: number;
  warnings?: string[] | undefined;
}

export interface PdfDocumentMapRouting {
  low_confidence_pages: number[];
  image_or_sparse_pages: number[];
  needs_ocr_pages: number[];
}

export interface PdfDocumentMapSummary {
  total_pages?: number | undefined;
  selected_pages: number[];
  processed_page_count: number;
  element_count: number;
  text_element_count: number;
  image_element_count: number;
  table_element_count: number;
  chunk_count: number;
  safety_finding_count: number;
  average_layout_confidence?: number | undefined;
  lowest_layout_confidence?: number | undefined;
}

export interface PdfDocumentMap {
  version: PdfDocumentMapVersion;
  profile: 'agent_document_map';
  layers: PdfDocumentMapLayer[];
  pages: PdfDocumentMapPage[];
  elements: PdfDocumentElement[];
  chunks: PdfChunk[];
  layout_diagnostics: PdfPageLayoutDiagnostics[];
  safety_findings: PdfSafetyFinding[];
  routing: PdfDocumentMapRouting;
  summary: PdfDocumentMapSummary;
  warnings?: string[] | undefined;
}
