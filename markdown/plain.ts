/**
 * Fields that were plain text before they were Markdown (a handoff's
 * `blocks`, `answer` and `next_steps`) render as inline Markdown only: raw
 * HTML in them shows as text, so a placeholder such as `<id>` is not lost,
 * and a line that starts like a list, heading, quote, fence or table stays
 * a line of text, so "1. Run the tests" is not a list inside a step.
 *
 * The parser decides what is HTML, so links, code spans and autolinks read
 * exactly as in the body. The loader marks such a render by registering its
 * source (`renderPlain`), and the plugin factory, which Sätteri hands the
 * source, checks the register; nothing else about the render changes.
 */
import type { MdastPluginEntry } from 'satteri';

// Astro loads the config (which registers the plugin) and the content loader
// as separate module instances, so the register lives on the global object.
const REGISTER = Symbol.for('starlight-violet.plain-sources');
const plainSources: Map<string, number> = ((globalThis as Record<symbol, unknown>)[REGISTER] ??= new Map()) as Map<string, number>;

/** Run `render` on `text` with raw HTML read as text and block syntax kept literal. */
export async function renderPlain(text: string, render: (source: string) => Promise<string>): Promise<string> {
  const source = literalBlocks(text);
  plainSources.set(source, (plainSources.get(source) ?? 0) + 1);
  try {
    return await render(source);
  } finally {
    const left = plainSources.get(source)! - 1;
    if (left) plainSources.set(source, left);
    else plainSources.delete(source);
  }
}

/**
 * A backslash before what would start a block at the start of a line: a
 * list marker, heading, quote, fence, thematic break, setext underline,
 * table row or link reference definition. Indentation that would make code
 * is dropped, and blank lines are joined. Inline syntax is left alone.
 */
const BLOCK_STARTS = [
  /^[-+*](\s|$)/, // list item
  /^#{1,6}(\s|$)/, // heading
  /^>/, // quote
  /^(`{3,}|~{3,})/, // fence
  /^([-*_])(\s*\1){2,}\s*$/, // thematic break
  /^(=+|-+)\s*$/, // setext underline
  /^\|/, // table row
  /^\[[^\]]+\]:/, // link reference definition
];

export function literalBlocks(text: string): string {
  return text
    // One item is one paragraph: a blank line would close the step's own <p>.
    .replace(/\n\s*\n/g, '\n')
    .split('\n')
    .map((line) => {
      const indent = /^\s*/.exec(line)![0];
      const rest = line.slice(indent.length);
      const lead = indent.length >= 4 ? '' : indent;
      if (/^\d{1,9}[.)](\s|$)/.test(rest)) return lead + rest.replace(/^(\d{1,9})([.)])/, '$1\\$2');
      if (BLOCK_STARTS.some((start) => start.test(rest))) return `${lead}\\${rest}`;
      return lead + rest;
    })
    .join('\n');
}

export function plainHtmlPlugin(): MdastPluginEntry {
  return ({ source }) => {
    const plain = plainSources.has(source);
    return {
      name: 'violet-plain-html',
      html(node, ctx) {
        if (plain) ctx.replaceNode(node, { type: 'text', value: node.value });
      },
    };
  };
}
