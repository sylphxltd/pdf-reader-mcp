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
