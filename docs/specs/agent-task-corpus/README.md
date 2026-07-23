# Agent-task corpus (ADR-0005)

Quality-parity corpus for capability-first admission.

## Rules

- Same tasks run against TS 3.0.14 baseline and pure-Rust candidate.
- Thresholds come from **measured** TS baseline metrics.
- Invented absolute percentage thresholds are forbidden.
- Exact PDF.js JSON equality is not required.

## Local tasks (default CI)

- extract / table / search / fail-closed
- outline / forms / annotations
- visual candidates / OCR text layer / visual enrichment fusion

```bash
bun run check:agent-task-corpus
bun run test:agent-task-smoke
bun run test:agent-task-eval
```

## Public URL tasks (opt-in)

Source manifest: `corpus/public-url-corpus.json` (PDFs not vendored).

```bash
# download + measure TS baseline + compare pure-Rust
bun run test:agent-task-public-eval:calibrate

# compare pure-Rust using cached PDFs + committed public baseline
bun run test:agent-task-public-eval
```

Requires:

- `MCP_PDF_AGENT_TASK_PUBLIC=true` (or `--public`)
- downloads: `MCP_PDF_CORPUS_ALLOW_DOWNLOADS=true` (or `--allow-corpus-downloads`) when cache is cold

## Status

- local: calibrated
- public-url: opt-in calibrating
