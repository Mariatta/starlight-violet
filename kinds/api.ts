/**
 * What a site needs to define a kind of its own (`starlight-violet/kinds`):
 *
 *   import { z } from 'astro/zod';
 *   import { commonFields, defineKind, renderCommon } from 'starlight-violet/kinds';
 *
 *   export const risk = defineKind({
 *     label: 'Risk',
 *     schema: z.object({ kind: z.literal('risk'), status: z.enum(['open', 'mitigated']), ...commonFields }),
 *     variants: { open: 'danger', mitigated: 'success' },
 *     render: renderCommon,
 *   });
 *
 * and in astro.config, `customKinds: { risk }`. See the "Extending" guide page.
 */
import type { CustomKind } from '../options';

export { commonFields, DAY, ISSUE, issueItem, relatedItem, renderCommon } from './common';
export { progressBar, statusBadge, statusLabel, statusVariant } from './index';
export type { BadgeVariant, CustomKind, Inline } from '../options';

/** Returns the kind unchanged; it only gives the definition its type. */
export function defineKind(kind: CustomKind): CustomKind {
  return kind;
}
