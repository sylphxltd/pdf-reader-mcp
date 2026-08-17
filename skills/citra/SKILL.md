# Citra — PDF evidence for agents

## Install

```bash
npm i -g @sylphx/citra
# or
npx @sylphx/citra
```

## Tools

| Tool | Job |
| --- | --- |
| `read_pdf` | Agent Document Twin (structure, tables, citations) |
| `search_pdf` | Literal search with page/bbox evidence |
| `pdf_evidence` | inspect / render / crop / OCR follow-ups |

## SDK

```ts
import { Citra } from '@sylphx/citra/sdk'
const citra = Citra.create()
const result = await citra.read({ sources: [{ path: '/abs/doc.pdf' }] })
```

## Rules

- Local-first; no API key required for default path
- Missing native binary → fail closed
- Evidence on results (envelope v1); no `evidence_first` tool
- Do not install Prism for PDF routing
