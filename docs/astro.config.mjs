// Violet's documentation site. It uses Violet from this checkout, so it is
// also Violet's build test: examples/ holds a page of every kind.
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import violet from 'starlight-violet';
import { risk } from './src/kinds/risk';

export default defineConfig({
  site: 'https://mariatta.ca',
  base: '/starlight-violet/',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'Violet',
      description: 'A Starlight plugin for architecture notes, plans and decisions that live beside the code.',
      logo: { src: './src/assets/violet.svg', alt: '' },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/mariatta/starlight-violet' }],
      customCss: ['./src/styles/violet.css'],
      sidebar: [
        {
          label: 'Start here',
          items: [{ slug: 'why-violet' }, { slug: 'getting-started' }, { slug: 'configuration' }],
        },
        {
          label: 'Kinds and front matter',
          items: [
            { slug: 'kinds' },
            { slug: 'front-matter' },
            { label: 'Kind contracts', collapsed: true, items: [{ autogenerate: { directory: 'guide/kinds' } }] },
          ],
        },
        {
          label: 'Guides',
          items: [{ slug: 'guide/writing' }, { slug: 'guide/shortcodes' }, { slug: 'guide/extending' }],
        },
        {
          label: 'Examples',
          collapsed: true,
          items: [
            { slug: 'examples' },
            {
              label: 'Planning',
              items: [
                { slug: 'planning', label: 'Overview' },
                { label: 'Export screen', items: [{ autogenerate: { directory: 'planning/export-screen' } }] },
              ],
            },
            { label: 'Reference', items: [{ autogenerate: { directory: 'reference' } }] },
            { label: 'Decisions', items: [{ label: 'All decisions', link: '/decisions/' }, { autogenerate: { directory: 'decisions' } }] },
            { label: 'Handoffs', items: [{ autogenerate: { directory: 'handoffs' } }] },
            { label: 'Risks (a custom kind)', items: [{ autogenerate: { directory: 'risks' } }] },
          ],
        },
      ],
      plugins: [
        violet({
          notes: './examples',
          kinds: ['planning', 'reference', 'decision', 'handoff'],
          customKinds: { risk },
          require: { 'planning/*/*.md': 'planning', '*.md': 'reference', 'decisions/????-*.md': 'decision', 'risks/*.md': 'risk' },
          looseFiles: 'reference',
          shortLabels: ['decisions/'],
          sidebar: false,
          github: { org: 'mariatta', repo: 'starlight-violet' },
          owner: 'The owner',
          files: { prefix: '/files/' },
          sectionDescriptions: {
            handoffs: 'What one session leaves so the next can start',
            risks: 'A kind the site defines itself, with its own header',
          },
        }),
      ],
    }),
  ],
});
