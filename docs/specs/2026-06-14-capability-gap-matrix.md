# Capability Gap Matrix

Date: 2026-06-14
Status: active

This matrix tracks the capabilities PDF Reader MCP needs in order to feel like
a category-leading PDF intelligence server for AI agents. It intentionally uses
neutral capability names and avoids public comparison language.

## Legend

- Shipped: implemented in this repository.
- In progress: partially implemented and needs validation or hardening.
- Next: feasible with current architecture and no mandatory heavy dependency.
- Advanced: likely requires optional engines, OCR models, or larger architecture.

## Matrix

| Capability | Status | Notes |
|---|---:|---|
| MCP-native PDF tools | Shipped | `inspect_pdf`, `render_page`, `extract_regions`, `ocr_pages`, and `read_pdf` with stdio/http transport. |
| Agent-native PDF inspection | Shipped | `inspect_pdf` profiles PDFs, samples pages, flags OCR needs, and recommends `read_pdf` options. |
| Local path and URL sources | Shipped | Includes filesystem and HTTP restrictions. |
| Metadata and page count | Shipped | Existing `include_metadata`, `include_page_count`. |
| Text extraction | Shipped | Full text and selected pages. |
| Image extraction | Shipped | MCP image parts plus JSON metadata. |
| Visual page rendering | Shipped | `render_page`; selected pages render as bounded PNG MCP image parts with evidence metadata and provenance. |
| Region crop evidence | Shipped | `extract_regions`; PDF-coordinate bounding boxes crop into focused PNG MCP image parts with evidence metadata. |
| Table extraction | Shipped | Spatial clustering with rows, confidence, and best-effort cell geometry. |
| Structured element output | Shipped | `include_elements`. |
| Agent document map | Shipped | `include_document_map`; links pages, elements, chunks, layout diagnostics, safety findings, routing signals, and page geometry in one agent-ready contract. |
| Deterministic semantic hints | Shipped | `include_semantic_hints`; heading, list item, paragraph hints with confidence. |
| Markdown rendering | Shipped | `include_markdown`. |
| HTML rendering | Shipped | `include_html`; escaped page-aware HTML. |
| Citation-ready chunks | Shipped | `include_chunks`; page, semantic, size, and table strategies with stable element references. |
| Column-aware reading order | Shipped | Handles common two-column text segmentation. Needs broader fixtures. |
| Layout diagnostics and confidence | Shipped | `include_layout_diagnostics`; page profile, reading-order model, confidence, column signals, and warnings. |
| Outline/bookmark extraction | Shipped | `include_outline`; best-effort when exposed by PDF.js. |
| Annotation extraction | Shipped | `include_annotations`; safe summary fields. |
| Page labels | Shipped | `include_page_labels`. |
| Page geometry | Shipped | `include_page_geometry`; viewport size, rotation, user unit, and view box. |
| Permissions and mark info | Shipped | `include_permissions`. |
| Tagged PDF structure extraction | Shipped | `include_structure_tree`; page-scoped structure trees when exposed by PDF.js. |
| Form fields | Shipped | `include_form_fields`; needs broader AcroForm fixture coverage. |
| Attachment metadata | Shipped | `include_attachments`; metadata only, no attachment bytes by default. |
| Content safety findings | Shipped | `include_safety_findings`; prompt-injection patterns, tiny text, and off-page text. |
| Rich semantic headings/paragraphs/lists | Next | Promote hints to stronger element model after fixtures/evals. |
| Table cell geometry | Shipped | Table and cell bounding boxes plus row/column indexes where coordinates are available. |
| Rich table spans and multi-page links | Next | Row spans, column spans, cross-page continuity, stronger confidence model. |
| Semantic chunking | Shipped | Splits chunks on deterministic heading hints when `include_semantic_hints` is enabled. |
| Quality eval harness | Shipped | Regression eval covers semantic chunks, table order, renderers, and safety findings. |
| OCR for scanned PDFs | Shipped | `ocr_pages`; optional env-configured command provider over bounded rendered pages. No default OCR model is bundled. |
| Formula extraction | Advanced | Optional provider or external engine. |
| Chart/image descriptions | Advanced | Optional vision enrichment. |
| Tagged PDF generation | Advanced | Requires separate design and validation. |
| Advanced parser engine adapters | Advanced | Provider boundary, normalized output, health checks. |

## Execution Priority

1. Harden current no-new-dependency parity features with real fixtures:
   outline, annotations, page labels, permissions, form fields, attachment
   metadata, page geometry, structure trees, semantic hints, and safety
   findings.
2. Expand extraction quality evals: multi-column, layout diagnostics, tables,
   annotations, forms, hidden/off-page text, scanned PDFs.
3. Harden the agent document map as the SSOT for pages, elements, chunks,
   layout, safety, page geometry, and optional engine enrichment.
4. Add deterministic semantic model: headings, paragraphs, lists, captions,
   richer tables.
5. Harden the optional OCR provider with real scanned fixtures, provider
   presets, and accuracy/latency reporting.
6. Add optional advanced engines behind provider interfaces.
7. Add formula/chart/tagged-PDF capabilities only through optional engines
   or separately installable modules.

## Public Messaging Rule

Public docs may describe only shipped capabilities. In-progress and advanced
items belong in roadmap language until validated by tests and fixtures.
