#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReadOptions } from './src/pdf/autoReadPolicy.ts';
import { PdfSessionScope } from './src/pdf/pdfSession.ts';
import { processSingleSource } from './src/pdf/readCoordinator.ts';

const [corpusPath, fixtureDir] = process.argv.slice(2);
if (!corpusPath || !fixtureDir) throw new Error('usage: runner <corpus.json> <fixture-dir>');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as {
  cases: Array<{ id: string; input: Record<string, unknown> }>;
};

const canonHint = (value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  const hint = value as Record<string, unknown>;
  return {
    role: String(hint.role),
    confidence: Number(hint.confidence),
    signals: (hint.signals ?? []) as unknown[],
    ...(hint.level === undefined ? {} : { level: Number(hint.level) }),
  };
};

const canonical = (data: Record<string, unknown>) => ({
  elements: ((data.elements ?? []) as Array<Record<string, unknown>>)
    .filter((element) => element.type === 'text')
    .map((element) => ({
      id: String(element.id),
      page: Number(element.page),
      content: String(element.content),
      semantic_hint: canonHint(element.semantic_hint),
    })),
  chunks: ((data.chunks ?? []) as Array<Record<string, unknown>>).map((chunk) => ({
    id: String(chunk.id),
    page_start: Number(chunk.page_start),
    page_end: Number(chunk.page_end),
    text: String(chunk.text),
    element_ids: (chunk.element_ids ?? []) as unknown[],
    ...(chunk.strategy === undefined ? {} : { strategy: String(chunk.strategy) }),
    ...(chunk.heading === undefined ? {} : { heading: String(chunk.heading) }),
  })),
});

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
  expectations[entry.id] = canonical(result.data as unknown as Record<string, unknown>);
}
console.log(JSON.stringify(expectations));
