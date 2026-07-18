# ADR 0003: Dogfood GroundAtlas 0.1.3 Scorecard Gate

## Status

Superseded by Control Plane ADR-0014.

## Context

PDF Reader MCP already adopted a vendor-neutral `project.manifest.json` and kept
`.doctrine/project.json` as the Sylphx-specific adapter. The original
GroundAtlas package gate used `groundatlas@0.1.2`, which emitted machine-readable
JSON evidence but did not require the Markdown fleet scorecard introduced in
GroundAtlas 0.1.3.

The repository is a public local-first MCP package. The project-control gate
must prove package/adoption boundaries without changing runtime PDF behavior,
provider routing, credentials, package artifacts, npm publication, or customer
data handling.

## Decision

Use `SylphxAI/groundatlas@v0.1.3` with `groundatlas@0.1.3` in CI and treat the
Markdown fleet scorecard as first-class delivery evidence.

The CI gate must assert:

- GroundAtlas selects `project.manifest.json` as the vendor-neutral control
  file.
- The selected manifest is not an adapter.
- `.doctrine/project.json` is reported only as an adapter.
- The strict fleet summary is `1 adopted, 0 warning, 0 blocked, 1 total`.
- The Markdown scorecard contains the GroundAtlas fleet report title and
  adopted summary.

The uploaded `groundatlas-package-dogfood` artifact must include:

- `groundatlas-manifest.json`;
- `groundatlas-fleet.json`;
- `groundatlas-fleet.md`.

Generated `.groundatlas*` outputs and GroundAtlas JSON/Markdown reports remain
evidence/read models only. They are not project-control source of truth.

## Consequences

- Human-readable fleet scorecards are available in CI artifacts and GitHub step
  summaries.
- Public and internal agents can verify the GroundAtlas/Doctrine SSOT split from
  generated evidence without treating generated reports as authoritative inputs.
- Dependabot PR #360 is superseded because it only bumped the action reference;
  this ADR requires the package spec, assertions, and artifact upload to move
  together.

## Supersession

Control Plane ADR-0014 retired repository-local GroundAtlas package dogfood in
favor of central Repository Ingestion. The historical evidence above remains
part of the decision record, but it is no longer a current CI requirement.
`project.manifest.json` and `.doctrine/project.json` remain local semantic
authorities; central inventory and reports remain derived read models.
