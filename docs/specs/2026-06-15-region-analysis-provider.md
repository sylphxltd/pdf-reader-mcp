# Visual Region Analysis Provider

Date: 2026-06-15
Status: shipped

`analyze_regions` turns focused PDF crops into normalized local-provider
enrichment. It is the provider boundary for visual table recognition,
chart-to-data extraction, formula recognition, figure descriptions, and image
captions.

The default package does not bundle a vision model. A request cannot select an
executable. Operators enable the provider with environment variables:

- `MCP_PDF_REGION_ANALYSIS_COMMAND`
- `MCP_PDF_REGION_ANALYSIS_ARGS_JSON`

The args template must include `{input}` and may also use `{page}`, `{source}`,
`{region_id}`, `{evidence_id}`, `{left}`, `{bottom}`, `{right}`, `{top}`,
`{language}`, and `{languages}`.

## Request

`analyze_regions` accepts the same region source shape as `extract_regions`:

```json
{
  "sources": [{
    "path": "documents/report.pdf",
    "regions": [{
      "id": "chart-1",
      "page": 2,
      "bounding_box": { "left": 72, "bottom": 240, "right": 540, "top": 520 },
      "padding": 8
    }]
  }],
  "scale": 2,
  "max_regions": 10,
  "languages": ["eng"]
}
```

The server renders each requested page within `max_pixels_per_page`, crops the
requested PDF-coordinate bbox, writes the temporary PNG to disk, invokes the
configured provider, then deletes the temporary directory.

## Provider Output

Provider stdout may be plain text or JSON. JSON output can include:

```json
{
  "kind": "table",
  "description": "Quarterly revenue table",
  "text": "Q1 revenue...",
  "markdown": "| Quarter | Revenue |",
  "confidence": 0.91,
  "table": {
    "rows": [["Quarter", "Revenue"], ["Q1", "$1.2M"]],
    "markdown": "| Quarter | Revenue |",
    "csv": "Quarter,Revenue\nQ1,$1.2M",
    "confidence": 0.9
  },
  "formula": {
    "latex": "E = mc^2",
    "text": "E equals m c squared",
    "confidence": 0.82
  },
  "chart": {
    "title": "Revenue by quarter",
    "summary": "Revenue rises across the period.",
    "data_points": [{ "label": "Q1", "value": 1.2 }],
    "confidence": 0.78
  },
  "warnings": ["Low contrast axis labels"]
}
```

Supported `kind` values are `text`, `table`, `figure`, `chart`, `formula`,
`image`, `diagram`, and `unknown`. Unknown provider values are normalized to
`unknown` with a warning. Confidence values are clamped to `0..1`.

## Response

The first content part is JSON:

```json
{
  "profile": "region_analysis",
  "analysis_options": {
    "scale": 2,
    "max_regions": 20,
    "max_pixels_per_page": 16000000,
    "timeout_ms": 60000,
    "max_output_chars": 200000
  },
  "results": [{
    "source": "documents/report.pdf",
    "success": true,
    "num_pages": 8,
    "region_analyses": [{
      "region_id": "chart-1",
      "page": 2,
      "kind": "chart",
      "description": "Revenue chart",
      "provider": "command",
      "source_crop_evidence_id": "page-2-chart-1-crop-scale-2",
      "provenance": {
        "engine": "external-command",
        "source": "region-analysis-provider"
      }
    }]
  }]
}
```

Every analyzed region includes the crop evidence ID, source bounding box, crop
pixel bounds, scale, provider, and provenance. The JSON response does not
duplicate cropped image base64.

## Non-Goals

- No bundled model weights.
- No request-controlled command execution.
- No claim of PDF/UA, scientific formula, or chart extraction certification.
- No benchmark claim for a provider unless the configured engine and fixture set
  are reported separately.
