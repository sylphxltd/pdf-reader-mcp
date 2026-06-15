import fs from 'node:fs';
import path from 'node:path';
import { writeBenchmarkReport } from './benchmark-utils.js';

const ARTIFACT_DIR_ENV = 'MCP_PDF_BENCHMARK_OUTPUT_DIR';
const DEFAULT_ARTIFACT_DIR = 'benchmark-artifacts';
const ARTIFACT_DIR_FLAGS = new Set(['--artifacts-dir', '--artifact-dir']);
const REQUIRED_CORPUS_CASE_IDS = [
  'checked-in-sample-agent-document-twin',
  'runtime-report-reading-order',
  'runtime-scanned-ocr-routing',
  'runtime-ocr-table-agent-evidence',
] as const;

const REQUIRED_ARTIFACTS = {
  performance: {
    fileName: 'pdf_performance_benchmark.json',
    profile: 'pdf_performance_benchmark',
  },
  quality: {
    fileName: 'pdf_quality_benchmark.json',
    profile: 'pdf_quality_benchmark',
  },
  corpus: {
    fileName: 'pdf_corpus_benchmark.json',
    profile: 'pdf_corpus_benchmark',
  },
  provider: {
    fileName: 'pdf_provider_benchmark.json',
    profile: 'pdf_provider_benchmark',
  },
} as const;

type GateStatus = 'passed' | 'failed';

interface GateCheck {
  id: string;
  status: GateStatus;
  message: string;
  evidence?: Record<string, unknown> | undefined;
}

export interface SotaReleaseGateReport {
  profile: 'pdf_sota_release_gate';
  generated_at: string;
  artifact_dir: string;
  status: GateStatus;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  checks: GateCheck[];
}

type JsonRecord = Record<string, unknown>;

const readFlagValue = (argv: string[], flagNames: Set<string>): string | undefined => {
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (flagNames.has(arg)) {
      const value = argv[index + 1];
      return value && !value.startsWith('-') ? value : undefined;
    }

    for (const flagName of flagNames) {
      const prefix = `${flagName}=`;
      if (arg.startsWith(prefix)) {
        return arg.slice(prefix.length);
      }
    }
  }

  return undefined;
};

export const resolveSotaReleaseArtifactDir = (
  argv = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env
): string => path.resolve(readFlagValue(argv, ARTIFACT_DIR_FLAGS) ?? env[ARTIFACT_DIR_ENV] ?? DEFAULT_ARTIFACT_DIR);

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJsonArtifact = async (
  artifactDir: string,
  fileName: string
): Promise<JsonRecord | undefined> => {
  const artifactPath = path.join(artifactDir, fileName);
  try {
    const raw = await fs.promises.readFile(artifactPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const getArray = (record: JsonRecord | undefined, key: string): JsonRecord[] =>
  Array.isArray(record?.[key]) ? record[key].filter(isRecord) : [];

const getNumber = (record: JsonRecord | undefined, key: string): number | undefined =>
  typeof record?.[key] === 'number' ? record[key] : undefined;

const getString = (record: JsonRecord | undefined, key: string): string | undefined =>
  typeof record?.[key] === 'string' ? record[key] : undefined;

const addCheck = (
  checks: GateCheck[],
  id: string,
  pass: boolean,
  message: string,
  evidence?: Record<string, unknown>
) => {
  checks.push({
    id,
    status: pass ? 'passed' : 'failed',
    message,
    evidence,
  });
};

const summarizeChecks = (checks: GateCheck[]): SotaReleaseGateReport['summary'] => ({
  total: checks.length,
  passed: checks.filter((check) => check.status === 'passed').length,
  failed: checks.filter((check) => check.status === 'failed').length,
});

export const buildSotaReleaseGateReport = async (
  artifactDir: string
): Promise<SotaReleaseGateReport> => {
  const absoluteArtifactDir = path.resolve(artifactDir);
  const checks: GateCheck[] = [];
  const artifacts = {
    performance: await readJsonArtifact(absoluteArtifactDir, REQUIRED_ARTIFACTS.performance.fileName),
    quality: await readJsonArtifact(absoluteArtifactDir, REQUIRED_ARTIFACTS.quality.fileName),
    corpus: await readJsonArtifact(absoluteArtifactDir, REQUIRED_ARTIFACTS.corpus.fileName),
    provider: await readJsonArtifact(absoluteArtifactDir, REQUIRED_ARTIFACTS.provider.fileName),
  };

  for (const [kind, requirement] of Object.entries(REQUIRED_ARTIFACTS)) {
    const artifact = artifacts[kind as keyof typeof artifacts];
    addCheck(checks, `artifact:${kind}`, artifact !== undefined, `${requirement.fileName} exists and is valid JSON`, {
      file: requirement.fileName,
      profile: artifact?.profile,
    });
    addCheck(
      checks,
      `profile:${kind}`,
      artifact?.profile === requirement.profile,
      `${requirement.fileName} has profile ${requirement.profile}`,
      { expected: requirement.profile, actual: artifact?.profile }
    );
  }

  const performanceResults = getArray(artifacts.performance, 'results');
  const documentTwinPerformance = performanceResults.find(
    (result) => result.name === 'v3_agent_document_twin'
  );
  addCheck(
    checks,
    'performance:document-twin-present',
    documentTwinPerformance !== undefined,
    'performance artifact includes the v3 Agent Document Twin scenario'
  );
  addCheck(
    checks,
    'performance:document-twin-timed',
    (getNumber(documentTwinPerformance, 'average_ms') ?? 0) > 0,
    'v3 Agent Document Twin scenario has a positive average latency',
    { average_ms: documentTwinPerformance?.average_ms }
  );

  const qualityPassed = getNumber(artifacts.quality, 'passed');
  const qualityTotal = getNumber(artifacts.quality, 'total');
  addCheck(
    checks,
    'quality:score',
    artifacts.quality?.score === 1 && qualityPassed === qualityTotal && (qualityTotal ?? 0) > 0,
    'deterministic quality benchmark is fully passing',
    { passed: qualityPassed, total: qualityTotal, score: artifacts.quality?.score }
  );

  const finalBarCoverage = getArray(artifacts.quality, 'final_bar_coverage');
  const incompleteCoverage = finalBarCoverage.filter((entry) => entry.status === 'incomplete');
  addCheck(
    checks,
    'quality:final-bar-complete',
    finalBarCoverage.length > 0 && incompleteCoverage.length === 0,
    'quality final-bar coverage has no incomplete capability areas',
    { incomplete_ids: incompleteCoverage.map((entry) => entry.id) }
  );

  const publicContract = finalBarCoverage.find((entry) => entry.id === 'public_contract_integrity');
  addCheck(
    checks,
    'quality:public-contract-integrity',
    publicContract?.status === 'covered',
    'public contract integrity is covered by deterministic benchmark evidence',
    { status: publicContract?.status }
  );

  const corpusCases = getArray(artifacts.corpus, 'cases');
  const corpusScore = getNumber(artifacts.corpus, 'score');
  const corpusCaseCount = getNumber(artifacts.corpus, 'case_count');
  const corpusAssertionCount = getNumber(artifacts.corpus, 'assertion_count');
  const corpusPassedAssertionCount = getNumber(artifacts.corpus, 'passed_assertion_count');
  addCheck(
    checks,
    'corpus:score',
    corpusScore === 1 &&
      corpusAssertionCount === corpusPassedAssertionCount &&
      (corpusAssertionCount ?? 0) > 0,
    'corpus benchmark is fully passing',
    {
      score: corpusScore,
      passed_assertions: corpusPassedAssertionCount,
      assertion_count: corpusAssertionCount,
    }
  );
  addCheck(
    checks,
    'corpus:case-count',
    corpusCases.length >= 4 && corpusCaseCount === corpusCases.length,
    'corpus benchmark includes the expected minimum case coverage',
    { case_count: corpusCaseCount, observed_cases: corpusCases.length }
  );
  addCheck(
    checks,
    'corpus:fixture-diversity',
    corpusCases.some((entry) => entry.fixture_type === 'checked-in') &&
      corpusCases.some((entry) => entry.fixture_type === 'runtime-generated'),
    'corpus benchmark covers checked-in and runtime-generated fixtures',
    {
      fixture_types: Array.from(
        new Set(corpusCases.map((entry) => getString(entry, 'fixture_type')).filter(Boolean))
      ),
    }
  );
  const corpusCaseIds = new Set(corpusCases.map((entry) => getString(entry, 'id')).filter(Boolean));
  const missingCorpusCaseIds = REQUIRED_CORPUS_CASE_IDS.filter((id) => !corpusCaseIds.has(id));
  addCheck(
    checks,
    'corpus:required-archetypes',
    missingCorpusCaseIds.length === 0,
    'corpus benchmark includes all required end-to-end archetype cases',
    { required_case_ids: REQUIRED_CORPUS_CASE_IDS, missing_case_ids: missingCorpusCaseIds }
  );
  const failingCorpusCases = corpusCases.filter((entry) => {
    const assertionCount = getNumber(entry, 'assertion_count');
    return (
      assertionCount === undefined ||
      assertionCount <= 0 ||
      getNumber(entry, 'passed_assertion_count') !== assertionCount ||
      getNumber(entry, 'score') !== 1
    );
  });
  addCheck(
    checks,
    'corpus:case-quality',
    corpusCases.length > 0 && failingCorpusCases.length === 0,
    'every corpus benchmark case has passing assertion-level evidence',
    {
      failing_case_ids: failingCorpusCases.map((entry) => ({
        id: entry.id,
        score: entry.score,
        assertion_count: entry.assertion_count,
        passed_assertion_count: entry.passed_assertion_count,
      })),
    }
  );

  const providerRequiredIds = finalBarCoverage
    .filter((entry) => entry.status === 'provider_benchmark_required')
    .map((entry) => getString(entry, 'id'))
    .filter((id): id is string => id !== undefined);
  const providerEvidence = getArray(artifacts.provider, 'final_bar_provider_evidence');
  const providerEvidenceById = new Map(providerEvidence.map((entry) => [getString(entry, 'id'), entry]));
  const uncertifiedProviderRequiredIds = providerRequiredIds.filter(
    (id) => providerEvidenceById.get(id)?.status !== 'certified'
  );
  addCheck(
    checks,
    'provider:required-final-bar-evidence',
    providerRequiredIds.length > 0 && uncertifiedProviderRequiredIds.length === 0,
    'all quality areas that require installed-provider evidence are certified',
    { required_ids: providerRequiredIds, uncertified_ids: uncertifiedProviderRequiredIds }
  );

  const providerUncertified = providerEvidence.filter((entry) => entry.status !== 'certified');
  addCheck(
    checks,
    'provider:all-final-bar-evidence-certified',
    providerEvidence.length > 0 && providerUncertified.length === 0,
    'provider final-bar evidence has no skipped, failed, or incomplete capability areas',
    {
      uncertified: providerUncertified.map((entry) => ({
        id: entry.id,
        status: entry.status,
      })),
    }
  );

  addCheck(
    checks,
    'provider:strict-mode',
    artifacts.provider?.strict === true,
    'provider benchmark artifact was produced with strict provider requirements enabled',
    { strict: artifacts.provider?.strict }
  );

  const providerResults = getArray(artifacts.provider, 'results');
  const providerResultsMissingQuality = providerResults.filter((result) => {
    const quality = isRecord(result.quality) ? result.quality : undefined;
    const metrics = getArray(quality, 'metrics');
    return (
      quality === undefined ||
      getNumber(quality, 'metric_count') === undefined ||
      getNumber(quality, 'metric_count') !== metrics.length ||
      metrics.length === 0
    );
  });
  addCheck(
    checks,
    'provider:quality-metrics-present',
    providerResults.length > 0 && providerResultsMissingQuality.length === 0,
    'provider benchmark results include machine-readable quality metrics',
    {
      missing_quality_for: providerResultsMissingQuality.map((result) => ({
        provider: result.provider,
        status: result.status,
      })),
    }
  );

  const providerResultsWithFailingQuality = providerResults.filter((result) => {
    const quality = isRecord(result.quality) ? result.quality : undefined;
    const metrics = getArray(quality, 'metrics');
    return (
      result.status !== 'passed' ||
      getNumber(quality, 'score') !== 1 ||
      getNumber(quality, 'passed_metric_count') !== getNumber(quality, 'metric_count') ||
      metrics.some((metric) => metric.status !== 'passed')
    );
  });
  addCheck(
    checks,
    'provider:quality-metrics-passing',
    providerResults.length > 0 && providerResultsWithFailingQuality.length === 0,
    'provider quality metrics pass for every installed provider certification result',
    {
      failing_quality_for: providerResultsWithFailingQuality.map((result) => ({
        provider: result.provider,
        status: result.status,
        quality_score: isRecord(result.quality) ? result.quality.score : undefined,
      })),
    }
  );

  const summary = summarizeChecks(checks);
  return {
    profile: 'pdf_sota_release_gate',
    generated_at: new Date().toISOString(),
    artifact_dir: absoluteArtifactDir,
    status: summary.failed === 0 ? 'passed' : 'failed',
    summary,
    checks,
  };
};

export const main = async () => {
  const artifactDir = resolveSotaReleaseArtifactDir();
  const report = await buildSotaReleaseGateReport(artifactDir);
  console.log(JSON.stringify(report, null, 2));
  const outputPath = await writeBenchmarkReport(report);
  if (outputPath) {
    console.error(`SOTA release gate report written to ${outputPath}`);
  }
  if (report.status === 'failed') {
    process.exitCode = 1;
  }
};

if (import.meta.main) {
  await main();
}
