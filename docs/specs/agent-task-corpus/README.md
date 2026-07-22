# Agent-task corpus (ADR-0005)

Quality-parity corpus for capability-first admission.

## Rules

- Same tasks run against TS 3.0.14 baseline and pure-Rust candidate.
- Thresholds come from **measured** TS baseline metrics.
- Invented absolute percentage thresholds are forbidden.
- Exact PDF.js JSON equality is not required.

## Commands

```bash
# pure-Rust smoke predicates
bun run test:agent-task-smoke

# measure TS baseline + compare pure-Rust presence floors
bun run test:agent-task-eval:calibrate

# compare pure-Rust against committed measured baseline
bun run test:agent-task-eval
```

## Status

`calibrating` — local fixtures only. OCR/visual/public corpus and five-platform
native install proof remain separate blocking gates before unfreeze.
