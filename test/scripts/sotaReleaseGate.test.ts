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
});
