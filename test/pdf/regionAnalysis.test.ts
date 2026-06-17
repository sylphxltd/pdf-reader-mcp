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
const originalPreset = process.env['MCP_PDF_REGION_ANALYSIS_PRESET'];
const originalOllamaUrl = process.env['MCP_PDF_REGION_ANALYSIS_OLLAMA_URL'];
const originalOllamaModel = process.env['MCP_PDF_REGION_ANALYSIS_OLLAMA_MODEL'];
const originalOpenAiUrl = process.env['MCP_PDF_REGION_ANALYSIS_OPENAI_URL'];
const originalOpenAiModel = process.env['MCP_PDF_REGION_ANALYSIS_OPENAI_MODEL'];
const originalOpenAiApiKey = process.env['MCP_PDF_REGION_ANALYSIS_OPENAI_API_KEY'];
const originalLmStudioUrl = process.env['MCP_PDF_REGION_ANALYSIS_LMSTUDIO_URL'];
const originalLmStudioModel = process.env['MCP_PDF_REGION_ANALYSIS_LMSTUDIO_MODEL'];
const originalLlamaCppUrl = process.env['MCP_PDF_REGION_ANALYSIS_LLAMACPP_URL'];
const originalLlamaCppModel = process.env['MCP_PDF_REGION_ANALYSIS_LLAMACPP_MODEL'];

const restoreEnv = (
  name:
    | 'MCP_PDF_REGION_ANALYSIS_COMMAND'
    | 'MCP_PDF_REGION_ANALYSIS_ARGS_JSON'
    | 'MCP_PDF_REGION_ANALYSIS_HTTP_URL'
    | 'MCP_PDF_REGION_ANALYSIS_HTTP_HEADERS_JSON'
    | 'MCP_PDF_REGION_ANALYSIS_PRESET'
    | 'MCP_PDF_REGION_ANALYSIS_OLLAMA_URL'
    | 'MCP_PDF_REGION_ANALYSIS_OLLAMA_MODEL'
    | 'MCP_PDF_REGION_ANALYSIS_OPENAI_URL'
    | 'MCP_PDF_REGION_ANALYSIS_OPENAI_MODEL'
    | 'MCP_PDF_REGION_ANALYSIS_OPENAI_API_KEY'
    | 'MCP_PDF_REGION_ANALYSIS_LMSTUDIO_URL'
    | 'MCP_PDF_REGION_ANALYSIS_LMSTUDIO_MODEL'
    | 'MCP_PDF_REGION_ANALYSIS_LLAMACPP_URL'
    | 'MCP_PDF_REGION_ANALYSIS_LLAMACPP_MODEL',
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
    restoreEnv('MCP_PDF_REGION_ANALYSIS_PRESET', originalPreset);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_OLLAMA_URL', originalOllamaUrl);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_OLLAMA_MODEL', originalOllamaModel);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_OPENAI_URL', originalOpenAiUrl);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_OPENAI_MODEL', originalOpenAiModel);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_OPENAI_API_KEY', originalOpenAiApiKey);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_LMSTUDIO_URL', originalLmStudioUrl);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_LMSTUDIO_MODEL', originalLmStudioModel);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_LLAMACPP_URL', originalLlamaCppUrl);
    restoreEnv('MCP_PDF_REGION_ANALYSIS_LLAMACPP_MODEL', originalLlamaCppModel);
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

    process.env['MCP_PDF_REGION_ANALYSIS_PRESET'] = 'unsupported-stale-value';
    expect(getRegionAnalysisProviderStatus()).toMatchObject({
      readiness: 'ready',
      provider: 'command',
      command_configured: true,
    });

    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_COMMAND');
    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_PRESET');
    process.env['MCP_PDF_REGION_ANALYSIS_HTTP_URL'] = 'http://127.0.0.1:9876/analyze';
    expect(isRegionAnalysisProviderConfigured()).toBe(true);
    expect(getRegionAnalysisProviderStatus()).toMatchObject({
      readiness: 'ready',
      provider: 'http',
      command_configured: false,
      http_configured: true,
    });

    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_HTTP_URL');
    process.env['MCP_PDF_REGION_ANALYSIS_PRESET'] = 'ollama';
    expect(isRegionAnalysisProviderConfigured()).toBe(true);
    expect(getRegionAnalysisProviderStatus()).toMatchObject({
      readiness: 'invalid_configuration',
      provider: 'http',
      preset: 'ollama',
      warnings: ['Set MCP_PDF_REGION_ANALYSIS_OLLAMA_MODEL to use the Ollama preset.'],
    });

    process.env['MCP_PDF_REGION_ANALYSIS_OLLAMA_MODEL'] = 'llama3.2-vision';
    expect(getRegionAnalysisProviderStatus()).toMatchObject({
      readiness: 'ready',
      provider: 'http',
      http_configured: true,
      preset: 'ollama',
      model: 'llama3.2-vision',
    });

    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_OLLAMA_MODEL');
    process.env['MCP_PDF_REGION_ANALYSIS_PRESET'] = 'openai-compatible';
    expect(getRegionAnalysisProviderStatus()).toMatchObject({
      readiness: 'invalid_configuration',
      provider: 'http',
      preset: 'openai-compatible',
      warnings: [
        'Set MCP_PDF_REGION_ANALYSIS_OPENAI_MODEL to use the OpenAI-compatible preset.',
        'Set MCP_PDF_REGION_ANALYSIS_OPENAI_URL to use the OpenAI-compatible preset.',
      ],
    });

    process.env['MCP_PDF_REGION_ANALYSIS_OPENAI_MODEL'] = 'local-vision';
    process.env['MCP_PDF_REGION_ANALYSIS_OPENAI_URL'] = 'http://127.0.0.1:1234/v1/chat/completions';
    expect(getRegionAnalysisProviderStatus()).toMatchObject({
      readiness: 'ready',
      provider: 'http',
      http_configured: true,
      preset: 'openai-compatible',
      model: 'local-vision',
    });

    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_OPENAI_MODEL');
    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_OPENAI_URL');
    process.env['MCP_PDF_REGION_ANALYSIS_PRESET'] = 'lmstudio';
    expect(getRegionAnalysisProviderStatus()).toMatchObject({
      readiness: 'invalid_configuration',
      provider: 'http',
      preset: 'lmstudio',
      warnings: ['Set MCP_PDF_REGION_ANALYSIS_LMSTUDIO_MODEL to use the LM Studio preset.'],
    });

    process.env['MCP_PDF_REGION_ANALYSIS_LMSTUDIO_MODEL'] = 'qwen2.5-vl-local';
    expect(getRegionAnalysisProviderStatus()).toMatchObject({
      readiness: 'ready',
      provider: 'http',
      http_configured: true,
      preset: 'lmstudio',
      model: 'qwen2.5-vl-local',
    });

    Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_LMSTUDIO_MODEL');
    process.env['MCP_PDF_REGION_ANALYSIS_PRESET'] = 'llamacpp';
    expect(getRegionAnalysisProviderStatus()).toMatchObject({
      readiness: 'invalid_configuration',
      provider: 'http',
      preset: 'llamacpp',
      warnings: ['Set MCP_PDF_REGION_ANALYSIS_LLAMACPP_MODEL to use the llama.cpp preset.'],
    });

    process.env['MCP_PDF_REGION_ANALYSIS_LLAMACPP_MODEL'] = 'local-mmproj';
    expect(getRegionAnalysisProviderStatus()).toMatchObject({
      readiness: 'ready',
      provider: 'http',
      http_configured: true,
      preset: 'llamacpp',
      model: 'local-mmproj',
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

  it('should normalize figure and image-description provider output', async () => {
    const scriptPath = path.resolve(__dirname, '../fixtures/mock-region-analysis-provider.mjs');
    process.env['MCP_PDF_REGION_ANALYSIS_COMMAND'] = process.execPath;
    process.env['MCP_PDF_REGION_ANALYSIS_ARGS_JSON'] = JSON.stringify([
      scriptPath,
      '{input}',
      '{page}',
      '{region_id}',
    ]);

    const [figure, image] = await Promise.all([
      analyzeRegionCropWithCommandProvider(
        buildRegionCrop('cert-figure'),
        { source: 'mock.pdf' },
        defaultAnalyzeRegionsOptions()
      ),
      analyzeRegionCropWithCommandProvider(
        buildRegionCrop('cert-image'),
        { source: 'mock.pdf' },
        defaultAnalyzeRegionsOptions()
      ),
    ]);

    expect(figure).toMatchObject({
      region_id: 'cert-figure',
      kind: 'figure',
      description: 'Certification fixture pipeline figure with connected stages.',
      text: 'Pipeline figure: ingest, analyze, cite.',
      markdown: 'Figure: ingest -> analyze -> cite',
      confidence: 0.89,
      source_crop_evidence_id: 'page-2-cert-figure-crop-scale-1',
    });
    expect(image).toMatchObject({
      region_id: 'cert-image',
      kind: 'image',
      description: 'Certification fixture office image with a framed landscape illustration.',
      text: 'Office image: framed landscape with mountain shapes.',
      markdown: 'Image description: framed landscape with mountain shapes.',
      confidence: 0.88,
      source_crop_evidence_id: 'page-2-cert-image-crop-scale-1',
    });
  });

  it('should normalize plain-text provider output as an unknown region description', async () => {
    const scriptPath = path.resolve(__dirname, '../fixtures/mock-region-analysis-provider.mjs');
    process.env['MCP_PDF_REGION_ANALYSIS_COMMAND'] = process.execPath;
    process.env['MCP_PDF_REGION_ANALYSIS_ARGS_JSON'] = JSON.stringify([
      scriptPath,
      '{input}',
      '{page}',
      '{region_id}',
    ]);

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
      process.env['MCP_PDF_REGION_ANALYSIS_HTTP_URL'] =
        `http://127.0.0.1:${String(address.port)}/analyze`;
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

  it('should run the Ollama preset through the local generate API contract', async () => {
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
          model: body.model,
          done: true,
          response: JSON.stringify({
            kind: 'formula',
            description: 'Ollama formula crop analysis',
            confidence: 0.9,
            formula: {
              latex: 'E = mc^2',
              text: 'E equals m c squared',
              confidence: 0.88,
            },
          }),
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
      Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_HTTP_URL');
      process.env['MCP_PDF_REGION_ANALYSIS_PRESET'] = 'ollama';
      process.env['MCP_PDF_REGION_ANALYSIS_OLLAMA_URL'] =
        `http://127.0.0.1:${String(address.port)}/api/generate`;
      process.env['MCP_PDF_REGION_ANALYSIS_OLLAMA_MODEL'] = 'llama3.2-vision';
      process.env['MCP_PDF_REGION_ANALYSIS_HTTP_HEADERS_JSON'] = JSON.stringify({
        'x-ollama-proxy': 'local',
      });

      const result = await analyzeRegionCropWithConfiguredProvider(
        buildRegionCrop('formula-1'),
        { source: 'mock.pdf', languages: ['eng'] },
        defaultAnalyzeRegionsOptions()
      );

      expect(result).toMatchObject({
        region_id: 'formula-1',
        page: 2,
        kind: 'formula',
        description: 'Ollama formula crop analysis',
        confidence: 0.9,
        provider: 'http',
        source_crop_evidence_id: 'page-2-formula-1-crop-scale-1',
        provenance: {
          engine: 'external-http',
          source: 'region-analysis-provider',
        },
        formula: {
          latex: 'E = mc^2',
          text: 'E equals m c squared',
          confidence: 0.88,
        },
      });
      expect(requests[0]?.headers['x-ollama-proxy']).toBe('local');
      expect(requests[0]?.body).toMatchObject({
        model: 'llama3.2-vision',
        images: [buildRegionCrop('formula-1').data],
        stream: false,
        format: 'json',
      });
      expect(String(requests[0]?.body.prompt)).toContain('Region ID: formula-1');
      expect(String(requests[0]?.body.prompt)).toContain('Return only one JSON object');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('should run the OpenAI-compatible preset through the chat completions contract', async () => {
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
          id: 'chatcmpl-region-analysis',
          object: 'chat.completion',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  kind: 'chart',
                  description: 'OpenAI-compatible chart crop analysis',
                  confidence: 0.92,
                  chart: {
                    title: 'Latency by stage',
                    x_axis: { label: 'Stage' },
                    y_axis: { label: 'Latency', min: 0, max: 10 },
                    data_points: [{ label: 'Parse', value: 4 }],
                    confidence: 0.9,
                  },
                }),
              },
              finish_reason: 'stop',
            },
          ],
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
      Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_HTTP_URL');
      Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_OLLAMA_URL');
      Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_OLLAMA_MODEL');
      process.env['MCP_PDF_REGION_ANALYSIS_PRESET'] = 'openai-compatible';
      process.env['MCP_PDF_REGION_ANALYSIS_OPENAI_URL'] =
        `http://127.0.0.1:${String(address.port)}/v1/chat/completions`;
      process.env['MCP_PDF_REGION_ANALYSIS_OPENAI_MODEL'] = 'local-vision';
      process.env['MCP_PDF_REGION_ANALYSIS_OPENAI_API_KEY'] = 'test-key';
      process.env['MCP_PDF_REGION_ANALYSIS_HTTP_HEADERS_JSON'] = JSON.stringify({
        authorization: 'Bearer stale-key',
        'x-provider-test': 'enabled',
      });

      const result = await analyzeRegionCropWithConfiguredProvider(
        buildRegionCrop('chart-openai'),
        { source: 'mock.pdf', languages: ['eng'] },
        defaultAnalyzeRegionsOptions()
      );

      expect(result).toMatchObject({
        region_id: 'chart-openai',
        page: 2,
        kind: 'chart',
        description: 'OpenAI-compatible chart crop analysis',
        confidence: 0.92,
        provider: 'http',
        source_crop_evidence_id: 'page-2-chart-openai-crop-scale-1',
        provenance: {
          engine: 'external-http',
          source: 'region-analysis-provider',
        },
        chart: {
          title: 'Latency by stage',
          x_axis: { label: 'Stage' },
          y_axis: { label: 'Latency', min: 0, max: 10 },
          data_points: [{ label: 'Parse', value: 4 }],
          confidence: 0.9,
        },
      });
      expect(requests[0]?.headers.authorization).toBe('Bearer test-key');
      expect(requests[0]?.headers['x-provider-test']).toBe('enabled');
      expect(requests[0]?.body).toMatchObject({
        model: 'local-vision',
        temperature: 0,
      });
      const messages = requests[0]?.body.messages as Array<Record<string, unknown>>;
      expect(messages[0]).toMatchObject({
        role: 'system',
        content: expect.stringContaining('Return only one JSON object'),
      });
      const userContent = messages[1]?.content as Array<Record<string, unknown>>;
      expect(userContent[0]).toMatchObject({
        type: 'text',
        text: expect.stringContaining('Region ID: chart-openai'),
      });
      expect(userContent[1]).toMatchObject({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${buildRegionCrop('chart-openai').data}`,
        },
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('should run the LM Studio preset through the local chat completions contract', async () => {
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
          choices: [
            {
              message: {
                content: JSON.stringify({
                  kind: 'figure',
                  description: 'LM Studio figure crop analysis',
                  confidence: 0.89,
                  markdown: 'Figure: parse -> enrich -> cite',
                }),
              },
            },
          ],
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
      Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_HTTP_URL');
      process.env['MCP_PDF_REGION_ANALYSIS_PRESET'] = 'lmstudio';
      process.env['MCP_PDF_REGION_ANALYSIS_LMSTUDIO_URL'] =
        `http://127.0.0.1:${String(address.port)}/v1/chat/completions`;
      process.env['MCP_PDF_REGION_ANALYSIS_LMSTUDIO_MODEL'] = 'qwen2.5-vl-local';

      const result = await analyzeRegionCropWithConfiguredProvider(
        buildRegionCrop('figure-lmstudio'),
        { source: 'mock.pdf', languages: ['eng'] },
        defaultAnalyzeRegionsOptions()
      );

      expect(result).toMatchObject({
        region_id: 'figure-lmstudio',
        page: 2,
        kind: 'figure',
        description: 'LM Studio figure crop analysis',
        confidence: 0.89,
        markdown: 'Figure: parse -> enrich -> cite',
        provider: 'http',
        source_crop_evidence_id: 'page-2-figure-lmstudio-crop-scale-1',
      });
      expect(requests[0]?.body).toMatchObject({
        model: 'qwen2.5-vl-local',
        temperature: 0,
      });
      const messages = requests[0]?.body.messages as Array<Record<string, unknown>>;
      const userContent = messages[1]?.content as Array<Record<string, unknown>>;
      expect(userContent[0]).toMatchObject({
        type: 'text',
        text: expect.stringContaining('Region ID: figure-lmstudio'),
      });
      expect(userContent[1]).toMatchObject({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${buildRegionCrop('figure-lmstudio').data}`,
        },
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('should run the llama.cpp preset through the local multimodal chat contract', async () => {
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
          choices: [
            {
              message: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      kind: 'image',
                      description: 'llama.cpp image crop analysis',
                      text: 'Visible image with two labeled blocks.',
                      confidence: 0.86,
                    }),
                  },
                ],
              },
            },
          ],
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
      Reflect.deleteProperty(process.env, 'MCP_PDF_REGION_ANALYSIS_HTTP_URL');
      process.env['MCP_PDF_REGION_ANALYSIS_PRESET'] = 'llamacpp';
      process.env['MCP_PDF_REGION_ANALYSIS_LLAMACPP_URL'] =
        `http://127.0.0.1:${String(address.port)}/v1/chat/completions`;
      process.env['MCP_PDF_REGION_ANALYSIS_LLAMACPP_MODEL'] = 'llava-local';

      const result = await analyzeRegionCropWithConfiguredProvider(
        buildRegionCrop('image-llamacpp'),
        { source: 'mock.pdf', languages: ['eng'] },
        defaultAnalyzeRegionsOptions()
      );

      expect(result).toMatchObject({
        region_id: 'image-llamacpp',
        page: 2,
        kind: 'image',
        description: 'llama.cpp image crop analysis',
        text: 'Visible image with two labeled blocks.',
        confidence: 0.86,
        provider: 'http',
        source_crop_evidence_id: 'page-2-image-llamacpp-crop-scale-1',
      });
      expect(requests[0]?.body).toMatchObject({
        model: 'llava-local',
        temperature: 0,
      });
      const messages = requests[0]?.body.messages as Array<Record<string, unknown>>;
      const userContent = messages[1]?.content as Array<Record<string, unknown>>;
      expect(userContent[1]).toMatchObject({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${buildRegionCrop('image-llamacpp').data}`,
        },
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('should normalize unsupported provider kinds and percentage confidence', async () => {
    const scriptPath = path.resolve(__dirname, '../fixtures/mock-region-analysis-provider.mjs');
    process.env['MCP_PDF_REGION_ANALYSIS_COMMAND'] = process.execPath;
    process.env['MCP_PDF_REGION_ANALYSIS_ARGS_JSON'] = JSON.stringify([
      scriptPath,
      '{input}',
      '{page}',
      '{region_id}',
    ]);

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
      analyzeRegionCropWithCommandProvider(
        buildRegionCrop(),
        { source: 'mock.pdf' },
        defaultAnalyzeRegionsOptions()
      )
    ).rejects.toThrow(/Region analysis command provider is not configured/);
  });

  it('should reject command args that cannot receive the cropped region image', () => {
    process.env['MCP_PDF_REGION_ANALYSIS_COMMAND'] = process.execPath;
    process.env['MCP_PDF_REGION_ANALYSIS_ARGS_JSON'] = JSON.stringify(['--version']);

    expect(() => readRegionAnalysisProviderConfig()).toThrow(/\{input\} placeholder/);
  });
});
