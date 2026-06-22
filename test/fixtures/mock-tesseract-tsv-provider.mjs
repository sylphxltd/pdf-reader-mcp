import fs from 'node:fs';

const [, , inputPath] = process.argv;

if (!inputPath || !fs.existsSync(inputPath)) {
  console.error('Expected rendered page image path');
  process.exit(2);
}

process.stdout.write(
  [
    'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
    '1\t1\t0\t0\t0\t0\t0\t0\t2\t2\t-1\t',
    '5\t1\t1\t1\t1\t1\t0\t0\t1\t1\t95\tHello',
    '5\t1\t1\t1\t1\t2\t1\t1\t1\t1\t87\tWorld',
  ].join('\n')
);
