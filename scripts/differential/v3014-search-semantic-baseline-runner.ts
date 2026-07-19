#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultSearchPdfOptions, searchPdfSource } from './src/pdf/search.ts';
import { canonicalSearchSemanticFailure, canonicalSearchSemanticResult } from './v3014-search-semantic-projection.ts';

const [corpusPath, fixtureDir] = process.argv.slice(2);
if (!corpusPath || !fixtureDir) throw new Error('usage: runner <corpus.json> <fixture-dir>');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as {
  cases: Array<{ id: string; fixture: string; input: Record<string, unknown> }>;
};
const expectations: Record<string, unknown> = {};
for (const entry of corpus.cases) {
  const { pages, ...rawOptions } = entry.input;
  const options = { ...defaultSearchPdfOptions(String(rawOptions.query)), ...rawOptions };
  const source = { path: join(fixtureDir, entry.fixture), ...(pages !== undefined ? { pages } : {}) };
  try {
    expectations[entry.id] = canonicalSearchSemanticResult(await searchPdfSource(source, options as never));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expectations[entry.id] = canonicalSearchSemanticFailure(
      `All PDF sources failed search: ${message.replaceAll(fixtureDir, '<fixture-dir>')}`
    );
  }
}
console.log(JSON.stringify(expectations));
