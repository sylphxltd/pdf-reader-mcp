# Fast Trunk CI

## Authority split

| Concern | Owner |
| --- | --- |
| Work / claim / review | Enact |
| Source history | Git |
| Source correctness | This repository CI (`source-ci/pass`) |
| Production artifact build | Sylphx Platform (once) |
| Deploy / health / rollback | Sylphx Platform |

## Paths

- **Internal agents:** small-batch non-force direct-trunk to default branch.
- **External contributors:** Pull Request presubmit feedback.
- **Merge Queue:** default off (no `merge_group` trigger).

## CI scope

Blocking: lint/typecheck, affected tests, schema/migration safety, narrow security.

Not in source CI: production Docker/release image builds, disposable ship binaries for ordinary tips.
