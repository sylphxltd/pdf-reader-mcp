// PDF trust report type definitions

import type { PdfSafetyFindingType } from './safety.js';

export type PdfTrustRiskLevel = 'low' | 'medium' | 'high';

export type PdfTrustRedactionPolicy = 'standard' | 'strict' | 'off';

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
  | 'private_key_marker'
  | 'phone'
  | 'ipv4';

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
  redaction_policy: PdfTrustRedactionPolicy;
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
