/**
 * Anchors on a numbered table's rows: a table whose first header cell is
 * `#` (tasks), `Task`, `Stage`, `Step` or `Phase` gives each row numbered
 * `1` or `1.2` the id `task-1-2`, `stage-1` and so on, so "task 1.2" and
 * "Stage 1" in the folder can link to the row (see links.ts).
 *
 * A row gets its id only when the page's source gives it (`rowAnchors`),
 * which is what links are worked out from, and never one a heading of the
 * page already has. Its cells are read once, in the Markdown tree, with the
 * same `cellText` the links use, so the two cannot disagree: the mdast
 * plugin marks the row's first cell, and the hast plugin moves the mark's
 * id onto the row, since Sätteri drops `data.hProperties` on mdast table
 * rows and cells. The two run together, as every Sätteri render runs both
 * lists; until the hast plugin runs, a numbered row's first cell starts
 * with an empty emphasis, which mdast plugins after the mark see.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { HastPluginEntry, MdastPluginEntry } from 'satteri';
import { cellText, isRowLabel, rowAnchors, rowId, rowKind } from '../lib/references';

/**
 * The hash a page's fileURL carries when one of its front matter fields
 * renders on its own. The rows a field's table numbers are not the body's,
 * so they get no ids: the body's ids are the ones links point at.
 */
export const FIELD_HASH = '#violet-field';

/** The property of the mark a numbered row's first cell carries until the row takes its id. */
const MARK = 'dataVioletRow';

interface MdNode {
  type: string;
  children?: MdNode[];
}

export function rowMarksPlugin(): MdastPluginEntry {
  return ({ fileURL }) => {
    const file = fileURL ? fileURLToPath(fileURL) : undefined;
    const used = new Set<string>();
    let allowed: Set<string> | undefined;
    return {
      name: 'violet-row-marks',
      table(table, ctx) {
        const [header, ...rows] = ((table as MdNode).children ?? []) as MdNode[];
        const kind = rowKind(cellText(header?.children?.[0] ?? { type: 'text' }));
        if (!kind) return;
        // Worked out on the first numbered table only, and cached per file.
        allowed ??= file && fileURL?.hash !== FIELD_HASH && existsSync(file) ? rowAnchors(file) : new Set();
        for (const row of rows) {
          const cell = row.children?.[0];
          const label = cell ? cellText(cell).trim() : '';
          if (!cell || !isRowLabel(label)) continue;
          const id = rowId(kind, label);
          if (!allowed.has(id) || used.has(id)) continue;
          used.add(id);
          ctx.prependChild(cell as never, { type: 'emphasis', data: { hName: 'span', hProperties: { [MARK]: id } }, children: [] } as never);
        }
      },
    };
  };
}

interface Element {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: Element[];
}

export function rowAnchorsPlugin(): HastPluginEntry {
  return () => ({
    name: 'violet-row-anchors',
    element: {
      filter: ['tr'],
      visit(row: Element, ctx: { setProperty(node: Element, key: string, value: string): void; removeNode(node: Element): void }) {
        const mark = row.children?.find((c) => c.type === 'element')?.children?.find((c) => c.properties?.[MARK] !== undefined);
        if (!mark) return;
        ctx.setProperty(row, 'id', String(mark.properties![MARK]));
        ctx.removeNode(mark);
      },
    },
  }) as never;
}
