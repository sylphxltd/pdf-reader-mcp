import fs from 'node:fs';

const inputPath = process.argv[2] ?? '';
const page = process.argv[3] ?? 'unknown';
const regionId = process.argv[4] ?? 'unknown-region';
const languages = process.argv[5] ?? '';

if (!fs.existsSync(inputPath)) {
  console.error('input image missing');
  process.exit(2);
}

const writeJson = (value) => {
  process.stdout.write(JSON.stringify(value));
};

if (regionId === 'cert-table') {
  writeJson({
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
  });
  process.exit(0);
}

if (regionId === 'cert-formula') {
  writeJson({
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
  });
  process.exit(0);
}

if (regionId === 'cert-chart') {
  writeJson({
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
  });
  process.exit(0);
}

if (regionId === 'cert-figure') {
  writeJson({
    kind: 'figure',
    description: 'Certification fixture pipeline figure with connected stages.',
    text: 'Pipeline figure: ingest, analyze, cite.',
    markdown: 'Figure: ingest -> analyze -> cite',
    confidence: 0.89,
  });
  process.exit(0);
}

if (regionId === 'cert-image') {
  writeJson({
    kind: 'image',
    description: 'Certification fixture office image with a framed landscape illustration.',
    text: 'Office image: framed landscape with mountain shapes.',
    markdown: 'Image description: framed landscape with mountain shapes.',
    confidence: 0.88,
  });
  process.exit(0);
}

if (regionId === 'cert-table-status') {
  writeJson({
    kind: 'table',
    description: 'Certification fixture task status table with owners.',
    text: 'Task Owner Status Extract Agent Ready Cite Reviewer Passed',
    markdown:
      '| Task | Owner | Status |\\n| --- | --- | --- |\\n| Extract | Agent | Ready |\\n| Cite | Reviewer | Passed |',
    confidence: 0.93,
    table: {
      rows: [
        ['Task', 'Owner', 'Status'],
        ['Extract', 'Agent', 'Ready'],
        ['Cite', 'Reviewer', 'Passed'],
      ],
      row_count: 3,
      column_count: 3,
      cells: [
        {
          text: 'Task',
          row_index: 0,
          column_index: 0,
          bounding_box: { left: 60, bottom: 685, right: 205, top: 720 },
          confidence: 0.95,
        },
        {
          text: 'Owner',
          row_index: 0,
          column_index: 1,
          bounding_box: { left: 205, bottom: 685, right: 355, top: 720 },
          confidence: 0.95,
        },
        {
          text: 'Status',
          row_index: 0,
          column_index: 2,
          bounding_box: { left: 355, bottom: 685, right: 500, top: 720 },
          confidence: 0.95,
        },
        {
          text: 'Extract',
          row_index: 1,
          column_index: 0,
          bounding_box: { left: 60, bottom: 650, right: 205, top: 685 },
          confidence: 0.94,
        },
        {
          text: 'Agent',
          row_index: 1,
          column_index: 1,
          bounding_box: { left: 205, bottom: 650, right: 355, top: 685 },
          confidence: 0.94,
        },
        {
          text: 'Ready',
          row_index: 1,
          column_index: 2,
          bounding_box: { left: 355, bottom: 650, right: 500, top: 685 },
          confidence: 0.94,
        },
      ],
      confidence: 0.92,
    },
  });
  process.exit(0);
}

if (regionId === 'cert-formula-pythagorean') {
  writeJson({
    kind: 'formula',
    description: 'Certification fixture pythagorean formula.',
    text: 'a^2 + b^2 = c^2',
    confidence: 0.91,
    formula: {
      latex: 'a^2 + b^2 = c^2',
      mathml:
        '<math><msup><mi>a</mi><mn>2</mn></msup><mo>+</mo><msup><mi>b</mi><mn>2</mn></msup><mo>=</mo><msup><mi>c</mi><mn>2</mn></msup></math>',
      asciimath: 'a^2 + b^2 = c^2',
      text: 'a squared plus b squared equals c squared',
      confidence: 0.9,
    },
  });
  process.exit(0);
}

if (regionId === 'cert-chart-latency') {
  writeJson({
    kind: 'chart',
    description: 'Certification fixture latency chart.',
    text: 'Latency by Stage Parse Index Answer',
    confidence: 0.9,
    chart: {
      title: 'Latency by Stage',
      summary: 'Latency decreases from parse to answer.',
      data_points: [
        { stage: 'Parse', value: 130 },
        { stage: 'Index', value: 88 },
        { stage: 'Answer', value: 52 },
      ],
      x_axis: { label: 'Stage' },
      y_axis: { label: 'Latency', unit: 'ms', min: 0, max: 150 },
      series: [
        {
          name: 'Latency',
          data_points: [
            { stage: 'Parse', value: 130 },
            { stage: 'Index', value: 88 },
            { stage: 'Answer', value: 52 },
          ],
          confidence: 0.88,
        },
      ],
      confidence: 0.88,
    },
  });
  process.exit(0);
}

if (regionId === 'cert-figure-decision') {
  writeJson({
    kind: 'figure',
    description: 'Certification fixture decision flow with connected stages.',
    text: 'Decision flow: parse, verify, cite.',
    markdown: 'Figure: parse -> verify -> cite',
    confidence: 0.89,
  });
  process.exit(0);
}

if (regionId === 'cert-image-dashboard') {
  writeJson({
    kind: 'image',
    description: 'Certification fixture dashboard heatmap image.',
    text: 'Dashboard heatmap image with four highlighted cells.',
    markdown: 'Image description: dashboard heatmap with four highlighted cells.',
    confidence: 0.88,
  });
  process.exit(0);
}

writeJson({
  kind: 'unknown',
  description: `Reference provider has no certification profile for ${regionId} on page ${page}.`,
  confidence: 0.5,
  warnings: languages ? [`languages=${languages}`] : [],
});
