# Violet

**[Documentation](https://mariatta.ca/starlight-violet/)** · `npm install starlight-violet`

A [Starlight](https://starlight.astro.build/) plugin that renders a folder of
Markdown notes as a documentation site, read in place: design notes, plans,
decision records and runbooks that live next to the code, with nothing
copied into `src/content/docs/`.

What it adds on top of Starlight:

- **Page kinds.** A page declares a kind in front matter: `planning`
  (context, brainstorm, spec, plan), `reference` (how a built thing works, a runbook, a guide), `decision`
  (numbered architecture decision) or `handoff` (what one agent leaves the
  next). The build checks each page against its kind's schema and required
  sections, and fails naming the file and the field.
- **A header from front matter.** Status as a badge, dates, progress, tech
  stack and a note, then Issues and Related as tables of their own.
- **Plans as data.** A plan lists its tasks and PRs in front matter, each
  matched to its heading; `:task[3]` and `:pr[2]` link to them from any page,
  and prose such as "Tasks 1 to 5" links on its own.
- **Shortcodes.** `::planning`, `::topics`, `::references`, `::prs`,
  `::tasks`, `::decisions`, `::handoffs` and `::questions` become tables built
  from front matter at build time.
- **Long pages, a page per section.** `split: true` renders a long plan as
  an overview and a page per PR, with previous and next links. A planning
  folder reads in order (context, brainstorm, spec, plan) and decisions by
  number, through the same links.
- **Steps.** A plan's "Step N:" items, and any numbered list in `:::steps`,
  render like Starlight's Steps component.
- **A landing page.** `::sections` makes a card per top-level folder, each
  leading to that section's page, which lists its pages.
- **Links that resolve.** Relative links between notes become page links;
  images and other files can be served from the notes folder; "decision 0011"
  links to the decision.
- **Layout.** Heading links on every heading, a sidebar built from the notes'
  folders, and a wider content column for table-heavy pages.

The site documents itself. Every site using Violet gets, under `/guide/`:

| Page | What it covers |
|---|---|
| Writing notes | How to write each kind of page, and when to use a table, a list or prose. Point your coding agent at it: it ships in the package, at `node_modules/starlight-violet/pages/writing.md` |
| Page kinds | The contract of each kind the site uses: fields, sections, a skeleton to copy |
| Shortcodes | Every shortcode and link rule |
| Extending | Adding a kind of your own, and the other ways a site extends Violet |

## Install

```sh
npm install starlight-violet
```

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import violet from 'starlight-violet';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Project notes',
      plugins: [
        violet({
          notes: '../docs',
          kinds: ['planning', 'reference'],
          require: { 'planning/*/*.md': 'planning', '*.md': 'reference' },
          github: { org: 'my-org', repo: 'my-repo' },
        }),
      ],
    }),
  ],
});
```

`src/content.config.ts`:

```ts
import { defineCollection } from 'astro:content';
import { notesLoader, notesSchema } from 'starlight-violet/content';

export const collections = { docs: defineCollection({ loader: notesLoader(), schema: notesSchema() }) };
```

The site's own pages in `src/content/docs/` (a home page, a writing guide)
are read alongside the notes.

It needs Astro 7 with its default Sätteri Markdown processor and Starlight
0.42 or later.

## Options

| Option | Default | Meaning |
|---|---|---|
| `notes` | required | The notes folder, relative to the site's root, under any name: `../docs`, `../notes`, `../handoffs` |
| `kinds` | `[]` | Built-in kinds this site uses: `planning`, `reference`, `decision`, `handoff` |
| `customKinds` | `{}` | Kinds the site defines itself, by name; see the Extending page |
| `require` | `{}` | Globs (relative to the notes) mapped to the kind their files must declare. `*` stays in one folder, `**` crosses folders, `?` is one character. A top-level `index.md`, the landing page, is exempt |
| `looseFiles` | none | File the notes' top-level files under this folder, such as `reference`, except a top-level `index.md`, the landing page |
| `skip` | `[]` | Globs of notes files to leave out, such as `README.md`. It applies to a top-level `index.md` too |
| `shortLabels` | `[]` | Folders whose pages the sidebar labels by file name instead of heading |
| `acronyms` | `[]` | Words in capitals in labels made from file names |
| `sidebar` | `'folders'` | Build the sidebar from the notes' folders, or `false` to keep the site's own |
| `github` | none | `{ org, repo, branch }`: where `#12` and `other-repo#34` link, and the branch (default `main`) source links name |
| `sourceLink` | none | `'view'` or `'edit'`: a link at the foot of each page to its Markdown file on GitHub, for files in the site's own git checkout |
| `owner` | none | Whose notes these are: the default owner of a handoff's questions |
| `sectionDescriptions` | `{}` | A one-line description per top-level folder, for its card on the landing page |
| `files` | `false` | `{ prefix: '/notes/', private: ['hours'] }` serves the notes' other files (never dotfiles or environment files; `types` adds extensions) |
| `wide` | `true` | Widen the content column and start it at the sidebar |
| `mdastPlugins` | `[]` | The site's own Sätteri mdast plugins, run after Violet's |
| `extraPages` | none | `{ pages, feeds }`: pages the site generates, and which changed files regenerate them |

A site that overrides Starlight's `MarkdownContent` component as well gets a
warning: render `starlight-violet/components/MarkdownContent.astro` from the
override so kind headers still show.

## Working on Violet

The documentation site in `docs/` uses Violet from this checkout, and
its `docs/examples/` folder holds a page of every kind, so building it is
Violet's test. `make docs-build` installs this checkout into it and
builds it; `make docs-dev` serves it at http://localhost:8009/starlight-violet/.

The docs site, and any site developing against a local checkout, installs Violet
as a copy rather than a symlink (`install-links=true` in its
`.npmrc`), as npm would from the registry; reinstall after editing.

## The name

Violet is named after "Violet", a song by Savage Garden. The
[backstory](https://mariatta.ca/starlight-violet/why-violet/)
is on the documentation site.

## License

MIT. `lib/headings.ts` reproduces Starlight's heading-link markup and icon,
and `styles/notes.css` the styles of its Steps component (MIT, Copyright (c)
2023 Astro contributors); see `LICENSE`.
