# Citra — PDF evidence for agents

Use Citra when agents need **citeable PDF structure** (text, tables, geometry, OCR) — not plain-text dumps.

## Install

```bash
npm i -g @sylphx/pdf-reader-mcp
# brand bin
citra --help
# MCP
npx @sylphx/pdf-reader-mcp
```

## Surfaces

| Surface | Entry |
| --- | --- |
| SDK | `import { Citra } from '@sylphx/pdf-reader-mcp/sdk'` or `.../citra` |
| CLI | `citra` / `pdf-reader-mcp` |
| MCP | stdio tools (read/structure with page-level evidence) |

## Evidence contract

Results include page/cell/bbox locators and honesty warnings. There is **no** `evidence_first` tool.

## Rules

1. Local-first; native binary for the current platform; fail closed if missing.
2. Prefer structure + evidence over prose summaries.
3. Family knowledge (docs only): https://github.com/SylphxAI/instruments
