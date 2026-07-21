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

const normalizeSource = (value: string): string => {
  const normalized = value.replaceAll('\\', '/');
  for (const marker of ['v3014-form-radio-deeper-kids-ap-stream-v1.pdf', 'v3014-form-radio-deeper-kids-apn-stream-v1.pdf', 'v3014-form-radio-deeper-kids-ap-named-v1.pdf']) {
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

const projectField = (entry: unknown, index: number): Json => {
  const field = record(entry, `form_fields[${String(index)}]`);
  const projected: Record<string, Json> = {
    name: string(field.name, `form_fields[${String(index)}].name`),
  };
  if (Object.hasOwn(field, 'type')) {
    projected.type = string(field.type, `form_fields[${String(index)}].type`);
  }
  if (Object.hasOwn(field, 'value')) {
    projected.value = field.value as Json;
  }
  if (Object.hasOwn(field, 'default_value')) {
    projected.default_value = field.default_value as Json;
  }
  if (Object.hasOwn(field, 'page')) {
    projected.page = integer(field.page, `form_fields[${String(index)}].page`);
  }
  if (Object.hasOwn(field, 'id')) {
    projected.id = string(field.id, `form_fields[${String(index)}].id`);
  }
  if (Object.hasOwn(field, 'editable')) {
    projected.editable = boolean(field.editable, `form_fields[${String(index)}].editable`);
  }
  if (Object.hasOwn(field, 'bounding_box') && field.bounding_box) {
    const box = record(field.bounding_box, `form_fields[${String(index)}].bounding_box`);
    projected.bounding_box = {
      left: finite(box.left, `form_fields[${String(index)}].bounding_box.left`),
      bottom: finite(box.bottom, `form_fields[${String(index)}].bounding_box.bottom`),
      right: finite(box.right, `form_fields[${String(index)}].bounding_box.right`),
      top: finite(box.top, `form_fields[${String(index)}].bounding_box.top`),
    };
  }
  return projected;
};

export const canonicalFormRadioDeeperKidsApResidualResult = (response: unknown): Json => {
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
        form_fields: array(data.form_fields, `results[${String(index)}].data.form_fields`).map(
          projectField
        ),
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
