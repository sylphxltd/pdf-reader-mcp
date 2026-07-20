---
layout: doc
title: Why pure Rust + open gaps
---

# Why pure Rust + open gaps

> **Status:** experimental. **Not** a full drop-in for TypeScript 3.0.14.
> Published stable remains `@sylphx/pdf-reader-mcp@3.0.14`.



## The product decision

`@sylphx/pdf-reader-mcp` is a **starred public MCP**. Agents call it thousands of
times. The right end state is not “half TypeScript, half Rust, please wait while
we migrate” — it is **one native engine** with the same public tools and the same
Agent Document Twin fields.

The withdrawn v3.1.x releases did **not** reach that end state. The intended
replacement, once it passes the executable parity and release gates, is:

- **npm**: `@sylphx/pdf-reader-mcp` → ships the native `pdf-reader-mcp-server`
- **crates.io**: `pdf-reader-core`, `pdf-reader-mcp-server`, `pdf-reader-cli`
- **Tools**: `read_pdf`, `search_pdf`, and every `pdf_evidence` success and failure path

## What must not regress

Updating the implementation language must **not** remove public capabilities.
The replacement must reproduce the Document Twin semantics, not merely return
fields with these names. Today many pure-Rust fields are heuristic or empty;
their current status is recorded in the
[capability matrix](../specs/pure-rust-capability-matrix.json).

| Capability group | Fields / operations |
| --- | --- |
| Core text | `full_text`, `markdown`, `html`, `chunks`, `elements`, `text_layer` |
| Structure | `tables`, `document_map`, `document_ast`, `layout_diagnostics` |
| Safety / trust | `safety_findings`, `trust_report`, `accessibility_report` |
| Document signals | `outline`, `annotations`, `form_fields`, `attachments`, `structure_trees`, `page_labels`, `page_geometry`, `permissions` |
| Provider opt-in | `ocr_text_layer` has a bounded command-provider fusion subset; without a provider the field is omitted with an explicit warning, matching TS failure semantics. `visual_enrichments` remains a placeholder. |
| Evidence | `pdf_evidence` `inspect` (routing); visual ops fail closed with guidance when no render/OCR backend is configured |

The following commands exercise only the currently claimed subset. They are
not a drop-in or release-admission proof:

```bash
bun run build:rust
bun test test/production/capabilityParity.contract.test.ts --timeout=600000
bun run check:production-contract
```

## Benchmark method

```bash
bun run build:rust
bun run benchmark:pure-rust -- --iterations 20 --warmup 3 \
  --output benchmark-artifacts/pdf_pure_rust_benchmark.json
```

Scenarios (fixed fixture `test/fixtures/sample.pdf`):

1. `metadata_page_count`
2. `full_text`
3. `agent_document_twin_balanced` (auto)
4. `agent_document_twin_full` (explicit include_*)
5. `search_literal`
6. `inspect`

Each scenario warms up, then records avg / min / max / p50 / p95 over N iterations
against the **production pure-Rust binary**.

Historical TypeScript timings are retained below only as provenance for an old
measurement. They were not collected in the same run, on a digest-bound
semantically equivalent candidate, and therefore cannot establish a speedup:

| Scenario | Historical TS avg |
| --- | --- |
| Metadata + page count | 1.1 ms |
| Full text | 16.1 ms |
| Agent Document Twin | 27.2 ms |

The pure-Rust harness currently writes a `comparison` block, but those ratios
are diagnostic historical comparisons and must not be used as release or
marketing claims.

## Historical diagnostic run (not an A/B benchmark)

Fixture: `test/fixtures/sample.pdf` · iterations=15 · warmup=3 · measuredAt=2026-07-17T23:15:41.531Z

| Scenario | Pure-Rust avg | Pure-Rust p50 | Pure-Rust p95 | Historical TS avg | Speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Metadata + page count | 11.174 ms | 11.665 ms | 13.318 ms | 1.1 ms | 0.10× |
| Full text | 8.041 ms | 5.875 ms | 14.169 ms | 16.1 ms | 2.00× |
| Agent Document Twin (balanced) | 8.227 ms | 6.447 ms | 14.826 ms | 27.2 ms | 3.31× |
| Agent Document Twin (full includes) | 12.916 ms | 12.516 ms | 18.278 ms | — | — |
| search_pdf literal | 0.862 ms | 0.735 ms | 1.573 ms | — | — |
| pdf_evidence inspect | 9.325 ms | 9.158 ms | 13.206 ms | — | — |

No speedup claim is admissible from this table. A release benchmark must run
TS 3.0.14 and the exact Rust candidate on the same host and corpus, verify
semantically equivalent outputs before timing, randomize/interleave samples,
separate cold and warm paths, and retain raw samples plus source, fixture,
binary, toolchain, and environment digests.

Artifact: `benchmark-artifacts/pdf_pure_rust_benchmark.json`.


## Why performance work still matters

- **Agent loops are serial.** Verified latency reductions compound across tool calls.
- **Cold start matters for MCP.** It must be measured separately from warm calls.
- **Ops cost.** A native distribution can simplify deployment only after cross-platform packaging is proven.

## Capability honesty

Pure-Rust text extraction currently uses the selectable text layer. Geometry,
visual evidence, and full Document Twin parity remain open work. Empty
placeholder arrays prove only response shape; they do not prove capability.

Visual `pdf_evidence` operations now have bounded Hayro render/crop plus opt-in
command-provider OCR and region-analysis subsets. `read_pdf` can now select OCR
pages, invoke that bounded command provider, return the normalized parallel OCR
layer, link applied pages into `document_map`, emit OCR MCP text parts, and
project one bounded boxed-word table subset through tables, elements, chunks,
Markdown, HTML, AST, and map. The immutable detached TS 3.0.14 differential
covers these bounded fusion cases. It remains partial: mixed selectable/OCR
table continuation, full AST hierarchy, OCR TSV, region-analysis HTTP/presets,
broader renderer fixtures, and full Document Twin fusion are open. Unavailable
paths fail closed; this is not TS 3.0.14 parity.

## Install

Production: pin `@sylphx/pdf-reader-mcp@3.0.14` (TypeScript).  
See [installation guide](../guide/installation.md). Pure-Rust remains experimental source-only.

### Configured-command visual enrichment fusion (bounded)

A frozen five-case configured-command `read_pdf` visual-enrichment payload and Document Map fusion subset is admitted through the exact-SHA differential harness. It covers direct table fusion, page sort/dedup/invalid + max-one admission, ordered two-caption analyses, fail-closed second-provider failure, and ready/no-candidate zero invocation. `include_visual_enrichments` remains `PARTIAL`; Document AST visual fusion and HTTP/preset providers are unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.

### Document AST visual enrichment fusion (bounded)

A frozen five-case configured-command `read_pdf` visual-enrichment Document AST fusion subset is admitted through the exact-SHA differential harness. Direct table attachment, caption-derived orphan figure/chart nodes, fail-closed provider failure, and ready/no-candidate zero invocation are proven. `include_document_ast` and `include_visual_enrichments` remain `PARTIAL`; `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf include_ocr_text_layer public-stdio fusion (bounded)

A frozen six-case public-stdio `read_pdf` `include_ocr_text_layer` subset is admitted through the exact-SHA differential harness. It covers opt-out, page-1 success with Document Map OCR fields, page-3 multiword boxes, invalid page-selection warning with page-1 OCR retained, provider-failure soft warning without layer, and not-configured soft warning without layer. Leaf-mutation count is frozen at 143 with relocated fixture-root replay. `include_ocr_text_layer` remains `PARTIAL`; tesseract-tsv, text-only fallback, selectable/OCR table continuation, URL single-fetch, first-five-of-six page boundary, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf OCR residual public-stdio subset (bounded)

A frozen three-case public-stdio residual for `read_pdf` `include_ocr_text_layer` is admitted: plain-text provider stdout without words, JSON text-only without words, and default `max_pages` first-five-of-six truncation with exact warning and five applied OCR pages. Leaf-mutation count is frozen at 154 with relocated fixture-root replay. Document Map `needs_ocr_pages` remains layout-derived and is not overwritten by OCR candidates. `include_ocr_text_layer` remains `PARTIAL`; tesseract-tsv, selectable/OCR table continuation, URL single-fetch, mixed interleaving, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf tesseract-tsv public-stdio subset (bounded)

A frozen two-case public-stdio `MCP_PDF_OCR_PRESET=tesseract-tsv` subset is admitted: valid TSV level-5 words with image-to-PDF box conversion, and malformed TSV soft raw fallback with exact warning. Leaf-mutation count is frozen at 66. Real tesseract binary health checks remain unclaimed. `include_ocr_text_layer` remains `PARTIAL`; `dropInFor3014` stays false and publish freeze remains enabled.


### mixed selectable/OCR table merge public-stdio subset (bounded)

A frozen three-case public-stdio mixed selectable/OCR table merge subset is admitted: distinct non-overlapping OCR tables are reindexed after selectable tables, overlapping OCR tables are suppressed at the 0.6 IoU duplicate threshold, and OCR-only pages without selectable tables still project table_info. Leaf-mutation count is frozen at 76. `include_tables` and `include_ocr_text_layer` remain `PARTIAL`; `dropInFor3014` stays false and publish freeze remains enabled.


### OCR-search residual public-stdio subset (bounded)

A frozen four-case public-stdio residual for `search_pdf` `include_ocr_text_layer` is admitted: plain-text OCR fallback without match geometry, JSON text-only without words/geometry, words control with `ocr_word` geometry, and `max_pages` first-five-of-six truncation with exact warning. Leaf-mutation count is frozen at 133. `include_ocr_text_layer` remains `PARTIAL`; selectable/OCR interleaving and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### selectable/OCR search interleaving public-stdio subset (bounded)

A frozen four-case public-stdio selectable/OCR search interleaving subset is admitted: selectable matches append before OCR matches, exact `max_matches` admits one OCR match, a full selectable cap skips OCR without a truncation flag, and unique OCR-only tokens append as sole matches. Leaf-mutation count is frozen at 149. `include_ocr_text_layer` remains `PARTIAL`; `dropInFor3014` stays false and publish freeze remains enabled.


### URL source single-fetch public-stdio subset (bounded)

A frozen two-case public-stdio URL source single-fetch subset is admitted for `read_pdf` over a local fixture HTTP server with `MCP_PDF_ALLOW_PRIVATE_IPS=true`: no-OCR single fetch and OCR-with-document-map single fetch that reuses materialized bytes. Leaf-mutation count is frozen at 16 with relocated fixture-root replay. `url_ssrf` remains `PARTIAL`; `search_pdf` URL+OCR single-fetch (TS double-fetch residual), resolver timeout, TLS-SNI fixtures, public-internet fetch, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.



### search_pdf prefer_speed route (post-3.0.14 surface)

Pure-Rust `search_pdf` now accepts `prefer_speed` and, when OCR is off, matches the current TypeScript speed route: match geometry is omitted, provenance uses `rust-text-index`/`text-content`, and the speed-route warning is emitted. This is a current-surface parity fix, not a frozen detached TS v3.0.14 differential claim. `prefer_speed` remains `PARTIAL` in the capability matrix; `dropInFor3014` stays false and publish freeze remains enabled.


### search_pdf multiword selectable geometry residual (bounded)

A frozen three-case public-stdio `search_pdf` multiword selectable-text geometry residual is admitted over `v3014-behavior-v1.pdf`: start-item multiword box union, mid-line multiword union, and case-insensitive multiword, all at `char_estimated` level with float-normalized boxes. Leaf-mutation count is frozen at 48 with relocated fixture-root replay. `bounding_box` remains `PARTIAL`; glyph-perfect boxes, RTL/vertical writing, OCR fusion, prefer_speed, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf form residual public-stdio subset (bounded)

A frozen two-case public-stdio `read_pdf` `include_form_fields` residual is admitted: radiobutton/pushbutton/signature kinds (signature omits box and editable), and pdf.js-compatible value coercion for numeric text, missing text defaults, bool button checkbox Off, and choice array first-string selection. Leaf-mutation count is frozen at 90 with relocated fixture-root replay. `include_form_fields` remains `PARTIAL`; radio group kids, broader button-array coercion, malformed-field breadth, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf form radio-group residual (bounded)

A frozen two-case public-stdio `read_pdf` `include_form_fields` radio-group residual is admitted: parent stub plus radiobutton kids inheriting `V` (with sibling checkbox control), and a three-option radio group inheriting value `Silver` and default `Bronze`. Leaf-mutation count is frozen at 78 with relocated fixture-root replay. `include_form_fields` remains `PARTIAL`; broader button-array coercion, malformed-field breadth, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf attachment residual public-stdio subset (bounded)

A frozen two-case public-stdio `read_pdf` `include_attachments` residual is admitted: EmbeddedFiles name-tree `Kids` win over sibling `Names`, trailing-slash `UF` becomes `unnamed`, and Windows-path `UF` basenames. Leaf-mutation count is frozen at 17 with relocated fixture-root replay. `include_attachments` remains `PARTIAL`; malformed name-tree breadth, duplicate-kids fail-closed, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf mark_info residual public-stdio subset (bounded)

A frozen three-case public-stdio catalog `mark_info` residual is admitted: non-boolean `Suspects` defaults to false with missing `UserProperties` false, all-true MarkInfo, and empty MarkInfo all-false. Leaf-mutation count is frozen at 30 with relocated fixture-root replay. Catalog surfaces remain `PARTIAL`; permissions encryption, outline beyond behavior, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf form parent/child residual (bounded)

A frozen two-case public-stdio `include_form_fields` parent/child residual is admitted: skip top-level and Kids direct dicts with parent stub plus dotted spaced child name and DV-as-value, and readonly parent `Ff` inheritance making child non-editable. Leaf-mutation count is frozen at 34 with relocated fixture-root replay. `include_form_fields` remains `PARTIAL`; malformed-field breadth, broader button-array coercion, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf annotation residual public-stdio subset (bounded)

A frozen two-case public-stdio `read_pdf` `include_annotations` residual is admitted: FreeText and Link URI keep full `/Rect` boxes including multi-page FreeText, while Text sticky notes claim contents/title only without bounding boxes (pdf.js icon-box geometry remains unclaimed). Leaf-mutation count is frozen at 44 with relocated fixture-root replay. `include_annotations` remains `PARTIAL`; dest-only Link page-ref shape, glyph-perfect boxes, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf annotation dest residual public-stdio subset (bounded)

A frozen two-case public-stdio `read_pdf` `include_annotations` dest residual is admitted: dest-only Link keeps pdf.js page-ref `{num,gen}` plus name token `{name}` for `/Fit` and `/XYZ` coordinate destinations with full `/Rect` boxes. Leaf-mutation count is frozen at 33 with relocated fixture-root replay. `include_annotations` remains `PARTIAL`; named dest string lookup, GoTo action dest, Text icon/box geometry, glyph-perfect boxes, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf annotation action/named dest residual public-stdio subset (bounded)

A frozen two-case public-stdio `read_pdf` `include_annotations` action/named dest residual is admitted: named `/Dest` string is preserved, and GoTo action `/D` is exposed as pdf.js `dest` with page-ref `{num,gen}`, name token `FitH`, and coordinate, with full `/Rect` boxes. Leaf-mutation count is frozen at 29 with relocated fixture-root replay. `include_annotations` remains `PARTIAL`; named dest resolution to array, remote GoToR, URI action beyond url, Text icon/box geometry, glyph-perfect boxes, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf annotation action-precedence residual public-stdio subset (bounded)

A frozen three-case public-stdio `read_pdf` `include_annotations` action-precedence residual is admitted: GoTo action dest wins over explicit `/Dest` (`FitH` + coordinate), URI action exposes `url` and suppresses `/Dest`, and Launch file maps to `url` with no dest, all with full `/Rect` boxes. Leaf-mutation count is frozen at 42 with relocated fixture-root replay. `include_annotations` remains `PARTIAL`; named dest resolution to array, remote GoToR, Launch file-dict variants, Text icon/box geometry, glyph-perfect boxes, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf info flags residual public-stdio subset (bounded)

A frozen two-case public-stdio `read_pdf` `include_metadata` info residual is admitted: pdf.js info flags (`Language`, `EncryptFilterName`, `IsLinearized`, `IsAcroFormPresent`, `IsXFAPresent`, `IsCollectionPresent`, `IsSignaturesPresent`) plus document info fields for AcroForm+Lang and plain catalogs. Leaf-mutation count is frozen at 33 with relocated fixture-root replay. `include_metadata` remains `PARTIAL`; XMP metadata payload, encrypted filter-name variants, linearized-true, signatures-true, rust-only info extras, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf page_geometry residual public-stdio subset (bounded)

A frozen three-case public-stdio `read_pdf` `include_page_geometry` residual is admitted: Rotate+UserUnit+CropBox dimensions, default MediaBox identity geometry, and inverted MediaBox normalization with `view_box`. Leaf-mutation count is frozen at 39 with relocated fixture-root replay. `include_page_geometry` remains `PARTIAL`; Bleed/Trim/Art boxes, non-right-angle rotation, inherited MediaBox breadth, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf page_labels residual public-stdio subset (bounded)

A frozen three-case public-stdio `read_pdf` `include_page_labels` residual is admitted: multi-style PageLabels (prefix roman, decimal start, alpha), prefix+start decimal sequence, and absent labels omitted. Leaf-mutation count is frozen at 17 with relocated fixture-root replay. `include_page_labels` remains `PARTIAL`; number-tree Kids breadth, hostile label overflow, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf outline residual public-stdio subset (bounded)

A frozen three-case public-stdio `read_pdf` `include_outline` residual is admitted: URI outline with bold/italic/color and child Fit dest (`dest` null on URI parent), FitH dest with coordinate, and absent outline omitted. Leaf-mutation count is frozen at 39 with relocated fixture-root replay. `include_outline` remains `PARTIAL`; outline cycle suppression beyond behavior, named dest string lookup, remote GoToR, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf permissions residual public-stdio subset (bounded)

A frozen four-case public-stdio `read_pdf` `include_permissions` residual is admitted: empty-user-password encrypted PDFs expose pdf.js permission labels for print/copy/fill/a11y, modify/annotate/assemble, and print+print_high_quality; unencrypted PDFs omit permissions. Leaf-mutation count is frozen at 25 with relocated fixture-root replay. `include_permissions` remains `PARTIAL`; non-empty user password, owner-only unlock, unknown permission bits, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.


### read_pdf metadata presence residual public-stdio subset (bounded)

A frozen two-case public-stdio `read_pdf` `include_metadata` presence residual is admitted: catalog without `/Metadata` omits `data.metadata`; catalog with `/Metadata` stream emits an empty metadata object matching pdfjs-dist Node presence (no synthetic info wrapper). Leaf-mutation count is frozen at 12 with relocated fixture-root replay. `include_metadata` remains `PARTIAL`; XMP key/value parsing, rich getAll payloads, rust-only info extras, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.

### search_pdf tesseract-tsv public-stdio subset (bounded)

A frozen two-case public-stdio `search_pdf` tesseract-tsv OCR subset is admitted over `v3014-visual-v1.pdf`: valid TSV level-5 words produce image-to-PDF `ocr_word` geometry on the search match, and malformed TSV soft-falls back to raw text without geometry. Leaf-mutation count is frozen at 34 with relocated fixture-root replay. `include_ocr_text_layer` remains `PARTIAL`; real tesseract binary health checks, selectable/OCR interleaving, URL single-fetch, and whole-product parity remain unclaimed. `dropInFor3014` stays false and publish freeze remains enabled.

### Cross-platform native package scaffold (bounded)

Optional native packages and a platform-scoped `bin/native/<platform>/` layout are scaffolded for `darwin-arm64`, `darwin-x64`, `linux-arm64-gnu`, `linux-x64-gnu`, and `win32-x64-msvc`. CI builds and uploads host binaries, but packages remain private and prepublish-blocked while `publishFreeze=true`. Default npm `latest` remains TypeScript 3.0.14; clean registry install/runtime verification and TS retirement remain unclaimed.

Local pure-Rust launcher smoke (`bun run smoke:native-launcher`) verifies staged platform-path binary resolution and MCP initialize on the host. This is not registry install proof.
