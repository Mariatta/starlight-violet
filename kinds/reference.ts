/**
 * The reference kind: how something built works, a runbook or a guide,
 * with its status, dates, tracking issues and related pages as data.
 */
import { z } from 'astro/zod';
import { commonFields, renderCommon, type CommonData } from './common';
import type { Inline } from '../options';

export const REFERENCE_STATUSES = ['draft', 'in-progress', 'current', 'unreviewed', 'outdated', 'archived'] as const;

/** Starlight badge variant per status. */
export const REFERENCE_VARIANT = {
  draft: 'caution',
  'in-progress': 'note',
  current: 'success',
  unreviewed: 'default',
  outdated: 'danger',
  archived: 'default',
} as const;

export const referenceSchema = z.object({
  kind: z.literal('reference'),
  status: z.enum(REFERENCE_STATUSES, { error: `status is required: ${REFERENCE_STATUSES.join(', ')}` }),
  ...commonFields,
});

export type ReferenceData = z.infer<typeof referenceSchema>;

export async function renderReference(data: ReferenceData, inline: Inline) {
  await renderCommon(data as unknown as CommonData, inline);
}
