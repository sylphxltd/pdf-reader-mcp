// PDF semantic document AST type definitions

import type { PdfTextSemanticRole } from './content.js';
import type { BoundingBox } from './geometry.js';
import type {
  PdfRegionAnalysisChart,
  PdfRegionAnalysisFormula,
  PdfRegionAnalysisKind,
  PdfVisualEnrichment,
} from './region-analysis.js';
import type {
  TableContinuationCandidate,
  TableExtractionProvenance,
  TableQuality,
} from './tables.js';

export type PdfDocumentAstVersion = '2026-06-15';

export type PdfDocumentAstNodeType =
  | 'document'
  | 'page'
  | 'section'
  | 'paragraph'
  | 'list_item'
  | 'caption'
  | 'header'
  | 'footer'
  | 'table'
  | 'image'
  | 'figure'
  | 'chart'
  | 'formula'
  | 'diagram'
  | 'visual_region';

export interface PdfDocumentAstTable {
  rows: string[][];
  rowCount: number;
  colCount: number;
  confidence: number;
  quality?: TableQuality | undefined;
  continuation?: TableContinuationCandidate | undefined;
  provenance?: TableExtractionProvenance | undefined;
}

export interface PdfDocumentAstImage {
  index: number;
  width: number;
  height: number;
  format: string;
}

export interface PdfDocumentAstSectionRef {
  id: string;
  title: string;
  level: number;
  page_start: number;
}

export type PdfDocumentAstCaptionRelation = 'above' | 'below' | 'left' | 'right' | 'overlapping';

export interface PdfDocumentAstCaptionLink {
  node_id: string;
  element_id: string;
  type: PdfDocumentAstNodeType;
  relation: PdfDocumentAstCaptionRelation;
  confidence: number;
  signals: string[];
  visual_enrichment_id?: string | undefined;
}

export interface PdfDocumentAstNode {
  id: string;
  type: PdfDocumentAstNodeType;
  page_start: number;
  page_end: number;
  element_ids: string[];
  visual_enrichment_ids?: string[] | undefined;
  chunk_ids?: string[] | undefined;
  bounding_boxes?: BoundingBox[] | undefined;
  title?: string | undefined;
  text?: string | undefined;
  level?: number | undefined;
  confidence?: number | undefined;
  semantic_role?: PdfTextSemanticRole | undefined;
  section_path?: PdfDocumentAstSectionRef[] | undefined;
  continued_from_section_id?: string | undefined;
  caption_links?: PdfDocumentAstCaptionLink[] | undefined;
  caption_ids?: string[] | undefined;
  table?: PdfDocumentAstTable | undefined;
  image?: PdfDocumentAstImage | undefined;
  formula?: PdfRegionAnalysisFormula | undefined;
  chart?: PdfRegionAnalysisChart | undefined;
  visual_enrichment?: PdfVisualEnrichment | undefined;
  children?: PdfDocumentAstNode[] | undefined;
}

export interface PdfDocumentAstSummary {
  selected_pages: number[];
  page_count: number;
  node_count: number;
  section_count: number;
  paragraph_count: number;
  list_item_count: number;
  caption_count: number;
  header_count: number;
  footer_count: number;
  section_context_node_count: number;
  cross_page_section_context_count: number;
  caption_link_count: number;
  table_count: number;
  image_count: number;
  figure_count: number;
  chart_count: number;
  formula_count: number;
  diagram_count: number;
  visual_enrichment_count: number;
  visual_enrichment_kind_counts: Partial<Record<PdfRegionAnalysisKind, number>>;
  max_depth: number;
}

export interface PdfDocumentAst {
  version: PdfDocumentAstVersion;
  profile: 'document_ast';
  root: PdfDocumentAstNode;
  summary: PdfDocumentAstSummary;
  warnings?: string[] | undefined;
}
