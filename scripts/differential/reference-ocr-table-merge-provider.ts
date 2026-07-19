#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [input, page = '1', _languages = '', mode = 'distinct'] = process.argv.slice(2);
if (!input) throw new Error('usage: reference-ocr-table-merge-provider <input.png> <page> <languages> <mode>');
if (mode === 'fail') process.exit(7);

const png = PNG.sync.read(readFileSync(input));
const pageNum = Number(page);

// Provider boxes are image-space; runtime divides by render scale (2) into PDF coords.
const grid = (originLeft: number, originBottom: number, labels: string[][]) => {
  const words: Array<Record<string, unknown>> = [];
  const rowH = 40;
  const colW = 120;
  for (let r = 0; r < labels.length; r += 1) {
    for (let c = 0; c < labels[r]!.length; c += 1) {
      const left = originLeft + c * colW;
      const bottom = originBottom - r * rowH;
      const right = left + 80;
      const top = bottom + 24;
      words.push({
        text: labels[r]![c],
        confidence: 92,
        bounding_box: { left, bottom, right, top },
      });
    }
  }
  return words;
};

let words: Array<Record<string, unknown>> = [];
let text = '';
if (mode === 'overlap') {
  // PDF target ~ left 80-360, bottom 90-150 (inside selectable page-1 table)
  words = grid(160, 280, [
    ['Metric', 'Value', 'Region'],
    ['Dup', '999', 'West'],
  ]);
  text = 'Metric Value Region\nDup 999 West';
} else if (mode === 'distinct') {
  // PDF target ~ left 500-740, bottom 200-260 (outside selectable table)
  words = grid(1000, 520, [
    ['Alpha', 'Beta'],
    ['Gamma', 'Delta'],
  ]);
  text = 'Alpha Beta\nGamma Delta';
} else if (mode === 'page3-only') {
  words = grid(160, 1400, [
    ['Metric', 'Value'],
    ['Revenue', '24%'],
  ]);
  text = 'Metric Value\nRevenue 24%';
} else {
  throw new Error(`unsupported mode ${mode}`);
}

process.stdout.write(
  JSON.stringify({
    text,
    confidence: 87,
    words,
    language: 'eng',
    _image: { width: png.width, height: png.height, page: pageNum },
  })
);
