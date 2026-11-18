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
 * Everything is decided by the parser, not by guessing over the text. Such
 * a field is rendered on its own (`renderPlain`), with the site's features
 * and plugins and, ahead of them, the plugin here that flattens the tree.
 */
import { markdownToHtml, type Features, type HastPluginList, type MdastPluginEntry, type MdastPluginList } from 'satteri';

interface Pipeline {
  features: Features;
  mdastPlugins: MdastPluginList;
  hastPlugins: HastPluginList;
}

// Astro loads the config (which records the pipeline) and the content loader
// as separate module instances, so it lives on the global object.
const PIPELINE = Symbol.for('starlight-violet.render-pipeline');
const store = globalThis as Record<symbol, unknown>;

/** Record the site's Markdown features and plugins, so a plain field renders as the page around it does. */
export function setPipeline(pipeline: Pipeline): void {
  store[PIPELINE] = pipeline;
}

/**
 * A fragment Astro would take for front matter (`---` or `+++` at its start,
 * after blank lines) loses that text or fails to render; a backslash before
 * the first character keeps it text. Every inline render through Astro needs this.
 */
export function notFrontMatter(text: string): string {
  return text.replace(/^(\s*)([-+])(?=\2\2)/, '$1\\$2');
}

/** `text` as one line of inline Markdown, with raw HTML read as text, as written in `fileURL`. */
export async function renderPlain(text: string, fileURL: URL): Promise<string> {
  const pipeline = store[PIPELINE] as Pipeline | undefined;
  if (!pipeline) throw new Error('starlight-violet: a plain field was rendered before the site set up its Markdown');
  const { html } = await markdownToHtml(text, {
    // Front matter is the page's, never a field's.
    features: { ...pipeline.features, frontmatter: false },
    mdastPlugins: [plainHtmlPlugin(), ...pipeline.mdastPlugins],
    hastPlugins: pipeline.hastPlugins,
    fileURL,
    // What Astro's own renders give plugins, so a site's plugin that reads it works here too.
    data: { astro: { frontmatter: {}, headings: [], localImagePaths: new Set(), remoteImagePaths: new Set() } },
  });
  return html.trim();
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
  if (node.type === 'html') return [{ type: 'text', value: String(node.value) }];
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

/** The plugin that makes a fragment one line: `renderPlain` runs it first. */
function plainHtmlPlugin(): MdastPluginEntry {
  return ({ source }) => ({
    name: 'violet-plain',
    options: { position: true },
    before(root, ctx) {
      const blocks = root.children as unknown as Node[];
      if (blocks.length === 0 || (blocks.length === 1 && blocks[0].type === 'paragraph')) return;
      const children = flatten({ type: 'root', children: blocks, position: { start: { offset: blocks[0].position?.start.offset }, end: { offset: blocks.at(-1)!.position?.end.offset } } }, source);
      ctx.replaceNode(root.children[0], { type: 'paragraph', children } as never);
      for (const block of root.children.slice(1)) ctx.removeNode(block);
    },
    html(node, ctx) {
      ctx.replaceNode(node, { type: 'text', value: node.value });
    },
  });
}
