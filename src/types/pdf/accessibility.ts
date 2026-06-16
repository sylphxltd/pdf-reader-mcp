// PDF accessibility report type definitions

export type PdfAccessibilityGrade = 'good' | 'partial' | 'weak';

export type PdfAccessibilityIssueSeverity = 'low' | 'medium' | 'high';

export type PdfAccessibilityIssueType =
  | 'mark_info_missing'
  | 'untagged_pdf'
  | 'suspect_tags'
  | 'structure_tree_missing'
  | 'untagged_page'
  | 'heading_structure'
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
  heading_count: number;
  figure_count: number;
  image_count: number;
  link_count: number;
  form_field_count: number;
  issues: PdfAccessibilityIssue[];
}

export interface PdfAccessibilityReportSummary {
  selected_pages: number[];
  page_count: number;
  tagged_page_count: number;
  untagged_page_count: number;
  structure_role_count: number;
  heading_count: number;
  figure_count: number;
  image_count: number;
  link_count: number;
  form_field_count: number;
  issue_count: number;
  high_issue_count: number;
  medium_issue_count: number;
  low_issue_count: number;
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
