import fs from 'node:fs';

const inputPath = process.argv[2] ?? '';
const page = process.argv[3] ?? 'unknown';
const regionId = process.argv[4] ?? 'unknown-region';
const languages = process.argv[5] ?? '';

if (!fs.existsSync(inputPath)) {
  console.error('input image missing');
  process.exit(2);
}

if (regionId === 'plain') {
  process.stdout.write(`Plain analysis for page ${page}`);
  process.exit(0);
}

if (regionId === 'unsupported-kind') {
  process.stdout.write(
    JSON.stringify({
      kind: 'heatmap',
      description: 'Unsupported kind should be normalized.',
      confidence: 91,
    })
  );
  process.exit(0);
}

process.stdout.write(
  JSON.stringify({
    kind: 'table',
    description: `Mock region analysis for ${regionId} on page ${page}`,
    text: `Mock region text for ${regionId}`,
    markdown: `| Metric | Value |\\n| --- | --- |\\n| Page | ${page} |`,
    confidence: 0.91,
    table: {
      rows: [
        ['Metric', 'Value'],
        ['Page', page],
      ],
      markdown: `| Metric | Value |\\n| --- | --- |\\n| Page | ${page} |`,
      confidence: 0.9,
    },
    formula: {
      latex: 'x^2 + y^2 = z^2',
      confidence: 0.82,
    },
    chart: {
      title: 'Mock Chart',
      summary: 'One mock data point.',
      data_points: [{ label: 'A', value: 1 }],
      confidence: 0.78,
    },
    warnings: languages ? [`languages=${languages}`] : [],
  })
);
