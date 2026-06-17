import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import { readPdf } from '../src/handlers/readPdf.js';
import { getOcrProviderStatus } from '../src/pdf/ocr.js';
import {
  analyzePdfRegionsFromSource,
  defaultAnalyzeRegionsOptions,
  getRegionAnalysisProviderStatus,
} from '../src/pdf/regionAnalysis.js';
import type { ReadPdfArgs } from '../src/schemas/readPdf.js';
import type {
  PdfInspectionProviderStatus,
  PdfRegionAnalysisData,
  PdfRegionAnalysisKind,
  PdfRegionRequest,
} from '../src/types/pdf.js';
import { writeBenchmarkReport } from './benchmark-utils.js';

interface ProviderBenchmarkResult {
  provider: 'tesseract-tsv' | 'region-analysis';
  status: 'passed' | 'failed' | 'skipped';
  duration_ms: number;
  message?: string | undefined;
  assertions?: Array<{ name: string; pass: boolean }> | undefined;
  provider_status?: Partial<PdfInspectionProviderStatus> | undefined;
  metrics?: {
    adapter?: string | undefined;
    kind?: string | undefined;
    confidence?: number | undefined;
    table_cells?: number | undefined;
    table_rows?: number | undefined;
    chart_series?: number | undefined;
    formula_formats?: number | undefined;
    figure_count?: number | undefined;
    image_description_count?: number | undefined;
    fixture_count?: number | undefined;
    region_count?: number | undefined;
    text_chars?: number | undefined;
    word_count?: number | undefined;
    words_with_bounding_boxes?: number | undefined;
    average_confidence?: number | undefined;
  };
  certification?: {
    profile: 'ocr-text-layer' | 'visual-full-fidelity';
    fixture_count: number;
    capability_count: number;
    passed_capability_count: number;
    capabilities: Record<string, 'passed' | 'failed' | 'skipped'>;
  };
  quality?: ProviderBenchmarkQuality | undefined;
}

type ProviderBenchmarkQualityMetricStatus = 'passed' | 'failed' | 'skipped';

interface ProviderBenchmarkQualityMetric {
  id: string;
  capability: string;
  status: ProviderBenchmarkQualityMetricStatus;
  score?: number | undefined;
  threshold?: number | undefined;
  expected: Record<string, unknown>;
  observed: Record<string, unknown>;
}

interface ProviderBenchmarkQuality {
  profile: 'ocr-text-layer' | 'visual-full-fidelity';
  fixture_count: number;
  metric_count: number;
  passed_metric_count: number;
  score: number;
  metrics: ProviderBenchmarkQualityMetric[];
}

type FinalBarProviderEvidenceStatus =
  | 'certified'
  | 'provider_benchmark_required'
  | 'failed'
  | 'incomplete';

interface FinalBarProviderEvidenceRequirement {
  id: string;
  capability: string;
  required_profiles: NonNullable<ProviderBenchmarkResult['certification']>['profile'][];
  required_capabilities: string[];
  evidence: string[];
}

interface FinalBarProviderEvidenceResult extends FinalBarProviderEvidenceRequirement {
  status: FinalBarProviderEvidenceStatus;
  missing_profiles: string[];
  failed_profiles: string[];
  missing_capabilities: string[];
  skipped_capabilities: string[];
  failed_capabilities: string[];
}

interface FinalBarProviderEvidenceSummary {
  total: number;
  certified: number;
  provider_benchmark_required: number;
  failed: number;
  incomplete: number;
}

interface ProviderBenchmarkReport {
  profile: 'pdf_provider_benchmark';
  generated_at: string;
  fixture_scope: string;
  strict: boolean;
  certification_profiles: Array<NonNullable<ProviderBenchmarkResult['certification']>['profile']>;
  results: ProviderBenchmarkResult[];
  final_bar_provider_evidence_summary: FinalBarProviderEvidenceSummary;
  final_bar_provider_evidence: FinalBarProviderEvidenceResult[];
}

interface OcrTextLayerBenchmarkView {
  pages?: Array<{
    page?: number;
    text?: string;
    confidence?: number;
    words?: Array<{ bounding_box?: unknown }>;
    source_render_evidence_id?: string;
  }>;
  summary?: {
    text_chars?: number;
    word_count?: number;
    words_with_bounding_boxes?: number;
    average_confidence?: number;
  };
}

interface DocumentMapBenchmarkView {
  layers?: string[];
  routing?: { ocr_applied_pages?: number[] };
}

const execFileAsync = promisify(execFile);
const STRICT_PROVIDER_BENCHMARK_ENV = 'MCP_PDF_PROVIDER_BENCHMARK_REQUIRED';
interface OcrProviderFixture {
  id: string;
  file_name: string;
  tokens: string[];
}

interface TesseractTsvEvidence {
  fixture_id: string;
  expected_tokens: string[];
  ocrTextLayer: OcrTextLayerBenchmarkView | undefined;
  documentMap: DocumentMapBenchmarkView | undefined;
  page: NonNullable<OcrTextLayerBenchmarkView['pages']>[number] | undefined;
  normalizedText: string;
}

type VisualProviderFixture = {
  id: string;
  kind: Exclude<PdfRegionAnalysisKind, 'unknown'>;
  region: PdfRegionRequest;
  expected: {
    min_cell_boxes?: number | undefined;
    min_formula_formats?: number | undefined;
    chart_components?: number | undefined;
    terms?: string[] | undefined;
  };
};

interface VisualProviderFixtureSet {
  id: string;
  file_name: string;
  content_stream: string;
  fixtures: VisualProviderFixture[];
}

const OCR_PROVIDER_FIXTURES: OcrProviderFixture[] = [
  {
    id: 'cert-ocr-simple',
    file_name: 'provider-ocr-simple-fixture.pdf',
    tokens: ['HELLO', 'WORLD'],
  },
  {
    id: 'cert-ocr-agent',
    file_name: 'provider-ocr-agent-fixture.pdf',
    tokens: ['AGENT', 'READY'],
  },
];
const EXPECTED_OCR_TOKEN_COUNT = OCR_PROVIDER_FIXTURES.reduce(
  (sum, fixture) => sum + fixture.tokens.length,
  0
);
const PROVIDER_CERTIFICATION_PROFILES = {
  'tesseract-tsv': 'ocr-text-layer',
  'region-analysis': 'visual-full-fidelity',
} as const satisfies Record<
  ProviderBenchmarkResult['provider'],
  NonNullable<ProviderBenchmarkResult['certification']>['profile']
>;
const TESSERACT_TSV_CAPABILITIES = [
  'tesseract-tsv provider returns expected OCR tokens',
  'tesseract-tsv provider normalizes word-level bounding boxes',
  'read_pdf fuses provider OCR evidence into the document map',
] as const;
const VISUAL_REGION_CAPABILITIES = [
  'region provider analyzes all visual certification fixtures',
  'region provider preserves crop evidence provenance for every fixture',
  'region provider returns a structured table with cell boxes',
  'region provider returns machine-readable formula evidence',
  'region provider returns chart axes or series evidence',
  'region provider returns figure description evidence',
  'region provider returns image-description evidence',
] as const;
const FINAL_BAR_PROVIDER_EVIDENCE_REQUIREMENTS: FinalBarProviderEvidenceRequirement[] = [
  {
    id: 'scanned_pdf_pipeline',
    capability: 'Scanned-PDF pipeline',
    required_profiles: ['ocr-text-layer'],
    required_capabilities: [...TESSERACT_TSV_CAPABILITIES],
    evidence: [
      'installed OCR provider returns expected text tokens',
      'installed OCR provider returns word-level bounding boxes',
      'read_pdf fuses OCR provider evidence into the document map',
    ],
  },
  {
    id: 'table_intelligence',
    capability: 'Table intelligence',
    required_profiles: ['visual-full-fidelity'],
    required_capabilities: [
      'region provider analyzes all visual certification fixtures',
      'region provider preserves crop evidence provenance for every fixture',
      'region provider returns a structured table with cell boxes',
    ],
    evidence: [
      'configured visual-region provider processes the table fixture',
      'table cell boxes survive normalization',
      'crop provenance is preserved for table evidence',
    ],
  },
  {
    id: 'formula_chart_figure_enrichment',
    capability: 'Formula, chart, and figure enrichment',
    required_profiles: ['visual-full-fidelity'],
    required_capabilities: [
      'region provider analyzes all visual certification fixtures',
      'region provider preserves crop evidence provenance for every fixture',
      'region provider returns machine-readable formula evidence',
      'region provider returns chart axes or series evidence',
      'region provider returns figure description evidence',
      'region provider returns image-description evidence',
    ],
    evidence: [
      'configured visual-region provider processes formula, chart, figure, and image fixtures',
      'formula/chart/figure/image outputs normalize into agent evidence',
      'crop provenance is preserved for every visual evidence item',
    ],
  },
  {
    id: 'reproducible_public_quality_proof',
    capability: 'Reproducible proof',
    required_profiles: ['ocr-text-layer', 'visual-full-fidelity'],
    required_capabilities: [...TESSERACT_TSV_CAPABILITIES, ...VISUAL_REGION_CAPABILITIES],
    evidence: [
      'installed OCR certification profile',
      'installed visual full-fidelity certification profile',
      'machine-readable final-bar provider evidence matrix',
    ],
  },
];
const CORE_VISUAL_PROVIDER_FIXTURES: VisualProviderFixture[] = [
  {
    id: 'cert-table',
    kind: 'table',
    region: {
      id: 'cert-table',
      page: 1,
      bounding_box: { left: 50, bottom: 545, right: 435, top: 735 },
      padding: 8,
    },
    expected: { min_cell_boxes: 4 },
  },
  {
    id: 'cert-formula',
    kind: 'formula',
    region: {
      id: 'cert-formula',
      page: 1,
      bounding_box: { left: 50, bottom: 430, right: 435, top: 530 },
      padding: 8,
    },
    expected: { min_formula_formats: 2 },
  },
  {
    id: 'cert-chart',
    kind: 'chart',
    region: {
      id: 'cert-chart',
      page: 1,
      bounding_box: { left: 50, bottom: 160, right: 535, top: 415 },
      padding: 8,
    },
    expected: { chart_components: 3 },
  },
  {
    id: 'cert-figure',
    kind: 'figure',
    region: {
      id: 'cert-figure',
      page: 1,
      bounding_box: { left: 50, bottom: 40, right: 300, top: 145 },
      padding: 8,
    },
    expected: { terms: ['pipeline', 'figure'] },
  },
  {
    id: 'cert-image',
    kind: 'image',
    region: {
      id: 'cert-image',
      page: 1,
      bounding_box: { left: 330, bottom: 40, right: 585, top: 145 },
      padding: 8,
    },
    expected: { terms: ['office', 'landscape'] },
  },
] satisfies VisualProviderFixture[];

const DIVERSE_VISUAL_PROVIDER_FIXTURES: VisualProviderFixture[] = [
  {
    id: 'cert-table-status',
    kind: 'table',
    region: {
      id: 'cert-table-status',
      page: 1,
      bounding_box: { left: 50, bottom: 560, right: 520, top: 735 },
      padding: 8,
    },
    expected: { min_cell_boxes: 6 },
  },
  {
    id: 'cert-formula-pythagorean',
    kind: 'formula',
    region: {
      id: 'cert-formula-pythagorean',
      page: 1,
      bounding_box: { left: 50, bottom: 440, right: 435, top: 535 },
      padding: 8,
    },
    expected: { min_formula_formats: 2 },
  },
  {
    id: 'cert-chart-latency',
    kind: 'chart',
    region: {
      id: 'cert-chart-latency',
      page: 1,
      bounding_box: { left: 50, bottom: 170, right: 560, top: 420 },
      padding: 8,
    },
    expected: { chart_components: 3 },
  },
  {
    id: 'cert-figure-decision',
    kind: 'figure',
    region: {
      id: 'cert-figure-decision',
      page: 1,
      bounding_box: { left: 50, bottom: 45, right: 300, top: 150 },
      padding: 8,
    },
    expected: { terms: ['decision', 'flow'] },
  },
  {
    id: 'cert-image-dashboard',
    kind: 'image',
    region: {
      id: 'cert-image-dashboard',
      page: 1,
      bounding_box: { left: 330, bottom: 45, right: 585, top: 150 },
      padding: 8,
    },
    expected: { terms: ['dashboard', 'heatmap'] },
  },
] satisfies VisualProviderFixture[];

const VISUAL_PROVIDER_FIXTURE_SETS: VisualProviderFixtureSet[] = [
  {
    id: 'core-visual-evidence',
    file_name: 'provider-visual-core-fixture.pdf',
    fixtures: CORE_VISUAL_PROVIDER_FIXTURES,
    content_stream: [
      'q',
      '0 0 0 RG',
      '1 w',
      '60 720 m 420 720 l 420 560 l 60 560 l h S',
      '60 680 m 420 680 l S',
      '60 640 m 420 640 l S',
      '60 600 m 420 600 l S',
      '240 720 m 240 560 l S',
      'BT',
      '/F1 16 Tf',
      '72 694 Td (Metric) Tj',
      '180 0 Td (Value) Tj',
      '-180 -40 Td (Revenue) Tj',
      '180 0 Td ($1.2M) Tj',
      '-180 -40 Td (Users) Tj',
      '180 0 Td (4200) Tj',
      'ET',
      'BT',
      '/F1 24 Tf',
      '72 480 Td (E = mc^2) Tj',
      'ET',
      '0 0 0 RG',
      '1.5 w',
      '72 205 m 72 380 l 500 205 l S',
      '0.24 0.47 0.86 rg',
      '100 205 54 72 re f',
      '190 205 54 108 re f',
      '280 205 54 144 re f',
      'BT',
      '/F1 12 Tf',
      '105 185 Td (Q1) Tj',
      '90 0 Td (Q2) Tj',
      '90 0 Td (Q3) Tj',
      '-260 205 Td (Revenue by Quarter) Tj',
      'ET',
      '0 0 0 RG',
      '1 w',
      '80 70 m 140 115 l 220 70 l S',
      '80 70 m 220 70 l S',
      'BT',
      '/F1 12 Tf',
      '72 118 Td (Pipeline figure) Tj',
      'ET',
      '0.85 0.90 0.96 rg',
      '345 58 210 72 re f',
      '0 0 0 RG',
      '1 w',
      '345 58 210 72 re S',
      '360 72 m 410 108 l 458 76 l 510 120 l S',
      'BT',
      '/F1 12 Tf',
      '360 118 Td (Office image) Tj',
      'ET',
      'Q',
    ].join('\n'),
  },
  {
    id: 'diverse-visual-evidence',
    file_name: 'provider-visual-diverse-fixture.pdf',
    fixtures: DIVERSE_VISUAL_PROVIDER_FIXTURES,
    content_stream: [
      'q',
      '0 0 0 RG',
      '1 w',
      '60 720 m 500 720 l 500 575 l 60 575 l h S',
      '60 685 m 500 685 l S',
      '60 650 m 500 650 l S',
      '60 615 m 500 615 l S',
      '205 720 m 205 575 l S',
      '355 720 m 355 575 l S',
      'BT',
      '/F1 15 Tf',
      '72 697 Td (Task) Tj',
      '145 0 Td (Owner) Tj',
      '150 0 Td (Status) Tj',
      '-295 -35 Td (Extract) Tj',
      '145 0 Td (Agent) Tj',
      '150 0 Td (Ready) Tj',
      '-295 -35 Td (Cite) Tj',
      '145 0 Td (Reviewer) Tj',
      '150 0 Td (Passed) Tj',
      'ET',
      'BT',
      '/F1 24 Tf',
      '72 490 Td (a^2 + b^2 = c^2) Tj',
      'ET',
      '0 0 0 RG',
      '1.5 w',
      '72 210 m 72 385 l 520 210 l S',
      '0.10 0.62 0.45 rg',
      '105 210 58 130 re f',
      '210 210 58 88 re f',
      '315 210 58 52 re f',
      'BT',
      '/F1 12 Tf',
      '100 190 Td (Parse) Tj',
      '102 0 Td (Index) Tj',
      '104 0 Td (Answer) Tj',
      '-270 205 Td (Latency by Stage) Tj',
      'ET',
      '0 0 0 RG',
      '1 w',
      '75 92 32 18 re S',
      '150 92 32 18 re S',
      '225 92 32 18 re S',
      '107 101 m 150 101 l S',
      '182 101 m 225 101 l S',
      'BT',
      '/F1 12 Tf',
      '72 124 Td (Decision flow) Tj',
      'ET',
      '0.94 0.90 0.70 rg',
      '345 60 210 76 re f',
      '0 0 0 RG',
      '1 w',
      '345 60 210 76 re S',
      '362 78 30 30 re S',
      '405 78 30 30 re S',
      '448 78 30 30 re S',
      '491 78 30 30 re S',
      'BT',
      '/F1 12 Tf',
      '360 124 Td (Dashboard heatmap) Tj',
      'ET',
      'Q',
    ].join('\n'),
  },
];
const VISUAL_PROVIDER_FIXTURES = VISUAL_PROVIDER_FIXTURE_SETS.flatMap((set) => set.fixtures);
const TESSERACT_TSV_QUALITY_METRICS = [
  {
    id: 'ocr_token_recall',
    capability: TESSERACT_TSV_CAPABILITIES[0],
    expected: { fixtures: OCR_PROVIDER_FIXTURES.map(({ id, tokens }) => ({ id, tokens })) },
  },
  {
    id: 'ocr_word_box_coverage',
    capability: TESSERACT_TSV_CAPABILITIES[1],
    expected: { min_word_boxes: EXPECTED_OCR_TOKEN_COUNT },
  },
  {
    id: 'ocr_document_map_fusion',
    capability: TESSERACT_TSV_CAPABILITIES[2],
    expected: {
      layer: 'ocr_text_layer',
      fixture_count: OCR_PROVIDER_FIXTURES.length,
      ocr_applied_page: 1,
      source_render_evidence_id: 'page-1-render-scale-2',
    },
  },
] as const;
const VISUAL_REGION_QUALITY_METRICS = [
  {
    id: 'visual_fixture_coverage',
    capability: VISUAL_REGION_CAPABILITIES[0],
    expected: { fixture_ids: VISUAL_PROVIDER_FIXTURES.map((fixture) => fixture.id) },
  },
  {
    id: 'visual_crop_provenance_coverage',
    capability: VISUAL_REGION_CAPABILITIES[1],
    expected: { source: 'region-analysis-provider', crop_evidence_id_per_result: true },
  },
  {
    id: 'visual_table_cell_box_coverage',
    capability: VISUAL_REGION_CAPABILITIES[2],
    expected: {
      fixture_ids: VISUAL_PROVIDER_FIXTURES.filter((fixture) => fixture.kind === 'table').map(
        (fixture) => fixture.id
      ),
      min_cell_boxes_per_fixture: true,
    },
  },
  {
    id: 'visual_formula_format_coverage',
    capability: VISUAL_REGION_CAPABILITIES[3],
    expected: {
      fixture_ids: VISUAL_PROVIDER_FIXTURES.filter((fixture) => fixture.kind === 'formula').map(
        (fixture) => fixture.id
      ),
      min_formula_formats_per_fixture: true,
    },
  },
  {
    id: 'visual_chart_data_coverage',
    capability: VISUAL_REGION_CAPABILITIES[4],
    expected: {
      fixture_ids: VISUAL_PROVIDER_FIXTURES.filter((fixture) => fixture.kind === 'chart').map(
        (fixture) => fixture.id
      ),
      x_axis: true,
      y_axis: true,
      series_or_points: true,
    },
  },
  {
    id: 'visual_figure_text_coverage',
    capability: VISUAL_REGION_CAPABILITIES[5],
    expected: {
      fixture_ids: VISUAL_PROVIDER_FIXTURES.filter((fixture) => fixture.kind === 'figure').map(
        (fixture) => fixture.id
      ),
      terms_per_fixture: true,
    },
  },
  {
    id: 'visual_image_description_coverage',
    capability: VISUAL_REGION_CAPABILITIES[6],
    expected: {
      fixture_ids: VISUAL_PROVIDER_FIXTURES.filter((fixture) => fixture.kind === 'image').map(
        (fixture) => fixture.id
      ),
      terms_per_fixture: true,
    },
  },
] as const;

const round = (value: number): number => Math.round(value * 100) / 100;

const ratioScore = (numerator: number, denominator: number): number =>
  denominator > 0 ? round(Math.min(1, Math.max(0, numerator / denominator))) : 0;

const buildQualityMetric = ({
  id,
  capability,
  score,
  threshold = 1,
  expected,
  observed,
}: {
  id: string;
  capability: string;
  score: number;
  threshold?: number;
  expected: Record<string, unknown>;
  observed: Record<string, unknown>;
}): ProviderBenchmarkQualityMetric => ({
  id,
  capability,
  status: score >= threshold ? 'passed' : 'failed',
  score: round(score),
  threshold,
  expected,
  observed,
});

const buildSkippedQualityMetric = (
  id: string,
  capability: string,
  expected: Record<string, unknown>
): ProviderBenchmarkQualityMetric => ({
  id,
  capability,
  status: 'skipped',
  expected,
  observed: {},
});

const buildQualitySummary = (
  profile: ProviderBenchmarkQuality['profile'],
  fixtureCount: number,
  metrics: ProviderBenchmarkQualityMetric[]
): ProviderBenchmarkQuality => {
  const scoredMetrics = metrics.filter((metric) => typeof metric.score === 'number');
  return {
    profile,
    fixture_count: fixtureCount,
    metric_count: metrics.length,
    passed_metric_count: metrics.filter((metric) => metric.status === 'passed').length,
    score:
      scoredMetrics.length > 0
        ? round(
            scoredMetrics.reduce((sum, metric) => sum + (metric.score ?? 0), 0) /
              scoredMetrics.length
          )
        : 0,
    metrics,
  };
};

const byteLength = (value: string): number => Buffer.byteLength(value, 'utf8');

const serializePdf = (objects: string[]): string => {
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(byteLength(body));
    body += `${String(index + 1)} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = byteLength(body);
  body += `xref\n0 ${String(objects.length + 1)}\n`;
  body += '0000000000 65535 f \n';
  offsets.forEach((offset) => {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\n`;
  body += `startxref\n${String(xrefOffset)}\n%%EOF\n`;

  return body;
};

const escapePdfText = (text: string): string =>
  text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');

const writeProviderFixture = async (
  directory: string,
  fixture: OcrProviderFixture
): Promise<string> => {
  const contentStream = `BT\n/F1 48 Tf\n60 130 Td\n(${escapePdfText(fixture.tokens.join(' '))}) Tj\nET\n`;
  const pdf = serializePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    [
      '<< /Type /Page',
      '/Parent 2 0 R',
      '/MediaBox [0 0 600 240]',
      '/Resources << /Font << /F1 5 0 R >> >>',
      '/Contents 4 0 R',
      '>>',
    ].join(' '),
    `<< /Length ${String(byteLength(contentStream))} >>\nstream\n${contentStream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]);
  const fixturePath = path.join(directory, fixture.file_name);
  await fs.writeFile(fixturePath, pdf);

  return fixturePath;
};

const writeVisualProviderFixture = async (
  directory: string,
  fixtureSet: VisualProviderFixtureSet
): Promise<string> => {
  const pdf = serializePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    [
      '<< /Type /Page',
      '/Parent 2 0 R',
      '/MediaBox [0 0 640 820]',
      '/Resources << /Font << /F1 5 0 R >> >>',
      '/Contents 4 0 R',
      '>>',
    ].join(' '),
    `<< /Length ${String(byteLength(fixtureSet.content_stream))} >>\nstream\n${fixtureSet.content_stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]);
  const fixturePath = path.join(directory, fixtureSet.file_name);
  await fs.writeFile(fixturePath, pdf);

  return fixturePath;
};

const withEnv = async <T>(
  updates: Record<string, string | undefined>,
  run: () => Promise<T>
): Promise<T> => {
  const previous = Object.fromEntries(
    Object.keys(updates).map((name) => [name, process.env[name]])
  ) as Record<string, string | undefined>;

  for (const [name, value] of Object.entries(updates)) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, name);
    } else {
      process.env[name] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, name);
      } else {
        process.env[name] = value;
      }
    }
  }
};

const readTesseractTsvProviderStatus = async () =>
  withEnv(
    {
      MCP_PDF_OCR_COMMAND: undefined,
      MCP_PDF_OCR_ARGS_JSON: undefined,
      MCP_PDF_OCR_PRESET: 'tesseract-tsv',
    },
    async () => getOcrProviderStatus()
  );

export const contentBlocksFromReadPdfResult = (
  result: Awaited<ReturnType<typeof readPdf.handler>>
): Array<{ type?: string; text?: string }> => {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object' && 'content' in result && Array.isArray(result.content)) {
    return result.content;
  }
  if (result && typeof result === 'object' && 'type' in result) {
    return [result];
  }
  return [];
};

const describeReadPdfResultShape = (result: Awaited<ReturnType<typeof readPdf.handler>>): string => {
  if (Array.isArray(result)) return 'content-array';
  if (result && typeof result === 'object') return Object.keys(result).sort().join(',') || 'object';
  return typeof result;
};

const parseReadPdfResult = async (input: ReadPdfArgs): Promise<Record<string, unknown>> => {
  const result = await readPdf.handler({ input, ctx: {} as unknown });
  if (result && typeof result === 'object' && 'isError' in result && result.isError) {
    const content = contentBlocksFromReadPdfResult(result);
    throw new Error(
      content[0]?.text ??
        `read_pdf returned an error without text content; result shape: ${describeReadPdfResultShape(result)}`
    );
  }

  const textPayload = contentBlocksFromReadPdfResult(result).find((block) => block.type === 'text')
    ?.text;
  if (!textPayload) {
    throw new Error(
      `read_pdf did not return a JSON text payload; result shape: ${describeReadPdfResultShape(result)}`
    );
  }

  return JSON.parse(textPayload) as Record<string, unknown>;
};

const firstResultData = (payload: Record<string, unknown>): Record<string, unknown> => {
  const results = payload.results;
  if (!Array.isArray(results)) throw new Error('read_pdf payload did not include results');

  const first = results[0];
  if (typeof first !== 'object' || first === null) {
    throw new Error('read_pdf payload did not include a first result');
  }

  const firstRecord = first as { data?: unknown; error?: unknown; success?: unknown };
  if (firstRecord.success === false) {
    throw new Error(
      `read_pdf first result failed: ${
        typeof firstRecord.error === 'string' ? firstRecord.error : 'unknown source error'
      }`
    );
  }

  const data = firstRecord.data;
  if (typeof data !== 'object' || data === null) {
    throw new Error('read_pdf first result did not include data');
  }

  return data as Record<string, unknown>;
};

const hasTesseract = async (): Promise<boolean> => {
  try {
    await execFileAsync('tesseract', ['--version'], { timeout: 5_000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
};

const normalizeText = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]+/gu, ' ');

const extractTesseractTsvEvidence = (
  data: Record<string, unknown>,
  fixture: OcrProviderFixture
): TesseractTsvEvidence => {
  const ocrTextLayer = data.ocr_text_layer as OcrTextLayerBenchmarkView | undefined;
  const documentMap = data.document_map as DocumentMapBenchmarkView | undefined;
  const page = ocrTextLayer?.pages?.[0];

  return {
    fixture_id: fixture.id,
    expected_tokens: fixture.tokens,
    ocrTextLayer,
    documentMap,
    page,
    normalizedText: normalizeText(page?.text ?? ''),
  };
};

export const buildTesseractTsvQuality = (
  input: TesseractTsvEvidence | TesseractTsvEvidence[]
): ProviderBenchmarkQuality => {
  const evidence = Array.isArray(input) ? input : [input];
  const matchedTokensByFixture = evidence.map((item) => ({
    fixture_id: item.fixture_id,
    matched_tokens: item.expected_tokens.filter((token) => item.normalizedText.includes(token)),
    expected_tokens: item.expected_tokens,
    normalized_text: item.normalizedText,
  }));
  const matchedTokenCount = matchedTokensByFixture.reduce(
    (sum, fixture) => sum + fixture.matched_tokens.length,
    0
  );
  const expectedTokenCount = evidence.reduce((sum, item) => sum + item.expected_tokens.length, 0);
  const wordsWithBoundingBoxes = evidence.reduce(
    (sum, item) =>
      sum +
      (item.page?.words?.filter((word) => word.bounding_box !== undefined).length ??
        item.ocrTextLayer?.summary?.words_with_bounding_boxes ??
        0),
    0
  );
  const documentMapFusedFixtureIds = evidence
    .filter(
      (item) =>
        item.documentMap?.layers?.includes('ocr_text_layer') === true &&
        item.documentMap.routing?.ocr_applied_pages?.includes(1) === true &&
        item.page?.source_render_evidence_id === 'page-1-render-scale-2'
    )
    .map((item) => item.fixture_id);

  return buildQualitySummary('ocr-text-layer', evidence.length, [
    buildQualityMetric({
      id: TESSERACT_TSV_QUALITY_METRICS[0].id,
      capability: TESSERACT_TSV_QUALITY_METRICS[0].capability,
      score: ratioScore(matchedTokenCount, expectedTokenCount),
      expected: TESSERACT_TSV_QUALITY_METRICS[0].expected,
      observed: {
        matched_token_count: matchedTokenCount,
        expected_token_count: expectedTokenCount,
        fixtures: matchedTokensByFixture,
      },
    }),
    buildQualityMetric({
      id: TESSERACT_TSV_QUALITY_METRICS[1].id,
      capability: TESSERACT_TSV_QUALITY_METRICS[1].capability,
      score: ratioScore(wordsWithBoundingBoxes, expectedTokenCount),
      expected: TESSERACT_TSV_QUALITY_METRICS[1].expected,
      observed: {
        words_with_bounding_boxes: wordsWithBoundingBoxes,
        expected_token_count: expectedTokenCount,
        summary_words_with_bounding_boxes: evidence.map((item) => ({
          fixture_id: item.fixture_id,
          words_with_bounding_boxes: item.ocrTextLayer?.summary?.words_with_bounding_boxes,
        })),
      },
    }),
    buildQualityMetric({
      id: TESSERACT_TSV_QUALITY_METRICS[2].id,
      capability: TESSERACT_TSV_QUALITY_METRICS[2].capability,
      score: ratioScore(documentMapFusedFixtureIds.length, evidence.length),
      expected: TESSERACT_TSV_QUALITY_METRICS[2].expected,
      observed: {
        fused_fixture_ids: documentMapFusedFixtureIds,
        fixtures: evidence.map((item) => ({
          fixture_id: item.fixture_id,
          layers: item.documentMap?.layers ?? [],
          ocr_applied_pages: item.documentMap?.routing?.ocr_applied_pages ?? [],
          source_render_evidence_id: item.page?.source_render_evidence_id,
        })),
      },
    }),
  ]);
};

const evaluateTesseractTsvEvidence = (
  evidence: TesseractTsvEvidence[]
): Array<{ name: string; pass: boolean }> =>
  buildTesseractTsvQuality(evidence).metrics.map((metric) => ({
    name: metric.capability,
    pass: metric.status === 'passed',
  }));

const buildProviderMetrics = (
  evidence: TesseractTsvEvidence[]
): ProviderBenchmarkResult['metrics'] => ({
  fixture_count: evidence.length,
  text_chars: evidence.reduce((sum, item) => sum + (item.ocrTextLayer?.summary?.text_chars ?? 0), 0),
  word_count: evidence.reduce((sum, item) => sum + (item.ocrTextLayer?.summary?.word_count ?? 0), 0),
  words_with_bounding_boxes: evidence.reduce(
    (sum, item) => sum + (item.ocrTextLayer?.summary?.words_with_bounding_boxes ?? 0),
    0
  ),
  average_confidence:
    evidence.length > 0
      ? round(
          evidence.reduce(
            (sum, item) => sum + (item.ocrTextLayer?.summary?.average_confidence ?? 0),
            0
          ) / evidence.length
        )
      : undefined,
});

const countFormulaFormats = (result: PdfRegionAnalysisData): number =>
  [
    result.formula?.latex,
    result.formula?.mathml,
    result.formula?.asciimath,
    result.formula?.text,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0).length;

const includesAllTerms = (value: string | undefined, terms: string[]): string[] => {
  const normalized = normalizeText(value ?? '');
  return terms.filter((term) => normalized.includes(normalizeText(term).trim()));
};

export const buildRegionAnalysisQuality = (
  results: PdfRegionAnalysisData[]
): ProviderBenchmarkQuality => {
  const resultByRegionId = new Map(results.map((result) => [result.region_id, result]));
  const matchedFixtureIds = VISUAL_PROVIDER_FIXTURES.filter((fixture) =>
    results.some((result) => result.region_id === fixture.id)
  ).map((fixture) => fixture.id);
  const cropProvenanceMatches = results.filter(
    (result) =>
      result.source_crop_evidence_id ===
        `page-1-${result.region_id}-crop-scale-${String(result.scale)}` &&
      result.provenance.source === 'region-analysis-provider' &&
      result.source_bounding_box.left > 0
  );
  const tableFixtureObservations = VISUAL_PROVIDER_FIXTURES.filter(
    (fixture) => fixture.kind === 'table'
  ).map((fixture) => {
    const result = resultByRegionId.get(fixture.id);
    const cellBoxes =
      result?.table?.cells?.filter((cell) => cell.bounding_box !== undefined).length ?? 0;
    const minCellBoxes = fixture.expected.min_cell_boxes ?? 1;
    return {
      fixture_id: fixture.id,
      kind: result?.kind,
      row_count: result?.table?.row_count,
      column_count: result?.table?.column_count,
      cell_boxes: cellBoxes,
      min_cell_boxes: minCellBoxes,
      passed: cellBoxes >= minCellBoxes,
    };
  });
  const formulaFixtureObservations = VISUAL_PROVIDER_FIXTURES.filter(
    (fixture) => fixture.kind === 'formula'
  ).map((fixture) => {
    const result = resultByRegionId.get(fixture.id);
    const formulaFormats = result ? countFormulaFormats(result) : 0;
    const minFormulaFormats = fixture.expected.min_formula_formats ?? 1;
    return {
      fixture_id: fixture.id,
      kind: result?.kind,
      formula_formats: formulaFormats,
      min_formula_formats: minFormulaFormats,
      passed: formulaFormats >= minFormulaFormats,
    };
  });
  const chartFixtureObservations = VISUAL_PROVIDER_FIXTURES.filter(
    (fixture) => fixture.kind === 'chart'
  ).map((fixture) => {
    const result = resultByRegionId.get(fixture.id);
    const components = [
      result?.chart?.x_axis !== undefined,
      result?.chart?.y_axis !== undefined,
      (result?.chart?.series?.length ?? 0) > 0 || (result?.chart?.data_points?.length ?? 0) >= 3,
    ].filter(Boolean).length;
    const requiredComponents = fixture.expected.chart_components ?? 3;
    return {
      fixture_id: fixture.id,
      kind: result?.kind,
      components,
      required_components: requiredComponents,
      x_axis: result?.chart?.x_axis !== undefined,
      y_axis: result?.chart?.y_axis !== undefined,
      series_count: result?.chart?.series?.length ?? 0,
      data_point_count: result?.chart?.data_points?.length ?? 0,
      passed: components >= requiredComponents,
    };
  });
  const figureFixtureObservations = VISUAL_PROVIDER_FIXTURES.filter(
    (fixture) => fixture.kind === 'figure'
  ).map((fixture) => {
    const result = resultByRegionId.get(fixture.id);
    const terms = fixture.expected.terms ?? [];
    const matchedTerms = includesAllTerms(
      `${result?.description ?? ''} ${result?.text ?? ''}`,
      terms
    );
    return {
      fixture_id: fixture.id,
      kind: result?.kind,
      terms,
      matched_terms: matchedTerms,
      passed: matchedTerms.length >= terms.length,
    };
  });
  const imageFixtureObservations = VISUAL_PROVIDER_FIXTURES.filter(
    (fixture) => fixture.kind === 'image'
  ).map((fixture) => {
    const result = resultByRegionId.get(fixture.id);
    const terms = fixture.expected.terms ?? [];
    const matchedTerms = includesAllTerms(
      `${result?.description ?? ''} ${result?.text ?? ''}`,
      terms
    );
    return {
      fixture_id: fixture.id,
      kind: result?.kind,
      terms,
      matched_terms: matchedTerms,
      passed: matchedTerms.length >= terms.length,
    };
  });

  return buildQualitySummary('visual-full-fidelity', VISUAL_PROVIDER_FIXTURES.length, [
    buildQualityMetric({
      id: VISUAL_REGION_QUALITY_METRICS[0].id,
      capability: VISUAL_REGION_QUALITY_METRICS[0].capability,
      score: ratioScore(matchedFixtureIds.length, VISUAL_PROVIDER_FIXTURES.length),
      expected: VISUAL_REGION_QUALITY_METRICS[0].expected,
      observed: { matched_fixture_ids: matchedFixtureIds },
    }),
    buildQualityMetric({
      id: VISUAL_REGION_QUALITY_METRICS[1].id,
      capability: VISUAL_REGION_QUALITY_METRICS[1].capability,
      score: ratioScore(cropProvenanceMatches.length, Math.max(1, results.length)),
      expected: VISUAL_REGION_QUALITY_METRICS[1].expected,
      observed: {
        analyzed_regions: results.length,
        provenance_matches: cropProvenanceMatches.length,
      },
    }),
    buildQualityMetric({
      id: VISUAL_REGION_QUALITY_METRICS[2].id,
      capability: VISUAL_REGION_QUALITY_METRICS[2].capability,
      score: ratioScore(
        tableFixtureObservations.filter((observation) => observation.passed).length,
        tableFixtureObservations.length
      ),
      expected: VISUAL_REGION_QUALITY_METRICS[2].expected,
      observed: { fixtures: tableFixtureObservations },
    }),
    buildQualityMetric({
      id: VISUAL_REGION_QUALITY_METRICS[3].id,
      capability: VISUAL_REGION_QUALITY_METRICS[3].capability,
      score: ratioScore(
        formulaFixtureObservations.filter((observation) => observation.passed).length,
        formulaFixtureObservations.length
      ),
      expected: VISUAL_REGION_QUALITY_METRICS[3].expected,
      observed: { fixtures: formulaFixtureObservations },
    }),
    buildQualityMetric({
      id: VISUAL_REGION_QUALITY_METRICS[4].id,
      capability: VISUAL_REGION_QUALITY_METRICS[4].capability,
      score: ratioScore(
        chartFixtureObservations.filter((observation) => observation.passed).length,
        chartFixtureObservations.length
      ),
      expected: VISUAL_REGION_QUALITY_METRICS[4].expected,
      observed: { fixtures: chartFixtureObservations },
    }),
    buildQualityMetric({
      id: VISUAL_REGION_QUALITY_METRICS[5].id,
      capability: VISUAL_REGION_QUALITY_METRICS[5].capability,
      score: ratioScore(
        figureFixtureObservations.filter((observation) => observation.passed).length,
        figureFixtureObservations.length
      ),
      expected: VISUAL_REGION_QUALITY_METRICS[5].expected,
      observed: { fixtures: figureFixtureObservations },
    }),
    buildQualityMetric({
      id: VISUAL_REGION_QUALITY_METRICS[6].id,
      capability: VISUAL_REGION_QUALITY_METRICS[6].capability,
      score: ratioScore(
        imageFixtureObservations.filter((observation) => observation.passed).length,
        imageFixtureObservations.length
      ),
      expected: VISUAL_REGION_QUALITY_METRICS[6].expected,
      observed: { fixtures: imageFixtureObservations },
    }),
  ]);
};

const evaluateRegionAnalysisEvidence = (
  results: PdfRegionAnalysisData[]
): Array<{ name: string; pass: boolean }> =>
  buildRegionAnalysisQuality(results).metrics.map((metric) => ({
    name: metric.capability,
    pass: metric.status === 'passed',
  }));

const buildRegionAnalysisMetrics = (
  results: PdfRegionAnalysisData[]
): ProviderBenchmarkResult['metrics'] => ({
  adapter: results[0]?.provider,
  fixture_count: VISUAL_PROVIDER_FIXTURES.length,
  region_count: results.length,
  kind: results.map((result) => result.kind).join(','),
  confidence:
    results.length > 0
      ? round(
          results.reduce((sum, result) => sum + (result.confidence ?? 0), 0) / results.length
        )
      : undefined,
  table_cells: results.reduce((sum, result) => sum + (result.table?.cells?.length ?? 0), 0),
  table_rows: results.reduce((sum, result) => sum + (result.table?.row_count ?? 0), 0),
  chart_series: results.reduce((sum, result) => sum + (result.chart?.series?.length ?? 0), 0),
  formula_formats: results.reduce((sum, result) => sum + countFormulaFormats(result), 0),
  figure_count: results.filter((result) => result.kind === 'figure').length,
  image_description_count: results.filter(
    (result) =>
      result.kind === 'image' &&
      ((result.description?.trim().length ?? 0) > 0 || (result.text?.trim().length ?? 0) > 0)
  ).length,
});

const buildCertificationSummary = (
  profile: NonNullable<ProviderBenchmarkResult['certification']>['profile'],
  fixtureCount: number,
  assertions: Array<{ name: string; pass: boolean }>
): NonNullable<ProviderBenchmarkResult['certification']> => {
  const capabilities = Object.fromEntries(
    assertions.map((assertion) => [assertion.name, assertion.pass ? 'passed' : 'failed'])
  ) as Record<string, 'passed' | 'failed' | 'skipped'>;

  return {
    profile,
    fixture_count: fixtureCount,
    capability_count: assertions.length,
    passed_capability_count: assertions.filter((assertion) => assertion.pass).length,
    capabilities,
  };
};

const buildSkippedCertificationSummary = (
  profile: NonNullable<ProviderBenchmarkResult['certification']>['profile'],
  fixtureCount: number,
  capabilityNames: readonly string[]
): NonNullable<ProviderBenchmarkResult['certification']> => ({
  profile,
  fixture_count: fixtureCount,
  capability_count: capabilityNames.length,
  passed_capability_count: 0,
  capabilities: Object.fromEntries(
    capabilityNames.map((name) => [name, 'skipped'])
  ) as Record<string, 'passed' | 'failed' | 'skipped'>,
});

const buildSkippedQualitySummary = (
  profile: ProviderBenchmarkQuality['profile'],
  fixtureCount: number,
  metrics: Array<{ id: string; capability: string; expected: Record<string, unknown> }>
): ProviderBenchmarkQuality =>
  buildQualitySummary(
    profile,
    fixtureCount,
    metrics.map((metric) => buildSkippedQualityMetric(metric.id, metric.capability, metric.expected))
  );

const buildFinalBarProviderEvidence = (
  results: ProviderBenchmarkResult[]
): FinalBarProviderEvidenceResult[] => {
  const certifications = new Map<
    NonNullable<ProviderBenchmarkResult['certification']>['profile'],
    NonNullable<ProviderBenchmarkResult['certification']>
  >();
  const providerResultsByProfile = new Map<
    NonNullable<ProviderBenchmarkResult['certification']>['profile'],
    ProviderBenchmarkResult
  >();
  for (const result of results) {
    providerResultsByProfile.set(PROVIDER_CERTIFICATION_PROFILES[result.provider], result);
    if (result.certification) {
      certifications.set(result.certification.profile, result.certification);
    }
  }

  return FINAL_BAR_PROVIDER_EVIDENCE_REQUIREMENTS.map((requirement) => {
    const missingProfiles = requirement.required_profiles.filter(
      (profile) =>
        !certifications.has(profile) && providerResultsByProfile.get(profile)?.status !== 'failed'
    );
    const failedProfiles = requirement.required_profiles.filter(
      (profile) => providerResultsByProfile.get(profile)?.status === 'failed'
    );
    const missingCapabilities: string[] = [];
    const skippedCapabilities: string[] = [];
    const failedCapabilities: string[] = [];

    for (const capability of requirement.required_capabilities) {
      const capabilityStatus = requirement.required_profiles
        .map((profile) => certifications.get(profile)?.capabilities[capability])
        .find((status) => status !== undefined);

      if (capabilityStatus === undefined) {
        missingCapabilities.push(capability);
      } else if (capabilityStatus === 'skipped') {
        skippedCapabilities.push(capability);
      } else if (capabilityStatus === 'failed') {
        failedCapabilities.push(capability);
      }
    }

    const status: FinalBarProviderEvidenceStatus =
      failedProfiles.length > 0 || failedCapabilities.length > 0
        ? 'failed'
        : missingProfiles.length > 0 || missingCapabilities.length > 0
        ? 'incomplete'
        : skippedCapabilities.length > 0
          ? 'provider_benchmark_required'
          : 'certified';

    return {
      ...requirement,
      status,
      missing_profiles: missingProfiles,
      failed_profiles: failedProfiles,
      missing_capabilities: missingCapabilities,
      skipped_capabilities: skippedCapabilities,
      failed_capabilities: failedCapabilities,
    };
  });
};

const summarizeFinalBarProviderEvidence = (
  coverage: FinalBarProviderEvidenceResult[]
): FinalBarProviderEvidenceSummary => ({
  total: coverage.length,
  certified: coverage.filter((entry) => entry.status === 'certified').length,
  provider_benchmark_required: coverage.filter(
    (entry) => entry.status === 'provider_benchmark_required'
  ).length,
  failed: coverage.filter((entry) => entry.status === 'failed').length,
  incomplete: coverage.filter((entry) => entry.status === 'incomplete').length,
});

const runTesseractTsvBenchmark = async (): Promise<ProviderBenchmarkResult> => {
  const start = performance.now();
  const providerStatus = await readTesseractTsvProviderStatus();
  if (!(await hasTesseract())) {
    return {
      provider: 'tesseract-tsv',
      status: 'skipped',
      duration_ms: round(performance.now() - start),
      message: 'tesseract executable was not found on PATH.',
      provider_status: {
        ocr_pages: providerStatus,
      },
      certification: buildSkippedCertificationSummary(
        'ocr-text-layer',
        OCR_PROVIDER_FIXTURES.length,
        TESSERACT_TSV_CAPABILITIES
      ),
      quality: buildSkippedQualitySummary(
        'ocr-text-layer',
        OCR_PROVIDER_FIXTURES.length,
        TESSERACT_TSV_QUALITY_METRICS
      ),
    };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-reader-mcp-provider-'));

  try {
    const evidence = await withEnv(
      {
        MCP_PDF_OCR_COMMAND: undefined,
        MCP_PDF_OCR_ARGS_JSON: undefined,
        MCP_PDF_OCR_PRESET: 'tesseract-tsv',
      },
      async () => {
        const fixtureEvidence: TesseractTsvEvidence[] = [];
        for (const fixture of OCR_PROVIDER_FIXTURES) {
          const fixturePath = await writeProviderFixture(tempDir, fixture);
          const payload = await parseReadPdfResult({
            sources: [{ path: fixturePath, pages: [1] }],
            include_full_text: false,
            include_ocr_text_layer: true,
            include_document_map: true,
            include_layout_diagnostics: true,
            include_page_geometry: true,
          });
          const data = firstResultData(payload);
          fixtureEvidence.push(extractTesseractTsvEvidence(data, fixture));
        }
        return fixtureEvidence;
      }
    );
    const assertions = evaluateTesseractTsvEvidence(evidence);
    const quality = buildTesseractTsvQuality(evidence);

    return {
      provider: 'tesseract-tsv',
      status: assertions.every((assertion) => assertion.pass) ? 'passed' : 'failed',
      duration_ms: round(performance.now() - start),
      assertions,
      provider_status: {
        ocr_pages: providerStatus,
      },
      metrics: buildProviderMetrics(evidence),
      certification: buildCertificationSummary(
        'ocr-text-layer',
        OCR_PROVIDER_FIXTURES.length,
        assertions
      ),
      quality,
    };
  } catch (error: unknown) {
    return {
      provider: 'tesseract-tsv',
      status: 'failed',
      duration_ms: round(performance.now() - start),
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

const runRegionAnalysisProviderBenchmark = async (): Promise<ProviderBenchmarkResult> => {
  const start = performance.now();
  const status = getRegionAnalysisProviderStatus();

  if (status.readiness === 'not_configured') {
    return {
      provider: 'region-analysis',
      status: 'skipped',
      duration_ms: round(performance.now() - start),
      message:
        'Set MCP_PDF_REGION_ANALYSIS_COMMAND, MCP_PDF_REGION_ANALYSIS_HTTP_URL, or MCP_PDF_REGION_ANALYSIS_PRESET=ollama/openai-compatible to benchmark a configured visual-region provider.',
      provider_status: {
        analyze_regions: status,
      },
      certification: buildSkippedCertificationSummary(
        'visual-full-fidelity',
        VISUAL_PROVIDER_FIXTURES.length,
        VISUAL_REGION_CAPABILITIES
      ),
      quality: buildSkippedQualitySummary(
        'visual-full-fidelity',
        VISUAL_PROVIDER_FIXTURES.length,
        VISUAL_REGION_QUALITY_METRICS
      ),
    };
  }

  if (status.readiness === 'invalid_configuration') {
    return {
      provider: 'region-analysis',
      status: 'failed',
      duration_ms: round(performance.now() - start),
      message: status.warnings?.join('; ') ?? 'Region analysis provider configuration is invalid.',
      provider_status: {
        analyze_regions: status,
      },
    };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-reader-mcp-visual-provider-'));

  try {
    const analyses: PdfRegionAnalysisData[] = [];
    for (const fixtureSet of VISUAL_PROVIDER_FIXTURE_SETS) {
      const fixturePath = await writeVisualProviderFixture(tempDir, fixtureSet);
      const analyzed = await analyzePdfRegionsFromSource(
        {
          path: fixturePath,
          regions: fixtureSet.fixtures.map((fixture) => fixture.region),
        },
        {
          ...defaultAnalyzeRegionsOptions(),
          max_regions: fixtureSet.fixtures.length,
          languages: ['eng'],
        }
      );
      analyses.push(...analyzed.analyses);
    }
    const assertions = evaluateRegionAnalysisEvidence(analyses);
    const quality = buildRegionAnalysisQuality(analyses);
    return {
      provider: 'region-analysis',
      status: assertions.every((assertion) => assertion.pass) ? 'passed' : 'failed',
      duration_ms: round(performance.now() - start),
      assertions,
      provider_status: {
        analyze_regions: status,
      },
      metrics: buildRegionAnalysisMetrics(analyses),
      certification: buildCertificationSummary(
        'visual-full-fidelity',
        VISUAL_PROVIDER_FIXTURES.length,
        assertions
      ),
      quality,
    };
  } catch (error: unknown) {
    return {
      provider: 'region-analysis',
      status: 'failed',
      duration_ms: round(performance.now() - start),
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

export const main = async () => {
  const results = [await runTesseractTsvBenchmark(), await runRegionAnalysisProviderBenchmark()];
  const finalBarProviderEvidence = buildFinalBarProviderEvidence(results);
  const report: ProviderBenchmarkReport = {
    profile: 'pdf_provider_benchmark',
    generated_at: new Date().toISOString(),
    fixture_scope:
      'runtime-generated local PDFs rendered through read_pdf OCR fusion and visual-region crop analysis with optional installed providers',
    strict: process.env[STRICT_PROVIDER_BENCHMARK_ENV] === 'true',
    certification_profiles: ['ocr-text-layer', 'visual-full-fidelity'],
    results,
    final_bar_provider_evidence_summary:
      summarizeFinalBarProviderEvidence(finalBarProviderEvidence),
    final_bar_provider_evidence: finalBarProviderEvidence,
  };

  console.table(
    results.map((result) => ({
      provider: result.provider,
      status: result.status,
      duration_ms: result.duration_ms,
      fixtures: result.certification?.fixture_count ?? result.metrics?.fixture_count ?? '-',
      regions: result.metrics?.region_count ?? '-',
      text_chars: result.metrics?.text_chars ?? '-',
      word_count: result.metrics?.word_count ?? '-',
      word_boxes: result.metrics?.words_with_bounding_boxes ?? '-',
      adapter: result.metrics?.adapter ?? '-',
      kind: result.metrics?.kind ?? '-',
      table_cells: result.metrics?.table_cells ?? '-',
      chart_series: result.metrics?.chart_series ?? '-',
      formula_formats: result.metrics?.formula_formats ?? '-',
      figures: result.metrics?.figure_count ?? '-',
      image_descriptions: result.metrics?.image_description_count ?? '-',
      quality_score: result.quality ? `${String(result.quality.score)}` : '-',
      passed_capabilities: result.certification
        ? `${String(result.certification.passed_capability_count)}/${String(result.certification.capability_count)}`
        : '-',
    }))
  );
  console.log(JSON.stringify(report, null, 2));
  const outputPath = await writeBenchmarkReport(report);
  if (outputPath) {
    console.error(`Benchmark report written to ${outputPath}`);
  }

  const failed = results.some((result) => result.status === 'failed');
  const skipped = results.some((result) => result.status === 'skipped');
  if (failed || (report.strict && skipped)) {
    process.exitCode = 1;
  }
};

if (import.meta.main) {
  await main();
}
