import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  OcrPagesOptions,
  PdfOcrPageData,
  PdfOcrProviderStatus,
  PdfOcrTextLayer,
  PdfOcrWord,
  PdfPageRenderData,
  PdfSource,
} from '../types/pdf.js';
import { ErrorCode, PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { execFileAsync } from '../utils/pdfjs.js';
import {
  DEFAULT_MAX_RENDER_PAGES,
  DEFAULT_MAX_RENDER_PIXELS,
  DEFAULT_RENDER_SCALE,
  renderPdfSourcePages,
} from './renderer.js';

const logger = createLogger('Ocr');

const DEFAULT_OCR_TIMEOUT_MS = 60_000;
const DEFAULT_OCR_MAX_OUTPUT_CHARS = 200_000;
const OCR_COMMAND_ENV = 'MCP_PDF_OCR_COMMAND';
const OCR_ARGS_ENV = 'MCP_PDF_OCR_ARGS_JSON';
const OCR_PRESET_ENV = 'MCP_PDF_OCR_PRESET';
const OCR_PRESET_HEALTHCHECK_TIMEOUT_MS = 2_500;

interface CommandOcrProviderConfig {
  command: string;
  argsTemplate: string[];
  preset?: OcrProviderPreset | undefined;
  outputFormat?: OcrProviderOutputFormat | undefined;
}

type OcrProviderPreset = 'tesseract' | 'tesseract-tsv';
type OcrProviderOutputFormat = 'plain-text' | 'tesseract-tsv';

const OCR_PROVIDER_PRESETS: Record<OcrProviderPreset, CommandOcrProviderConfig> = {
  tesseract: {
    command: 'tesseract',
    argsTemplate: ['{input}', 'stdout', '-l', '{languages_tesseract}'],
    preset: 'tesseract',
    outputFormat: 'plain-text',
  },
  'tesseract-tsv': {
    command: 'tesseract',
    argsTemplate: ['{input}', 'stdout', '-l', '{languages_tesseract}', 'tsv'],
    preset: 'tesseract-tsv',
    outputFormat: 'tesseract-tsv',
  },
};

const SUPPORTED_OCR_PRESETS = Object.keys(OCR_PROVIDER_PRESETS) as OcrProviderPreset[];

const isOcrProviderPreset = (value: string): value is OcrProviderPreset =>
  SUPPORTED_OCR_PRESETS.includes(value as OcrProviderPreset);

const checkOcrPresetExecutable = (
  preset: OcrProviderPreset
): { available: true } | { available: false; warning: string } => {
  const command = OCR_PROVIDER_PRESETS[preset].command;
  const result = spawnSync(command, ['--version'], {
    timeout: OCR_PRESET_HEALTHCHECK_TIMEOUT_MS,
    windowsHide: true,
    stdio: 'ignore',
  });

  if (result.status === 0) return { available: true };

  if (result.error) {
    return {
      available: false,
      warning: `${command} executable was not found or could not be started for MCP_PDF_OCR_PRESET=${preset}.`,
    };
  }

  if (result.signal) {
    return {
      available: false,
      warning: `${command} health check for MCP_PDF_OCR_PRESET=${preset} ended with signal ${result.signal}.`,
    };
  }

  return {
    available: false,
    warning: `${command} health check for MCP_PDF_OCR_PRESET=${preset} exited with status ${String(result.status ?? 'unknown')}.`,
  };
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

const roundRatio = (value: number): number => Math.round(value * 100) / 100;
const roundCoordinate = (value: number): number => Math.round(value * 100) / 100;

const normalizeWordBoxesToPdfCoordinates = (
  words: PdfOcrWord[] | undefined,
  scale: number
): PdfOcrWord[] | undefined => {
  if (!words || scale <= 0 || !Number.isFinite(scale)) return words;

  return words.map((word) => {
    if (!word.bounding_box) return word;

    return {
      ...word,
      bounding_box: {
        left: roundCoordinate(word.bounding_box.left / scale),
        bottom: roundCoordinate(word.bounding_box.bottom / scale),
        right: roundCoordinate(word.bounding_box.right / scale),
        top: roundCoordinate(word.bounding_box.top / scale),
      },
    };
  });
};

export const buildOcrTextLayer = (
  pages: PdfOcrPageData[],
  warnings: string[] = []
): PdfOcrTextLayer => {
  const textChars = pages.reduce((sum, page) => sum + page.text.length, 0);
  const words = pages.flatMap((page) => page.words ?? []);
  const confidences = pages
    .map((page) => page.confidence)
    .filter((confidence): confidence is number => confidence !== undefined);
  const averageConfidence =
    confidences.length > 0
      ? roundRatio(
          confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length
        )
      : undefined;
  const sourceRenderCount = new Set(pages.map((page) => page.source_render_evidence_id)).size;
  const pageWarnings = pages.flatMap((page) => page.warnings ?? []);
  const allWarnings = [...warnings, ...pageWarnings];

  return {
    profile: 'ocr_text_layer',
    pages,
    summary: {
      page_count: pages.length,
      text_chars: textChars,
      word_count: words.length,
      words_with_bounding_boxes: words.filter((word) => word.bounding_box !== undefined).length,
      source_render_count: sourceRenderCount,
      ...(averageConfidence !== undefined ? { average_confidence: averageConfidence } : {}),
    },
    ...(allWarnings.length > 0 ? { warnings: allWarnings } : {}),
  };
};

export const isOcrProviderConfigured = (): boolean =>
  Boolean(process.env[OCR_COMMAND_ENV]?.trim() || process.env[OCR_PRESET_ENV]?.trim());

export const getOcrProviderStatus = (): PdfOcrProviderStatus => {
  const rawPreset = process.env[OCR_PRESET_ENV]?.trim().toLowerCase();
  const commandConfigured = Boolean(process.env[OCR_COMMAND_ENV]?.trim());
  const preset = rawPreset
    ? isOcrProviderPreset(rawPreset)
      ? rawPreset
      : 'unsupported'
    : undefined;

  if (preset === 'unsupported') {
    return {
      readiness: 'invalid_configuration',
      provider: 'command',
      command_configured: commandConfigured,
      health: 'not_checked',
      health_check: 'not_checked',
      preset,
      warnings: [
        `Unsupported MCP_PDF_OCR_PRESET. Supported values: ${SUPPORTED_OCR_PRESETS.join(', ')}.`,
      ],
    };
  }

  if (!commandConfigured && !preset) {
    return {
      readiness: 'not_configured',
      provider: 'command',
      command_configured: false,
      health: 'not_checked',
      health_check: 'not_checked',
      warnings: ['Set MCP_PDF_OCR_COMMAND or MCP_PDF_OCR_PRESET=tesseract to enable ocr_pages.'],
    };
  }

  if (preset && !commandConfigured) {
    const health = checkOcrPresetExecutable(preset);
    if (!health.available) {
      return {
        readiness: 'unavailable',
        provider: 'command',
        command_configured: false,
        health: 'unavailable',
        health_check: 'preset_executable',
        preset,
        warnings: [health.warning],
      };
    }

    return {
      readiness: 'ready',
      provider: 'command',
      command_configured: false,
      health: 'available',
      health_check: 'preset_executable',
      preset,
    };
  }

  return {
    readiness: 'ready',
    provider: 'command',
    command_configured: commandConfigured,
    health: 'not_checked',
    health_check: 'not_checked',
    ...(preset ? { preset } : {}),
  };
};

const readOcrProviderPreset = (): CommandOcrProviderConfig | undefined => {
  const preset = process.env[OCR_PRESET_ENV]?.trim().toLowerCase();
  if (!preset) return undefined;

  if (!isOcrProviderPreset(preset)) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      `Unsupported MCP_PDF_OCR_PRESET. Supported values: ${SUPPORTED_OCR_PRESETS.join(', ')}.`
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
    return {
      command,
      argsTemplate: preset?.argsTemplate ?? ['{input}'],
      preset: preset?.preset,
      outputFormat: preset?.outputFormat,
    };

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

  return {
    command,
    argsTemplate: parsed,
    preset: preset?.preset,
    outputFormat: preset?.outputFormat,
  };
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

const parseFiniteNumber = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const requiredTsvColumnIndexes = (
  headers: string[]
):
  | {
      level: number;
      blockNum: number;
      parNum: number;
      lineNum: number;
      left: number;
      top: number;
      width: number;
      height: number;
      confidence: number;
      text: number;
    }
  | undefined => {
  const index = (name: string) => headers.indexOf(name);
  const columns = {
    level: index('level'),
    blockNum: index('block_num'),
    parNum: index('par_num'),
    lineNum: index('line_num'),
    left: index('left'),
    top: index('top'),
    width: index('width'),
    height: index('height'),
    confidence: index('conf'),
    text: index('text'),
  };

  return Object.values(columns).some((value) => value < 0) ? undefined : columns;
};

const truncateOcrText = (
  text: string,
  maxOutputChars: number
): { text: string; warnings?: string[] | undefined } =>
  text.length > maxOutputChars
    ? {
        text: text.slice(0, maxOutputChars),
        warnings: [`OCR output truncated to ${String(maxOutputChars)} characters.`],
      }
    : { text };

const parseTesseractTsvOutput = (
  stdout: string,
  options: Pick<OcrPagesOptions, 'max_output_chars' | 'languages'>,
  imageHeight: number | undefined
): Omit<PdfOcrPageData, 'page' | 'provider' | 'source_render_evidence_id' | 'provenance'> => {
  const lines = stdout.trim().split(/\r?\n/u);
  const headers = lines[0]?.split('\t');
  const columns = headers ? requiredTsvColumnIndexes(headers) : undefined;

  if (!columns || imageHeight === undefined || imageHeight <= 0) {
    const truncated = truncateOcrText(stdout.trim(), options.max_output_chars);
    return {
      text: truncated.text,
      ...(options.languages?.[0] ? { language: options.languages[0] } : {}),
      warnings: [
        ...(truncated.warnings ?? []),
        'Tesseract TSV output could not be normalized; returned raw OCR output.',
      ],
    };
  }

  const words: PdfOcrWord[] = [];
  const lineTexts = new Map<string, string[]>();

  for (const rawLine of lines.slice(1)) {
    if (!rawLine.trim()) continue;

    const values = rawLine.split('\t');
    const level = parseFiniteNumber(values[columns.level]);
    const text = values.slice(columns.text).join('\t').trim();
    if (level !== 5 || text.length === 0) continue;

    const left = parseFiniteNumber(values[columns.left]);
    const top = parseFiniteNumber(values[columns.top]);
    const width = parseFiniteNumber(values[columns.width]);
    const height = parseFiniteNumber(values[columns.height]);
    const confidence = normalizeConfidence(parseFiniteNumber(values[columns.confidence]));
    const lineKey = [
      values[columns.blockNum] ?? '0',
      values[columns.parNum] ?? '0',
      values[columns.lineNum] ?? '0',
    ].join(':');

    const line = lineTexts.get(lineKey) ?? [];
    line.push(text);
    lineTexts.set(lineKey, line);

    const boundingBox =
      left !== undefined &&
      top !== undefined &&
      width !== undefined &&
      height !== undefined &&
      width > 0 &&
      height > 0
        ? {
            left,
            bottom: imageHeight - top - height,
            right: left + width,
            top: imageHeight - top,
          }
        : undefined;

    words.push({
      text,
      ...(confidence !== undefined ? { confidence } : {}),
      ...(boundingBox ? { bounding_box: boundingBox } : {}),
    });
  }

  const rawText = [...lineTexts.values()].map((line) => line.join(' ')).join('\n');
  const truncated = truncateOcrText(rawText, options.max_output_chars);
  const confidences = words
    .map((word) => word.confidence)
    .filter((confidence): confidence is number => confidence !== undefined);
  const confidence =
    confidences.length > 0
      ? roundRatio(confidences.reduce((sum, value) => sum + value, 0) / confidences.length)
      : undefined;

  return {
    text: truncated.text,
    ...(confidence !== undefined ? { confidence } : {}),
    ...(words.length > 0 ? { words } : {}),
    ...(options.languages?.[0] ? { language: options.languages[0] } : {}),
    ...(truncated.warnings ? { warnings: truncated.warnings } : {}),
  };
};

const parseOcrOutput = (
  stdout: string,
  options: Pick<OcrPagesOptions, 'max_output_chars' | 'languages'>,
  context: {
    outputFormat?: OcrProviderOutputFormat | undefined;
    imageHeight?: number | undefined;
  } = {}
): Omit<PdfOcrPageData, 'page' | 'provider' | 'source_render_evidence_id' | 'provenance'> => {
  if (context.outputFormat === 'tesseract-tsv') {
    return parseTesseractTsvOutput(stdout, options, context.imageHeight);
  }

  const trimmed = stdout.trim();
  let parsed: RawOcrOutput | undefined;

  try {
    const maybeJson = JSON.parse(trimmed) as unknown;
    if (typeof maybeJson === 'object' && maybeJson !== null) {
      parsed = maybeJson;
    }
  } catch {
    parsed = undefined;
  }

  const rawText = parsed && typeof parsed.text === 'string' ? parsed.text : trimmed;
  const truncated = truncateOcrText(rawText, options.max_output_chars);
  const confidence = normalizeConfidence(parsed?.confidence);
  const words = normalizeWords(parsed?.words);

  return {
    text: truncated.text,
    ...(confidence !== undefined ? { confidence } : {}),
    ...(words ? { words } : {}),
    ...(typeof parsed?.language === 'string'
      ? { language: parsed.language }
      : options.languages?.[0]
        ? { language: options.languages[0] }
        : {}),
    ...(truncated.warnings ? { warnings: truncated.warnings } : {}),
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
    const outputOptions: Pick<OcrPagesOptions, 'max_output_chars' | 'languages'> = {
      max_output_chars: options.max_output_chars,
      ...((context.languages ?? options.languages)
        ? { languages: context.languages ?? options.languages }
        : {}),
    };
    const normalized = parseOcrOutput(stdout, outputOptions, {
      outputFormat: config.outputFormat,
      imageHeight: page.height,
    });

    return {
      page: page.page,
      ...normalized,
      ...(normalized.words
        ? { words: normalizeWordBoxesToPdfCoordinates(normalized.words, page.scale) }
        : {}),
      provider: 'command',
      source_render_evidence_id: page.evidence_id,
      source_render_scale: page.scale,
      source_render_width: page.width,
      source_render_height: page.height,
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
