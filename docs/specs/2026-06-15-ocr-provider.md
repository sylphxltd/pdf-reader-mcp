# OCR Provider

Date: 2026-06-15
Status: active

## Goal

Give agents a real scanned-page path without making OCR models, Python, Java,
remote services, or native OCR binaries mandatory for the default TypeScript
package.

`ocr_pages` renders selected PDF pages with the existing visual evidence path,
passes each temporary PNG to an explicitly configured local OCR command, and
returns a normalized OCR text layer with provenance.

## Non-Goals

- Do not bundle an OCR engine in the default package.
- Do not let MCP request payloads choose arbitrary commands.
- Do not claim OCR accuracy until scanned fixtures and benchmarks are public.
- Do not embed rendered page image bytes in the JSON OCR response.
- Do not merge OCR output into `read_pdf` text until confidence, provenance,
  and conflict rules are designed.

## Public Contract

`ocr_pages` accepts the same source shape as `read_pdf`:

```json
{
  "sources": [{ "path": "scan.pdf", "pages": "1-3" }],
  "scale": 2,
  "max_pages": 3,
  "languages": ["eng"]
}
```

The first content part is JSON:

```json
{
  "profile": "ocr_text_layer",
  "ocr_options": {
    "scale": 2,
    "max_pages": 3,
    "max_pixels_per_page": 16000000,
    "timeout_ms": 60000,
    "max_output_chars": 200000,
    "languages": ["eng"]
  },
  "results": [{
    "source": "scan.pdf",
    "success": true,
    "num_pages": 12,
    "ocr_pages": [{
      "page": 1,
      "text": "Recognized text",
      "confidence": 0.93,
      "language": "eng",
      "provider": "command",
      "source_render_evidence_id": "page-1-render-scale-2",
      "provenance": {
        "engine": "external-command",
        "source": "ocr-provider"
      },
      "words": [{
        "text": "Recognized",
        "confidence": 0.95,
        "bounding_box": { "left": 10, "bottom": 20, "right": 90, "top": 40 }
      }]
    }]
  }]
}
```

## Provider Configuration

The command provider is enabled by process environment:

| Variable | Meaning |
|---|---|
| `MCP_PDF_OCR_PRESET` | Optional built-in command template. Supported value: `tesseract`. |
| `MCP_PDF_OCR_COMMAND` | Required command path or executable name unless a preset is set. Overrides the preset command when both are set. |
| `MCP_PDF_OCR_ARGS_JSON` | Optional JSON string array. Must include `{input}`. Defaults to the preset template or `["{input}"]`. |

Arguments support these placeholders:

| Placeholder | Value |
|---|---|
| `{input}` | Temporary rendered PNG path for the current page. |
| `{page}` | 1-indexed PDF page number. |
| `{source}` | Source path or URL string. |
| `{language}` | First requested language tag, or an empty string. |
| `{languages}` | Comma-separated requested language tags, or an empty string. |
| `{languages_tesseract}` | `+`-separated requested language tags, or `eng` when no language is requested. |

Provider stdout may be plain text or JSON with `text`, `confidence`,
`language`, and `words`. Confidence values above 1 are treated as percentages
and normalized to 0-1.

## Invariants

- OCR is disabled unless `MCP_PDF_OCR_COMMAND` or a supported
  `MCP_PDF_OCR_PRESET` is set.
- Command execution uses `execFile`, not shell interpolation.
- `MCP_PDF_OCR_PRESET=tesseract` resolves to
  `tesseract {input} stdout -l {languages_tesseract}` without bundling
  Tesseract or language data.
- Temporary rendered PNG files are written under the OS temp directory and
  removed after each page attempt.
- `max_pages` defaults to 5 and is capped by schema at 20 per source.
- `max_pixels_per_page` defaults to 16MP and is capped by schema at 64MP.
- `timeout_ms` applies per page and defaults to 60 seconds.
- `max_output_chars` truncates excessive OCR text with a warning.
- Each source result preserves success/failure isolation.
- OCR output links to `source_render_evidence_id` rather than embedding image
  data in JSON.

## Follow-On Work

- Additional provider presets for common local engines such as PaddleOCR
  wrappers, without making them default dependencies.
- Scanned PDF fixtures with expected text and confidence envelopes.
- OCR accuracy and latency benchmarks reported separately from parser speed.
- Optional crop-level OCR once page-level OCR quality gates are stable.
- Fusion policy for when OCR text should enrich the agent document map.

## Acceptance Criteria

- `ocr_pages` validates source, scale, page, timeout, output, and language
  inputs.
- MCP stdio and HTTP tool lists expose `ocr_pages`.
- Handler responses include `profile: "ocr_text_layer"`.
- Unit tests cover configured-provider detection, JSON output normalization,
  and curated missing-provider errors.
- Integration tests call `ocr_pages` through the built server with a mock
  provider.
- Full validation passes before merge.
