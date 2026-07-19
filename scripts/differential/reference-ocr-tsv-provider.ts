#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [input, page = '0', languages = '', mode = 'valid-tsv'] = process.argv.slice(2);
if (!input) throw new Error('usage: reference-ocr-tsv-provider <input.png> <page> <languages> <mode>');
if (mode === 'fail') process.exit(7);

const png = PNG.sync.read(readFileSync(input));
const height = png.height;

if (mode === 'malformed-tsv') {
  process.stdout.write('not\ta\theader\nrow');
  process.exit(0);
}

// Tesseract TSV header + two word rows (level 5) in image coordinates.
// Image height is used by parser to convert top-left to bottom-left boxes.
const header =
  'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
const word1 = `5\t1\t1\t1\t1\t1\t20\t10\t40\t20\t91\tTsv`;
const word2 = `5\t1\t1\t1\t1\t2\t70\t10\t50\t20\t88\tPage${page}`;
const noise = `4\t1\t1\t1\t1\t0\t0\t0\t10\t10\t-1\t`;
process.stdout.write(`${header}\n${noise}\n${word1}\n${word2}\n`);
// keep height referenced so fixture-dependent behavior is intentional
if (height <= 0) throw new Error('invalid image height');
