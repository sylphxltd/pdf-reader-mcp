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

const FIXTURES = [
  'v3014-info-flags-acroform-v1.pdf',
  'v3014-info-flags-plain-v1.pdf',
] as const;

// Rust-only noise historically injected into data.info. Public pdf.js info must
// not contain these; route/num_pages belong on data.* when requested.
const FORBIDDEN_INFO_KEYS = ['text_chars', 'route', 'num_pages'] as const;

const INFO_VALUE_KEYS = [
  'PDFFormatVersion',
  'Language',
  'EncryptFilterName',
  'IsLinearized',
  'IsAcroFormPresent',
  'IsXFAPresent',
  'IsCollectionPresent',
  'IsSignaturesPresent',
  'Title',
  'Author',
  'Subject',
  'Keywords',
  'Creator',
  'Producer',
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

const projectInfo = (value: unknown, context: string): { info_keys: string[]; info: Json } => {
  const info = record(value, context);
  const forbiddenPresent = FORBIDDEN_INFO_KEYS.filter((key) => Object.hasOwn(info, key));
  if (forbiddenPresent.length > 0) {
    throw new Error(
      `${context} contains forbidden rust-only keys: ${forbiddenPresent.join(',')}`
    );
  }
  const info_keys = Object.keys(info).sort();
  const projected: Record<string, Json> = {};
  for (const key of INFO_VALUE_KEYS) {
    if (!Object.hasOwn(info, key)) continue;
    const entry = info[key];
    if (entry === null) {
      projected[key] = null;
    } else if (typeof entry === 'boolean') {
      projected[key] = boolean(entry, `${context}.${key}`);
    } else if (typeof entry === 'string') {
      projected[key] = string(entry, `${context}.${key}`);
    } else {
      throw new Error(`${context}.${key} has unsupported type`);
    }
  }
  return { info_keys, info: projected };
};

export const canonicalInfoExtrasResidualResult = (response: unknown): Json => {
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
      if (!Object.hasOwn(data, 'info')) {
        throw new Error(`results[${String(index)}].data.info must be present`);
      }
      const { info_keys, info } = projectInfo(data.info, `results[${String(index)}].data.info`);
      // Top-level route/num_pages remain public product fields; claim only that they
      // are not nested under info.
      projected.data = {
        num_pages: integer(data.num_pages, `results[${String(index)}].data.num_pages`),
        has_info: true,
        info_keys,
        info,
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
