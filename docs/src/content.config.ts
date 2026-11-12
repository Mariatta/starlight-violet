import { defineCollection } from 'astro:content';
import { notesLoader, notesSchema } from 'starlight-violet/content';

export const collections = { docs: defineCollection({ loader: notesLoader(), schema: notesSchema() }) };
