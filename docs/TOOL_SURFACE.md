# Tool surface — this product

Policy: **few, powerful, obvious** tools. Prefer the primary read tool first.

| Tool / op | Role |
| --- | --- |
| `read_pdf` | Primary structured PDF read (text, tables, map, citations) |
| `render_page` | Page render evidence |
| `ocr_pages` | OCR evidence for scanned pages |
| CLI `citra` / `pdf-reader-mcp` | Human/script surface |
| SDK `@sylphx/pdf-reader-mcp/sdk` | Programmatic API |

## Rules

1. Do not add near-duplicate tools that only differ by vanity naming.
2. Advanced tools must be labeled advanced in README/skill.
3. Schema fields should be agent-obvious; fail closed on unsafe input.
4. Composition with sibling products is via public contracts, not monorepo imports.
