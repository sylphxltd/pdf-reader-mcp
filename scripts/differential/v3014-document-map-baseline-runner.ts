#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReadOptions } from './src/pdf/autoReadPolicy.ts';
import { PdfSessionScope } from './src/pdf/pdfSession.ts';
import { processSingleSource } from './src/pdf/readCoordinator.ts';
import { canonicalDocumentMapResult } from './v3014-document-map-projection.ts';

const [corpusPath, fixtureDir] = process.argv.slice(2);
if (!corpusPath || !fixtureDir) throw new Error('usage: runner <corpus.json> <fixture-dir>');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as {
  cases: Array<{ id: string; input: Record<string, unknown> }>;
};
const expectations: Record<string, unknown> = {};
for (const entry of corpus.cases) {
  const input = structuredClone(entry.input);
  const sources = input.sources as Array<Record<string, unknown>>;
  for (const source of sources) {
    if (typeof source.fixture === 'string') {
      source.path = join(fixtureDir, source.fixture);
      delete source.fixture;
    }
  }
  const options = buildReadOptions(input as never);
  const result = await processSingleSource(sources[0]!, options, new PdfSessionScope());
  if (!result.success || !result.data) throw new Error(result.error ?? `${entry.id} failed`);
  expectations[entry.id] = canonicalDocumentMapResult(result.data);
}
console.log(JSON.stringify(expectations));
