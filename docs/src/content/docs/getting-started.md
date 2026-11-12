---
title: Getting started
description: Install Violet in a Starlight site and render a notes folder
---

Violet needs Astro 7 with its default Sätteri Markdown processor and
Starlight 0.42 or later. The site usually lives in its own folder in the
repo, such as `docs-site/`, next to the notes in `docs/`.

:::steps
1. Create a Starlight site, if you do not have one:

   ```sh
   npm create astro@latest -- --template starlight docs-site
   ```

2. Install Violet:

   ```sh
   cd docs-site
   npm install starlight-violet
   ```

3. Add it to Starlight's plugins in `astro.config.mjs`, pointing `notes` at
   the folder to render:

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
           }),
         ],
       }),
     ],
   });
   ```

4. Read the notes into Starlight's `docs` collection, in
   `src/content.config.ts`:

   ```ts
   import { defineCollection } from 'astro:content';
   import { notesLoader, notesSchema } from 'starlight-violet/content';

   export const collections = {
     docs: defineCollection({ loader: notesLoader(), schema: notesSchema() }),
   };
   ```

5. Give a note a kind. In `docs/deploy.md`:

   ```markdown
   ---
   kind: reference
   status: current
   updated: 2026-11-11
   ---

   # Deploying

   ...
   ```

6. Run the site:

   ```sh
   npx astro dev
   ```

   Every Markdown file in `docs/` is a page, folders become sidebar groups,
   and `deploy.md` shows its status and date in a header.
:::

## Next

- Turn on the [kinds](../kinds/) you need, and require them where they
  belong with the [`require` option](../configuration/).
- Point your coding agent at the [writing guide](../guide/writing/#pointing-your-agent-here).
- Make the home page a landing page with
  [`::sections`](../guide/shortcodes/#a-landing-page).
