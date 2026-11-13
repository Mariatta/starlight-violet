/**
 * Raw HTML as text, for front matter fields that were plain text before they
 * were Markdown (a handoff's `blocks`, `answer` and `next_steps`): a
 * placeholder such as `<id>` there shows as written instead of becoming a
 * tag. The parser decides what is HTML, so links, code spans and autolinks
 * read exactly as in the body. The loader asks for it by rendering with
 * `PLAIN_HTML` as the file URL's hash; any other render is left alone.
 */
import type { MdastPluginEntry } from 'satteri';

export const PLAIN_HTML = 'violet-plain-html';

export function plainHtmlPlugin(): MdastPluginEntry {
  return ({ fileURL }) => {
    if (fileURL?.hash !== `#${PLAIN_HTML}`) return { name: 'violet-plain-html' };
    return {
      name: 'violet-plain-html',
      html(node, ctx) {
        ctx.replaceNode(node, { type: 'text', value: node.value });
      },
    };
  };
}
