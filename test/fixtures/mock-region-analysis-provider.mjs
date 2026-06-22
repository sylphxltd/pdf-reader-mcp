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

if (regionId === 'cert-table') {
  process.stdout.write(
    JSON.stringify({
      kind: 'table',
      description: 'Certification fixture table with metric values.',
      text: 'Metric Value Revenue $1.2M Users 4200',
      markdown: '| Metric | Value |\\n| --- | --- |\\n| Revenue | $1.2M |\\n| Users | 4200 |',
      confidence: 0.94,
      table: {
        rows: [
          ['Metric', 'Value'],
          ['Revenue', '$1.2M'],
          ['Users', '4200'],
        ],
        row_count: 3,
        column_count: 2,
        cells: [
          {
            text: 'Metric',
            row_index: 0,
            column_index: 0,
            bounding_box: { left: 60, bottom: 680, right: 240, top: 720 },
            confidence: 0.96,
          },
          {
            text: 'Value',
            row_index: 0,
            column_index: 1,
            bounding_box: { left: 240, bottom: 680, right: 420, top: 720 },
            confidence: 0.96,
          },
          {
            text: 'Revenue',
            row_index: 1,
            column_index: 0,
            bounding_box: { left: 60, bottom: 640, right: 240, top: 680 },
            confidence: 0.95,
          },
          {
            text: '$1.2M',
            row_index: 1,
            column_index: 1,
            bounding_box: { left: 240, bottom: 640, right: 420, top: 680 },
            confidence: 0.95,
          },
          {
            text: 'Users',
            row_index: 2,
            column_index: 0,
            bounding_box: { left: 60, bottom: 600, right: 240, top: 640 },
            confidence: 0.94,
          },
          {
            text: '4200',
            row_index: 2,
            column_index: 1,
            bounding_box: { left: 240, bottom: 600, right: 420, top: 640 },
            confidence: 0.94,
          },
        ],
        confidence: 0.93,
      },
    })
  );
  process.exit(0);
}

if (regionId === 'cert-formula') {
  process.stdout.write(
    JSON.stringify({
      kind: 'formula',
      description: 'Certification fixture formula.',
      text: 'E = mc^2',
      confidence: 0.92,
      formula: {
        latex: 'E = mc^2',
        mathml: '<math><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></math>',
        asciimath: 'E = mc^2',
        text: 'E equals m c squared',
        confidence: 0.91,
      },
    })
  );
  process.exit(0);
}

if (regionId === 'cert-chart') {
  process.stdout.write(
    JSON.stringify({
      kind: 'chart',
      description: 'Certification fixture chart.',
      text: 'Revenue by Quarter Q1 Q2 Q3',
      confidence: 0.9,
      chart: {
        title: 'Revenue by Quarter',
        summary: 'Revenue increases from Q1 to Q3.',
        data_points: [
          { quarter: 'Q1', value: 1.2 },
          { quarter: 'Q2', value: 1.8 },
          { quarter: 'Q3', value: 2.4 },
        ],
        x_axis: { label: 'Quarter' },
        y_axis: { label: 'Revenue', unit: 'USD millions', min: 0, max: 3 },
        series: [
          {
            name: 'Revenue',
            data_points: [
              { quarter: 'Q1', value: 1.2 },
              { quarter: 'Q2', value: 1.8 },
              { quarter: 'Q3', value: 2.4 },
            ],
            confidence: 0.88,
          },
        ],
        confidence: 0.88,
      },
    })
  );
  process.exit(0);
}

if (regionId === 'cert-figure') {
  process.stdout.write(
    JSON.stringify({
      kind: 'figure',
      description: 'Certification fixture pipeline figure with connected stages.',
      text: 'Pipeline figure: ingest, analyze, cite.',
      markdown: 'Figure: ingest -> analyze -> cite',
      confidence: 0.89,
    })
  );
  process.exit(0);
}

if (regionId === 'cert-image') {
  process.stdout.write(
    JSON.stringify({
      kind: 'image',
      description: 'Certification fixture office image with a framed landscape illustration.',
      text: 'Office image: framed landscape with mountain shapes.',
      markdown: 'Image description: framed landscape with mountain shapes.',
      confidence: 0.88,
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
