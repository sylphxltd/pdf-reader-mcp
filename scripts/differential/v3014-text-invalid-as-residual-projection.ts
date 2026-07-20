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
const number = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context} must be a finite number`);
  }
  return value;
};
const boolean = (value: unknown, context: string): boolean => {
  if (typeof value !== 'boolean') throw new Error(`${context} must be boolean`);
  return value;
};

const FIXTURES = [
  'v3014-annotation-text-namedap-badas-v1.pdf',
  'v3014-annotation-text-namedap-as-nonstream-v1.pdf',
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

const projectBox = (value: unknown, context: string): Json => {
  const box = record(value, context);
  return {
    left: number(box.left, `${context}.left`),
    bottom: number(box.bottom, `${context}.bottom`),
    right: number(box.right, `${context}.right`),
    top: number(box.top, `${context}.top`),
  };
};

const projectAnnotation = (value: unknown, context: string): Json => {
  const annotation = record(value, context);
  const projected: Record<string, Json> = {
    page: integer(annotation.page, `${context}.page`),
    subtype: string(annotation.subtype, `${context}.subtype`),
    contents: string(annotation.contents, `${context}.contents`),
    bounding_box: projectBox(annotation.bounding_box, `${context}.bounding_box`),
  };
  if (Object.hasOwn(annotation, 'title')) {
    projected.title = string(annotation.title, `${context}.title`);
  }
  if (Object.hasOwn(annotation, 'id')) {
    projected.id = string(annotation.id, `${context}.id`);
  }
  return projected;
};

export const canonicalTextInvalidAsResidualResult = (response: unknown): Json => {
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
      const groups = array(data.annotations, `results[${String(index)}].data.annotations`).map(
        (group, groupIndex) => {
          const pageGroup = record(group, `annotations[${String(groupIndex)}]`);
          return {
            page: integer(pageGroup.page, `annotations[${String(groupIndex)}].page`),
            annotations: array(
              pageGroup.annotations,
              `annotations[${String(groupIndex)}].annotations`
            ).map((annotation, annotationIndex) =>
              projectAnnotation(
                annotation,
                `annotations[${String(groupIndex)}].annotations[${String(annotationIndex)}]`
              )
            ),
          };
        }
      );
      projected.data = {
        num_pages: integer(data.num_pages, `results[${String(index)}].data.num_pages`),
        annotations: groups,
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
