import path from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildOcrTextLayer,
  defaultOcrPagesOptions,
  getOcrProviderStatus,
  isOcrProviderConfigured,
  ocrRenderedPageWithCommandProvider,
  readCommandProviderConfig,
} from '../../src/pdf/ocr.js';
import type { PdfPageRenderData } from '../../src/types/pdf.js';

const originalCommand = process.env['MCP_PDF_OCR_COMMAND'];
const originalArgs = process.env['MCP_PDF_OCR_ARGS_JSON'];
const originalPreset = process.env['MCP_PDF_OCR_PRESET'];

const restoreEnv = (
  name: 'MCP_PDF_OCR_COMMAND' | 'MCP_PDF_OCR_ARGS_JSON' | 'MCP_PDF_OCR_PRESET',
  value: string | undefined
) => {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
    return;
  }

  process.env[name] = value;
};

const buildRenderedPage = (): PdfPageRenderData => {
  const png = new PNG({ width: 2, height: 2 });
  png.data.fill(255);

  return {
    page: 3,
    evidence_id: 'page-3-render-scale-1',
    width: 2,
    height: 2,
    scale: 1,
    pixel_count: 4,
    byte_length: 10,
    format: 'png',
    mime_type: 'image/png',
    rotation: 0,
    provenance: {
      engine: 'pdfjs',
      renderer: '@napi-rs/canvas',
      source: 'page-render',
    },
    data: PNG.sync.write(png).toString('base64'),
  };
};

describe('ocr', () => {
  afterEach(() => {
    restoreEnv('MCP_PDF_OCR_COMMAND', originalCommand);
    restoreEnv('MCP_PDF_OCR_ARGS_JSON', originalArgs);
    restoreEnv('MCP_PDF_OCR_PRESET', originalPreset);
  });

  it('should report whether the command OCR provider is configured', () => {
    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_COMMAND');
    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_PRESET');
    expect(isOcrProviderConfigured()).toBe(false);
    expect(getOcrProviderStatus()).toMatchObject({
      readiness: 'not_configured',
      provider: 'command',
      command_configured: false,
    });

    process.env['MCP_PDF_OCR_COMMAND'] = process.execPath;
    expect(isOcrProviderConfigured()).toBe(true);
    expect(getOcrProviderStatus()).toMatchObject({
      readiness: 'ready',
      provider: 'command',
      command_configured: true,
    });

    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_COMMAND');
    process.env['MCP_PDF_OCR_PRESET'] = 'tesseract';
    expect(isOcrProviderConfigured()).toBe(true);
    expect(getOcrProviderStatus()).toMatchObject({
      readiness: 'ready',
      provider: 'command',
      command_configured: false,
      preset: 'tesseract',
    });

    process.env['MCP_PDF_OCR_PRESET'] = 'tesseract-tsv';
    expect(getOcrProviderStatus()).toMatchObject({
      readiness: 'ready',
      provider: 'command',
      command_configured: false,
      preset: 'tesseract-tsv',
    });
  });

  it('should resolve the tesseract OCR preset without custom command args', () => {
    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_COMMAND');
    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_ARGS_JSON');
    process.env['MCP_PDF_OCR_PRESET'] = 'tesseract';

    expect(readCommandProviderConfig()).toEqual({
      command: 'tesseract',
      argsTemplate: ['{input}', 'stdout', '-l', '{languages_tesseract}'],
      preset: 'tesseract',
      outputFormat: 'plain-text',
    });
  });

  it('should resolve the tesseract TSV OCR preset without custom command args', () => {
    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_COMMAND');
    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_ARGS_JSON');
    process.env['MCP_PDF_OCR_PRESET'] = 'tesseract-tsv';

    expect(readCommandProviderConfig()).toEqual({
      command: 'tesseract',
      argsTemplate: ['{input}', 'stdout', '-l', '{languages_tesseract}', 'tsv'],
      preset: 'tesseract-tsv',
      outputFormat: 'tesseract-tsv',
    });
  });

  it('should reject unsupported OCR provider presets', () => {
    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_COMMAND');
    process.env['MCP_PDF_OCR_PRESET'] = 'unknown';

    expect(() => readCommandProviderConfig()).toThrow(/Unsupported MCP_PDF_OCR_PRESET/);
    expect(getOcrProviderStatus()).toMatchObject({
      readiness: 'invalid_configuration',
      provider: 'command',
      preset: 'unsupported',
    });
  });

  it('should run the configured command OCR provider and normalize JSON output', async () => {
    const scriptPath = path.resolve(__dirname, '../fixtures/mock-ocr-provider.mjs');
    process.env['MCP_PDF_OCR_COMMAND'] = process.execPath;
    process.env['MCP_PDF_OCR_ARGS_JSON'] = JSON.stringify([
      scriptPath,
      '{input}',
      '{page}',
      '{languages}',
    ]);

    const result = await ocrRenderedPageWithCommandProvider(
      buildRenderedPage(),
      { source: 'mock.pdf', languages: ['eng'] },
      defaultOcrPagesOptions()
    );

    expect(result).toMatchObject({
      page: 3,
      text: 'Mock OCR text for page 3',
      confidence: 0.93,
      language: 'eng',
      provider: 'command',
      source_render_evidence_id: 'page-3-render-scale-1',
      provenance: {
        engine: 'external-command',
        source: 'ocr-provider',
      },
      words: [
        {
          text: 'Mock',
          confidence: 0.95,
          bounding_box: { left: 0, bottom: 0, right: 20, top: 10 },
        },
      ],
    });
  });

  it('should run the tesseract TSV preset and normalize word boxes', async () => {
    const scriptPath = path.resolve(__dirname, '../fixtures/mock-tesseract-tsv-provider.mjs');
    process.env['MCP_PDF_OCR_COMMAND'] = process.execPath;
    process.env['MCP_PDF_OCR_PRESET'] = 'tesseract-tsv';
    process.env['MCP_PDF_OCR_ARGS_JSON'] = JSON.stringify([
      scriptPath,
      '{input}',
      '{page}',
      '{languages}',
    ]);

    const result = await ocrRenderedPageWithCommandProvider(
      buildRenderedPage(),
      { source: 'mock.pdf', languages: ['eng'] },
      defaultOcrPagesOptions()
    );

    expect(result).toMatchObject({
      page: 3,
      text: 'Hello World',
      confidence: 0.91,
      language: 'eng',
      provider: 'command',
      source_render_evidence_id: 'page-3-render-scale-1',
      provenance: {
        engine: 'external-command',
        source: 'ocr-provider',
      },
      words: [
        {
          text: 'Hello',
          confidence: 0.95,
          bounding_box: { left: 0, bottom: 1, right: 1, top: 2 },
        },
        {
          text: 'World',
          confidence: 0.87,
          bounding_box: { left: 1, bottom: 0, right: 2, top: 1 },
        },
      ],
    });
  });

  it('should build an OCR text layer summary with render provenance', () => {
    const layer = buildOcrTextLayer(
      [
        {
          page: 2,
          text: 'Scanned text',
          confidence: 0.84,
          words: [
            {
              text: 'Scanned',
              confidence: 0.9,
              bounding_box: { left: 10, bottom: 700, right: 80, top: 714 },
            },
            { text: 'text', confidence: 0.78 },
          ],
          provider: 'command',
          source_render_evidence_id: 'page-2-render-scale-2',
          provenance: {
            engine: 'external-command',
            source: 'ocr-provider',
          },
          warnings: ['Low contrast OCR region.'],
        },
      ],
      ['Rendered page 2 for OCR.']
    );

    expect(layer).toMatchObject({
      profile: 'ocr_text_layer',
      summary: {
        page_count: 1,
        text_chars: 12,
        word_count: 2,
        words_with_bounding_boxes: 1,
        source_render_count: 1,
        average_confidence: 0.84,
      },
      warnings: ['Rendered page 2 for OCR.', 'Low contrast OCR region.'],
    });
  });

  it('should fail with a curated error when OCR provider is not configured', async () => {
    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_COMMAND');
    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_ARGS_JSON');

    await expect(
      ocrRenderedPageWithCommandProvider(
        buildRenderedPage(),
        { source: 'mock.pdf' },
        defaultOcrPagesOptions()
      )
    ).rejects.toThrow(/OCR provider is not configured/);
  });

  it('should reject command args that cannot receive the rendered page image', async () => {
    process.env['MCP_PDF_OCR_COMMAND'] = process.execPath;
    process.env['MCP_PDF_OCR_ARGS_JSON'] = JSON.stringify(['--version']);

    await expect(
      ocrRenderedPageWithCommandProvider(
        buildRenderedPage(),
        { source: 'mock.pdf' },
        defaultOcrPagesOptions()
      )
    ).rejects.toThrow(/\{input\} placeholder/);
  });
});
