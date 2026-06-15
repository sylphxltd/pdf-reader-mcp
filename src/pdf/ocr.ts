import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  OcrPagesOptions,
  PdfOcrPageData,
  PdfOcrWord,
  PdfPageRenderData,
  PdfSource,
} from '../types/pdf.js';
import { ErrorCode, PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import {
  DEFAULT_MAX_RENDER_PAGES,
  DEFAULT_MAX_RENDER_PIXELS,
  DEFAULT_RENDER_SCALE,
  renderPdfSourcePages,
} from './renderer.js';

const execFileAsync = promisify(execFile);
const logger = createLogger('Ocr');

export const DEFAULT_OCR_TIMEOUT_MS = 60_000;
export const DEFAULT_OCR_MAX_OUTPUT_CHARS = 200_000;
const OCR_COMMAND_ENV = 'MCP_PDF_OCR_COMMAND';
const OCR_ARGS_ENV = 'MCP_PDF_OCR_ARGS_JSON';
const OCR_PRESET_ENV = 'MCP_PDF_OCR_PRESET';

interface CommandOcrProviderConfig {
  command: string;
  argsTemplate: string[];
  preset?: OcrProviderPreset | undefined;
}

type OcrProviderPreset = 'tesseract';

const OCR_PROVIDER_PRESETS: Record<OcrProviderPreset, CommandOcrProviderConfig> = {
  tesseract: {
    command: 'tesseract',
    argsTemplate: ['{input}', 'stdout', '-l', '{languages_tesseract}'],
    preset: 'tesseract',
  },
};

interface RawOcrOutput {
  text?: unknown;
  confidence?: unknown;
  words?: unknown;
  language?: unknown;
}

export const defaultOcrPagesOptions = (): OcrPagesOptions => ({
  scale: DEFAULT_RENDER_SCALE,
  max_pages: DEFAULT_MAX_RENDER_PAGES,
  max_pixels_per_page: DEFAULT_MAX_RENDER_PIXELS,
  timeout_ms: DEFAULT_OCR_TIMEOUT_MS,
  max_output_chars: DEFAULT_OCR_MAX_OUTPUT_CHARS,
});

export const isOcrProviderConfigured = (): boolean =>
  Boolean(process.env[OCR_COMMAND_ENV]?.trim() || process.env[OCR_PRESET_ENV]?.trim());

const readOcrProviderPreset = (): CommandOcrProviderConfig | undefined => {
  const preset = process.env[OCR_PRESET_ENV]?.trim().toLowerCase();
  if (!preset) return undefined;

  if (preset !== 'tesseract') {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      'Unsupported MCP_PDF_OCR_PRESET. Supported values: tesseract.'
    );
  }

  return OCR_PROVIDER_PRESETS[preset];
};

export const readCommandProviderConfig = (): CommandOcrProviderConfig => {
  const preset = readOcrProviderPreset();
  const command = process.env[OCR_COMMAND_ENV]?.trim() || preset?.command;
  if (!command) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      'OCR provider is not configured. Set MCP_PDF_OCR_COMMAND or MCP_PDF_OCR_PRESET=tesseract to enable ocr_pages.'
    );
  }

  const rawArgs = process.env[OCR_ARGS_ENV];
  if (!rawArgs)
    return { command, argsTemplate: preset?.argsTemplate ?? ['{input}'], preset: preset?.preset };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArgs);
  } catch (error: unknown) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      'MCP_PDF_OCR_ARGS_JSON must be a JSON string array.',
      {
        cause: error instanceof Error ? error : undefined,
      }
    );
  }

  if (!Array.isArray(parsed) || parsed.some((arg) => typeof arg !== 'string')) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      'MCP_PDF_OCR_ARGS_JSON must be a JSON string array.'
    );
  }

  if (!parsed.some((arg) => arg.includes('{input}'))) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      'MCP_PDF_OCR_ARGS_JSON must include the {input} placeholder so the OCR provider receives the rendered page image.'
    );
  }

  return { command, argsTemplate: parsed, preset: preset?.preset };
};

const replacePlaceholders = (
  template: string,
  context: {
    inputPath: string;
    page: number;
    source: string;
    languages?: string[] | undefined;
  }
): string =>
  template
    .replaceAll('{input}', context.inputPath)
    .replaceAll('{page}', String(context.page))
    .replaceAll('{source}', context.source)
    .replaceAll('{language}', context.languages?.[0] ?? '')
    .replaceAll('{languages}', context.languages?.join(',') ?? '')
    .replaceAll('{languages_tesseract}', context.languages?.join('+') || 'eng');

const normalizeConfidence = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, value > 1 ? value / 100 : value));
};

const normalizeBoundingBox = (value: unknown): PdfOcrWord['bounding_box'] | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;

  const candidate = value as Partial<
    Record<keyof NonNullable<PdfOcrWord['bounding_box']>, unknown>
  >;
  const left = candidate.left;
  const bottom = candidate.bottom;
  const right = candidate.right;
  const top = candidate.top;

  if (
    typeof left !== 'number' ||
    !Number.isFinite(left) ||
    typeof bottom !== 'number' ||
    !Number.isFinite(bottom) ||
    typeof right !== 'number' ||
    !Number.isFinite(right) ||
    typeof top !== 'number' ||
    !Number.isFinite(top) ||
    right <= left ||
    top <= bottom
  ) {
    return undefined;
  }

  return { left, bottom, right, top };
};

const normalizeWords = (value: unknown): PdfOcrWord[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const words = value
    .map((word): PdfOcrWord | undefined => {
      if (typeof word !== 'object' || word === null) return undefined;
      const candidate = word as {
        text?: unknown;
        confidence?: unknown;
        bounding_box?: unknown;
      };
      if (typeof candidate.text !== 'string' || candidate.text.trim().length === 0) {
        return undefined;
      }

      const confidence = normalizeConfidence(candidate.confidence);
      const boundingBox = normalizeBoundingBox(candidate.bounding_box);

      return {
        text: candidate.text,
        ...(confidence !== undefined ? { confidence } : {}),
        ...(boundingBox ? { bounding_box: boundingBox } : {}),
      };
    })
    .filter((word): word is PdfOcrWord => word !== undefined);

  return words.length > 0 ? words : undefined;
};

const parseOcrOutput = (
  stdout: string,
  options: Pick<OcrPagesOptions, 'max_output_chars' | 'languages'>
): Omit<PdfOcrPageData, 'page' | 'provider' | 'source_render_evidence_id' | 'provenance'> => {
  const trimmed = stdout.trim();
  let parsed: RawOcrOutput | undefined;

  try {
    const maybeJson = JSON.parse(trimmed) as RawOcrOutput;
    if (typeof maybeJson === 'object' && maybeJson !== null) {
      parsed = maybeJson;
    }
  } catch {
    parsed = undefined;
  }

  const rawText = parsed && typeof parsed.text === 'string' ? parsed.text : trimmed;
  const text =
    rawText.length > options.max_output_chars
      ? rawText.slice(0, options.max_output_chars)
      : rawText;
  const warnings =
    rawText.length > options.max_output_chars
      ? [`OCR output truncated to ${String(options.max_output_chars)} characters.`]
      : undefined;
  const confidence = normalizeConfidence(parsed?.confidence);
  const words = normalizeWords(parsed?.words);

  return {
    text,
    ...(confidence !== undefined ? { confidence } : {}),
    ...(words ? { words } : {}),
    ...(typeof parsed?.language === 'string'
      ? { language: parsed.language }
      : options.languages?.[0]
        ? { language: options.languages[0] }
        : {}),
    ...(warnings ? { warnings } : {}),
  };
};

export const ocrRenderedPageWithCommandProvider = async (
  page: PdfPageRenderData,
  context: { source: string; languages?: string[] | undefined },
  options: OcrPagesOptions
): Promise<PdfOcrPageData> => {
  const config = readCommandProviderConfig();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-reader-mcp-ocr-'));
  const inputPath = path.join(tempDir, `page-${String(page.page)}.png`);

  try {
    await fs.writeFile(inputPath, Buffer.from(page.data, 'base64'));
    const args = config.argsTemplate.map((arg) =>
      replacePlaceholders(arg, {
        inputPath,
        page: page.page,
        source: context.source,
        languages: context.languages,
      })
    );
    const { stdout } = await execFileAsync(config.command, args, {
      timeout: options.timeout_ms,
      maxBuffer: Math.max(options.max_output_chars * 4, 1024 * 1024),
      windowsHide: true,
    });
    const normalized = parseOcrOutput(stdout, options);

    return {
      page: page.page,
      ...normalized,
      provider: 'command',
      source_render_evidence_id: page.evidence_id,
      provenance: {
        engine: 'external-command',
        source: 'ocr-provider',
      },
    };
  } catch (error: unknown) {
    if (error instanceof PdfError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('OCR provider command failed', { page: page.page, error: message });
    throw new PdfError(
      ErrorCode.InvalidRequest,
      `OCR provider command failed for page ${String(page.page)}.`
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
};

export const ocrPdfSourcePages = async (
  source: PdfSource,
  options: OcrPagesOptions
): Promise<{
  source: string;
  numPages: number;
  pages: PdfOcrPageData[];
  warnings: string[];
}> => {
  const rendered = await renderPdfSourcePages(source, {
    scale: options.scale,
    max_pages: options.max_pages,
    max_pixels_per_page: options.max_pixels_per_page,
    include_image: false,
  });
  const pages: PdfOcrPageData[] = [];

  for (const page of rendered.pages) {
    pages.push(
      await ocrRenderedPageWithCommandProvider(
        page,
        { source: rendered.source, languages: options.languages },
        options
      )
    );
  }

  return {
    source: rendered.source,
    numPages: rendered.numPages,
    pages,
    warnings: rendered.warnings,
  };
};
