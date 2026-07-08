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
    expect(readme).toContain('glama.ai/mcp/servers/SylphxAI/pdf-reader-mcp');
    expect(readme).toContain('registry.modelcontextprotocol.io');
    expect(readme).toContain('io.github.SylphxAI/pdf-reader-mcp');
    expect(readme).not.toContain('Publishing on next release');
    expect(readme).toContain('chatmcp/mcpso/issues/3068');
    expect(readme).toContain('docs/articles/stop-pdf-hallucinations.md');
    expect(readme).toContain('docs/public/demo-workflow.svg');
    expect(readme).toContain('Listed — `io.github.SylphxAI/pdf-reader-mcp`');
    expect(readme).not.toContain('### Reader family');
    expect(readme).not.toContain('0004-reader-portfolio');
    expect(readme).not.toContain('image-reader-mcp');
    expect(readme).not.toContain('video-reader-mcp');
    expect(readme).not.toContain('smart-reader-mcp');
  });

  it('ships official MCP Registry metadata aligned with package.json', () => {
    const pkg = JSON.parse(readText('package.json'));
    const server = JSON.parse(readText('server.json'));

    expect(pkg.mcpName).toBe('io.github.SylphxAI/pdf-reader-mcp');
    expect(server.name).toBe(pkg.mcpName);
    expect(server.packages[0].identifier).toBe(pkg.name);
    expect(server.version).toBe(pkg.version);
    expect(server.packages[0].version).toBe(pkg.version);
    expect(server.description.length).toBeLessThanOrEqual(100);
    expect(existsSync('.github/workflows/publish-mcp-registry.yml')).toBe(true);
  });

  it('links the shareable discovery article from docs surfaces', () => {
    const vitepress = readText('docs/.vitepress/config.ts');
    const gettingStarted = readText('docs/guide/getting-started.md');

    expect(existsSync('docs/articles/stop-pdf-hallucinations.md')).toBe(true);
    expect(vitepress).toContain('/articles/stop-pdf-hallucinations');
    expect(gettingStarted).toContain('/articles/stop-pdf-hallucinations');
  });
});
