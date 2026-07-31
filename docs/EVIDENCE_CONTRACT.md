# Evidence contract — product-specific

**Evidence First** means results carry citeable structure. There is **no** MCP tool named `evidence_first`.

## Locators and honesty for this product

- page number
- table/cell indices when extracted
- bbox / region when visual/OCR
- source path + document hash when available
- warnings for OCR/ conf / partial parse

## Always include when applicable

- **route**: which local engine path produced the payload
- **warnings**: missing binaries, partial parse, network/adapter limits
- raw facts over generative rewrite as authority

## Non-goals

- Requiring a cloud model to “confirm” local facts
- Over-marketing Evidence First without locators on the wire
