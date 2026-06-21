import { promises as fs } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  analyzePdfRegionsFromSource,
  defaultAnalyzeRegionsOptions,
  getRegionAnalysisProviderStatus,
} from '../src/pdf/regionAnalysis.js';
import type { PdfRegionRequest } from '../src/types/pdf/regions.js';
import type { PdfRegionAnalysisData, PdfRegionAnalysisKind } from '../src/types/pdf.js';
import { writeBenchmarkReport } from './benchmark-utils.js';
import {
  DEFAULT_PDF_URL_CACHE_DIR,
  nonEmptyString,
  resolveVerifiedPdfUrl,
  sha256Hex,
  validatePdfUrl,
} from './pdf-url-cache.js';

type ManifestBenchmarkStatus = 'passed' | 'failed' | 'skipped';

interface ProviderManifestAssertion {
  id: string;
  pass: boolean;
  expected: Record<string, unknown>;
  observed: Record<string, unknown>;
}

interface ProviderManifestExpected {
  kind?: PdfRegionAnalysisKind | undefined;
  min_confidence?: number | undefined;
  contains_text?: string[] | undefined;
  min_table_cells?: number | undefined;
  min_formula_formats?: number | undefined;
  min_chart_components?: number | undefined;
  require_crop_provenance?: boolean | undefined;
}

interface ProviderManifestRegion {
  region: PdfRegionRequest;
  expected: ProviderManifestExpected;
  capability_tags: string[];
}

interface ProviderManifestCase {
  id: string;
  path: string;
  source_type: 'path' | 'url';
  source_url?: string | undefined;
  source_label?: string | undefined;
  source_homepage?: string | undefined;
  source_rights?: string | undefined;
  source_retrieved_at?: string | undefined;
  sha256?: string | undefined;
  downloaded?: boolean | undefined;
  document_archetype: string;
  capability_tags: string[];
  regions: ProviderManifestRegion[];
}

interface ProviderManifest {
  cases: ProviderManifestCase[];
}

interface ProviderManifestRegionResult {
  id: string;
  page: number;
  capability_tags: string[];
  expected_kind?: PdfRegionAnalysisKind | undefined;
  observed_kind?: PdfRegionAnalysisKind | undefined;
  status: ManifestBenchmarkStatus;
  assertion_count: number;
  passed_assertion_count: number;
  score: number;
  assertions: ProviderManifestAssertion[];
}

interface ProviderManifestCaseResult {
  id: string;
  fixture_type: 'external';
  document_archetype: string;
  source_type: 'path' | 'url';
  source_url?: string | undefined;
  source_label?: string | undefined;
  source_homepage?: string | undefined;
  source_rights?: string | undefined;
  source_retrieved_at?: string | undefined;
  sha256?: string | undefined;
  downloaded?: boolean | undefined;
  capability_tags: string[];
  duration_ms: number;
  region_count: number;
  assertion_count: number;
  passed_assertion_count: number;
  score: number;
  warnings: string[];
  regions: ProviderManifestRegionResult[];
}

interface ProviderManifestCapabilitySummary {
  tag: string;
  case_count: number;
  region_count: number;
  assertion_count: number;
  passed_assertion_count: number;
  failed_assertion_count: number;
  score: number;
  status: ManifestBenchmarkStatus;
}

export interface ProviderManifestBenchmarkReport {
  profile: 'pdf_provider_manifest_benchmark';
  generated_at: string;
  status: ManifestBenchmarkStatus;
  strict: boolean;
  manifest_path?: string | undefined;
  provider_status?: ReturnType<typeof getRegionAnalysisProviderStatus> | undefined;
  external_case_count: number;
  external_url_case_count: number;
  external_download_count: number;
  external_region_count: number;
  corpus_cache_dir?: string | undefined;
  summary: {
    case_count: number;
    region_count: number;
    assertion_count: number;
    passed_assertion_count: number;
    failed_assertion_count: number;
    score: number;
  };
  capability_summary: ProviderManifestCapabilitySummary[];
  cases: ProviderManifestCaseResult[];
}

export interface BuildProviderManifestBenchmarkReportOptions {
  manifestPath?: string | undefined;
  allowDownloads?: boolean | undefined;
  allowPrivateIps?: boolean | undefined;
  cacheDir?: string | undefined;
  strict?: boolean | undefined;
}

const PROVIDER_MANIFEST_ENV = 'MCP_PDF_PROVIDER_MANIFEST';
const PROVIDER_MANIFEST_ALLOW_DOWNLOADS_ENV = 'MCP_PDF_PROVIDER_MANIFEST_ALLOW_DOWNLOADS';
const PROVIDER_MANIFEST_CACHE_DIR_ENV = 'MCP_PDF_PROVIDER_MANIFEST_CACHE_DIR';
const PROVIDER_MANIFEST_REQUIRED_ENV = 'MCP_PDF_PROVIDER_MANIFEST_REQUIRED';
const ALLOW_PRIVATE_IPS_ENV = 'MCP_PDF_ALLOW_PRIVATE_IPS';

const SUPPORTED_KINDS = new Set<PdfRegionAnalysisKind>([
  'text',
  'table',
  'figure',
  'chart',
  'formula',
  'image',
  'diagram',
  'unknown',
]);

const round = (value: number): number => Math.round(value * 100) / 100;

const ratioScore = (numerator: number, denominator: number): number =>
  denominator > 0 ? round(Math.min(1, Math.max(0, numerator / denominator))) : 0;

const positiveNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

const booleanOption = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const stringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : undefined))
    .filter((entry): entry is string => Boolean(entry));
  return normalized.length > 0 ? normalized : undefined;
};

const capabilityTags = (value: unknown): string[] => {
  const normalized =
    stringArray(value)
      ?.map((entry) =>
        entry
          .toLowerCase()
          .replace(/[^a-z0-9._:-]+/gu, '-')
          .replace(/^-+|-+$/gu, '')
      )
      .filter((entry) => entry.length > 0) ?? [];
  return [...new Set(normalized)];
};

const mergeCapabilityTags = (...groups: string[][]): string[] => [
  ...new Set(groups.flatMap((group) => group)),
];

const parseKind = (value: unknown): PdfRegionAnalysisKind | undefined => {
  const kind = nonEmptyString(value);
  return kind && SUPPORTED_KINDS.has(kind as PdfRegionAnalysisKind)
    ? (kind as PdfRegionAnalysisKind)
    : undefined;
};

const parseBoundingBox = (value: unknown, id: string): PdfRegionRequest['bounding_box'] => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Provider manifest region ${id} must include a bounding_box object.`);
  }
  const record = value as Record<string, unknown>;
  const left = positiveNumber(record.left);
  const bottom = positiveNumber(record.bottom);
  const right = positiveNumber(record.right);
  const top = positiveNumber(record.top);
  if (left === undefined || bottom === undefined || right === undefined || top === undefined) {
    throw new Error(`Provider manifest region ${id} has an invalid bounding_box.`);
  }
  if (right <= left || top <= bottom) {
    throw new Error(`Provider manifest region ${id} bounding_box must have positive area.`);
  }
  return { left, bottom, right, top };
};

const parseExpected = (value: unknown, fallbackKind: PdfRegionAnalysisKind | undefined) => {
  const record =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    kind: parseKind(record.kind) ?? fallbackKind,
    min_confidence: positiveNumber(record.min_confidence),
    contains_text: stringArray(record.contains_text),
    min_table_cells: positiveNumber(record.min_table_cells),
    min_formula_formats: positiveNumber(record.min_formula_formats),
    min_chart_components: positiveNumber(record.min_chart_components),
    require_crop_provenance: booleanOption(record.require_crop_provenance),
  } satisfies ProviderManifestExpected;
};

const parseRegions = (value: unknown, caseId: string): ProviderManifestRegion[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Provider manifest case ${caseId} must include at least one region.`);
  }

  return value.map((entry, index): ProviderManifestRegion => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(
        `Provider manifest case ${caseId} region ${String(index + 1)} must be an object.`
      );
    }
    const record = entry as Record<string, unknown>;
    const id = nonEmptyString(record.id) ?? `${caseId}-region-${String(index + 1)}`;
    const page = positiveNumber(record.page);
    if (page === undefined || !Number.isInteger(page) || page <= 0) {
      throw new Error(`Provider manifest region ${id} must include a positive integer page.`);
    }
    const fallbackKind = parseKind(record.kind);
    return {
      region: {
        id,
        page,
        bounding_box: parseBoundingBox(record.bounding_box, id),
        ...(positiveNumber(record.padding) !== undefined
          ? { padding: positiveNumber(record.padding) }
          : {}),
      },
      expected: parseExpected(record.expected, fallbackKind),
      capability_tags: capabilityTags(record.capability_tags),
    };
  });
};

const readProviderManifest = async (
  manifestPath: string,
  options: Required<Pick<BuildProviderManifestBenchmarkReportOptions, 'allowDownloads' | 'allowPrivateIps' | 'cacheDir'>>
): Promise<ProviderManifest> => {
  const absoluteManifestPath = path.resolve(manifestPath);
  const raw = await fs.readFile(absoluteManifestPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Provider accuracy manifest must be a JSON object.');
  }

  const cases = (parsed as { cases?: unknown }).cases;
  if (!Array.isArray(cases)) {
    throw new Error('Provider accuracy manifest must include a cases array.');
  }

  const manifestDirectory = path.dirname(absoluteManifestPath);
  const cacheDir = path.resolve(options.cacheDir);
  return {
    cases: await Promise.all(
      cases.map(async (entry, index): Promise<ProviderManifestCase> => {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
          throw new Error(`Provider manifest case ${String(index + 1)} must be an object.`);
        }

        const record = entry as Record<string, unknown>;
        const id = nonEmptyString(record.id) ?? `provider-external-${String(index + 1)}`;
        const pathValue = nonEmptyString(record.path);
        const urlValue = nonEmptyString(record.url);
        if ((pathValue ? 1 : 0) + (urlValue ? 1 : 0) !== 1) {
          throw new Error(`Provider manifest case ${id} must include exactly one of path or url.`);
        }

        const source =
          pathValue !== undefined
            ? {
                path: path.isAbsolute(pathValue)
                  ? pathValue
                  : path.resolve(manifestDirectory, pathValue),
                source_type: 'path' as const,
              }
            : await (async () => {
                const url = validatePdfUrl(
                  urlValue as string,
                  id,
                  'Provider manifest case'
                ).toString();
                const sha256 = sha256Hex(record.sha256);
                if (!sha256) {
                  throw new Error(
                    `Provider manifest case ${id} with url must include a 64-character sha256.`
                  );
                }
                const resolved = await resolveVerifiedPdfUrl({
                  id,
                  url,
                  sha256,
                  allowDownloads: options.allowDownloads,
                  allowPrivateIps: options.allowPrivateIps,
                  cacheDir,
                  caseLabel: 'Provider manifest case',
                  downloadHint: `Pass --allow-provider-manifest-downloads or set ${PROVIDER_MANIFEST_ALLOW_DOWNLOADS_ENV}=true.`,
                });
                return {
                  path: resolved.path,
                  source_type: 'url' as const,
                  source_url: url,
                  sha256,
                  downloaded: resolved.downloaded,
                };
              })();

        return {
          id,
          ...source,
          source_label: nonEmptyString(record.source_label),
          source_homepage: nonEmptyString(record.source_homepage),
          source_rights: nonEmptyString(record.source_rights),
          source_retrieved_at: nonEmptyString(record.source_retrieved_at),
          document_archetype: nonEmptyString(record.document_archetype) ?? 'external PDF',
          capability_tags: capabilityTags(record.capability_tags),
          regions: parseRegions(record.regions, id),
        };
      })
    ),
  };
};

const collectText = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((entry) => collectText(entry));
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap((entry) => collectText(entry));
  }
  return [];
};

const countFormulaFormats = (analysis: PdfRegionAnalysisData): number =>
  [
    analysis.formula?.latex,
    analysis.formula?.mathml,
    analysis.formula?.asciimath,
    analysis.formula?.text,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0).length;

const countChartComponents = (analysis: PdfRegionAnalysisData): number =>
  [
    analysis.chart?.x_axis !== undefined,
    analysis.chart?.y_axis !== undefined,
    (analysis.chart?.series?.length ?? 0) > 0 ||
      (analysis.chart?.data_points?.length ?? 0) > 0,
  ].filter(Boolean).length;

const evaluateRegion = (
  manifestRegion: ProviderManifestRegion,
  analysis: PdfRegionAnalysisData | undefined,
  inheritedCapabilityTags: string[] = []
): ProviderManifestRegionResult => {
  const regionId = manifestRegion.region.id ?? `page-${String(manifestRegion.region.page)}-region`;
  const expected = manifestRegion.expected;
  const tags = mergeCapabilityTags(inheritedCapabilityTags, manifestRegion.capability_tags);
  const searchableText = collectText(analysis).join(' ').toLowerCase();
  const assertions: ProviderManifestAssertion[] = [
    {
      id: `${regionId}:analysis-present`,
      pass: analysis !== undefined,
      expected: { analysis: 'present' },
      observed: { analysis: analysis ? 'present' : 'missing' },
    },
  ];

  if (expected.kind !== undefined) {
    assertions.push({
      id: `${regionId}:kind`,
      pass: analysis?.kind === expected.kind,
      expected: { kind: expected.kind },
      observed: { kind: analysis?.kind },
    });
  }
  if (expected.min_confidence !== undefined) {
    assertions.push({
      id: `${regionId}:confidence`,
      pass: (analysis?.confidence ?? 0) >= expected.min_confidence,
      expected: { min_confidence: expected.min_confidence },
      observed: { confidence: analysis?.confidence },
    });
  }
  for (const textNeedle of expected.contains_text ?? []) {
    assertions.push({
      id: `${regionId}:contains:${textNeedle.slice(0, 32)}`,
      pass: searchableText.includes(textNeedle.toLowerCase()),
      expected: { contains_text: textNeedle },
      observed: { matched: searchableText.includes(textNeedle.toLowerCase()) },
    });
  }
  if (expected.min_table_cells !== undefined) {
    const cellCount = analysis?.table?.cells?.length ?? 0;
    assertions.push({
      id: `${regionId}:table-cells`,
      pass: cellCount >= expected.min_table_cells,
      expected: { min_table_cells: expected.min_table_cells },
      observed: { table_cells: cellCount },
    });
  }
  if (expected.min_formula_formats !== undefined) {
    const formulaFormats = analysis ? countFormulaFormats(analysis) : 0;
    assertions.push({
      id: `${regionId}:formula-formats`,
      pass: formulaFormats >= expected.min_formula_formats,
      expected: { min_formula_formats: expected.min_formula_formats },
      observed: { formula_formats: formulaFormats },
    });
  }
  if (expected.min_chart_components !== undefined) {
    const chartComponents = analysis ? countChartComponents(analysis) : 0;
    assertions.push({
      id: `${regionId}:chart-components`,
      pass: chartComponents >= expected.min_chart_components,
      expected: { min_chart_components: expected.min_chart_components },
      observed: { chart_components: chartComponents },
    });
  }
  if (expected.require_crop_provenance !== false) {
    assertions.push({
      id: `${regionId}:crop-provenance`,
      pass:
        analysis?.source_crop_evidence_id ===
          `page-${String(manifestRegion.region.page)}-${regionId}-crop-scale-${String(
            analysis?.scale
          )}` && analysis?.provenance.source === 'region-analysis-provider',
      expected: { crop_provenance: true },
      observed: {
        source_crop_evidence_id: analysis?.source_crop_evidence_id,
        provenance_source: analysis?.provenance.source,
      },
    });
  }

  const passed = assertions.filter((assertion) => assertion.pass).length;
  const status = assertions.every((assertion) => assertion.pass) ? 'passed' : 'failed';
  return {
    id: regionId,
    page: manifestRegion.region.page,
    capability_tags: tags,
    expected_kind: expected.kind,
    observed_kind: analysis?.kind,
    status,
    assertion_count: assertions.length,
    passed_assertion_count: passed,
    score: ratioScore(passed, assertions.length),
    assertions,
  };
};

const evaluateCase = async (entry: ProviderManifestCase): Promise<ProviderManifestCaseResult> => {
  const start = performance.now();
  try {
    const analyzed = await analyzePdfRegionsFromSource(
      {
        path: entry.path,
        regions: entry.regions.map((region) => region.region),
      },
      {
        ...defaultAnalyzeRegionsOptions(),
        max_regions: entry.regions.length,
      }
    );
    const analysesByRegionId = new Map(
      analyzed.analyses.map((analysis) => [analysis.region_id, analysis])
    );
    const regions = entry.regions.map((region) =>
      evaluateRegion(region, analysesByRegionId.get(region.region.id ?? ''), entry.capability_tags)
    );
    const assertionCount = regions.reduce((sum, region) => sum + region.assertion_count, 0);
    const passedAssertionCount = regions.reduce(
      (sum, region) => sum + region.passed_assertion_count,
      0
    );

    return {
      id: entry.id,
      fixture_type: 'external',
      document_archetype: entry.document_archetype,
      source_type: entry.source_type,
      ...(entry.source_url ? { source_url: entry.source_url } : {}),
      ...(entry.source_label ? { source_label: entry.source_label } : {}),
      ...(entry.source_homepage ? { source_homepage: entry.source_homepage } : {}),
      ...(entry.source_rights ? { source_rights: entry.source_rights } : {}),
      ...(entry.source_retrieved_at ? { source_retrieved_at: entry.source_retrieved_at } : {}),
      ...(entry.sha256 ? { sha256: entry.sha256 } : {}),
      ...(entry.downloaded !== undefined ? { downloaded: entry.downloaded } : {}),
      capability_tags: mergeCapabilityTags(
        entry.capability_tags,
        ...regions.map((region) => region.capability_tags)
      ),
      duration_ms: round(performance.now() - start),
      region_count: regions.length,
      assertion_count: assertionCount,
      passed_assertion_count: passedAssertionCount,
      score: ratioScore(passedAssertionCount, assertionCount),
      warnings: analyzed.warnings,
      regions,
    };
  } catch (error) {
    const assertion: ProviderManifestAssertion = {
      id: `${entry.id}:runtime`,
      pass: false,
      expected: { no_uncaught_error: true },
      observed: { error: error instanceof Error ? error.message : String(error) },
    };
    return {
      id: entry.id,
      fixture_type: 'external',
      document_archetype: entry.document_archetype,
      source_type: entry.source_type,
      ...(entry.source_url ? { source_url: entry.source_url } : {}),
      capability_tags: entry.capability_tags,
      duration_ms: round(performance.now() - start),
      region_count: entry.regions.length,
      assertion_count: 1,
      passed_assertion_count: 0,
      score: 0,
      warnings: [],
      regions: [
        {
          id: entry.id,
          page: 0,
          capability_tags: entry.capability_tags,
          status: 'failed',
          assertion_count: 1,
          passed_assertion_count: 0,
          score: 0,
          assertions: [assertion],
        },
      ],
    };
  }
};

const summarizeCapabilities = (
  cases: ProviderManifestCaseResult[]
): ProviderManifestCapabilitySummary[] => {
  const tagMap = new Map<
    string,
    {
      caseIds: Set<string>;
      region_count: number;
      assertion_count: number;
      passed_assertion_count: number;
    }
  >();

  for (const entry of cases) {
    for (const region of entry.regions) {
      for (const tag of region.capability_tags) {
        const summary =
          tagMap.get(tag) ??
          {
            caseIds: new Set<string>(),
            region_count: 0,
            assertion_count: 0,
            passed_assertion_count: 0,
          };
        summary.caseIds.add(entry.id);
        summary.region_count += 1;
        summary.assertion_count += region.assertion_count;
        summary.passed_assertion_count += region.passed_assertion_count;
        tagMap.set(tag, summary);
      }
    }
  }

  return [...tagMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tag, summary]) => {
      const failedAssertionCount = summary.assertion_count - summary.passed_assertion_count;
      return {
        tag,
        case_count: summary.caseIds.size,
        region_count: summary.region_count,
        assertion_count: summary.assertion_count,
        passed_assertion_count: summary.passed_assertion_count,
        failed_assertion_count: failedAssertionCount,
        score: ratioScore(summary.passed_assertion_count, summary.assertion_count),
        status: failedAssertionCount === 0 ? 'passed' : 'failed',
      };
    });
};

const summarize = (
  cases: ProviderManifestCaseResult[]
): ProviderManifestBenchmarkReport['summary'] => {
  const assertionCount = cases.reduce((sum, entry) => sum + entry.assertion_count, 0);
  const passedAssertionCount = cases.reduce(
    (sum, entry) => sum + entry.passed_assertion_count,
    0
  );
  return {
    case_count: cases.length,
    region_count: cases.reduce((sum, entry) => sum + entry.region_count, 0),
    assertion_count: assertionCount,
    passed_assertion_count: passedAssertionCount,
    failed_assertion_count: assertionCount - passedAssertionCount,
    score: ratioScore(passedAssertionCount, assertionCount),
  };
};

export const buildProviderManifestBenchmarkReport = async (
  options: BuildProviderManifestBenchmarkReportOptions = {}
): Promise<ProviderManifestBenchmarkReport> => {
  const strict = options.strict === true;
  const cacheDir = path.resolve(options.cacheDir ?? DEFAULT_PDF_URL_CACHE_DIR);
  const providerStatus = getRegionAnalysisProviderStatus();

  if (!options.manifestPath) {
    return {
      profile: 'pdf_provider_manifest_benchmark',
      generated_at: new Date().toISOString(),
      status: strict ? 'failed' : 'skipped',
      strict,
      provider_status: providerStatus,
      external_case_count: 0,
      external_url_case_count: 0,
      external_download_count: 0,
      external_region_count: 0,
      summary: {
        case_count: 0,
        region_count: 0,
        assertion_count: 0,
        passed_assertion_count: 0,
        failed_assertion_count: 0,
        score: 0,
      },
      capability_summary: [],
      cases: [],
    };
  }

  if (providerStatus.readiness !== 'ready') {
    return {
      profile: 'pdf_provider_manifest_benchmark',
      generated_at: new Date().toISOString(),
      status: strict || providerStatus.readiness === 'invalid_configuration' ? 'failed' : 'skipped',
      strict,
      manifest_path: path.resolve(options.manifestPath),
      provider_status: providerStatus,
      external_case_count: 0,
      external_url_case_count: 0,
      external_download_count: 0,
      external_region_count: 0,
      corpus_cache_dir: cacheDir,
      summary: {
        case_count: 0,
        region_count: 0,
        assertion_count: 0,
        passed_assertion_count: 0,
        failed_assertion_count: 0,
        score: 0,
      },
      capability_summary: [],
      cases: [],
    };
  }

  const manifest = await readProviderManifest(path.resolve(options.manifestPath), {
    allowDownloads: options.allowDownloads === true,
    allowPrivateIps: options.allowPrivateIps === true,
    cacheDir,
  });
  const cases = await Promise.all(manifest.cases.map((entry) => evaluateCase(entry)));
  const summary = summarize(cases);
  const capabilitySummary = summarizeCapabilities(cases);

  return {
    profile: 'pdf_provider_manifest_benchmark',
    generated_at: new Date().toISOString(),
    status: summary.failed_assertion_count === 0 ? 'passed' : 'failed',
    strict,
    manifest_path: path.resolve(options.manifestPath),
    provider_status: providerStatus,
    external_case_count: manifest.cases.length,
    external_url_case_count: manifest.cases.filter((entry) => entry.source_type === 'url').length,
    external_download_count: manifest.cases.filter((entry) => entry.downloaded).length,
    external_region_count: manifest.cases.reduce((sum, entry) => sum + entry.regions.length, 0),
    corpus_cache_dir: cacheDir,
    summary,
    capability_summary: capabilitySummary,
    cases,
  };
};

const flagValue = (argv: string[], flagName: string): string | undefined => {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === flagName) {
      const next = argv[index + 1];
      return next && !next.startsWith('--') ? next : undefined;
    }
    const prefix = `${flagName}=`;
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
  }
  return undefined;
};

const hasFlag = (argv: string[], flagName: string): boolean => argv.includes(flagName);

const truthyEnv = (value: string | undefined): boolean =>
  value !== undefined && /^(1|true|yes)$/iu.test(value.trim());

export const resolveProviderManifestBenchmarkOptions = (
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env
): BuildProviderManifestBenchmarkReportOptions => ({
  manifestPath: flagValue(argv, '--provider-manifest') ?? env[PROVIDER_MANIFEST_ENV],
  allowDownloads:
    hasFlag(argv, '--allow-provider-manifest-downloads') ||
    truthyEnv(env[PROVIDER_MANIFEST_ALLOW_DOWNLOADS_ENV]),
  allowPrivateIps: hasFlag(argv, '--allow-private-ips') || truthyEnv(env[ALLOW_PRIVATE_IPS_ENV]),
  cacheDir: flagValue(argv, '--provider-manifest-cache-dir') ?? env[PROVIDER_MANIFEST_CACHE_DIR_ENV],
  strict: hasFlag(argv, '--strict') || truthyEnv(env[PROVIDER_MANIFEST_REQUIRED_ENV]),
});

export const main = async () => {
  const report = await buildProviderManifestBenchmarkReport(
    resolveProviderManifestBenchmarkOptions()
  );
  console.table(
    report.cases.flatMap((entry) =>
      entry.regions.map((region) => ({
        case: entry.id,
        region: region.id,
        expected: region.expected_kind ?? '-',
        observed: region.observed_kind ?? '-',
        passed: `${String(region.passed_assertion_count)}/${String(region.assertion_count)}`,
        score: region.score,
      }))
    )
  );
  console.log(JSON.stringify(report, null, 2));
  const outputPath = await writeBenchmarkReport(report);
  if (outputPath) {
    console.error(`Benchmark report written to ${outputPath}`);
  }
  if (report.status === 'failed') {
    process.exitCode = 1;
  }
};

if (import.meta.main) {
  await main();
}
