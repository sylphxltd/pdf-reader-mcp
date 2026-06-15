import type {
  PdfAccessibilityGrade,
  PdfAccessibilityIssue,
  PdfAccessibilityIssueSeverity,
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

const ACCESSIBILITY_REPORT_VERSION = '2026-06-15' as const;

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
  headingCount: number;
  figureCount: number;
}

const issueScore = (severity: PdfAccessibilityIssueSeverity): number => {
  if (severity === 'high') return 35;
  if (severity === 'medium') return 18;
  return 8;
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
    headingCount: isHeadingRole(role) ? 1 : 0,
    figureCount: role === 'figure' ? 1 : 0,
  };

  for (const child of node.children ?? []) {
    if (!isStructureNode(child)) continue;
    const childStats = countStructureRoles(child);
    ownStats.roleCount += childStats.roleCount;
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
  page: number
): PdfAccessibilityIssue[] => {
  const issues: PdfAccessibilityIssue[] = [];
  const structureTree = input.structureTrees?.find((entry) => entry.page === page);
  const roleStats = structureTree ? countStructureRoles(structureTree.tree) : undefined;
  const images = pageImages(input.elements, page);
  const annotations = pageAnnotations(input.annotations, page);
  const links = annotations.filter((annotation) => annotation.url);
  const fields = pageFields(input.formFields, page);

  if (!structureTree) {
    issues.push({
      type: 'untagged_page',
      severity: 'medium',
      page,
      message: 'Selected page does not expose a tagged structure tree.',
    });
  }

  if (structureTree && roleStats?.headingCount === 0 && outlineCount(input.outline) > 0) {
    issues.push({
      type: 'heading_structure',
      severity: 'low',
      page,
      message:
        'The document has outline entries, but this page does not expose heading roles in the structure tree.',
      evidence: { outline_count: outlineCount(input.outline) },
    });
  }

  if (images.length > 0 && (roleStats?.figureCount ?? 0) < images.length) {
    issues.push({
      type: 'image_alt_text',
      severity: structureTree ? 'medium' : 'high',
      page,
      message:
        'Page image objects outnumber Figure roles; image alt-text coverage cannot be verified from the available PDF structure.',
      evidence: {
        image_count: images.length,
        figure_role_count: roleStats?.figureCount ?? 0,
      },
    });
  }

  for (const field of fields) {
    if (!field.name || /^unnamed|^field\d+$/i.test(field.name)) {
      issues.push({
        type: 'form_field_label',
        severity: field.required ? 'medium' : 'low',
        page,
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

  for (const link of links) {
    if (!link.contents && !link.title) {
      issues.push({
        type: 'link_label',
        severity: 'low',
        page,
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
    const structureTree = input.structureTrees?.find((entry) => entry.page === page);
    const roleStats = structureTree
      ? countStructureRoles(structureTree.tree)
      : { roleCount: 0, headingCount: 0, figureCount: 0 };
    const issues = buildPageIssues(input, page);
    const score = clampScore(
      100 - issues.reduce((sum, issue) => sum + issueScore(issue.severity), 0)
    );

    return {
      page,
      tagged: roleStats.roleCount > 0,
      score,
      grade: gradeFromScore(score),
      structure_role_count: roleStats.roleCount,
      heading_count: roleStats.headingCount,
      figure_count: roleStats.figureCount,
      image_count: pageImages(input.elements, page).length,
      link_count: pageAnnotations(input.annotations, page).filter((annotation) => annotation.url)
        .length,
      form_field_count: pageFields(input.formFields, page).length,
      issues,
    };
  });

  const issues = [...documentIssues, ...pageReports.flatMap((pageReport) => pageReport.issues)];
  const score = clampScore(
    100 - issues.reduce((sum, issue) => sum + issueScore(issue.severity), 0)
  );
  const highIssueCount = issues.filter((issue) => issue.severity === 'high').length;
  const mediumIssueCount = issues.filter((issue) => issue.severity === 'medium').length;
  const lowIssueCount = issues.filter((issue) => issue.severity === 'low').length;
  const taggedPageCount = pageReports.filter((pageReport) => pageReport.tagged).length;

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
      heading_count: pageReports.reduce((sum, pageReport) => sum + pageReport.heading_count, 0),
      figure_count: pageReports.reduce((sum, pageReport) => sum + pageReport.figure_count, 0),
      image_count: pageReports.reduce((sum, pageReport) => sum + pageReport.image_count, 0),
      link_count: pageReports.reduce((sum, pageReport) => sum + pageReport.link_count, 0),
      form_field_count: pageReports.reduce(
        (sum, pageReport) => sum + pageReport.form_field_count,
        0
      ),
      issue_count: issues.length,
      high_issue_count: highIssueCount,
      medium_issue_count: mediumIssueCount,
      low_issue_count: lowIssueCount,
    },
    page_reports: pageReports,
    issues,
    guidance: buildGuidance(issues),
  };
};
