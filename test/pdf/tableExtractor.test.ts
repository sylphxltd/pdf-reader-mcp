import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it, vi } from 'vitest';
import {
  clusterByY,
  detectColumnBoundaries,
  extractTables,
  extractTablesFromPage,
  extractTextItemsWithPositions,
  type TextItemWithPosition,
  tablesToMarkdown,
  tableToMarkdown,
} from '../../src/pdf/tableExtractor.js';

describe('tableExtractor', () => {
  describe('extractTextItemsWithPositions', () => {
    it('should extract text items with positions from page', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            { str: 'Header1', transform: [1, 0, 0, 1, 50, 700], width: 40 },
            { str: 'Header2', transform: [1, 0, 0, 1, 150, 700], width: 40 },
            { str: 'Cell1', transform: [1, 0, 0, 1, 50, 680], width: 30 },
            { str: 'Cell2', transform: [1, 0, 0, 1, 150, 680], width: 30 },
          ],
        }),
      } as unknown as pdfjsLib.PDFPageProxy;

      const result = await extractTextItemsWithPositions(mockPage);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ text: 'Header1', x: 50, y: 700, width: 40 });
      expect(result[1]).toEqual({ text: 'Header2', x: 150, y: 700, width: 40 });
    });

    it('should skip empty text items', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            { str: 'Valid', transform: [1, 0, 0, 1, 50, 700], width: 30 },
            { str: '   ', transform: [1, 0, 0, 1, 100, 700], width: 20 },
            { str: '', transform: [1, 0, 0, 1, 150, 700], width: 10 },
          ],
        }),
      } as unknown as pdfjsLib.PDFPageProxy;

      const result = await extractTextItemsWithPositions(mockPage);

      expect(result).toHaveLength(1);
      expect(result[0]?.text).toBe('Valid');
    });

    it('should estimate width when not provided', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Test', transform: [1, 0, 0, 1, 50, 700] }],
        }),
      } as unknown as pdfjsLib.PDFPageProxy;

      const result = await extractTextItemsWithPositions(mockPage);

      expect(result[0]?.width).toBe(24); // 4 chars * 6
    });

    it('should skip items with missing coordinates', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            { str: 'Valid', transform: [1, 0, 0, 1, 50, 700] },
            { str: 'NoY', transform: [1, 0, 0, 1, 50] },
            { str: 'NoTransform' },
          ],
        }),
      } as unknown as pdfjsLib.PDFPageProxy;

      const result = await extractTextItemsWithPositions(mockPage);

      expect(result).toHaveLength(1);
    });
  });

  describe('clusterByY', () => {
    it('should cluster items with similar Y coordinates into rows', () => {
      const items: TextItemWithPosition[] = [
        { text: 'A1', x: 50, y: 700, width: 20 },
        { text: 'A2', x: 150, y: 702, width: 20 }, // Within tolerance of 700
        { text: 'B1', x: 50, y: 680, width: 20 },
        { text: 'B2', x: 150, y: 678, width: 20 }, // Within tolerance of 680
      ];

      const result = clusterByY(items, 5);

      expect(result).toHaveLength(2);
      // First row (higher Y)
      expect(result[0]?.items).toHaveLength(2);
      expect(result[0]?.items[0]?.text).toBe('A1');
      expect(result[0]?.items[1]?.text).toBe('A2');
      // Second row (lower Y)
      expect(result[1]?.items).toHaveLength(2);
      expect(result[1]?.items[0]?.text).toBe('B1');
      expect(result[1]?.items[1]?.text).toBe('B2');
    });

    it('should sort items within rows by X coordinate', () => {
      const items: TextItemWithPosition[] = [
        { text: 'Right', x: 200, y: 700, width: 30 },
        { text: 'Left', x: 50, y: 700, width: 25 },
        { text: 'Middle', x: 125, y: 700, width: 35 },
      ];

      const result = clusterByY(items);

      expect(result[0]?.items.map((i) => i.text)).toEqual(['Left', 'Middle', 'Right']);
    });

    it('should return empty array for empty input', () => {
      const result = clusterByY([]);
      expect(result).toEqual([]);
    });

    it('should handle single item', () => {
      const items: TextItemWithPosition[] = [{ text: 'Solo', x: 50, y: 700, width: 25 }];

      const result = clusterByY(items);

      expect(result).toHaveLength(1);
      expect(result[0]?.items[0]?.text).toBe('Solo');
    });
  });

  describe('detectColumnBoundaries', () => {
    it('should detect column boundaries from X-coordinate gaps', () => {
      const rows = [
        {
          y: 700,
          items: [
            { text: 'A', x: 50, y: 700, width: 20 },
            { text: 'B', x: 150, y: 700, width: 20 },
            { text: 'C', x: 250, y: 700, width: 20 },
          ],
        },
        {
          y: 680,
          items: [
            { text: 'D', x: 50, y: 680, width: 20 },
            { text: 'E', x: 150, y: 680, width: 20 },
            { text: 'F', x: 250, y: 680, width: 20 },
          ],
        },
      ];

      const result = detectColumnBoundaries(rows, 15);

      expect(result).toHaveLength(3);
      expect(result).toEqual([50, 150, 250]);
    });

    it('should return empty array for empty input', () => {
      const result = detectColumnBoundaries([]);
      expect(result).toEqual([]);
    });

    it('should handle rows with no items', () => {
      const rows = [{ y: 700, items: [] }];

      const result = detectColumnBoundaries(rows);

      expect(result).toEqual([]);
    });

    it('should not create boundaries for small gaps', () => {
      const rows = [
        {
          y: 700,
          items: [
            { text: 'A', x: 50, y: 700, width: 20 },
            { text: 'B', x: 55, y: 700, width: 20 }, // Small gap
          ],
        },
      ];

      const result = detectColumnBoundaries(rows, 15);

      expect(result).toHaveLength(1); // Only one column boundary
    });
  });

  describe('extractTablesFromPage', () => {
    it('should extract tables from a page with tabular data', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            // Row 1 (header)
            { str: 'Name', transform: [1, 0, 0, 1, 50, 700], width: 30 },
            { str: 'Age', transform: [1, 0, 0, 1, 150, 700], width: 20 },
            { str: 'City', transform: [1, 0, 0, 1, 250, 700], width: 25 },
            // Row 2
            { str: 'Alice', transform: [1, 0, 0, 1, 50, 680], width: 30 },
            { str: '30', transform: [1, 0, 0, 1, 150, 680], width: 15 },
            { str: 'NYC', transform: [1, 0, 0, 1, 250, 680], width: 20 },
            // Row 3
            { str: 'Bob', transform: [1, 0, 0, 1, 50, 660], width: 20 },
            { str: '25', transform: [1, 0, 0, 1, 150, 660], width: 15 },
            { str: 'LA', transform: [1, 0, 0, 1, 250, 660], width: 15 },
          ],
        }),
      } as unknown as pdfjsLib.PDFPageProxy;

      const result = await extractTablesFromPage(mockPage, 1);

      expect(result.length).toBeGreaterThanOrEqual(1);
      if (result.length > 0) {
        expect(result[0]?.page).toBe(1);
        expect(result[0]?.rowCount).toBeGreaterThanOrEqual(2);
        expect(result[0]?.colCount).toBeGreaterThanOrEqual(2);
        expect(result[0]?.confidence).toBeGreaterThan(0);
      }
    });

    it('should return empty array for page with no text', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({ items: [] }),
      } as unknown as pdfjsLib.PDFPageProxy;

      const result = await extractTablesFromPage(mockPage, 1);

      expect(result).toEqual([]);
    });

    it('should return empty array for page with non-tabular data', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Single paragraph of text.', transform: [1, 0, 0, 1, 50, 700], width: 150 }],
        }),
      } as unknown as pdfjsLib.PDFPageProxy;

      const result = await extractTablesFromPage(mockPage, 1);

      expect(result).toEqual([]);
    });

    it('should handle extraction errors gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockPage = {
        getTextContent: vi.fn().mockRejectedValue(new Error('Text extraction failed')),
      } as unknown as pdfjsLib.PDFPageProxy;

      const result = await extractTablesFromPage(mockPage, 1);

      expect(result).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Error extracting tables from page'));

      consoleWarnSpy.mockRestore();
    });
  });

  describe('extractTables', () => {
    it('should extract tables from multiple pages', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            // Simple 2x2 table
            { str: 'A', transform: [1, 0, 0, 1, 50, 700], width: 10 },
            { str: 'B', transform: [1, 0, 0, 1, 150, 700], width: 10 },
            { str: 'C', transform: [1, 0, 0, 1, 50, 680], width: 10 },
            { str: 'D', transform: [1, 0, 0, 1, 150, 680], width: 10 },
          ],
        }),
      };

      const mockDocument = {
        getPage: vi.fn().mockResolvedValue(mockPage),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      await extractTables(mockDocument, [1, 2]);

      // Should attempt to extract from both pages
      expect(mockDocument.getPage).toHaveBeenCalledTimes(2);
      expect(mockDocument.getPage).toHaveBeenCalledWith(1);
      expect(mockDocument.getPage).toHaveBeenCalledWith(2);
    });

    it('should handle page fetch errors gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockDocument = {
        getPage: vi.fn().mockRejectedValue(new Error('Page not found')),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractTables(mockDocument, [1]);

      expect(result).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Error getting page for table extraction'));

      consoleWarnSpy.mockRestore();
    });
  });

  describe('tableToMarkdown', () => {
    it('should convert table to markdown format', () => {
      const table = {
        page: 1,
        tableIndex: 0,
        rows: [
          ['Header1', 'Header2'],
          ['Cell1', 'Cell2'],
          ['Cell3', 'Cell4'],
        ],
        rowCount: 3,
        colCount: 2,
        confidence: 0.85,
      };

      const result = tableToMarkdown(table);

      expect(result).toContain('| Header1 | Header2 |');
      expect(result).toContain('| --- | --- |');
      expect(result).toContain('| Cell1 | Cell2 |');
      expect(result).toContain('| Cell3 | Cell4 |');
    });

    it('should handle empty table', () => {
      const table = {
        page: 1,
        tableIndex: 0,
        rows: [],
        rowCount: 0,
        colCount: 0,
        confidence: 0,
      };

      const result = tableToMarkdown(table);

      expect(result).toBe('');
    });

    it('should handle empty cells', () => {
      const table = {
        page: 1,
        tableIndex: 0,
        rows: [
          ['Header1', 'Header2'],
          ['', 'Data'],
        ],
        rowCount: 2,
        colCount: 2,
        confidence: 0.7,
      };

      const result = tableToMarkdown(table);

      expect(result).toContain('| Header1 | Header2 |');
      // Empty cell should have a space
      expect(result).toContain('|   | Data |');
    });

    it('should pad rows with fewer columns', () => {
      const table = {
        page: 1,
        tableIndex: 0,
        rows: [
          ['Col1', 'Col2', 'Col3'],
          ['Only', 'Two'],
        ],
        rowCount: 2,
        colCount: 3,
        confidence: 0.6,
      };

      const result = tableToMarkdown(table);

      // Second row should be padded
      expect(result).toContain('| Only | Two |   |');
    });
  });

  describe('tablesToMarkdown', () => {
    it('should format multiple tables with headers', () => {
      const tables = [
        {
          page: 1,
          tableIndex: 0,
          rows: [
            ['A', 'B'],
            ['C', 'D'],
          ],
          rowCount: 2,
          colCount: 2,
          confidence: 0.9,
        },
        {
          page: 2,
          tableIndex: 0,
          rows: [
            ['X', 'Y'],
            ['Z', 'W'],
          ],
          rowCount: 2,
          colCount: 2,
          confidence: 0.8,
        },
      ];

      const result = tablesToMarkdown(tables);

      expect(result).toContain('## Extracted Tables');
      expect(result).toContain('### Page 1, Table 1');
      expect(result).toContain('*Confidence: 90%*');
      expect(result).toContain('### Page 2, Table 1');
      expect(result).toContain('*Confidence: 80%*');
    });

    it('should return empty string for empty tables array', () => {
      const result = tablesToMarkdown([]);
      expect(result).toBe('');
    });
  });
});
