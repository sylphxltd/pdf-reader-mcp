import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readText = (path: string) => readFileSync(path, 'utf8');

describe('README discovery surfaces', () => {
  it('keeps pain-first fold content and honest discovery status', () => {
    const readme = readText('README.md');

    expect(readme).toContain('Did it read the truth?');
    expect(readme).toContain('## Why not a plain text dump?');
    expect(readme).toContain('39/39');
    expect(readme).toMatch(/Star the repo|Star this repo/);
    expect(readme).not.toMatch(/Listed on \[MCP Servers\]/);
    expect(readme).toContain('Not listed yet');
    expect(readme).toContain('docs/articles/stop-pdf-hallucinations.md');
    expect(readme).toContain('docs/public/demo-workflow.svg');
  });

  it('links the shareable discovery article from docs surfaces', () => {
    const vitepress = readText('docs/.vitepress/config.ts');
    const gettingStarted = readText('docs/guide/getting-started.md');

    expect(existsSync('docs/articles/stop-pdf-hallucinations.md')).toBe(true);
    expect(vitepress).toContain('/articles/stop-pdf-hallucinations');
    expect(gettingStarted).toContain('/articles/stop-pdf-hallucinations');
  });
});
