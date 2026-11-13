/**
 * What prose in a work folder refers to by name: the handoff's questions
 * ("Q3"), the folder's other capitalised pages ("SPEC", "PLAN.md §6",
 * "SPEC principle 2") and the rows of a plan's task and stage tables
 * ("task 1.2", "Stage 1"). Each lookup returns the address to link to, or
 * nothing when the folder has no such thing, so unmatched prose stays text.
 */
import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { idFor, notesDir, pageUrl, readPage, splitTitle, type Page } from './notes';
import { anchorUrl, headings, isSplit, pageParts } from './plans';
import { cached, fencedLines } from './source';

/** A table whose first header cell is one of these numbers its rows: `#` rows are tasks. */
const ROW_KINDS: Record<string, 'task' | 'stage' | 'step' | 'phase'> = {
  '#': 'task',
  task: 'task',
  stage: 'stage',
  step: 'step',
  phase: 'phase',
};
const ROW_LABEL = /^\d+(?:\.\d+)*$/;

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

function page(file: string): Page {
  return cached(file, 'page', () => readPage(file));
}

function markdownFiles(dir: string): string[] {
  return cached(dir, 'dir', () => (existsSync(dir) ? readdirSync(dir).filter((n) => extname(n) === '.md').sort().map((n) => join(dir, n)) : []));
}

/**
 * The numbered rows of a body's tables, by kind and label. Fenced code is
 * skipped as the renderer skips it (see source.ts), and so is a line
 * indented four spaces, which is code too.
 */
export function tableRows(body: string): Map<string, Map<string, string>> {
  const rows = new Map<string, Map<string, string>>();
  const lines = body.split('\n');
  const code = fencedLines(lines);
  const delimiter = (line: string) => /^ {0,3}\|?\s*:?-{3,}/.test(line);
  let kind: string | undefined;
  lines.forEach((line, index) => {
    if (code[index] || /^ {4}/.test(line) || !line.trim().startsWith('|')) {
      kind = undefined;
      return;
    }
    if (delimiter(lines[index + 1] ?? '') && !code[index + 1]) {
      kind = rowKind(cells(line)[0] ?? '');
      return;
    }
    if (!kind || delimiter(line)) return;
    const label = cells(line)[0] ?? '';
    if (!isRowLabel(label)) return;
    if (!rows.has(kind)) rows.set(kind, new Map());
    if (!rows.get(kind)!.has(label)) rows.get(kind)!.set(label, rowId(kind, label));
  });
  return rows;
}

/** The bodies of a page as it renders: its parts when it is split, else the whole page. */
function renderedBodies(file: string): { url: string; body: string }[] {
  const { data, body } = page(file);
  const rest = splitTitle(body).body;
  const url = pageUrl(idFor(file, notesDir()));
  return isSplit(data) && file.startsWith(notesDir()) ? pageParts(idFor(file, notesDir()), data, rest) : [{ url, body: rest }];
}

/**
 * The row anchors a page may carry: those its source gives, less those a
 * heading already has. rows.ts gives a rendered row an id only when it is
 * here, so a link worked out from the source never points at an id the
 * page lacks.
 */
export function rowAnchors(file: string): Set<string> {
  return cached(file, 'row-anchors', () => {
    const taken = renderedAnchors(file);
    const ids = new Set<string>();
    for (const { body } of renderedBodies(file)) {
      for (const rows of tableRows(body).values()) for (const id of rows.values()) if (!taken.has(id)) ids.add(id);
    }
    return ids;
  });
}

export interface Sibling {
  file: string;
  url: string;
}

/** The pages in a page's folder whose file names are capitals, such as SPEC.md and PLAN.md, by name; README.md is not one. */
export function siblingPages(file: string): Map<string, Sibling> {
  const pages = new Map<string, Sibling>();
  for (const target of markdownFiles(dirname(file))) {
    const stem = basename(target, '.md');
    // A bare "README" in prose usually means some repository's README, not the folder's page.
    if (!/^[A-Z][A-Z0-9_-]+$/.test(stem) || stem === 'README') continue;
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
export function sectionUrl(sibling: Sibling, ref: { number?: string; principle?: boolean }): string | undefined {
  const found = cached(sibling.file, 'headings', () => headings(splitTitle(page(sibling.file).body).body)).find(({ text }) =>
    ref.principle
      ? /^(?:\d+[a-z]?\.?\s+)?principles\b/i.test(text)
      : ref.number !== undefined && new RegExp(`^${ref.number.replace(/\./g, '\\.')}(?:[.:)](?![0-9a-z])|\\s|$)`, 'i').test(text),
  );
  return found && at(sibling, found.slug);
}

/**
 * The questions of the handoffs in a page's folder, by id (`Q3`), each
 * linking to its row. On a handoff page its own questions win; elsewhere an
 * id that two handoffs of the folder both ask links to neither.
 */
export function folderQuestions(file: string): Map<string, string> {
  const own = new Map<string, string>();
  const shared = new Map<string, string | undefined>();
  for (const target of markdownFiles(dirname(file))) {
    const { data } = page(target);
    if (data.kind !== 'handoff' || !Array.isArray(data.open_questions)) continue;
    const url = pageUrl(idFor(target, notesDir()));
    for (const question of data.open_questions as { id?: unknown }[]) {
      const id = String(question?.id ?? '');
      if (!id) continue;
      const anchor = `${url}#${id.toLowerCase()}`;
      if (target === file) own.set(id, anchor);
      else shared.set(id, shared.has(id) && shared.get(id) !== anchor ? undefined : anchor);
    }
  }
  const questions = new Map<string, string>();
  for (const [id, anchor] of shared) if (anchor) questions.set(id, anchor);
  for (const [id, anchor] of own) questions.set(id, anchor);
  return questions;
}

/**
 * The plan in a page's folder (PLAN.md, else a planning page of type plan),
 * and its numbered rows by kind, each on the part of a split plan that
 * holds its table. A row whose anchor a heading of the plan already has
 * gets no id of its own (see rows.ts), so a reference to it lands on that
 * heading.
 */
export function folderRows(file: string): Map<string, Map<string, string>> {
  let plan = siblingPages(file).get('PLAN');
  if (!plan) {
    const target = markdownFiles(dirname(file)).find((f) => page(f).data.type === 'plan');
    if (target) plan = { file: target, url: pageUrl(idFor(target, notesDir())) };
  }
  if (!plan) return new Map();
  const planFile = plan.file;
  return cached(planFile, 'rows', () => {
    const taken = renderedAnchors(planFile);
    const out = new Map<string, Map<string, string>>();
    for (const part of renderedBodies(planFile)) {
      for (const [kind, rows] of tableRows(part.body)) {
        if (!out.has(kind)) out.set(kind, new Map());
        for (const [label, id] of rows) {
          // A heading with the row's anchor keeps it, wherever that heading is.
          const target = taken.has(id) ? at(plan!, id) : `${part.url}#${id}`;
          if (!out.get(kind)!.has(label)) out.get(kind)!.set(label, target);
        }
      }
    }
    return out;
  });
}

/**
 * The heading anchors a page renders, which a table row's anchor must not
 * repeat: on a split page, those of its parts, whose own `# ` lines are
 * page titles rather than headings.
 */
export function renderedAnchors(file: string): Set<string> {
  return cached(file, 'anchors', () => new Set(renderedBodies(file).flatMap(({ body }) => headings(body).map(({ slug }) => slug))));
}
