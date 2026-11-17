/**
 * Reading the pages the test site built: each page's main content, its
 * links and its ids. `make test` builds the site before the tests run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE = join(dirname(fileURLToPath(import.meta.url)), 'site');
export const DIST = join(SITE, 'dist');
/** The test site's origin and base (see site/astro.config.mjs). */
export const ORIGIN = 'https://violet.test';
export const BASE = '/violet-tests/';

/** A page's HTML, by its address: `page('work/prose')`. */
export function html(address) {
  if (!existsSync(DIST)) throw new Error('the test site is not built: run make test, which builds it first');
  const file = join(DIST, address, 'index.html');
  if (!existsSync(file)) throw new Error(`no page at ${address}`);
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

/**
 * An address inside the site as the tests write it: without the base, so
 * `/work/spec/`. One that lacks the base comes back marked, so it fails.
 */
function local(href) {
  if (!href.startsWith('/')) return href;
  return href.startsWith(BASE) ? `/${href.slice(BASE.length)}` : `NO BASE ${href}`;
}

/**
 * The links in some HTML, as { href, text }, with addresses as `local`
 * gives them. A link is matched only when no <a> opens inside it, so of
 * two nested anchors only the inner one is found, and a test expecting the
 * outer one fails.
 */
function linksOf(content) {
  return [...content.matchAll(/<a\s[^>]*?href="([^"]*)"[^>]*>((?:(?!<a[\s>]).)*?)<\/a>/gs)].map(([, href, inner]) => ({ href: local(href), raw: href, text: strip(inner) }));
}

/** Every link in the main content. */
export function links(address) {
  return linksOf(main(address));
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
  return linksOf(sentence(address, label));
}

/** The part of a page from one marker up to another, failing when either is missing. */
export function between(content, from, to) {
  const start = content.indexOf(from);
  if (start < 0) throw new Error(`no ${from}`);
  const end = content.indexOf(to, start);
  if (end < 0) throw new Error(`no ${to} after ${from}`);
  return content.slice(start, end);
}

/** Every id on a page. */
export function ids(address) {
  return [...html(address).matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id);
}
