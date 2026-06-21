import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildSotaReleaseGateReport,
  resolveSotaReleaseArtifactDir,
} from '../../scripts/sota-release-gate.js';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const withTempDir = async <T>(run: (tempDir: string) => Promise<T>): Promise<T> => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-reader-sota-gate-'));
  try {
    return await run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const writeArtifact = (artifactDir: string, fileName: string, data: JsonValue) => {
  fs.writeFileSync(path.join(artifactDir, fileName), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
};

const writeValidPerformanceArtifact = (artifactDir: string) => {
  writeArtifact(artifactDir, 'pdf_performance_benchmark.json', {
    profile: 'pdf_performance_benchmark',
    results: [{ name: 'v3_agent_document_twin', average_ms: 8.5 }],
  });
};

const writeValidQualityArtifact = (artifactDir: string) => {
  writeArtifact(artifactDir, 'pdf_quality_benchmark.json', {
    profile: 'pdf_quality_benchmark',
    passed: 59,
    total: 59,
    score: 1,
    final_bar_coverage: [
      { id: 'lossless_selectable_text_evidence', status: 'covered' },
      { id: 'scanned_pdf_pipeline', status: 'provider_benchmark_required' },
      { id: 'public_contract_integrity', status: 'covered' },
    ],
  });
};

const writeValidCorpusArtifact = (artifactDir: string) => {
  writeArtifact(artifactDir, 'pdf_corpus_benchmark.json', {
    profile: 'pdf_corpus_benchmark',
    case_count: 4,
    assertion_count: 19,
    passed_assertion_count: 19,
    score: 1,
    cases: [
      {
        id: 'checked-in-sample-agent-document-twin',
        fixture_type: 'checked-in',
        capability_tags: ['document_map', 'text_layer'],
        assertion_count: 6,
        passed_assertion_count: 6,
        score: 1,
      },
      {
        id: 'runtime-report-reading-order',
        fixture_type: 'runtime-generated',
        capability_tags: ['document_map', 'reading_order'],
        assertion_count: 6,
        passed_assertion_count: 6,
        score: 1,
      },
      {
        id: 'runtime-scanned-ocr-routing',
        fixture_type: 'runtime-generated',
        capability_tags: ['document_map', 'ocr_routing', 'ocr_text_layer', 'scanned_page'],
        assertion_count: 3,
        passed_assertion_count: 3,
        score: 1,
      },
      {
        id: 'runtime-ocr-table-agent-evidence',
        fixture_type: 'runtime-generated',
        capability_tags: [
          'document_map',
          'ocr_table_extraction',
          'ocr_text_layer',
          'scanned_table',
        ],
        assertion_count: 4,
        passed_assertion_count: 4,
        score: 1,
      },
    ],
    capability_summary: [
      {
        tag: 'document_map',
        case_count: 4,
        assertion_count: 19,
        passed_assertion_count: 19,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'reading_order',
        case_count: 1,
        assertion_count: 6,
        passed_assertion_count: 6,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'ocr_routing',
        case_count: 1,
        assertion_count: 3,
        passed_assertion_count: 3,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'ocr_text_layer',
        case_count: 2,
        assertion_count: 7,
        passed_assertion_count: 7,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'ocr_table_extraction',
        case_count: 1,
        assertion_count: 4,
        passed_assertion_count: 4,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'scanned_page',
        case_count: 1,
        assertion_count: 3,
        passed_assertion_count: 3,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'scanned_table',
        case_count: 1,
        assertion_count: 4,
        passed_assertion_count: 4,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'text_layer',
        case_count: 1,
        assertion_count: 6,
        passed_assertion_count: 6,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
    ],
  });
};

const writeProviderArtifact = (
  artifactDir: string,
  status: 'certified' | 'provider_benchmark_required',
  strict = true
) => {
  writeArtifact(artifactDir, 'pdf_provider_benchmark.json', {
    profile: 'pdf_provider_benchmark',
    strict,
    results: [
      {
        provider: 'tesseract-tsv',
        status: status === 'certified' ? 'passed' : 'skipped',
        quality:
          status === 'certified'
            ? {
                profile: 'ocr-text-layer',
                fixture_count: 1,
                metric_count: 1,
                passed_metric_count: 1,
                score: 1,
                metrics: [
                  {
                    id: 'ocr_token_recall',
                    capability: 'tesseract-tsv provider returns expected OCR tokens',
                    status: 'passed',
                    score: 1,
                    threshold: 1,
                    expected: { tokens: ['HELLO', 'WORLD'] },
                    observed: { matched_tokens: ['HELLO', 'WORLD'] },
                  },
                ],
              }
            : {
                profile: 'ocr-text-layer',
                fixture_count: 1,
                metric_count: 1,
                passed_metric_count: 0,
                score: 0,
                metrics: [
                  {
                    id: 'ocr_token_recall',
                    capability: 'tesseract-tsv provider returns expected OCR tokens',
                    status: 'skipped',
                    expected: { tokens: ['HELLO', 'WORLD'] },
                    observed: {},
                  },
                ],
              },
      },
    ],
    final_bar_provider_evidence: [{ id: 'scanned_pdf_pipeline', status }],
  });
};

describe('SOTA release gate', () => {
  test('resolves artifact directories from flags and environment', async () => {
    await withTempDir(async (tempDir) => {
      expect(resolveSotaReleaseArtifactDir(['--artifacts-dir', tempDir], {})).toBe(
        path.resolve(tempDir)
      );
      expect(resolveSotaReleaseArtifactDir([], { MCP_PDF_BENCHMARK_OUTPUT_DIR: tempDir })).toBe(
        path.resolve(tempDir)
      );
    });
  });

  test('passes only when deterministic and provider-backed final-bar evidence is complete', async () => {
    await withTempDir(async (tempDir) => {
      writeValidPerformanceArtifact(tempDir);
      writeValidQualityArtifact(tempDir);
      writeValidCorpusArtifact(tempDir);
      writeProviderArtifact(tempDir, 'certified', true);

      const report = await buildSotaReleaseGateReport(tempDir);

      expect(report.status).toBe('passed');
      expect(report.summary.failed).toBe(0);
      expect(report.checks.every((check) => check.status === 'passed')).toBe(true);
    });
  });

  test('fails when installed-provider evidence is still required', async () => {
    await withTempDir(async (tempDir) => {
      writeValidPerformanceArtifact(tempDir);
      writeValidQualityArtifact(tempDir);
      writeValidCorpusArtifact(tempDir);
      writeProviderArtifact(tempDir, 'provider_benchmark_required', false);

      const report = await buildSotaReleaseGateReport(tempDir);

      expect(report.status).toBe('failed');
      expect(report.checks.find((check) => check.id === 'provider:strict-mode')?.status).toBe(
        'failed'
      );
      expect(
        report.checks.find((check) => check.id === 'provider:required-final-bar-evidence')?.status
      ).toBe('failed');
      expect(
        report.checks.find((check) => check.id === 'provider:quality-metrics-passing')?.status
      ).toBe('failed');
    });
  });

  test('fails when a required artifact is missing', async () => {
    await withTempDir(async (tempDir) => {
      writeValidPerformanceArtifact(tempDir);
      writeValidQualityArtifact(tempDir);
      writeValidCorpusArtifact(tempDir);

      const report = await buildSotaReleaseGateReport(tempDir);

      expect(report.status).toBe('failed');
      expect(report.checks.find((check) => check.id === 'artifact:provider')?.status).toBe(
        'failed'
      );
    });
  });

  test('fails when certified provider evidence has no quality metrics', async () => {
    await withTempDir(async (tempDir) => {
      writeValidPerformanceArtifact(tempDir);
      writeValidQualityArtifact(tempDir);
      writeValidCorpusArtifact(tempDir);
      writeArtifact(tempDir, 'pdf_provider_benchmark.json', {
        profile: 'pdf_provider_benchmark',
        strict: true,
        results: [{ provider: 'tesseract-tsv', status: 'passed' }],
        final_bar_provider_evidence: [{ id: 'scanned_pdf_pipeline', status: 'certified' }],
      });

      const report = await buildSotaReleaseGateReport(tempDir);

      expect(report.status).toBe('failed');
      expect(
        report.checks.find((check) => check.id === 'provider:quality-metrics-present')?.status
      ).toBe('failed');
    });
  });

  test('fails when certified provider quality metrics do not pass', async () => {
    await withTempDir(async (tempDir) => {
      writeValidPerformanceArtifact(tempDir);
      writeValidQualityArtifact(tempDir);
      writeValidCorpusArtifact(tempDir);
      writeArtifact(tempDir, 'pdf_provider_benchmark.json', {
        profile: 'pdf_provider_benchmark',
        strict: true,
        results: [
          {
            provider: 'tesseract-tsv',
            status: 'passed',
            quality: {
              profile: 'ocr-text-layer',
              fixture_count: 1,
              metric_count: 1,
              passed_metric_count: 0,
              score: 0.5,
              metrics: [
                {
                  id: 'ocr_token_recall',
                  capability: 'tesseract-tsv provider returns expected OCR tokens',
                  status: 'failed',
                  score: 0.5,
                  threshold: 1,
                  expected: { tokens: ['HELLO', 'WORLD'] },
                  observed: { matched_tokens: ['HELLO'] },
                },
              ],
            },
          },
        ],
        final_bar_provider_evidence: [{ id: 'scanned_pdf_pipeline', status: 'certified' }],
      });

      const report = await buildSotaReleaseGateReport(tempDir);

      expect(report.status).toBe('failed');
      expect(
        report.checks.find((check) => check.id === 'provider:quality-metrics-present')?.status
      ).toBe('passed');
      expect(
        report.checks.find((check) => check.id === 'provider:quality-metrics-passing')?.status
      ).toBe('failed');
    });
  });

  test('fails when corpus benchmark evidence is incomplete', async () => {
    await withTempDir(async (tempDir) => {
      writeValidPerformanceArtifact(tempDir);
      writeValidQualityArtifact(tempDir);
      writeArtifact(tempDir, 'pdf_corpus_benchmark.json', {
        profile: 'pdf_corpus_benchmark',
        case_count: 1,
        assertion_count: 2,
        passed_assertion_count: 1,
        score: 0.5,
        cases: [
          {
            id: 'checked-in-sample-agent-document-twin',
            fixture_type: 'checked-in',
            assertion_count: 2,
            passed_assertion_count: 1,
            score: 0.5,
          },
        ],
      });
      writeProviderArtifact(tempDir, 'certified', true);

      const report = await buildSotaReleaseGateReport(tempDir);

      expect(report.status).toBe('failed');
      expect(report.checks.find((check) => check.id === 'corpus:score')?.status).toBe('failed');
      expect(report.checks.find((check) => check.id === 'corpus:case-count')?.status).toBe(
        'failed'
      );
      expect(report.checks.find((check) => check.id === 'corpus:fixture-diversity')?.status).toBe(
        'failed'
      );
      expect(report.checks.find((check) => check.id === 'corpus:required-archetypes')?.status).toBe(
        'failed'
      );
      expect(report.checks.find((check) => check.id === 'corpus:case-quality')?.status).toBe(
        'failed'
      );
      expect(
        report.checks.find((check) => check.id === 'corpus:case-capability-tags')?.status
      ).toBe('failed');
      expect(report.checks.find((check) => check.id === 'corpus:capability-summary')?.status).toBe(
        'failed'
      );
    });
  });
});
