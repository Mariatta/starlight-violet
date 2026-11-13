/**
 * Fields that were plain text before they were Markdown (a handoff's
 * `blocks`, `answer` and `next_steps`) render as one line of inline
 * Markdown. Raw HTML in them shows as text, so a placeholder such as `<id>`
 * is not lost, and whatever the parser reads as a block (a list, heading,
 * quote, code block, table, definition) is flattened back into the line,
 * the markers around its text kept as written, so "1. Run the tests" is not
 * a list inside a step. Emphasis, code, links and references inside work as
 * in the body; a marker inside a paragraph's own lines, such as the `>` on a
 * quote's second line, is gone, as the parser read it.
 *
 * Everything is decided by the parser, not by guessing over the text. The
 * loader marks such a render (`renderPlain`) with a comment of its own at
 * the end of the source, `<!--violet-plain:N-->`, whose number it
 * registers; the plugin factory, which Sätteri hands the source, looks for
 * a registered one, and the plugin removes the comment before anything
 * renders. A normal render of the same text carries no mark, so it is not
 * affected.
 */
import type { MdastPluginEntry } from 'satteri';

// Astro loads the config (which registers the plugin) and the content loader
// as separate module instances, so the register lives on the global object.
const REGISTER = Symbol.for('starlight-violet.plain-renders');
const plainRenders: { next: number; open: Set<number> } = ((globalThis as Record<symbol, unknown>)[REGISTER] ??= { next: 0, open: new Set() }) as {
  next: number;
  open: Set<number>;
};
const MARK = /\n\n<!--violet-plain:(\d+)-->\n?$/;

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
  const id = plainRenders.next++;
  plainRenders.open.add(id);
  try {
    const html = await render(`${text}\n\n<!--violet-plain:${id}-->\n`);
    // The mark is removed in the tree; a text ending inside an HTML block that
    // only its own terminator closes (<!--, <pre>, <script>) swallows it, so
    // whatever is left of it goes here too.
    return html.replace(new RegExp(String.raw`\s*(?:<|&lt;)!--violet-plain:${id}--(?:>|&gt;)\s*`, 'g'), '').trim();
  } finally {
    plainRenders.open.delete(id);
  }
}

interface Node {
  type: string;
  value?: string;
  children?: Node[];
  position?: { start: { offset?: number }; end: { offset?: number } };
}

/** Inline nodes, which flattening keeps as they are; the parser has already read their escapes and entities. */
const INLINE = new Set([
  'text', 'emphasis', 'strong', 'delete', 'inlineCode', 'break', 'link', 'linkReference', 'image', 'imageReference',
  'footnoteReference', 'html', 'textDirective', 'inlineMath', 'superscript', 'subscript',
]);

/**
 * A block's inline content: the inline nodes inside it, with the source
 * between them (list markers, `#`, `>`, table pipes, line ends) as text. A
 * block with no inline content (code, a thematic break, a definition) reads
 * as its source.
 */
function flatten(node: Node, source: string): Node[] {
  // Raw HTML is text here: made so now, not left to the html visitor, since
  // the block it came from is removed once its content is moved.
  if (node.type === 'html') return [{ type: 'text', value: withoutMark(String(node.value)) }];
  if (INLINE.has(node.type)) return [node];
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  // Without positions (a node a plugin made), keep what can be kept.
  if (start === undefined || end === undefined) return (node.children ?? []).flatMap((child) => flatten(child, source));
  if (!node.children?.length) return [{ type: 'text', value: source.slice(start, end) }];
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

/** An HTML block's value without the mark it swallowed, when the text ended inside it. */
function withoutMark(value: string): string {
  return value.replace(/\s*<!--violet-plain:\d+-->\s*$/, '');
}

export function plainHtmlPlugin(): MdastPluginEntry {
  return ({ source }) => {
    const mark = MARK.exec(source);
    if (!mark || !plainRenders.open.has(Number(mark[1]))) return null;
    // The text as written, without the mark: what the blocks are flattened from.
    const text = source.slice(0, mark.index);
    return {
      name: 'violet-plain',
      options: { position: true },
      before(root, ctx) {
        const all = root.children as unknown as Node[];
        const last = all.at(-1);
        const blocks = last?.type === 'html' && /^<!--violet-plain:\d+-->$/.test(String(last.value).trim()) ? all.slice(0, -1) : all;
        if (blocks.length < all.length) ctx.removeNode(root.children.at(-1)!);
        if (blocks.length <= 1 && (blocks.length === 0 || blocks[0].type === 'paragraph')) return;
        const children = flatten({ type: 'root', children: blocks, position: { start: { offset: blocks[0].position?.start.offset }, end: { offset: blocks.at(-1)!.position?.end.offset } } }, text);
        ctx.replaceNode(root.children[0], { type: 'paragraph', children } as never);
        for (const block of root.children.slice(1, blocks.length)) ctx.removeNode(block);
      },
      html(node, ctx) {
        ctx.replaceNode(node, { type: 'text', value: withoutMark(node.value) });
      },
    };
  };
}
