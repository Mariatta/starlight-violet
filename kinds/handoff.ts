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

/**
 * `<` outside code spans as text, so a placeholder such as `<id>` shows
 * rather than becoming a tag; an autolink (`<https://...>`) stays a link.
 */
export function escapeTags(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === '\\') {
      // A backslash escapes the next character, a backtick included.
      out += text.slice(i, i + 2);
      i += 2;
    } else if (char === '`') {
      // A run of backticks opens a code span only when a run of the same length closes it, as in CommonMark.
      let run = i;
      while (text[run] === '`') run++;
      const fence = text.slice(i, run);
      let close = text.indexOf(fence, run);
      while (close !== -1 && (text[close - 1] === '`' || text[close + fence.length] === '`')) {
        let after = close;
        while (text[after] === '`') after++;
        close = text.indexOf(fence, after);
      }
      const stop = close === -1 ? run : close + fence.length;
      out += text.slice(i, stop);
      i = stop;
    } else {
      // An autolink (`<https://...>`) stays a link; any other `<` is text.
      out += char === '<' && !/^<[a-z][a-z0-9+.-]*:[^\s>]*>/i.test(text.slice(i)) ? '&lt;' : char;
      i++;
    }
  }
  return out;
}

/**
 * Render the inline-Markdown fields to HTML in place, so their references
 * link as the body's do. `blocks`, `answer` and `next_steps` were plain text
 * before they were Markdown, so raw HTML in them stays text.
 */
export async function renderHandoff(data: z.infer<typeof handoffSchema>, inline: (text: string) => Promise<string>) {
  for (const question of data.open_questions) {
    question.question = await inline(question.question);
    if (question.blocks) question.blocks = await inline(escapeTags(question.blocks));
    if (question.answer) question.answer = await inline(escapeTags(question.answer));
  }
  data.next_steps = await Promise.all(data.next_steps.map((step) => inline(escapeTags(step))));
}
