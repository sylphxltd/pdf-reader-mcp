# Agent-task corpus (ADR-0005)

Quality-parity corpus for capability-first admission.

## Rules

- Same tasks run against TS 3.0.14 baseline and pure-Rust candidate.
- Thresholds come from **measured** TS baseline metrics.
- Invented absolute percentage thresholds are forbidden.
- Exact PDF.js JSON equality is not required.

## Task classes (local)

- extract passage / table / search / fail-closed pages
- outline / forms / annotations
- visual candidates (provider-independent)
- OCR text layer (mock command provider)
- visual enrichment + Document Map fusion (configured command provider)

## Commands

```bash
bun run check:agent-task-corpus
bun run test:agent-task-smoke
bun run test:agent-task-eval:calibrate
bun run test:agent-task-eval
```

## Status

`local-calibrated-with-ocr-visual`. Public URL corpus remains follow-on work before unfreeze.
