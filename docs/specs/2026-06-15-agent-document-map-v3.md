# Agent Document Map v3

Date: 2026-06-15
Status: active

## Goal

Make PDF Reader MCP expose a single agent-native map of a PDF: pages,
elements, chunks, layout confidence, safety findings, routing signals, and page
geometry. The map is the stable contract that later OCR, vision, formula, chart,
and advanced table engines can enrich without forcing agents to learn a new
response shape each time.

## Product Positioning

This is a capability release track, not a one-feature patch track. Public
messaging should describe the shipped outcome as full-fidelity, agent-ready PDF
understanding with performance-bounded local execution. Do not mention external
projects or imply unshipped OCR, formula, chart, or tagged-PDF generation.

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
      "needs_ocr_pages": []
    },
    "summary": {
      "selected_pages": [1],
      "processed_page_count": 1,
      "element_count": 0,
      "text_element_count": 0,
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
  flags.
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
  health checks and explicit enablement.

## v3 Capability Batch

Required before publishing the next package release:

- `include_document_map` public schema, handler, types, tests, docs.
- Inspector recommendations include `include_document_map` for digital and
  mixed PDFs.
- Quality eval proves the map links pages, elements, chunks, safety findings,
  layout diagnostics, and geometry.
- Handler tests prove the map does not force top-level legacy outputs.
- Public docs describe the map and keep advanced OCR/VLM capabilities in
  roadmap language only.

Next slices for the same v3 track:

- Page render/crop evidence API for visual grounding.
- Optional OCR provider interface for scanned pages.
- Optional layout/table/formula/chart provider interfaces.
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
- The first JSON content part omits `page_contents` and image bytes.
- Existing `read_pdf` calls without `include_document_map` remain unchanged.
- `inspect_pdf` recommends the document map for agentic digital-text and mixed
  workflows.
- Full validation passes before merge.
