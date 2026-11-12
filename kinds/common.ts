/** Front matter fields every kind shares: dates, issues, related pages. */
import { z } from 'astro/zod';

export const DAY = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'));

/** `#12` for this repo, `other-repo#34` for a sibling repo in the same organisation. */
export const ISSUE = z.string().regex(/^([A-Za-z0-9_.-]+)?#\d+$/, 'an issue such as #12 or other-repo#34');

/** One tracking issue: just the reference, or with its title and why it is listed. */
export const issueItem = z
  .union([ISSUE, z.object({ ref: ISSUE, title: z.string().optional(), note: z.string().optional() })])
  .transform((item) => (typeof item === 'string' ? { ref: item } : item));

/**
 * One related page: a title and a link (a relative path to a Markdown file in
 * docs/, or a URL), and optionally why it is related. A bare Markdown link
 * string is accepted too.
 */
export const relatedItem = z
  .union([
    z.string().regex(/^\[[^\]]+\]\([^)]+\)$/, 'a Markdown link such as "[Context](context.md)"'),
    z.object({ title: z.string(), link: z.string(), note: z.string().optional() }),
  ])
  .transform((item) => {
    if (typeof item !== 'string') return item;
    const [, title, link] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(item)!;
    return { title, link };
  });

export const commonFields = {
  updated: DAY.describe('When the page last changed in substance'),
  created: DAY.optional().describe('When it was first written or its data gathered'),
  note: z.string().optional().describe('A qualification of the status, one sentence'),
  issues: z.array(issueItem).default([]).describe('Tracking issues'),
  related: z.array(relatedItem).default([]).describe('Related pages'),
  split: z.boolean().default(false).describe('Render each level-one section as a page of its own, with previous and next links'),
  source: z.string().optional(),
};

export interface CommonData {
  note?: string;
  issues: { ref: string; title?: string; note?: string }[];
  related: { title: string; link: string; note?: string; html?: string }[];
}

/** Render the shared inline-Markdown fields to HTML in place; a related link becomes `html`. */
export async function renderCommon(data: CommonData, inline: (text: string) => Promise<string>) {
  if (data.note) data.note = await inline(data.note);
  for (const issue of data.issues) if (issue.note) issue.note = await inline(issue.note);
  for (const item of data.related) {
    item.html = await inline(`[${item.title}](${item.link})`);
    if (item.note) item.note = await inline(item.note);
  }
}
