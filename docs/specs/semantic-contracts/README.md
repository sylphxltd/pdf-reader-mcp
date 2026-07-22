# Semantic capability contracts

These contracts implement ADR-0005 capability-first admission.

- `schema.json` — machine schema for every contract
- `*.json` contracts — active requirements by layer
- Exact PDF.js JSON equality is not required unless a frozen residual family
  still claims it
- Closure evidence is suite-backed (`evidence.suites`) and/or agent-task corpus

Validate with:

```bash
bun run check:semantic-contracts
```
