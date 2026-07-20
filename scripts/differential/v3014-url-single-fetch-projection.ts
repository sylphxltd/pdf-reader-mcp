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
const boolean = (value: unknown, context: string): boolean => {
  if (typeof value !== 'boolean') throw new Error(`${context} must be boolean`);
  return value;
};

const normalizeSource = (value: string): string => {
  const normalized = value.replaceAll('\\', '/');
  // URL sources: keep host/path shape but drop absolute loopback variance via host token
  try {
    const url = new URL(normalized);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return `<url-fixture>${url.pathname}`;
    }
  } catch {
    // fall through for path-like sources
  }
  const marker = 'v3014-visual-v1.pdf';
  if (normalized === marker || normalized.endsWith(`/${marker}`)) {
    return `<fixture>/test/fixtures/differential/${marker}`;
  }
  return normalized;
};

const publicPayload = (response: Record<string, unknown>): Record<string, unknown> => {
  if (Object.hasOwn(response, 'result') && response.result && typeof response.result === 'object') {
    const result = response.result as Record<string, unknown>;
    if (Array.isArray(result.content)) {
      const textPart = result.content.find(
        (entry) => entry && typeof entry === 'object' && (entry as { type?: string }).type === 'text'
      ) as { text?: string } | undefined;
      if (textPart?.text) return record(JSON.parse(textPart.text), 'content text json');
    }
    if (result.structuredContent && typeof result.structuredContent === 'object') {
      return result.structuredContent as Record<string, unknown>;
    }
  }
  return response;
};

export const canonicalUrlSingleFetchResult = (
  response: unknown,
  meta: { tool: string; fetchHits: number }
): Json => {
  const payload = publicPayload(record(response, 'response'));
  const resultsSource = Object.hasOwn(payload, 'results')
    ? payload
    : Object.hasOwn(payload, 'data')
      ? record(payload.data, 'data')
      : payload;
  const results = array(record(resultsSource, 'results source').results, 'results').map(
    (entry, index) => {
      const result = record(entry, `results[${String(index)}]`);
      const projected: Record<string, Json> = {
        source: normalizeSource(string(result.source, `results[${String(index)}].source`)),
        success: boolean(result.success, `results[${String(index)}].success`),
      };
      if (!result.success) {
        if (Object.hasOwn(result, 'error')) {
          projected.error = string(result.error, `results[${String(index)}].error`);
        }
        return projected;
      }
      if (meta.tool === 'read_pdf') {
        const data = record(result.data, `results[${String(index)}].data`);
        projected.data = {
          num_pages: integer(data.num_pages, `results[${String(index)}].data.num_pages`),
          has_ocr_text_layer: Object.hasOwn(data, 'ocr_text_layer'),
        };
      } else {
        projected.num_pages = integer(result.num_pages, `results[${String(index)}].num_pages`);
        projected.total_matches = integer(
          result.total_matches,
          `results[${String(index)}].total_matches`
        );
        projected.searched_pages = array(
          result.searched_pages,
          `results[${String(index)}].searched_pages`
        ).map((page, pageIndex) =>
          integer(page, `results[${String(index)}].searched_pages[${String(pageIndex)}]`)
        );
      }
      return projected;
    }
  );
  return {
    tool: meta.tool,
    fetchHits: integer(meta.fetchHits, 'fetchHits'),
    singleFetch: meta.fetchHits === 1,
    profile: string(
      record(resultsSource, 'profile source').profile ??
        (meta.tool === 'search_pdf' ? 'pdf_search_results' : 'pdf_read_results'),
      'profile'
    ),
    results,
  };
};
