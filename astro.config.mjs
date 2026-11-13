// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkAlerts } from './src/lib/remark-alerts.mjs';

export default defineConfig({
  site: 'https://hecmas.github.io',
  trailingSlash: 'ignore',
  integrations: [mdx(), sitemap({ filter: (page) => !page.includes('/witness-7f3a') })],
  markdown: {
    // Astro 7 defaults to the Sätteri processor; unified (remark/rehype) is used here
    // because KaTeX math rendering relies on remark-math + rehype-katex.
    processor: unified({
      remarkPlugins: [remarkMath, remarkAlerts],
      rehypePlugins: [rehypeKatex],
    }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
  // Keep the old Hugo URLs working so existing links don't break.
  redirects: {
    '/post': '/writing',
    '/post/snark-degree': '/writing/snark-degree',
    '/post/books': '/writing',
    '/writing/books': '/writing', // post removed
    '/events': '/talks',
    '/experience': '/about',
  },
});
