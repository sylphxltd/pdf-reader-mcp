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
      row_count: 2,
      column_count: 2,
      cells: [
        {
          text: 'Metric',
          row_index: 0,
          column_index: 0,
          bounding_box: { left: 10, bottom: 100, right: 50, top: 120 },
          confidence: 0.95,
        },
        {
          text: 'Value',
          row_index: 0,
          column_index: 1,
          bounding_box: { left: 50, bottom: 100, right: 100, top: 120 },
          confidence: 0.94,
        },
        {
          text: 'Page',
          row_index: 1,
          column_index: 0,
          row_span: 1,
          column_span: 1,
          bounding_box: { left: 10, bottom: 80, right: 50, top: 100 },
          confidence: 0.93,
        },
        {
          text: page,
          row_index: 1,
          column_index: 1,
          bounding_box: { left: 50, bottom: 80, right: 100, top: 100 },
          confidence: 0.92,
        },
      ],
      markdown: `| Metric | Value |\\n| --- | --- |\\n| Page | ${page} |`,
      confidence: 0.9,
    },
    formula: {
      latex: 'x^2 + y^2 = z^2',
      mathml: '<math><msup><mi>x</mi><mn>2</mn></msup></math>',
      asciimath: 'x^2 + y^2 = z^2',
      confidence: 0.82,
    },
    chart: {
      title: 'Mock Chart',
      summary: 'One mock data point.',
      data_points: [{ label: 'A', value: 1 }],
      x_axis: { label: 'Category' },
      y_axis: { label: 'Value', min: 0, max: 2 },
      series: [{ name: 'Series A', data_points: [{ label: 'A', value: 1 }], confidence: 0.8 }],
      confidence: 0.78,
    },
    warnings: languages ? [`languages=${languages}`] : [],
  })
);
