import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  AnalyzeRegionsOptions,
  BoundingBox,
  PdfRegionAnalysisChart,
  PdfRegionAnalysisChartAxis,
  PdfRegionAnalysisChartSeries,
  PdfRegionAnalysisData,
  PdfRegionAnalysisFormula,
  PdfRegionAnalysisKind,
  PdfRegionAnalysisProviderStatus,
  PdfRegionAnalysisTable,
  PdfRegionAnalysisTableCell,
  PdfRegionCropData,
  PdfRegionRequest,
} from '../types/pdf.js';
import { ErrorCode, PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { DEFAULT_MAX_REGIONS, extractRegionCropsFromSource } from './regions.js';
import { DEFAULT_MAX_RENDER_PIXELS, DEFAULT_RENDER_SCALE } from './renderer.js';

const execFileAsync = promisify(execFile);
const logger = createLogger('RegionAnalysis');

export const DEFAULT_REGION_ANALYSIS_TIMEOUT_MS = 60_000;
export const DEFAULT_REGION_ANALYSIS_MAX_OUTPUT_CHARS = 200_000;
const REGION_ANALYSIS_COMMAND_ENV = 'MCP_PDF_REGION_ANALYSIS_COMMAND';
const REGION_ANALYSIS_ARGS_ENV = 'MCP_PDF_REGION_ANALYSIS_ARGS_JSON';
const REGION_ANALYSIS_KINDS = new Set<PdfRegionAnalysisKind>([
  'text',
  'table',
  'figure',
  'chart',
  'formula',
  'image',
  'diagram',
  'unknown',
]);

interface CommandRegionAnalysisProviderConfig {
  command: string;
  argsTemplate: string[];
}

interface RawRegionAnalysisOutput {
  kind?: unknown;
  description?: unknown;
  text?: unknown;
  markdown?: unknown;
  confidence?: unknown;
  table?: unknown;
  formula?: unknown;
  chart?: unknown;
  warnings?: unknown;
}

export const defaultAnalyzeRegionsOptions = (): AnalyzeRegionsOptions => ({
  scale: DEFAULT_RENDER_SCALE,
  max_regions: DEFAULT_MAX_REGIONS,
  max_pixels_per_page: DEFAULT_MAX_RENDER_PIXELS,
  timeout_ms: DEFAULT_REGION_ANALYSIS_TIMEOUT_MS,
  max_output_chars: DEFAULT_REGION_ANALYSIS_MAX_OUTPUT_CHARS,
});

export const isRegionAnalysisProviderConfigured = (): boolean =>
  Boolean(process.env[REGION_ANALYSIS_COMMAND_ENV]?.trim());

export const getRegionAnalysisProviderStatus = (): PdfRegionAnalysisProviderStatus => {
  const commandConfigured = isRegionAnalysisProviderConfigured();

  if (!commandConfigured) {
    return {
      readiness: 'not_configured',
      provider: 'command',
      command_configured: false,
      warnings: ['Set MCP_PDF_REGION_ANALYSIS_COMMAND to enable analyze_regions.'],
    };
  }

  return {
    readiness: 'ready',
    provider: 'command',
    command_configured: true,
  };
};

export const readRegionAnalysisProviderConfig = (): CommandRegionAnalysisProviderConfig => {
  const command = process.env[REGION_ANALYSIS_COMMAND_ENV]?.trim();
  if (!command) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      'Region analysis provider is not configured. Set MCP_PDF_REGION_ANALYSIS_COMMAND to enable analyze_regions.'
    );
  }

  const rawArgs = process.env[REGION_ANALYSIS_ARGS_ENV];
  if (!rawArgs) return { command, argsTemplate: ['{input}'] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArgs);
  } catch (error: unknown) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      'MCP_PDF_REGION_ANALYSIS_ARGS_JSON must be a JSON string array.',
      {
        cause: error instanceof Error ? error : undefined,
      }
    );
  }

  if (!Array.isArray(parsed) || parsed.some((arg) => typeof arg !== 'string')) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      'MCP_PDF_REGION_ANALYSIS_ARGS_JSON must be a JSON string array.'
    );
  }

  if (!parsed.some((arg) => arg.includes('{input}'))) {
    throw new PdfError(
      ErrorCode.InvalidRequest,
      'MCP_PDF_REGION_ANALYSIS_ARGS_JSON must include the {input} placeholder so the provider receives the cropped region image.'
    );
  }

  return { command, argsTemplate: parsed };
};

const replacePlaceholders = (
  template: string,
  context: {
    inputPath: string;
    page: number;
    source: string;
    regionId: string;
    evidenceId: string;
    left: number;
    bottom: number;
    right: number;
    top: number;
    languages?: string[] | undefined;
  }
): string =>
  template
    .replaceAll('{input}', context.inputPath)
    .replaceAll('{page}', String(context.page))
    .replaceAll('{source}', context.source)
    .replaceAll('{region_id}', context.regionId)
    .replaceAll('{evidence_id}', context.evidenceId)
    .replaceAll('{left}', String(context.left))
    .replaceAll('{bottom}', String(context.bottom))
    .replaceAll('{right}', String(context.right))
    .replaceAll('{top}', String(context.top))
    .replaceAll('{language}', context.languages?.[0] ?? '')
    .replaceAll('{languages}', context.languages?.join(',') ?? '');

const normalizeConfidence = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, value > 1 ? value / 100 : value));
};

const normalizePositiveInteger = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return undefined;
  return value;
};

const normalizeZeroBasedInteger = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return undefined;
  return value;
};

const normalizeString = (value: unknown, maxLength: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

const normalizeWarnings = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((warning) => (typeof warning === 'string' ? warning.trim() : undefined))
    .filter((warning): warning is string => Boolean(warning));
};

const normalizeKind = (value: unknown, warnings: string[]): PdfRegionAnalysisKind => {
  if (typeof value !== 'string') return 'unknown';

  const kind = value.trim().toLowerCase();
  if (REGION_ANALYSIS_KINDS.has(kind as PdfRegionAnalysisKind)) {
    return kind as PdfRegionAnalysisKind;
  }

  warnings.push(`Unsupported region analysis kind "${kind}"; normalized to "unknown".`);
  return 'unknown';
};

const normalizeBoundingBox = (value: unknown): BoundingBox | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;

  const candidate = value as Partial<Record<keyof BoundingBox, unknown>>;
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

const normalizeRows = (value: unknown): string[][] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const rows = value
    .map((row): string[] | undefined => {
      if (!Array.isArray(row)) return undefined;
      const cells = row.map((cell) => {
        if (cell === null) return '';
        if (['string', 'number', 'boolean'].includes(typeof cell)) return String(cell);
        return '';
      });
      return cells.length > 0 ? cells : undefined;
    })
    .filter((row): row is string[] => row !== undefined);

  return rows.length > 0 ? rows : undefined;
};

const normalizeTableCells = (
  value: unknown,
  maxLength: number
): PdfRegionAnalysisTableCell[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const cells = value
    .map((cell): PdfRegionAnalysisTableCell | undefined => {
      if (typeof cell !== 'object' || cell === null) return undefined;

      const candidate = cell as {
        text?: unknown;
        row_index?: unknown;
        row?: unknown;
        column_index?: unknown;
        column?: unknown;
        row_span?: unknown;
        rowspan?: unknown;
        column_span?: unknown;
        colspan?: unknown;
        confidence?: unknown;
        bounding_box?: unknown;
        bbox?: unknown;
      };
      const text = normalizeString(candidate.text, maxLength) ?? '';
      const rowIndex = normalizeZeroBasedInteger(candidate.row_index ?? candidate.row);
      const columnIndex = normalizeZeroBasedInteger(candidate.column_index ?? candidate.column);
      if (rowIndex === undefined || columnIndex === undefined) return undefined;

      const rowSpan = normalizePositiveInteger(candidate.row_span ?? candidate.rowspan);
      const columnSpan = normalizePositiveInteger(candidate.column_span ?? candidate.colspan);
      const confidence = normalizeConfidence(candidate.confidence);
      const boundingBox = normalizeBoundingBox(candidate.bounding_box ?? candidate.bbox);

      return {
        text,
        row_index: rowIndex,
        column_index: columnIndex,
        ...(rowSpan !== undefined ? { row_span: rowSpan } : {}),
        ...(columnSpan !== undefined ? { column_span: columnSpan } : {}),
        ...(confidence !== undefined ? { confidence } : {}),
        ...(boundingBox ? { bounding_box: boundingBox } : {}),
      };
    })
    .filter((cell): cell is PdfRegionAnalysisTableCell => cell !== undefined);

  return cells.length > 0 ? cells : undefined;
};

const deriveRowCount = (
  rows: string[][] | undefined,
  cells: PdfRegionAnalysisTableCell[] | undefined,
  explicit: unknown
): number | undefined => {
  const explicitCount = normalizePositiveInteger(explicit);
  if (explicitCount !== undefined) return explicitCount;
  if (rows && rows.length > 0) return rows.length;
  if (cells && cells.length > 0) {
    return Math.max(...cells.map((cell) => cell.row_index + (cell.row_span ?? 1)));
  }
  return undefined;
};

const deriveColumnCount = (
  rows: string[][] | undefined,
  cells: PdfRegionAnalysisTableCell[] | undefined,
  explicit: unknown
): number | undefined => {
  const explicitCount = normalizePositiveInteger(explicit);
  if (explicitCount !== undefined) return explicitCount;
  if (rows && rows.length > 0) return Math.max(...rows.map((row) => row.length));
  if (cells && cells.length > 0) {
    return Math.max(...cells.map((cell) => cell.column_index + (cell.column_span ?? 1)));
  }
  return undefined;
};

const normalizeTable = (value: unknown, maxLength: number): PdfRegionAnalysisTable | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;

  const candidate = value as {
    rows?: unknown;
    markdown?: unknown;
    csv?: unknown;
    row_count?: unknown;
    rowCount?: unknown;
    column_count?: unknown;
    col_count?: unknown;
    columnCount?: unknown;
    cells?: unknown;
    confidence?: unknown;
  };
  const rows = normalizeRows(candidate.rows);
  const markdown = normalizeString(candidate.markdown, maxLength);
  const csv = normalizeString(candidate.csv, maxLength);
  const cells = normalizeTableCells(candidate.cells, maxLength);
  const rowCount = deriveRowCount(rows, cells, candidate.row_count ?? candidate.rowCount);
  const columnCount = deriveColumnCount(
    rows,
    cells,
    candidate.column_count ?? candidate.columnCount ?? candidate.col_count
  );
  const confidence = normalizeConfidence(candidate.confidence);

  if (
    !rows &&
    !markdown &&
    !csv &&
    !cells &&
    rowCount === undefined &&
    columnCount === undefined &&
    confidence === undefined
  ) {
    return undefined;
  }

  return {
    ...(rows ? { rows } : {}),
    ...(markdown ? { markdown } : {}),
    ...(csv ? { csv } : {}),
    ...(rowCount !== undefined ? { row_count: rowCount } : {}),
    ...(columnCount !== undefined ? { column_count: columnCount } : {}),
    ...(cells ? { cells } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
  };
};

const normalizeFormula = (
  value: unknown,
  maxLength: number
): PdfRegionAnalysisFormula | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;

  const candidate = value as {
    latex?: unknown;
    mathml?: unknown;
    asciimath?: unknown;
    ascii_math?: unknown;
    text?: unknown;
    confidence?: unknown;
  };
  const latex = normalizeString(candidate.latex, maxLength);
  const mathml = normalizeString(candidate.mathml, maxLength);
  const asciimath = normalizeString(candidate.asciimath ?? candidate.ascii_math, maxLength);
  const text = normalizeString(candidate.text, maxLength);
  const confidence = normalizeConfidence(candidate.confidence);

  if (!latex && !mathml && !asciimath && !text && confidence === undefined) return undefined;

  return {
    ...(latex ? { latex } : {}),
    ...(mathml ? { mathml } : {}),
    ...(asciimath ? { asciimath } : {}),
    ...(text ? { text } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
  };
};

const normalizeDataPoints = (
  value: unknown
): Array<Record<string, string | number | boolean | null>> | undefined => {
  if (!Array.isArray(value)) return undefined;

  const points = value
    .map((point): Record<string, string | number | boolean | null> | undefined => {
      if (typeof point !== 'object' || point === null) return undefined;

      const normalized: Record<string, string | number | boolean | null> = {};
      for (const [key, rawValue] of Object.entries(point)) {
        if (rawValue === null || ['string', 'number', 'boolean'].includes(typeof rawValue)) {
          normalized[key] = rawValue as string | number | boolean | null;
        }
      }

      return Object.keys(normalized).length > 0 ? normalized : undefined;
    })
    .filter(
      (point): point is Record<string, string | number | boolean | null> => point !== undefined
    );

  return points.length > 0 ? points : undefined;
};

const normalizeChartAxis = (
  value: unknown,
  maxLength: number
): PdfRegionAnalysisChartAxis | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;

  const candidate = value as {
    label?: unknown;
    unit?: unknown;
    min?: unknown;
    max?: unknown;
  };
  const label = normalizeString(candidate.label, maxLength);
  const unit = normalizeString(candidate.unit, maxLength);
  const min =
    typeof candidate.min === 'number' && Number.isFinite(candidate.min) ? candidate.min : undefined;
  const max =
    typeof candidate.max === 'number' && Number.isFinite(candidate.max) ? candidate.max : undefined;

  if (!label && !unit && min === undefined && max === undefined) return undefined;

  return {
    ...(label ? { label } : {}),
    ...(unit ? { unit } : {}),
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
  };
};

const normalizeChartSeries = (
  value: unknown,
  maxLength: number
): PdfRegionAnalysisChartSeries[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const series = value
    .map((entry): PdfRegionAnalysisChartSeries | undefined => {
      if (typeof entry !== 'object' || entry === null) return undefined;

      const candidate = entry as {
        name?: unknown;
        data_points?: unknown;
        points?: unknown;
        confidence?: unknown;
      };
      const dataPoints = normalizeDataPoints(candidate.data_points ?? candidate.points);
      if (!dataPoints) return undefined;
      const name = normalizeString(candidate.name, maxLength);
      const confidence = normalizeConfidence(candidate.confidence);

      return {
        ...(name ? { name } : {}),
        data_points: dataPoints,
        ...(confidence !== undefined ? { confidence } : {}),
      };
    })
    .filter((entry): entry is PdfRegionAnalysisChartSeries => entry !== undefined);

  return series.length > 0 ? series : undefined;
};

const normalizeChart = (value: unknown, maxLength: number): PdfRegionAnalysisChart | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;

  const candidate = value as {
    title?: unknown;
    summary?: unknown;
    data_points?: unknown;
    x_axis?: unknown;
    y_axis?: unknown;
    series?: unknown;
    confidence?: unknown;
  };
  const title = normalizeString(candidate.title, maxLength);
  const summary = normalizeString(candidate.summary, maxLength);
  const dataPoints = normalizeDataPoints(candidate.data_points);
  const xAxis = normalizeChartAxis(candidate.x_axis, maxLength);
  const yAxis = normalizeChartAxis(candidate.y_axis, maxLength);
  const series = normalizeChartSeries(candidate.series, maxLength);
  const confidence = normalizeConfidence(candidate.confidence);

  if (
    !title &&
    !summary &&
    !dataPoints &&
    !xAxis &&
    !yAxis &&
    !series &&
    confidence === undefined
  ) {
    return undefined;
  }

  return {
    ...(title ? { title } : {}),
    ...(summary ? { summary } : {}),
    ...(dataPoints ? { data_points: dataPoints } : {}),
    ...(xAxis ? { x_axis: xAxis } : {}),
    ...(yAxis ? { y_axis: yAxis } : {}),
    ...(series ? { series } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
  };
};

const parseRegionAnalysisOutput = (
  stdout: string,
  options: Pick<AnalyzeRegionsOptions, 'max_output_chars'>
): Omit<
  PdfRegionAnalysisData,
  | 'region_id'
  | 'page'
  | 'provider'
  | 'source_crop_evidence_id'
  | 'source_bounding_box'
  | 'crop_pixels'
  | 'scale'
  | 'provenance'
> => {
  const trimmed = stdout.trim();
  const warnings: string[] = [];
  let parsed: RawRegionAnalysisOutput | undefined;

  try {
    const maybeJson = JSON.parse(trimmed) as RawRegionAnalysisOutput;
    if (typeof maybeJson === 'object' && maybeJson !== null) {
      parsed = maybeJson;
    }
  } catch {
    parsed = undefined;
  }

  if (!parsed) {
    const description = normalizeString(trimmed, options.max_output_chars) ?? '';
    if (trimmed.length > options.max_output_chars) {
      warnings.push(
        `Region analysis output truncated to ${String(options.max_output_chars)} characters.`
      );
    }
    return {
      kind: 'unknown',
      description,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  warnings.push(...normalizeWarnings(parsed.warnings));
  const kind = normalizeKind(parsed.kind, warnings);
  const description = normalizeString(parsed.description, options.max_output_chars);
  const text = normalizeString(parsed.text, options.max_output_chars);
  const markdown = normalizeString(parsed.markdown, options.max_output_chars);
  const confidence = normalizeConfidence(parsed.confidence);
  const table = normalizeTable(parsed.table, options.max_output_chars);
  const formula = normalizeFormula(parsed.formula, options.max_output_chars);
  const chart = normalizeChart(parsed.chart, options.max_output_chars);

  return {
    kind,
    ...(description ? { description } : {}),
    ...(text ? { text } : {}),
    ...(markdown ? { markdown } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(table ? { table } : {}),
    ...(formula ? { formula } : {}),
    ...(chart ? { chart } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};

export const analyzeRegionCropWithCommandProvider = async (
  region: PdfRegionCropData,
  context: { source: string; languages?: string[] | undefined },
  options: AnalyzeRegionsOptions
): Promise<PdfRegionAnalysisData> => {
  const config = readRegionAnalysisProviderConfig();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-reader-mcp-region-analysis-'));
  const inputPath = path.join(tempDir, `region-${String(region.page)}.png`);

  try {
    await fs.writeFile(inputPath, Buffer.from(region.data, 'base64'));
    const box = region.source_bounding_box;
    const args = config.argsTemplate.map((arg) =>
      replacePlaceholders(arg, {
        inputPath,
        page: region.page,
        source: context.source,
        regionId: region.region_id,
        evidenceId: region.evidence_id,
        left: box.left,
        bottom: box.bottom,
        right: box.right,
        top: box.top,
        languages: context.languages,
      })
    );
    const { stdout } = await execFileAsync(config.command, args, {
      timeout: options.timeout_ms,
      maxBuffer: Math.max(options.max_output_chars * 4, 1024 * 1024),
      windowsHide: true,
    });
    const normalized = parseRegionAnalysisOutput(stdout, options);

    return {
      region_id: region.region_id,
      page: region.page,
      ...normalized,
      provider: 'command',
      source_crop_evidence_id: region.evidence_id,
      source_bounding_box: region.source_bounding_box,
      crop_pixels: region.crop_pixels,
      scale: region.scale,
      provenance: {
        engine: 'external-command',
        source: 'region-analysis-provider',
      },
    };
  } catch (error: unknown) {
    if (error instanceof PdfError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Region analysis provider command failed', {
      page: region.page,
      regionId: region.region_id,
      error: message,
    });
    throw new PdfError(
      ErrorCode.InvalidRequest,
      `Region analysis provider command failed for page ${String(region.page)} region ${region.region_id}.`
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
};

export const analyzePdfRegionsFromSource = async (
  source: { path?: string | undefined; url?: string | undefined; regions: PdfRegionRequest[] },
  options: AnalyzeRegionsOptions
): Promise<{
  source: string;
  numPages: number;
  analyses: PdfRegionAnalysisData[];
  warnings: string[];
}> => {
  const cropped = await extractRegionCropsFromSource(source, {
    scale: options.scale,
    max_regions: options.max_regions,
    max_pixels_per_page: options.max_pixels_per_page,
    include_image: false,
  });
  const analyses: PdfRegionAnalysisData[] = [];

  for (const region of cropped.regions) {
    analyses.push(
      await analyzeRegionCropWithCommandProvider(
        region,
        { source: cropped.source, languages: options.languages },
        options
      )
    );
  }

  return {
    source: cropped.source,
    numPages: cropped.numPages,
    analyses,
    warnings: cropped.warnings,
  };
};
