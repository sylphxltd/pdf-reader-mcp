#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReadOptions } from './src/pdf/autoReadPolicy.ts';
import { PdfSessionScope } from './src/pdf/pdfSession.ts';
import { processSingleSource } from './src/pdf/readCoordinator.ts';
import { defaultSearchPdfOptions, searchPdfSource } from './src/pdf/search.ts';

const [corpusPath, fixtureDir] = process.argv.slice(2);
if (!corpusPath || !fixtureDir) throw new Error('usage: runner <corpus.json> <fixture-dir>');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as {
  cases: Array<{ id: string; tool: string; input: Record<string, unknown> }>;
};
const normalizeText = (value: string): string =>
  value.replaceAll('\r\n', '\n').normalize('NFC');

function materialize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(materialize);
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key === 'fixture' ? 'path' : key] =
        key === 'fixture' && typeof entry === 'string' ? join(fixtureDir, entry) : materialize(entry);
    }
    return output;
  }
  return value;
}

function category(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('file not found') || lower.includes('no such file')) return 'file_not_found';
  if (lower.includes('failed to load pdf') || lower.includes('invalid pdf')) return 'invalid_pdf';
  return 'unknown_error';
}

function canonicalWarnings(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.map((warning) => {
    const text = String(warning);
    const match = text.match(/page numbers?\s+([0-9, ]+).*?total pages\s*\(([0-9]+)\)/i);
    return match
      ? {
          category: 'page_out_of_range',
          requested: match[1]!.split(',').map((part) => Number(part.trim())),
          total: Number(match[2]),
        }
      : { category: 'unknown_warning' };
  });
}

async function readCase(id: string, input: Record<string, unknown>) {
  const sources = input.sources as Array<Record<string, unknown>>;
  const options = buildReadOptions(input as never);
  const results = [];
  const session = new PdfSessionScope();
  for (const source of sources) results.push(await processSingleSource(source, options, session));
  if (id === 'read-mixed-source-partial') {
    return {
      outcome: 'success',
      results: results.map((result) =>
        result.success
          ? { success: true, num_pages: result.data?.num_pages }
          : { success: false, category: category(result.error ?? '') }
      ),
    };
  }
  const first = results[0]!;
  if (!first.success) return { outcome: 'error', category: category(first.error ?? '') };
  const output: Record<string, unknown> = {
    outcome: 'success',
    num_pages: first.data?.num_pages,
  };
  if (id === 'read-all-metadata') {
    output.info = Object.fromEntries(
      ['PDFFormatVersion', 'Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer'].map(
        (key) => [key, first.data?.info?.[key] ?? null]
      )
    );
    output.full_text = normalizeText(first.data?.full_text ?? '');
  }
  if (id.startsWith('read-pages-')) {
    output.page_texts = (first.data?.page_texts ?? []).map((page) => ({
      page: page.page,
      text: normalizeText(page.text),
    }));
  }
  if (id === 'read-page-signals') {
    output.page_geometry = first.data?.page_geometry ?? null;
    output.annotations = first.data?.annotations ?? null;
  }
  if (id === 'read-catalog-signals') {
    output.outline = first.data?.outline ?? null;
    output.page_labels = first.data?.page_labels ?? null;
    output.permissions = first.data?.permissions ?? null;
    output.mark_info = first.data?.mark_info ?? null;
  }
  if (id === 'read-forms') {
    output.form_fields = first.data?.form_fields ?? null;
    output.attachments = first.data?.attachments ?? null;
  }
  if (id === 'read-attachments') {
    output.attachments = first.data?.attachments ?? null;
    output.form_fields = first.data?.form_fields ?? null;
  }
  output.warnings = canonicalWarnings(first.data?.warnings);
  return output;
}

async function searchCase(input: Record<string, unknown>) {
  const source = (input.sources as Array<Record<string, unknown>>)[0]!;
  const query = String(input.query);
  const result = await searchPdfSource(source, {
    ...defaultSearchPdfOptions(query),
    case_sensitive: Boolean(input.case_sensitive),
    whole_word: Boolean(input.whole_word),
    context_chars: Number(input.context_chars ?? 0),
    max_pages: Number(input.max_pages ?? 10),
    max_matches_per_source: Number(input.max_matches_per_source ?? 50),
    prefer_speed: false,
  });
  if (!result.success) return { outcome: 'error', category: category(result.error ?? '') };
  return {
    outcome: 'success',
    num_pages: result.num_pages,
    searched_pages: result.searched_pages,
    matches: (result.matches ?? []).map((match) => ({
      page: match.page,
      text: normalizeText(match.text),
      match_start: match.match_start,
      match_end: match.match_end,
      text_item_index: match.text_item_index,
    })),
  };
}

const expectations: Record<string, unknown> = {};
for (const entry of corpus.cases) {
  const input = materialize(entry.input) as Record<string, unknown>;
  expectations[entry.id] =
    entry.tool === 'read_pdf' ? await readCase(entry.id, input) : await searchCase(input);
}
console.log(JSON.stringify(expectations));
