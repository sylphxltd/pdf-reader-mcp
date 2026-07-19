#!/usr/bin/env bun

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const record = (value: unknown, context: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
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
const integer = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${context} must be a nonnegative integer`);
  }
  return value;
};
const finite = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context} must be finite`);
  }
  return value;
};
const boolean = (value: unknown, context: string): boolean => {
  if (typeof value !== 'boolean') throw new Error(`${context} must be boolean`);
  return value;
};
const required = (value: Record<string, unknown>, key: string, context: string): unknown => {
  if (!Object.hasOwn(value, key)) throw new Error(`${context}.${key} is required`);
  return value[key];
};

const MATCH_KEYS = [
  'id',
  'page',
  'text',
  'snippet',
  'match_start',
  'match_end',
  'ocr_word_index',
  'text_item_index',
  'bounding_box',
  'bounding_box_level',
  'source_render_evidence_id',
  'provenance',
] as const;

const exactKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  context: string
): void => {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new Error(`${context} has unexpected keys: ${unexpected.join(',')}`);
  }
};

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
  };
  if (Object.hasOwn(source, 'ocr_word_index')) {
    result.ocr_word_index = integer(source.ocr_word_index, `${context}.ocr_word_index`);
  }
  if (Object.hasOwn(source, 'text_item_index')) {
    result.text_item_index = integer(source.text_item_index, `${context}.text_item_index`);
  }
  if (Object.hasOwn(source, 'source_render_evidence_id')) {
    result.source_render_evidence_id = string(
      source.source_render_evidence_id,
      `${context}.source_render_evidence_id`
    );
  }
  if (Object.hasOwn(source, 'bounding_box')) {
    const box = record(source.bounding_box, `${context}.bounding_box`);
    const round = (value: number): number => Math.round(value * 1000) / 1000;
    result.bounding_box = {
      left: round(finite(required(box, 'left', `${context}.bounding_box`), `${context}.bounding_box.left`)),
      bottom: round(
        finite(required(box, 'bottom', `${context}.bounding_box`), `${context}.bounding_box.bottom`)
      ),
      right: round(
        finite(required(box, 'right', `${context}.bounding_box`), `${context}.bounding_box.right`)
      ),
      top: round(finite(required(box, 'top', `${context}.bounding_box`), `${context}.bounding_box.top`)),
    };
  }
  if (Object.hasOwn(source, 'bounding_box_level')) {
    result.bounding_box_level = string(source.bounding_box_level, `${context}.bounding_box_level`);
  }
  const provenance = record(required(source, 'provenance', context), `${context}.provenance`);
  // Claim interleaving identity, not cross-runtime engine/route label parity.
  // Selectable matches use text_item_index; OCR matches use source_render_evidence_id / ocr_word_index.
  if (Object.hasOwn(source, 'text_item_index')) {
    result.provenance = { kind: 'selectable-text' };
  } else if (Object.hasOwn(source, 'source_render_evidence_id') || Object.hasOwn(source, 'ocr_word_index')) {
    result.provenance = { kind: 'ocr-provider' };
  } else {
    const engine = string(
      required(provenance, 'engine', `${context}.provenance`),
      `${context}.provenance.engine`
    );
    result.provenance = { kind: engine };
  }
  return result;
};

const RESULT_KEYS = [
  'source',
  'success',
  'error',
  'num_pages',
  'searched_pages',
  'total_matches',
  'matches',
  'truncated',
  'warnings',
  'route',
  'page_cache',
  'engine',
] as const;

export const canonicalOcrSearchMcpResult = (value: unknown): Json => {
  const envelope = record(value, 'MCP response');
  const result = record(required(envelope, 'result', 'MCP response'), 'MCP tool result');
  const content = array(required(result, 'content', 'MCP tool result'), 'MCP tool result.content');
  const first = record(content[0], 'MCP tool result.content[0]');
  if (result.isError === true) {
    return {
      isError: true,
      error: string(required(first, 'text', 'MCP tool error content'), 'MCP tool error content.text'),
    };
  }
  const payload = record(
    JSON.parse(
      string(required(first, 'text', 'MCP tool result.content[0]'), 'MCP tool result.content[0].text')
    ),
    'search payload'
  );
  const sources = array(required(payload, 'results', 'search payload'), 'search payload.results').map(
    (entry, index) => {
      const source = record(entry, `results[${String(index)}]`);
      exactKeys(source, RESULT_KEYS, `results[${String(index)}]`);
      const success = boolean(
        required(source, 'success', `results[${String(index)}]`),
        `results[${String(index)}].success`
      );
      if (!success) {
        return {
          success: false,
          error: string(required(source, 'error', `results[${String(index)}]`), 'error'),
        };
      }
      const projected: Record<string, Json> = {
        success: true,
        num_pages: integer(required(source, 'num_pages', 'source result'), 'source result.num_pages'),
        searched_pages: array(
          required(source, 'searched_pages', 'source result'),
          'source result.searched_pages'
        ).map((page, pageIndex) => integer(page, `searched_pages[${String(pageIndex)}]`)),
        total_matches: integer(
          required(source, 'total_matches', 'source result'),
          'source result.total_matches'
        ),
        matches: array(required(source, 'matches', 'source result'), 'source result.matches').map(
          (match, matchIndex) => canonicalMatch(match, `matches[${String(matchIndex)}]`)
        ),
        match_ids: array(required(source, 'matches', 'source result'), 'source result.matches').map(
          (match, matchIndex) =>
            string(record(match, `match ${matchIndex}`).id, `match ${matchIndex}.id`)
        ),
      };
      if (Object.hasOwn(source, 'warnings')) {
        projected.warnings = array(source.warnings, 'source result.warnings').map((warning, i) =>
          string(warning, `warnings[${String(i)}]`)
        );
      }
      if (Object.hasOwn(source, 'truncated')) {
        projected.truncated = boolean(source.truncated, 'source result.truncated');
      }
      return projected;
    }
  );
  return {
    profile: string(required(payload, 'profile', 'search payload'), 'search payload.profile'),
    results: sources,
  };
};
