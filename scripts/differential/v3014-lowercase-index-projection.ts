export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export const LOWERCASE_INDEX_MUTATION_MANIFEST = {
  version: 1,
  wrongPrimitiveTypes: ['searched_pages[0]', 'total_matches', 'match.text', 'match.match_start', 'warning[0]'],
  unexpectedFields: ['result', 'match'],
  requiredOmissions: ['result.warnings', 'result.truncated', 'match.snippet'],
} as const;

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
const array = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value;
};

const MATCH_KEYS = ['id', 'page', 'text', 'snippet', 'match_start', 'match_end', 'text_item_index', 'bounding_box', 'bounding_box_level', 'provenance'] as const;
const RESULT_KEYS = ['source', 'success', 'error', 'num_pages', 'searched_pages', 'total_matches', 'matches', 'truncated', 'warnings', 'route', 'page_cache', 'engine'] as const;

export const canonicalLowercaseIndexResult = (value: unknown): Json => {
  const source = record(value, 'search result');
  exactKeys(source, RESULT_KEYS, 'search result');
  if (required(source, 'success', 'search result') !== true) throw new Error('search result.success must be true');
  const matches = array(required(source, 'matches', 'search result'), 'search result.matches').map((entry, index) => {
    const raw = record(entry, `search result.matches[${String(index)}]`);
    exactKeys(raw, MATCH_KEYS, `search result.matches[${String(index)}]`);
    return {
      text: string(required(raw, 'text', 'match'), 'match.text'),
      snippet: string(required(raw, 'snippet', 'match'), 'match.snippet'),
      match_start: integer(required(raw, 'match_start', 'match'), 'match.match_start'),
      match_end: integer(required(raw, 'match_end', 'match'), 'match.match_end'),
      text_item_index: integer(required(raw, 'text_item_index', 'match'), 'match.text_item_index'),
    };
  });
  const result: Record<string, Json> = {
    searched_pages: array(required(source, 'searched_pages', 'search result'), 'search result.searched_pages').map((entry, index) => integer(entry, `searched_pages[${String(index)}]`)),
    total_matches: integer(required(source, 'total_matches', 'search result'), 'search result.total_matches'),
    matches,
  };
  if (Object.hasOwn(source, 'warnings')) result.warnings = array(source.warnings, 'warnings').map((entry, index) => string(entry, `warnings[${String(index)}]`));
  if (Object.hasOwn(source, 'truncated')) {
    if (typeof source.truncated !== 'boolean') throw new Error('truncated must be a boolean');
    result.truncated = source.truncated;
  }
  return result;
};
