# Release closeout — @sylphx/pdf-reader-mcp@4.0.2

Date: 2026-07-24  
Status: **channels live; production dependency closure proven; bounded performance claims authorized; goal complete true (successor review)**

## Live identities

| Surface | Value |
| --- | --- |
| npm latest | `4.0.2` |
| npm gitHead | `6fd429558955d31b1310932640b2f316bf0dc299` |
| implementation candidate | `afb1aa3387dc3b4e10b9415d31dfea8844b3a89a` |
| independent review (packaging) | `verification/pdf-reader-whole-product-independent-review-4.0.2-afb1aa3.json` |
| independent review (perf/goal) | `verification/pdf-reader-whole-product-independent-review-4.0.2-perf-16fc2eb.json` |
| GitHub Release | [v4.0.2](https://github.com/SylphxAI/pdf-reader-mcp/releases/tag/v4.0.2) |
| MCP Registry | `4.0.2` active + isLatest |
| five-host registry proof | [run 30092324925](https://github.com/SylphxAI/pdf-reader-mcp/actions/runs/30092324925) |

## Proven

- Empty production `dependencies`
- Clean install has **no** `pdfjs-dist` / MCP TS SDK
- All five native tarballs HTTP 200 and registry install+initialize green
- Force-TS fail-closed; missing native fail-closed

## Product goal status

- Successor independent review authorized bounded performance claims and goal complete.
- See `verification/pdf-reader-whole-product-independent-review-4.0.2-perf-16fc2eb.json`.

## Prefer 4.0.2 over 4.0.1

`linux-x64-gnu@4.0.1` was tombstoned after a broken tarball repair attempt.

## Successor independent review (post closeout draft)

- Artifact: `verification/pdf-reader-whole-product-independent-review-4.0.2-perf-16fc2eb.json`
- Suite: `verification/pdf-reader-same-host-ab-suite-4.0.2.json` status=`admissible_pass`
- `performanceClaimsAuthorized`: true (bounded same-host claims only)
- `goalCompleteAuthorized`: true for the stated 4.0.2 objective
- Policy: `docs/specs/performance/4.0.2-performance-claims-policy.md`
