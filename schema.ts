/**
 * The front matter schema for the docs collection, for the site's
 * src/content.config.ts: Starlight's own fields, extended with every built-in
 * kind's and the site's own kinds' (the `customKinds` option). The loader
 * rejects a built-in kind the site has not turned on.
 */
import { z } from 'astro/zod';
import { docsSchema } from '@astrojs/starlight/schema';
import { getOptions } from './options';
import { decisionSchema } from './kinds/decision';
import { handoffSchema } from './kinds/handoff';
import { planningSchema } from './kinds/planning';
import { referenceSchema } from './kinds/reference';

/** A page with no kind: plain notes, Starlight's own fields only. */
const plain = z.object({ kind: z.undefined().optional(), source: z.string().optional() });

export function notesSchema() {
  const custom = Object.values(getOptions().customKinds).map((kind) => kind.schema as z.ZodTypeAny);
  const extend = z.union([planningSchema, referenceSchema, handoffSchema, decisionSchema, ...custom, plain] as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  // Starlight types `extend` as a union of plain objects. The planning schema is
  // refined (only a plan lists tasks and PRs), which zod types differently but
  // Starlight handles the same at runtime.
  return docsSchema({ extend: extend as never });
}
