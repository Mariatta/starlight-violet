/**
 * Starlight route middleware: headings that a kind's header adds (Issues and
 * Related; a handoff's Open questions and Next steps) join the table of
 * contents, after Starlight's "Overview".
 */
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

const HANDOFF_TOC = [
  { depth: 2, slug: 'open-questions', text: 'Open questions', children: [] },
  { depth: 2, slug: 'next-steps', text: 'Next steps', children: [] },
];

export const onRequest = defineRouteMiddleware((context) => {
  const { entry, toc } = context.locals.starlightRoute;
  const data = entry.data as any;
  if (!toc || !data.kind) return;
  if (data.kind === 'handoff') {
    toc.items.splice(1, 0, ...HANDOFF_TOC);
    return;
  }
  const added = [
    data.issues?.length ? { depth: 2, slug: 'issues', text: 'Issues', children: [] } : undefined,
    data.related?.length ? { depth: 2, slug: 'related', text: 'Related', children: [] } : undefined,
  ].filter((item) => item !== undefined);
  toc.items.splice(1, 0, ...added);
});
