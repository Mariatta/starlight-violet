/**
 * Reading a note's Markdown as the renderer will see it, with the site's own
 * parser, and remembering what was worked out from a file until the file
 * changes. Shared by the plan, heading and table-row readers, so they agree
 * with each other and with the rendered page.
 */
import { existsSync, statSync } from 'node:fs';
import type { Root } from 'mdast';
import { markdownToMdast, type Features } from 'satteri';

// The features the site's Markdown is parsed with, recorded when Violet sets up the
// processor. Astro loads the config and the content loader as separate module
// instances, so they live on the global object.
const FEATURES = Symbol.for('starlight-violet.parse-features');
const store = globalThis as Record<symbol, unknown>;

/** Record the features the site's Markdown is parsed with, so `parse` reads notes as the page renders them. */
export function setParseFeatures(features: Features): void {
  store[FEATURES] = features;
}

const trees = new Map<string, Root>();

/**
 * A body's Markdown tree, read by the same parser and features the site
 * renders with, so headings, tables and parts are found where the page has
 * them. The last few hundred trees are kept, since one body is asked about
 * many times.
 */
export function parse(body: string): Root {
  let tree = trees.get(body);
  if (tree) {
    trees.delete(body);
  } else {
    const features = (store[FEATURES] as Features | undefined) ?? { gfm: true, directive: true };
    tree = markdownToMdast(body, { features }) as Root;
  }
  trees.set(body, tree);
  if (trees.size > 300) trees.delete(trees.keys().next().value!);
  return tree;
}

/** A node's text as it reads: its text and code, without raw HTML tags. */
export function textOf(node: { type: string; value?: string; children?: unknown[] }): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
  return ((node.children ?? []) as (typeof node)[]).map(textOf).join('');
}

/** Every node of a type in a tree, in document order. */
export function nodesOf<T>(tree: { children?: unknown[] }, type: string): T[] {
  const found: T[] = [];
  const walk = (node: { type?: string; children?: unknown[] }) => {
    if (node.type === type) found.push(node as T);
    for (const child of (node.children ?? []) as (typeof node)[]) walk(child);
  };
  walk(tree);
  return found;
}

const memo = new Map<string, { mtime: number; value: unknown }>();
/** Entries kept at most; the least recently used goes first, so a long dev session does not grow it forever. */
const LIMIT = 20000;

/**
 * A value worked out from a file or folder, worked out again only when its
 * modification time changes: one page renders many fragments (the body,
 * every handoff field), and each asks about the same few files.
 */
export function cached<T>(path: string, key: string, compute: () => T): T {
  const mtime = existsSync(path) ? statSync(path).mtimeMs : -1;
  const id = `${key}:${path}`;
  const hit = memo.get(id);
  memo.delete(id);
  if (hit && hit.mtime === mtime) {
    memo.set(id, hit);
    return hit.value as T;
  }
  const value = compute();
  memo.set(id, { mtime, value });
  if (memo.size > LIMIT) memo.delete(memo.keys().next().value!);
  return value;
}
