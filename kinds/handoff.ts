/** The handoff kind: a document one agent writes so another can pick up. */
import { z } from 'astro/zod';

/** The level-two headings every handoff body has, exactly and in this order. */
export const HANDOFF_SECTIONS = [
  'Summary',
  'Context',
  'What is decided',
  'What is open',
  'First task',
  'Files',
] as const;

export const HANDOFF_STATUSES = ['draft', 'ready', 'picked-up', 'done'] as const;

/** Starlight badge variant per status. */
export const STATUS_VARIANT = {
  draft: 'caution',
  ready: 'tip',
  'picked-up': 'note',
  done: 'success',
} as const;

/**
 * The front matter of a handoff. A page with `kind: handoff` must match it,
 * or the build fails and names the field.
 */
export const handoffSchema = z.object({
  kind: z.literal('handoff'),
  title: z.string().min(1),
  from: z.string().min(1).describe('Who hands off: the session or role that wrote this'),
  to: z.string().min(1).describe('Who picks up'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .transform((day) => new Date(day)),
  status: z.enum(HANDOFF_STATUSES, {
    error: 'status is required: draft, ready, picked-up or done',
  }),
  decisions: z.array(z.string().regex(/^\d{4}$/, 'a four-digit decision number')).default([]),
  inputs: z.array(z.string()).min(1).describe('Files or folders to read, in order'),
  open_questions: z
    .array(
      z.object({
        id: z.string(),
        question: z.string().describe('Inline Markdown; the loader renders it'),
        blocks: z.string().optional().describe('Inline Markdown; the loader renders it'),
        owner: z.string().optional().describe("Defaults to Violet's `owner` option"),
        answer: z.string().nullable().default(null).describe('Inline Markdown; the loader renders it'),
      }),
    )
    .default([]),
  next_steps: z.array(z.string()).min(1).describe('Inline Markdown; the loader renders each'),
  /** The page's path in the notes repo, filled in by the loader for error messages. */
  source: z.string().optional(),
});

/** Render the inline-Markdown fields to HTML in place, so their references link as the body's do. */
export async function renderHandoff(data: z.infer<typeof handoffSchema>, inline: (text: string) => Promise<string>) {
  for (const question of data.open_questions) {
    question.question = await inline(question.question);
    if (question.blocks) question.blocks = await inline(question.blocks);
    if (question.answer) question.answer = await inline(question.answer);
  }
  data.next_steps = await Promise.all(data.next_steps.map(inline));
}
