import { afterEach, describe, expect, it } from 'vitest';
import {
  buildVisualEnrichmentsForSource,
  selectVisualEnrichmentCandidates,
} from '../../src/pdf/visualEnrichment.js';
import type { PdfDocumentElement } from '../../src/types/pdf.js';

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

describe('visualEnrichment', () => {
  afterEach(() => {
    restoreEnv('MCP_PDF_REGION_ANALYSIS_COMMAND', originalCommand);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_ARGS_JSON', originalArgs);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_HTTP_URL', originalHttpUrl);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_HTTP_HEADERS_JSON', originalHttpHeaders);
  });

  it('selects bounded table and image regions with stable element IDs', () => {
    const candidates = selectVisualEnrichmentCandidates(elements, 2);

    expect(candidates).toEqual([
      {
        element: expect.objectContaining({ id: 'p1-table-1', type: 'table' }),
        region: {
          id: 'p1-table-1',
          page: 1,
          bounding_box: { left: 40, bottom: 600, right: 260, top: 680 },
        },
      },
      {
        element: expect.objectContaining({ id: 'p1-image-1', type: 'image' }),
        region: {
          id: 'p1-image-1',
          page: 1,
          bounding_box: { left: 300, bottom: 400, right: 520, top: 560 },
        },
      },
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

    expect(result.visualEnrichments).toEqual([]);
    expect(result.warnings[0]).toBe(
      'Visual enrichment skipped: analyze_regions provider is not_configured.'
    );
  });
});
