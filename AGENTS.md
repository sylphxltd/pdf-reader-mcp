# pdf-reader-mcp — local agent notes only

Static engineering and delivery standards load from the active Skills runtime
([SylphxAI/skills](https://github.com/SylphxAI/skills) is binding instruction
SSOT). Doctrine and Mission Control are retired historical lineage and must not
be loaded as current instruction authority.

Local truth: `PROJECT.md`, `.doctrine/project.json` when present.

## Boundary hazards

- Local-first privacy: do not upload documents or call remote providers unless
- No hosted auth, billing, storage, tenancy, durable work, or customer-account
- No direct provider secrets, Gateway credentials, or product-specific model
- Optional OCR/vision/region providers stay behind typed adapters with
- Public MCP schemas are contracts — version and regression-test option/output
- Preserve page/region/source provenance on extraction and analysis outputs.
- Package publishing is Changesets / bot-owned; do not publish from a human shell
- Never commit secrets, private documents, or customer data.

## Local commands

```bash
bun run typecheck
bun run test
bun run check
bun run build
bun run docs:build
bun test test/project-control.test.ts
```

## Validation notes

- Prefer the **narrowest** affected check before full workspace runs.
- Report layers honestly: local diff · trunk FF · deploy · prod proof (do not collapse).
