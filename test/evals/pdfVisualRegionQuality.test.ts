import path from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analyzeRegionCropWithCommandProvider,
  defaultAnalyzeRegionsOptions,
} from '../../src/pdf/regionAnalysis.js';
import type { PdfRegionCropData } from '../../src/types/pdf.js';

const originalCommand = process.env['MCP_PDF_REGION_ANALYSIS_COMMAND'];
const originalArgs = process.env['MCP_PDF_REGION_ANALYSIS_ARGS_JSON'];

const restoreEnv = (
  name: 'MCP_PDF_REGION_ANALYSIS_COMMAND' | 'MCP_PDF_REGION_ANALYSIS_ARGS_JSON',
  value: string | undefined
) => {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
    return;
  }

  process.env[name] = value;
};

const buildRegionCrop = (regionId = 'table-1'): PdfRegionCropData => {
  const png = new PNG({ width: 3, height: 3 });
  png.data.fill(255);

  return {
    region_id: regionId,
    page: 2,
    evidence_id: `page-2-${regionId}-crop-scale-1`,
    source_bounding_box: { left: 10, bottom: 20, right: 110, top: 120 },
    crop_pixels: { left: 10, top: 20, width: 100, height: 100 },
    scale: 1,
    byte_length: 30,
    format: 'png',
    mime_type: 'image/png',
    provenance: {
      engine: 'pdfjs',
      renderer: '@napi-rs/canvas',
      source: 'region-crop',
      page_render_evidence_id: 'page-2-render-scale-1',
    },
    data: PNG.sync.write(png).toString('base64'),
  };
};

describe('PDF visual-region quality evals', () => {
  afterEach(() => {
    restoreEnv('MCP_PDF_REGION_ANALYSIS_COMMAND', originalCommand);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_ARGS_JSON', originalArgs);
  });

  it('normalizes rich table, formula, and chart evidence from a local provider', async () => {
    const scriptPath = path.resolve(__dirname, '../fixtures/mock-region-analysis-provider.mjs');
    process.env['MCP_PDF_REGION_ANALYSIS_COMMAND'] = process.execPath;
    process.env['MCP_PDF_REGION_ANALYSIS_ARGS_JSON'] = JSON.stringify([
      scriptPath,
      '{input}',
      '{page}',
      '{region_id}',
      '{languages}',
    ]);

    const result = await analyzeRegionCropWithCommandProvider(
      buildRegionCrop(),
      { source: 'mock.pdf', languages: ['eng'] },
      defaultAnalyzeRegionsOptions()
    );

    expect(
      result.kind === 'table' &&
        result.source_crop_evidence_id === 'page-2-table-1-crop-scale-1' &&
        result.table?.row_count === 2 &&
        result.table.column_count === 2 &&
        result.table.cells?.every((cell) => cell.bounding_box !== undefined) &&
        result.formula?.latex !== undefined &&
        result.formula.mathml !== undefined &&
        result.formula.asciimath !== undefined &&
        result.chart?.x_axis?.label === 'Category' &&
        result.chart.y_axis?.label === 'Value' &&
        result.chart.series?.[0]?.data_points.length === 1
    ).toBe(true);
  });

  it('certifies independent table, formula, and chart visual-region outputs', async () => {
    const scriptPath = path.resolve(__dirname, '../fixtures/mock-region-analysis-provider.mjs');
    process.env['MCP_PDF_REGION_ANALYSIS_COMMAND'] = process.execPath;
    process.env['MCP_PDF_REGION_ANALYSIS_ARGS_JSON'] = JSON.stringify([
      scriptPath,
      '{input}',
      '{page}',
      '{region_id}',
      '{languages}',
    ]);

    const [table, formula, chart] = await Promise.all(
      ['cert-table', 'cert-formula', 'cert-chart'].map((regionId) =>
        analyzeRegionCropWithCommandProvider(
          buildRegionCrop(regionId),
          { source: 'certification-fixture.pdf', languages: ['eng'] },
          defaultAnalyzeRegionsOptions()
        )
      )
    );

    expect(table).toMatchObject({
      kind: 'table',
      table: {
        row_count: 3,
        column_count: 2,
      },
    });
    expect(table.table?.cells?.filter((cell) => cell.bounding_box !== undefined).length).toBe(6);
    expect(formula).toMatchObject({
      kind: 'formula',
      formula: {
        latex: 'E = mc^2',
        asciimath: 'E = mc^2',
      },
    });
    expect(formula.formula?.mathml).toContain('<math>');
    expect(chart).toMatchObject({
      kind: 'chart',
      chart: {
        title: 'Revenue by Quarter',
        x_axis: { label: 'Quarter' },
        y_axis: { label: 'Revenue', unit: 'USD millions' },
      },
    });
    expect(chart.chart?.series?.[0]?.data_points).toHaveLength(3);
  });
});
