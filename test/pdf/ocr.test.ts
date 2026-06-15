import path from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  defaultOcrPagesOptions,
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

    process.env['MCP_PDF_OCR_COMMAND'] = process.execPath;
    expect(isOcrProviderConfigured()).toBe(true);

    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_COMMAND');
    process.env['MCP_PDF_OCR_PRESET'] = 'tesseract';
    expect(isOcrProviderConfigured()).toBe(true);
  });

  it('should resolve the tesseract OCR preset without custom command args', () => {
    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_COMMAND');
    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_ARGS_JSON');
    process.env['MCP_PDF_OCR_PRESET'] = 'tesseract';

    expect(readCommandProviderConfig()).toEqual({
      command: 'tesseract',
      argsTemplate: ['{input}', 'stdout', '-l', '{languages_tesseract}'],
      preset: 'tesseract',
    });
  });

  it('should reject unsupported OCR provider presets', () => {
    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_COMMAND');
    process.env['MCP_PDF_OCR_PRESET'] = 'unknown';

    expect(() => readCommandProviderConfig()).toThrow(/Unsupported MCP_PDF_OCR_PRESET/);
  });

  it('should run the configured command OCR provider and normalize JSON output', async () => {
    const scriptPath = path.resolve(__dirname, '../fixtures/mock-ocr-provider.mjs');
    process.env['MCP_PDF_OCR_COMMAND'] = process.execPath;
    process.env['MCP_PDF_OCR_ARGS_JSON'] = JSON.stringify([scriptPath, '{input}', '{page}', '{languages}']);

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

  it('should fail with a curated error when OCR provider is not configured', async () => {
    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_COMMAND');
    Reflect.deleteProperty(process.env, 'MCP_PDF_OCR_ARGS_JSON');

    await expect(
      ocrRenderedPageWithCommandProvider(buildRenderedPage(), { source: 'mock.pdf' }, defaultOcrPagesOptions())
    ).rejects.toThrow(/OCR provider is not configured/);
  });

  it('should reject command args that cannot receive the rendered page image', async () => {
    process.env['MCP_PDF_OCR_COMMAND'] = process.execPath;
    process.env['MCP_PDF_OCR_ARGS_JSON'] = JSON.stringify(['--version']);

    await expect(
      ocrRenderedPageWithCommandProvider(buildRenderedPage(), { source: 'mock.pdf' }, defaultOcrPagesOptions())
    ).rejects.toThrow(/\{input\} placeholder/);
  });
});
