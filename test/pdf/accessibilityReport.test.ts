import { describe, expect, it } from 'vitest';
import { buildAccessibilityReport } from '../../src/pdf/accessibilityReport.js';
import type {
  PdfDocumentElement,
  PdfFormField,
  PdfPageAnnotations,
  PdfPageStructureTree,
} from '../../src/types/pdf.js';

describe('accessibilityReport', () => {
  it('consolidates tagged structure, image, form, link, permission, and mark-info signals', () => {
    const elements: PdfDocumentElement[] = [
      {
        id: 'p1-image-1',
        type: 'image',
        page: 1,
        image: {
          page: 1,
          index: 0,
          width: 320,
          height: 180,
          format: 'png',
        },
        provenance: {
          engine: 'pdfjs',
          source: 'image-xobject',
        },
      },
      {
        id: 'p1-image-2',
        type: 'image',
        page: 1,
        image: {
          page: 1,
          index: 1,
          width: 64,
          height: 64,
          format: 'png',
        },
        provenance: {
          engine: 'pdfjs',
          source: 'image-xobject',
        },
      },
    ];
    const structureTrees: PdfPageStructureTree[] = [
      {
        page: 1,
        tree: {
          role: 'Document',
          children: [{ role: 'H1' }, { role: 'P' }, { role: 'Figure' }],
        },
      },
    ];
    const annotations: PdfPageAnnotations[] = [
      {
        page: 1,
        annotations: [{ id: 'link-1', page: 1, subtype: 'Link', url: 'https://example.com' }],
      },
    ];
    const formFields: PdfFormField[] = [
      { id: 'field-1', name: 'field1', page: 1, type: 'Tx', required: true },
    ];

    const report = buildAccessibilityReport({
      selectedPages: [2, 1],
      elements,
      structureTrees,
      annotations,
      formFields,
      permissions: ['print', 'copy'],
      markInfo: { Marked: false, Suspects: true },
      outline: [{ title: 'Executive Summary' }],
    });

    expect(report).toMatchObject({
      version: '2026-06-15',
      profile: 'pdf_accessibility_report',
      grade: 'weak',
      tagged: true,
      suspected_tagging_issues: true,
      summary: {
        selected_pages: [1, 2],
        page_count: 2,
        tagged_page_count: 1,
        untagged_page_count: 1,
        structure_role_count: 4,
        structure_content_count: 0,
        structure_content_id_count: 0,
        visible_element_count: 2,
        average_tag_content_coverage: 0,
        heading_count: 1,
        figure_count: 1,
        image_count: 2,
        link_count: 1,
        form_field_count: 1,
        issue_count: 8,
        document_issue_count: 3,
        page_issue_count: 5,
        high_issue_count: 3,
        medium_issue_count: 4,
        low_issue_count: 1,
        issue_severity_counts: {
          high: 3,
          medium: 4,
          low: 1,
        },
        issue_type_counts: {
          mark_info_missing: 0,
          untagged_pdf: 1,
          suspect_tags: 1,
          structure_tree_missing: 0,
          untagged_page: 1,
          heading_structure: 0,
          tagged_content_mismatch: 1,
          image_alt_text: 1,
          form_field_label: 1,
          link_label: 1,
          accessibility_permission: 1,
        },
        page_grade_counts: {
          good: 0,
          partial: 1,
          weak: 1,
        },
        pages_with_issues_count: 2,
        pages_with_high_issues_count: 0,
        pages_with_medium_issues_count: 2,
        pages_with_low_issues_count: 1,
      },
    });
    expect(report.issues.map((issue) => issue.type)).toEqual([
      'untagged_pdf',
      'suspect_tags',
      'accessibility_permission',
      'tagged_content_mismatch',
      'image_alt_text',
      'form_field_label',
      'link_label',
      'untagged_page',
    ]);
    expect(report.page_reports[0]).toMatchObject({
      page: 1,
      tagged: true,
      structure_content_count: 0,
      visible_element_count: 2,
      tag_content_coverage: 0,
      heading_count: 1,
      figure_count: 1,
      image_count: 2,
      link_count: 1,
      form_field_count: 1,
      issue_count: 4,
      high_issue_count: 0,
      medium_issue_count: 3,
      low_issue_count: 1,
      issue_type_counts: expect.objectContaining({
        tagged_content_mismatch: 1,
        image_alt_text: 1,
        form_field_label: 1,
        link_label: 1,
      }),
    });
    expect(report.page_reports[1]).toMatchObject({
      page: 2,
      tagged: false,
      grade: 'partial',
      issue_count: 1,
      medium_issue_count: 1,
      issues: [expect.objectContaining({ type: 'untagged_page', severity: 'medium' })],
    });
    expect(report.guidance).toEqual(
      expect.arrayContaining([
        expect.stringContaining('tagged structure evidence'),
        expect.stringContaining('source documents to verify image meaning'),
        expect.stringContaining('form field labels'),
      ])
    );
  });
});
