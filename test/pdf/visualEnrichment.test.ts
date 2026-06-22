import { afterEach, describe, expect, it } from 'vitest';
import {
  buildVisualEnrichmentsForSource,
  selectVisualEnrichmentCandidates,
} from '../../src/pdf/visualEnrichment.js';
import type { PdfDocumentElement, PdfPageGeometry } from '../../src/types/pdf.js';

const originalCommand = process.env['MCP_PDF_REGION_ANALYSIS_COMMAND'];
const originalArgs = process.env['MCP_PDF_REGION_ANALYSIS_ARGS_JSON'];
const originalHttpUrl = process.env['MCP_PDF_REGION_ANALYSIS_HTTP_URL'];
const originalHttpHeaders = process.env['MCP_PDF_REGION_ANALYSIS_HTTP_HEADERS_JSON'];

const restoreEnv = (
  name:
    | 'MCP_PDF_REGION_ANALYSIS_COMMAND'
    | 'MCP_PDF_REGION_ANALYSIS_ARGS_JSON'
    | 'MCP_PDF_REGION_ANALYSIS_HTTP_URL'
    | 'MCP_PDF_REGION_ANALYSIS_HTTP_HEADERS_JSON',
  value: string | undefined
) => {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
    return;
  }

  process.env[name] = value;
};

const elements: PdfDocumentElement[] = [
  {
    id: 'p1-text-1',
    type: 'text',
    page: 1,
    content: 'Heading',
    bounding_box: { left: 20, bottom: 720, right: 120, top: 740 },
    provenance: { engine: 'pdfjs', source: 'text-content' },
  },
  {
    id: 'p1-table-1',
    type: 'table',
    page: 1,
    bounding_box: { left: 40, bottom: 600, right: 260, top: 680 },
    confidence: 0.84,
    provenance: { engine: 'pdfjs', source: 'table-detector' },
    table: {
      rows: [
        ['Metric', 'Value'],
        ['Revenue growth', '24%'],
      ],
      rowCount: 2,
      colCount: 2,
      confidence: 0.84,
    },
  },
  {
    id: 'p1-image-1',
    type: 'image',
    page: 1,
    bounding_box: { left: 300, bottom: 400, right: 520, top: 560 },
    provenance: { engine: 'pdfjs', source: 'image-xobject' },
    image: {
      page: 1,
      index: 1,
      width: 220,
      height: 160,
      format: 'png',
    },
  },
  {
    id: 'p1-image-2',
    type: 'image',
    page: 1,
    provenance: { engine: 'pdfjs', source: 'image-xobject' },
    image: {
      page: 1,
      index: 2,
      width: 100,
      height: 100,
      format: 'png',
    },
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

describe('visualEnrichment', () => {
  afterEach(() => {
    restoreEnv('MCP_PDF_REGION_ANALYSIS_COMMAND', originalCommand);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_ARGS_JSON', originalArgs);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_HTTP_URL', originalHttpUrl);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_HTTP_HEADERS_JSON', originalHttpHeaders);
  });

  it('selects bounded table and image regions with stable element IDs', () => {
    const candidates = selectVisualEnrichmentCandidates(elements, 2);

    expect(candidates).toHaveLength(2);

    const tableCandidate = candidates[0];
    expect(tableCandidate?.element?.id).toBe('p1-table-1');
    expect(tableCandidate?.element?.type).toBe('table');
    expect(tableCandidate?.target_element_id).toBe('p1-table-1');
    expect(tableCandidate?.target_element_type).toBe('table');
    expect(tableCandidate?.candidate_signals).toEqual(['table-element', 'element-bounding-box']);
    expect(tableCandidate?.region).toEqual({
      id: 'p1-table-1',
      page: 1,
      bounding_box: { left: 40, bottom: 600, right: 260, top: 680 },
    });

    const imageCandidate = candidates[1];
    expect(imageCandidate?.element?.id).toBe('p1-image-1');
    expect(imageCandidate?.element?.type).toBe('image');
    expect(imageCandidate?.target_element_id).toBe('p1-image-1');
    expect(imageCandidate?.target_element_type).toBe('image');
    expect(imageCandidate?.candidate_signals).toEqual(['image-element', 'element-bounding-box']);
    expect(imageCandidate?.region).toEqual({
      id: 'p1-image-1',
      page: 1,
      bounding_box: { left: 300, bottom: 400, right: 520, top: 560 },
    });
  });

  it('derives bounded formula and chart regions from equation and graph captions', () => {
    const candidates = selectVisualEnrichmentCandidates(
      [
        {
          id: 'p1-text-1',
          type: 'text',
          page: 1,
          content: 'E = mc^2',
          bounding_box: { left: 92, bottom: 656, right: 180, top: 680 },
          provenance: { engine: 'pdfjs', source: 'text-content' },
          semantic_hint: { role: 'paragraph', confidence: 0.5, signals: ['default-text'] },
        },
        {
          id: 'p1-text-2',
          type: 'text',
          page: 1,
          content: 'Equation (1): Mass-energy equivalence',
          bounding_box: { left: 80, bottom: 620, right: 300, top: 632 },
          provenance: { engine: 'pdfjs', source: 'text-content' },
        },
        {
          id: 'p1-text-3',
          type: 'text',
          page: 1,
          content: 'Revenue by Quarter',
          bounding_box: { left: 110, bottom: 440, right: 260, top: 456 },
          provenance: { engine: 'pdfjs', source: 'text-content' },
          semantic_hint: { role: 'paragraph', confidence: 0.5, signals: ['default-text'] },
        },
        {
          id: 'p1-text-4',
          type: 'text',
          page: 1,
          content: 'Graph 2 - Revenue trend',
          bounding_box: { left: 90, bottom: 384, right: 260, top: 396 },
          provenance: { engine: 'pdfjs', source: 'text-content' },
          semantic_hint: { role: 'paragraph', confidence: 0.64, signals: ['default-text'] },
        },
      ],
      4,
      { pageGeometry }
    );

    expect(candidates).toHaveLength(2);
    const formulaCandidate = candidates.find(
      (candidate) => candidate.target_element_type === 'formula'
    );
    expect(formulaCandidate).toMatchObject({
      target_element_id: 'p1-text-2-formula-region',
      target_element_type: 'formula',
      source_caption_element_id: 'p1-text-2',
      source_caption_text: 'Equation (1): Mass-energy equivalence',
      candidate_signals: expect.arrayContaining([
        'caption-prefix-formula',
        'nearby-positioned-evidence',
        'caption-target-above',
      ]),
      region: {
        id: 'p1-text-2-formula-region',
        page: 1,
      },
    });
    const formulaBox = formulaCandidate?.region.bounding_box;
    expect(
      formulaBox !== undefined &&
        [formulaBox.left, formulaBox.bottom, formulaBox.right, formulaBox.top].every(
          (value) => typeof value === 'number'
        )
    ).toBe(true);
    expect(typeof formulaBox?.top).toBe('number');
    expect((formulaBox?.top ?? 0) >= 680).toBe(true);

    const chartCandidate = candidates.find(
      (candidate) => candidate.target_element_type === 'chart'
    );
    expect(chartCandidate).toMatchObject({
      target_element_id: 'p1-text-4-chart-region',
      target_element_type: 'chart',
      source_caption_element_id: 'p1-text-4',
      source_caption_text: 'Graph 2 - Revenue trend',
      candidate_signals: expect.arrayContaining(['caption-prefix-chart']),
      region: {
        id: 'p1-text-4-chart-region',
        page: 1,
      },
    });
    const chartBox = chartCandidate?.region.bounding_box;
    expect(typeof chartBox?.top).toBe('number');
    expect((chartBox?.top ?? 0) >= 456).toBe(true);
  });

  it('derives side-caption visual regions from vertically overlapping evidence', () => {
    const candidates = selectVisualEnrichmentCandidates(
      [
        {
          id: 'p1-chart-bars',
          type: 'text',
          page: 1,
          content: 'Q1 10 Q2 18 Q3 24',
          bounding_box: { left: 96, bottom: 500, right: 220, top: 560 },
          provenance: { engine: 'pdfjs', source: 'text-content' },
          semantic_hint: { role: 'paragraph', confidence: 0.5, signals: ['default-text'] },
        },
        {
          id: 'p1-chart-caption',
          type: 'text',
          page: 1,
          content: 'Graph 3: Segment revenue',
          bounding_box: { left: 252, bottom: 520, right: 430, top: 536 },
          provenance: { engine: 'pdfjs', source: 'text-content' },
          semantic_hint: { role: 'caption', confidence: 0.86, signals: ['caption-prefix'] },
        },
      ],
      2,
      { pageGeometry }
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      target_element_id: 'p1-chart-caption-chart-region',
      target_element_type: 'chart',
      source_caption_element_id: 'p1-chart-caption',
      source_caption_text: 'Graph 3: Segment revenue',
      candidate_signals: expect.arrayContaining([
        'caption-prefix-chart',
        'nearby-positioned-evidence',
        'caption-target-left',
      ]),
    });
    const sideBox = candidates[0]?.region.bounding_box;
    const sideLeft = sideBox?.left;
    const sideRight = sideBox?.right;
    expect(Number.isFinite(sideLeft)).toBe(true);
    expect(Number.isFinite(sideRight)).toBe(true);
    expect((sideLeft ?? Number.POSITIVE_INFINITY) < 96).toBe(true);
    expect((sideRight ?? 0) > 430).toBe(true);
    expect((sideRight ?? 0) - (sideLeft ?? 0) > 300).toBe(true);
  });

  it('keeps multi-caption visual regions tied to their nearest targets', () => {
    const candidates = selectVisualEnrichmentCandidates(
      [
        {
          id: 'p1-formula-body',
          type: 'text',
          page: 1,
          content: 'E = mc^2',
          bounding_box: { left: 92, bottom: 656, right: 180, top: 680 },
          provenance: { engine: 'pdfjs', source: 'text-content' },
          semantic_hint: { role: 'paragraph', confidence: 0.5, signals: ['default-text'] },
        },
        {
          id: 'p1-formula-caption',
          type: 'text',
          page: 1,
          content: 'Equation (1): Mass-energy equivalence',
          bounding_box: { left: 80, bottom: 620, right: 300, top: 632 },
          provenance: { engine: 'pdfjs', source: 'text-content' },
          semantic_hint: { role: 'caption', confidence: 0.86, signals: ['caption-prefix'] },
        },
        {
          id: 'p1-chart-body',
          type: 'text',
          page: 1,
          content: 'Q1 10 Q2 18 Q3 24',
          bounding_box: { left: 96, bottom: 470, right: 220, top: 530 },
          provenance: { engine: 'pdfjs', source: 'text-content' },
          semantic_hint: { role: 'paragraph', confidence: 0.5, signals: ['default-text'] },
        },
        {
          id: 'p1-chart-caption',
          type: 'text',
          page: 1,
          content: 'Graph 2: Revenue trend',
          bounding_box: { left: 90, bottom: 430, right: 270, top: 444 },
          provenance: { engine: 'pdfjs', source: 'text-content' },
          semantic_hint: { role: 'caption', confidence: 0.86, signals: ['caption-prefix'] },
        },
        {
          id: 'p1-side-chart-body',
          type: 'text',
          page: 1,
          content: 'Enterprise 24 SMB 12',
          bounding_box: { left: 96, bottom: 286, right: 220, top: 344 },
          provenance: { engine: 'pdfjs', source: 'text-content' },
          semantic_hint: { role: 'paragraph', confidence: 0.5, signals: ['default-text'] },
        },
        {
          id: 'p1-side-chart-caption',
          type: 'text',
          page: 1,
          content: 'Graph 3: Segment revenue',
          bounding_box: { left: 252, bottom: 304, right: 430, top: 320 },
          provenance: { engine: 'pdfjs', source: 'text-content' },
          semantic_hint: { role: 'caption', confidence: 0.86, signals: ['caption-prefix'] },
        },
        {
          id: 'p1-figure-body',
          type: 'text',
          page: 1,
          content: 'Ingest -> Parse -> Cite',
          bounding_box: { left: 86, bottom: 158, right: 270, top: 218 },
          provenance: { engine: 'pdfjs', source: 'text-content' },
          semantic_hint: { role: 'paragraph', confidence: 0.5, signals: ['default-text'] },
        },
        {
          id: 'p1-figure-caption',
          type: 'text',
          page: 1,
          content: 'Figure 4: Evidence routing pipeline',
          bounding_box: { left: 78, bottom: 120, right: 312, top: 134 },
          provenance: { engine: 'pdfjs', source: 'text-content' },
          semantic_hint: { role: 'caption', confidence: 0.86, signals: ['caption-prefix'] },
        },
      ],
      4,
      { pageGeometry }
    );

    const byCaption = new Map(
      candidates.map((candidate) => [candidate.source_caption_element_id, candidate])
    );
    expect([...byCaption.keys()]).toEqual([
      'p1-formula-caption',
      'p1-chart-caption',
      'p1-side-chart-caption',
      'p1-figure-caption',
    ]);
    expect(byCaption.get('p1-formula-caption')).toMatchObject({
      target_element_type: 'formula',
      candidate_signals: expect.arrayContaining(['caption-target-above']),
    });
    expect(byCaption.get('p1-chart-caption')).toMatchObject({
      target_element_type: 'chart',
      candidate_signals: expect.arrayContaining(['caption-target-above']),
    });
    expect(byCaption.get('p1-side-chart-caption')).toMatchObject({
      target_element_type: 'chart',
      candidate_signals: expect.arrayContaining(['caption-target-left']),
    });
    expect(byCaption.get('p1-figure-caption')).toMatchObject({
      target_element_type: 'figure',
      candidate_signals: expect.arrayContaining(['caption-target-above']),
    });
    const figureBox = byCaption.get('p1-figure-caption')?.region.bounding_box;
    expect((figureBox?.bottom ?? Number.POSITIVE_INFINITY) <= 120).toBe(true);
    expect((figureBox?.top ?? 0) >= 218).toBe(true);
  });

  it('does not duplicate a caption-derived region when a nearby direct visual target exists', () => {
    const candidates = selectVisualEnrichmentCandidates(
      [
        ...elements,
        {
          id: 'p1-text-2',
          type: 'text',
          page: 1,
          content: 'Figure 2: Product screenshot',
          bounding_box: { left: 310, bottom: 370, right: 500, top: 384 },
          provenance: { engine: 'pdfjs', source: 'text-content' },
          semantic_hint: { role: 'caption', confidence: 0.86, signals: ['caption-prefix'] },
        },
      ],
      6,
      { pageGeometry }
    );

    expect(candidates.map((candidate) => candidate.region.id)).toEqual([
      'p1-table-1',
      'p1-image-1',
    ]);
  });

  it('returns a warning instead of failing read_pdf when no provider is configured', async () => {
    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_COMMAND');
    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_ARGS_JSON');
    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_HTTP_URL');
    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_HTTP_HEADERS_JSON');

    const result = await buildVisualEnrichmentsForSource({
      source: { path: 'test.pdf' },
      sourceDescription: 'test.pdf',
      elements,
      maxVisualEnrichments: 2,
    });

    expect(result.visualEnrichmentCandidates.map((candidate) => candidate.id)).toEqual([
      'p1-table-1',
      'p1-image-1',
    ]);
    expect(result.visualEnrichmentCandidates[0]).toMatchObject({
      target_element_id: 'p1-table-1',
      target_element_type: 'table',
      source_element_id: 'p1-table-1',
      candidate_signals: ['table-element', 'element-bounding-box'],
      region: {
        id: 'p1-table-1',
        page: 1,
      },
    });
    expect(result.visualEnrichments).toEqual([]);
    expect(result.warnings[0]).toBe(
      'Visual enrichment skipped: analyze_regions provider is not_configured.'
    );
  });
});
