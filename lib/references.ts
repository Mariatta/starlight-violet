/**
 * What prose in a work folder refers to by name: the handoff's questions
 * ("Q3"), the folder's other capitalised pages ("SPEC", "PLAN.md §6",
 * "SPEC principle 2") and the rows of a plan's task and stage tables
 * ("task 1.2", "Stage 1"). Each lookup returns the address to link to, or
 * nothing when the folder has no such thing, so unmatched prose stays text.
 */
import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { idFor, notesDir, pageUrl, readPage, splitTitle } from './notes';
import { anchorUrl, headings } from './plans';
import { readHandoffs } from './records';

/** A table whose first header cell is one of these numbers its rows: `#` rows are tasks. */
const ROW_KINDS: Record<string, 'task' | 'stage' | 'step' | 'phase'> = {
  '#': 'task',
  task: 'task',
  stage: 'stage',
  step: 'step',
  phase: 'phase',
};
const ROW_LABEL = /^\d+(?:\.\d+)*$/;
const FENCE = /^\s*(```|~~~)/;

/** The anchor a numbered table row gets: `task-1-2`, `stage-1`. */
export function rowId(kind: string, label: string): string {
  return `${kind}-${label.replace(/\./g, '-')}`;
}

/** The row kind a table's first header cell names, if it numbers its rows. */
export function rowKind(header: string): string | undefined {
  return ROW_KINDS[header.trim().toLowerCase()];
}

/** Whether a first cell is a row number such as `1` or `1.2`. */
export function isRowLabel(cell: string): boolean {
  return ROW_LABEL.test(cell.trim());
}

function cells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
}

/** The numbered rows of a body's tables, by kind and label. */
export function tableRows(body: string): Map<string, Map<string, string>> {
  const rows = new Map<string, Map<string, string>>();
  const lines = body.split('\n');
  let fence: string | undefined;
  let kind: string | undefined;
  lines.forEach((line, index) => {
    const marker = FENCE.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker === fence) fence = undefined;
      return;
    }
    if (fence || !line.trim().startsWith('|')) {
      kind = undefined;
      return;
    }
    const next = lines[index + 1] ?? '';
    if (/^\s*\|?\s*:?-{3,}/.test(next)) {
      kind = rowKind(cells(line)[0] ?? '');
      return;
    }
    if (!kind || /^\s*\|?\s*:?-{3,}/.test(line)) return;
    const label = cells(line)[0] ?? '';
    if (!isRowLabel(label)) return;
    if (!rows.has(kind)) rows.set(kind, new Map());
    if (!rows.get(kind)!.has(label)) rows.get(kind)!.set(label, rowId(kind, label));
  });
  return rows;
}

export interface Sibling {
  file: string;
  url: string;
}

/** The pages in a page's folder whose file names are capitals, such as SPEC.md and PLAN.md, by name; README.md is not one. */
export function siblingPages(file: string): Map<string, Sibling> {
  const dir = dirname(file);
  const pages = new Map<string, Sibling>();
  if (!existsSync(dir)) return pages;
  for (const name of readdirSync(dir)) {
    if (extname(name) !== '.md') continue;
    const stem = basename(name, '.md');
    // A bare "README" in prose usually means some repository's README, not the folder's page.
    if (!/^[A-Z][A-Z0-9_-]+$/.test(stem) || stem === 'README') continue;
    const target = join(dir, name);
    pages.set(stem, { file: target, url: pageUrl(idFor(target, notesDir())) });
  }
  return pages;
}

/** The address of an anchor on a page: on the part that holds it when the page is split. */
function at(page: Sibling, slug: string): string {
  return anchorUrl(page.file, slug) ?? `${page.url}#${slug}`;
}

/**
 * A section of a page by its number ("6", "6.4", "1a"): the heading whose
 * text starts with it. With `principle`, the page's Principles section.
 */
export function sectionUrl(page: Sibling, ref: { number?: string; principle?: boolean }): string | undefined {
  const body = splitTitle(readPage(page.file).body).body;
  const found = headings(body).find(({ text }) =>
    ref.principle
      ? /^(?:\d+[a-z]?\.?\s+)?principles\b/i.test(text)
      : ref.number !== undefined && new RegExp(`^${ref.number.replace(/\./g, '\\.')}(?:[.:)]|\\s)`, 'i').test(text),
  );
  return found && at(page, found.slug);
}

/** The questions of the handoff in a page's folder, by id (`Q3`), each linking to its row. */
export function folderQuestions(file: string): Map<string, string> {
  const dir = dirname(file);
  const questions = new Map<string, string>();
  for (const handoff of readHandoffs()) {
    if (dirname(handoff.file) !== dir) continue;
    for (const question of (handoff.data.open_questions as { id?: unknown }[] | undefined) ?? []) {
      const id = String(question.id ?? '');
      if (id && !questions.has(id)) questions.set(id, `${handoff.url}#${id.toLowerCase()}`);
    }
  }
  return questions;
}

/** The plan in a page's folder (PLAN.md, else a planning page of type plan), and its numbered rows by kind. */
export function folderRows(file: string): Map<string, Map<string, string>> {
  const dir = dirname(file);
  let plan = siblingPages(file).get('PLAN');
  if (!plan && existsSync(dir)) {
    for (const name of readdirSync(dir).filter((n) => extname(n) === '.md')) {
      const target = join(dir, name);
      if (readPage(target).data.type === 'plan') plan = { file: target, url: pageUrl(idFor(target, notesDir())) };
    }
  }
  const out = new Map<string, Map<string, string>>();
  if (!plan) return out;
  for (const [kind, rows] of tableRows(readPage(plan.file).body)) {
    out.set(kind, new Map([...rows].map(([label, id]) => [label, at(plan, id)])));
  }
  return out;
}
