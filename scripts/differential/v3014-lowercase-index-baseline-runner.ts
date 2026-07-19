#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultSearchPdfOptions, searchPdfSource } from './src/pdf/search.ts';
import { canonicalLowercaseIndexResult } from './v3014-lowercase-index-projection.ts';

const [corpusPath, fixtureDir] = process.argv.slice(2);
if (!corpusPath || !fixtureDir) throw new Error('usage: runner <corpus.json> <fixture-dir>');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as { localeContract: { defaultLocale: string; sentinel: string; lowercase: string }; cases: Array<{ id: string; fixture: string; input: Record<string, unknown> }> };
const locale = Intl.DateTimeFormat().resolvedOptions().locale;
if (locale !== corpus.localeContract.defaultLocale) throw new Error(`default locale must be ${corpus.localeContract.defaultLocale}, got ${locale}`);
if (corpus.localeContract.sentinel.toLocaleLowerCase() !== corpus.localeContract.lowercase) throw new Error('default-locale lowercase sentinel mismatch');
const expectations: Record<string, unknown> = {};
for (const entry of corpus.cases) {
  const { pages, ...rawOptions } = entry.input;
  const options = { ...defaultSearchPdfOptions(String(rawOptions.query)), ...rawOptions };
  expectations[entry.id] = canonicalLowercaseIndexResult(await searchPdfSource({ path: join(fixtureDir, entry.fixture), ...(pages !== undefined ? { pages } : {}) }, options as never));
}
console.log(JSON.stringify(expectations));
