# Capability Gap Matrix

Date: 2026-06-14
Status: active

This matrix tracks the capabilities PDF Reader MCP needs in order to feel like
a category-leading PDF intelligence server for AI agents. It intentionally uses
neutral capability names and avoids public comparison language.

## Legend

- Shipped: implemented in this repository.
- In progress: meaningful shipped coverage exists, but the full capability still
  needs fixtures, engine adapters, or additional validation.
- Next: feasible with current architecture and no mandatory heavy dependency.
- Advanced: likely requires optional engines, OCR models, or larger architecture.

## Matrix

| Capability | Status | Notes |
|---|---:|---|
| MCP-native PDF tools | Shipped | `inspect_pdf`, `search_pdf`, `render_page`, `extract_regions`, `analyze_regions`, `ocr_pages`, and `read_pdf` with stdio/http transport. |
| Agent-native PDF inspection | Shipped | `inspect_pdf` profiles PDFs, samples pages, flags OCR needs, reports optional-provider readiness, and recommends ordered `next_tools` plus `read_pdf` options. |
| Optional provider readiness | Shipped | `inspect_pdf` reports safe readiness for `ocr_pages` and `analyze_regions` without exposing command paths or arguments. |
| MCP-native PDF search | Shipped | `search_pdf`; bounded literal search with snippets, match offsets, character-derived, text-item, or opt-in OCR-word bounding boxes, and provenance. |
| Local path and URL sources | Shipped | Includes filesystem and HTTP restrictions. |
| Metadata and page count | Shipped | Existing `include_metadata`, `include_page_count`. |
| Text extraction | Shipped | Full text and selected pages. |
| Text layer with run/line/word/char ranges | Shipped | `include_text_layer`; page text, run metadata, line IDs, word records, character records, page-level character ranges, estimated char/word boxes, and provenance. |
| Image extraction | Shipped | MCP image parts plus JSON metadata. |
| Visual page rendering | Shipped | `render_page`; selected pages render as bounded PNG MCP image parts with evidence metadata and provenance. |
| Region crop evidence | Shipped | `extract_regions`; PDF-coordinate bounding boxes crop into focused PNG MCP image parts with evidence metadata. |
| Visual region analysis provider | Shipped | `analyze_regions`; focused crops are passed to env-configured command or HTTP providers and normalized into rich table cell/span/bbox, formula, chart axis/series, figure, image-description, confidence, warning, and provenance fields. No model is bundled. |
| Table extraction | Shipped | Spatial clustering with rows, confidence, and best-effort cell geometry. |
| Table quality diagnostics | Shipped | Completeness, non-empty cell ratio, row alignment, row spacing consistency, missing-cell count, inferred merged-cell candidates, warnings, and repeated-header continuation candidates. |
| Structured element output | Shipped | `include_elements`. |
| Agent document map | Shipped | `include_document_map`; links pages, elements, selectable text-layer coverage, chunks, layout diagnostics, safety findings, routing signals, OCR evidence, visual enrichment indexes, and page geometry in one agent-ready contract. |
| Semantic document AST | Shipped | `include_document_ast`; page, section, paragraph, list item, caption, header, footer, table, image, chart, formula, figure, diagram, and visual-region nodes linked to element IDs, visual enrichment IDs, chunk IDs, bounding boxes, confidence, section-path context, caption-to-evidence links, and table quality metadata. |
| Deterministic semantic hints | Shipped | `include_semantic_hints`; heading, list item, paragraph, caption, header, and footer hints with confidence. Header/footer detection uses page-edge geometry and avoids off-page text. |
| Markdown rendering | Shipped | `include_markdown`. |
| HTML rendering | Shipped | `include_html`; escaped page-aware HTML. |
| Citation-ready chunks | Shipped | `include_chunks`; page, semantic, size, and table strategies with stable element references. |
| Recursive reading order | Shipped | Handles common two-column text segmentation plus spanning-header, independent column-band, and footer ordering, including runtime-generated real PDF coverage for short footers. Needs broader fixture diversity. |
| Layout diagnostics and confidence | Shipped | `include_layout_diagnostics`; page profile, reading-order model, confidence, column signals, and warnings. |
| Outline/bookmark extraction | Shipped | `include_outline`; best-effort when exposed by PDF.js. |
| Annotation extraction | Shipped | `include_annotations`; safe summary fields. |
| Page labels | Shipped | `include_page_labels`. |
| Page geometry | Shipped | `include_page_geometry`; viewport size, rotation, user unit, and view box. |
| Permissions and mark info | Shipped | `include_permissions`. |
| Tagged PDF structure extraction | Shipped | `include_structure_tree`; page-scoped structure trees when exposed by PDF.js. |
| Accessibility report | Shipped | `include_accessibility_report`; deterministic tagged-PDF coverage, structure tree, heading, image, form, link, permission, and mark-info signals. Does not claim PDF/UA certification. |
| Form fields | Shipped | `include_form_fields`; covered by a runtime-generated AcroForm fixture with PDF.js zero-based page normalization. Broader form variants still belong in future fixture expansion. |
| Attachment metadata | Shipped | `include_attachments`; metadata only, no attachment bytes by default. |
| Content safety findings | Shipped | `include_safety_findings`; prompt-injection patterns, tiny text, off-page text, and overlapping text that may visually spoof or obscure content. |
| PDF trust report | Shipped | `include_trust_report`; consolidates content safety, layout uncertainty, sparse/scanned-page, table quality, and external-link signals with page-level routing guidance. |
| Rich semantic headings/paragraphs/lists | In progress | Deterministic hints and AST nodes now cover headings, paragraphs, lists, captions, headers, footers, cross-page section context, and caption-to-evidence linking. Broader semantic variants and caption-link fixture diversity still need expanded evals. |
| Table cell geometry | Shipped | Table and cell bounding boxes plus row/column indexes where coordinates are available. |
| Rich table spans and multi-page links | In progress | Deterministic header/span hints and repeated-header continuation candidates are shipped; visual provider output can now preserve cell spans and boxes; non-repeated continuation still needs broader fixtures. |
| Semantic chunking | Shipped | Splits chunks on deterministic heading hints when `include_semantic_hints` is enabled. |
| Quality eval and benchmark harness | Shipped | Regression evals cover semantic chunks, table order, renderers, safety findings, inspection routing, recursive reading order, visual-region normalization, document-twin visual enrichment fusion, document-map text-layer coverage, caption-to-evidence links, and search evidence. `bun run benchmark:quality` publishes deterministic quality gates for Agent Document Twin semantics, inspection tool routing, real PDF document signals, real PDF reading order, runtime-generated scanned-PDF OCR pipeline routing, OCR normalization, command/HTTP visual-region normalization, and evidence search. `bun run benchmark:providers` reports installed-provider certification profiles for OCR text-layer word boxes and visual table/formula/chart/figure/image-description crop evidence when providers are configured. |
| OCR for scanned PDFs | Shipped | `ocr_pages`; optional env-configured command provider over bounded rendered pages plus `MCP_PDF_OCR_PRESET=tesseract` and `tesseract-tsv`. `read_pdf` can opt into `include_ocr_text_layer` and link OCR evidence into `document_map`; TSV output is normalized into word boxes and confidence. No default OCR model is bundled. |
| Formula extraction | Shipped | `analyze_regions` can normalize LaTeX, MathML, AsciiMath, text, confidence, and provenance from a configured provider; `read_pdf` can opt into `include_visual_enrichments` and attach formula evidence to the document twin. Accuracy depends on the configured local engine. |
| Chart/image descriptions | Shipped | `analyze_regions` can normalize chart data points, axes, series, figure, and image-description provider output; `read_pdf` can opt into `include_visual_enrichments` and attach visual evidence to the document twin. Accuracy depends on the configured local engine. |
| Tagged PDF generation | Advanced | Requires separate design and validation. |
| Advanced parser engine adapters | In progress | OCR and visual region provider boundaries are shipped; health checks, presets, and broader engine-specific fixtures remain. |

## Execution Priority

1. Continue broadening real fixture coverage for the no-new-dependency parity
   features. The quality benchmark now covers outline, annotations, page
   labels, mark info, form fields, attachment metadata, page geometry,
   structure trees, and accessibility reports through a runtime-generated real
   PDF, plus real multi-column reading order with short footer placement;
   permissions, additional tagged structures, semantic variants, and safety
   adversarial fixtures still need broader coverage.
2. Expand extraction quality evals and benchmarks: multi-column, layout
   diagnostics, tables, annotations, forms, hidden/off-page text, scanned PDFs.
3. Harden the agent document map as the SSOT for pages, elements, text-layer
   coverage, chunks, layout, safety, page geometry, and optional engine
   enrichment.
4. Promote run/character evidence into the shared document map and benchmark
   retrieval quality against fixture expectations.
5. Continue broadening the deterministic semantic model beyond shipped
   headings, paragraphs, lists, captions, headers, footers, cross-page section
   context, caption-to-evidence links, AST traversal, and richer table trust
   signals.
6. Harden trust reports with redaction and broader adversarial fixtures.
7. Harden the optional OCR provider with broader scanned fixtures, additional
   provider presets, and accuracy/latency reporting beyond deterministic mock
   provider normalization and the installed Tesseract TSV certification
   benchmark.
8. Harden optional visual region providers for table, formula, chart, figure,
   and image-description engines with broader fixtures and accuracy/latency
   reporting beyond deterministic mock provider normalization and the installed
   visual-region `visual-full-fidelity` certification benchmark.
9. Add formula/chart/tagged-PDF capabilities only through optional engines
   or separately installable modules.

## Public Messaging Rule

Public docs may describe only shipped capabilities. In-progress and advanced
items belong in roadmap language until validated by tests and fixtures.
