import { describe, expect, it } from 'vitest';
import { buildDocumentAst } from '../../src/pdf/documentAst.js';
import { buildCitationChunks, buildStructuredElements } from '../../src/pdf/documentModel.js';
import type {
  BoundingBox,
  ExtractedTable,
  PageContentItem,
  PdfPageGeometry,
} from '../../src/types/pdf.js';

const box = (left: number, bottom: number, width: number, height: number): BoundingBox => ({
  left,
  bottom,
  right: left + width,
  top: bottom + height,
});

const textItem = (
  textContent: string,
  left: number,
  bottom: number,
  width: number,
  height: number
): PageContentItem => ({
  type: 'text',
  textContent,
  xPosition: left,
  yPosition: bottom,
  width,
  height,
  bounding_box: box(left, bottom, width, height),
});

describe('documentAst', () => {
  it('builds a semantic document tree from structured elements and chunks', () => {
    const pageContents = [
      {
        page: 1,
        items: [
          textItem('Executive Summary', 40, 720, 180, 20),
          textItem('Revenue increased by 24%.', 40, 690, 260, 10),
          textItem('- Retention improved.', 40, 670, 180, 10),
        ],
      },
    ];
    const tables: ExtractedTable[] = [
      {
        page: 1,
        tableIndex: 0,
        rows: [
          ['Metric', 'Value'],
          ['Revenue growth', '24%'],
        ],
        cells: [
          { text: 'Metric', rowIndex: 0, colIndex: 0, rowSpan: 1, colSpan: 1, isHeader: true },
          { text: 'Value', rowIndex: 0, colIndex: 1, rowSpan: 1, colSpan: 1, isHeader: true },
        ],
        rowCount: 2,
        colCount: 2,
        confidence: 0.9,
        quality: {
          completeness: 1,
          nonEmptyCellRatio: 1,
          rowAlignment: 1,
          rowSpacingConsistency: 1,
          missingCellCount: 0,
          mergedCellCandidateCount: 0,
          signals: ['complete_grid'],
        },
      },
    ];

    const elements = buildStructuredElements(pageContents, tables, true);
    const chunks = buildCitationChunks(elements, { useSemanticBoundaries: true });
    const ast = buildDocumentAst({
      selectedPages: [1],
      elements,
      chunks,
    });

    expect(ast).toMatchObject({
      version: '2026-06-15',
      profile: 'document_ast',
      summary: {
        selected_pages: [1],
        page_count: 1,
        section_count: 1,
        paragraph_count: 1,
        list_item_count: 1,
        table_count: 1,
      },
    });
    expect(ast.root.children?.[0]).toMatchObject({
      id: 'p1',
      type: 'page',
      element_ids: ['p1-text-1', 'p1-text-2', 'p1-text-3', 'p1-table-1'],
    });
    expect(ast.root.children?.[0]?.children?.[0]).toMatchObject({
      id: 'p1-text-1-section',
      type: 'section',
      title: 'Executive Summary',
      semantic_role: 'heading',
      children: [
        {
          id: 'p1-text-2',
          type: 'paragraph',
          text: 'Revenue increased by 24%.',
        },
        {
          id: 'p1-text-3',
          type: 'list_item',
          text: '- Retention improved.',
        },
        {
          id: 'p1-table-1',
          type: 'table',
          table: {
            rowCount: 2,
            colCount: 2,
            quality: { signals: ['complete_grid'] },
          },
        },
      ],
    });
    expect(ast.root.chunk_ids?.length).toBeGreaterThan(0);
  });

  it('keeps caption, header, and footer hints as page-level semantic evidence', () => {
    const pageContents = [
      {
        page: 1,
        items: [
          textItem('Confidential Report', 40, 770, 160, 10),
          textItem('Executive Summary', 40, 720, 180, 20),
          textItem('Revenue increased by 24%.', 40, 690, 260, 10),
          textItem('Figure 1: Regional retention by cohort', 40, 612, 230, 9),
          textItem('Page 1 of 3', 260, 24, 70, 9),
        ],
      },
    ];
    const pageGeometry: PdfPageGeometry[] = [
      {
        page: 1,
        width: 612,
        height: 792,
        rotation: 0,
        view_box: { left: 0, bottom: 0, right: 612, top: 792 },
      },
    ];

    const elements = buildStructuredElements(pageContents, [], true, pageGeometry);
    const chunks = buildCitationChunks(elements, { useSemanticBoundaries: true });
    const ast = buildDocumentAst({
      selectedPages: [1],
      elements,
      chunks,
    });

    expect(
      elements.map((element) => element.type === 'text' && element.semantic_hint?.role)
    ).toEqual(['header', 'heading', 'paragraph', 'caption', 'footer']);
    expect(ast.summary).toMatchObject({
      section_count: 1,
      paragraph_count: 1,
      caption_count: 1,
      header_count: 1,
      footer_count: 1,
    });
    expect(ast.root.children?.[0]?.children?.map((node) => node.type)).toEqual([
      'header',
      'section',
      'footer',
    ]);
    expect(JSON.stringify(ast.root)).toContain('"type":"caption"');
  });
});
