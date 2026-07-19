#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [input, page = '0', languages = '', mode = 'resume-words'] = process.argv.slice(2);
if (!input) {
  throw new Error(
    'usage: reference-ocr-search-interleave-provider <input.png> <page> <languages> <mode>'
  );
}
if (mode === 'fail') process.exit(7);

const png = PNG.sync.read(readFileSync(input));
const language = languages ? languages.split(',')[0] : undefined;

if (mode === 'resume-words') {
  process.stdout.write(
    JSON.stringify({
      text: `OCR résumé token-${page}`,
      confidence: 88,
      words: [
        {
          text: 'OCR',
          confidence: 90,
          bounding_box: { left: 20, bottom: 40, right: 60, top: 60 },
        },
        {
          text: 'résumé',
          confidence: 91,
          bounding_box: { left: 80, bottom: 40, right: 160, top: 60 },
        },
        {
          text: `token-${page}`,
          confidence: 89,
          bounding_box: { left: 180, bottom: 40, right: 280, top: 60 },
        },
      ],
      ...(language ? { language } : {}),
      _image: { width: png.width, height: png.height },
    })
  );
  process.exit(0);
}

if (mode === 'unique-token') {
  process.stdout.write(
    JSON.stringify({
      text: `UniqueOCRToken page ${page}`,
      confidence: 87,
      words: [
        {
          text: 'UniqueOCRToken',
          confidence: 92,
          bounding_box: { left: 20, bottom: 10, right: 200, top: 30 },
        },
      ],
      ...(language ? { language } : {}),
    })
  );
  process.exit(0);
}

if (mode === 'multi-resume') {
  // two OCR matches for résumé via repeated page text
  process.stdout.write(
    JSON.stringify({
      text: 'OCR résumé and another résumé here',
      confidence: 86,
      words: [
        { text: 'OCR', confidence: 90, bounding_box: { left: 20, bottom: 80, right: 50, top: 100 } },
        {
          text: 'résumé',
          confidence: 91,
          bounding_box: { left: 60, bottom: 80, right: 140, top: 100 },
        },
        {
          text: 'and',
          confidence: 90,
          bounding_box: { left: 150, bottom: 80, right: 190, top: 100 },
        },
        {
          text: 'another',
          confidence: 90,
          bounding_box: { left: 200, bottom: 80, right: 280, top: 100 },
        },
        {
          text: 'résumé',
          confidence: 91,
          bounding_box: { left: 290, bottom: 80, right: 370, top: 100 },
        },
        {
          text: 'here',
          confidence: 90,
          bounding_box: { left: 380, bottom: 80, right: 430, top: 100 },
        },
      ],
      ...(language ? { language } : {}),
    })
  );
  process.exit(0);
}

throw new Error(`unsupported interleave provider mode: ${mode}`);
