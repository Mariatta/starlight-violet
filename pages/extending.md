---
title: Extending Violet
description: Adding a kind of your own, and the other ways a site extends Violet
---

Violet's four kinds cover plans, references, decisions and handoffs. A
site that keeps another kind of note (risks, incidents, experiments,
meeting records) can define its own kind and get the same treatment: a
checked front matter schema, required sections, a header, a status badge,
a table that lists every page of the kind, and links that resolve.

## Adding a kind

The example adds `risk`: one project risk, with a likelihood and an owner.

### 1. Define it

In the site, such as `src/kinds/risk.ts`:

```ts
import { z } from 'astro/zod';
import { commonFields, defineKind, renderCommon } from 'starlight-violet/kinds';

export const risk = defineKind({
  label: 'Risk',
  schema: z.object({
    kind: z.literal('risk'),
    status: z.enum(['open', 'mitigated', 'closed']),
    likelihood: z.enum(['low', 'medium', 'high']),
    owner: z.string(),
    ...commonFields,
  }),
  variants: { open: 'danger', mitigated: 'caution', closed: 'success' },
  sections: { required: ['Impact', 'Mitigation'] },
  render: renderCommon,
});
```

| Part | Required | What it does |
|---|---|---|
| `label` | yes | The kind's name in error messages and tables |
| `schema` | yes | A zod object with `kind: z.literal('<name>')`. Pages of the kind are checked against it, and the build names the field that fails |
| `commonFields` | no | Spread it in for `updated`, `created`, `note`, `issues` and `related`, the fields Violet's header shows |
| `variants` | no | The badge colour for each `status`: `default`, `note`, `tip`, `caution`, `danger` or `success` |
| `sections` | no | `{ required: [...] }`: level-two headings the body must have; `{ exact: [...] }`: exactly these, in order |
| `header` | no | A component for the page's header, as a path from the site's root. Without one, pages get Violet's header (status, dates, note, Issues, Related) |
| `render` | no | Turns inline-Markdown fields into HTML before the header shows them. `renderCommon` does it for the common fields. `inline(text, { html: false })` renders one line of inline Markdown, with raw HTML shown as text and blocks kept as written, for fields that used to be plain text |
| `dateField` | no | The front matter field holding the page's date, which `::pages` sorts by and shows. Default `updated` |

A kind's name is lower case letters, digits and dashes, and must not be one
of Violet's own.

### 2. Turn it on

In `astro.config.mjs`:

```js
import { risk } from './src/kinds/risk';

violet({
  notes: '../docs',
  kinds: ['planning', 'reference'],
  customKinds: { risk },
  require: { 'risks/*.md': 'risk' },
});
```

`require` is optional. With it, every file in `risks/` must declare
`kind: risk`, so a forgotten front matter block fails the build instead of
rendering as a plain page.

### 3. Give it a header (optional)

A header component gets the page's validated front matter as `data`. It
can show the kind's own fields and reuse Violet's header for the rest:

```astro
---
// src/components/RiskHeader.astro
import PageHeader from 'starlight-violet/components/PageHeader.astro';

const { data } = Astro.props;
---

<table class="kind-meta">
  <tbody>
    <tr><th>Likelihood</th><td>{data.likelihood}</td></tr>
    <tr><th>Owner</th><td>{data.owner}</td></tr>
  </tbody>
</table>
<PageHeader data={data} />
```

and in the kind: `header: './src/components/RiskHeader.astro'`. The
`kind-meta` class gives it the same look as Violet's headers.
`statusLabel` and `statusVariant` from `starlight-violet/kinds` give a status
the kind's badge colour, for a header that draws its own badge.

### 4. List its pages

`::pages{kind=risk}` renders a table of every risk with its status, last
update and issues; `::pages{kind=risk status=open}` narrows it. It works
for Violet's kinds too.

### 5. Document it

A kind is only useful if people, and their agents, know when to use it:

- **Its contract.** Add `src/content/docs/guide/kinds/risk.md` to the site,
  with the fields, the sections and a skeleton to copy, like Violet's own
  contract pages. It joins them under "Page kinds" in the sidebar.
- **How to write it.** Add a section to the site's own writing page: what a
  risk page is for, what goes in each section, and when to close one. Violet's
  [writing guide](../writing/) covers everything else.

## Other ways to extend

| Need | Option or file |
|---|---|
| A link rule or Markdown transform of your own | `mdastPlugins`: Sätteri mdast plugins, run after Violet's |
| Pages made from something other than Markdown (design specimens, a generated index) | `extraPages: { pages, feeds }` |
| Your own CSS | Starlight's `customCss`, as usual |
| Scripts on every page | Starlight's `head` |
| A hand-written sidebar | `sidebar: false`, then Starlight's `sidebar` |
| Your own content panel | Override `MarkdownContent` in Starlight's `components`, and render `starlight-violet/components/MarkdownContent.astro` inside it so kind headers still show |

The helpers Violet uses to read the notes are exported from
`starlight-violet/lib/notes` (`notesDir`, `readPage`, `idFor`, `pageUrl`,
`words`) and `starlight-violet/lib/plans`, for a site's own plugins and pages.
