---
"@sylphx/pdf-reader-mcp": patch
---

Add GitHub Pages docs deployment workflow, examples directory with Agent Document Twin demo outputs and MCP client snippets, shareable benchmark proof page, and updated docs site navigation.

- New `.github/workflows/docs.yml` deploys the VitePress docs site to GitHub Pages on every push to main.
- New `examples/` directory with JSON request/response samples for all V3 tools (read_pdf, search_pdf, pdf_evidence) and MCP client installation snippets for Claude Code, Claude Desktop, Cursor, VS Code, Windsurf, Cline, Warp, and HTTP transport.
- New `docs/benchmark.md` page with reproducible release evidence: 39/39 SOTA release gate checks, 69/69 quality checks, and performance benchmarks.
- Updated VitePress config: benchmark page in nav and sidebar, corrected og:url and canonical for GitHub Pages.
- Updated README documentation table with examples and benchmark links.
