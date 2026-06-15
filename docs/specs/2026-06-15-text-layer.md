# Text Layer

Date: 2026-06-15
Status: implemented

## Goal

Expose a deterministic PDF text layer for agents that need run, line, word, and
character references with page-level character ranges, best-effort bounding
boxes, and provenance.

This complements `full_text`, `chunks`, and `elements`: it keeps text evidence
addressable without forcing agents to parse plain strings or raw page content.

## Non-goals

- Do not claim glyph-perfect character geometry.
- Do not expose raw PDF.js objects; expose normalized run metadata only.
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
      "runs": [{
        "index": 0,
        "text": "Revenue growth",
        "char_start": 0,
        "char_end": 14,
        "font_name": "g_d0_f1",
        "direction": "ltr",
        "chars": []
      }],
      "chars": [],
      "words": []
    }]
  }],
  "summary": {
    "selected_pages": [1],
    "page_count": 1,
    "run_count": 1,
    "line_count": 1,
    "word_count": 2,
    "char_count": 14,
    "chars_with_bounding_boxes": 14,
    "runs_with_bounding_boxes": 1,
    "lines_with_bounding_boxes": 1,
    "words_with_bounding_boxes": 2
  }
}
```

## Geometry Policy

- Line boxes come from the existing extracted text-content item bounding boxes.
- Run boxes come from PDF.js text-content items.
- Character boxes are estimated proportionally inside each run box because
  PDF.js text-content items do not always expose glyph geometry.
- Word boxes are merged from estimated character boxes when available and fall
  back to proportional line estimates.
- Character ranges are page-level offsets into `text_layer.pages[*].text`.
- Lines are separated by `\n` in page text, and word ranges account for those
  separators.
- Font names, text direction, transform matrices, and end-of-line hints are
  preserved when PDF.js exposes them.

## Acceptance Criteria

- `include_text_layer` validates as an optional boolean.
- `read_pdf` can return `text_layer` without `full_text` or raw
  `page_contents`.
- Unit tests cover run records, line records, word records, character records,
  character ranges, and estimated word boxes.
- Handler tests cover the public flag and response-shape isolation.
- Quality evals include text-layer line/word/character reference coverage.
