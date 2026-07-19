export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export const VISUAL_CANDIDATE_MUTATION_MANIFEST = {
  version: 1,
  wrongPrimitiveTypes: ['candidate.page', 'candidate.target_element_type', 'candidate.region.bounding_box.left', 'document_map.pages[0].visual_candidate_count'],
  unexpectedFields: ['candidate', 'candidate.region'],
  requiredOmissions: ['candidate.id', 'candidate.region.bounding_box', 'document_map.pages[0].visual_candidate_count', 'document_map.summary.visual_enrichment_candidate_count'],
  publicOmissions: ['provider-not-configured.visual_enrichments', 'internal-elements-hidden.elements', 'false-control.visual_enrichment_candidates'],
  privateLeakage: ['_internal', 'internal'],
  dependencyPresence: ['elements', 'tables', 'page_geometry', 'document_map', 'visual_enrichment_candidates', 'visual_enrichments'],
} as const;

const record = (value: unknown, context: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
};
const array = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value;
};
const string = (value: unknown, context: string): string => {
  if (typeof value !== 'string') throw new Error(`${context} must be a string`);
  return value;
};
const number = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${context} must be finite`);
  return Math.round(value * 1_000_000) / 1_000_000;
};
const integer = (value: unknown, context: string): number => {
  const result = number(value, context);
  if (!Number.isInteger(result) || result < 0) throw new Error(`${context} must be a nonnegative integer`);
  return result;
};
const required = (value: Record<string, unknown>, key: string, context: string): unknown => {
  if (!Object.hasOwn(value, key)) throw new Error(`${context}.${key} is required`);
  return value[key];
};
const exactKeys = (value: Record<string, unknown>, keys: readonly string[], context: string): void => {
  const unexpected = Object.keys(value).filter((key) => !keys.includes(key));
  if (unexpected.length > 0) throw new Error(`${context} has unexpected keys: ${unexpected.join(',')}`);
};
const strings = (value: unknown, context: string): string[] => array(value, context).map((entry, index) => string(entry, `${context}[${String(index)}]`));
const integers = (value: unknown, context: string): number[] => array(value, context).map((entry, index) => integer(entry, `${context}[${String(index)}]`));

const box = (value: unknown, context: string): Json => {
  const raw = record(value, context);
  exactKeys(raw, ['left', 'bottom', 'right', 'top'], context);
  return Object.fromEntries(['left', 'bottom', 'right', 'top'].map((key) => [key, number(required(raw, key, context), `${context}.${key}`)]));
};
const candidate = (value: unknown, context: string): Json => {
  const raw = record(value, context);
  exactKeys(raw, ['id', 'page', 'region', 'target_element_id', 'target_element_type', 'source_element_id', 'source_caption_element_id', 'source_caption_text', 'candidate_signals'], context);
  const region = record(required(raw, 'region', context), `${context}.region`);
  exactKeys(region, ['id', 'page', 'bounding_box', 'padding'], `${context}.region`);
  const result: Record<string, Json> = {
    id: string(required(raw, 'id', context), `${context}.id`),
    page: integer(required(raw, 'page', context), `${context}.page`),
    region: {
      id: string(required(region, 'id', `${context}.region`), `${context}.region.id`),
      page: integer(required(region, 'page', `${context}.region`), `${context}.region.page`),
      bounding_box: box(required(region, 'bounding_box', `${context}.region`), `${context}.region.bounding_box`),
      ...(Object.hasOwn(region, 'padding') ? { padding: number(region.padding, `${context}.region.padding`) } : {}),
    },
    target_element_id: string(required(raw, 'target_element_id', context), `${context}.target_element_id`),
    target_element_type: string(required(raw, 'target_element_type', context), `${context}.target_element_type`),
    candidate_signals: strings(required(raw, 'candidate_signals', context), `${context}.candidate_signals`),
  };
  for (const key of ['source_element_id', 'source_caption_element_id', 'source_caption_text'] as const) if (Object.hasOwn(raw, key)) result[key] = string(raw[key], `${context}.${key}`);
  return result;
};

const documentMap = (value: unknown, expectedCandidates: Json[]): Json => {
  const raw = record(value, 'document_map');
  const candidates = array(required(raw, 'visual_enrichment_candidates', 'document_map'), 'document_map.visual_enrichment_candidates').map((entry, index) => candidate(entry, `document_map.visual_enrichment_candidates[${String(index)}]`));
  if (JSON.stringify(candidates) !== JSON.stringify(expectedCandidates)) throw new Error('top-level and Document Map visual candidates differ');
  const routing = record(required(raw, 'routing', 'document_map'), 'document_map.routing');
  const summary = record(required(raw, 'summary', 'document_map'), 'document_map.summary');
  const kindCounts = record(required(summary, 'visual_enrichment_candidate_kind_counts', 'document_map.summary'), 'document_map.summary.visual_enrichment_candidate_kind_counts');
  exactKeys(kindCounts, ['image', 'table', 'figure', 'chart', 'formula', 'diagram', 'visual_region'], 'document_map.summary.visual_enrichment_candidate_kind_counts');
  return {
    layers: strings(required(raw, 'layers', 'document_map'), 'document_map.layers'),
    pages: array(required(raw, 'pages', 'document_map'), 'document_map.pages').map((entry, index) => {
      const page = record(entry, `document_map.pages[${String(index)}]`);
      return {
        page: integer(required(page, 'page', 'document_map page'), 'document_map page.page'),
        visual_candidate_indexes: integers(required(page, 'visual_candidate_indexes', 'document_map page'), 'document_map page.visual_candidate_indexes'),
        visual_candidate_count: integer(required(page, 'visual_candidate_count', 'document_map page'), 'document_map page.visual_candidate_count'),
        visual_enrichment_indexes: integers(required(page, 'visual_enrichment_indexes', 'document_map page'), 'document_map page.visual_enrichment_indexes'),
        visual_enrichment_count: integer(required(page, 'visual_enrichment_count', 'document_map page'), 'document_map page.visual_enrichment_count'),
      };
    }),
    visual_enrichment_candidates: candidates,
    visual_enrichments: array(required(raw, 'visual_enrichments', 'document_map'), 'document_map.visual_enrichments'),
    routing: { visual_candidate_pages: integers(required(routing, 'visual_candidate_pages', 'document_map.routing'), 'document_map.routing.visual_candidate_pages') },
    summary: {
      visual_enrichment_candidate_count: integer(required(summary, 'visual_enrichment_candidate_count', 'document_map.summary'), 'document_map.summary.visual_enrichment_candidate_count'),
      visual_enrichment_candidate_kind_counts: Object.fromEntries(
        Object.entries(kindCounts)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, integer(entry, `document_map.summary.kind_counts.${key}`)])
      ),
      visual_enrichment_count: integer(required(summary, 'visual_enrichment_count', 'document_map.summary'), 'document_map.summary.visual_enrichment_count'),
    },
  };
};

export const canonicalVisualCandidateResult = (value: unknown): Json => {
  const outer = record(value, 'visual candidate result');
  let data = outer;
  if (Object.hasOwn(outer, 'content')) {
    const content = array(required(outer, 'content', 'tool result'), 'tool result.content');
    const first = record(content[0], 'tool result.content[0]');
    const payload = record(JSON.parse(string(required(first, 'text', 'tool result.content[0]'), 'tool result.content[0].text')), 'tool payload');
    const source = record(array(required(payload, 'results', 'tool payload'), 'tool payload.results')[0], 'tool source');
    if (required(source, 'success', 'tool source') !== true) throw new Error('visual candidate source must succeed');
    data = record(required(source, 'data', 'tool source'), 'tool data');
  }
  const candidates = Object.hasOwn(data, 'visual_enrichment_candidates')
    ? array(data.visual_enrichment_candidates, 'visual_enrichment_candidates').map((entry, index) => candidate(entry, `visual_enrichment_candidates[${String(index)}]`))
    : [];
  const result: Record<string, Json> = {
    num_pages: integer(required(data, 'num_pages', 'visual candidate result'), 'visual candidate result.num_pages'),
    has_visual_enrichment_candidates: Object.hasOwn(data, 'visual_enrichment_candidates'),
    visual_enrichment_candidates: candidates,
    has_visual_enrichments: Object.hasOwn(data, 'visual_enrichments'),
    visual_enrichments: Object.hasOwn(data, 'visual_enrichments') ? array(data.visual_enrichments, 'visual_enrichments') as Json[] : [],
    has_elements: Object.hasOwn(data, 'elements'),
    visual_warnings: Object.hasOwn(data, 'warnings') ? strings(data.warnings, 'warnings').filter((warning) => warning.startsWith('Visual enrichment')) : [],
    dependency_surfaces: Object.fromEntries(
      [...VISUAL_CANDIDATE_MUTATION_MANIFEST.dependencyPresence, ...VISUAL_CANDIDATE_MUTATION_MANIFEST.privateLeakage]
        .map((key) => [key, Object.hasOwn(data, key)])
    ),
  };
  if (Object.hasOwn(data, 'document_map')) result.document_map = documentMap(data.document_map, candidates);
  return result;
};
