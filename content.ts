/**
 * What the site's src/content.config.ts needs:
 *
 *   import { defineCollection } from 'astro:content';
 *   import { notesLoader, notesSchema } from 'starlight-violet/content';
 *   export const collections = { docs: defineCollection({ loader: notesLoader(), schema: notesSchema() }) };
 */
export { notesLoader } from './lib/loader';
export { notesSchema } from './schema';
