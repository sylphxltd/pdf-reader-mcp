import path from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analyzeRegionCropWithCommandProvider,
  defaultAnalyzeRegionsOptions,
  isRegionAnalysisProviderConfigured,
  readRegionAnalysisProviderConfig,
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

describe('regionAnalysis', () => {
  afterEach(() => {
    restoreEnv('MCP_PDF_REGION_ANALYSIS_COMMAND', originalCommand);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_ARGS_JSON', originalArgs);
  });

  it('should report whether the command region analysis provider is configured', () => {
    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_COMMAND');
    expect(isRegionAnalysisProviderConfigured()).toBe(false);

    process.env['MCP_PDF_REGION_ANALYSIS_COMMAND'] = process.execPath;
    expect(isRegionAnalysisProviderConfigured()).toBe(true);
  });

  it('should run the configured provider and normalize structured visual output', async () => {
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

    expect(result).toMatchObject({
      region_id: 'table-1',
      page: 2,
      kind: 'table',
      description: 'Mock region analysis for table-1 on page 2',
      text: 'Mock region text for table-1',
      confidence: 0.91,
      provider: 'command',
      source_crop_evidence_id: 'page-2-table-1-crop-scale-1',
      source_bounding_box: { left: 10, bottom: 20, right: 110, top: 120 },
      provenance: {
        engine: 'external-command',
        source: 'region-analysis-provider',
      },
      table: {
        rows: [
          ['Metric', 'Value'],
          ['Page', '2'],
        ],
        confidence: 0.9,
      },
      formula: {
        latex: 'x^2 + y^2 = z^2',
        confidence: 0.82,
      },
      chart: {
        title: 'Mock Chart',
        data_points: [{ label: 'A', value: 1 }],
      },
      warnings: ['languages=eng'],
    });
  });

  it('should normalize plain-text provider output as an unknown region description', async () => {
    const scriptPath = path.resolve(__dirname, '../fixtures/mock-region-analysis-provider.mjs');
    process.env['MCP_PDF_REGION_ANALYSIS_COMMAND'] = process.execPath;
    process.env['MCP_PDF_REGION_ANALYSIS_ARGS_JSON'] = JSON.stringify([scriptPath, '{input}', '{page}', '{region_id}']);

    const result = await analyzeRegionCropWithCommandProvider(
      buildRegionCrop('plain'),
      { source: 'mock.pdf' },
      defaultAnalyzeRegionsOptions()
    );

    expect(result).toMatchObject({
      region_id: 'plain',
      kind: 'unknown',
      description: 'Plain analysis for page 2',
      provider: 'command',
      source_crop_evidence_id: 'page-2-plain-crop-scale-1',
    });
  });

  it('should normalize unsupported provider kinds and percentage confidence', async () => {
    const scriptPath = path.resolve(__dirname, '../fixtures/mock-region-analysis-provider.mjs');
    process.env['MCP_PDF_REGION_ANALYSIS_COMMAND'] = process.execPath;
    process.env['MCP_PDF_REGION_ANALYSIS_ARGS_JSON'] = JSON.stringify([scriptPath, '{input}', '{page}', '{region_id}']);

    const result = await analyzeRegionCropWithCommandProvider(
      buildRegionCrop('unsupported-kind'),
      { source: 'mock.pdf' },
      defaultAnalyzeRegionsOptions()
    );

    expect(result).toMatchObject({
      region_id: 'unsupported-kind',
      kind: 'unknown',
      confidence: 0.91,
      warnings: ['Unsupported region analysis kind "heatmap"; normalized to "unknown".'],
    });
  });

  it('should fail with a curated error when the provider is not configured', async () => {
    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_COMMAND');
    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_ARGS_JSON');

    await expect(
      analyzeRegionCropWithCommandProvider(buildRegionCrop(), { source: 'mock.pdf' }, defaultAnalyzeRegionsOptions())
    ).rejects.toThrow(/Region analysis provider is not configured/);
  });

  it('should reject command args that cannot receive the cropped region image', () => {
    process.env['MCP_PDF_REGION_ANALYSIS_COMMAND'] = process.execPath;
    process.env['MCP_PDF_REGION_ANALYSIS_ARGS_JSON'] = JSON.stringify(['--version']);

    expect(() => readRegionAnalysisProviderConfig()).toThrow(/\{input\} placeholder/);
  });
});
