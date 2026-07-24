# Release closeout — @sylphx/pdf-reader-mcp@4.0.2

Date: 2026-07-24  
Status: **channels live; production dependency closure proven; performance claims withheld; goal complete false**

## Live identities

| Surface | Value |
| --- | --- |
| npm latest | `4.0.2` |
| npm gitHead | `6fd429558955d31b1310932640b2f316bf0dc299` |
| implementation candidate | `afb1aa3387dc3b4e10b9415d31dfea8844b3a89a` |
| independent review | `verification/pdf-reader-whole-product-independent-review-4.0.2-afb1aa3.json` |
| GitHub Release | [v4.0.2](https://github.com/SylphxAI/pdf-reader-mcp/releases/tag/v4.0.2) |
| MCP Registry | `4.0.2` active + isLatest |
| five-host registry proof | [run 30092324925](https://github.com/SylphxAI/pdf-reader-mcp/actions/runs/30092324925) |

## Proven

- Empty production `dependencies`
- Clean install has **no** `pdfjs-dist` / MCP TS SDK
- All five native tarballs HTTP 200 and registry install+initialize green
- Force-TS fail-closed; missing native fail-closed

## Still open for product goal complete

- Admissible same-host TS 3.0.14 vs Rust performance advantage + independent `performanceClaimsAuthorized`
- Successor review with `goalCompleteAuthorized=true` only after that evidence

## Prefer 4.0.2 over 4.0.1

`linux-x64-gnu@4.0.1` was tombstoned after a broken tarball repair attempt.
