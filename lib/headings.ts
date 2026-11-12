/**
 * Starlight's heading links, for pages it does not render itself. The markup
 * and the link icon are Starlight's (MIT, Copyright (c) 2023 Astro
 * contributors), reproduced so these pages match the site's own. Starlight
 * adds a link icon beside each heading only for files under src/content/docs;
 * pages read from docs/ get the same markup here, so a heading links to itself.
 */
const ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="m12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 1 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 0 0-1.42-1.42m8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 1 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 0 0 0 1.42 1 1 0 0 0 1.42 0l3.88-3.89a4.49 4.49 0 0 0 0-6.33M8.83 15.17a1 1 0 0 0 .71.29 1 1 0 0 0 .71-.29l4.92-4.92a1 1 0 1 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42"></path></svg>';

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** One heading with its link, in Starlight's markup; `inner` is the heading's HTML. */
export function headingWithLink(depth: number, id: string, inner: string, attributes = ''): string {
  const label = inner.replace(/<[^>]+>/g, '');
  return (
    `<div class="sl-heading-wrapper level-h${depth}"><h${depth} id="${id}"${attributes}>${inner}</h${depth}>` +
    `<a class="sl-anchor-link" href="#${id}"><span aria-hidden="true" class="sl-anchor-icon">${ICON}</span>` +
    `<span class="sr-only" data-pagefind-ignore>Section titled “${escape(label)}”</span></a></div>`
  );
}

/** Wrap every h2 to h6 that has an id and no link yet. */
export function addHeadingLinks(html: string): string {
  if (html.includes('sl-anchor-link')) return html;
  return html.replace(/<h([2-6]) id="([^"]+)"([^>]*)>([\s\S]*?)<\/h\1>/g, (_, depth, id, attributes, inner) =>
    headingWithLink(Number(depth), id, inner, attributes),
  );
}
