import { describe, expect, it } from 'vitest';
import { buildDocumentAst } from '../../src/pdf/documentAst.js';
import { buildCitationChunks, buildStructuredElements } from '../../src/pdf/documentModel.js';
import type {
  BoundingBox,
  ExtractedTable,
  PageContentItem,
  PdfDocumentAstNode,
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

const imageItem = (
  index: number,
  left: number,
  bottom: number,
  width: number,
  height: number
): PageContentItem => ({
  type: 'image',
  xPosition: left,
  yPosition: bottom,
  width,
  height,
  bounding_box: box(left, bottom, width, height),
  imageData: {
    page: 1,
    index,
    width: Math.round(width),
    height: Math.round(height),
    format: 'png',
    data: 'mock-image-data',
    bounding_box: box(left, bottom, width, height),
  },
});

const flattenNodes = (node: PdfDocumentAstNode): PdfDocumentAstNode[] => [
  node,
  ...(node.children ?? []).flatMap(flattenNodes),
];

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

  it('preserves cross-page section context without moving evidence out of page nodes', () => {
    const pageContents = [
      {
        page: 1,
        items: [
          textItem('Executive Summary', 40, 720, 180, 20),
          textItem('Revenue increased by 24%.', 40, 690, 260, 10),
          textItem('Operating margin stayed flat.', 40, 670, 220, 10),
        ],
      },
      {
        page: 2,
        items: [
          textItem('Management commentary continues on page two.', 40, 720, 300, 10),
          textItem('Risk Controls', 40, 680, 140, 16),
          textItem('Manual review remains required.', 40, 650, 240, 10),
        ],
      },
    ];

    const elements = buildStructuredElements(pageContents, [], true);
    const chunks = buildCitationChunks(elements, { useSemanticBoundaries: true });
    const ast = buildDocumentAst({
      selectedPages: [1, 2],
      elements,
      chunks,
    });

    const pageTwoChildren = ast.root.children?.[1]?.children ?? [];
    expect(pageTwoChildren[0]).toMatchObject({
      id: 'p2-text-1',
      type: 'paragraph',
      continued_from_section_id: 'p1-text-1-section',
      section_path: [
        {
          id: 'p1-text-1-section',
          title: 'Executive Summary',
          level: 1,
          page_start: 1,
        },
      ],
    });
    expect(pageTwoChildren[1]).toMatchObject({
      id: 'p2-text-2-section',
      type: 'section',
      continued_from_section_id: 'p1-text-1-section',
      section_path: [
        {
          id: 'p1-text-1-section',
          title: 'Executive Summary',
          level: 1,
          page_start: 1,
        },
        {
          id: 'p2-text-2-section',
          title: 'Risk Controls',
          level: 2,
          page_start: 2,
        },
      ],
    });
    expect(ast.summary).toMatchObject({
      page_count: 2,
      section_context_node_count: 6,
      cross_page_section_context_count: 3,
    });
    expect(ast.root.children?.[1]?.element_ids).toEqual(['p2-text-1', 'p2-text-2', 'p2-text-3']);
  });

  it('links captions to nearby table and image evidence without moving nodes', () => {
    const pageContents = [
      {
        page: 1,
        items: [
          imageItem(0, 40, 590, 220, 100),
          textItem('Figure 1: Regional retention by cohort', 42, 570, 230, 9),
          textItem('Table 1: Quarterly revenue', 42, 520, 180, 9),
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
        bounding_box: box(40, 470, 220, 40),
        rowCount: 2,
        colCount: 2,
        confidence: 0.9,
      },
    ];

    const elements = buildStructuredElements(pageContents, tables, true);
    const chunks = buildCitationChunks(elements, { useSemanticBoundaries: true });
    const ast = buildDocumentAst({ selectedPages: [1], elements, chunks });
    const nodes = flattenNodes(ast.root);
    const figureCaption = nodes.find((node) => node.id === 'p1-text-2');
    const tableCaption = nodes.find((node) => node.id === 'p1-text-3');
    const imageNode = nodes.find((node) => node.id === 'p1-image-1');
    const tableNode = nodes.find((node) => node.id === 'p1-table-1');

    expect(figureCaption?.type).toBe('caption');
    expect(figureCaption?.caption_links?.[0]).toMatchObject({
      node_id: 'p1-image-1',
      element_id: 'p1-image-1',
      type: 'image',
      relation: 'below',
      signals: expect.arrayContaining([
        'same-page',
        'horizontal-overlap',
        'caption-below',
        'caption-prefix-figure',
        'caption-kind-match',
      ]),
    });
    expect(tableCaption?.type).toBe('caption');
    expect(tableCaption?.caption_links?.[0]).toMatchObject({
      node_id: 'p1-table-1',
      element_id: 'p1-table-1',
      type: 'table',
      relation: 'above',
      signals: expect.arrayContaining([
        'same-page',
        'horizontal-overlap',
        'caption-above',
        'caption-prefix-table',
        'caption-kind-match',
      ]),
    });
    expect(imageNode?.caption_ids).toEqual(['p1-text-2']);
    expect(tableNode?.caption_ids).toEqual(['p1-text-3']);
    expect(ast.summary.caption_link_count).toBe(2);
  });
});
