// PDF agent document map type definitions

import type { PdfAccessibilityGrade } from './accessibility.js';
import type { PdfChunk, PdfDocumentElement } from './content.js';
import type { PdfPageGeometry } from './geometry.js';
import type { PdfPageLayoutDiagnostics } from './layout.js';
import type {
  PdfRegionAnalysisKind,
  PdfVisualEnrichment,
  PdfVisualEnrichmentCandidate,
  PdfVisualEnrichmentTargetType,
} from './region-analysis.js';
import type { PdfSafetyFinding } from './safety.js';
import type { PdfTrustRiskLevel, PdfTrustSignalType } from './trust-report.js';

export type PdfDocumentMapVersion = '2026-06-15';

export type PdfDocumentMapLayer =
  | 'selectable_text'
  | 'text_layer'
  | 'ocr_text_layer'
  | 'image_metadata'
  | 'table_structure'
  | 'visual_region_candidates'
  | 'visual_enrichment'
  | 'semantic_hints'
  | 'citation_chunks'
  | 'layout_diagnostics'
  | 'content_safety'
  | 'trust_report'
  | 'accessibility_report'
  | 'page_geometry';

export interface PdfDocumentMapPage {
  page: number;
  geometry?: PdfPageGeometry | undefined;
  layout?: PdfPageLayoutDiagnostics | undefined;
  element_ids: string[];
  chunk_ids: string[];
  safety_finding_indexes: number[];
  visual_candidate_indexes: number[];
  visual_enrichment_indexes: number[];
  text_layer_page_index?: number | undefined;
  text_layer_run_count?: number | undefined;
  text_layer_line_count?: number | undefined;
  text_layer_word_count?: number | undefined;
  text_layer_char_count?: number | undefined;
  text_layer_runs_with_bounding_boxes?: number | undefined;
  text_layer_lines_with_bounding_boxes?: number | undefined;
  text_layer_words_with_bounding_boxes?: number | undefined;
  text_layer_chars_with_bounding_boxes?: number | undefined;
  text_layer_runs_with_font_metadata?: number | undefined;
  text_layer_runs_with_direction_metadata?: number | undefined;
  text_layer_runs_with_transform_metadata?: number | undefined;
  text_layer_runs_with_eol_metadata?: number | undefined;
  text_chars: number;
  text_item_count: number;
  ocr_text_chars?: number | undefined;
  ocr_word_count?: number | undefined;
  ocr_confidence?: number | undefined;
  ocr_source_render_evidence_id?: string | undefined;
  image_count: number;
  table_count: number;
  visual_candidate_count: number;
  visual_enrichment_count: number;
  accessibility_report_page_index?: number | undefined;
  accessibility_issue_indexes?: number[] | undefined;
  accessibility_high_issue_indexes?: number[] | undefined;
  accessibility_medium_issue_indexes?: number[] | undefined;
  accessibility_low_issue_indexes?: number[] | undefined;
  accessibility_grade?: PdfAccessibilityGrade | undefined;
  accessibility_score?: number | undefined;
  accessibility_issue_count?: number | undefined;
  accessibility_high_issue_count?: number | undefined;
  accessibility_medium_issue_count?: number | undefined;
  accessibility_low_issue_count?: number | undefined;
  trust_report_page_index?: number | undefined;
  trust_signal_indexes?: number[] | undefined;
  trust_high_signal_indexes?: number[] | undefined;
  trust_medium_signal_indexes?: number[] | undefined;
  trust_low_signal_indexes?: number[] | undefined;
  trust_risk?: PdfTrustRiskLevel | undefined;
  trust_score?: number | undefined;
  trust_signal_count?: number | undefined;
  trust_high_signal_count?: number | undefined;
  trust_medium_signal_count?: number | undefined;
  trust_low_signal_count?: number | undefined;
  warnings?: string[] | undefined;
}

export interface PdfDocumentMapRouting {
  low_confidence_pages: number[];
  image_or_sparse_pages: number[];
  needs_ocr_pages: number[];
  ocr_applied_pages: number[];
  visual_candidate_pages: number[];
  accessibility_review_pages: number[];
  accessibility_high_issue_pages: number[];
  accessibility_medium_issue_pages: number[];
  accessibility_low_issue_pages: number[];
  trust_review_pages: number[];
  trust_high_signal_pages: number[];
  trust_high_risk_pages: number[];
  trust_medium_risk_pages: number[];
}

export interface PdfDocumentMapSummary {
  total_pages?: number | undefined;
  selected_pages: number[];
  processed_page_count: number;
  element_count: number;
  text_element_count: number;
  text_layer_page_count: number;
  text_layer_run_count: number;
  text_layer_line_count: number;
  text_layer_word_count: number;
  text_layer_char_count: number;
  text_layer_runs_with_bounding_boxes: number;
  text_layer_lines_with_bounding_boxes: number;
  text_layer_words_with_bounding_boxes: number;
  text_layer_chars_with_bounding_boxes: number;
  text_layer_runs_with_font_metadata: number;
  text_layer_runs_with_direction_metadata: number;
  text_layer_runs_with_transform_metadata: number;
  text_layer_runs_with_eol_metadata: number;
  ocr_page_count: number;
  ocr_text_chars: number;
  image_element_count: number;
  table_element_count: number;
  visual_enrichment_candidate_count: number;
  visual_enrichment_candidate_kind_counts: Partial<Record<PdfVisualEnrichmentTargetType, number>>;
  visual_enrichment_count: number;
  visual_enrichment_kind_counts: Partial<Record<PdfRegionAnalysisKind, number>>;
  chunk_count: number;
  safety_finding_count: number;
  accessibility_report_page_count?: number | undefined;
  accessibility_score?: number | undefined;
  accessibility_grade?: PdfAccessibilityGrade | undefined;
  accessibility_issue_count?: number | undefined;
  accessibility_document_issue_count?: number | undefined;
  accessibility_page_issue_count?: number | undefined;
  accessibility_high_issue_count?: number | undefined;
  accessibility_medium_issue_count?: number | undefined;
  accessibility_low_issue_count?: number | undefined;
  accessibility_pages_with_issues_count?: number | undefined;
  accessibility_pages_with_high_issues_count?: number | undefined;
  accessibility_page_grade_counts?: Record<PdfAccessibilityGrade, number> | undefined;
  trust_report_page_count?: number | undefined;
  trust_risk?: PdfTrustRiskLevel | undefined;
  trust_score?: number | undefined;
  trust_signal_count?: number | undefined;
  trust_high_signal_count?: number | undefined;
  trust_medium_signal_count?: number | undefined;
  trust_low_signal_count?: number | undefined;
  trust_pages_with_signals?: number | undefined;
  trust_high_risk_page_count?: number | undefined;
  trust_medium_risk_page_count?: number | undefined;
  trust_signal_type_counts?: Partial<Record<PdfTrustSignalType, number>> | undefined;
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
  visual_enrichment_candidates: PdfVisualEnrichmentCandidate[];
  visual_enrichments: PdfVisualEnrichment[];
  layout_diagnostics: PdfPageLayoutDiagnostics[];
  safety_findings: PdfSafetyFinding[];
  routing: PdfDocumentMapRouting;
  summary: PdfDocumentMapSummary;
  warnings?: string[] | undefined;
}
