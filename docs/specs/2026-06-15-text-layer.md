# Text Layer

Date: 2026-06-15
Status: implemented

## Goal

Expose a deterministic PDF text layer for agents that need line and word
references with page-level character ranges, best-effort bounding boxes, and
provenance.

This complements `full_text`, `chunks`, and `elements`: it keeps text evidence
addressable without forcing agents to parse plain strings or raw page content.

## Non-goals

- Do not claim glyph-perfect character geometry.
- Do not expose raw PDF.js internals.
- Do not force `full_text` or `page_contents` into JSON.
- Do not run OCR, vision, or external engines.

## Public API

`read_pdf` accepts:

```json
{
  "sources": [{ "path": "document.pdf", "pages": "1-5" }],
  "include_text_layer": true,
  "include_full_text": false
}
```

The response includes `text_layer`:

```json
{
  "version": "2026-06-15",
  "profile": "pdf_text_layer",
  "pages": [{
    "page": 1,
    "text": "Revenue growth",
    "char_count": 14,
    "line_count": 1,
    "word_count": 2,
    "lines": [{
      "id": "p1-line-1",
      "index": 0,
      "text": "Revenue growth",
      "char_start": 0,
      "char_end": 14,
      "words": []
    }]
  }],
  "summary": {
    "selected_pages": [1],
    "page_count": 1,
    "line_count": 1,
    "word_count": 2,
    "char_count": 14,
    "lines_with_bounding_boxes": 1,
    "words_with_bounding_boxes": 2
  }
}
```

## Geometry Policy

- Line boxes come from the existing extracted text-content item bounding boxes.
- Word boxes are estimated proportionally inside the line box because PDF.js
  text-content items do not always expose per-word geometry.
- Character ranges are page-level offsets into `text_layer.pages[*].text`.
- Lines are separated by `\n` in page text, and word ranges account for those
  separators.

## Acceptance Criteria

- `include_text_layer` validates as an optional boolean.
- `read_pdf` can return `text_layer` without `full_text` or raw
  `page_contents`.
- Unit tests cover line records, word records, character ranges, and estimated
  word boxes.
- Handler tests cover the public flag and response-shape isolation.
- Quality evals include text-layer line/word/character reference coverage.
