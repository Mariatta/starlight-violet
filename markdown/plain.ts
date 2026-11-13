/**
 * Fields that were plain text before they were Markdown (a handoff's
 * `blocks`, `answer` and `next_steps`) render as one line of inline
 * Markdown. Raw HTML in them shows as text, so a placeholder such as `<id>`
 * is not lost, and whatever the parser reads as a block (a list, heading,
 * quote, code block, table, definition) is flattened back into the line,
 * its markers kept as written, so "1. Run the tests" is not a list inside
 * a step. Emphasis, code, links and references inside work as in the body.
 *
 * Everything is decided by the parser, not by guessing over the text. The
 * loader marks such a render by registering its source (`renderPlain`), and
 * the plugin factory, which Sätteri hands the source, checks the register;
 * nothing else about the render changes.
 */
import type { MdastPluginEntry } from 'satteri';

// Astro loads the config (which registers the plugin) and the content loader
// as separate module instances, so the register lives on the global object.
const REGISTER = Symbol.for('starlight-violet.plain-sources');
const plainSources: Map<string, number> = ((globalThis as Record<symbol, unknown>)[REGISTER] ??= new Map()) as Map<string, number>;

/**
 * A fragment Astro would take for front matter (`---` or `+++` at its start,
 * after blank lines) loses that text or fails to render; a backslash before
 * the first character keeps it text. Every inline render needs this.
 */
export function notFrontMatter(text: string): string {
  return text.replace(/^(\s*)([-+])(?=\2\2)/, '$1\\$2');
}

/** Run `render` on `text` as one line of inline Markdown, with raw HTML read as text. */
export async function renderPlain(text: string, render: (source: string) => Promise<string>): Promise<string> {
  plainSources.set(text, (plainSources.get(text) ?? 0) + 1);
  try {
    return await render(text);
  } finally {
    const left = plainSources.get(text)! - 1;
    if (left) plainSources.set(text, left);
    else plainSources.delete(text);
  }
}

interface Node {
  type: string;
  value?: string;
  children?: Node[];
  position?: { start: { offset?: number }; end: { offset?: number } };
}

/** A block's inline content: its paragraphs' children, with the source between them (markers, line ends) as text. */
function flatten(node: Node, source: string): Node[] {
  if (node.type === 'paragraph') return node.children ?? [];
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return [];
  // A leaf block (code, table, thematic break, definition, html) reads as written.
  if (!node.children?.length || node.type === 'table') return [{ type: 'text', value: source.slice(start, end) }];
  const out: Node[] = [];
  let cursor = start;
  for (const child of node.children) {
    const from = child.position?.start.offset ?? cursor;
    if (from > cursor) out.push({ type: 'text', value: source.slice(cursor, from) });
    out.push(...flatten(child, source));
    cursor = child.position?.end.offset ?? cursor;
  }
  if (end > cursor) out.push({ type: 'text', value: source.slice(cursor, end) });
  return out;
}

export function plainHtmlPlugin(): MdastPluginEntry {
  return ({ source }) => {
    if (!plainSources.has(source)) return null;
    return {
      name: 'violet-plain',
      options: { position: true },
      before(root, ctx) {
        const blocks = root.children as unknown as Node[];
        if (blocks.length === 1 && blocks[0].type === 'paragraph') return;
        const children = flatten(root as unknown as Node, source);
        if (blocks.length === 0) return;
        ctx.replaceNode(root.children[0], { type: 'paragraph', children } as never);
        for (const block of root.children.slice(1)) ctx.removeNode(block);
      },
      html(node, ctx) {
        ctx.replaceNode(node, { type: 'text', value: node.value });
      },
    };
  };
}
