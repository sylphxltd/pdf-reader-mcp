#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [input, page = '0', languages = '', mode = 'plain-text'] = process.argv.slice(2);
if (!input) throw new Error('usage: reference-ocr-residual-provider <input.png> <page> <languages> <mode>');
if (mode === 'fail') process.exit(7);

const png = PNG.sync.read(readFileSync(input));
const language = languages ? languages.split(',')[0] : undefined;
const text =
  page === '6'
    ? `Residual OCR page ${page} should be truncated`
    : `Residual OCR page ${page} at ${String(png.width)}x${String(png.height)}`;

if (mode === 'plain-text') {
  process.stdout.write(text);
  process.exit(0);
}

if (mode === 'json-text-only') {
  process.stdout.write(
    JSON.stringify({
      text,
      confidence: 81,
      ...(language ? { language } : {}),
    })
  );
  process.exit(0);
}

if (mode === 'success-words') {
  process.stdout.write(
    JSON.stringify({
      text,
      confidence: 87,
      words: [
        {
          text: 'Residual',
          confidence: 90,
          bounding_box: { left: 20, bottom: 10, right: 100, top: 30 },
        },
      ],
      ...(language ? { language } : {}),
    })
  );
  process.exit(0);
}

throw new Error(`unsupported residual OCR provider mode: ${mode}`);
