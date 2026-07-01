// Table extraction from PDF using spatial clustering of text coordinates

import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {
  BoundingBox,
  ExtractedTable,
  PageContentItem,
  PdfOcrPageData,
  PdfOcrTextLayer,
  TableCell,
  TableExtractionProvenance,
  TableQuality,
  TableQualitySignal,
} from '../types/pdf.js';
import { mergeBoundingBoxes, roundRatio } from '../utils/geometry.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TableExtractor');

// Configuration constants for table detection
const Y_TOLERANCE = 5; // Points tolerance for same-row detection
const COLUMN_GAP_THRESHOLD = 15; // Minimum gap between columns
const MIN_ROWS = 2; // Minimum rows to consider as a table
const MIN_COLS = 2; // Minimum columns to consider as a table
const MIN_ROW_ITEMS = 2; // Minimum items per row to consider for table detection
const PAGE_EDGE_CONTINUATION_BOTTOM_Y = 120;
const PAGE_EDGE_CONTINUATION_TOP_Y = 500;
const COLUMN_GEOMETRY_TOLERANCE = 24;
const CONTINUATION_MIN_GEOMETRY_SIMILARITY = 0.8;

/**
 * Text item with position extracted from PDF
 */
export interface TextItemWithPosition {
  text: string;
  x: number;
  y: number;
  width: number;
  height?: number | undefined;
  bounding_box?: BoundingBox | undefined;
}

/**
 * Row of text items grouped by Y-coordinate
 */
interface TextRow {
  y: number;
  items: TextItemWithPosition[];
}

/**
 * Detected table region before final extraction
 */
interface TableRegion {
  rows: TextRow[];
  columnBoundaries: number[];
  startY: number;
  endY: number;
}

interface AssignedCellAccumulator {
  textParts: string[];
  boundingBoxes: BoundingBox[];
}

const tableId = (table: Pick<ExtractedTable, 'page' | 'tableIndex'>): string =>
  `p${table.page}-table-${table.tableIndex + 1}`;

const tableKey = (page: number, tableIndex: number): string => `${page}:${tableIndex}`;

const tableKeyFromId = (id: string | undefined): string | undefined => {
  const match = /^p(\d+)-table-(\d+)$/u.exec(id ?? '');
  if (!match?.[1] || !match[2]) return undefined;

  return tableKey(Number(match[1]), Number(match[2]) - 1);
};

const buildBoundingBox = (
  x: number,
  y: number,
  width: number,
  height: number | undefined
): BoundingBox | undefined => {
  if (![x, y, width].every(Number.isFinite) || height === undefined || !Number.isFinite(height)) {
    return undefined;
  }

  return {
    left: x,
    bottom: y,
    right: x + Math.max(0, width),
    top: y + Math.max(0, height),
  };
};

const boundingBoxArea = (box: BoundingBox): number =>
  Math.max(0, box.right - box.left) * Math.max(0, box.top - box.bottom);

const boundingBoxIntersectionArea = (a: BoundingBox, b: BoundingBox): number => {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const bottom = Math.max(a.bottom, b.bottom);
  const top = Math.min(a.top, b.top);

  return Math.max(0, right - left) * Math.max(0, top - bottom);
};

const tableOverlapRatio = (a: ExtractedTable, b: ExtractedTable): number => {
  if (!a.bounding_box || !b.bounding_box) return 0;

  const intersection = boundingBoxIntersectionArea(a.bounding_box, b.bounding_box);
  const smallestArea = Math.min(boundingBoxArea(a.bounding_box), boundingBoxArea(b.bounding_box));

  return smallestArea > 0 ? intersection / smallestArea : 0;
};

const isLikelyDuplicateTable = (
  selectableTable: ExtractedTable,
  ocrTable: ExtractedTable
): boolean =>
  selectableTable.page === ocrTable.page && tableOverlapRatio(selectableTable, ocrTable) >= 0.6;

const rebaseOcrTableContinuation = (
  table: ExtractedTable,
  newIdByOldKey: Map<string, string>,
  oldId: string,
  newId: string
): ExtractedTable => {
  if (!table.continuation) return table;

  const previousTableId =
    newIdByOldKey.get(tableKeyFromId(table.continuation.previousTableId) ?? '') ??
    table.continuation.previousTableId;
  const nextTableId =
    newIdByOldKey.get(tableKeyFromId(table.continuation.nextTableId) ?? '') ??
    table.continuation.nextTableId;
  const groupEndpoints = previousTableId
    ? [previousTableId, newId]
    : nextTableId
      ? [newId, nextTableId]
      : undefined;

  return {
    ...table,
    continuation: {
      ...table.continuation,
      groupId: groupEndpoints
        ? `table-continuation-${groupEndpoints[0]}-${groupEndpoints[1]}`
        : table.continuation.groupId.replace(oldId, newId),
      ...(previousTableId ? { previousTableId } : {}),
      ...(nextTableId ? { nextTableId } : {}),
    },
  };
};

const reindexOcrTablesAfterSelectableTables = (
  selectableTables: ExtractedTable[],
  ocrTables: ExtractedTable[]
): ExtractedTable[] => {
  const maxSelectableIndexByPage = new Map<number, number>();
  for (const table of selectableTables) {
    maxSelectableIndexByPage.set(
      table.page,
      Math.max(maxSelectableIndexByPage.get(table.page) ?? -1, table.tableIndex)
    );
  }

  const nextOcrOrdinalByPage = new Map<number, number>();
  const newIdByOldKey = new Map<string, string>();
  const indexedTables = ocrTables.map((table) => {
    const oldId = tableId(table);
    const oldKey = tableKey(table.page, table.tableIndex);
    const ordinal = nextOcrOrdinalByPage.get(table.page) ?? 0;
    nextOcrOrdinalByPage.set(table.page, ordinal + 1);

    const baseIndex = maxSelectableIndexByPage.get(table.page);
    const tableIndex = baseIndex === undefined ? table.tableIndex : baseIndex + 1 + ordinal;
    const indexedTable = tableIndex === table.tableIndex ? table : { ...table, tableIndex };
    newIdByOldKey.set(oldKey, tableId(indexedTable));

    return {
      oldId,
      table: indexedTable,
    };
  });

  return indexedTables.map(({ oldId, table }) =>
    rebaseOcrTableContinuation(table, newIdByOldKey, oldId, tableId(table))
  );
};

export const mergeTableExtractionEvidence = (
  selectableTables: ExtractedTable[],
  ocrTables: ExtractedTable[]
): ExtractedTable[] => {
  const distinctOcrTables = ocrTables.filter(
    (ocrTable) =>
      !selectableTables.some((selectableTable) => isLikelyDuplicateTable(selectableTable, ocrTable))
  );
  const indexedOcrTables = reindexOcrTablesAfterSelectableTables(
    selectableTables,
    distinctOcrTables
  );

  return [...selectableTables, ...indexedOcrTables].sort(
    (a, b) => a.page - b.page || a.tableIndex - b.tableIndex
  );
};

/**
 * Extract text items with X/Y positions from a PDF page
 */
export const extractTextItemsWithPositions = async (
  page: pdfjsLib.PDFPageProxy
): Promise<TextItemWithPosition[]> => {
  const textContent = await page.getTextContent();
  const items: TextItemWithPosition[] = [];

  for (const item of textContent.items) {
    const textItem = item as {
      str: string;
      transform?: number[];
      width?: number;
      height?: number;
    };

    // Skip empty text items
    if (!textItem.str.trim()) continue;

    // Skip items without transform array
    if (!textItem.transform || textItem.transform.length < 6) continue;

    // transform[4] = x position, transform[5] = y position
    const x = textItem.transform[4];
    const y = textItem.transform[5];

    if (x === undefined || y === undefined) continue;

    const height = textItem.height ?? Math.abs(textItem.transform[3] ?? 0);

    items.push({
      text: textItem.str,
      x,
      y,
      width: textItem.width ?? textItem.str.length * 6, // Estimate width if not provided
      ...(height > 0 ? { height } : {}),
      ...(height > 0
        ? {
            bounding_box: buildBoundingBox(x, y, textItem.width ?? textItem.str.length * 6, height),
          }
        : {}),
    });
  }

  return items;
};

/**
 * Cluster text items into rows based on Y-coordinate similarity
 */
export const clusterByY = (
  items: TextItemWithPosition[],
  tolerance: number = Y_TOLERANCE
): TextRow[] => {
  if (items.length === 0) return [];

  // Sort by Y descending (PDF coordinates: higher Y = higher on page)
  const sorted = [...items].sort((a, b) => b.y - a.y);

  const firstItem = sorted[0];
  if (!firstItem) return [];

  const rows: TextRow[] = [];
  let currentRow: TextRow = { y: firstItem.y, items: [firstItem] };

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (!item) continue;

    const yDiff = Math.abs(currentRow.y - item.y);

    if (yDiff <= tolerance) {
      // Same row - add item and update average Y
      currentRow.items.push(item);
    } else {
      // New row - save current and start new
      rows.push(currentRow);
      currentRow = { y: item.y, items: [item] };
    }
  }

  // Don't forget the last row
  rows.push(currentRow);

  // Sort items within each row by X coordinate (left to right)
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
  }

  return rows;
};

/**
 * Detect column boundaries from X-coordinate gaps across rows
 */
export const detectColumnBoundaries = (
  rows: TextRow[],
  gapThreshold: number = COLUMN_GAP_THRESHOLD
): number[] => {
  if (rows.length === 0) return [];

  // Collect all X positions (start of each text item)
  const allXPositions: number[] = [];
  for (const row of rows) {
    for (const item of row.items) {
      allXPositions.push(item.x);
    }
  }

  if (allXPositions.length === 0) return [];

  // Sort and find significant gaps
  allXPositions.sort((a, b) => a - b);

  const firstX = allXPositions[0];
  if (firstX === undefined) return [];

  const boundaries: number[] = [firstX];

  for (let i = 1; i < allXPositions.length; i++) {
    const current = allXPositions[i];
    const previous = allXPositions[i - 1];
    if (current === undefined || previous === undefined) continue;

    const gap = current - previous;
    if (gap >= gapThreshold) {
      // Found a column boundary
      boundaries.push(current);
    }
  }

  return boundaries;
};

const columnIndexForItem = (
  item: TextItemWithPosition,
  columnBoundaries: number[],
  tolerance: number = COLUMN_GAP_THRESHOLD / 2
): number => {
  for (let i = columnBoundaries.length - 1; i >= 0; i--) {
    const boundary = columnBoundaries[i];
    if (boundary !== undefined && item.x >= boundary - tolerance) {
      return i;
    }
  }

  return 0;
};

const assignToTableCells = (
  row: TextRow,
  rowIndex: number,
  columnBoundaries: number[]
): { rowValues: string[]; cells: TableCell[] } => {
  const accumulators: AssignedCellAccumulator[] = Array.from(
    { length: columnBoundaries.length },
    () => ({ textParts: [], boundingBoxes: [] })
  );

  for (const item of row.items) {
    const colIndex = columnIndexForItem(item, columnBoundaries);
    const accumulator = accumulators[colIndex];
    if (!accumulator) continue;

    accumulator.textParts.push(item.text);
    if (item.bounding_box) {
      accumulator.boundingBoxes.push(item.bounding_box);
    }
  }

  const cells = accumulators.map((accumulator, colIndex): TableCell => {
    const boundingBox = mergeBoundingBoxes(accumulator.boundingBoxes);
    const colSpan = inferColumnSpan(boundingBox, colIndex, columnBoundaries);
    const isInferred = accumulator.textParts.length === 0;
    return {
      text: accumulator.textParts.join(' '),
      rowIndex,
      colIndex,
      rowSpan: 1,
      colSpan,
      isHeader: rowIndex === 0,
      inferred: isInferred,
      ...(boundingBox ? { bounding_box: boundingBox } : {}),
    };
  });

  return {
    rowValues: cells.map((cell) => cell.text),
    cells,
  };
};

const inferColumnSpan = (
  boundingBox: BoundingBox | undefined,
  colIndex: number,
  columnBoundaries: number[]
): number => {
  if (!boundingBox) return 1;

  let span = 1;
  for (let nextCol = colIndex + 1; nextCol < columnBoundaries.length; nextCol++) {
    const nextBoundary = columnBoundaries[nextCol];
    if (nextBoundary === undefined) continue;

    if (boundingBox.right >= nextBoundary - COLUMN_GAP_THRESHOLD / 2) {
      span++;
      continue;
    }
    break;
  }

  return Math.max(1, Math.min(span, columnBoundaries.length - colIndex));
};

const rowSpacingConsistency = (rows: TextRow[]): number => {
  if (rows.length < 3) return rows.length >= 2 ? 1 : 0;

  const spacings: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const previousRow = rows[i - 1];
    const currentRow = rows[i];
    if (previousRow && currentRow) {
      spacings.push(Math.abs(previousRow.y - currentRow.y));
    }
  }

  if (spacings.length === 0) return 0;

  const averageSpacing = spacings.reduce((sum, spacing) => sum + spacing, 0) / spacings.length;
  if (averageSpacing <= 0) return 0;

  const variance =
    spacings.reduce((sum, spacing) => sum + (spacing - averageSpacing) ** 2, 0) / spacings.length;
  const standardDeviation = Math.sqrt(variance);

  return roundRatio(Math.max(0, 1 - standardDeviation / averageSpacing));
};

const calculateRowAlignment = (rows: TextRow[], columnBoundaries: number[]): number => {
  if (rows.length === 0 || columnBoundaries.length === 0) return 0;

  const coverage = rows.map((row) => {
    const columns = new Set<number>();
    for (const item of row.items) {
      columns.add(columnIndexForItem(item, columnBoundaries));
    }
    return Math.min(1, columns.size / columnBoundaries.length);
  });

  return roundRatio(coverage.reduce((sum, value) => sum + value, 0) / coverage.length);
};

const buildTableQuality = (
  rows: TextRow[],
  cells: TableCell[],
  columnBoundaries: number[],
  confidence: number
): TableQuality => {
  const nonEmptyCellCount = cells.filter((cell) => cell.text.trim().length > 0).length;
  const cellBoundingBoxCount = cells.filter((cell) => cell.bounding_box !== undefined).length;
  const inferredCellCount = cells.filter((cell) => cell.inferred === true).length;
  const missingCellCount = Math.max(0, cells.length - nonEmptyCellCount);
  const mergedCellCandidateCount = cells.filter((cell) => (cell.colSpan ?? 1) > 1).length;
  const nonEmptyCellRatio = cells.length > 0 ? roundRatio(nonEmptyCellCount / cells.length) : 0;
  const cellBoundingBoxCoverage =
    cells.length > 0 ? roundRatio(cellBoundingBoxCount / cells.length) : 0;
  const inferredCellRatio = cells.length > 0 ? roundRatio(inferredCellCount / cells.length) : 0;
  const rowAlignment = calculateRowAlignment(rows, columnBoundaries);
  const spacingConsistency = rowSpacingConsistency(rows);
  const completeness = roundRatio(nonEmptyCellRatio * rowAlignment);

  const signals: TableQualitySignal[] = [];
  const warnings: string[] = [];

  if (missingCellCount === 0) {
    signals.push('complete_grid');
  } else {
    signals.push('missing_cells');
    warnings.push('Detected empty inferred cells; table may contain sparse or merged structure.');
  }

  if (mergedCellCandidateCount > 0) {
    signals.push('merged_cell_candidates');
    warnings.push('Detected cells whose text boxes cross column boundaries; spans are inferred.');
  }

  if (cellBoundingBoxCoverage < 1) {
    signals.push('incomplete_cell_geometry');
    warnings.push(
      'Some table cells lack bounding boxes; verify the table with region crops when cell-level evidence matters.'
    );
  }

  if (spacingConsistency < 0.75) {
    signals.push('irregular_row_spacing');
    warnings.push(
      'Row spacing is irregular; verify the table with visual evidence when precision matters.'
    );
  }

  if (confidence < 0.65) {
    signals.push('low_confidence');
    warnings.push(
      'Table detector confidence is low; use region crops or page rendering for verification.'
    );
  }

  return {
    completeness,
    nonEmptyCellRatio,
    cellBoundingBoxCoverage,
    inferredCellRatio,
    rowAlignment,
    rowSpacingConsistency: spacingConsistency,
    cellBoundingBoxCount,
    inferredCellCount,
    missingCellCount,
    mergedCellCandidateCount,
    signals,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};

/**
 * Calculate confidence score for table detection
 * Based on regularity of column alignment and row spacing
 */
const calculateConfidence = (rows: TextRow[], columnBoundaries: number[]): number => {
  if (rows.length < MIN_ROWS || columnBoundaries.length < MIN_COLS) {
    return 0;
  }

  let score = 0;
  let checks = 0;

  // Check how many rows have items in most columns
  for (const row of rows) {
    const itemsPerColumn = new Set<number>();
    for (const item of row.items) {
      // Find which column
      for (let i = columnBoundaries.length - 1; i >= 0; i--) {
        const boundary = columnBoundaries[i];
        if (boundary !== undefined && item.x >= boundary - COLUMN_GAP_THRESHOLD / 2) {
          itemsPerColumn.add(i);
          break;
        }
      }
    }
    // Score based on column coverage
    score += itemsPerColumn.size / columnBoundaries.length;
    checks++;
  }

  // Check row spacing regularity
  if (rows.length >= 2) {
    const spacings: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      const prevRow = rows[i - 1];
      const currRow = rows[i];
      if (prevRow && currRow) {
        spacings.push(Math.abs(prevRow.y - currRow.y));
      }
    }

    if (spacings.length > 0) {
      const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
      const variance =
        spacings.reduce((sum, s) => sum + (s - avgSpacing) ** 2, 0) / spacings.length;
      const stdDev = Math.sqrt(variance);

      // Lower variance = more regular = higher score
      const regularityScore = avgSpacing > 0 ? Math.max(0, 1 - stdDev / avgSpacing) : 0;
      score += regularityScore;
      checks++;
    }
  }

  return checks > 0 ? Math.min(1, score / checks) : 0;
};

const normalizedHeader = (table: ExtractedTable): string[] =>
  (table.rows[0] ?? []).map((cell) => cell.trim().toLowerCase()).filter((cell) => cell.length > 0);

const headerSimilarity = (left: ExtractedTable, right: ExtractedTable): number => {
  const leftHeader = new Set(normalizedHeader(left));
  const rightHeader = new Set(normalizedHeader(right));
  if (leftHeader.size === 0 || rightHeader.size === 0) return 0;

  let shared = 0;
  for (const cell of leftHeader) {
    if (rightHeader.has(cell)) shared++;
  }

  return shared / Math.max(leftHeader.size, rightHeader.size);
};

const columnGeometryAnchors = (table: ExtractedTable): number[] | undefined => {
  const anchors: number[] = [];
  for (let colIndex = 0; colIndex < table.colCount; colIndex++) {
    const lefts =
      table.cells
        ?.filter(
          (cell) =>
            cell.colIndex === colIndex && cell.inferred !== true && cell.bounding_box !== undefined
        )
        .map((cell) => cell.bounding_box?.left)
        .filter((left): left is number => left !== undefined) ?? [];

    if (lefts.length === 0) return undefined;
    anchors.push(Math.min(...lefts));
  }

  return anchors;
};

const columnGeometrySimilarity = (left: ExtractedTable, right: ExtractedTable): number => {
  if (left.colCount !== right.colCount) return 0;

  const leftAnchors = columnGeometryAnchors(left);
  const rightAnchors = columnGeometryAnchors(right);
  if (!leftAnchors || !rightAnchors || leftAnchors.length !== rightAnchors.length) return 0;

  const scores = leftAnchors.map((anchor, index) => {
    const rightAnchor = rightAnchors[index];
    if (rightAnchor === undefined) return 0;
    return Math.max(0, 1 - Math.abs(anchor - rightAnchor) / COLUMN_GEOMETRY_TOLERANCE);
  });

  return scores.length > 0
    ? roundRatio(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : 0;
};

const isPageEdgeContinuationCandidate = (current: ExtractedTable, next: ExtractedTable): boolean =>
  current.bounding_box !== undefined &&
  next.bounding_box !== undefined &&
  current.bounding_box.bottom <= PAGE_EDGE_CONTINUATION_BOTTOM_Y &&
  next.bounding_box.top >= PAGE_EDGE_CONTINUATION_TOP_Y;

const tableContinuationEvidence = (
  current: ExtractedTable,
  next: ExtractedTable
): { confidence: number; signals: string[] } | undefined => {
  const similarity = headerSimilarity(current, next);
  if (similarity >= 0.6) {
    return {
      confidence: roundRatio(0.55 + similarity * 0.4),
      signals: ['same_column_count', 'repeated_header_candidate'],
    };
  }

  const geometrySimilarity = columnGeometrySimilarity(current, next);
  if (
    geometrySimilarity < CONTINUATION_MIN_GEOMETRY_SIMILARITY ||
    !isPageEdgeContinuationCandidate(current, next)
  ) {
    return undefined;
  }

  return {
    confidence: roundRatio(Math.min(0.95, 0.58 + geometrySimilarity * 0.25 + 0.12)),
    signals: [
      'same_column_count',
      'column_geometry_match',
      'page_edge_continuation_candidate',
      'non_repeated_header_candidate',
    ],
  };
};

const addQualitySignal = (table: ExtractedTable, signal: TableQualitySignal): void => {
  if (!table.quality || table.quality.signals.includes(signal)) return;

  table.quality = {
    ...table.quality,
    signals: [...table.quality.signals, signal],
  };
};

const linkTableContinuationCandidates = (tables: ExtractedTable[]): ExtractedTable[] => {
  const sorted = [...tables].sort((a, b) => a.page - b.page || a.tableIndex - b.tableIndex);

  for (let index = 0; index < sorted.length - 1; index++) {
    const current = sorted[index];
    const next = sorted[index + 1];
    if (!current || !next) continue;

    if (next.page !== current.page + 1 || current.colCount !== next.colCount) continue;

    const evidence = tableContinuationEvidence(current, next);
    if (!evidence) continue;

    const groupId = `table-continuation-${tableId(current)}-${tableId(next)}`;

    current.continuation = {
      groupId,
      role: current.continuation?.previousTableId ? 'continues' : 'starts',
      ...(current.continuation?.previousTableId
        ? { previousTableId: current.continuation.previousTableId }
        : {}),
      nextTableId: tableId(next),
      confidence: evidence.confidence,
      signals: evidence.signals,
    };
    next.continuation = {
      groupId,
      role: next.continuation?.nextTableId ? 'continues' : 'ends',
      previousTableId: tableId(current),
      ...(next.continuation?.nextTableId ? { nextTableId: next.continuation.nextTableId } : {}),
      confidence: evidence.confidence,
      signals: evidence.signals,
    };

    addQualitySignal(current, 'multi_page_continuation_candidate');
    addQualitySignal(next, 'multi_page_continuation_candidate');
  }

  return tables;
};

/**
 * Identify table regions in clustered rows
 * A table region is a contiguous set of rows with consistent column structure
 */
const identifyTableRegions = (rows: TextRow[]): TableRegion[] => {
  const regions: TableRegion[] = [];

  // Filter rows that have enough items to potentially be table rows
  const candidateRows = rows.filter((row) => row.items.length >= MIN_ROW_ITEMS);

  if (candidateRows.length < MIN_ROWS) {
    return regions;
  }

  // Find column boundaries from candidate rows
  const columnBoundaries = detectColumnBoundaries(candidateRows);

  if (columnBoundaries.length < MIN_COLS) {
    return regions;
  }

  // Group consecutive rows that share column structure
  let currentRegion: TextRow[] = [];

  for (const row of candidateRows) {
    // Check if this row aligns with the detected columns
    const alignedItems = row.items.filter((item) => {
      return columnBoundaries.some(
        (boundary) => Math.abs(item.x - boundary) < COLUMN_GAP_THRESHOLD
      );
    });

    if (alignedItems.length >= MIN_COLS - 1) {
      currentRegion.push(row);
    } else if (currentRegion.length >= MIN_ROWS) {
      // End current region if we have enough rows
      const firstRow = currentRegion[0];
      const lastRow = currentRegion[currentRegion.length - 1];
      if (firstRow && lastRow) {
        regions.push({
          rows: currentRegion,
          columnBoundaries,
          startY: firstRow.y,
          endY: lastRow.y,
        });
      }
      currentRegion = [];
    } else {
      currentRegion = [];
    }
  }

  // Don't forget the last region
  if (currentRegion.length >= MIN_ROWS) {
    const firstRow = currentRegion[0];
    const lastRow = currentRegion[currentRegion.length - 1];
    if (firstRow && lastRow) {
      regions.push({
        rows: currentRegion,
        columnBoundaries,
        startY: firstRow.y,
        endY: lastRow.y,
      });
    }
  }

  return regions;
};

const extractTablesFromTextItems = (
  textItems: TextItemWithPosition[],
  pageNum: number,
  provenance: TableExtractionProvenance = { source: 'selectable_text', engine: 'pdfjs' }
): ExtractedTable[] => {
  const tables: ExtractedTable[] = [];

  if (textItems.length === 0) {
    return tables;
  }

  const rows = clusterByY(textItems);
  const tableRegions = identifyTableRegions(rows);

  for (let tableIndex = 0; tableIndex < tableRegions.length; tableIndex++) {
    const region = tableRegions[tableIndex];
    if (!region) continue;

    const tableRows: string[][] = [];
    const tableCells: TableCell[] = [];

    for (let rowIndex = 0; rowIndex < region.rows.length; rowIndex++) {
      const row = region.rows[rowIndex];
      if (!row) continue;
      const assigned = assignToTableCells(row, rowIndex, region.columnBoundaries);
      tableRows.push(assigned.rowValues);
      tableCells.push(...assigned.cells);
    }

    const confidence = calculateConfidence(region.rows, region.columnBoundaries);
    const tableBoundingBox = mergeBoundingBoxes(
      tableCells
        .map((cell) => cell.bounding_box)
        .filter((box): box is BoundingBox => box !== undefined)
    );

    // Only include tables with reasonable confidence
    if (confidence >= 0.3) {
      const roundedConfidence = Math.round(confidence * 100) / 100;
      tables.push({
        page: pageNum,
        tableIndex,
        rows: tableRows,
        cells: tableCells,
        ...(tableBoundingBox ? { bounding_box: tableBoundingBox } : {}),
        rowCount: tableRows.length,
        colCount: region.columnBoundaries.length,
        confidence: roundedConfidence,
        provenance,
        quality: buildTableQuality(
          region.rows,
          tableCells,
          region.columnBoundaries,
          roundedConfidence
        ),
      });
    }
  }

  return tables;
};

const textItemsFromPageContent = (items: PageContentItem[]): TextItemWithPosition[] =>
  items
    .map((item): TextItemWithPosition | undefined => {
      const text = item.type === 'text' ? item.textContent?.trim() : undefined;
      if (!text || item.xPosition === undefined || item.width === undefined) return undefined;

      return {
        text,
        x: item.xPosition,
        y: item.yPosition,
        width: item.width,
        ...(item.height !== undefined ? { height: item.height } : {}),
        ...(item.bounding_box ? { bounding_box: item.bounding_box } : {}),
      };
    })
    .filter((item): item is TextItemWithPosition => item !== undefined);

const textItemsFromOcrPage = (page: PdfOcrPageData): TextItemWithPosition[] =>
  (page.words ?? [])
    .map((word): TextItemWithPosition | undefined => {
      if (!word.text.trim() || !word.bounding_box) return undefined;

      return {
        text: word.text.trim(),
        x: word.bounding_box.left,
        y: word.bounding_box.bottom,
        width: word.bounding_box.right - word.bounding_box.left,
        height: word.bounding_box.top - word.bounding_box.bottom,
        bounding_box: word.bounding_box,
      };
    })
    .filter((item): item is TextItemWithPosition => item !== undefined);

export const extractTablesFromPageContents = (
  pageContents: Array<{ page: number; items: PageContentItem[] }>
): ExtractedTable[] =>
  linkTableContinuationCandidates(
    pageContents.flatMap((pageContent) =>
      extractTablesFromTextItems(textItemsFromPageContent(pageContent.items), pageContent.page)
    )
  );

export const extractTablesFromOcrTextLayer = (ocrTextLayer: PdfOcrTextLayer): ExtractedTable[] =>
  linkTableContinuationCandidates(
    ocrTextLayer.pages.flatMap((page) =>
      extractTablesFromTextItems(textItemsFromOcrPage(page), page.page, {
        source: 'ocr_text_layer',
        engine: 'external-command',
        ocr_source_render_evidence_id: page.source_render_evidence_id,
      })
    )
  );

/**
 * Extract tables from a single PDF page
 */
export const extractTablesFromPage = async (
  page: pdfjsLib.PDFPageProxy,
  pageNum: number
): Promise<ExtractedTable[]> => {
  try {
    return extractTablesFromTextItems(await extractTextItemsWithPositions(page), pageNum);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Error extracting tables from page', { pageNum, error: message });
    return [];
  }
};

/**
 * Extract tables from specified PDF pages
 */
export const extractTables = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pagesToProcess: number[]
): Promise<ExtractedTable[]> => {
  const allTables: ExtractedTable[] = [];

  for (const pageNum of pagesToProcess) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const pageTables = await extractTablesFromPage(page, pageNum);
      allTables.push(...pageTables);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Error getting page for table extraction', { pageNum, error: message });
    }
  }

  return linkTableContinuationCandidates(allTables);
};

/**
 * Convert an extracted table to markdown format
 */
export const tableToMarkdown = (table: ExtractedTable): string => {
  if (table.rows.length === 0) return '';

  const lines: string[] = [];

  // Header row
  const headerRow = table.rows[0];
  if (!headerRow) return '';

  lines.push(`| ${headerRow.map((cell) => cell.trim() || ' ').join(' | ')} |`);

  // Separator row
  lines.push(`| ${headerRow.map(() => '---').join(' | ')} |`);

  // Data rows
  for (let i = 1; i < table.rows.length; i++) {
    const row = table.rows[i];
    if (!row) continue;

    // Ensure row has same number of columns as header
    const paddedRow = [...row];
    while (paddedRow.length < headerRow.length) {
      paddedRow.push('');
    }
    lines.push(`| ${paddedRow.map((cell) => cell.trim() || ' ').join(' | ')} |`);
  }

  return lines.join('\n');
};

/**
 * Format all tables as markdown for MCP response
 */
export const tablesToMarkdown = (tables: ExtractedTable[]): string => {
  if (tables.length === 0) return '';

  const sections: string[] = ['## Extracted Tables', ''];

  for (const table of tables) {
    sections.push(`### Page ${table.page}, Table ${table.tableIndex + 1}`);
    sections.push(`*Confidence: ${(table.confidence * 100).toFixed(0)}%*`);
    sections.push('');
    sections.push(tableToMarkdown(table));
    sections.push('');
  }

  return sections.join('\n');
};
