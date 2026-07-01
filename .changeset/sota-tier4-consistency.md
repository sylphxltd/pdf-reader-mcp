---
"@sylphx/pdf-reader-mcp": patch
---

Add GHCR Docker publish workflow, fix CONTRIBUTING.md staleness, fix copyright consistency.

- New `.github/workflows/docker.yml` — builds and pushes Docker image to GitHub Container Registry on main push and version tags, so the `ghcr.io/sylphxai/pdf-reader-mcp` reference resolves to a real image
- Rewrote `CONTRIBUTING.md` — fixed stale org name (sylphlab → SylphxAI), corrected tooling references (ESLint/Prettier → Biome), corrected commands (npm → bun), added development setup and release process guidance
- Fixed VitePress footer copyright (2024 Sylphx → 2024-2026 SylphxAI)
- Updated README Docker section to show both GHCR pre-built image and local build
