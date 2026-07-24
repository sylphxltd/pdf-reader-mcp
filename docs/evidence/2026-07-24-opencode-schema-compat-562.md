# Evidence: OpenCode / Fireworks tool-schema compatibility (#562)

## Problem
Published MCP `tools/list` inputSchema for PDF sources used:

```json
"oneOf": [
  {"required": ["path"], "not": {"required": ["url"]}},
  {"required": ["url"], "not": {"required": ["path"]}}
]
```

Fireworks (via OpenCode + Kimi) rejects:

> JSON Schema not supported: could not understand the instance
> `{'not': {'required': ['url']}, 'required': ['path']}`

## Fix
- Remove client-visible `oneOf`/`not` exclusive constructs from `PdfSource` and
  `PdfEvidenceSource` schemars annotations.
- Keep hard runtime validation: exactly one of `path` or `url`.
- Document the exclusive locator requirement in field descriptions.

## Non-goals
- Do not weaken path|url security policy.
- Do not archive/delete the issue; reopen and fix.
