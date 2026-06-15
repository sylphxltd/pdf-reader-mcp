# PDF Search Evidence

Date: 2026-06-15
Status: active

## Goal

Let agents find relevant PDF evidence before reading entire page ranges,
rendering pages, cropping regions, or constructing citations.

`search_pdf` performs bounded literal search over extracted PDF text and
returns page-level evidence: matched text, snippets, offsets, text-item indexes,
optional text-item bounding boxes, and provenance.

## Non-Goals

- Do not accept arbitrary regular expressions in request payloads.
- Do not build a persistent index or cache in the first slice.
- Do not search OCR output until the OCR/document-map fusion policy is defined.
- Do not claim semantic search or embedding retrieval.

## Public Contract

```json
{
  "sources": [{ "path": "report.pdf", "pages": "1-20" }],
  "query": "risk controls",
  "whole_word": true,
  "max_matches_per_source": 10
}
```

The first content part is JSON:

```json
{
  "profile": "pdf_search_results",
  "search_options": {
    "query": "risk controls",
    "case_sensitive": false,
    "whole_word": true,
    "max_pages": 100,
    "max_matches_per_source": 10,
    "context_chars": 120
  },
  "results": [{
    "source": "report.pdf",
    "success": true,
    "num_pages": 42,
    "searched_pages": [1, 2, 3],
    "total_matches": 1,
    "matches": [{
      "id": "p2-match-1",
      "page": 2,
      "text": "risk controls",
      "snippet": "The risk controls were reviewed...",
      "match_start": 4,
      "match_end": 17,
      "text_item_index": 3,
      "bounding_box": { "left": 72, "bottom": 620, "right": 280, "top": 632 },
      "bounding_box_level": "text_item",
      "provenance": {
        "engine": "pdfjs",
        "source": "text-content"
      }
    }]
  }]
}
```

## Invariants

- Search is literal only; no regex execution from request payloads.
- If no source page range is provided, search starts from page 1 and is bounded
  by `max_pages`.
- `max_pages` defaults to 100 and is capped at 1000 per source.
- `max_matches_per_source` defaults to 50 and is capped at 500.
- `context_chars` defaults to 120 and is capped at 1000.
- Whole-word matching uses ASCII word boundaries.
- Bounding boxes are best-effort text-item boxes, not character-perfect boxes.
- Each source result preserves success/failure isolation.
- Search output contains no image bytes.

## Follow-On Work

- Search over OCR text layers after OCR/document-map fusion is designed.
- Optional `get_evidence` tool for resolving match IDs or element IDs into
  visual crops without repeating bbox arguments manually.
- Persistent local indexes only if repeated-agent workloads justify the
  operational overhead.

## Acceptance Criteria

- `search_pdf` validates source, query, page cap, match cap, context, and match
  mode inputs.
- Unit tests cover page resolution, literal matching, whole-word matching,
  case-sensitive matching, snippets, match IDs, and bbox provenance.
- MCP stdio and HTTP tool lists expose `search_pdf`.
- Integration tests call `search_pdf` through the built server.
- Full validation passes before merge.
