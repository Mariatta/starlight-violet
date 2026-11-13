/**
 * Anchors on a numbered table's rows, as a Sätteri hast plugin: a table whose
 * first header cell is `#` (tasks), `Task`, `Stage`, `Step` or `Phase` gives
 * each row numbered `1` or `1.2` the id `task-1-2`, `stage-1` and so on, so
 * "task 1.2" and "Stage 1" in the folder can link to the row (see links.ts).
 * It runs on the HTML tree because Sätteri drops `data.hProperties` on mdast
 * table rows and cells. A row gets its id only when the page's source gives
 * it (`rowAnchors`), which is what links are worked out from, and never one
 * a heading of the page already has.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { HastPluginEntry } from 'satteri';
import { isRowLabel, rowAnchors, rowId, rowKind } from '../lib/references';

interface Element {
  type: string;
  tagName?: string;
  value?: string;
  children?: Element[];
}

function text(node: Element | undefined): string {
  if (!node) return '';
  return node.type === 'text' ? (node.value ?? '') : (node.children ?? []).map(text).join('');
}

function child(node: Element | undefined, tag: string): Element | undefined {
  return node?.children?.find((c) => c.tagName === tag);
}

export function rowAnchorsPlugin(): HastPluginEntry {
  return ({ fileURL }: { fileURL?: URL }) => {
    const file = fileURL ? fileURLToPath(fileURL) : undefined;
    const used = new Set<string>();
    let allowed: Set<string> | undefined;
    return {
      name: 'violet-row-anchors',
      element: {
        filter: ['table'],
        visit(table: Element, ctx: { setProperty(node: Element, key: string, value: string): void }) {
          const kind = rowKind(text(child(child(child(table, 'thead'), 'tr'), 'th')));
          if (!kind) return;
          // Worked out on the first numbered table only, and cached per file.
          allowed ??= file && existsSync(file) ? rowAnchors(file) : new Set();
          for (const row of child(table, 'tbody')?.children?.filter((c) => c.tagName === 'tr') ?? []) {
            const label = text(child(row, 'td')).trim();
            if (!isRowLabel(label)) continue;
            const id = rowId(kind, label);
            if (!allowed.has(id) || used.has(id)) continue;
            used.add(id);
            ctx.setProperty(row, 'id', id);
          }
        },
      },
    } as never;
  };
}
