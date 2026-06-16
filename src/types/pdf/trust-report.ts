// PDF trust report type definitions

export type PdfTrustRiskLevel = 'low' | 'medium' | 'high';

export type PdfTrustSignalType =
  | 'content_safety'
  | 'layout_uncertainty'
  | 'sparse_or_scanned'
  | 'table_quality'
  | 'external_link';

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
  page_count: number;
  pages_with_signals: number;
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
