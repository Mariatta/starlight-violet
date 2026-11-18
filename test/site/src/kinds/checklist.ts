/** A custom kind whose required section has an apostrophe, which smart punctuation would curl. */
import { z } from 'astro/zod';
import { commonFields, defineKind, renderCommon } from 'starlight-violet/kinds';

export const checklist = defineKind({
  label: 'Checklist',
  schema: z.object({ kind: z.literal('checklist'), status: z.enum(['open', 'done']), ...commonFields }),
  sections: { required: ["What's next"] },
  render: renderCommon,
});
