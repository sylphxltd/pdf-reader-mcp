# Agent Document Map v3

Date: 2026-06-15
Status: active

## Goal

Make PDF Reader MCP expose a single agent-native map of a PDF: pages,
elements, chunks, layout confidence, safety findings, routing signals, OCR
evidence, and page geometry. The map is the stable contract that OCR, vision,
formula, chart, and advanced table engines can enrich without forcing agents to
learn a new response shape each time.

## Product Positioning

This is a capability release track, not a one-feature patch track. Public
messaging should describe the shipped outcome as full-fidelity, agent-ready PDF
understanding with performance-bounded local execution. Do not mention external
projects or imply built-in OCR models, formula, chart, or tagged-PDF
generation before those capabilities are shipped and validated.

## Non-Goals

- Do not make OCR, VLMs, ONNX models, Python, Java, or remote services
  mandatory for the default TypeScript package.
- Do not put image base64 data inside the JSON document map.
- Do not create a second table, chunk, or element vocabulary.
- Do not publish a package release until the v3 capability batch is large
  enough to read as a planned milestone.

## Public Contract

`read_pdf` accepts:

```json
{
  "sources": [{ "path": "report.pdf", "pages": "1-5" }],
  "include_document_map": true
}
```

Each successful source may include:

```json
{
  "document_map": {
    "version": "2026-06-15",
    "profile": "agent_document_map",
    "layers": [
      "selectable_text",
      "ocr_text_layer",
      "table_structure",
      "semantic_hints",
      "citation_chunks",
      "layout_diagnostics",
      "content_safety",
      "page_geometry"
    ],
    "pages": [
      {
        "page": 1,
        "element_ids": ["p1-text-1", "p1-table-1"],
        "chunk_ids": ["p1-chunk-1", "p1-chunk-2"],
        "safety_finding_indexes": [0],
        "text_chars": 1200,
        "text_item_count": 30,
        "ocr_text_chars": 128,
        "ocr_word_count": 24,
        "ocr_confidence": 0.91,
        "ocr_source_render_evidence_id": "page-1-render-scale-2",
        "image_count": 0,
        "table_count": 1
      }
    ],
    "elements": [],
    "chunks": [],
    "layout_diagnostics": [],
    "safety_findings": [],
    "routing": {
      "low_confidence_pages": [],
      "image_or_sparse_pages": [],
      "needs_ocr_pages": [],
      "ocr_applied_pages": [1]
    },
    "summary": {
      "selected_pages": [1],
      "processed_page_count": 1,
      "element_count": 0,
      "text_element_count": 0,
      "ocr_page_count": 1,
      "ocr_text_chars": 128,
      "image_element_count": 0,
      "table_element_count": 0,
      "chunk_count": 0,
      "safety_finding_count": 0
    }
  }
}
```

## Invariants

- `document_map.pages[*].element_ids` must reference IDs present in
  `document_map.elements`.
- `document_map.pages[*].chunk_ids` must reference IDs present in
  `document_map.chunks`.
- `document_map.pages[*].safety_finding_indexes` must reference array indexes
  in `document_map.safety_findings`.
- `document_map.layers` must be derived from actual emitted layers, not user
  flags. `ocr_text_layer` is present only when OCR pages were returned.
- Top-level legacy outputs remain opt-in. `include_document_map` may build
  internal elements, chunks, safety findings, layout diagnostics, page geometry,
  and tables for the map without forcing top-level `elements`, `chunks`,
  `safety_findings`, `layout_diagnostics`, or `page_geometry`.
- JSON output must not include embedded image bytes.
- Every map is deterministic for the same PDF bytes, selected pages, and parser
  version.

## Performance Constraints

- The map must reuse page content, table, layout, safety, chunk, and geometry
  data already produced in the request path.
- The builder itself must be linear in emitted pages, elements, chunks, and
  findings.
- Page extraction remains batched; document map construction must not increase
  source concurrency beyond the existing handler limit.
- OCR, VLM, and ONNX work belongs behind optional provider interfaces, with
  health checks and explicit enablement. `include_ocr_text_layer` is the
  explicit opt-in for OCR fusion and must keep OCR text separate from
  selectable text.

## v3 Capability Batch

Required before publishing the next package release:

- `include_document_map` public schema, handler, types, tests, docs.
- Inspector recommendations include `include_document_map` for digital and
  mixed PDFs.
- `render_page`, `extract_regions`, `analyze_regions`, and `ocr_pages` provide
  visual evidence, focused crops, visual region enrichment, and configured OCR
  text layers without embedding image bytes in JSON summaries.
- `read_pdf` can opt into OCR text layer fusion for sparse/scanned pages and
  link applied OCR pages into the document map.
- `search_pdf` provides bounded evidence retrieval with snippets, offsets,
  optional character-derived or text-item bounding boxes, and provenance before
  heavier workflows.
- Quality eval proves the map links pages, elements, chunks, safety findings,
  layout diagnostics, and geometry.
- Handler tests prove the map does not force top-level legacy outputs.
- Public docs describe shipped configured OCR accurately and keep built-in OCR
  model, VLM, formula, chart, and PDF/UA capabilities in roadmap language only.

Next slices for the same v3 track:

- Additional OCR provider presets, scanned fixtures, and accuracy/latency
  benchmarks.
- Engine-specific layout, table, formula, and chart provider presets and
  accuracy/latency fixtures.
- Benchmark harness with accuracy and latency reported separately.
- Broader fixtures for multi-column, forms, tables, scanned pages, hidden text,
  charts, and formulas.

## Acceptance Criteria

- `include_document_map` validates as an optional boolean.
- `read_pdf` with `include_document_map: true` processes selected pages even
  when `include_full_text` is false.
- The map includes semantic elements, citation chunks, layout diagnostics,
  safety findings, routing signals, page geometry, and summary counts.
- The map includes table elements when deterministic table extraction finds
  tables.
- The map links OCR pages when `include_ocr_text_layer` returns OCR evidence.
- The first JSON content part omits `page_contents` and image bytes.
- Existing `read_pdf` calls without `include_document_map` remain unchanged.
- `inspect_pdf` recommends the document map for agentic digital-text and mixed
  workflows.
- Full validation passes before merge.
