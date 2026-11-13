/**
 * The planning kind: one context report, brainstorm or plan for a piece of
 * work, with its status, dates, tracking issues and related notes as data.
 */
import { z } from 'astro/zod';
import { commonFields, ISSUE, renderCommon, type CommonData } from './common';
import type { Inline } from '../options';

export const PLANNING_TYPES = ['context', 'brainstorm', 'spec', 'plan'] as const;
export const PLANNING_STATUSES = ['draft', 'in-review', 'approved', 'in-progress', 'done', 'superseded'] as const;

/** Starlight badge variant per status. */
export const PLANNING_VARIANT = {
  draft: 'caution',
  'in-review': 'note',
  approved: 'tip',
  'in-progress': 'note',
  done: 'success',
  superseded: 'default',
} as const;

/** Status of one task or one PR of a plan. */
export const WORK_STATUSES = ['todo', 'in-progress', 'in-review', 'done', 'dropped'] as const;

/** Starlight badge variant per task or PR status. */
export const WORK_VARIANT = {
  todo: 'default',
  'in-progress': 'note',
  'in-review': 'tip',
  done: 'success',
  dropped: 'danger',
} as const;

const NUMBER = z.number().int().positive();
const WORK_STATUS = z.enum(WORK_STATUSES, { error: `status is one of: ${WORK_STATUSES.join(', ')}` }).default('todo');

/** One task of a plan; its heading in the body is `### Task <number>: <title>`. */
const task = z.object({
  number: NUMBER,
  title: z.string().optional().describe('Defaults to the heading after "Task N:"'),
  status: WORK_STATUS,
  issue: ISSUE.optional(),
});

/** One pull request of a plan; its heading in the body is `# PR <number>: <title>`. */
const pr = z.object({
  number: NUMBER,
  title: z.string().optional().describe('Defaults to the heading after "PR N:"'),
  branch: z.string().optional(),
  tasks: z.array(NUMBER).default([]),
  ships: z.string().optional().describe('What it ships, one sentence'),
  status: WORK_STATUS,
  issue: ISSUE.optional(),
  pull: ISSUE.optional().describe('The pull request, such as #540'),
});

function unique(items: { number: number }[]): boolean {
  return new Set(items.map((item) => item.number)).size === items.length;
}

/** Free-text fields are inline Markdown; the loader renders them. */
export const planningSchema = z.object({
  kind: z.literal('planning'),
  type: z.enum(PLANNING_TYPES, { error: 'type is required: context, brainstorm, spec or plan' }),
  status: z.enum(PLANNING_STATUSES, {
    error: `status is required: ${PLANNING_STATUSES.join(', ')}`,
  }),
  ...commonFields,
  stack: z.array(z.string()).default([]).describe('Tech stack, one item each, inline Markdown'),
  tasks: z.array(task).default([]).refine(unique, 'task numbers must be unique'),
  prs: z.array(pr).default([]).refine(unique, 'PR numbers must be unique'),
}).refine((data) => data.type === 'plan' || (data.tasks.length === 0 && data.prs.length === 0), {
  message: 'only a page of type plan lists tasks and prs',
  path: ['type'],
});

export type PlanningData = z.infer<typeof planningSchema>;

/** Render the inline-Markdown fields to HTML in place. */
export async function renderPlanning(data: PlanningData, inline: Inline) {
  await renderCommon(data as unknown as CommonData, inline);
  data.stack = await Promise.all(data.stack.map((text) => inline(text)));
}
