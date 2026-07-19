#!/usr/bin/env bun

import {
  canonicalReadOcrResult as baseCanonicalReadOcrResult,
  type Json,
} from './v3014-read-ocr-projection.ts';

export type { Json };

const FIXTURES = ['v3014-visual-candidate-v1.pdf', 'v3014-visual-v1.pdf'] as const;

const normalizePathLike = (value: string): string => {
  const normalized = value.replaceAll('\\', '/');
  for (const marker of FIXTURES) {
    if (normalized === marker || normalized.endsWith(`/${marker}`)) {
      return `<fixture>/test/fixtures/differential/${marker}`;
    }
    const index = normalized.lastIndexOf(marker);
    if (index >= 0) {
      return (
        `<fixture>/test/fixtures/differential/${marker}` + normalized.slice(index + marker.length)
      );
    }
  }
  return normalized;
};

const rewrite = (value: Json): Json => {
  if (typeof value === 'string') return normalizePathLike(value);
  if (Array.isArray(value)) return value.map((entry) => rewrite(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, rewrite(entry as Json)])
    );
  }
  return value;
};

export const canonicalReadOcrResult = (response: unknown): Json =>
  rewrite(baseCanonicalReadOcrResult(response));
