// The site Violet's tests build: the notes in test/notes, with Violet from
// this checkout (installed in docs/, which `make test` links here). The tests
// read the pages it writes. It has a base, as the docs site does, so a link
// that loses it fails; its origin is one no fixture links to.
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import violet from 'starlight-violet';
import { checklist } from './src/kinds/checklist';

export default defineConfig({
  site: 'https://violet.test',
  base: '/violet-tests/',
  trailingSlash: 'always',
  // Its own caches, Astro's and Vite's, not the docs site's that the linked node_modules would give it.
  cacheDir: './.astro-cache',
  vite: { cacheDir: './.astro-cache/vite' },
  integrations: [
    starlight({
      title: 'Violet tests',
      pagination: false,
      plugins: [
        violet({
          notes: '../notes',
          kinds: ['planning', 'reference', 'decision', 'handoff'],
          customKinds: { checklist },
          skip: ['work/DRAFT.md'],
          sidebar: false,
        }),
      ],
    }),
  ],
});
