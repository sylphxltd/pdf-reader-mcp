#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPdf } from './src/handlers/readPdf.ts';
import { canonicalRasterImageResult } from './v3014-raster-image-projection.ts';

const [corpusPath, fixtureDir] = process.argv.slice(2);
if (!corpusPath || !fixtureDir) throw new Error('usage: runner <corpus.json> <fixture-dir>');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as {
  cases: Array<{ id: string; fixture: string; input: Record<string, unknown> }>;
};

const expectations: Record<string, unknown> = {};
for (const entry of corpus.cases) {
  const input = structuredClone(entry.input);
  const sources = input.sources as Array<Record<string, unknown>>;
  const source = sources[0];
  if (!source) throw new Error(`${entry.id} lacks source`);
  source.path = join(fixtureDir, entry.fixture);
  const raw = await readPdf.handler({ input: input as never, ctx: {} });
  const result = Array.isArray(raw) ? { content: raw } : raw;
  expectations[entry.id] = canonicalRasterImageResult(result);
}
console.log(JSON.stringify(expectations));
