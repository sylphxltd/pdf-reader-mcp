#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPdf } from './src/handlers/readPdf.ts';
import { defaultSearchPdfOptions, searchPdfSource } from './src/pdf/search.ts';
import { canonicalSelectableReadResult, canonicalSelectableSearchResult } from './v3014-selectable-text-segmentation-projection.ts';

const [corpusPath, fixtureDir] = process.argv.slice(2);
if (!corpusPath || !fixtureDir) throw new Error('usage: runner <corpus.json> <fixture-dir>');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as {
  cases: Array<{ id: string; operation: 'read' | 'search'; fixture: string; input: Record<string, unknown> }>;
};
const expectations: Record<string, unknown> = {};
for (const entry of corpus.cases) {
  const fixturePath = join(fixtureDir, entry.fixture);
  if (entry.operation === 'read') {
    const input = structuredClone(entry.input);
    const sources = input.sources as Array<Record<string, unknown>>;
    if (!sources[0]) throw new Error(`${entry.id} lacks a source`);
    sources[0].path = fixturePath;
    const result = await readPdf.handler({ input: input as never, ctx: {} });
    expectations[entry.id] = canonicalSelectableReadResult(Array.isArray(result) ? { content: result } : result);
  } else {
    const { pages, ...rawOptions } = entry.input;
    const options = { ...defaultSearchPdfOptions(String(rawOptions.query)), ...rawOptions };
    const result = await searchPdfSource({ path: fixturePath, ...(pages !== undefined ? { pages } : {}) }, options as never);
    expectations[entry.id] = canonicalSelectableSearchResult(result);
  }
}
console.log(JSON.stringify(expectations));
