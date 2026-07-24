# Product demos

These are the shareable agent workflows for PDF Reader MCP.

| Demo | File | Story |
| --- | --- | --- |
| Smart read | [`../read-pdf-basic.json`](../read-pdf-basic.json) | One call → Agent Document Twin |
| Tables | [`../read-pdf-options.json`](../read-pdf-options.json) | Explicit table/structure extraction |
| Search then verify | [`../search-then-verify.json`](../search-then-verify.json) | Find evidence, then crop/verify |
| OCR scan | [`../ocr-scanned.json`](../ocr-scanned.json) | Scanned page path |
| Visual crop | [`../evidence-crop.json`](../evidence-crop.json) | Citation crop |

## One-liner pitch

Plain-text PDF tools make agents guess. PDF Reader MCP gives them evidence.

## Install

```bash
npm install -g @sylphx/pdf-reader-mcp
claude mcp add pdf-reader -- npx @sylphx/pdf-reader-mcp
```
