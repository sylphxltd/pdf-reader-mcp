---
"@sylphx/pdf-reader-mcp": patch
---

Consolidate last remaining duplicate geometry helpers.

- Remove local `roundRatio` from `documentModel.ts` and `ocr.ts` — now import from `utils/geometry.ts`
- Remove local `mergeBoxes` from `documentModel.ts` — replaced with `mergeBoundingBoxes` from `utils/geometry.ts`
- Remove local `mergeBoundingBoxes` from `search.ts` — now imports from `utils/geometry.ts`

After this change there is exactly ONE definition of each geometry helper:
- `roundRatio`: 1 (was 3)
- `mergeBoundingBoxes`: 1 (was 3 counting `mergeBoxes`)
- Zero local duplicates remain.

377 tests pass. No behavior changes.
