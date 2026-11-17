/**
 * Reading a note's Markdown as the renderer will see it, with the site's own
 * parser, and remembering what was worked out from a file until the file
 * changes. Shared by the plan, heading and table-row readers, so they agree
 * with each other and with the rendered page.
 */
import { statSync } from 'node:fs';
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

/**
 * Maps that hold what one turn of the event loop worked out, emptied at the
 * end of it. One render asks about the same bodies many times, but holding
 * every body's tree for a whole dev session would keep the notes in memory
 * many times over; what is worth keeping longer is kept by `cached`, against
 * the file's modification time.
 */
const forTurn = new Set<Map<unknown, unknown>>();
let clearing = false;

/** A map emptied at the end of each turn of the event loop. */
export function turnMap<K, V>(): Map<K, V> {
  const map = new Map<K, V>();
  forTurn.add(map as Map<unknown, unknown>);
  return map;
}

/** Empty every turn map at the end of this turn. Call before adding to one. */
export function clearAfterTurn(): void {
  if (clearing) return;
  clearing = true;
  setImmediate(() => {
    clearing = false;
    for (const map of forTurn) map.clear();
  });
}

let seen: unknown;

/**
 * Forget what was worked out with other features: a tree parsed before the
 * site recorded its features, or before a dev server reloaded its config,
 * would read headings with the wrong smart punctuation.
 */
function freshen(): void {
  if (store[FEATURES] === seen) return;
  seen = store[FEATURES];
  for (const map of forTurn) map.clear();
  memo.clear();
}

const trees = turnMap<string, Root>();

/**
 * A body's Markdown tree, read by the same parser and features the site
 * renders with, so headings, tables and parts are found where the page has
 * them. With `smart: false`, smart punctuation is left off, so text reads
 * as it was written (`What's next`, not `What’s next`): what a page's
 * headings are compared with. Trees are kept until the end of the turn of
 * the event loop (see `turnMap`), since a render asks about one body many
 * times; with `keep: false` the tree is not kept, and `position: false`
 * leaves out its positions.
 */
export function parse(body: string, { keep = true, smart = true, position = true } = {}): Root {
  freshen();
  // Bodies come with their front matter already removed, and often their title line too,
  // so a leading `---` is a thematic break, not front matter.
  const features: Features = { ...((store[FEATURES] as Features | undefined) ?? { gfm: true, directive: true }), frontmatter: false };
  if (!smart) features.smartPunctuation = false;
  // A one-off text, such as a shortcode's table, is not worth a place among the bodies,
  // and may go without positions, which would point into a source no page has.
  if (!keep) return markdownToMdast(body, { features, position }) as Root;
  clearAfterTurn();
  const key = smart ? body : `\0${body}`;
  let tree = trees.get(key);
  if (tree) trees.delete(key);
  else tree = markdownToMdast(body, { features }) as Root;
  trees.set(key, tree);
  if (trees.size > 600) trees.delete(trees.keys().next().value!);
  return tree;
}

interface TextNode {
  type: string;
  value?: string;
  name?: string;
  label?: string;
  identifier?: string;
  children?: TextNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
}

/**
 * A node's text as the rendered page reads it, which is what its anchor is
 * made from: text and code, a footnote reference's label, `:task[3]` as
 * "Task 3" and `:pr[2]` as "PR 2" (what Violet makes of them), any other
 * text directive as its source (it renders as written), and no raw HTML
 * tags. `source` is the text the node was parsed from.
 */
export function textOf(node: TextNode, source?: string): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
  if (node.type === 'footnoteReference') return node.label ?? node.identifier ?? '';
  if (node.type === 'textDirective') {
    const label = (node.children ?? []).map((child) => textOf(child, source)).join('').trim();
    if (node.name === 'task') return `Task ${label}`;
    if (node.name === 'pr') return `PR ${label}`;
    const { start, end } = node.position ?? {};
    if (source !== undefined && start?.offset !== undefined && end?.offset !== undefined) return source.slice(start.offset, end.offset);
  }
  return (node.children ?? []).map((child) => textOf(child, source)).join('');
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
/**
 * Modification times read during the current turn of the event loop. One
 * render asks about the same files many times over; a file saved later is
 * read afresh on the next turn, so an edit is never missed.
 */
const mtimes = new Map<string, number>();

function mtimeOf(path: string): number {
  let mtime = mtimes.get(path);
  if (mtime === undefined) {
    if (mtimes.size === 0) setImmediate(() => mtimes.clear());
    mtime = statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? -1;
    mtimes.set(path, mtime);
  }
  return mtime;
}
/** Entries kept at most; the least recently used goes first, so a long dev session does not grow it forever. */
const LIMIT = 20000;

/**
 * A value worked out from a file or folder, worked out again only when its
 * modification time changes: one page renders many fragments (the body,
 * every handoff field), and each asks about the same few files.
 */
export function cached<T>(path: string, key: string, compute: () => T): T {
  freshen();
  const mtime = mtimeOf(path);
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
