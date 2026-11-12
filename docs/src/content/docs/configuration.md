---
title: Configuration
description: Every option of the Violet plugin
---

Violet takes one options object, in Starlight's `plugins`:

```js
violet({
  notes: '../docs',
  kinds: ['planning', 'reference'],
  require: { 'planning/*/*.md': 'planning', '*.md': 'reference' },
  looseFiles: 'reference',
  github: { org: 'my-org', repo: 'my-repo' },
});
```

## Options

| Option | Default | Meaning |
|---|---|---|
| `notes` | required | The notes folder, relative to the site's root |
| `kinds` | `[]` | Built-in kinds this site uses: `planning`, `reference`, `decision`, `handoff` |
| `customKinds` | `{}` | Kinds the site defines itself, by name; see [Extending](../guide/extending/) |
| `require` | `{}` | Globs (relative to the notes) mapped to the kind their files must declare. `*` stays in one folder, `**` crosses folders, `?` is one character |
| `looseFiles` | none | File the notes' top-level files under this folder, such as `reference` |
| `skip` | `[]` | Globs of notes files to leave out, such as `README.md` |
| `shortLabels` | `[]` | Folders whose pages the sidebar labels by file name instead of heading |
| `acronyms` | `[]` | Words written in capitals in labels made from file names |
| `sidebar` | `'folders'` | Build the sidebar from the notes' folders, or `false` to keep the site's own |
| `github` | none | `{ org, repo }`: where `#12` and `other-repo#34` link |
| `owner` | none | Whose notes these are: the default owner of a handoff's questions |
| `sectionDescriptions` | `{}` | A one-line description per top-level folder, for its card on the landing page |
| `files` | `false` | `{ prefix: '/notes/', private: ['hours'] }` serves the notes' other files: images, HTML mockups, CSS, scripts, JSON, CSV and plain text, never dotfiles or environment files. `types: { yaml: 'text/plain' }` adds an extension by its content type |
| `wide` | `true` | Widen the content column and start it at the sidebar |
| `mdastPlugins` | `[]` | The site's own Sätteri mdast plugins, run after Violet's |
| `extraPages` | none | `{ pages, feeds }`: pages the site generates, and which changed files regenerate them |

## What Violet sets in Starlight

| Starlight setting | What Violet does | To change it |
|---|---|---|
| `sidebar` | Builds it from the notes' folders, then a "This site" group with the guide | `sidebar: false`, then Starlight's own `sidebar` |
| `components.MarkdownContent` | Replaces it to show each kind's header | Override it and render `starlight-violet/components/MarkdownContent.astro` inside |
| `customCss` | Adds its styles, and the wide layout | `wide: false`; add your own after |
| `expressiveCode` | Highlights `django` code blocks with Shiki's Jinja grammar, the closest it ships | Set `expressiveCode.shiki.langAlias.django` yourself |
| `pagination` | Leaves it alone; adds previous and next links where pages are read in order | Starlight's `pagination`, or `prev` and `next` in a page |

## Colours and logo

Violet uses Starlight's colour variables, so a site's own colours and logo
are Starlight settings. Set the accent in a stylesheet listed in
`customCss`, and Violet's badges, headers and cards follow:

```css
:root {
  --sl-color-accent-low: #2b1659;
  --sl-color-accent: #8b5cf6;
  --sl-color-accent-high: #ddd6fe;
}
:root[data-theme='light'] {
  --sl-color-accent-low: #ede9fe;
  --sl-color-accent: #6d28d9;
  --sl-color-accent-high: #3b0f86;
}
```

Set a value for light mode for every variable you set for dark mode: a site
stylesheet outranks Starlight's own, so a dark-only value carries into light
mode. The logo is Starlight's `logo` option.
