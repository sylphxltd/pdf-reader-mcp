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
const finite = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context} must be finite`);
  }
  return value;
};

const FIXTURES = [
  'v3014-outline-cycle-next-self-v1.pdf',
  'v3014-outline-cycle-sibling-v1.pdf',
  'v3014-outline-cycle-self-first-v1.pdf',
] as const;

const normalizeSource = (value: string): string => {
  const normalized = value.replaceAll('\\', '/');
  for (const marker of FIXTURES) {
    if (normalized === marker || normalized.endsWith(`/${marker}`)) {
      return `<fixture>/test/fixtures/differential/${marker}`;
    }
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

const projectDestPart = (entry: unknown, index: number): Json => {
  if (
    entry === null ||
    typeof entry === 'number' ||
    typeof entry === 'string' ||
    typeof entry === 'boolean'
  ) {
    return entry as Json;
  }
  const part = record(entry, `dest[${String(index)}]`);
  if (Object.hasOwn(part, 'num') || Object.hasOwn(part, 'gen')) {
    return {
      num: integer(part.num, `dest[${String(index)}].num`),
      gen: integer(part.gen, `dest[${String(index)}].gen`),
    };
  }
  if (Object.hasOwn(part, 'name')) {
    return { name: string(part.name, `dest[${String(index)}].name`) };
  }
  throw new Error(`unsupported dest part at ${String(index)}`);
};

const projectOutlineItem = (entry: unknown, index: number): Json => {
  const item = record(entry, `outline[${String(index)}]`);
  const projected: Record<string, Json> = {
    title: string(item.title, `outline[${String(index)}].title`),
    bold: boolean(item.bold ?? false, `outline[${String(index)}].bold`),
    italic: boolean(item.italic ?? false, `outline[${String(index)}].italic`),
  };
  if (Object.hasOwn(item, 'color')) {
    projected.color = array(item.color, `outline[${String(index)}].color`).map((value, colorIndex) =>
      finite(value, `outline[${String(index)}].color[${String(colorIndex)}]`)
    );
  } else {
    projected.color = [0, 0, 0];
  }
  if (Object.hasOwn(item, 'url') && item.url !== undefined && item.url !== null) {
    projected.url = string(item.url, `outline[${String(index)}].url`);
  }
  if (Object.hasOwn(item, 'dest')) {
    if (item.dest === null) {
      projected.dest = null;
    } else if (typeof item.dest === 'string') {
      projected.dest = item.dest;
    } else {
      projected.dest = array(item.dest, `outline[${String(index)}].dest`).map(projectDestPart);
    }
  }
  if (Object.hasOwn(item, 'items') && item.items) {
    projected.items = array(item.items, `outline[${String(index)}].items`).map(projectOutlineItem);
  }
  return projected;
};

export const canonicalOutlineCycleResidualResult = (response: unknown): Json => {
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
      const data = record(result.data, `results[${String(index)}].data`);
      const projectedData: Record<string, Json> = {
        num_pages: integer(data.num_pages, `results[${String(index)}].data.num_pages`),
      };
      if (Object.hasOwn(data, 'outline')) {
        projectedData.outline = array(
          data.outline,
          `results[${String(index)}].data.outline`
        ).map(projectOutlineItem);
      }
      projected.data = projectedData;
      return projected;
    }
  );
  return {
    profile: string(
      record(resultsSource, 'profile source').profile ?? 'pdf_read_results',
      'profile'
    ),
    results,
  };
};
