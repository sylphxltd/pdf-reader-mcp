# Agent-Native PDF Inspection

Date: 2026-06-15
Status: active

## Goal

Add a lightweight MCP tool that lets an agent inspect a PDF before extracting it.
The tool should answer: what kind of PDF is this, which pages should be sampled,
what risks are visible, and which `read_pdf` options are most useful next.

This improves time-to-value without adding OCR models, Java, Python, cloud
services, or any large default dependency.

## Non-goals

- Do not perform OCR in the default package.
- Do not claim high-accuracy parsing from a short inspection sample.
- Do not extract image bytes during inspection.
- Do not replace `read_pdf`; inspection is an additive planning step.

## Contract

Expose a second MCP tool named `inspect_pdf`.

Input:

```json
{
  "sources": [{ "path": "report.pdf", "pages": "1-5" }],
  "sample_pages": 5,
  "include_metadata": true
}
```

Output is a JSON text part:

```json
{
  "results": [
    {
      "source": "report.pdf",
      "success": true,
      "data": {
        "profile": "digital_text",
        "num_pages": 12,
        "sampled_pages": [1, 4, 7, 9, 12],
        "page_signals": [
          {
            "page": 1,
            "text_chars": 2400,
            "text_items": 82,
            "estimated_tokens": 600,
            "image_paint_operations": 2,
            "likely_scanned": false,
            "low_text_density": false
          }
        ],
        "document_signals": {
          "has_outline": true,
          "has_page_labels": false,
          "has_permissions": false,
          "has_mark_info": false,
          "has_form_fields": false,
          "has_attachments": false,
          "has_structure_tree": false
        },
        "recommendation": {
          "workflow": "agentic_rag",
          "needs_ocr": false,
          "reason": "Sampled pages expose selectable text; citation chunks, semantic hints, table extraction, and safety findings are the highest-value next read_pdf options.",
          "read_pdf_arguments": {
            "sources": [{ "path": "report.pdf" }],
            "include_metadata": true,
            "include_page_count": true,
            "include_page_geometry": true,
            "include_outline": true,
            "include_chunks": true,
            "include_semantic_hints": true,
            "include_safety_findings": true,
            "include_markdown": true,
            "include_tables": true
          }
        },
        "provider_status": {
          "ocr_pages": {
            "readiness": "ready",
            "provider": "command",
            "command_configured": true,
            "preset": "tesseract"
          },
          "analyze_regions": {
            "readiness": "not_configured",
            "provider": "command",
            "command_configured": false,
            "warnings": ["Set MCP_PDF_REGION_ANALYSIS_COMMAND to enable analyze_regions."]
          }
        }
      }
    }
  ]
}
```

## Invariants

- Inspection returns per-source success or failure independently.
- Sampling is bounded and defaults to a small number of pages.
- `read_pdf_arguments` must never imply OCR support from the default package.
- Provider readiness must not expose local command paths or arguments.
- The first JSON part must not include binary image data.
- Existing `read_pdf` callers remain unchanged.

## Validation

- Unit tests cover page sampling and profile classification.
- Handler tests cover successful digital and scanned/image-like PDFs.
- Integration tests confirm the MCP server lists `inspect_pdf`.
- Full validation: `bun run check`, `bun run build`, `bun test`, and
  `bun run docs:build`.
