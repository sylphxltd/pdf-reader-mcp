#!/usr/bin/env bun

import { appendFileSync, readFileSync } from 'node:fs';

const [
  input,
  page = '',
  regionId = '',
  evidenceId = '',
  languages = '',
  mode = 'success',
  marker = '',
] = process.argv.slice(2);

if (!input) process.exit(2);
readFileSync(input);

if (marker) {
  appendFileSync(marker, `${regionId || 'unknown'}\n`);
}

if (mode === 'fail') process.exit(7);
if (mode === 'fail-second') {
  // Fail the second admitted caption region while accepting the first.
  if (regionId.includes('chart') || regionId.includes('p3-')) process.exit(7);
}
if (mode === 'sleep') await Bun.sleep(60_000);

if (regionId.includes('table') || page === '1') {
  process.stdout.write(
    JSON.stringify({
      kind: 'table',
      description: ` fused table ${regionId} `,
      text: ' Metric Value ',
      markdown: ' |Metric|Value| ',
      confidence: 91,
      warnings: [' provider note ', '', 3],
      table: {
        rows: [
          ['Metric', 'Value'],
          ['Revenue', '24%'],
        ],
        markdown: ' |Metric|Value| ',
        csv: ' Metric,Value ',
        confidence: 92,
      },
    })
  );
  process.exit(0);
}

if (regionId.includes('figure') || regionId.includes('chart')) {
  const kind = regionId.includes('chart') ? 'chart' : 'figure';
  process.stdout.write(
    JSON.stringify({
      kind,
      description: ` fused ${kind} page ${page} ${evidenceId} `,
      text: ` ${kind} body `,
      confidence: 88,
      warnings: [' caption analysis ', '', 2],
      ...(kind === 'chart'
        ? {
            chart: {
              title: ' Sales ',
              summary: ' Trend ',
              data_points: [{ x: 1, y: 2 }],
              confidence: 87,
            },
          }
        : {}),
    })
  );
  process.exit(0);
}

process.stdout.write(
  JSON.stringify({
    kind: 'unknown',
    description: ` region ${regionId} languages ${languages} `,
    confidence: 70,
  })
);
