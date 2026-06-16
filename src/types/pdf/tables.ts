// PDF table type definitions

import type { BoundingBox } from './geometry.js';

export interface TableCell {
  text: string;
  rowIndex: number;
  colIndex: number;
  rowSpan?: number | undefined;
  colSpan?: number | undefined;
  isHeader?: boolean | undefined;
  inferred?: boolean | undefined;
  bounding_box?: BoundingBox | undefined;
}

export type TableQualitySignal =
  | 'complete_grid'
  | 'missing_cells'
  | 'merged_cell_candidates'
  | 'irregular_row_spacing'
  | 'multi_page_continuation_candidate'
  | 'low_confidence';

export interface TableQuality {
  completeness: number;
  nonEmptyCellRatio: number;
  rowAlignment: number;
  rowSpacingConsistency: number;
  missingCellCount: number;
  mergedCellCandidateCount: number;
  signals: TableQualitySignal[];
  warnings?: string[] | undefined;
}

export interface TableContinuationCandidate {
  groupId: string;
  role: 'starts' | 'continues' | 'ends';
  previousTableId?: string | undefined;
  nextTableId?: string | undefined;
  confidence: number;
  signals: string[];
}

export interface ExtractedTable {
  page: number;
  tableIndex: number;
  rows: string[][]; // 2D array [row][col]
  cells?: TableCell[] | undefined;
  bounding_box?: BoundingBox | undefined;
  rowCount: number;
  colCount: number;
  confidence: number; // 0-1 detection confidence
  quality?: TableQuality | undefined;
  continuation?: TableContinuationCandidate | undefined;
}
