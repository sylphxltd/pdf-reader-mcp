# Project Control Ingestion

PDF Reader MCP keeps project-control facts in two source files:

- `project.manifest.json` is the vendor-neutral GroundAtlas project control
  file.
- `.doctrine/project.json` is the Sylphx Doctrine adapter and local governance
  catalog.

Generated inventory and reports are evidence/read models only. They must not be
edited or treated as source of truth.

## Current Control

Control Plane ADR-0014 retired the repository-local GroundAtlas package dogfood
job and assigned repository-intelligence ownership to Control Plane Repository
Ingestion. Do not re-add a required GroundAtlas package/action job to this
repository. The ownership decision is not a live central ingestion receipt.

The local contract is:

- keep both manifest files valid JSON and semantically aligned through focused
  local readback;
- keep `project.manifest.json` vendor-neutral;
- keep `.doctrine/project.json` as the Sylphx Doctrine adapter;
- fail tests if the retired package gate is reintroduced.

## Validation

Control-plane-only changes should run:

```bash
bun test test/project-control.test.ts
git diff --check
```
