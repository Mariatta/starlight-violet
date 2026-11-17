// The site Violet's tests build: the notes in test/notes, with Violet from
// this checkout (installed in docs/, which `make test` links here). The tests
// read the pages it writes. VIOLET_TEST_NOTES and VIOLET_TEST_OUT let a test
// build another notes folder, such as one that must fail.
import { join } from 'node:path';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import violet from 'starlight-violet';
import { checklist } from './src/kinds/checklist';

export default defineConfig({
  site: 'https://example.com',
  trailingSlash: 'always',
  outDir: process.env.VIOLET_TEST_OUT ?? './dist',
  // Its own cache, not the docs site's that the linked node_modules would give it.
  cacheDir: process.env.VIOLET_TEST_OUT ? join(process.env.VIOLET_TEST_OUT, '.cache') : './.astro-cache',
  integrations: [
    starlight({
      title: 'Violet tests',
      pagination: false,
      plugins: [
        violet({
          notes: process.env.VIOLET_TEST_NOTES ?? '../notes',
          kinds: ['planning', 'reference', 'decision', 'handoff'],
          customKinds: { checklist },
          skip: ['work/DRAFT.md'],
          sidebar: false,
        }),
      ],
    }),
  ],
});
