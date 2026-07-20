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
const coordinate = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context} must be finite`);
  }
  return Math.round(value * 1e9) / 1e9;
};

const normalizeSource = (value: string): string => {
  const normalized = value.replaceAll('\\', '/');
  const marker = 'v3014-behavior-v1.pdf';
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

const projectMatch = (entry: unknown, index: number): Json => {
  const match = record(entry, `matches[${String(index)}]`);
  const box = record(match.bounding_box, `matches[${String(index)}].bounding_box`);
  return {
    page: integer(match.page, `matches[${String(index)}].page`),
    text: string(match.text, `matches[${String(index)}].text`),
    match_start: integer(match.match_start, `matches[${String(index)}].match_start`),
    match_end: integer(match.match_end, `matches[${String(index)}].match_end`),
    text_item_index: integer(match.text_item_index, `matches[${String(index)}].text_item_index`),
    bounding_box: {
      left: coordinate(box.left, `matches[${String(index)}].bounding_box.left`),
      bottom: coordinate(box.bottom, `matches[${String(index)}].bounding_box.bottom`),
      right: coordinate(box.right, `matches[${String(index)}].bounding_box.right`),
      top: coordinate(box.top, `matches[${String(index)}].bounding_box.top`),
    },
    bounding_box_level: string(
      match.bounding_box_level,
      `matches[${String(index)}].bounding_box_level`
    ),
  };
};

export const canonicalSearchMultiwordGeometryResult = (response: unknown): Json => {
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
      projected.num_pages = integer(result.num_pages, `results[${String(index)}].num_pages`);
      projected.searched_pages = array(
        result.searched_pages,
        `results[${String(index)}].searched_pages`
      ).map((page, pageIndex) =>
        integer(page, `results[${String(index)}].searched_pages[${String(pageIndex)}]`)
      );
      projected.total_matches = integer(
        result.total_matches,
        `results[${String(index)}].total_matches`
      );
      projected.matches = array(result.matches, `results[${String(index)}].matches`).map(
        projectMatch
      );
      return projected;
    }
  );
  return {
    profile: string(
      record(resultsSource, 'profile source').profile ?? 'pdf_search_results',
      'profile'
    ),
    results,
  };
};
