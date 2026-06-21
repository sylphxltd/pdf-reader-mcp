# API Reference

PDF Reader MCP exposes an MCP server contract. The package entrypoint starts the
server; it is not an importable TypeScript SDK. Agents and clients should call
the MCP tools below over stdio or the optional HTTP transport.

## Transports

| Setting | Description | Default |
| --- | --- | --- |
| `MCP_TRANSPORT` | `stdio` or `http` | `stdio` |
| `MCP_HTTP_HOST` | HTTP bind host when `MCP_TRANSPORT=http` | `0.0.0.0` |
| `MCP_HTTP_PORT` | HTTP port when `MCP_TRANSPORT=http` | `8080` |
| `MCP_API_KEY` | Optional HTTP `X-API-Key` authentication | unset |
| `MCP_CORS_ORIGIN` | Optional explicit CORS origin | unset |

## Tools

| Tool | Purpose |
| --- | --- |
| `inspect_pdf` | Classify a PDF, sample pages, and recommend the extraction route before doing expensive work. |
| `read_pdf` | Extract text, metadata, structure, tables, chunks, safety signals, accessibility signals, OCR evidence, and visual enrichments. |
| `search_pdf` | Search selectable text and OCR text with snippets, page numbers, and bounding-box provenance. |
| `render_page` | Render selected pages as PNG visual evidence with bounded pixel budgets. |
| `extract_regions` | Crop bounded regions from rendered pages and return focused image evidence. |
| `analyze_regions` | Send cropped visual regions to a configured local command or HTTP provider and normalize table, formula, chart, figure, or image-description evidence. |
| `ocr_pages` | Render selected pages and send them to a configured local OCR provider. |

## Source Object

Most tools accept one source at a time. `read_pdf` also accepts `sources` for
batch extraction.

```json
{
  "path": "/absolute/path/to/file.pdf"
}
```

```json
{
  "url": "https://example.com/file.pdf"
}
```

Use exactly one of `path` or `url`. URL loading is guarded by the HTTP, host,
private-IP, and size policies documented in the guide.

## `read_pdf`

`read_pdf` is the primary Agent Document Twin entrypoint.

| Option | Type | Default | Output |
| --- | --- | --- | --- |
| `pages` | number array or range string | all pages when full text is requested | Page selection. |
| `include_full_text` | boolean | `false` | Concatenated text. |
| `include_page_texts` | boolean | `false` | Per-page text. |
| `include_metadata` | boolean | `true` | PDF metadata. |
| `include_page_count` | boolean | `true` | Total page count. |
| `include_images` | boolean | `false` | Embedded image metadata and base64 payloads. |
| `include_tables` | boolean | `false` | Selectable-text and OCR-derived tables with rows, cells, geometry, confidence, provenance, quality signals, and continuation hints. |
| `include_elements` | boolean | `false` | Structured text, image, and table elements. |
| `include_markdown` | boolean | `false` | Markdown rendering. |
| `include_html` | boolean | `false` | HTML rendering. |
| `include_chunks` | boolean | `false` | Citation-ready chunks. |
| `include_text_layer` | boolean | `false` | Direction-aware run, line, word, and character evidence with metadata coverage counts. |
| `include_layout_diagnostics` | boolean | `false` | Reading-order and page-layout confidence. |
| `include_document_map` | boolean | `false` | Page, element, chunk, OCR, visual candidate, visual enrichment, safety, trust signal-index, accessibility issue-index, and routing map. |
| `include_document_ast` | boolean | `false` | Semantic AST for page, section, paragraph, list, caption, header, footer, table, image, chart, formula, and figure nodes, including numbered/appendix headings and above/below/side caption evidence links. |
| `include_safety_findings` | boolean | `false` | Prompt-injection, hidden or near-invisible text geometry, and visual-spoofing findings. |
| `include_trust_report` | boolean | `false` | Consolidated risk report with page-level signals, category counts, page-risk counts, routing guidance, and optional document-map trust signal routing. |
| `trust_report_redaction` | `"standard" \| "strict" \| "off"` | `"standard"` | Redaction policy for trust-report evidence snippets. `standard` redacts common secrets and personal identifiers, `strict` also redacts phone-like values and IPv4 addresses, and `off` preserves snippets while marking the policy explicitly. |
| `include_accessibility_report` | boolean | `false` | Tagged-PDF, image-alt, form, permission, tag-visible coverage, issue-summary, page-grade routing, and optional document-map issue-index signals. |
| `include_ocr_text_layer` | boolean | `false` | OCR page text and PDF-coordinate word boxes from a configured OCR provider. OCR word boxes can also feed table extraction when `include_tables` is enabled. |
| `include_visual_enrichments` | boolean | `false` | Bbox-grounded visual-region candidates plus provider-normalized table/image and caption-derived visual region evidence, including side-caption candidates, when a provider is configured. |

## Table Quality

When `include_tables` is enabled, each table may include `quality`:

| Field | Meaning |
| --- | --- |
| `completeness` | Combined non-empty-cell and row-alignment score. |
| `nonEmptyCellRatio` | Ratio of cells with text. |
| `cellBoundingBoxCoverage` | Ratio of cells with bounding boxes. |
| `inferredCellRatio` | Ratio of cells inferred by the table grid model. |
| `rowAlignment` | Alignment score against detected column boundaries. |
| `rowSpacingConsistency` | Consistency of row spacing. |
| `cellBoundingBoxCount` | Number of cells with bounding boxes. |
| `inferredCellCount` | Number of inferred cells. |
| `missingCellCount` | Number of empty cells. |
| `mergedCellCandidateCount` | Number of cells with inferred spans. |
| `signals` | Machine-readable quality signals such as `complete_grid`, `missing_cells`, `merged_cell_candidates`, `incomplete_cell_geometry`, `irregular_row_spacing`, `multi_page_continuation_candidate`, and `low_confidence`. |
| `warnings` | Human-readable routing guidance for weak table evidence. |

Tables also include `provenance.source`. `selectable_text` means the table came
from PDF text coordinates. `ocr_text_layer` means it came from OCR word boxes
linked through `ocr_source_render_evidence_id`. OCR-derived tables are merged by
bounding-box overlap, so duplicate OCR evidence is suppressed while distinct
scanned tables on a mixed page are retained.

Agents should use `incomplete_cell_geometry`, sparse-cell, merged-cell,
irregular-spacing, and low-confidence warnings as a cue to request
`extract_regions`, `render_page`, or configured visual-region analysis before
making cell-level claims.

## Provider Adapters

The server does not bundle OCR, formula, chart, or vision models. It provides
stable local adapters so deployments can choose their own engines.

When `include_visual_enrichments` is enabled without a configured visual
provider, `read_pdf` still returns `visual_enrichment_candidates`. These records
contain stable region IDs, PDF-coordinate boxes, target types, caption evidence,
and routing signals for follow-up `extract_regions` or `analyze_regions` calls.

| Capability | Configuration |
| --- | --- |
| OCR command provider | `MCP_PDF_OCR_COMMAND`, `MCP_PDF_OCR_ARGS_JSON`, `MCP_PDF_OCR_TIMEOUT_MS`, `MCP_PDF_OCR_MAX_OUTPUT_CHARS` |
| OCR preset | `MCP_PDF_OCR_PRESET=tesseract` or `tesseract-tsv` |
| Visual-region command provider | `MCP_PDF_REGION_ANALYSIS_COMMAND`, `MCP_PDF_REGION_ANALYSIS_ARGS_JSON`, `MCP_PDF_REGION_ANALYSIS_TIMEOUT_MS`, `MCP_PDF_REGION_ANALYSIS_MAX_OUTPUT_CHARS` |
| Visual-region HTTP provider | `MCP_PDF_REGION_ANALYSIS_HTTP_URL`, optional `MCP_PDF_REGION_ANALYSIS_HTTP_HEADERS_JSON` |
| Visual-region Ollama preset | `MCP_PDF_REGION_ANALYSIS_PRESET=ollama`, `MCP_PDF_REGION_ANALYSIS_OLLAMA_MODEL`, optional `MCP_PDF_REGION_ANALYSIS_OLLAMA_URL` |
| Visual-region OpenAI-compatible preset | `MCP_PDF_REGION_ANALYSIS_PRESET=openai-compatible`, `MCP_PDF_REGION_ANALYSIS_OPENAI_MODEL`, `MCP_PDF_REGION_ANALYSIS_OPENAI_URL`, optional `MCP_PDF_REGION_ANALYSIS_OPENAI_API_KEY` |
| Visual-region LM Studio preset | `MCP_PDF_REGION_ANALYSIS_PRESET=lmstudio`, `MCP_PDF_REGION_ANALYSIS_LMSTUDIO_MODEL`, optional `MCP_PDF_REGION_ANALYSIS_LMSTUDIO_URL` |
| Visual-region llama.cpp preset | `MCP_PDF_REGION_ANALYSIS_PRESET=llamacpp`, `MCP_PDF_REGION_ANALYSIS_LLAMACPP_MODEL`, optional `MCP_PDF_REGION_ANALYSIS_LLAMACPP_URL` |

Provider responses are normalized into the same evidence model used by
`read_pdf`, `analyze_regions`, and the benchmark harness.

## Quality Gates

Use these commands before publishing:

```bash
bun run check
bun run typecheck
bun run test:cov
bun run build
bun run package:smoke
bun run docs:build
bun run benchmark:quality
bun run benchmark:providers
MCP_PDF_BENCHMARK_OUTPUT_DIR=./benchmark-artifacts bun run benchmark:all
MCP_PDF_BENCHMARK_OUTPUT_DIR=./benchmark-artifacts bun run benchmark:release-gate
bun run release:preflight
```

Set `MCP_PDF_BENCHMARK_OUTPUT_DIR` to persist benchmark JSON artifacts for
release review:

```bash
MCP_PDF_BENCHMARK_OUTPUT_DIR=./benchmark-artifacts bun run benchmark:all
```

`benchmark:release-gate` reads those artifacts and fails until deterministic
final-bar coverage, mandatory corpus archetype evidence, and
installed-provider final-bar evidence are complete.
`package:smoke` packs the package locally and verifies that the tarball contains
the executable `dist/index.js` runtime artifact with matching `bin` and
`exports` metadata.
`release:preflight` runs the full publish gate and requires strict installed
provider certification before publishing can proceed.

The repository release workflow installs Tesseract for the `tesseract-tsv` OCR
profile and configures `scripts/reference-region-analysis-provider.mjs` for the
visual `visual-full-fidelity` fixture profile before running strict benchmark
artifacts and the release gate. The reference visual provider is a deterministic
contract-certification adapter, not a bundled general-purpose vision model.
The CI workflow runs the same strict benchmark artifact and release-gate path as
a non-publishing evidence job, so pull requests can fail before release if OCR
or visual-provider certification evidence regresses.

`benchmark:providers` reports skipped providers when local engines are not
installed. Configure OCR or visual-region adapters to certify installed-provider
capabilities. Its JSON report also emits
per-provider `quality` metrics, `final_bar_provider_evidence_summary`, and
`final_bar_provider_evidence`, mapping provider certification profiles to the
SOTA final-bar capabilities that require installed-provider evidence.

`benchmark:corpus` emits `pdf_corpus_benchmark.json`, covering the checked-in
sample PDF plus runtime-generated reading-order, scanned-OCR routing, and
OCR-derived table archetypes. Each case carries `capability_tags`, and the
artifact emits `capability_summary` so reviewers can inspect evidence by
document-intelligence area. The release gate requires all corpus archetypes,
checked-in and runtime-generated fixture diversity, case-level capability tags,
required capability-summary coverage, and passing per-case assertions. It can
also include operator-supplied real PDFs through
`--corpus-manifest` or `MCP_PDF_CORPUS_MANIFEST`; those external cases are
reported in the same artifact but are not required by the deterministic CI
release gate. Manifest cases may reference local `path` files or public `url`
files. URL cases require `sha256`, use a content-addressed cache, and download
only when `--allow-corpus-downloads` or `MCP_PDF_CORPUS_ALLOW_DOWNLOADS=true`
is set. Private, loopback, and link-local URL hosts are blocked by default and
only allowed with the existing `--allow-private-ips` /
`MCP_PDF_ALLOW_PRIVATE_IPS=true` development override. The published package
includes `corpus/public-url-corpus.json`, an opt-in manifest of official and
publicly available PDFs with source metadata, pinned SHA256 values, and
required capability tags. The package smoke gate verifies that the published
tarball keeps the public corpus and provider capability coverage manifests.

`benchmark:provider-manifest` emits `pdf_provider_manifest_benchmark.json`
when `--provider-manifest` or `MCP_PDF_PROVIDER_MANIFEST` points at a provider
accuracy manifest. It crops the declared regions through the same renderer and
provider-normalization path as `analyze_regions`, then scores kind, text,
confidence, structured table/formula/chart evidence, and crop provenance
against the manifest expectations. Case and region `capability_tags` flow into
the artifact-level `capability_summary`, so release reviewers can see which
public visual capabilities the manifest exercises instead of reading only a
single aggregate score. URL cases require `sha256`, use the same
content-addressed cache, and download only when
`--allow-provider-manifest-downloads` or
`MCP_PDF_PROVIDER_MANIFEST_ALLOW_DOWNLOADS=true` is set. The published package
includes `corpus/public-provider-accuracy.json`, an opt-in manifest of public
PDF crop regions with source metadata, pinned SHA256 values, and required
case/region capability tags.

`benchmark:provider-manifest-crops` emits
`pdf_provider_manifest_crop_benchmark.json` for the same manifest shape without
requiring a visual-region provider. It downloads and checksum-validates opt-in
URL cases when enabled, renders the declared pages, verifies each region crop,
and records crop byte length, pixel bounds, render provenance, source metadata,
and capability summaries. Use it when release evidence needs to prove the
public PDF crop substrate before provider/model accuracy is evaluated.

`benchmark:quality` also emits `final_bar_coverage_summary` and
`final_bar_coverage` so release reviewers can see which SOTA final-bar
capabilities are covered by deterministic fixtures and which still require
installed-provider benchmark evidence.
