import type {
  PdfAccessibilityGrade,
  PdfAccessibilityIssue,
  PdfAccessibilityIssueSeverity,
  PdfAccessibilityIssueType,
  PdfAccessibilityPageReport,
  PdfAccessibilityReport,
  PdfAnnotation,
  PdfDocumentElement,
  PdfFormField,
  PdfOutlineItem,
  PdfPageAnnotations,
  PdfPageStructureTree,
  PdfStructureTreeChild,
  PdfStructureTreeNode,
} from '../types/pdf.js';
import { roundRatio } from '../utils/geometry.js';

const ACCESSIBILITY_REPORT_VERSION = '2026-06-15' as const;

const ACCESSIBILITY_ISSUE_TYPES = [
  'mark_info_missing',
  'untagged_pdf',
  'suspect_tags',
  'structure_tree_missing',
  'untagged_page',
  'heading_structure',
  'tagged_content_mismatch',
  'image_alt_text',
  'form_field_label',
  'link_label',
  'accessibility_permission',
] as const satisfies readonly PdfAccessibilityIssueType[];

const ACCESSIBILITY_ISSUE_SEVERITIES = [
  'high',
  'medium',
  'low',
] as const satisfies readonly PdfAccessibilityIssueSeverity[];

const ACCESSIBILITY_GRADES = [
  'good',
  'partial',
  'weak',
] as const satisfies readonly PdfAccessibilityGrade[];

interface BuildAccessibilityReportInput {
  selectedPages: number[];
  elements: PdfDocumentElement[];
  structureTrees?: PdfPageStructureTree[] | undefined;
  annotations?: PdfPageAnnotations[] | undefined;
  formFields?: PdfFormField[] | undefined;
  permissions?: string[] | undefined;
  markInfo?: Record<string, unknown> | undefined;
  outline?: PdfOutlineItem[] | undefined;
}

interface StructureRoleStats {
  roleCount: number;
  contentCount: number;
  contentIdCount: number;
  headingCount: number;
  figureCount: number;
}

interface PageAccessibilitySignals {
  page: number;
  structureTree?: PdfPageStructureTree | undefined;
  roleStats: StructureRoleStats;
  visibleElementCount: number;
  tagContentCoverage: number;
  images: PdfDocumentElement[];
  links: PdfAnnotation[];
  fields: PdfFormField[];
}

const EMPTY_STRUCTURE_ROLE_STATS: StructureRoleStats = {
  roleCount: 0,
  contentCount: 0,
  contentIdCount: 0,
  headingCount: 0,
  figureCount: 0,
};

const issueScore = (severity: PdfAccessibilityIssueSeverity): number => {
  if (severity === 'high') return 35;
  if (severity === 'medium') return 18;
  return 8;
};

const emptyCountRecord = <Key extends string>(keys: readonly Key[]): Record<Key, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>;

const issueTypeCounts = (
  issues: PdfAccessibilityIssue[]
): Record<PdfAccessibilityIssueType, number> => {
  const counts = emptyCountRecord(ACCESSIBILITY_ISSUE_TYPES);
  for (const issue of issues) counts[issue.type]++;
  return counts;
};

const issueSeverityCounts = (
  issues: PdfAccessibilityIssue[]
): Record<PdfAccessibilityIssueSeverity, number> => {
  const counts = emptyCountRecord(ACCESSIBILITY_ISSUE_SEVERITIES);
  for (const issue of issues) counts[issue.severity]++;
  return counts;
};

const pageGradeCounts = (
  pageReports: PdfAccessibilityPageReport[]
): Record<PdfAccessibilityGrade, number> => {
  const counts = emptyCountRecord(ACCESSIBILITY_GRADES);
  for (const pageReport of pageReports) counts[pageReport.grade]++;
  return counts;
};

const clampScore = (score: number): number => Math.max(0, Math.min(100, Math.round(score)));

const gradeFromScore = (score: number): PdfAccessibilityGrade => {
  if (score >= 85) return 'good';
  if (score >= 60) return 'partial';
  return 'weak';
};

const booleanMarkInfo = (
  markInfo: Record<string, unknown> | undefined,
  key: 'Marked' | 'Suspects'
): boolean | undefined => {
  const value = markInfo?.[key] ?? markInfo?.[key.toLowerCase()];
  return typeof value === 'boolean' ? value : undefined;
};

const isStructureNode = (child: PdfStructureTreeChild): child is PdfStructureTreeNode =>
  'role' in child;

const normalizeRole = (role: string): string => role.trim().toLowerCase();

const isHeadingRole = (role: string): boolean =>
  /^h[1-6]$/.test(role) || role === 'h' || role === 'heading';

const countStructureRoles = (node: PdfStructureTreeNode): StructureRoleStats => {
  const role = normalizeRole(node.role);
  const ownStats: StructureRoleStats = {
    roleCount: 1,
    contentCount: 0,
    contentIdCount: 0,
    headingCount: isHeadingRole(role) ? 1 : 0,
    figureCount: role === 'figure' ? 1 : 0,
  };

  for (const child of node.children ?? []) {
    if (!isStructureNode(child)) {
      ownStats.contentCount++;
      if (child.id) ownStats.contentIdCount++;
      continue;
    }
    const childStats = countStructureRoles(child);
    ownStats.roleCount += childStats.roleCount;
    ownStats.contentCount += childStats.contentCount;
    ownStats.contentIdCount += childStats.contentIdCount;
    ownStats.headingCount += childStats.headingCount;
    ownStats.figureCount += childStats.figureCount;
  }

  return ownStats;
};

const outlineCount = (items: PdfOutlineItem[] | undefined): number =>
  (items ?? []).reduce((sum, item) => sum + 1 + outlineCount(item.items), 0);

const pageAnnotations = (
  annotations: PdfPageAnnotations[] | undefined,
  page: number
): PdfAnnotation[] => annotations?.find((entry) => entry.page === page)?.annotations ?? [];

const pageFields = (formFields: PdfFormField[] | undefined, page: number): PdfFormField[] =>
  (formFields ?? []).filter((field) => field.page === page);

const pageImages = (elements: PdfDocumentElement[], page: number): PdfDocumentElement[] =>
  elements.filter((element) => element.type === 'image' && element.page === page);

const pageVisibleElements = (elements: PdfDocumentElement[], page: number): PdfDocumentElement[] =>
  elements.filter((element) => element.page === page);

const tagContentCoverage = (
  structureTree: PdfPageStructureTree | undefined,
  roleStats: StructureRoleStats | undefined,
  visibleElementCount: number
): number => {
  if (!structureTree) return 0;
  if (visibleElementCount === 0) return 1;

  return roundRatio(Math.min(1, (roleStats?.contentCount ?? 0) / visibleElementCount));
};

const pageAccessibilitySignals = (
  input: BuildAccessibilityReportInput,
  page: number
): PageAccessibilitySignals => {
  const structureTree = input.structureTrees?.find((entry) => entry.page === page);
  const roleStats = structureTree
    ? countStructureRoles(structureTree.tree)
    : EMPTY_STRUCTURE_ROLE_STATS;
  const visibleElementCount = pageVisibleElements(input.elements, page).length;
  const annotations = pageAnnotations(input.annotations, page);
  const links = annotations.filter((annotation) => annotation.url);
  const fields = pageFields(input.formFields, page);

  return {
    page,
    structureTree,
    roleStats,
    visibleElementCount,
    tagContentCoverage: tagContentCoverage(structureTree, roleStats, visibleElementCount),
    images: pageImages(input.elements, page),
    links,
    fields,
  };
};

const buildDocumentIssues = (input: BuildAccessibilityReportInput): PdfAccessibilityIssue[] => {
  const issues: PdfAccessibilityIssue[] = [];
  const marked = booleanMarkInfo(input.markInfo, 'Marked');
  const suspects = booleanMarkInfo(input.markInfo, 'Suspects');
  const taggedPageCount = input.structureTrees?.length ?? 0;

  if (marked === undefined && taggedPageCount === 0) {
    issues.push({
      type: 'mark_info_missing',
      severity: 'medium',
      message:
        'PDF mark info and tagged structure trees were not exposed; accessibility tagging cannot be verified.',
    });
  } else if (marked === false) {
    issues.push({
      type: 'untagged_pdf',
      severity: 'high',
      message: 'PDF mark info reports that the document is not tagged.',
      evidence: { mark_info: input.markInfo },
    });
  }

  if (suspects === true) {
    issues.push({
      type: 'suspect_tags',
      severity: 'high',
      message: 'PDF mark info reports suspect tags; verify structure before relying on semantics.',
      evidence: { mark_info: input.markInfo },
    });
  }

  if (taggedPageCount === 0) {
    issues.push({
      type: 'structure_tree_missing',
      severity: 'medium',
      message:
        'No tagged PDF structure tree was found for the selected pages, so heading, list, table, and figure semantics are not machine-verifiable.',
    });
  }

  if (
    input.permissions &&
    input.permissions.length > 0 &&
    !input.permissions.includes('copy_for_accessibility')
  ) {
    issues.push({
      type: 'accessibility_permission',
      severity: 'high',
      message: 'PDF permissions do not expose copy_for_accessibility.',
      evidence: { permissions: input.permissions },
    });
  }

  return issues;
};

const buildPageIssues = (
  input: BuildAccessibilityReportInput,
  signals: PageAccessibilitySignals
): PdfAccessibilityIssue[] => {
  const issues: PdfAccessibilityIssue[] = [];

  if (!signals.structureTree) {
    issues.push({
      type: 'untagged_page',
      severity: 'medium',
      page: signals.page,
      message: 'Selected page does not expose a tagged structure tree.',
    });
  }

  if (
    signals.structureTree &&
    signals.roleStats.headingCount === 0 &&
    outlineCount(input.outline) > 0
  ) {
    issues.push({
      type: 'heading_structure',
      severity: 'low',
      page: signals.page,
      message:
        'The document has outline entries, but this page does not expose heading roles in the structure tree.',
      evidence: { outline_count: outlineCount(input.outline) },
    });
  }

  if (
    signals.structureTree &&
    signals.visibleElementCount > 0 &&
    signals.tagContentCoverage < 0.5
  ) {
    issues.push({
      type: 'tagged_content_mismatch',
      severity: 'medium',
      page: signals.page,
      message:
        'Tagged structure exposes too few content references for the visible page content; tag-to-content coverage needs verification.',
      evidence: {
        visible_element_count: signals.visibleElementCount,
        structure_content_count: signals.roleStats.contentCount,
        structure_content_id_count: signals.roleStats.contentIdCount,
        tag_content_coverage: signals.tagContentCoverage,
      },
    });
  }

  if (signals.images.length > 0 && signals.roleStats.figureCount < signals.images.length) {
    issues.push({
      type: 'image_alt_text',
      severity: signals.structureTree ? 'medium' : 'high',
      page: signals.page,
      message:
        'Page image objects outnumber Figure roles; image alt-text coverage cannot be verified from the available PDF structure.',
      evidence: {
        image_count: signals.images.length,
        figure_role_count: signals.roleStats.figureCount,
      },
    });
  }

  for (const field of signals.fields) {
    if (!field.name || /^unnamed|^field\d+$/i.test(field.name)) {
      issues.push({
        type: 'form_field_label',
        severity: field.required ? 'medium' : 'low',
        page: signals.page,
        message: 'Form field does not expose a useful accessible name.',
        evidence: {
          field_id: field.id,
          field_name: field.name,
          required: field.required,
          type: field.type,
        },
      });
    }
  }

  for (const link of signals.links) {
    if (!link.contents && !link.title) {
      issues.push({
        type: 'link_label',
        severity: 'low',
        page: signals.page,
        message: 'Link annotation target is present, but an accessible label was not exposed.',
        evidence: {
          annotation_id: link.id,
          subtype: link.subtype,
          url: link.url,
        },
      });
    }
  }

  return issues;
};

const buildGuidance = (issues: PdfAccessibilityIssue[]): string[] => {
  const guidance = new Set<string>();

  if (
    issues.some((issue) =>
      ['mark_info_missing', 'untagged_pdf', 'structure_tree_missing', 'untagged_page'].includes(
        issue.type
      )
    )
  ) {
    guidance.add(
      'Do not assume PDF reading order or semantics are accessible without tagged structure evidence.'
    );
  }
  if (issues.some((issue) => issue.type === 'suspect_tags')) {
    guidance.add(
      'Verify suspect tags with page rendering or source authoring files before relying on them.'
    );
  }
  if (issues.some((issue) => issue.type === 'tagged_content_mismatch')) {
    guidance.add(
      'Verify tagged structure against visible page content before relying on tag-derived semantics.'
    );
  }
  if (issues.some((issue) => issue.type === 'image_alt_text')) {
    guidance.add(
      'Use region crops or source documents to verify image meaning when alt text is not exposed.'
    );
  }
  if (issues.some((issue) => issue.type === 'form_field_label')) {
    guidance.add('Review form field labels before asking users or agents to complete PDF forms.');
  }
  if (issues.some((issue) => issue.type === 'link_label')) {
    guidance.add('Treat PDF links as untrusted unless link labels and targets are verified.');
  }
  if (issues.some((issue) => issue.type === 'accessibility_permission')) {
    guidance.add(
      'Check document permissions before depending on copy-based accessibility workflows.'
    );
  }

  return [...guidance];
};

export const buildAccessibilityReport = (
  input: BuildAccessibilityReportInput
): PdfAccessibilityReport => {
  const selectedPages = [...new Set(input.selectedPages)].sort((a, b) => a - b);
  const documentIssues = buildDocumentIssues(input);

  const pageReports: PdfAccessibilityPageReport[] = selectedPages.map((page) => {
    const signals = pageAccessibilitySignals(input, page);
    const issues = buildPageIssues(input, signals);
    const score = clampScore(
      100 - issues.reduce((sum, issue) => sum + issueScore(issue.severity), 0)
    );
    const severityCounts = issueSeverityCounts(issues);

    return {
      page,
      tagged: signals.roleStats.roleCount > 0,
      score,
      grade: gradeFromScore(score),
      structure_role_count: signals.roleStats.roleCount,
      structure_content_count: signals.roleStats.contentCount,
      structure_content_id_count: signals.roleStats.contentIdCount,
      visible_element_count: signals.visibleElementCount,
      tag_content_coverage: signals.tagContentCoverage,
      heading_count: signals.roleStats.headingCount,
      figure_count: signals.roleStats.figureCount,
      image_count: signals.images.length,
      link_count: signals.links.length,
      form_field_count: signals.fields.length,
      issue_count: issues.length,
      high_issue_count: severityCounts.high,
      medium_issue_count: severityCounts.medium,
      low_issue_count: severityCounts.low,
      issue_type_counts: issueTypeCounts(issues),
      issues,
    };
  });

  const issues = [...documentIssues, ...pageReports.flatMap((pageReport) => pageReport.issues)];
  const score = clampScore(
    100 - issues.reduce((sum, issue) => sum + issueScore(issue.severity), 0)
  );
  const issueCountsBySeverity = issueSeverityCounts(issues);
  const pageReportsWithIssues = pageReports.filter((pageReport) => pageReport.issue_count > 0);
  const taggedPageCount = pageReports.filter((pageReport) => pageReport.tagged).length;
  const averageTagContentCoverage =
    pageReports.length === 0
      ? 0
      : roundRatio(
          pageReports.reduce((sum, pageReport) => sum + pageReport.tag_content_coverage, 0) /
            pageReports.length
        );

  return {
    version: ACCESSIBILITY_REPORT_VERSION,
    profile: 'pdf_accessibility_report',
    score,
    grade: gradeFromScore(score),
    tagged: booleanMarkInfo(input.markInfo, 'Marked') === true || taggedPageCount > 0,
    suspected_tagging_issues: booleanMarkInfo(input.markInfo, 'Suspects') === true,
    summary: {
      selected_pages: selectedPages,
      page_count: selectedPages.length,
      tagged_page_count: taggedPageCount,
      untagged_page_count: selectedPages.length - taggedPageCount,
      structure_role_count: pageReports.reduce(
        (sum, pageReport) => sum + pageReport.structure_role_count,
        0
      ),
      structure_content_count: pageReports.reduce(
        (sum, pageReport) => sum + pageReport.structure_content_count,
        0
      ),
      structure_content_id_count: pageReports.reduce(
        (sum, pageReport) => sum + pageReport.structure_content_id_count,
        0
      ),
      visible_element_count: pageReports.reduce(
        (sum, pageReport) => sum + pageReport.visible_element_count,
        0
      ),
      average_tag_content_coverage: averageTagContentCoverage,
      heading_count: pageReports.reduce((sum, pageReport) => sum + pageReport.heading_count, 0),
      figure_count: pageReports.reduce((sum, pageReport) => sum + pageReport.figure_count, 0),
      image_count: pageReports.reduce((sum, pageReport) => sum + pageReport.image_count, 0),
      link_count: pageReports.reduce((sum, pageReport) => sum + pageReport.link_count, 0),
      form_field_count: pageReports.reduce(
        (sum, pageReport) => sum + pageReport.form_field_count,
        0
      ),
      issue_count: issues.length,
      document_issue_count: documentIssues.length,
      page_issue_count: issues.length - documentIssues.length,
      high_issue_count: issueCountsBySeverity.high,
      medium_issue_count: issueCountsBySeverity.medium,
      low_issue_count: issueCountsBySeverity.low,
      issue_severity_counts: issueCountsBySeverity,
      issue_type_counts: issueTypeCounts(issues),
      page_grade_counts: pageGradeCounts(pageReports),
      pages_with_issues_count: pageReportsWithIssues.length,
      pages_with_high_issues_count: pageReportsWithIssues.filter(
        (pageReport) => pageReport.high_issue_count > 0
      ).length,
      pages_with_medium_issues_count: pageReportsWithIssues.filter(
        (pageReport) => pageReport.medium_issue_count > 0
      ).length,
      pages_with_low_issues_count: pageReportsWithIssues.filter(
        (pageReport) => pageReport.low_issue_count > 0
      ).length,
    },
    page_reports: pageReports,
    issues,
    guidance: buildGuidance(issues),
  };
};
