# Progress

## Status: In Development

## Completed
- [x] Core MCP `read_pdf` tool
- [x] Local path and URL sources
- [x] Metadata, page count, text, image, and table extraction
- [x] Filesystem and HTTP access restrictions
- [x] Structured element output via `include_elements`
- [x] Deterministic semantic hints via `include_semantic_hints`
- [x] Page-aware Markdown rendering via `include_markdown`
- [x] Escaped page-aware HTML rendering via `include_html`
- [x] Citation-ready page, semantic, size, and table chunks via `include_chunks`
- [x] Table and table-cell geometry for structured table output
- [x] Column-aware ordering for common multi-column layouts
- [x] Outline, annotation, structure tree, page label, permission, form field, attachment metadata, and page geometry outputs
- [x] Deterministic content safety findings via `include_safety_findings`
- [x] Quality evals for semantic chunks, table ordering, renderers, and safety findings
- [x] Changesets-based release PR workflow
- [x] Agent Document Twin outputs with text layer, semantic AST, document map, trust report, and accessibility report
- [x] Scanned-PDF OCR pipeline routing with Tesseract text and TSV word-box presets
- [x] OCR-derived table extraction with word-box provenance
- [x] Local visual-region analysis providers over command, HTTP, Ollama `/api/generate`, OpenAI-compatible chat completions, LM Studio, and llama.cpp presets
- [x] Formula, chart, figure, image-description, and table evidence normalization from visual-region providers
- [x] Deterministic quality, corpus, provider, package smoke, and SOTA release-gate evidence
- [x] External corpus manifest support for operator-supplied real PDF benchmark evidence
- [x] External corpus URL support with SHA256 verification, explicit download opt-in, private-host protection, cache reuse, and artifact provenance
- [x] Checked-in public URL corpus manifest with official and publicly available PDF sources, source metadata, pinned SHA256 values, capability tags, capability-summary artifacts, and package-smoke coverage
- [x] Opt-in public provider accuracy manifest with official and publicly available PDF crop regions, source metadata, pinned SHA256 values, capability tags, capability-summary artifacts, and required package-smoke coverage gates
- [x] Package-smoke manifest contract checks for public corpus expected assertions/read options and public provider region bbox/expected-kind/normalized-confidence/text evidence
- [x] Expanded checked-in public corpus/provider manifests with CDC statistical chart evidence and arXiv public research-paper figure, formula, and table crops
- [x] Public provider-manifest crop benchmark that verifies downloadable, checksum-pinned PDF regions can render and crop without requiring a visual provider or local model
- [x] Deterministic provider-manifest crop release artifact enforced by the SOTA release gate without requiring network access, OCR, a visual provider, or a local model
- [x] Deterministic provider-manifest scoring release artifact enforced by the SOTA release gate for local table, formula, chart, figure, image, confidence, text, crop-provenance, and capability-summary evidence
- [x] Configurable trust-report evidence redaction policies with standard, strict, and explicit off modes

## In Progress
- [ ] Publish the PDF Intelligence vNext release through the Changesets version PR flow
- [ ] Further broaden shared public scanned-PDF and visual-region provider accuracy manifests with additional independently licensed PDFs

## Planned
- [ ] Optional advanced parser engine adapters
- [ ] Large-file streaming beyond the current 100MB cap
