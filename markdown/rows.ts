/**
 * Anchors on a numbered table's rows, as a Sätteri hast plugin: a table whose
 * first header cell is `#` (tasks), `Task`, `Stage`, `Step` or `Phase` gives
 * each row numbered `1` or `1.2` the id `task-1-2`, `stage-1` and so on, so
 * "task 1.2" and "Stage 1" in the folder can link to the row (see links.ts).
 * It runs on the HTML tree because Sätteri drops `data.hProperties` on mdast
 * table rows and cells.
 */
import type { HastPluginEntry } from 'satteri';
import { isRowLabel, rowId, rowKind } from '../lib/references';

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
  return () => {
    const used = new Set<string>();
    return {
      name: 'violet-row-anchors',
      element: {
        filter: ['table'],
        visit(table: Element, ctx: { setProperty(node: Element, key: string, value: string): void }) {
          const kind = rowKind(text(child(child(child(table, 'thead'), 'tr'), 'th')));
          if (!kind) return;
          for (const row of child(table, 'tbody')?.children?.filter((c) => c.tagName === 'tr') ?? []) {
            const label = text(child(row, 'td')).trim();
            if (!isRowLabel(label)) continue;
            const id = rowId(kind, label);
            if (used.has(id)) continue;
            used.add(id);
            ctx.setProperty(row, 'id', id);
          }
        },
      },
    } as never;
  };
}
