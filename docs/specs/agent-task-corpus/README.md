# Agent-task corpus

Capability-first quality parity corpus for ADR-0005.

- `manifest.json` — corpus index and calibration policy
- `tasks/*.json` — executable task definitions
- Local fixtures only for smoke; public URL corpus stays opt-in

Validate:

```bash
bun run check:agent-task-corpus
bun run test:agent-task-smoke
```

Unfreeze requires calibrated TS-baseline thresholds on a broader corpus, not
only this smoke scaffold.
