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
- Signals for content safety, layout uncertainty, sparse/scanned pages, table
  quality warnings, and external links.
- Guidance for routing to OCR, page rendering, region crops, or caller approval
  before following links.

The trust report can compute required internal safety, layout, table, and
annotation evidence without forcing top-level `safety_findings`,
`layout_diagnostics`, `annotations`, `elements`, or `tables` into the response.

## Signal Sources

- `PdfSafetyFinding` for prompt-injection patterns, tiny text, and off-page
  text.
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
- External links become trust signals without fetching the link.
- Sparse or low-confidence layout diagnostics become routing signals.
- Table quality warnings become table trust signals.
- Handler tests verify top-level raw outputs stay hidden unless requested.
