import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'PDF Reader MCP',
  description:
    'MCP server for PDF inspection, extraction, citation chunks, and safety signals for AI agents',

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
      { property: 'og:title', content: 'PDF Reader MCP - Inspect and Extract PDFs for AI Agents' },
    ],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'A high-performance MCP server for PDF inspection, structured extraction, citation chunks, and safety signals',
      },
    ],
    ['meta', { property: 'og:url', content: 'https://pdf-reader-mcp.sylphx.com' }],
    ['meta', { property: 'og:site_name', content: 'PDF Reader MCP' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'PDF Reader MCP' }],
    [
      'meta',
      {
        name: 'twitter:description',
        content: 'Inspect PDFs and extract agent-ready content via MCP',
      },
    ],
    ['meta', { name: 'twitter:site', content: '@sylphxai' }],
    [
      'meta',
      {
        name: 'keywords',
        content:
          'mcp, pdf, reader, ai, claude, model context protocol, typescript, rag, citations, pdf inspection',
      },
    ],
    ['meta', { name: 'author', content: 'Sylphx' }],
    ['meta', { name: 'robots', content: 'index, follow' }],
    ['link', { rel: 'canonical', href: 'https://pdf-reader-mcp.sylphx.com' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'PDF Reader MCP',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/guide/getting-started' },
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
          { text: 'Design Philosophy', link: '/design/' },
          { text: 'Performance', link: '/performance/' },
          { text: 'Comparison', link: '/comparison/' },
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
      copyright: 'Copyright 2024 Sylphx',
    },

    search: {
      provider: 'local',
    },
  },
});
