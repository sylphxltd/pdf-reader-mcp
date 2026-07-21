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
  'v3014-info-trapped-true-v1.pdf',
  'v3014-info-trapped-false-v1.pdf',
  'v3014-info-custom-mixed-v1.pdf',
] as const;

const FORBIDDEN_INFO_KEYS = ['text_chars', 'route', 'num_pages'] as const;

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

const projectName = (value: unknown, context: string): Json => {
  const obj = record(value, context);
  return { name: string(obj.name, `${context}.name`) };
};

const projectCustom = (value: unknown, context: string): Json => {
  const custom = record(value, context);
  const projected: Record<string, Json> = {};
  for (const key of Object.keys(custom).sort()) {
    const entry = custom[key];
    if (entry === null) {
      projected[key] = null;
    } else if (typeof entry === 'string') {
      projected[key] = string(entry, `${context}.${key}`);
    } else if (typeof entry === 'boolean') {
      projected[key] = boolean(entry, `${context}.${key}`);
    } else if (typeof entry === 'number' && Number.isFinite(entry)) {
      projected[key] = entry;
    } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      projected[key] = projectName(entry, `${context}.${key}`);
    } else {
      throw new Error(`${context}.${key} has unsupported custom type`);
    }
  }
  return projected;
};

const projectInfo = (value: unknown, context: string): Json => {
  const info = record(value, context);
  const forbiddenPresent = FORBIDDEN_INFO_KEYS.filter((key) => Object.hasOwn(info, key));
  if (forbiddenPresent.length > 0) {
    throw new Error(`${context} contains forbidden rust-only keys: ${forbiddenPresent.join(',')}`);
  }
  const projected: Record<string, Json> = {
    PDFFormatVersion: string(info.PDFFormatVersion, `${context}.PDFFormatVersion`),
    Language: info.Language === null ? null : string(info.Language, `${context}.Language`),
    EncryptFilterName:
      info.EncryptFilterName === null
        ? null
        : string(info.EncryptFilterName, `${context}.EncryptFilterName`),
    IsLinearized: boolean(info.IsLinearized, `${context}.IsLinearized`),
    IsAcroFormPresent: boolean(info.IsAcroFormPresent, `${context}.IsAcroFormPresent`),
    IsXFAPresent: boolean(info.IsXFAPresent, `${context}.IsXFAPresent`),
    IsCollectionPresent: boolean(info.IsCollectionPresent, `${context}.IsCollectionPresent`),
    IsSignaturesPresent: boolean(info.IsSignaturesPresent, `${context}.IsSignaturesPresent`),
  };
  if (Object.hasOwn(info, 'Title')) {
    projected.Title = string(info.Title, `${context}.Title`);
  }
  if (Object.hasOwn(info, 'Producer')) {
    projected.Producer = string(info.Producer, `${context}.Producer`);
  }
  if (Object.hasOwn(info, 'Trapped')) {
    projected.Trapped = projectName(info.Trapped, `${context}.Trapped`);
  }
  if (Object.hasOwn(info, 'Custom')) {
    projected.Custom = projectCustom(info.Custom, `${context}.Custom`);
  }
  return projected;
};

export const canonicalInfoTrappedCustomResidualResult = (response: unknown): Json => {
  const payload = publicPayload(record(response, 'response'));
  const resultsSource = Object.hasOwn(payload, 'results')
    ? payload
    : Object.hasOwn(payload, 'data')
      ? record(payload.data, 'data')
      : payload;
  const results = array(record(resultsSource, 'results source').results, 'results').map(
    (entry, index) => {
      const result = record(entry, `results[${String(index)}]`);
      const data = record(result.data, `results[${String(index)}].data`);
      return {
        source: normalizeSource(string(result.source, `results[${String(index)}].source`)),
        success: boolean(result.success, `results[${String(index)}].success`),
        data: {
          num_pages: integer(data.num_pages, `results[${String(index)}].data.num_pages`),
          info: projectInfo(data.info, `results[${String(index)}].data.info`),
        },
      };
    }
  );
  return {
    profile: 'pdf_read_results',
    results,
  };
};
