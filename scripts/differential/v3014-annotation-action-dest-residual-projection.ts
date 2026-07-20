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
  'v3014-annotation-named-dest-v1.pdf',
  'v3014-annotation-goto-action-v1.pdf',
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

const projectDest = (value: unknown, context: string): Json => {
  if (typeof value === 'string') return value;
  return array(value, context).map(projectDestPart);
};

const projectAnnotation = (entry: unknown, index: number): Json => {
  const annotation = record(entry, `annotations[${String(index)}]`);
  const projected: Record<string, Json> = {
    page: integer(annotation.page, `annotations[${String(index)}].page`),
  };
  if (Object.hasOwn(annotation, 'id')) {
    projected.id = string(annotation.id, `annotations[${String(index)}].id`);
  }
  if (Object.hasOwn(annotation, 'subtype')) {
    projected.subtype = string(annotation.subtype, `annotations[${String(index)}].subtype`);
  }
  if (Object.hasOwn(annotation, 'dest')) {
    projected.dest = projectDest(annotation.dest, `annotations[${String(index)}].dest`);
  }
  if (Object.hasOwn(annotation, 'bounding_box') && annotation.bounding_box) {
    const box = record(annotation.bounding_box, `annotations[${String(index)}].bounding_box`);
    projected.bounding_box = {
      left: finite(box.left, `annotations[${String(index)}].bounding_box.left`),
      bottom: finite(box.bottom, `annotations[${String(index)}].bounding_box.bottom`),
      right: finite(box.right, `annotations[${String(index)}].bounding_box.right`),
      top: finite(box.top, `annotations[${String(index)}].bounding_box.top`),
    };
  }
  return projected;
};

const projectPageAnnotations = (entry: unknown, index: number): Json => {
  const page = record(entry, `page_annotations[${String(index)}]`);
  return {
    page: integer(page.page, `page_annotations[${String(index)}].page`),
    annotations: array(page.annotations, `page_annotations[${String(index)}].annotations`).map(
      projectAnnotation
    ),
  };
};

export const canonicalAnnotationActionDestResidualResult = (response: unknown): Json => {
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
      projected.data = {
        num_pages: integer(data.num_pages, `results[${String(index)}].data.num_pages`),
        annotations: array(
          data.annotations,
          `results[${String(index)}].data.annotations`
        ).map(projectPageAnnotations),
      };
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
