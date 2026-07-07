# Project Control Gate

PDF Reader MCP keeps project-control facts in two source files:

- `project.manifest.json` is the vendor-neutral GroundAtlas project control
  file.
- `.doctrine/project.json` is the Sylphx Doctrine adapter and local governance
  catalog.

Generated `.groundatlas*` outputs plus GroundAtlas JSON and Markdown reports are
evidence/read models only. They must not be edited or treated as source of
truth.

## Required CI Behavior

The CI workflow must run a single GroundAtlas dogfood job on pull requests,
merge-group candidates, and `main` pushes. That job must use:

- `SylphxAI/groundatlas@v0.1.3`;
- `groundatlas@0.1.3`;
- `require-atlas: "true"`;
- `strict: "true"`.

The assertion step must prove:

- selected manifest path is `project.manifest.json`;
- selected manifest `adapter=false`;
- `.doctrine/project.json` remains an adapter with `adapter=true`;
- fleet summary is `1 adopted, 0 warning, 0 blocked, 1 total`;
- Markdown scorecard includes `# GroundAtlas fleet adoption report`;
- Markdown scorecard includes
  `Summary: 1 adopted, 0 warning, 0 blocked, 1 total.`

The `groundatlas-package-dogfood` artifact must include:

- `groundatlas-manifest.json`;
- `groundatlas-fleet.json`;
- `groundatlas-fleet.md`.

## Validation

Control-plane-only changes should run:

```bash
bun test test/project-control.test.ts
npm exec --yes --package groundatlas@0.1.3 -- ga audit --out .groundatlas-pilot
npm exec --yes --package groundatlas@0.1.3 -- ga manifest --out .groundatlas-pilot --json
npm exec --yes --package groundatlas@0.1.3 -- ga fleet . --out .groundatlas-pilot --require-atlas --strict --json
npm exec --yes --package groundatlas@0.1.3 -- ga fleet . --out .groundatlas-pilot --require-atlas --strict
git diff --check
```
