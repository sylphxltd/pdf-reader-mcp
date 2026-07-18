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

const coordinate = (value: unknown): number => Math.round(Number(value) * 1e9) / 1e9;
const box = (value: unknown) => {
  const record = value as Record<string, unknown>;
  return {
    left: coordinate(record.left),
    bottom: coordinate(record.bottom),
    right: coordinate(record.right),
    top: coordinate(record.top),
  };
};
const hint = (value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  return {
    role: String(record.role),
    confidence: Number(record.confidence),
    signals: (record.signals ?? []) as unknown[],
    ...(record.level === undefined ? {} : { level: Number(record.level) }),
  };
};
const node = (value: Record<string, unknown>): Record<string, unknown> => ({
  id: String(value.id),
  type: String(value.type),
  page_start: Number(value.page_start),
  page_end: Number(value.page_end),
  element_ids: (value.element_ids ?? []) as unknown[],
  ...(value.chunk_ids === undefined ? {} : { chunk_ids: value.chunk_ids as unknown[] }),
  ...(value.bounding_boxes === undefined
    ? {}
    : { bounding_boxes: (value.bounding_boxes as unknown[]).map(box) }),
  ...(value.title === undefined ? {} : { title: String(value.title) }),
  ...(value.text === undefined ? {} : { text: String(value.text) }),
  ...(value.level === undefined ? {} : { level: Number(value.level) }),
  ...(value.semantic_role === undefined ? {} : { semantic_role: String(value.semantic_role) }),
  ...(value.section_path === undefined
    ? {}
    : {
        section_path: (value.section_path as Array<Record<string, unknown>>).map((entry) => ({
          id: String(entry.id),
          title: String(entry.title),
          level: Number(entry.level),
          page_start: Number(entry.page_start),
        })),
      }),
  ...(value.continued_from_section_id === undefined
    ? {}
    : { continued_from_section_id: String(value.continued_from_section_id) }),
  ...(value.children === undefined
    ? {}
    : { children: (value.children as Array<Record<string, unknown>>).map(node) }),
});
const canonical = (data: Record<string, unknown>) => {
  const ast = data.document_ast as Record<string, unknown> | undefined;
  return {
    has_document_ast: Object.hasOwn(data, 'document_ast'),
    has_elements: Object.hasOwn(data, 'elements'),
    has_chunks: Object.hasOwn(data, 'chunks'),
    elements: ((data.elements ?? []) as Array<Record<string, unknown>>).map((element) => ({
      id: String(element.id),
      type: String(element.type),
      page: Number(element.page),
      content: String(element.content),
      ...(element.bounding_box === undefined ? {} : { bounding_box: box(element.bounding_box) }),
      semantic_hint: hint(element.semantic_hint),
    })),
    chunks: ((data.chunks ?? []) as Array<Record<string, unknown>>).map((chunk) => ({
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
    })),
    document_ast:
      ast === undefined
        ? null
        : {
            version: String(ast.version),
            profile: String(ast.profile),
            root: node(ast.root as Record<string, unknown>),
            summary: ast.summary as Record<string, unknown>,
            ...(ast.warnings === undefined ? {} : { warnings: ast.warnings as unknown[] }),
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
