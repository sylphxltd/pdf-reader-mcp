// Table extraction from PDF using spatial clustering of text coordinates

import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { BoundingBox, ExtractedTable, PageContentItem, TableCell } from '../types/pdf.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TableExtractor');

// Configuration constants for table detection
const Y_TOLERANCE = 5; // Points tolerance for same-row detection
const COLUMN_GAP_THRESHOLD = 15; // Minimum gap between columns
const MIN_ROWS = 2; // Minimum rows to consider as a table
const MIN_COLS = 2; // Minimum columns to consider as a table
const MIN_ROW_ITEMS = 2; // Minimum items per row to consider for table detection

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

const mergeBoundingBoxes = (boxes: BoundingBox[]): BoundingBox | undefined => {
  if (boxes.length === 0) return undefined;

  return {
    left: Math.min(...boxes.map((box) => box.left)),
    bottom: Math.min(...boxes.map((box) => box.bottom)),
    right: Math.max(...boxes.map((box) => box.right)),
    top: Math.max(...boxes.map((box) => box.top)),
  };
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
    return {
      text: accumulator.textParts.join(' '),
      rowIndex,
      colIndex,
      ...(boundingBox ? { bounding_box: boundingBox } : {}),
    };
  });

  return {
    rowValues: cells.map((cell) => cell.text),
    cells,
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

export const extractTablesFromTextItems = (
  textItems: TextItemWithPosition[],
  pageNum: number
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
      tables.push({
        page: pageNum,
        tableIndex,
        rows: tableRows,
        cells: tableCells,
        ...(tableBoundingBox ? { bounding_box: tableBoundingBox } : {}),
        rowCount: tableRows.length,
        colCount: region.columnBoundaries.length,
        confidence: Math.round(confidence * 100) / 100,
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

export const extractTablesFromPageContents = (
  pageContents: Array<{ page: number; items: PageContentItem[] }>
): ExtractedTable[] =>
  pageContents.flatMap((pageContent) =>
    extractTablesFromTextItems(textItemsFromPageContent(pageContent.items), pageContent.page)
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

  return allTables;
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
