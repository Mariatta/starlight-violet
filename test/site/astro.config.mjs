// The site Violet's tests build: the notes in test/notes, with Violet from
// this checkout (installed here as a copy, which `make test` refreshes). The
// tests read the pages it writes.
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import violet from 'starlight-violet';
import { checklist } from './src/kinds/checklist';
import { BASE, ORIGIN } from './address.mjs';

export default defineConfig({
  site: ORIGIN,
  base: BASE,
  trailingSlash: 'always',
  // Caches in the site's own folder, not in node_modules: the failure tests build copies of
  // this site at the same time, all linking the same node_modules, and would clash there.
  cacheDir: './.astro-cache',
  vite: { cacheDir: './.astro-cache/vite' },
  integrations: [
    starlight({
      title: 'Violet tests',
      pagination: false,
      // No test reads the search index.
      pagefind: false,
      plugins: [
        violet({
          notes: '../notes',
          kinds: ['planning', 'reference', 'decision', 'handoff'],
          customKinds: { checklist },
          skip: ['work/DRAFT.md', 'work/*.draft.mdx'],
          sidebar: false,
        }),
      ],
    }),
  ],
});
