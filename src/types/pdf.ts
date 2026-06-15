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
  | 'irregular_row_spacing'
  | 'multi_page_continuation_candidate'
  | 'low_confidence';

export interface TableQuality {
  completeness: number;
  nonEmptyCellRatio: number;
  rowAlignment: number;
  rowSpacingConsistency: number;
  missingCellCount: number;
  mergedCellCandidateCount: number;
  signals: TableQualitySignal[];
  warnings?: string[] | undefined;
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

export type PdfSafetyFindingType = 'prompt_injection_pattern' | 'off_page_text' | 'tiny_text';

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
  safety_findings?: PdfSafetyFinding[];
  layout_diagnostics?: PdfPageLayoutDiagnostics[];
  document_map?: PdfDocumentMap;
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
}

export interface PdfInspectionData {
  profile: PdfInspectionProfile;
  num_pages: number;
  sampled_pages: number[];
  page_signals: PdfInspectionPageSignal[];
  document_signals: PdfInspectionDocumentSignals;
  recommendation: PdfInspectionRecommendation;
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

export interface OcrPagesOptions {
  scale: number;
  max_pages: number;
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
