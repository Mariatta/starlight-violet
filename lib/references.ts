/**
 * What prose in a work folder refers to by name: the handoff's questions
 * ("Q3"), the folder's other capitalised pages ("SPEC", "PLAN.md §6",
 * "SPEC principle 2") and the rows of a plan's task and stage tables
 * ("task 1.2", "Stage 1"). Each lookup returns the address to link to, or
 * nothing when the folder has no such thing, so unmatched prose stays text.
 */
import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { idFor, inNotes, isBuilt, notesDir, pageUrl, readPage, splitTitle, type Page } from './notes';
import { headings, isSplit, pageParts, planFor } from './plans';
import { cached, nodesOf, parse, textOf } from './source';

/** A table whose first header cell is one of these numbers its rows: `#` rows are tasks. */
const ROW_KINDS: Record<string, 'task' | 'stage' | 'step' | 'phase'> = {
  '#': 'task',
  task: 'task',
  stage: 'stage',
  step: 'step',
  phase: 'phase',
};
/** A row number, `1` or `1.2`: what a numbered row's first cell holds and what prose such as "task 1.2" names. */
export const ROW_NUMBER = String.raw`\d+(?:\.\d+)*`;
const ROW_LABEL = new RegExp(`^${ROW_NUMBER}$`);

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

/**
 * A table cell's text, as it decides a numbered row's kind and label: its
 * text and code, with footnote references and raw HTML left out. The
 * links (from the source) and the row anchors (rows.ts, from the Markdown
 * tree as it renders) both read cells with it, so a link names the id its
 * row gets.
 */
export function cellText(node: { type: string; children?: unknown[] }): string {
  if (node.type === 'footnoteReference') return '';
  if (!node.children || node.type === 'textDirective') return textOf(node as never);
  return (node.children as { type: string; children?: unknown[] }[]).map(cellText).join('');
}

/** A handoff question's anchor on its handoff, `q3` for Q3: the id of its row there. */
export function questionId(id: string): string {
  return id.toLowerCase();
}

/** The address of a handoff question's row, on the handoff at `url`. */
export function questionUrl(url: string, id: string): string {
  return `${url}#${encodeURIComponent(questionId(id))}`;
}

function page(file: string): Page {
  return cached(file, 'page', () => readPage(file));
}

/** The Markdown pages of a folder that the site builds: not skipped, not the landing page. */
function markdownFiles(dir: string): string[] {
  return cached(dir, 'dir', () =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter((n) => extname(n) === '.md')
          .sort()
          .map((n) => join(dir, n))
          .filter(isBuilt)
      : [],
  );
}


/**
 * The numbered rows of a body's tables, by kind and label: every table the
 * site's parser finds, read as rows.ts reads it rendered (the first header
 * cell names the kind, each row's first cell its label).
 */
export function tableRows(body: string): Map<string, Map<string, string>> {
  const rows = new Map<string, Map<string, string>>();
  type Node = { type: string; children?: Node[] };
  for (const table of nodesOf<Node>(parse(body), 'table')) {
    const [header, ...lines] = table.children ?? [];
    const kind = rowKind(cellText(header?.children?.[0] ?? { type: 'text' }));
    if (!kind) continue;
    for (const row of lines) {
      const label = cellText(row.children?.[0] ?? { type: 'text' }).trim();
      if (!isRowLabel(label)) continue;
      if (!rows.has(kind)) rows.set(kind, new Map());
      if (!rows.get(kind)!.has(label)) rows.get(kind)!.set(label, rowId(kind, label));
    }
  }
  return rows;
}

/** The bodies of a page as it renders: its parts when it is split, else the whole page. */
function renderedBodies(file: string): { url: string; body: string; title?: string }[] {
  const { data, body } = page(file);
  const rest = splitTitle(body).body;
  const url = pageUrl(idFor(file, notesDir()));
  return isSplit(data) && inNotes(file) ? pageParts(idFor(file, notesDir()), data, rest) : [{ url, body: rest }];
}

/**
 * A page's numbered table rows as it renders: for each row its kind, label
 * and the address of its anchor, always on the part that holds the row (a
 * heading on another part of a split page is another page). A row whose
 * anchor a heading already has gets no id of its own (see rows.ts) and is
 * reached at its part's heading of that name, or else at its part. Worked
 * out once per file, for rows.ts and the links.
 */
function pageRows(file: string): { kind: string; label: string; id: string; url: string; own: boolean }[] {
  return cached(file, 'rows', () => {
    const found: { kind: string; label: string; id: string; part: string; heading: boolean }[] = [];
    for (const part of renderedBodies(file)) {
      const taken = new Set(headings(part.body).map(({ slug }) => slug));
      for (const [kind, labels] of tableRows(part.body)) {
        for (const [label, id] of labels) found.push({ kind, label, id, part: part.url, heading: taken.has(id) });
      }
    }
    // rows.ts does not know which part it renders, so an id a heading takes on one part is left off the rows of every part.
    const taken = new Set(found.filter((row) => row.heading).map((row) => row.id));
    return found.map(({ kind, label, id, part, heading }) => {
      const own = !taken.has(id);
      return { kind, label, id, own, url: own || heading ? `${part}#${id}` : part };
    });
  });
}

/**
 * The row anchors a page may carry: those its source gives, less those a
 * heading already has. rows.ts gives a rendered row an id only when it is
 * here, so a link worked out from the source never points at an id the
 * page lacks.
 */
export function rowAnchors(file: string): Set<string> {
  return new Set(pageRows(file).filter((row) => row.own).map((row) => row.id));
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

/** A page's Principles section, numbered or not. */
const PRINCIPLES = /^(?:\d+[a-z]?\.?\s+)?principles\b/i;

/**
 * A page's sections in order, each with its text as written and its
 * address. On a split page each part is its own page: its title is a
 * section at the part's address, and its headings are anchored as that
 * part renders them, so a heading repeated in two parts is found in the
 * first with the anchor it has there.
 */
function pageSections(file: string): { text: string; url: string }[] {
  return cached(file, 'sections', () =>
    renderedBodies(file).flatMap((part) => [
      ...(part.title ? [{ text: part.title, url: part.url }] : []),
      ...headings(part.body).map(({ text, slug }) => ({ text, url: `${part.url}#${slug}` })),
    ]),
  );
}

/**
 * A section of a page by its number ("6", "6.4", "1a"): the heading whose
 * text starts with it. With `principle`, the page's Principles section.
 */
export function sectionUrl(sibling: Sibling, ref: { number?: string; principle?: boolean }): string | undefined {
  const pattern = ref.principle
    ? PRINCIPLES
    : ref.number !== undefined
      ? new RegExp(`^${ref.number.replace(/\./g, '\\.')}(?:[.:)](?![0-9a-z])|\\s|$)`, 'i')
      : undefined;
  if (!pattern) return;
  return pageSections(sibling.file).find(({ text }) => pattern.test(text))?.url;
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
      // Ids are matched in any case: prose may write "q3" for Q3.
      const id = String(question?.id ?? '').toUpperCase();
      if (!id) continue;
      const anchor = questionUrl(url, id);
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
 * The plan pages of a page's folder, in the order they answer: first the
 * plan the task links use (`planFor`: the page itself, or the folder's
 * page declaring tasks or PRs), then PLAN.md, then a planning page of type
 * plan. Only pages the site builds.
 */
export function folderPlans(file: string): string[] {
  const plans = [planFor(file)?.file, siblingPages(file).get('PLAN')?.file, markdownFiles(dirname(file)).find((f) => page(f).data.kind === 'planning' && page(f).data.type === 'plan')];
  return [...new Set(plans.filter((f): f is string => f !== undefined))];
}

/**
 * The numbered rows of the folder's plan, by kind and label, each to its
 * anchor. Each kind comes from the first plan page that has rows of it, so
 * a page declaring tasks does not hide PLAN.md's stage table.
 */
export function folderRows(file: string): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  for (const plan of folderPlans(file)) {
    for (const [kind, rows] of planRows(plan)) if (!out.has(kind)) out.set(kind, rows);
  }
  return out;
}

/** The numbered rows of one plan page, by kind and label, each to its anchor. */
export function planRows(plan: string): Map<string, Map<string, string>> {
  const found = new Map<string, Map<string, string>>();
  for (const { kind, label, url } of pageRows(plan)) {
    if (!found.has(kind)) found.set(kind, new Map());
    if (!found.get(kind)!.has(label)) found.get(kind)!.set(label, url);
  }
  return found;
}
