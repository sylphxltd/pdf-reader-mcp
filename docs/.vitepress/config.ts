import { defineConfig } from 'vitepress';

export default defineConfig({
  base: '/pdf-reader-mcp/',
  cleanUrls: true,
  title: 'PDF Reader MCP',
  description:
    'Full-fidelity PDF intelligence MCP with Agent Document Twin, visual evidence, OCR provenance, trust reports, accessibility reports, citations, and benchmark proof for AI agents',

  appearance: 'dark',
  lastUpdated: true,

  vite: {
    build: {
      target: 'esnext',
    },
  },

  head: [
    ['meta', { property: 'og:type', content: 'website' }],
    [
      'meta',
      { property: 'og:title', content: 'PDF Reader MCP - Full-Fidelity PDF Intelligence for AI Agents' },
    ],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'A TypeScript-first MCP server for Agent Document Twin extraction, visual evidence, OCR provenance, trust reports, accessibility reports, citations, and benchmark-gated release proof',
      },
    ],
    ['meta', { property: 'og:url', content: 'https://sylphxai.github.io/pdf-reader-mcp/' }],
    ['meta', { property: 'og:site_name', content: 'PDF Reader MCP' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'PDF Reader MCP' }],
    [
      'meta',
      {
        name: 'twitter:description',
        content:
          'Turn PDFs into agent-readable evidence with document maps, visual crops, OCR provenance, trust reports, accessibility reports, and benchmark proof',
      },
    ],
    ['meta', { name: 'twitter:site', content: '@sylphxai' }],
    ['meta', { property: 'og:image', content: 'https://sylphxai.github.io/pdf-reader-mcp/og-image.png' }],
    ['meta', { name: 'twitter:image', content: 'https://sylphxai.github.io/pdf-reader-mcp/og-image.png' }],
    [
      'meta',
      {
        name: 'keywords',
        content:
          'mcp, pdf, reader, ai, claude, model context protocol, typescript, rag, citations, pdf inspection, pdf intelligence, agent document twin, visual evidence, ocr provenance, trust report, accessibility report, layout analysis, reading order',
      },
    ],
    ['meta', { name: 'author', content: 'Sylphx' }],
    ['meta', { name: 'robots', content: 'index, follow' }],
    ['link', { rel: 'canonical', href: 'https://sylphxai.github.io/pdf-reader-mcp/' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'PDF Reader MCP',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' },
      { text: 'Benchmark', link: '/benchmark' },
      { text: 'Articles', link: '/articles/evidence-first' },
      { text: 'Design', link: '/design/' },
      { text: 'Performance', link: '/performance/' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Introduction', link: '/guide/' },
          { text: 'Installation', link: '/guide/installation' },
          { text: 'Getting Started', link: '/guide/getting-started' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'API Reference', link: '/api/' },
          { text: 'Benchmark Proof', link: '/benchmark' },
          { text: 'Design Philosophy', link: '/design/' },
          { text: 'Performance', link: '/performance/' },
          { text: 'Comparison', link: '/comparison/' },
        ],
      },
      {
        text: 'Articles',
        items: [
          { text: 'Evidence-First PDF Reading', link: '/articles/evidence-first' },
        ],
      },
      {
        text: 'Architecture',
        items: [
          {
            text: 'V3 Smart Tool Surface',
            link: '/specs/2026-06-22-v3-smart-tool-surface',
          },
          {
            text: '2027 SOTA Boundary',
            link: '/adr/0001-2027-sota-document-intelligence-boundary',
          },
          {
            text: 'Operating Model',
            link: '/specs/2026-06-16-2027-sota-document-intelligence-operating-model',
          },
        ],
      },
      {
        text: 'Updates',
        items: [
          {
            text: 'V3 PDF Intelligence',
            link: '/weekly/2026-06-22-v3-pdf-intelligence',
          },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/SylphxAI/pdf-reader-mcp' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/@sylphx/pdf-reader-mcp' },
    ],

    editLink: {
      pattern: 'https://github.com/SylphxAI/pdf-reader-mcp/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2024-2026 SylphxAI',
    },

    search: {
      provider: 'local',
    },
  },
});
