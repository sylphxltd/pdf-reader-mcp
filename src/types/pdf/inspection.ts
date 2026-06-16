// PDF inspection and provider status type definitions

import type { PdfInfo, PdfMetadata } from './document-structure.js';
import type { PdfPageGeometry } from './geometry.js';

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

export type PdfOptionalProviderReadiness = 'ready' | 'not_configured' | 'invalid_configuration';

export interface PdfOcrProviderStatus {
  readiness: PdfOptionalProviderReadiness;
  provider: 'command';
  command_configured: boolean;
  preset?: 'tesseract' | 'unsupported' | undefined;
  warnings?: string[] | undefined;
}

export interface PdfRegionAnalysisProviderStatus {
  readiness: PdfOptionalProviderReadiness;
  provider: 'command';
  command_configured: boolean;
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

export interface InspectPdfOptions {
  sample_pages: number;
  include_metadata: boolean;
}
