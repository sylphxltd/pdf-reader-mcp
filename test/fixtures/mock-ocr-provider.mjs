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
    text: `Mock OCR text for page ${page}`,
    confidence: 0.93,
    language: languages.split(',').filter(Boolean)[0] ?? 'eng',
    words: [
      {
        text: 'Mock',
        confidence: 0.95,
        bounding_box: { left: 0, bottom: 0, right: 20, top: 10 },
      },
    ],
  })
);
