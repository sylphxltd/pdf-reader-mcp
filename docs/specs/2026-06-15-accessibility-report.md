# Accessibility Report

Date: 2026-06-15
Status: implemented

## Goal

Give agents one deterministic accessibility-oriented report for PDFs before
they rely on tagged structure, headings, images, forms, links, or copy-based
accessibility workflows.

This is not a PDF/UA certification engine. It is a local routing and evidence
report derived from parser-exposed structure and already extracted document
signals.

## Non-goals

- Do not claim PDF/UA compliance.
- Do not generate or repair tags.
- Do not perform visual alt-text generation.
- Do not require OCR, cloud services, Python, Java, or heavyweight model
  dependencies.
- Do not force raw `permissions`, `mark_info`, `annotations`, `form_fields`, or
  `structure_trees` into the top-level `read_pdf` response.

## Public API

`read_pdf` accepts:

```json
{
  "sources": [{ "path": "document.pdf", "pages": "1-5" }],
  "include_accessibility_report": true,
  "include_full_text": false
}
```

The response includes `accessibility_report`:

```json
{
  "version": "2026-06-15",
  "profile": "pdf_accessibility_report",
  "score": 100,
  "grade": "good",
  "tagged": true,
  "suspected_tagging_issues": false,
  "summary": {
    "selected_pages": [1],
    "page_count": 1,
    "tagged_page_count": 1,
    "untagged_page_count": 0,
    "structure_role_count": 3,
    "heading_count": 1,
    "figure_count": 0,
    "image_count": 0,
    "link_count": 0,
    "form_field_count": 0,
    "issue_count": 0,
    "high_issue_count": 0,
    "medium_issue_count": 0,
    "low_issue_count": 0
  },
  "page_reports": [],
  "issues": [],
  "guidance": []
}
```

## Signal Sources

The report may use these internal inputs:

- PDF mark info (`Marked`, `Suspects`) and permissions.
- Page structure trees from PDF.js `getStructTree`.
- Link annotations from PDF.js `getAnnotations`.
- Form fields from PDF.js `getFieldObjects`.
- Structured image elements from the existing document element model.
- Outline entries when checking heading-role coverage.

## Issues

The report emits structured issues:

- `mark_info_missing`
- `untagged_pdf`
- `suspect_tags`
- `structure_tree_missing`
- `untagged_page`
- `heading_structure`
- `image_alt_text`
- `form_field_label`
- `link_label`
- `accessibility_permission`

Each issue carries severity, message, optional page, and optional evidence.

## Scoring

Scores start at 100 and subtract:

- High issue: 35
- Medium issue: 18
- Low issue: 8

Scores are clamped to 0-100.

Grades:

- `good`: 85-100
- `partial`: 60-84
- `weak`: 0-59

## Acceptance Criteria

- `include_accessibility_report` validates as an optional boolean.
- Report generation is deterministic and TypeScript-only.
- Report output is emitted without forcing raw permissions, mark info,
  annotations, form fields, or structure trees into top-level JSON.
- Unit tests cover document, page, image, form, link, permission, and mark-info
  signals.
- Handler integration tests cover the public flag and response-shape isolation.
- Quality evals include a tagged structure case that must score `good`.
