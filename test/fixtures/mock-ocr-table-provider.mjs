import fs from 'node:fs';

const inputPath = process.argv[2] ?? '';
const page = process.argv[3] ?? 'unknown';
const languages = process.argv[4] ?? '';

if (!fs.existsSync(inputPath)) {
  console.error('input image missing');
  process.exit(2);
}

process.stdout.write(
  JSON.stringify({
    text: `Metric Value\nRevenue 24%\nCost $10\nPage ${page}`,
    confidence: 0.92,
    language: languages.split(',').filter(Boolean)[0] ?? 'eng',
    words: [
      {
        text: 'Metric',
        confidence: 0.95,
        bounding_box: { left: 80, bottom: 1400, right: 176, top: 1420 },
      },
      {
        text: 'Value',
        confidence: 0.94,
        bounding_box: { left: 320, bottom: 1400, right: 404, top: 1420 },
      },
      {
        text: 'Revenue',
        confidence: 0.93,
        bounding_box: { left: 80, bottom: 1360, right: 200, top: 1380 },
      },
      {
        text: '24%',
        confidence: 0.91,
        bounding_box: { left: 320, bottom: 1360, right: 368, top: 1380 },
      },
      {
        text: 'Cost',
        confidence: 0.9,
        bounding_box: { left: 80, bottom: 1320, right: 144, top: 1340 },
      },
      {
        text: '$10',
        confidence: 0.89,
        bounding_box: { left: 320, bottom: 1320, right: 372, top: 1340 },
      },
    ],
  })
);
