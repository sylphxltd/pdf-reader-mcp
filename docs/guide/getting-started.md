# Getting Started

Once installed, the PDF Reader MCP server provides six tools:

- `inspect_pdf` profiles a PDF and recommends the best extraction options.
- `search_pdf` searches extracted PDF text with snippets, bounding boxes, and
  provenance.
- `render_page` renders selected PDF pages as bounded visual evidence images.
- `extract_regions` crops PDF-coordinate page regions as focused visual evidence.
- `ocr_pages` runs selected rendered pages through a configured local OCR
  provider and returns a normalized OCR text layer.
- `read_pdf` extracts PDF content, an agent document map, structure,
  citations, tables, images, layout confidence, and signals.

## Basic Usage

### Inspect a PDF First

Use `inspect_pdf` when an agent needs to decide how to process an unfamiliar
document. It samples a bounded number of pages and returns an extraction plan
without decoding image bytes.

```json
{
  "sources": [{ "path": "/path/to/document.pdf" }],
  "sample_pages": 5,
  "include_metadata": true
}
```

Typical response fields:

- `profile`: `digital_text`, `scanned_or_image_only`, `mixed_text_and_scan`,
  `low_text_or_form`, or `unknown`
- `page_signals`: text density, token estimate, and image paint-operation count
- `document_signals`: outline, labels, permissions, forms, attachments, and
  structure-tree availability
- `recommendation`: workflow, OCR need, reason, and ready-to-use `read_pdf`
  arguments

### Search For Evidence

Use `search_pdf` when an agent needs to find relevant pages and source
snippets before running heavier extraction, rendering, or region cropping.

```json
{
  "sources": [{
    "path": "/path/to/document.pdf",
    "pages": "1-20"
  }],
  "query": "risk controls",
  "whole_word": true,
  "max_matches_per_source": 10
}
```

Matches include page number, matched text, snippet, match offsets, text-item
index, optional text-item bounding box, and provenance. Search is literal and
bounded by `max_pages` and `max_matches_per_source`.

### Get Metadata and Page Count

```json
{
  "sources": [{ "path": "/path/to/document.pdf" }],
  "include_full_text": false,
  "include_metadata": true,
  "include_page_count": true,
  "include_images": false
}
```

### Get Full Text

```json
{
  "sources": [{ "path": "/path/to/document.pdf" }],
  "include_full_text": true,
  "include_metadata": false,
  "include_page_count": false,
  "include_images": false
}
```

### Get Specific Pages

```json
{
  "sources": [{
    "path": "/path/to/document.pdf",
    "pages": [1, 3, 5]
  }],
  "include_full_text": false,
  "include_metadata": false,
  "include_page_count": false,
  "include_images": false
}
```

Or use page ranges:

```json
{
  "sources": [{
    "path": "/path/to/document.pdf",
    "pages": "1-5, 10, 15-20"
  }],
  "include_full_text": false,
  "include_metadata": false,
  "include_page_count": false,
  "include_images": false
}
```

### Extract Images

```json
{
  "sources": [{ "path": "/path/to/document.pdf" }],
  "include_full_text": false,
  "include_metadata": false,
  "include_page_count": false,
  "include_images": true
}
```

### Get Structured Elements

Use `include_elements` when an agent needs stable page references, provenance,
and best-effort coordinates instead of plain text alone.

```json
{
  "sources": [{
    "path": "/path/to/document.pdf",
    "pages": "1-3"
  }],
  "include_elements": true,
  "include_semantic_hints": true,
  "include_full_text": false,
  "include_metadata": true,
  "include_page_count": true,
  "include_images": false
}
```

### Get An Agent Document Map

Use `include_document_map` when an agent needs one navigable structure for the
PDF instead of separate page, element, chunk, layout, and safety outputs.

```json
{
  "sources": [{
    "path": "/path/to/document.pdf",
    "pages": "1-5"
  }],
  "include_document_map": true,
  "include_full_text": false,
  "include_metadata": true,
  "include_page_count": true
}
```

The map links pages to element IDs, chunk IDs, safety finding indexes, layout
diagnostics, routing signals, and page geometry. Image bytes are not embedded
inside the JSON map.

### Render Page Evidence

Use `render_page` when an agent needs to inspect the original page image,
verify visual layout, or prepare OCR routing for sparse/scanned pages.

```json
{
  "sources": [{
    "path": "/path/to/document.pdf",
    "pages": "1-2"
  }],
  "scale": 2,
  "max_pages": 2
}
```

The response starts with JSON metadata for each rendered page, including page
number, dimensions, pixel count, byte length, evidence ID, and provenance. PNG
data is returned as MCP image content parts and referenced by
`image_content_index`. By default the tool renders the first page only when no
page range is provided, caps each source at 5 pages, and rejects pages above a
16MP render budget.

### Extract Region Evidence

Use `extract_regions` when a workflow has a bounding box from a table, figure,
chart, formula, annotation, or citation and needs a focused crop from the
original page.

```json
{
  "sources": [{
    "path": "/path/to/document.pdf",
    "regions": [{
      "id": "table-1",
      "page": 1,
      "bounding_box": { "left": 72, "bottom": 420, "right": 540, "top": 620 },
      "padding": 8
    }]
  }],
  "scale": 2,
  "max_regions": 20
}
```

The response starts with JSON metadata for each crop, including region ID,
source bounding box, crop pixel bounds, evidence ID, and provenance. Cropped PNG
data is returned as MCP image content parts and referenced by
`image_content_index`.

### OCR Selected Pages

Use `ocr_pages` after `inspect_pdf` flags scanned or sparse pages, or when a
workflow needs a text layer from pages with little selectable text. The OCR
provider is configured by environment variables, not by request arguments.

```json
{
  "sources": [{
    "path": "/path/to/scanned-document.pdf",
    "pages": "1-3"
  }],
  "scale": 2,
  "max_pages": 3,
  "languages": ["eng"]
}
```

Set `MCP_PDF_OCR_COMMAND` to enable the tool. Optionally set
`MCP_PDF_OCR_ARGS_JSON` to a JSON string array that includes `{input}` and may
also use `{page}`, `{source}`, `{language}`, and `{languages}` placeholders.
The provider can return plain text or JSON with `text`, `confidence`,
`language`, and `words`.

The response starts with JSON metadata using `profile: "ocr_text_layer"`.
Each page includes normalized OCR text, confidence when supplied, optional word
boxes, language, provenance, and a `source_render_evidence_id` that points back
to the temporary page render used as OCR input.

### Get Markdown

Use `include_markdown` when a workflow needs clean page-aware context for RAG,
summarization, or note generation.

```json
{
  "sources": [{
    "path": "/path/to/document.pdf",
    "pages": "1-5"
  }],
  "include_markdown": true,
  "include_full_text": false,
  "include_metadata": false,
  "include_page_count": true,
  "include_images": false
}
```

### Get HTML

Use `include_html` when a workflow needs escaped page-aware HTML for preview,
export, or downstream conversion.

```json
{
  "sources": [{
    "path": "/path/to/document.pdf",
    "pages": "1-5"
  }],
  "include_html": true,
  "include_full_text": false,
  "include_metadata": false,
  "include_page_count": true
}
```

### Get Citation-Ready Chunks

Use `include_chunks` when an agent needs retrieval chunks with source
references. Enable `include_semantic_hints` to split chunks on deterministic
heading boundaries, and enable `include_tables` when table chunks should be
available.

```json
{
  "sources": [{
    "path": "/path/to/document.pdf",
    "pages": "1-5"
  }],
  "include_chunks": true,
  "include_semantic_hints": true,
  "include_tables": true,
  "include_full_text": false,
  "include_metadata": false,
  "include_page_count": true
}
```

### Get a Document AST

Use `include_document_ast` when an agent needs a semantic tree instead of flat
page text. The AST includes page, section, paragraph, list item, table, and
image nodes with `element_ids`, `chunk_ids`, bounding boxes, confidence,
semantic roles, and table quality metadata where available.

```json
{
  "sources": [{
    "path": "/path/to/document.pdf",
    "pages": "1-5"
  }],
  "include_document_ast": true,
  "include_full_text": false,
  "include_metadata": false,
  "include_page_count": true
}
```

### Get a Trust Report

Use `include_trust_report` when an agent needs one risk summary before using
PDF content as instructions, evidence, or retrieval context. The report
consolidates content safety, layout uncertainty, sparse/scanned-page, table
quality, and external-link signals without forcing those raw outputs into the
top-level response.

```json
{
  "sources": [{
    "path": "/path/to/document.pdf",
    "pages": "1-5"
  }],
  "include_trust_report": true,
  "include_full_text": false,
  "include_metadata": false,
  "include_page_count": true
}
```

### Get Layout Diagnostics

Use `include_layout_diagnostics` when an agent needs to know whether local
reading order is likely reliable before indexing, citing, or summarizing a
page. Diagnostics are deterministic and use existing extracted item geometry;
they do not add OCR, vision, or a heavy parser dependency.

```json
{
  "sources": [{
    "path": "/path/to/document.pdf",
    "pages": "1-5"
  }],
  "include_layout_diagnostics": true,
  "include_chunks": true,
  "include_semantic_hints": true,
  "include_full_text": false
}
```

Response fields include `profile`, `reading_order`, `confidence`,
`column_count`, `positioned_item_ratio`, `signals`, and optional `warnings`.

### Get Document Signals

Use the document-signal flags when an agent needs PDF structure beyond page
text.

```json
{
  "sources": [{
    "path": "/path/to/document.pdf",
    "pages": "1-5"
  }],
  "include_outline": true,
  "include_annotations": true,
  "include_page_labels": true,
  "include_page_geometry": true,
  "include_permissions": true,
  "include_structure_tree": true,
  "include_form_fields": true,
  "include_attachments": true
}
```

### Inspect Content Safety

Use `include_safety_findings` when an agent will use PDF text as context and
needs deterministic warnings for common prompt-injection patterns, tiny text,
or off-page text.

```json
{
  "sources": [{
    "path": "/path/to/document.pdf",
    "pages": "1-5"
  }],
  "include_safety_findings": true,
  "include_full_text": false
}
```

## Multiple Sources

Process multiple PDFs in a single request:

```json
{
  "sources": [
    { "path": "/path/to/report.pdf" },
    { "path": "/path/to/invoice.pdf" },
    { "url": "https://example.com/whitepaper.pdf" }
  ],
  "include_full_text": true,
  "include_metadata": true,
  "include_page_count": true,
  "include_images": false
}
```

## Response Format

```json
{
  "results": [
    {
      "source": "/path/to/document.pdf",
      "success": true,
      "data": {
        "num_pages": 10,
        "info": {
          "Title": "Document Title",
          "Author": "Author Name",
          "CreationDate": "D:20231201120000"
        },
        "metadata": { ... },
        "page_texts": [
          { "page": 1, "text": "Page 1 content..." },
          { "page": 2, "text": "Page 2 content..." }
        ],
        "markdown": "## Page 1\n\nPage 1 content...",
        "html": "<section data-page=\"1\">\n<h2>Page 1</h2>\n<p>Page 1 content...</p>\n</section>",
        "page_geometry": [
          {
            "page": 1,
            "width": 612,
            "height": 792,
            "rotation": 0,
            "user_unit": 1,
            "view_box": {
              "left": 0,
              "bottom": 0,
              "right": 612,
              "top": 792
            }
          }
        ],
        "document_map": {
          "version": "2026-06-15",
          "profile": "agent_document_map",
          "layers": [
            "selectable_text",
            "semantic_hints",
            "citation_chunks",
            "layout_diagnostics",
            "content_safety",
            "page_geometry"
          ],
          "pages": [
            {
              "page": 1,
              "element_ids": ["p1-text-1"],
              "chunk_ids": ["p1-chunk-1"],
              "safety_finding_indexes": [],
              "text_chars": 120,
              "text_item_count": 3,
              "image_count": 0,
              "table_count": 0
            }
          ],
          "routing": {
            "low_confidence_pages": [],
            "image_or_sparse_pages": [],
            "needs_ocr_pages": []
          },
          "summary": {
            "selected_pages": [1],
            "processed_page_count": 1,
            "element_count": 1,
            "text_element_count": 1,
            "image_element_count": 0,
            "table_element_count": 0,
            "chunk_count": 1,
            "safety_finding_count": 0
          }
        },
        "image_info": [
          {
            "page": 1,
            "index": 0,
            "width": 800,
            "height": 600,
            "format": "rgb"
          }
        ],
        "table_info": [
          {
            "page": 1,
            "tableIndex": 0,
            "rowCount": 2,
            "colCount": 2,
            "cellCount": 4,
            "bounding_box": {
              "left": 72,
              "bottom": 640,
              "right": 420,
              "top": 700
            },
            "confidence": 0.85,
            "quality": {
              "completeness": 1,
              "nonEmptyCellRatio": 1,
              "rowAlignment": 1,
              "rowSpacingConsistency": 1,
              "missingCellCount": 0,
              "mergedCellCandidateCount": 0,
              "signals": ["complete_grid"]
            }
          }
        ],
        "elements": [
          {
            "id": "p1-text-1",
            "type": "text",
            "page": 1,
            "content": "Page 1 content...",
            "bounding_box": {
              "left": 72,
              "bottom": 720,
              "right": 240,
              "top": 732
            },
            "provenance": {
              "engine": "pdfjs",
              "source": "text-content"
            },
            "semantic_hint": {
              "role": "paragraph",
              "confidence": 0.5,
              "signals": ["default-text"]
            }
          },
          {
            "id": "p1-table-1",
            "type": "table",
            "page": 1,
            "bounding_box": {
              "left": 72,
              "bottom": 640,
              "right": 420,
              "top": 700
            },
            "table": {
              "rows": [["Name", "Total"], ["Ada", "$100"]],
              "cells": [
                {
                  "text": "Name",
                  "rowIndex": 0,
                  "colIndex": 0,
                  "rowSpan": 1,
                  "colSpan": 1,
                  "isHeader": true,
                  "inferred": false,
                  "bounding_box": {
                    "left": 72,
                    "bottom": 680,
                    "right": 120,
                    "top": 700
                  }
                }
              ],
              "rowCount": 2,
              "colCount": 2,
              "confidence": 0.85,
              "quality": {
                "completeness": 1,
                "nonEmptyCellRatio": 1,
                "rowAlignment": 1,
                "rowSpacingConsistency": 1,
                "missingCellCount": 0,
                "mergedCellCandidateCount": 0,
                "signals": ["complete_grid"]
              }
            },
            "confidence": 0.85,
            "provenance": {
              "engine": "pdfjs",
              "source": "table-detector"
            }
          }
        ],
        "chunks": [
          {
            "id": "p1-chunk-1",
            "page_start": 1,
            "page_end": 1,
            "text": "Page 1 content...",
            "element_ids": ["p1-text-1"],
            "strategy": "page",
            "bounding_boxes": [
              {
                "left": 72,
                "bottom": 720,
                "right": 240,
                "top": 732
              }
            ]
          }
        ],
        "structure_trees": [
          {
            "page": 1,
            "tree": {
              "role": "Root",
              "children": [
                {
                  "role": "H1",
                  "children": [{ "type": "content", "id": "p1-text-1" }]
                }
              ]
            }
          }
        ],
        "form_fields": [
          {
            "name": "customer_name",
            "type": "text",
            "value": "Ada Lovelace",
            "page": 1
          }
        ],
        "attachments": [
          {
            "name": "source_csv",
            "filename": "source.csv",
            "size_bytes": 1024
          }
        ],
        "safety_findings": [
          {
            "type": "prompt_injection_pattern",
            "severity": "high",
            "page": 1,
            "element_id": "p1-text-3",
            "message": "Text matches a common prompt-injection instruction pattern.",
            "snippet": "Ignore previous instructions..."
          }
        ]
      }
    }
  ]
}
```

## Error Handling

If a source fails, it will be included in results with `success: false`:

```json
{
  "results": [
    {
      "source": "/path/to/missing.pdf",
      "success": false,
      "error": {
        "code": "FileNotFound",
        "message": "File not found: /path/to/missing.pdf"
      }
    }
  ]
}
```

Other sources in the same request will still be processed.
