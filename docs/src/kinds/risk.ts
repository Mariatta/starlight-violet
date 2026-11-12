/** A kind this site defines for itself: one project risk, with its likelihood and owner. */
import { z } from 'astro/zod';
import { commonFields, defineKind, renderCommon } from 'starlight-violet/kinds';

export const risk = defineKind({
  label: 'Risk',
  schema: z.object({
    kind: z.literal('risk'),
    status: z.enum(['open', 'mitigated', 'closed']),
    likelihood: z.enum(['low', 'medium', 'high']),
    owner: z.string(),
    ...commonFields,
  }),
  variants: { open: 'danger', mitigated: 'caution', closed: 'success' },
  sections: { required: ['Impact', 'Mitigation'] },
  header: './src/components/RiskHeader.astro',
  render: renderCommon,
});
