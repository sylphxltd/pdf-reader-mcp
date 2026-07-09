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
    results: [
      { name: 'v3_agent_document_twin', average_ms: 8.5 },
      { name: 'default_auto_read_balanced', average_ms: 6.2 },
    ],
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
    case_count: 6,
    assertion_count: 23,
    passed_assertion_count: 23,
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
      {
        id: 'runtime-malformed-pdf-trust-routing',
        fixture_type: 'runtime-generated',
        capability_tags: ['malformed_pdf', 'trust_routing'],
        assertion_count: 2,
        passed_assertion_count: 2,
        score: 1,
      },
      {
        id: 'runtime-encrypted-pdf-trust-routing',
        fixture_type: 'runtime-generated',
        capability_tags: ['encrypted_pdf', 'trust_routing'],
        assertion_count: 2,
        passed_assertion_count: 2,
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
        tag: 'malformed_pdf',
        case_count: 1,
        assertion_count: 2,
        passed_assertion_count: 2,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'encrypted_pdf',
        case_count: 1,
        assertion_count: 2,
        passed_assertion_count: 2,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'trust_routing',
        case_count: 2,
        assertion_count: 4,
        passed_assertion_count: 4,
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

const writeValidProviderCropArtifact = (artifactDir: string) => {
  writeArtifact(artifactDir, 'pdf_provider_manifest_crop_benchmark.json', {
    profile: 'pdf_provider_manifest_crop_benchmark',
    status: 'passed',
    strict: true,
    external_case_count: 1,
    external_url_case_count: 0,
    external_download_count: 0,
    external_region_count: 1,
    summary: {
      case_count: 1,
      region_count: 1,
      assertion_count: 5,
      passed_assertion_count: 5,
      failed_assertion_count: 0,
      score: 1,
    },
    capability_summary: [
      {
        tag: 'crop_provenance',
        case_count: 1,
        region_count: 1,
        assertion_count: 5,
        passed_assertion_count: 5,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'document_twin',
        case_count: 1,
        region_count: 1,
        assertion_count: 5,
        passed_assertion_count: 5,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'full_page_crop',
        case_count: 1,
        region_count: 1,
        assertion_count: 5,
        passed_assertion_count: 5,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'release_evidence',
        case_count: 1,
        region_count: 1,
        assertion_count: 5,
        passed_assertion_count: 5,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'render_provenance',
        case_count: 1,
        region_count: 1,
        assertion_count: 5,
        passed_assertion_count: 5,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'visual_text',
        case_count: 1,
        region_count: 1,
        assertion_count: 5,
        passed_assertion_count: 5,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
    ],
    cases: [
      {
        id: 'release-sample-full-page-crop',
        fixture_type: 'external',
        document_archetype: 'text-rich sample PDF rendered as a full-page crop',
        source_type: 'path',
        capability_tags: [
          'document_twin',
          'release_evidence',
          'visual_text',
          'crop_provenance',
          'full_page_crop',
          'render_provenance',
        ],
        region_count: 1,
        assertion_count: 5,
        passed_assertion_count: 5,
        score: 1,
        warnings: [],
        regions: [
          {
            id: 'release-sample-page-1-full-page',
            page: 1,
            capability_tags: [
              'document_twin',
              'release_evidence',
              'visual_text',
              'crop_provenance',
              'full_page_crop',
              'render_provenance',
            ],
            status: 'passed',
            assertion_count: 5,
            passed_assertion_count: 5,
            score: 1,
            crop: {
              evidence_id: 'page-1-release-sample-page-1-full-page-crop-scale-2',
              byte_length: 1,
              scale: 2,
              crop_pixels: { left: 0, top: 0, width: 1224, height: 1584 },
              source_bounding_box: { left: 0, bottom: 0, right: 612, top: 792 },
              page_render_evidence_id: 'page-1-render-scale-2',
            },
          },
        ],
      },
    ],
  });
};

type ProviderManifestTestAssertion = {
  id: string;
  pass: boolean;
  expected: Record<string, JsonValue>;
  observed: Record<string, JsonValue>;
};

const providerManifestAssertions = (
  regionId: string,
  containsText: string[],
  kindSpecificAssertionIds: string[] = []
): ProviderManifestTestAssertion[] => [
  {
    id: `${regionId}:analysis-present`,
    pass: true,
    expected: { analysis: 'present' },
    observed: { analysis: 'present' },
  },
  {
    id: `${regionId}:kind`,
    pass: true,
    expected: { kind: 'expected-kind' },
    observed: { kind: 'expected-kind' },
  },
  {
    id: `${regionId}:confidence`,
    pass: true,
    expected: { min_confidence: 0.88 },
    observed: { confidence: 0.9 },
  },
  ...containsText.map((textNeedle) => ({
    id: `${regionId}:contains:${textNeedle}`,
    pass: true,
    expected: { contains_text: textNeedle },
    observed: { matched: true },
  })),
  ...kindSpecificAssertionIds.map((assertionId) => ({
    id: `${regionId}:${assertionId}`,
    pass: true,
    expected: { required: true },
    observed: { matched: true },
  })),
  {
    id: `${regionId}:crop-provenance`,
    pass: true,
    expected: { crop_provenance: true },
    observed: {
      source_crop_evidence_id: `page-1-${regionId}-crop-scale-2`,
      provenance_source: 'region-analysis-provider',
    },
  },
];

const writeValidProviderManifestArtifact = (
  artifactDir: string,
  options: { missingAssertionEvidenceRegionId?: string } = {}
) => {
  const assertionsFor = (
    regionId: string,
    containsText: string[],
    kindSpecificAssertionIds: string[] = []
  ) => {
    const assertions = providerManifestAssertions(regionId, containsText, kindSpecificAssertionIds);
    if (options.missingAssertionEvidenceRegionId !== regionId) return assertions;

    return assertions.filter(
      (assertion) => assertion.id.endsWith(':analysis-present') || assertion.id.endsWith(':kind')
    );
  };

  writeArtifact(artifactDir, 'pdf_provider_manifest_benchmark.json', {
    profile: 'pdf_provider_manifest_benchmark',
    status: 'passed',
    strict: true,
    external_case_count: 1,
    external_url_case_count: 0,
    external_download_count: 0,
    external_region_count: 5,
    summary: {
      case_count: 1,
      region_count: 5,
      assertion_count: 31,
      passed_assertion_count: 31,
      failed_assertion_count: 0,
      score: 1,
    },
    capability_summary: [
      {
        tag: 'chart_extraction',
        case_count: 1,
        region_count: 1,
        assertion_count: 6,
        passed_assertion_count: 6,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'crop_provenance',
        case_count: 1,
        region_count: 5,
        assertion_count: 31,
        passed_assertion_count: 31,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'document_twin',
        case_count: 1,
        region_count: 5,
        assertion_count: 31,
        passed_assertion_count: 31,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'figure_description',
        case_count: 1,
        region_count: 1,
        assertion_count: 6,
        passed_assertion_count: 6,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'formula_recognition',
        case_count: 1,
        region_count: 1,
        assertion_count: 6,
        passed_assertion_count: 6,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'image_description',
        case_count: 1,
        region_count: 1,
        assertion_count: 6,
        passed_assertion_count: 6,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'provider_manifest_scoring',
        case_count: 1,
        region_count: 5,
        assertion_count: 31,
        passed_assertion_count: 31,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'release_evidence',
        case_count: 1,
        region_count: 5,
        assertion_count: 31,
        passed_assertion_count: 31,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
      {
        tag: 'table_recognition',
        case_count: 1,
        region_count: 1,
        assertion_count: 7,
        passed_assertion_count: 7,
        failed_assertion_count: 0,
        score: 1,
        status: 'passed',
      },
    ],
    cases: [
      {
        id: 'release-provider-analysis-fixture',
        fixture_type: 'external',
        document_archetype: 'sample PDF with deterministic visual provider regions',
        source_type: 'path',
        capability_tags: [
          'document_twin',
          'release_evidence',
          'provider_manifest_scoring',
          'table_recognition',
          'formula_recognition',
          'chart_extraction',
          'figure_description',
          'image_description',
          'crop_provenance',
        ],
        region_count: 5,
        assertion_count: 31,
        passed_assertion_count: 31,
        score: 1,
        warnings: [],
        regions: [
          {
            id: 'cert-table',
            page: 1,
            capability_tags: [
              'document_twin',
              'release_evidence',
              'provider_manifest_scoring',
              'table_recognition',
              'crop_provenance',
            ],
            expected_kind: 'table',
            observed_kind: 'table',
            status: 'passed',
            assertion_count: 7,
            passed_assertion_count: 7,
            score: 1,
            assertions: assertionsFor('cert-table', ['Metric', 'Revenue'], ['table-cells']),
          },
          {
            id: 'cert-formula',
            page: 1,
            capability_tags: [
              'document_twin',
              'release_evidence',
              'provider_manifest_scoring',
              'formula_recognition',
              'crop_provenance',
            ],
            expected_kind: 'formula',
            observed_kind: 'formula',
            status: 'passed',
            assertion_count: 6,
            passed_assertion_count: 6,
            score: 1,
            assertions: assertionsFor('cert-formula', ['E = mc^2'], ['formula-formats']),
          },
          {
            id: 'cert-chart',
            page: 1,
            capability_tags: [
              'document_twin',
              'release_evidence',
              'provider_manifest_scoring',
              'chart_extraction',
              'crop_provenance',
            ],
            expected_kind: 'chart',
            observed_kind: 'chart',
            status: 'passed',
            assertion_count: 6,
            passed_assertion_count: 6,
            score: 1,
            assertions: assertionsFor('cert-chart', ['Revenue by Quarter'], ['chart-components']),
          },
          {
            id: 'cert-figure',
            page: 1,
            capability_tags: [
              'document_twin',
              'release_evidence',
              'provider_manifest_scoring',
              'figure_description',
              'crop_provenance',
            ],
            expected_kind: 'figure',
            observed_kind: 'figure',
            status: 'passed',
            assertion_count: 6,
            passed_assertion_count: 6,
            score: 1,
            assertions: assertionsFor('cert-figure', ['Pipeline', 'ingest']),
          },
          {
            id: 'cert-image',
            page: 1,
            capability_tags: [
              'document_twin',
              'release_evidence',
              'provider_manifest_scoring',
              'image_description',
              'crop_provenance',
            ],
            expected_kind: 'image',
            observed_kind: 'image',
            status: 'passed',
            assertion_count: 6,
            passed_assertion_count: 6,
            score: 1,
            assertions: assertionsFor('cert-image', ['Office image', 'landscape']),
          },
        ],
      },
    ],
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
      writeValidProviderCropArtifact(tempDir);
      writeValidProviderManifestArtifact(tempDir);

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
      writeValidProviderCropArtifact(tempDir);
      writeValidProviderManifestArtifact(tempDir);

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
      writeValidProviderCropArtifact(tempDir);
      writeValidProviderManifestArtifact(tempDir);

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
      writeValidProviderCropArtifact(tempDir);
      writeValidProviderManifestArtifact(tempDir);
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
      writeValidProviderCropArtifact(tempDir);
      writeValidProviderManifestArtifact(tempDir);
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
      writeValidProviderCropArtifact(tempDir);
      writeValidProviderManifestArtifact(tempDir);

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

  test('fails when provider-manifest analysis artifact is missing or incomplete', async () => {
    await withTempDir(async (tempDir) => {
      writeValidPerformanceArtifact(tempDir);
      writeValidQualityArtifact(tempDir);
      writeValidCorpusArtifact(tempDir);
      writeProviderArtifact(tempDir, 'certified', true);
      writeValidProviderCropArtifact(tempDir);

      const missingReport = await buildSotaReleaseGateReport(tempDir);

      expect(missingReport.status).toBe('failed');
      expect(
        missingReport.checks.find((check) => check.id === 'artifact:provider-manifest')?.status
      ).toBe('failed');
      expect(
        missingReport.checks.find((check) => check.id === 'provider-manifest:score')?.status
      ).toBe('failed');

      writeArtifact(tempDir, 'pdf_provider_manifest_benchmark.json', {
        profile: 'pdf_provider_manifest_benchmark',
        status: 'passed',
        external_case_count: 1,
        external_region_count: 1,
        summary: {
          case_count: 1,
          region_count: 1,
          assertion_count: 5,
          passed_assertion_count: 4,
          failed_assertion_count: 1,
          score: 0.8,
        },
        capability_summary: [
          {
            tag: 'table_recognition',
            case_count: 1,
            region_count: 1,
            assertion_count: 5,
            passed_assertion_count: 4,
            failed_assertion_count: 1,
            score: 0.8,
            status: 'failed',
          },
        ],
        cases: [
          {
            id: 'release-provider-analysis-fixture',
            region_count: 1,
            assertion_count: 5,
            passed_assertion_count: 4,
            score: 0.8,
            regions: [
              {
                id: 'cert-table',
                expected_kind: 'table',
                observed_kind: 'unknown',
                status: 'failed',
                assertion_count: 5,
                passed_assertion_count: 4,
                score: 0.8,
              },
            ],
          },
        ],
      });

      const incompleteReport = await buildSotaReleaseGateReport(tempDir);

      expect(incompleteReport.status).toBe('failed');
      expect(
        incompleteReport.checks.find((check) => check.id === 'provider-manifest:score')?.status
      ).toBe('failed');
      expect(
        incompleteReport.checks.find(
          (check) => check.id === 'provider-manifest:case-region-quality'
        )?.status
      ).toBe('failed');
      expect(
        incompleteReport.checks.find((check) => check.id === 'provider-manifest:kind-coverage')
          ?.status
      ).toBe('failed');
      expect(
        incompleteReport.checks.find((check) => check.id === 'provider-manifest:capability-summary')
          ?.status
      ).toBe('failed');
    });
  });

  test('fails when provider-manifest scoring lacks required assertion evidence', async () => {
    await withTempDir(async (tempDir) => {
      writeValidPerformanceArtifact(tempDir);
      writeValidQualityArtifact(tempDir);
      writeValidCorpusArtifact(tempDir);
      writeProviderArtifact(tempDir, 'certified', true);
      writeValidProviderCropArtifact(tempDir);
      writeValidProviderManifestArtifact(tempDir, {
        missingAssertionEvidenceRegionId: 'cert-table',
      });

      const report = await buildSotaReleaseGateReport(tempDir);

      expect(report.status).toBe('failed');
      expect(report.checks.find((check) => check.id === 'provider-manifest:score')?.status).toBe(
        'passed'
      );
      expect(
        report.checks.find((check) => check.id === 'provider-manifest:case-region-quality')?.status
      ).toBe('passed');
      expect(
        report.checks.find((check) => check.id === 'provider-manifest:assertion-evidence')?.status
      ).toBe('failed');
    });
  });

  test('fails when provider-manifest crop artifact is missing or incomplete', async () => {
    await withTempDir(async (tempDir) => {
      writeValidPerformanceArtifact(tempDir);
      writeValidQualityArtifact(tempDir);
      writeValidCorpusArtifact(tempDir);
      writeProviderArtifact(tempDir, 'certified', true);
      writeValidProviderManifestArtifact(tempDir);

      const missingReport = await buildSotaReleaseGateReport(tempDir);

      expect(missingReport.status).toBe('failed');
      expect(
        missingReport.checks.find((check) => check.id === 'artifact:provider-crops')?.status
      ).toBe('failed');
      expect(
        missingReport.checks.find((check) => check.id === 'provider-crops:score')?.status
      ).toBe('failed');

      writeArtifact(tempDir, 'pdf_provider_manifest_crop_benchmark.json', {
        profile: 'pdf_provider_manifest_crop_benchmark',
        status: 'passed',
        external_case_count: 1,
        external_region_count: 1,
        summary: {
          case_count: 1,
          region_count: 1,
          assertion_count: 5,
          passed_assertion_count: 4,
          failed_assertion_count: 1,
          score: 0.8,
        },
        capability_summary: [
          {
            tag: 'full_page_crop',
            case_count: 1,
            region_count: 1,
            assertion_count: 5,
            passed_assertion_count: 4,
            failed_assertion_count: 1,
            score: 0.8,
            status: 'failed',
          },
        ],
        cases: [
          {
            id: 'release-sample-full-page-crop',
            region_count: 1,
            assertion_count: 5,
            passed_assertion_count: 4,
            score: 0.8,
            regions: [
              {
                id: 'release-sample-page-1-full-page',
                status: 'failed',
                score: 0.8,
              },
            ],
          },
        ],
      });

      const incompleteReport = await buildSotaReleaseGateReport(tempDir);

      expect(incompleteReport.status).toBe('failed');
      expect(
        incompleteReport.checks.find((check) => check.id === 'provider-crops:score')?.status
      ).toBe('failed');
      expect(
        incompleteReport.checks.find((check) => check.id === 'provider-crops:case-region-quality')
          ?.status
      ).toBe('failed');
      expect(
        incompleteReport.checks.find((check) => check.id === 'provider-crops:capability-summary')
          ?.status
      ).toBe('failed');
    });
  });
});
