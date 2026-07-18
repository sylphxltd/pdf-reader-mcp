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

const box = (value: unknown): unknown => {
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
const canonChar = (value: Record<string, unknown>) => ({
  text: String(value.text),
  char_start: Number(value.char_start),
  char_end: Number(value.char_end),
  run_index: Number(value.run_index),
  is_whitespace: Boolean(value.is_whitespace),
  bounding_box: box(value.bounding_box),
  bounding_box_level: value.bounding_box_level ?? null,
});
const canonWord = (value: Record<string, unknown>) => ({
  text: String(value.text),
  char_start: Number(value.char_start),
  char_end: Number(value.char_end),
  bounding_box: box(value.bounding_box),
  bounding_box_level: value.bounding_box_level ?? null,
});
const canonRun = (value: Record<string, unknown>) => ({
  text: String(value.text),
  char_start: Number(value.char_start),
  char_end: Number(value.char_end),
  bounding_box: box(value.bounding_box),
  chars: ((value.chars ?? []) as Array<Record<string, unknown>>).map(canonChar),
});
const canonical = (data: Record<string, unknown>) => {
  const layer = data.text_layer as Record<string, unknown>;
  const pages = (layer.pages ?? []) as Array<Record<string, unknown>>;
  const summary = layer.summary as Record<string, unknown>;
  return {
    text_layer: {
      version: layer.version,
      profile: layer.profile,
      pages: pages.map((page) => ({
        page: Number(page.page),
        text: String(page.text),
        char_count: Number(page.char_count),
        line_count: Number(page.line_count),
        word_count: Number(page.word_count),
        lines: ((page.lines ?? []) as Array<Record<string, unknown>>).map((line) => ({
          text: String(line.text),
          char_start: Number(line.char_start),
          char_end: Number(line.char_end),
          bounding_box: box(line.bounding_box),
          runs: ((line.runs ?? []) as Array<Record<string, unknown>>).map(canonRun),
          words: ((line.words ?? []) as Array<Record<string, unknown>>).map(canonWord),
          chars: ((line.chars ?? []) as Array<Record<string, unknown>>).map(canonChar),
        })),
      })),
      summary: {
        selected_pages: summary.selected_pages,
        page_count: Number(summary.page_count),
        run_count: Number(summary.run_count),
        line_count: Number(summary.line_count),
        word_count: Number(summary.word_count),
        char_count: Number(summary.char_count),
        chars_with_bounding_boxes: Number(summary.chars_with_bounding_boxes),
        runs_with_bounding_boxes: Number(summary.runs_with_bounding_boxes),
        lines_with_bounding_boxes: Number(summary.lines_with_bounding_boxes),
        words_with_bounding_boxes: Number(summary.words_with_bounding_boxes),
      },
    },
    elements: ((data.elements ?? []) as Array<Record<string, unknown>>)
      .filter((element) => element.type === 'text')
      .map((element) => ({
        page: Number(element.page),
        content: String(element.content),
        bounding_box: box(element.bounding_box),
      })),
    chunks: ((data.chunks ?? []) as Array<Record<string, unknown>>).map((chunk) => ({
      bounding_boxes: ((chunk.bounding_boxes ?? []) as unknown[]).map(box),
    })),
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
