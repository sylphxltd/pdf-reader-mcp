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

const box = (value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const coordinate = (key: string): number => Math.round(Number(record[key]) * 1e9) / 1e9;
  return {
    left: coordinate('left'),
    bottom: coordinate('bottom'),
    right: coordinate('right'),
    top: coordinate('top'),
  };
};

const canonChunk = (chunk: Record<string, unknown>) => ({
  id: String(chunk.id),
  page_start: Number(chunk.page_start),
  page_end: Number(chunk.page_end),
  text: String(chunk.text),
  element_ids: (chunk.element_ids ?? []) as unknown[],
  ...(chunk.strategy === undefined ? {} : { strategy: String(chunk.strategy) }),
  ...(chunk.heading === undefined ? {} : { heading: String(chunk.heading) }),
  ...(chunk.bounding_boxes === undefined
    ? {}
    : { bounding_boxes: (chunk.bounding_boxes as unknown[]).map(box) }),
});

const canonical = (data: Record<string, unknown>) => {
  const map = data.document_map as Record<string, unknown> | undefined;
  return {
    has_chunks: Object.hasOwn(data, 'chunks'),
    has_elements: Object.hasOwn(data, 'elements'),
    chunks: ((data.chunks ?? []) as Array<Record<string, unknown>>).map(canonChunk),
    elements: ((data.elements ?? []) as Array<Record<string, unknown>>).map((element) => ({
      id: String(element.id),
      type: String(element.type),
      page: Number(element.page),
      content: String(element.content),
      ...(element.bounding_box === undefined ? {} : { bounding_box: box(element.bounding_box) }),
      ...(element.semantic_hint && typeof element.semantic_hint === 'object'
        ? {
            semantic_role: String(
              (element.semantic_hint as Record<string, unknown>).role ?? ''
            ),
          }
        : {}),
    })),
    document_map:
      map === undefined
        ? null
        : {
            chunks: ((map.chunks ?? []) as Array<Record<string, unknown>>).map(canonChunk),
            pages: ((map.pages ?? []) as Array<Record<string, unknown>>).map((page) => ({
              page: Number(page.page),
              chunk_ids: (page.chunk_ids ?? []) as unknown[],
            })),
          },
  };
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
  expectations[entry.id] = canonical(result.data as unknown as Record<string, unknown>);
}
console.log(JSON.stringify(expectations));
