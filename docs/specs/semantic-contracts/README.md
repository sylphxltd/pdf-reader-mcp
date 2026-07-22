# Semantic contracts (ADR-0005)

Executable capability contracts for capability-first admission.

## Active contracts

- `interface-mcp-surface`
- `semantic-read-text-citation`
- `semantic-table-structure`
- `semantic-search-relevance`
- `semantic-outline-headings`
- `semantic-form-fields`
- `semantic-annotations`
- `security-resource-bounds`

## Validation

```bash
bun run check:semantic-contracts
bun run check:agent-task-corpus
bun run test:agent-task-smoke
bun run test:agent-task-eval
```
