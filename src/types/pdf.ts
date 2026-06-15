// PDF-related TypeScript type definitions

export interface TableCell {
  text: string;
  rowIndex: number;
  colIndex: number;
  rowSpan?: number | undefined;
  colSpan?: number | undefined;
  isHeader?: boolean | undefined;
  inferred?: boolean | undefined;
  bounding_box?: BoundingBox | undefined;
}

export type TableQualitySignal =
  | 'complete_grid'
  | 'missing_cells'
  | 'merged_cell_candidates'
  | 'incomplete_cell_geometry'
  | 'irregular_row_spacing'
  | 'multi_page_continuation_candidate'
  | 'low_confidence';

export interface TableQuality {
  completeness: number;
  nonEmptyCellRatio: number;
  cellBoundingBoxCoverage: number;
  inferredCellRatio: number;
  rowAlignment: number;
  rowSpacingConsistency: number;
  cellBoundingBoxCount: number;
  inferredCellCount: number;
  missingCellCount: number;
  mergedCellCandidateCount: number;
  signals: TableQualitySignal[];
  warnings?: string[] | undefined;
}

export type TableExtractionSource = 'selectable_text' | 'ocr_text_layer';

export interface TableExtractionProvenance {
  source: TableExtractionSource;
  engine: 'pdfjs' | 'external-command';
  ocr_source_render_evidence_id?: string | undefined;
}

export interface TableContinuationCandidate {
  groupId: string;
  role: 'starts' | 'continues' | 'ends';
  previousTableId?: string | undefined;
  nextTableId?: string | undefined;
  confidence: number;
  signals: string[];
}

export interface ExtractedTable {
  page: number;
  tableIndex: number;
  rows: string[][]; // 2D array [row][col]
  cells?: TableCell[] | undefined;
  bounding_box?: BoundingBox | undefined;
  rowCount: number;
  colCount: number;
  confidence: number; // 0-1 detection confidence
  quality?: TableQuality | undefined;
  continuation?: TableContinuationCandidate | undefined;
  provenance?: TableExtractionProvenance | undefined;
}

export interface PdfOutlineItem {
  title: string;
  bold?: boolean | undefined;
  italic?: boolean | undefined;
  color?: number[] | undefined;
  url?: string | undefined;
  dest?: unknown;
  items?: PdfOutlineItem[] | undefined;
}

export interface PdfAnnotation {
  page: number;
  id?: string | undefined;
  subtype?: string | undefined;
  contents?: string | undefined;
  title?: string | undefined;
  url?: string | undefined;
  dest?: unknown;
  bounding_box?: BoundingBox | undefined;
}

export interface PdfPageAnnotations {
  page: number;
  annotations: PdfAnnotation[];
}

export interface PdfFormField {
  name: string;
  type?: string | undefined;
  value?: unknown;
  default_value?: unknown;
  page?: number | undefined;
  id?: string | undefined;
  editable?: boolean | undefined;
  required?: boolean | undefined;
  bounding_box?: BoundingBox | undefined;
}

export interface PdfAttachment {
  name: string;
  filename?: string | undefined;
  description?: string | undefined;
  size_bytes?: number | undefined;
}

export interface PdfPageGeometry {
  page: number;
  width: number;
  height: number;
  rotation: number;
  user_unit?: number | undefined;
  view_box?: BoundingBox | undefined;
}

export interface PdfStructureTreeContent {
  type: string;
  id?: string | undefined;
}

export type PdfStructureTreeChild = PdfStructureTreeNode | PdfStructureTreeContent;

export interface PdfStructureTreeNode {
  role: string;
  children?: PdfStructureTreeChild[] | undefined;
}

export interface PdfPageStructureTree {
  page: number;
  tree: PdfStructureTreeNode;
}

export interface PdfInfo {
  PDFFormatVersion?: string;
  IsLinearized?: boolean;
  IsAcroFormPresent?: boolean;
  IsXFAPresent?: boolean;
  [key: string]: unknown;
}

export type PdfMetadata = Record<string, unknown>;

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

export interface BoundingBox {
  left: number;
  bottom: number;
  right: number;
  top: number;
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

export type PdfSafetyFindingType =
  | 'prompt_injection_pattern'
  | 'hidden_text'
  | 'off_page_text'
  | 'tiny_text'
  | 'overlapping_text';

export type PdfSafetySeverity = 'low' | 'medium' | 'high';

export interface PdfSafetyFinding {
  type: PdfSafetyFindingType;
  severity: PdfSafetySeverity;
  page: number;
  message: string;
  element_id?: string | undefined;
  snippet?: string | undefined;
  bounding_box?: BoundingBox | undefined;
}

export type PdfLayoutProfile =
  | 'single_column'
  | 'multi_column'
  | 'mixed_layout'
  | 'image_or_sparse'
  | 'unknown';

export type PdfReadingOrderModel = 'natural' | 'columnar' | 'mixed' | 'uncertain';

export interface PdfLayoutColumn {
  index: number;
  left: number;
  right: number;
  item_count: number;
}

export interface PdfPageLayoutDiagnostics {
  page: number;
  profile: PdfLayoutProfile;
  reading_order: PdfReadingOrderModel;
  confidence: number;
  item_count: number;
  text_item_count: number;
  image_item_count: number;
  positioned_item_ratio: number;
  column_count: number;
  columns?: PdfLayoutColumn[] | undefined;
  signals: string[];
  warnings?: string[] | undefined;
}

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
  warnings?: string[] | undefined;
}

export interface PdfDocumentMapRouting {
  low_confidence_pages: number[];
  image_or_sparse_pages: number[];
  needs_ocr_pages: number[];
  ocr_applied_pages: number[];
  visual_candidate_pages: number[];
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

export type PdfDocumentAstCaptionRelation = 'above' | 'below' | 'overlapping';

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

export type PdfTrustRiskLevel = 'low' | 'medium' | 'high';

export type PdfTrustSignalType =
  | 'content_safety'
  | 'layout_uncertainty'
  | 'sparse_or_scanned'
  | 'table_quality'
  | 'unsafe_external_link'
  | 'external_link';

export type PdfTrustEvidenceRedactionType =
  | 'email'
  | 'ssn'
  | 'credit_card'
  | 'secret'
  | 'jwt'
  | 'private_key_marker';

export interface PdfTrustSignal {
  type: PdfTrustSignalType;
  severity: PdfTrustRiskLevel;
  page?: number | undefined;
  message: string;
  element_id?: string | undefined;
  annotation_id?: string | undefined;
  table_id?: string | undefined;
  evidence?: Record<string, unknown> | undefined;
}

export interface PdfTrustPageReport {
  page: number;
  risk: PdfTrustRiskLevel;
  score: number;
  signals: PdfTrustSignal[];
}

export interface PdfTrustReportSummary {
  selected_pages: number[];
  signal_count: number;
  high_signal_count: number;
  medium_signal_count: number;
  low_signal_count: number;
  signal_type_counts: Partial<Record<PdfTrustSignalType, number>>;
  safety_finding_type_counts: Partial<Record<PdfSafetyFindingType, number>>;
  page_count: number;
  pages_with_signals: number;
  high_risk_page_count: number;
  medium_risk_page_count: number;
  low_risk_page_count: number;
}

export interface PdfTrustReport {
  version: '2026-06-15';
  profile: 'pdf_trust_report';
  risk: PdfTrustRiskLevel;
  score: number;
  summary: PdfTrustReportSummary;
  page_reports: PdfTrustPageReport[];
  signals: PdfTrustSignal[];
  guidance: string[];
}

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

export type PdfAccessibilityGrade = 'good' | 'partial' | 'weak';

export type PdfAccessibilityIssueSeverity = 'low' | 'medium' | 'high';

export type PdfAccessibilityIssueType =
  | 'mark_info_missing'
  | 'untagged_pdf'
  | 'suspect_tags'
  | 'structure_tree_missing'
  | 'untagged_page'
  | 'heading_structure'
  | 'tagged_content_mismatch'
  | 'image_alt_text'
  | 'form_field_label'
  | 'link_label'
  | 'accessibility_permission';

export interface PdfAccessibilityIssue {
  type: PdfAccessibilityIssueType;
  severity: PdfAccessibilityIssueSeverity;
  page?: number | undefined;
  message: string;
  evidence?: Record<string, unknown> | undefined;
}

export interface PdfAccessibilityPageReport {
  page: number;
  tagged: boolean;
  score: number;
  grade: PdfAccessibilityGrade;
  structure_role_count: number;
  structure_content_count: number;
  structure_content_id_count: number;
  visible_element_count: number;
  tag_content_coverage: number;
  heading_count: number;
  figure_count: number;
  image_count: number;
  link_count: number;
  form_field_count: number;
  issue_count: number;
  high_issue_count: number;
  medium_issue_count: number;
  low_issue_count: number;
  issue_type_counts: Record<PdfAccessibilityIssueType, number>;
  issues: PdfAccessibilityIssue[];
}

export interface PdfAccessibilityReportSummary {
  selected_pages: number[];
  page_count: number;
  tagged_page_count: number;
  untagged_page_count: number;
  structure_role_count: number;
  structure_content_count: number;
  structure_content_id_count: number;
  visible_element_count: number;
  average_tag_content_coverage: number;
  heading_count: number;
  figure_count: number;
  image_count: number;
  link_count: number;
  form_field_count: number;
  issue_count: number;
  document_issue_count: number;
  page_issue_count: number;
  high_issue_count: number;
  medium_issue_count: number;
  low_issue_count: number;
  issue_severity_counts: Record<PdfAccessibilityIssueSeverity, number>;
  issue_type_counts: Record<PdfAccessibilityIssueType, number>;
  page_grade_counts: Record<PdfAccessibilityGrade, number>;
  pages_with_issues_count: number;
  pages_with_high_issues_count: number;
  pages_with_medium_issues_count: number;
  pages_with_low_issues_count: number;
}

export interface PdfAccessibilityReport {
  version: '2026-06-15';
  profile: 'pdf_accessibility_report';
  score: number;
  grade: PdfAccessibilityGrade;
  tagged: boolean;
  suspected_tagging_issues: boolean;
  summary: PdfAccessibilityReportSummary;
  page_reports: PdfAccessibilityPageReport[];
  issues: PdfAccessibilityIssue[];
  guidance: string[];
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

export interface PdfResultData {
  info?: PdfInfo;
  metadata?: PdfMetadata;
  num_pages?: number;
  page_labels?: string[];
  page_geometry?: PdfPageGeometry[];
  permissions?: string[];
  mark_info?: Record<string, unknown>;
  outline?: PdfOutlineItem[];
  annotations?: PdfPageAnnotations[];
  form_fields?: PdfFormField[];
  attachments?: PdfAttachment[];
  structure_trees?: PdfPageStructureTree[];
  full_text?: string;
  markdown?: string;
  html?: string;
  page_texts?: ExtractedPageText[];
  page_contents?: Array<{ page: number; items: PageContentItem[] }>;
  elements?: PdfDocumentElement[];
  chunks?: PdfChunk[];
  text_layer?: PdfTextLayer;
  ocr_text_layer?: PdfOcrTextLayer;
  safety_findings?: PdfSafetyFinding[];
  layout_diagnostics?: PdfPageLayoutDiagnostics[];
  visual_enrichment_candidates?: PdfVisualEnrichmentCandidate[];
  visual_enrichments?: PdfVisualEnrichment[];
  document_map?: PdfDocumentMap;
  document_ast?: PdfDocumentAst;
  trust_report?: PdfTrustReport;
  accessibility_report?: PdfAccessibilityReport;
  images?: ExtractedImage[];
  tables?: ExtractedTable[];
  warnings?: string[];
}

export interface PdfSourceResult {
  source: string;
  success: boolean;
  data?: PdfResultData | undefined;
  error?: string;
}

export interface PdfPageRenderProvenance {
  engine: 'pdfjs';
  renderer: '@napi-rs/canvas';
  source: 'page-render';
}

export interface PdfPageRenderData {
  page: number;
  evidence_id: string;
  width: number;
  height: number;
  scale: number;
  pixel_count: number;
  byte_length: number;
  format: 'png';
  mime_type: 'image/png';
  rotation: number;
  provenance: PdfPageRenderProvenance;
  data: string;
}

export interface PdfPageRenderSummary extends Omit<PdfPageRenderData, 'data'> {
  image_content_index?: number | undefined;
}

export interface PdfPageRenderSourceResult {
  source: string;
  success: boolean;
  num_pages?: number | undefined;
  rendered_pages?: PdfPageRenderSummary[] | undefined;
  warnings?: string[] | undefined;
  error?: string | undefined;
}

export type PdfInspectionProfile =
  | 'digital_text'
  | 'scanned_or_image_only'
  | 'mixed_text_and_scan'
  | 'low_text_or_form'
  | 'unknown';

export type PdfInspectionWorkflow =
  | 'agentic_rag'
  | 'metadata_review'
  | 'scanned_pdf_triage'
  | 'mixed_pdf_review';

export type PdfInspectionNextToolName =
  | 'read_pdf'
  | 'search_pdf'
  | 'render_page'
  | 'extract_regions'
  | 'analyze_regions'
  | 'ocr_pages';

export interface PdfInspectionPageSignal {
  page: number;
  text_chars: number;
  text_items: number;
  estimated_tokens: number;
  image_paint_operations: number;
  likely_scanned: boolean;
  low_text_density: boolean;
}

export interface PdfInspectionDocumentSignals {
  has_outline: boolean;
  has_page_labels: boolean;
  has_permissions: boolean;
  has_mark_info: boolean;
  has_form_fields: boolean;
  has_attachments: boolean;
  has_structure_tree: boolean;
}

export interface PdfInspectionRecommendation {
  workflow: PdfInspectionWorkflow;
  needs_ocr: boolean;
  reason: string;
  read_pdf_arguments: Record<string, unknown>;
  next_tools: PdfInspectionNextTool[];
}

export interface PdfInspectionNextTool {
  tool: PdfInspectionNextToolName;
  priority: number;
  ready: boolean;
  purpose: string;
  when: string;
  arguments?: Record<string, unknown> | undefined;
  argument_template?: Record<string, unknown> | undefined;
  required_inputs?: string[] | undefined;
  requires_provider?: 'ocr_pages' | 'analyze_regions' | undefined;
}

export type PdfOptionalProviderReadiness = 'ready' | 'not_configured' | 'invalid_configuration';

export interface PdfOcrProviderStatus {
  readiness: PdfOptionalProviderReadiness;
  provider: 'command';
  command_configured: boolean;
  preset?: 'tesseract' | 'tesseract-tsv' | 'unsupported' | undefined;
  warnings?: string[] | undefined;
}

export interface PdfRegionAnalysisProviderStatus {
  readiness: PdfOptionalProviderReadiness;
  provider: 'command' | 'http';
  command_configured: boolean;
  http_configured?: boolean | undefined;
  warnings?: string[] | undefined;
}

export interface PdfInspectionProviderStatus {
  ocr_pages: PdfOcrProviderStatus;
  analyze_regions: PdfRegionAnalysisProviderStatus;
}

export interface PdfInspectionData {
  profile: PdfInspectionProfile;
  num_pages: number;
  sampled_pages: number[];
  page_signals: PdfInspectionPageSignal[];
  document_signals: PdfInspectionDocumentSignals;
  recommendation: PdfInspectionRecommendation;
  provider_status: PdfInspectionProviderStatus;
  info?: PdfInfo | undefined;
  metadata?: PdfMetadata | undefined;
  page_geometry?: PdfPageGeometry[] | undefined;
  warnings?: string[] | undefined;
}

export interface PdfInspectionSourceResult {
  source: string;
  success: boolean;
  data?: PdfInspectionData | undefined;
  error?: string;
}

export interface PdfSource {
  path?: string | undefined;
  url?: string | undefined;
  pages?: string | number[] | undefined;
}

export interface ReadPdfOptions {
  include_full_text: boolean;
  include_metadata: boolean;
  include_page_count: boolean;
  include_images: boolean;
  include_tables: boolean;
  include_elements: boolean;
  include_semantic_hints: boolean;
  include_markdown: boolean;
  include_html: boolean;
  include_chunks: boolean;
  include_text_layer: boolean;
  include_ocr_text_layer: boolean;
  include_outline: boolean;
  include_annotations: boolean;
  include_page_labels: boolean;
  include_page_geometry: boolean;
  include_permissions: boolean;
  include_form_fields: boolean;
  include_attachments: boolean;
  include_structure_tree: boolean;
  include_safety_findings: boolean;
  include_layout_diagnostics: boolean;
  include_document_map: boolean;
  include_document_ast: boolean;
  include_visual_enrichments: boolean;
  max_visual_enrichments: number;
  include_trust_report: boolean;
  include_accessibility_report: boolean;
}

export interface InspectPdfOptions {
  sample_pages: number;
  include_metadata: boolean;
}

export interface RenderPageOptions {
  scale: number;
  max_pages: number;
  max_pixels_per_page: number;
  include_image: boolean;
}

export interface PdfRegionBoundingBox {
  left: number;
  bottom: number;
  right: number;
  top: number;
}

export interface PdfRegionRequest {
  id?: string | undefined;
  page: number;
  bounding_box: PdfRegionBoundingBox;
  padding?: number | undefined;
}

export interface PdfRegionCropPixels {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PdfRegionCropProvenance {
  engine: 'pdfjs';
  renderer: '@napi-rs/canvas';
  source: 'region-crop';
  page_render_evidence_id: string;
}

export interface PdfRegionCropData {
  region_id: string;
  page: number;
  evidence_id: string;
  source_bounding_box: PdfRegionBoundingBox;
  crop_pixels: PdfRegionCropPixels;
  scale: number;
  byte_length: number;
  format: 'png';
  mime_type: 'image/png';
  provenance: PdfRegionCropProvenance;
  data: string;
}

export interface PdfRegionCropSummary extends Omit<PdfRegionCropData, 'data'> {
  image_content_index?: number | undefined;
}

export interface PdfRegionCropSourceResult {
  source: string;
  success: boolean;
  num_pages?: number | undefined;
  regions?: PdfRegionCropSummary[] | undefined;
  warnings?: string[] | undefined;
  error?: string | undefined;
}

export interface ExtractRegionsOptions {
  scale: number;
  max_regions: number;
  max_pixels_per_page: number;
  include_image: boolean;
}

export type PdfOcrProvider = 'command';

export interface PdfOcrWord {
  text: string;
  confidence?: number | undefined;
  bounding_box?: BoundingBox | undefined;
}

export interface PdfOcrPageData {
  page: number;
  text: string;
  confidence?: number | undefined;
  words?: PdfOcrWord[] | undefined;
  language?: string | undefined;
  provider: PdfOcrProvider;
  source_render_evidence_id: string;
  source_render_scale?: number | undefined;
  source_render_width?: number | undefined;
  source_render_height?: number | undefined;
  provenance: {
    engine: 'external-command';
    source: 'ocr-provider';
  };
  warnings?: string[] | undefined;
}

export interface PdfOcrSourceResult {
  source: string;
  success: boolean;
  num_pages?: number | undefined;
  ocr_pages?: PdfOcrPageData[] | undefined;
  warnings?: string[] | undefined;
  error?: string | undefined;
}

export interface PdfOcrTextLayerSummary {
  page_count: number;
  text_chars: number;
  word_count: number;
  words_with_bounding_boxes: number;
  source_render_count: number;
  average_confidence?: number | undefined;
}

export interface PdfOcrTextLayer {
  profile: 'ocr_text_layer';
  pages: PdfOcrPageData[];
  summary: PdfOcrTextLayerSummary;
  warnings?: string[] | undefined;
}

export interface OcrPagesOptions {
  scale: number;
  max_pages: number;
  max_pixels_per_page: number;
  timeout_ms: number;
  max_output_chars: number;
  languages?: string[] | undefined;
}

export type PdfRegionAnalysisProvider = 'command' | 'http';

export type PdfRegionAnalysisKind =
  | 'text'
  | 'table'
  | 'figure'
  | 'chart'
  | 'formula'
  | 'image'
  | 'diagram'
  | 'unknown';

export interface PdfRegionAnalysisTable {
  rows?: string[][] | undefined;
  markdown?: string | undefined;
  csv?: string | undefined;
  row_count?: number | undefined;
  column_count?: number | undefined;
  cells?: PdfRegionAnalysisTableCell[] | undefined;
  confidence?: number | undefined;
}

export interface PdfRegionAnalysisTableCell {
  text: string;
  row_index: number;
  column_index: number;
  row_span?: number | undefined;
  column_span?: number | undefined;
  confidence?: number | undefined;
  bounding_box?: BoundingBox | undefined;
}

export interface PdfRegionAnalysisFormula {
  latex?: string | undefined;
  mathml?: string | undefined;
  asciimath?: string | undefined;
  text?: string | undefined;
  confidence?: number | undefined;
}

export interface PdfRegionAnalysisChartAxis {
  label?: string | undefined;
  unit?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
}

export interface PdfRegionAnalysisChartSeries {
  name?: string | undefined;
  data_points: Array<Record<string, string | number | boolean | null>>;
  confidence?: number | undefined;
}

export interface PdfRegionAnalysisChart {
  title?: string | undefined;
  summary?: string | undefined;
  data_points?: Array<Record<string, string | number | boolean | null>> | undefined;
  x_axis?: PdfRegionAnalysisChartAxis | undefined;
  y_axis?: PdfRegionAnalysisChartAxis | undefined;
  series?: PdfRegionAnalysisChartSeries[] | undefined;
  confidence?: number | undefined;
}

export interface PdfRegionAnalysisData {
  region_id: string;
  page: number;
  kind: PdfRegionAnalysisKind;
  description?: string | undefined;
  text?: string | undefined;
  markdown?: string | undefined;
  confidence?: number | undefined;
  table?: PdfRegionAnalysisTable | undefined;
  formula?: PdfRegionAnalysisFormula | undefined;
  chart?: PdfRegionAnalysisChart | undefined;
  provider: PdfRegionAnalysisProvider;
  source_crop_evidence_id: string;
  source_bounding_box: PdfRegionBoundingBox;
  crop_pixels: PdfRegionCropPixels;
  scale: number;
  provenance: {
    engine: 'external-command' | 'external-http';
    source: 'region-analysis-provider';
  };
  warnings?: string[] | undefined;
}

export type PdfVisualEnrichmentTargetType =
  | 'image'
  | 'table'
  | 'figure'
  | 'chart'
  | 'formula'
  | 'diagram'
  | 'visual_region';

export interface PdfVisualEnrichmentCandidate {
  id: string;
  page: number;
  region: PdfRegionRequest;
  target_element_id: string;
  target_element_type: PdfVisualEnrichmentTargetType;
  source_element_id?: string | undefined;
  source_caption_element_id?: string | undefined;
  source_caption_text?: string | undefined;
  candidate_signals: string[];
}

export interface PdfVisualEnrichment extends PdfRegionAnalysisData {
  id: string;
  target_element_id: string;
  target_element_type: PdfVisualEnrichmentTargetType;
  source_caption_element_id?: string | undefined;
  source_caption_text?: string | undefined;
  candidate_signals?: string[] | undefined;
}

export interface PdfRegionAnalysisSourceResult {
  source: string;
  success: boolean;
  num_pages?: number | undefined;
  region_analyses?: PdfRegionAnalysisData[] | undefined;
  warnings?: string[] | undefined;
  error?: string | undefined;
}

export interface AnalyzeRegionsOptions {
  scale: number;
  max_regions: number;
  max_pixels_per_page: number;
  timeout_ms: number;
  max_output_chars: number;
  languages?: string[] | undefined;
}

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
