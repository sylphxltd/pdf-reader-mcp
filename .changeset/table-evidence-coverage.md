---
"@sylphx/pdf-reader-mcp": minor
---

Add table cell evidence coverage metrics, inferred-cell ratios, and incomplete
geometry warnings so agents can route weak table evidence to visual
verification. Add OCR-derived table extraction from normalized OCR word boxes
for scanned pages. Add caption-derived visual enrichment candidates so
`read_pdf` can route vector-drawn formulas, charts, figures, and diagrams to
the configured visual-region provider even when the PDF does not expose image
objects, and preserve those candidate regions in `read_pdf` and
`document_map` when the optional provider is unavailable so agents can still
crop or retry the same evidence regions. Add dedicated hidden-text trust
routing for selectable text with zero
or near-zero geometry. Replace the empty generated API reference with a
maintained MCP API reference and remove unused TypeDoc docs tooling. Add
direction-aware selectable-text ordering for right-to-left text runs and expose
text-layer font, direction, transform, and end-of-line metadata coverage in the
text layer and agent document map summaries. Add selected-page-scoped
trust-report summary breakdowns for signal types, safety finding types, and
page-risk counts, redacted trust-evidence snippets for common sensitive values,
plus more specific routing guidance for overlapping, tiny, and off-page text.
Add accessibility report summary breakdowns for issue types, severity buckets,
document-vs-page issue totals, page-grade buckets, and affected-page counts so
agents can route tagged-PDF accessibility risks without scanning every raw
issue first.
Link accessibility report routing into the agent document map when both
features are requested, including page report indexes, issue indexes, issue
counts, affected-page routing arrays, and grade summaries without forcing raw
structure-tree output.
Link trust report routing into the agent document map when both features are
requested, including page report indexes, signal indexes, risk, score, signal
counts, high-signal routing, high/medium-risk routing arrays, and trust summary
counts without forcing raw safety, layout, annotation, or table outputs.
Add provider health metadata to optional OCR and visual-region provider status,
including unavailable routing for built-in OCR presets when their executable is
not installed. Extend the installed-provider benchmark so skipped providers
still emit machine-readable certification profiles with skipped capabilities
and safe provider-status metadata.
Extend the deterministic quality benchmark JSON with a machine-readable SOTA
final-bar coverage matrix that maps each capability area to benchmark scenarios
and marks areas that still require installed-provider benchmark evidence.
Extend the installed-provider benchmark JSON with a machine-readable final-bar
provider evidence matrix that maps OCR and visual certification profiles to the
capability areas they can certify when local providers are installed.
Add shared benchmark artifact output support so performance, deterministic
quality, and installed-provider reports can be written as profile-named JSON
files for release evidence.
Add a SOTA release gate over benchmark artifacts so release review fails until
deterministic final-bar coverage and installed-provider final-bar evidence are
both complete.
Add a package smoke gate and release preflight so the packed package must
include the executable runtime artifact and matching package contract before
publishing.
Add provider benchmark quality metrics with thresholds, scores, expected
evidence, and observed evidence for OCR and visual full-fidelity certification
profiles.
Link page-edge table continuation candidates when adjacent pages keep matching
column geometry without repeating the header row.
Add a deterministic reference visual-region provider for release certification
fixtures and run the strict release-evidence gate in CI without publishing, so
provider evidence regressions are caught before the release workflow.
