import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  defaultExtractRegionsOptions,
  extractRegionCropsFromSource,
} from '../src/pdf/regions.js';
import type { PdfRegionCropData } from '../src/types/pdf.js';
import { writeBenchmarkReport } from './benchmark-utils.js';
import {
  type BuildProviderManifestBenchmarkReportOptions,
  type ProviderManifestCase,
  type ProviderManifestRegion,
  mergeProviderManifestCapabilityTags,
  readProviderManifest,
} from './benchmark-pdf-provider-manifest.js';
import { DEFAULT_PDF_URL_CACHE_DIR } from './pdf-url-cache.js';

type CropManifestStatus = 'passed' | 'failed' | 'skipped';

interface CropManifestAssertion {
  id: string;
  pass: boolean;
  expected: Record<string, unknown>;
  observed: Record<string, unknown>;
}

interface CropManifestRegionResult {
  id: string;
  page: number;
  capability_tags: string[];
  status: CropManifestStatus;
  assertion_count: number;
  passed_assertion_count: number;
  score: number;
  crop?: {
    evidence_id: string;
    byte_length: number;
    scale: number;
    crop_pixels: {
      left: number;
      top: number;
      width: number;
      height: number;
    };
    source_bounding_box: PdfRegionCropData['source_bounding_box'];
    page_render_evidence_id?: string | undefined;
  } | undefined;
  assertions: CropManifestAssertion[];
}

interface CropManifestCaseResult {
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
  num_pages?: number | undefined;
  region_count: number;
  assertion_count: number;
  passed_assertion_count: number;
  score: number;
  warnings: string[];
  regions: CropManifestRegionResult[];
}

interface CropManifestCapabilitySummary {
  tag: string;
  case_count: number;
  region_count: number;
  assertion_count: number;
  passed_assertion_count: number;
  failed_assertion_count: number;
  score: number;
  status: CropManifestStatus;
}

export interface ProviderManifestCropBenchmarkReport {
  profile: 'pdf_provider_manifest_crop_benchmark';
  generated_at: string;
  status: CropManifestStatus;
  strict: boolean;
  manifest_path?: string | undefined;
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
  capability_summary: CropManifestCapabilitySummary[];
  cases: CropManifestCaseResult[];
}

export interface BuildProviderManifestCropBenchmarkReportOptions
  extends Pick<
    BuildProviderManifestBenchmarkReportOptions,
    'manifestPath' | 'allowDownloads' | 'allowPrivateIps' | 'cacheDir' | 'strict'
  > {}

const PROVIDER_MANIFEST_ENV = 'MCP_PDF_PROVIDER_MANIFEST';
const PROVIDER_MANIFEST_ALLOW_DOWNLOADS_ENV = 'MCP_PDF_PROVIDER_MANIFEST_ALLOW_DOWNLOADS';
const PROVIDER_MANIFEST_CACHE_DIR_ENV = 'MCP_PDF_PROVIDER_MANIFEST_CACHE_DIR';
const PROVIDER_MANIFEST_CROP_REQUIRED_ENV = 'MCP_PDF_PROVIDER_MANIFEST_CROP_REQUIRED';
const ALLOW_PRIVATE_IPS_ENV = 'MCP_PDF_ALLOW_PRIVATE_IPS';

const round = (value: number): number => Math.round(value * 100) / 100;

const ratioScore = (numerator: number, denominator: number): number =>
  denominator > 0 ? round(Math.min(1, Math.max(0, numerator / denominator))) : 0;

const regionIdForManifestRegion = (region: ProviderManifestRegion, index: number): string =>
  region.region.id ?? `region-${String(index + 1)}`;

const cropMetadata = (crop: PdfRegionCropData): NonNullable<CropManifestRegionResult['crop']> => ({
  evidence_id: crop.evidence_id,
  byte_length: crop.byte_length,
  scale: crop.scale,
  crop_pixels: crop.crop_pixels,
  source_bounding_box: crop.source_bounding_box,
  page_render_evidence_id: crop.provenance.page_render_evidence_id,
});

const evaluateRegionCrop = (
  manifestRegion: ProviderManifestRegion,
  regionIndex: number,
  crop: PdfRegionCropData | undefined,
  inheritedCapabilityTags: string[] = []
): CropManifestRegionResult => {
  const regionId = regionIdForManifestRegion(manifestRegion, regionIndex);
  const tags = mergeProviderManifestCapabilityTags(
    inheritedCapabilityTags,
    manifestRegion.capability_tags
  );
  const assertions: CropManifestAssertion[] = [
    {
      id: `${regionId}:crop-present`,
      pass: crop !== undefined,
      expected: { crop: 'present' },
      observed: { crop: crop ? 'present' : 'missing' },
    },
  ];

  if (crop) {
    assertions.push(
      {
        id: `${regionId}:crop-page`,
        pass: crop.page === manifestRegion.region.page,
        expected: { page: manifestRegion.region.page },
        observed: { page: crop.page },
      },
      {
        id: `${regionId}:crop-bytes`,
        pass: crop.byte_length > 0,
        expected: { min_byte_length: 1 },
        observed: { byte_length: crop.byte_length },
      },
      {
        id: `${regionId}:crop-pixels`,
        pass: crop.crop_pixels.width > 0 && crop.crop_pixels.height > 0,
        expected: { positive_width: true, positive_height: true },
        observed: {
          width: crop.crop_pixels.width,
          height: crop.crop_pixels.height,
        },
      },
      {
        id: `${regionId}:crop-provenance`,
        pass:
          crop.evidence_id ===
            `page-${String(manifestRegion.region.page)}-${regionId}-crop-scale-${String(
              crop.scale
            )}` && crop.provenance.source === 'region-crop',
        expected: { crop_provenance: true },
        observed: {
          evidence_id: crop.evidence_id,
          provenance_source: crop.provenance.source,
        },
      }
    );
  }

  const passed = assertions.filter((assertion) => assertion.pass).length;
  return {
    id: regionId,
    page: manifestRegion.region.page,
    capability_tags: tags,
    status: assertions.every((assertion) => assertion.pass) ? 'passed' : 'failed',
    assertion_count: assertions.length,
    passed_assertion_count: passed,
    score: ratioScore(passed, assertions.length),
    ...(crop ? { crop: cropMetadata(crop) } : {}),
    assertions,
  };
};

const evaluateCaseCrops = async (
  entry: ProviderManifestCase
): Promise<CropManifestCaseResult> => {
  const start = performance.now();

  try {
    const crops = await extractRegionCropsFromSource(
      {
        path: entry.path,
        regions: entry.regions.map((region) => region.region),
      },
      {
        ...defaultExtractRegionsOptions(),
        max_regions: entry.regions.length,
      }
    );
    const cropsByRegionId = new Map(crops.regions.map((crop) => [crop.region_id, crop]));
    const regions = entry.regions.map((region, index) =>
      evaluateRegionCrop(
        region,
        index,
        cropsByRegionId.get(regionIdForManifestRegion(region, index)),
        entry.capability_tags
      )
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
      capability_tags: mergeProviderManifestCapabilityTags(
        entry.capability_tags,
        ...regions.map((region) => region.capability_tags)
      ),
      duration_ms: round(performance.now() - start),
      num_pages: crops.numPages,
      region_count: regions.length,
      assertion_count: assertionCount,
      passed_assertion_count: passedAssertionCount,
      score: ratioScore(passedAssertionCount, assertionCount),
      warnings: crops.warnings,
      regions,
    };
  } catch (error) {
    const assertion: CropManifestAssertion = {
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
      ...(entry.source_label ? { source_label: entry.source_label } : {}),
      ...(entry.source_homepage ? { source_homepage: entry.source_homepage } : {}),
      ...(entry.source_rights ? { source_rights: entry.source_rights } : {}),
      ...(entry.source_retrieved_at ? { source_retrieved_at: entry.source_retrieved_at } : {}),
      ...(entry.sha256 ? { sha256: entry.sha256 } : {}),
      ...(entry.downloaded !== undefined ? { downloaded: entry.downloaded } : {}),
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
  cases: CropManifestCaseResult[]
): CropManifestCapabilitySummary[] => {
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
  cases: CropManifestCaseResult[]
): ProviderManifestCropBenchmarkReport['summary'] => {
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

export const buildProviderManifestCropBenchmarkReport = async (
  options: BuildProviderManifestCropBenchmarkReportOptions = {}
): Promise<ProviderManifestCropBenchmarkReport> => {
  const strict = options.strict === true;
  const cacheDir = path.resolve(options.cacheDir ?? DEFAULT_PDF_URL_CACHE_DIR);

  if (!options.manifestPath) {
    return {
      profile: 'pdf_provider_manifest_crop_benchmark',
      generated_at: new Date().toISOString(),
      status: strict ? 'failed' : 'skipped',
      strict,
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

  const manifest = await readProviderManifest(path.resolve(options.manifestPath), {
    allowDownloads: options.allowDownloads === true,
    allowPrivateIps: options.allowPrivateIps === true,
    cacheDir,
  });
  if (manifest.cases.length === 0) {
    return {
      profile: 'pdf_provider_manifest_crop_benchmark',
      generated_at: new Date().toISOString(),
      status: 'failed',
      strict,
      manifest_path: path.resolve(options.manifestPath),
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
  const cases = await Promise.all(manifest.cases.map((entry) => evaluateCaseCrops(entry)));
  const summary = summarize(cases);

  return {
    profile: 'pdf_provider_manifest_crop_benchmark',
    generated_at: new Date().toISOString(),
    status: summary.failed_assertion_count === 0 ? 'passed' : 'failed',
    strict,
    manifest_path: path.resolve(options.manifestPath),
    external_case_count: manifest.cases.length,
    external_url_case_count: manifest.cases.filter((entry) => entry.source_type === 'url').length,
    external_download_count: manifest.cases.filter((entry) => entry.downloaded).length,
    external_region_count: manifest.cases.reduce((sum, entry) => sum + entry.regions.length, 0),
    corpus_cache_dir: cacheDir,
    summary,
    capability_summary: summarizeCapabilities(cases),
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

export const resolveProviderManifestCropBenchmarkOptions = (
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env
): BuildProviderManifestCropBenchmarkReportOptions => ({
  manifestPath: flagValue(argv, '--provider-manifest') ?? env[PROVIDER_MANIFEST_ENV],
  allowDownloads:
    hasFlag(argv, '--allow-provider-manifest-downloads') ||
    truthyEnv(env[PROVIDER_MANIFEST_ALLOW_DOWNLOADS_ENV]),
  allowPrivateIps: hasFlag(argv, '--allow-private-ips') || truthyEnv(env[ALLOW_PRIVATE_IPS_ENV]),
  cacheDir: flagValue(argv, '--provider-manifest-cache-dir') ?? env[PROVIDER_MANIFEST_CACHE_DIR_ENV],
  strict: hasFlag(argv, '--strict') || truthyEnv(env[PROVIDER_MANIFEST_CROP_REQUIRED_ENV]),
});

export const main = async () => {
  const report = await buildProviderManifestCropBenchmarkReport(
    resolveProviderManifestCropBenchmarkOptions()
  );
  console.table(
    report.cases.flatMap((entry) =>
      entry.regions.map((region) => ({
        case: entry.id,
        region: region.id,
        page: region.page,
        crop: region.crop ? 'present' : 'missing',
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
