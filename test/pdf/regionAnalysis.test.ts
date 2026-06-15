import { createServer } from 'node:http';
import path from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analyzeRegionCropWithCommandProvider,
  analyzeRegionCropWithConfiguredProvider,
  defaultAnalyzeRegionsOptions,
  getRegionAnalysisProviderStatus,
  isRegionAnalysisProviderConfigured,
  readRegionAnalysisProviderConfig,
} from '../../src/pdf/regionAnalysis.js';
import type { PdfRegionCropData } from '../../src/types/pdf.js';

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

const readRequestBody = async (request: Parameters<Parameters<typeof createServer>[0]>[0]) =>
  new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });

describe('regionAnalysis', () => {
  afterEach(() => {
    restoreEnv('MCP_PDF_REGION_ANALYSIS_COMMAND', originalCommand);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_ARGS_JSON', originalArgs);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_HTTP_URL', originalHttpUrl);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_HTTP_HEADERS_JSON', originalHttpHeaders);
  });

  it('should report whether the command region analysis provider is configured', () => {
    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_COMMAND');
    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_HTTP_URL');
    expect(isRegionAnalysisProviderConfigured()).toBe(false);
    expect(getRegionAnalysisProviderStatus()).toMatchObject({
      readiness: 'not_configured',
      provider: 'command',
      command_configured: false,
    });

    process.env['MCP_PDF_REGION_ANALYSIS_COMMAND'] = process.execPath;
    expect(isRegionAnalysisProviderConfigured()).toBe(true);
    expect(getRegionAnalysisProviderStatus()).toMatchObject({
      readiness: 'ready',
      provider: 'command',
      command_configured: true,
    });

    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_COMMAND');
    process.env['MCP_PDF_REGION_ANALYSIS_HTTP_URL'] = 'http://127.0.0.1:9876/analyze';
    expect(isRegionAnalysisProviderConfigured()).toBe(true);
    expect(getRegionAnalysisProviderStatus()).toMatchObject({
      readiness: 'ready',
      provider: 'http',
      command_configured: false,
      http_configured: true,
    });
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
        row_count: 2,
        column_count: 2,
        cells: [
          {
            text: 'Metric',
            row_index: 0,
            column_index: 0,
            bounding_box: { left: 10, bottom: 100, right: 50, top: 120 },
            confidence: 0.95,
          },
          {
            text: 'Value',
            row_index: 0,
            column_index: 1,
            bounding_box: { left: 50, bottom: 100, right: 100, top: 120 },
            confidence: 0.94,
          },
          {
            text: 'Page',
            row_index: 1,
            column_index: 0,
            row_span: 1,
            column_span: 1,
            bounding_box: { left: 10, bottom: 80, right: 50, top: 100 },
            confidence: 0.93,
          },
          {
            text: '2',
            row_index: 1,
            column_index: 1,
            bounding_box: { left: 50, bottom: 80, right: 100, top: 100 },
            confidence: 0.92,
          },
        ],
        confidence: 0.9,
      },
      formula: {
        latex: 'x^2 + y^2 = z^2',
        mathml: '<math><msup><mi>x</mi><mn>2</mn></msup></math>',
        asciimath: 'x^2 + y^2 = z^2',
        confidence: 0.82,
      },
      chart: {
        title: 'Mock Chart',
        data_points: [{ label: 'A', value: 1 }],
        x_axis: { label: 'Category' },
        y_axis: { label: 'Value', min: 0, max: 2 },
        series: [{ name: 'Series A', data_points: [{ label: 'A', value: 1 }], confidence: 0.8 }],
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

  it('should run the configured HTTP provider and normalize visual output', async () => {
    const requests: Array<{
      headers: Record<string, string | string[] | undefined>;
      body: Record<string, unknown>;
    }> = [];
    const server = createServer(async (request, response) => {
      const body = JSON.parse(await readRequestBody(request)) as Record<string, unknown>;
      requests.push({ headers: request.headers, body });
      response.setHeader('Content-Type', 'application/json');
      response.end(
        JSON.stringify({
          kind: 'chart',
          description: `HTTP analysis for ${String(body.region_id)}`,
          confidence: 88,
          chart: {
            title: 'HTTP Chart',
            data_points: [{ label: 'A', value: 2 }],
            y_axis: { label: 'Value', min: 0, max: 4 },
            confidence: 0.81,
          },
        })
      );
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    try {
      const address = server.address();
      if (typeof address !== 'object' || address === null) {
        throw new Error('HTTP test server did not expose a port');
      }
      Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_COMMAND');
      Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_ARGS_JSON');
      process.env['MCP_PDF_REGION_ANALYSIS_HTTP_URL'] = `http://127.0.0.1:${String(address.port)}/analyze`;
      process.env['MCP_PDF_REGION_ANALYSIS_HTTP_HEADERS_JSON'] = JSON.stringify({
        'x-provider-test': 'enabled',
      });

      const result = await analyzeRegionCropWithConfiguredProvider(
        buildRegionCrop('chart-1'),
        { source: 'mock.pdf', languages: ['eng', 'chi_sim'] },
        defaultAnalyzeRegionsOptions()
      );

      expect(result).toMatchObject({
        region_id: 'chart-1',
        page: 2,
        kind: 'chart',
        description: 'HTTP analysis for chart-1',
        confidence: 0.88,
        provider: 'http',
        source_crop_evidence_id: 'page-2-chart-1-crop-scale-1',
        provenance: {
          engine: 'external-http',
          source: 'region-analysis-provider',
        },
        chart: {
          title: 'HTTP Chart',
          data_points: [{ label: 'A', value: 2 }],
          y_axis: { label: 'Value', min: 0, max: 4 },
          confidence: 0.81,
        },
      });
      expect(requests[0]?.headers['x-provider-test']).toBe('enabled');
      expect(requests[0]?.body).toMatchObject({
        page: 2,
        region_id: 'chart-1',
        evidence_id: 'page-2-chart-1-crop-scale-1',
        source: 'mock.pdf',
        mime_type: 'image/png',
        languages: ['eng', 'chi_sim'],
        source_bounding_box: { left: 10, bottom: 20, right: 110, top: 120 },
      });
      expect(typeof requests[0]?.body.image_base64).toBe('string');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
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
    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_HTTP_URL');

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
