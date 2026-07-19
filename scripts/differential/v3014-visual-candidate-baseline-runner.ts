#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPdf } from './src/handlers/readPdf.ts';
import { canonicalVisualCandidateResult } from './v3014-visual-candidate-projection.ts';

for (const key of ['MCP_PDF_REGION_ANALYSIS_COMMAND', 'MCP_PDF_REGION_ANALYSIS_HTTP_URL', 'MCP_PDF_REGION_ANALYSIS_PRESET']) delete process.env[key];
const [corpusPath, fixtureDir] = process.argv.slice(2);
if (!corpusPath || !fixtureDir) throw new Error('usage: runner <corpus.json> <fixture-dir>');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as { cases: Array<{ id: string; fixture: string; input: Record<string, unknown> }> };
const expectations: Record<string, unknown> = {};
for (const entry of corpus.cases) {
  const input = structuredClone(entry.input);
  const source = (input.sources as Array<Record<string, unknown>>)[0];
  if (!source) throw new Error(`${entry.id} lacks source`);
  source.path = join(fixtureDir, entry.fixture);
  const raw = await readPdf.handler({ input: input as never, ctx: {} });
  expectations[entry.id] = canonicalVisualCandidateResult(Array.isArray(raw) ? { content: raw } : raw);
}
console.log(JSON.stringify(expectations));
