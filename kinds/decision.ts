/** The decision kind: one numbered architecture decision, with its status as data. */
import { z } from 'astro/zod';
import type { Inline } from '../options';

export const DECISION_STATUSES = ['proposed', 'locked', 'superseded'] as const;

/** Starlight badge variant per status. */
export const DECISION_VARIANT = {
  proposed: 'caution',
  locked: 'success',
  superseded: 'default',
} as const;

const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

/** A reference to another decision, with the part of it concerned. */
const reference = z.object({
  decision: z.string().regex(/^\d{4}$/, 'a four-digit decision number'),
  what: z.string().optional(),
});

/** Free-text fields are inline Markdown; the loader renders them. */
export const decisionSchema = z
  .object({
    kind: z.literal('decision'),
    number: z.string().regex(/^\d{4}$/, 'a four-digit decision number'),
    title: z.string().min(1),
    status: z.enum(DECISION_STATUSES, { error: 'status is required: proposed, locked or superseded' }),
    date: DAY.describe('When the status took effect'),
    proposed: DAY.optional().describe('When it was proposed, if before date'),
    ask: z.string().optional().describe("The owner's words that started it, quoted"),
    confirmed: z.string().optional().describe("How the status was confirmed, the owner's words when there are some"),
    reason: z.string().optional().describe('Why the decision was written, or where it came from'),
    note: z.string().optional().describe('A qualification of the status itself, one sentence'),
    supersedes: z.array(reference).default([]),
    superseded_by: z.array(reference).default([]),
    amends: z.array(reference).default([]),
    amended_by: z.array(reference).default([]),
    history: z.array(z.object({ date: DAY, note: z.string() })).default([]),
    source: z.string().optional(),
  })
  .superRefine((data, context) => {
    if (data.status === 'superseded' && data.superseded_by.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['superseded_by'],
        message: 'a superseded decision names what superseded it',
      });
    }
  });

/** Every decision body has these sections; more are allowed. */
export const DECISION_SECTIONS = ['Context', 'Decision', 'Consequences'] as const;

/** The title without its leading number. */
export function shortTitle(title: string): string {
  return title.replace(/^\d{4}\.\s*/, '');
}

/** Render the inline-Markdown fields to HTML in place. */
export async function renderDecision(data: z.infer<typeof decisionSchema>, inline: Inline) {
  for (const key of ['ask', 'confirmed', 'reason', 'note'] as const) {
    if (data[key]) data[key] = await inline(data[key]!);
  }
  for (const key of ['supersedes', 'superseded_by', 'amends', 'amended_by'] as const) {
    for (const ref of data[key]) if (ref.what) ref.what = await inline(ref.what);
  }
  for (const item of data.history) item.note = await inline(item.note);
}
