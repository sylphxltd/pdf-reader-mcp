# Project Control

PDF Reader MCP keeps project-control facts in one machine file plus a human
projection:

- `project.manifest.json` — machine fact authority (project-manifest-standard v2)
- `PROJECT.md` — short human projection of the same facts
- `AGENTS.md` — local agent hazards and commands only

Static instruction SSOT is [SylphxAI/skills](https://github.com/SylphxAI/skills).
Doctrine, Mission Control, and GroundAtlas package/action dogfood are retired
historical lineage and must not be restored as machine truth or CI gates.

Generated inventory, verification JSON under `verification/`, and Markdown
scorecards are evidence/read models only. They must not be edited as source of
truth.

## Current Control

Control Plane ADR-0014 retired the repository-local GroundAtlas package dogfood
job. This repository additionally retires any Doctrine adapter file as a live
control surface.

The local contract is:

- keep `project.manifest.json` valid against the active project-manifest schema
  shape used by this repo (schemaVersion 2);
- keep `PROJECT.md` / `AGENTS.md` pointing only at Skills + that manifest;
- fail tests if a Doctrine machine-truth path or GroundAtlas package dogfood CI
  job is reintroduced;
- record adoption as typed gaps — never author `adopted` while gaps remain.

## Validation

Control-plane-only changes should run:

```bash
bun test test/project-control.test.ts
git diff --check
```
