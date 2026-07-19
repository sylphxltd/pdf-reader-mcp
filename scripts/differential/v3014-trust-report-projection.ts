export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const TRUST_KEYS = ['version', 'profile', 'risk', 'score', 'summary', 'page_reports', 'signals', 'guidance'] as const;
const SUMMARY_KEYS = [
  'selected_pages', 'redaction_policy', 'signal_count', 'high_signal_count',
  'medium_signal_count', 'low_signal_count', 'signal_type_counts',
  'safety_finding_type_counts', 'page_count', 'pages_with_signals',
  'high_risk_page_count', 'medium_risk_page_count', 'low_risk_page_count',
] as const;
const PAGE_REPORT_KEYS = ['page', 'risk', 'score', 'signals'] as const;
const SIGNAL_KEYS = [
  'type', 'severity', 'page', 'message', 'element_id', 'annotation_id', 'table_id', 'evidence',
] as const;
const EVIDENCE_KEYS = [
  'finding_type', 'redaction_policy', 'bounding_box', 'snippet', 'snippet_redacted',
  'redaction_types', 'profile', 'reading_order', 'confidence', 'signals', 'warnings',
  'text_item_count', 'image_item_count', 'positioned_item_ratio', 'row_count',
  'col_count', 'completeness', 'subtype', 'url',
] as const;

export const TRUST_REPORT_DEPENDENCY_SURFACES = [
  'safety_findings', 'layout_diagnostics', 'elements', 'tables', 'annotations',
  'document_map', 'chunks', 'text_layer', 'page_geometry', 'document_ast',
  'visual_enrichments', 'ocr_text_layer', 'accessibility_report', '_internal', 'internal',
] as const;

const record = (value: unknown, context: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
};
const array = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value;
};
const exactKeys = (value: Record<string, unknown>, allowed: readonly string[], context: string): void => {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) throw new Error(`${context} has unexpected keys: ${unexpected.join(',')}`);
};
const required = (value: Record<string, unknown>, key: string, context: string): unknown => {
  if (!Object.hasOwn(value, key)) throw new Error(`${context}.${key} is required`);
  return value[key];
};
const string = (value: unknown, context: string): string => {
  if (typeof value !== 'string') throw new Error(`${context} must be a string`);
  return value;
};
const number = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${context} must be a finite number`);
  return Math.round(value * 1e9) / 1e9;
};
const boolean = (value: unknown, context: string): boolean => {
  if (typeof value !== 'boolean') throw new Error(`${context} must be a boolean`);
  return value;
};
const strings = (value: unknown, context: string): string[] =>
  array(value, context).map((entry, index) => string(entry, `${context}[${index}]`));
const numbers = (value: unknown, context: string): number[] =>
  array(value, context).map((entry, index) => number(entry, `${context}[${index}]`));
const json = (value: unknown, context: string): Json => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return number(value, context);
  if (Array.isArray(value)) return value.map((entry, index) => json(entry, `${context}[${index}]`));
  const source = record(value, context);
  return Object.fromEntries(Object.entries(source).map(([key, entry]) => [key, json(entry, `${context}.${key}`)]));
};
const risk = (value: unknown, context: string): string => {
  const output = string(value, context);
  if (!['low', 'medium', 'high'].includes(output)) throw new Error(`${context} must be a trust risk`);
  return output;
};
const boundingBox = (value: unknown, context: string): Json => {
  const source = record(value, context);
  exactKeys(source, ['left', 'bottom', 'right', 'top'], context);
  return Object.fromEntries(['left', 'bottom', 'right', 'top'].map((key) => [
    key, number(required(source, key, context), `${context}.${key}`),
  ]));
};
const numberMap = (value: unknown, context: string): Json => {
  const source = record(value, context);
  return Object.fromEntries(Object.entries(source).map(([key, entry]) => [key, number(entry, `${context}.${key}`)]));
};

const signalProjection = (value: unknown, context: string): Json => {
  const source = record(value, context);
  exactKeys(source, SIGNAL_KEYS, context);
  const output: Record<string, Json> = {
    type: string(required(source, 'type', context), `${context}.type`),
    severity: risk(required(source, 'severity', context), `${context}.severity`),
    message: string(required(source, 'message', context), `${context}.message`),
  };
  if (Object.hasOwn(source, 'page')) output.page = number(source.page, `${context}.page`);
  for (const key of ['element_id', 'annotation_id', 'table_id'] as const) {
    if (Object.hasOwn(source, key)) output[key] = string(source[key], `${context}.${key}`);
  }
  if (Object.hasOwn(source, 'evidence')) {
    const evidence = record(source.evidence, `${context}.evidence`);
    exactKeys(evidence, EVIDENCE_KEYS, `${context}.evidence`);
    const projected: Record<string, Json> = {};
    for (const [key, entry] of Object.entries(evidence)) {
      if (key === 'bounding_box') projected[key] = boundingBox(entry, `${context}.evidence.bounding_box`);
      else if (['redaction_types', 'signals', 'warnings'].includes(key)) projected[key] = strings(entry, `${context}.evidence.${key}`);
      else if (['confidence', 'text_item_count', 'image_item_count', 'positioned_item_ratio', 'row_count', 'col_count', 'completeness'].includes(key)) projected[key] = number(entry, `${context}.evidence.${key}`);
      else if (key === 'snippet_redacted') projected[key] = boolean(entry, `${context}.evidence.${key}`);
      else projected[key] = string(entry, `${context}.evidence.${key}`);
    }
    output.evidence = projected;
  }
  return output;
};

const trustProjection = (value: unknown): Json => {
  const source = record(value, 'trust_report');
  exactKeys(source, TRUST_KEYS, 'trust_report');
  const summary = record(required(source, 'summary', 'trust_report'), 'trust_report.summary');
  exactKeys(summary, SUMMARY_KEYS, 'trust_report.summary');
  const summaryOutput: Record<string, Json> = {};
  for (const key of SUMMARY_KEYS) {
    const entry = required(summary, key, 'trust_report.summary');
    if (key === 'selected_pages') summaryOutput[key] = numbers(entry, `trust_report.summary.${key}`);
    else if (key === 'redaction_policy') summaryOutput[key] = string(entry, `trust_report.summary.${key}`);
    else if (key.endsWith('_type_counts')) summaryOutput[key] = numberMap(entry, `trust_report.summary.${key}`);
    else summaryOutput[key] = number(entry, `trust_report.summary.${key}`);
  }
  const pageReports = array(required(source, 'page_reports', 'trust_report'), 'trust_report.page_reports')
    .map((entry, index) => {
      const page = record(entry, `trust_report.page_reports[${index}]`);
      exactKeys(page, PAGE_REPORT_KEYS, `trust_report.page_reports[${index}]`);
      return {
        page: number(required(page, 'page', `trust_report.page_reports[${index}]`), `trust_report.page_reports[${index}].page`),
        risk: risk(required(page, 'risk', `trust_report.page_reports[${index}]`), `trust_report.page_reports[${index}].risk`),
        score: number(required(page, 'score', `trust_report.page_reports[${index}]`), `trust_report.page_reports[${index}].score`),
        signals: array(required(page, 'signals', `trust_report.page_reports[${index}]`), `trust_report.page_reports[${index}].signals`)
          .map((signal, signalIndex) => signalProjection(signal, `trust_report.page_reports[${index}].signals[${signalIndex}]`)),
      };
    });
  return {
    version: string(required(source, 'version', 'trust_report'), 'trust_report.version'),
    profile: string(required(source, 'profile', 'trust_report'), 'trust_report.profile'),
    risk: risk(required(source, 'risk', 'trust_report'), 'trust_report.risk'),
    score: number(required(source, 'score', 'trust_report'), 'trust_report.score'),
    summary: summaryOutput,
    page_reports: pageReports,
    signals: array(required(source, 'signals', 'trust_report'), 'trust_report.signals')
      .map((entry, index) => signalProjection(entry, `trust_report.signals[${index}]`)),
    guidance: strings(required(source, 'guidance', 'trust_report'), 'trust_report.guidance'),
  };
};

const documentMapTrustProjection = (value: unknown): Json => {
  const map = record(value, 'document_map');
  const pages = array(required(map, 'pages', 'document_map'), 'document_map.pages').map((entry, index) => {
    const page = record(entry, `document_map.pages[${index}]`);
    return {
      page: number(required(page, 'page', `document_map.pages[${index}]`), `document_map.pages[${index}].page`),
      trust_report_page_index: number(required(page, 'trust_report_page_index', `document_map.pages[${index}]`), `document_map.pages[${index}].trust_report_page_index`),
      trust_signal_indexes: numbers(required(page, 'trust_signal_indexes', `document_map.pages[${index}]`), `document_map.pages[${index}].trust_signal_indexes`),
      trust_high_signal_indexes: numbers(required(page, 'trust_high_signal_indexes', `document_map.pages[${index}]`), `document_map.pages[${index}].trust_high_signal_indexes`),
      trust_medium_signal_indexes: numbers(required(page, 'trust_medium_signal_indexes', `document_map.pages[${index}]`), `document_map.pages[${index}].trust_medium_signal_indexes`),
      trust_low_signal_indexes: numbers(required(page, 'trust_low_signal_indexes', `document_map.pages[${index}]`), `document_map.pages[${index}].trust_low_signal_indexes`),
      trust_risk: risk(required(page, 'trust_risk', `document_map.pages[${index}]`), `document_map.pages[${index}].trust_risk`),
      trust_score: number(required(page, 'trust_score', `document_map.pages[${index}]`), `document_map.pages[${index}].trust_score`),
      trust_signal_count: number(required(page, 'trust_signal_count', `document_map.pages[${index}]`), `document_map.pages[${index}].trust_signal_count`),
      trust_high_signal_count: number(required(page, 'trust_high_signal_count', `document_map.pages[${index}]`), `document_map.pages[${index}].trust_high_signal_count`),
      trust_medium_signal_count: number(required(page, 'trust_medium_signal_count', `document_map.pages[${index}]`), `document_map.pages[${index}].trust_medium_signal_count`),
      trust_low_signal_count: number(required(page, 'trust_low_signal_count', `document_map.pages[${index}]`), `document_map.pages[${index}].trust_low_signal_count`),
    };
  });
  const routing = record(required(map, 'routing', 'document_map'), 'document_map.routing');
  const summary = record(required(map, 'summary', 'document_map'), 'document_map.summary');
  return {
    layers: strings(required(map, 'layers', 'document_map'), 'document_map.layers'),
    pages,
    routing: {
      trust_review_pages: numbers(required(routing, 'trust_review_pages', 'document_map.routing'), 'document_map.routing.trust_review_pages'),
      trust_high_signal_pages: numbers(required(routing, 'trust_high_signal_pages', 'document_map.routing'), 'document_map.routing.trust_high_signal_pages'),
      trust_high_risk_pages: numbers(required(routing, 'trust_high_risk_pages', 'document_map.routing'), 'document_map.routing.trust_high_risk_pages'),
      trust_medium_risk_pages: numbers(required(routing, 'trust_medium_risk_pages', 'document_map.routing'), 'document_map.routing.trust_medium_risk_pages'),
    },
    summary: {
      trust_report_page_count: number(required(summary, 'trust_report_page_count', 'document_map.summary'), 'document_map.summary.trust_report_page_count'),
      trust_risk: risk(required(summary, 'trust_risk', 'document_map.summary'), 'document_map.summary.trust_risk'),
      trust_score: number(required(summary, 'trust_score', 'document_map.summary'), 'document_map.summary.trust_score'),
      trust_signal_count: number(required(summary, 'trust_signal_count', 'document_map.summary'), 'document_map.summary.trust_signal_count'),
      trust_high_signal_count: number(required(summary, 'trust_high_signal_count', 'document_map.summary'), 'document_map.summary.trust_high_signal_count'),
      trust_medium_signal_count: number(required(summary, 'trust_medium_signal_count', 'document_map.summary'), 'document_map.summary.trust_medium_signal_count'),
      trust_low_signal_count: number(required(summary, 'trust_low_signal_count', 'document_map.summary'), 'document_map.summary.trust_low_signal_count'),
      trust_pages_with_signals: number(required(summary, 'trust_pages_with_signals', 'document_map.summary'), 'document_map.summary.trust_pages_with_signals'),
      trust_high_risk_page_count: number(required(summary, 'trust_high_risk_page_count', 'document_map.summary'), 'document_map.summary.trust_high_risk_page_count'),
      trust_medium_risk_page_count: number(required(summary, 'trust_medium_risk_page_count', 'document_map.summary'), 'document_map.summary.trust_medium_risk_page_count'),
      trust_signal_type_counts: numberMap(required(summary, 'trust_signal_type_counts', 'document_map.summary'), 'document_map.summary.trust_signal_type_counts'),
    },
  };
};

export const canonicalTrustReportResult = (value: unknown): Json => {
  const data = record(value, 'result.data');
  const dependencySurfaces = Object.fromEntries(
    TRUST_REPORT_DEPENDENCY_SURFACES.map((key) => [key, Object.hasOwn(data, key)])
  );
  const exposedDependencies = Object.fromEntries(
    TRUST_REPORT_DEPENDENCY_SURFACES.filter((key) => Object.hasOwn(data, key)).map((key) => [
      key,
      key === 'document_map'
        ? '<trust-routing-projected-separately>'
        : json(data[key], `result.data.${key}`),
    ])
  );
  return {
    top_level_warnings: Object.hasOwn(data, 'warnings') ? strings(data.warnings, 'result.data.warnings') : null,
    dependency_surfaces: dependencySurfaces,
    exposed_dependencies: exposedDependencies,
    trust_report: trustProjection(required(data, 'trust_report', 'result.data')),
    document_map_trust: Object.hasOwn(data, 'document_map') ? documentMapTrustProjection(data.document_map) : null,
  };
};

export const TRUST_REPORT_MUTATION_MANIFEST = {
  version: 1,
  wrongPrimitiveTypes: [
    'trust_report.version', 'trust_report.score', 'trust_report.summary.selected_pages[0]',
    'trust_report.summary.signal_count', 'trust_report.page_reports[0].page',
    'trust_report.signals[0].severity',
    'document_map.pages[0].trust_high_signal_indexes[0]',
    'document_map.pages[0].trust_medium_signal_indexes',
    'document_map.pages[0].trust_low_signal_indexes[0]',
    'document_map.pages[0].trust_high_signal_count',
    'document_map.pages[0].trust_medium_signal_count',
    'document_map.pages[0].trust_low_signal_count',
  ],
  unexpectedFields: [
    'trust_report', 'trust_report.summary', 'trust_report.page_reports[0]',
    'trust_report.signals[0]', 'trust_report.signals[0].evidence',
  ],
  requiredOmissions: [
    'trust_report.version', 'trust_report.summary', 'trust_report.summary.signal_count',
    'trust_report.page_reports', 'trust_report.signals', 'trust_report.guidance',
    'document_map.pages[0].trust_high_signal_indexes',
    'document_map.pages[0].trust_medium_signal_indexes',
    'document_map.pages[0].trust_low_signal_indexes',
    'document_map.pages[0].trust_high_signal_count',
    'document_map.pages[0].trust_medium_signal_count',
    'document_map.pages[0].trust_low_signal_count',
  ],
  privateLeakage: ['document_ast', 'visual_enrichments', 'ocr_text_layer', '_internal', 'internal'],
  dependencyPresence: [...TRUST_REPORT_DEPENDENCY_SURFACES],
} as const;
