# Trust Report V3

Date: 2026-06-15
Status: shipped

## Goal

Give agents one local routing report before using PDF content as instructions,
evidence, or retrieval context. The report should consolidate signals that were
previously scattered across safety findings, layout diagnostics, tables, and
annotations.

## Contract

`include_trust_report` returns `trust_report` with:

- `profile: "pdf_trust_report"` and version `2026-06-15`.
- Document-level `risk` and bounded score.
- Page-level reports with risk, score, and signals.
- Selected-page-scoped summary counters for signal types, safety finding types,
  severities, pages with signals, and page-risk buckets.
- Redacted evidence snippets for common sensitive values such as emails, SSNs,
  payment cards, secret assignments, JWTs, and private-key markers.
- Signals for content safety, hidden or near-invisible text, layout
  uncertainty, sparse/scanned pages, table quality warnings, external links,
  and unsafe link schemes.
- Guidance for routing to OCR, page rendering, region crops, or caller approval
  before following links.

The trust report can compute required internal safety, layout, table, and
annotation evidence without forcing top-level `safety_findings`,
`layout_diagnostics`, `annotations`, `elements`, or `tables` into the response.

## Signal Sources

- `PdfSafetyFinding` for prompt-injection patterns, hidden or near-invisible
  text geometry, tiny text, off-page text, and overlapping text that may
  visually spoof or obscure content.
- `PdfPageLayoutDiagnostics` for low reading-order confidence and sparse pages.
- Table element quality metadata for sparse, merged, low-confidence, or
  continuation-candidate tables.
- Annotation summaries for external links and unsafe URL schemes.

## Boundaries

The trust report is deterministic routing metadata. It is not a malware scan,
not a policy engine, and not a guarantee that a PDF is safe. It tells agents
when local extraction should be treated as lower-trust and when visual/OCR/crop
verification or explicit caller approval is appropriate.

## Acceptance Criteria

- `include_trust_report` works without raw safety, layout, annotation, or table
  output flags.
- Prompt-injection findings become high-severity trust signals.
- Hidden or near-invisible text findings become high-severity trust signals
  with page rendering or crop-verification guidance.
- Overlapping text findings add visual-spoofing verification guidance.
- Tiny or off-page text findings add hidden-content/extraction-noise review
  guidance.
- Summary counters expose selected-page-scoped signal-type,
  safety-finding-type, and page-risk breakdowns.
- Trust-report evidence snippets redact common sensitive values and expose
  `snippet_redacted` plus `redaction_types` when redaction occurred.
- External links become trust signals without fetching the link.
- Unsafe URL schemes become dedicated high-severity trust signals.
- Sparse or low-confidence layout diagnostics become routing signals.
- Table quality warnings become table trust signals.
- Handler tests verify top-level raw outputs stay hidden unless requested.
