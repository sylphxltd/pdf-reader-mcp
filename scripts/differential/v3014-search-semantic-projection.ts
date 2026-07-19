export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export const SEARCH_SEMANTIC_MUTATION_MANIFEST = {
  version: 1,
  wrongPrimitiveTypes: ['searched_pages[0]', 'match.snippet', 'warning[0]', 'failure.error'],
  unexpectedFields: ['result', 'match'],
  requiredOmissions: ['result.success', 'match.snippet'],
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
const number = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error(`${context} must be a nonnegative integer`);
  return value;
};
const boolean = (value: unknown, context: string): boolean => {
  if (typeof value !== 'boolean') throw new Error(`${context} must be a boolean`);
  return value;
};
const array = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value;
};

const MATCH_KEYS = ['id', 'page', 'text', 'snippet', 'match_start', 'match_end', 'text_item_index', 'bounding_box', 'bounding_box_level', 'provenance'] as const;
const RESULT_KEYS = ['source', 'success', 'error', 'num_pages', 'searched_pages', 'total_matches', 'matches', 'truncated', 'warnings', 'route', 'page_cache', 'engine'] as const;
const match = (value: unknown, context: string): Json => {
  const source = record(value, context);
  exactKeys(source, MATCH_KEYS, context);
  return {
    id: string(required(source, 'id', context), `${context}.id`),
    page: number(required(source, 'page', context), `${context}.page`),
    text: string(required(source, 'text', context), `${context}.text`),
    snippet: string(required(source, 'snippet', context), `${context}.snippet`),
    match_start: number(required(source, 'match_start', context), `${context}.match_start`),
    match_end: number(required(source, 'match_end', context), `${context}.match_end`),
    text_item_index: number(required(source, 'text_item_index', context), `${context}.text_item_index`),
  };
};

export const canonicalSearchSemanticResult = (value: unknown): Json => {
  const source = record(value, 'search result');
  exactKeys(source, RESULT_KEYS, 'search result');
  const success = boolean(required(source, 'success', 'search result'), 'search result.success');
  if (!success) {
    exactKeys(source, ['source', 'success', 'error'], 'failed search result');
    return { success: false, error: string(required(source, 'error', 'failed search result'), 'failed search result.error') };
  }
  const matches = array(required(source, 'matches', 'search result'), 'search result.matches')
    .map((entry, index) => match(entry, `search result.matches[${String(index)}]`));
  const result: Record<string, Json> = {
    success: true,
    num_pages: number(required(source, 'num_pages', 'search result'), 'search result.num_pages'),
    searched_pages: array(required(source, 'searched_pages', 'search result'), 'search result.searched_pages')
      .map((entry, index) => number(entry, `search result.searched_pages[${String(index)}]`)),
    total_matches: number(required(source, 'total_matches', 'search result'), 'search result.total_matches'),
    matches,
  };
  if (Object.hasOwn(source, 'warnings')) result.warnings = array(source.warnings, 'search result.warnings').map((entry, index) => string(entry, `search result.warnings[${String(index)}]`));
  if (Object.hasOwn(source, 'truncated')) result.truncated = boolean(source.truncated, 'search result.truncated');
  return result;
};

export const canonicalSearchSemanticFailure = (message: unknown): Json => ({
  success: false,
  error: string(message, 'failure.error'),
});
