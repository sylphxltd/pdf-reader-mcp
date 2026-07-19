#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReadOptions } from './src/pdf/autoReadPolicy.ts';
import { PdfSessionScope } from './src/pdf/pdfSession.ts';
import { processSingleSource } from './src/pdf/readCoordinator.ts';
import { canonicalCaptionLinkResult } from './v3014-caption-link-projection.ts';

const [corpusPath, fixtureDir] = process.argv.slice(2);
if (!corpusPath || !fixtureDir) throw new Error('usage: runner <corpus.json> <fixture-dir>');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as {
  cases: Array<{ id: string; input: Record<string, unknown> }>;
};
const materialize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(materialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key === 'fixture' ? 'path' : key,
        key === 'fixture' && typeof entry === 'string' ? join(fixtureDir, entry) : materialize(entry),
      ])
    );
  }
  return value;
};
const expectations: Record<string, unknown> = {};
for (const entry of corpus.cases) {
  const input = materialize(structuredClone(entry.input)) as Record<string, unknown>;
  const sources = input.sources as Array<Record<string, unknown>>;
  const result = await processSingleSource(
    sources[0]!,
    buildReadOptions(input as never),
    new PdfSessionScope()
  );
  if (!result.success || !result.data) throw new Error(result.error ?? `${entry.id} failed`);
  if (input.include_tables !== true) delete result.data.tables;
  expectations[entry.id] = canonicalCaptionLinkResult(result.data);
}
console.log(JSON.stringify(expectations));
