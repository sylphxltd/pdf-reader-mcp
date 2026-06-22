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
Add `trust_report_redaction` so callers can keep the default standard evidence
redaction, opt into stricter phone/IP redaction, or explicitly preserve snippets
for controlled local debugging while the selected policy is recorded in the
trust report.
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
deterministic final-bar coverage, corpus evidence, and installed-provider
final-bar evidence are complete.
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
Make the release artifact script respect `MCP_PDF_BENCHMARK_OUTPUT_DIR` while
preserving `benchmark-artifacts` as the default output directory.
Add multi-caption and multi-target visual-layout fixture coverage for
independent formula, chart, figure, and side-caption routing.
Expand the installed-provider benchmark to score multiple runtime OCR fixtures
and 10 visual-region certification fixtures across core and diverse visual
profiles, with fixture-level expected and observed evidence in the provider
quality report.
Add a corpus benchmark artifact over checked-in and runtime-generated PDF
archetypes, then require that corpus evidence in the SOTA release gate.
Add an Ollama visual-region provider preset that sends crop images to the local
`/api/generate` endpoint with JSON-only output and normalizes the returned
evidence through the existing table/formula/chart/figure contract.
Add an OpenAI-compatible visual-region provider preset that sends crop images as
chat-completions `image_url` data URLs, supports optional bearer auth, and
normalizes returned message content through the same evidence contract.
Add LM Studio and llama.cpp visual-region provider presets that reuse the
chat-completions crop data URL contract with local default endpoints, explicit
model env vars, and deterministic benchmark coverage.
Add external corpus manifest support to `benchmark:corpus` so teams can include
operator-supplied real PDFs in the same corpus artifact without making release
CI depend on bundled external files or network downloads.
Add opt-in public URL support for external corpus manifests with required
SHA256 validation, reusable cache paths, and artifact provenance for URL,
checksum, and download/cache status. Private, loopback, and link-local URL
hosts are blocked by default unless the existing private-IP development
override is enabled.
Add a checked-in public URL corpus manifest with official and publicly available
PDF sources, pinned SHA256 values, source metadata, and package smoke coverage
so users can reproduce real-world corpus artifacts without vendoring PDF bytes.
The corpus benchmark now carries case-level capability tags and an
artifact-level capability summary, and the package smoke gate verifies required
public corpus capability coverage in the packed package. The SOTA release gate
also verifies that corpus cases keep capability tags and that the corpus
capability summary covers required release areas without failing tags.
Add an opt-in public provider accuracy benchmark manifest and
`benchmark:provider-manifest` script so configured visual-region providers can
be scored against public PDF crops with pinned source metadata and checksums.
The provider manifest artifact now carries capability tags and a
capability-level summary so public proof can be reviewed by capability area,
not only by aggregate score. The package smoke gate also verifies required
public provider capability coverage in the packed package.
Strengthen package smoke for public evidence manifests so published corpus
cases must keep expected text/page/text-volume assertions and document-map/text
layer read options, while published provider regions must keep positive-area
bounding boxes, expected text terms, and normalized minimum confidence
thresholds.
Expand the checked-in public corpus and provider manifests with CDC statistical
chart evidence plus public arXiv research-paper figure, formula, and table
crops. The package smoke gate now also requires provider-region expected-kind
coverage for chart, diagram, figure, formula, image, and table evidence so the
published package cannot regress to a narrow visual manifest.
Add `benchmark:provider-manifest-crops` so the same public provider manifest can
first prove URL download, SHA256 validation, page rendering, declared crop
geometry, crop byte evidence, render provenance, and capability summaries
without requiring a visual-region provider or local model.
The strict release artifact path now also writes a deterministic
provider-manifest crop artifact over a local fixture manifest, and the SOTA
release gate requires that artifact before publishing evidence can pass.
Add deterministic provider-manifest scoring release evidence over local table,
formula, chart, figure, and image regions. The SOTA release gate now requires
that `pdf_provider_manifest_benchmark.json` prove visual-kind coverage,
kind-specific assertions, crop provenance, and capability-summary coverage
before publishing evidence can pass.
