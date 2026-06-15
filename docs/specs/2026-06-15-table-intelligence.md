# Table Intelligence V3

Date: 2026-06-15
Status: shipped

## Goal

Make deterministic table extraction more useful for agents without introducing
a heavy visual table recognition dependency. The table contract should tell an
agent not only what rows were extracted, but also how trustworthy the grid is,
which cells were inferred, and whether adjacent pages look like the same table.

## Contract

When `include_tables` is enabled, each extracted table may include:

- `cells[].rowSpan` and `cells[].colSpan` with conservative inferred span
  hints.
- `cells[].isHeader` for the first detected row.
- `cells[].inferred` when the grid cell exists because the table model inferred
  an empty slot.
- `quality.completeness`, `nonEmptyCellRatio`, `rowAlignment`, and
  `rowSpacingConsistency`.
- `quality.missingCellCount` and `quality.mergedCellCandidateCount`.
- `quality.signals` and `quality.warnings` for sparse, merged, irregular,
  low-confidence, or continuation-candidate tables.
- `continuation` candidates linking repeated-header tables on adjacent pages.

The existing `rows`, Markdown rendering, table chunks, and document map element
IDs remain backward compatible.

## Boundaries

This is a deterministic text-coordinate model. It does not claim to perform
full visual table structure recognition, non-repeated continuation recovery, or
ML-grade row/column span reconstruction. Those belong behind an optional visual
table provider that can enrich the same table contract later.

## Agent Workflow

Agents should use table quality signals as routing metadata:

- High completeness and complete-grid signals can be used directly for routine
  RAG and summarization.
- Sparse, merged, irregular, or low-confidence warnings should trigger
  `extract_regions` or `render_page` for source verification.
- Continuation candidates should be treated as linked evidence, not as a
  merged logical table unless the caller confirms that behavior.

## Acceptance Criteria

- Table cells expose header/span/inference hints without changing existing
  row arrays.
- Sparse tables expose missing-cell and inferred-cell warnings.
- Wide text boxes crossing column boundaries expose merged-cell candidate
  signals.
- Repeated headers on adjacent pages expose continuation candidates.
- `read_pdf` table summaries and the agent document map preserve the new
  quality metadata.
