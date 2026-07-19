export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const record = (value: unknown, context: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
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
const integer = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error(`${context} must be a nonnegative integer`);
  return value;
};
const finite = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${context} must be finite`);
  return value;
};
const boolean = (value: unknown, context: string): boolean => {
  if (typeof value !== 'boolean') throw new Error(`${context} must be boolean`);
  return value;
};

const canonicalError = (value: unknown, context: string): string => {
  const error = string(value, context);
  const prefix = 'Invalid page specification for source ';
  const detailIndex = error.indexOf(': Invalid page ');
  if (!error.startsWith(prefix) || detailIndex < 0) return error;
  const source = error.slice(prefix.length, detailIndex).replaceAll('\\', '/');
  const fixture = 'test/fixtures/differential/v3014-visual-v1.pdf';
  if (source !== fixture && !source.endsWith(`/${fixture}`)) return error;
  return `${prefix}<fixture>${error.slice(detailIndex)}`;
};
const array = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value;
};

const RESULT_KEYS = ['source', 'success', 'error', 'num_pages', 'searched_pages', 'total_matches', 'matches', 'truncated', 'warnings', 'route', 'page_cache', 'engine'] as const;
const MATCH_KEYS = ['id', 'page', 'text', 'snippet', 'match_start', 'match_end', 'ocr_word_index', 'bounding_box', 'bounding_box_level', 'source_render_evidence_id', 'provenance'] as const;
const BOX_KEYS = ['left', 'bottom', 'right', 'top'] as const;
const PROVENANCE_KEYS = ['engine', 'source'] as const;

const canonicalMatch = (value: unknown, context: string): Json => {
  const source = record(value, context);
  exactKeys(source, MATCH_KEYS, context);
  const result: Record<string, Json> = {
    id: string(required(source, 'id', context), `${context}.id`),
    page: integer(required(source, 'page', context), `${context}.page`),
    text: string(required(source, 'text', context), `${context}.text`),
    snippet: string(required(source, 'snippet', context), `${context}.snippet`),
    match_start: integer(required(source, 'match_start', context), `${context}.match_start`),
    match_end: integer(required(source, 'match_end', context), `${context}.match_end`),
    source_render_evidence_id: string(required(source, 'source_render_evidence_id', context), `${context}.source_render_evidence_id`),
  };
  if (Object.hasOwn(source, 'ocr_word_index')) result.ocr_word_index = integer(source.ocr_word_index, `${context}.ocr_word_index`);
  if (Object.hasOwn(source, 'bounding_box')) {
    const box = record(source.bounding_box, `${context}.bounding_box`);
    exactKeys(box, BOX_KEYS, `${context}.bounding_box`);
    result.bounding_box = Object.fromEntries(BOX_KEYS.map((key) => [key, finite(required(box, key, `${context}.bounding_box`), `${context}.bounding_box.${key}`)]));
  }
  if (Object.hasOwn(source, 'bounding_box_level')) result.bounding_box_level = string(source.bounding_box_level, `${context}.bounding_box_level`);
  const provenance = record(required(source, 'provenance', context), `${context}.provenance`);
  exactKeys(provenance, PROVENANCE_KEYS, `${context}.provenance`);
  result.provenance = {
    engine: string(required(provenance, 'engine', `${context}.provenance`), `${context}.provenance.engine`),
    source: string(required(provenance, 'source', `${context}.provenance`), `${context}.provenance.source`),
  };
  return result;
};

export const canonicalOcrSearchMcpResult = (value: unknown): Json => {
  const envelope = record(value, 'MCP response');
  const result = record(required(envelope, 'result', 'MCP response'), 'MCP tool result');
  const content = array(required(result, 'content', 'MCP tool result'), 'MCP tool result.content');
  const first = record(content[0], 'MCP tool result.content[0]');
  const payload = record(JSON.parse(string(required(first, 'text', 'MCP tool result.content[0]'), 'MCP tool result.content[0].text')), 'search payload');
  const sources = array(required(payload, 'results', 'search payload'), 'search payload.results').map((entry, index) => {
    const source = record(entry, `results[${String(index)}]`);
    exactKeys(source, RESULT_KEYS, `results[${String(index)}]`);
    const success = boolean(required(source, 'success', `results[${String(index)}]`), `results[${String(index)}].success`);
    if (!success) return { success: false, error: canonicalError(required(source, 'error', `results[${String(index)}]`), `results[${String(index)}].error`) };
    const projected: Record<string, Json> = {
      success: true,
      num_pages: integer(required(source, 'num_pages', 'source result'), 'source result.num_pages'),
      searched_pages: array(required(source, 'searched_pages', 'source result'), 'source result.searched_pages').map((entry, pageIndex) => integer(entry, `searched_pages[${String(pageIndex)}]`)),
      total_matches: integer(required(source, 'total_matches', 'source result'), 'source result.total_matches'),
      matches: array(required(source, 'matches', 'source result'), 'source result.matches').map((entry, matchIndex) => canonicalMatch(entry, `matches[${String(matchIndex)}]`)),
    };
    if (Object.hasOwn(source, 'warnings')) projected.warnings = array(source.warnings, 'source result.warnings').map((entry, warningIndex) => string(entry, `warnings[${String(warningIndex)}]`));
    if (Object.hasOwn(source, 'truncated')) projected.truncated = boolean(source.truncated, 'source result.truncated');
    return projected;
  });
  return { profile: string(required(payload, 'profile', 'search payload'), 'search payload.profile'), results: sources };
};
