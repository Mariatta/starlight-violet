/**
 * Reading the pages the test site built: each page's main content, its
 * links and its ids. `make test` builds the site before the tests run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE = join(dirname(fileURLToPath(import.meta.url)), 'site');
const DIST = join(SITE, 'dist');

/** A page's HTML, by its address: `page('work/prose')`. */
export function html(address) {
  const file = join(DIST, address, 'index.html');
  if (!existsSync(file)) throw new Error(`no page at ${address}: run make test, which builds the site first`);
  return readFileSync(file, 'utf8');
}

/** The page's main content, without Starlight's sidebar and header. */
export function main(address) {
  const page = html(address);
  const start = page.indexOf('<main');
  const end = page.indexOf('</main>');
  if (start < 0 || end < 0) throw new Error(`${address} has no <main>`);
  return page.slice(start, end);
}

const strip = (s) => s.replace(/<[^>]+>/g, '');

/** Every link in the main content, as { href, text }. Nested anchors are kept apart, innermost first. */
export function links(address) {
  return [...main(address).matchAll(/<a\s[^>]*?href="([^"]*)"[^>]*>((?:(?!<a[\s>]).)*?)<\/a>/gs)].map(([, href, inner]) => ({ href, text: strip(inner) }));
}

/** The text of one labelled sentence of a page, such as "QB:" up to the next label, with its HTML. */
export function sentence(address, label) {
  const content = main(address);
  const start = content.search(new RegExp(`(?<![A-Za-z])${label}: `));
  if (start < 0) throw new Error(`no ${label}: on ${address}`);
  const rest = content.slice(start + label.length + 1);
  // The next label is two capitals on their own, then a colon and a space, so "SPEC: " is not one.
  const end = rest.search(/(?<![A-Za-z])[A-Z]{2}: |<\/p>/);
  return rest.slice(0, end < 0 ? undefined : end);
}

/** The links in one labelled sentence, as { href, text }. */
export function linksIn(address, label) {
  return [...sentence(address, label).matchAll(/<a\s[^>]*?href="([^"]*)"[^>]*>(.*?)<\/a>/gs)].map(([, href, inner]) => ({ href, text: strip(inner) }));
}

/** Every id on a page. */
export function ids(address) {
  return [...html(address).matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id);
}
