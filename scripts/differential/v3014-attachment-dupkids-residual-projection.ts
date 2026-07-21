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
  'v3014-attachment-dupkids-control-v1.pdf',
  'v3014-attachment-dupkids-duplicate-v1.pdf',
  'v3014-attachment-dupkids-cycle-v1.pdf',
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

const projectAttachment = (entry: unknown, index: number): Json => {
  const attachment = record(entry, `attachments[${String(index)}]`);
  const projected: Record<string, Json> = {
    name: string(attachment.name, `attachments[${String(index)}].name`),
    filename: string(attachment.filename, `attachments[${String(index)}].filename`),
  };
  if (Object.hasOwn(attachment, 'description')) {
    projected.description = string(
      attachment.description,
      `attachments[${String(index)}].description`
    );
  }
  if (Object.hasOwn(attachment, 'size_bytes')) {
    projected.size_bytes = integer(
      attachment.size_bytes,
      `attachments[${String(index)}].size_bytes`
    );
  }
  return projected;
};

export const canonicalAttachmentDupkidsResidualResult = (response: unknown): Json => {
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
      if (Object.hasOwn(data, 'attachments') && data.attachments != null) {
        projectedData.attachments = array(
          data.attachments,
          `results[${String(index)}].data.attachments`
        ).map(projectAttachment);
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
