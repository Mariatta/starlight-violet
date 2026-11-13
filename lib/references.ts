/**
 * What prose in a work folder refers to by name: the handoff's questions
 * ("Q3"), the folder's other capitalised pages ("SPEC", "PLAN.md §6",
 * "SPEC principle 2") and the rows of a plan's task and stage tables
 * ("task 1.2", "Stage 1"). Each lookup returns the address to link to, or
 * nothing when the folder has no such thing, so unmatched prose stays text.
 */
import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { idFor, isSkipped, LANDING, notesDir, notesRel, pageUrl, readPage, splitTitle, type Page } from './notes';
import { anchorUrl, headings, isSplit, pageParts, planFor } from './plans';
import { cached, nodesOf, parse, textOf } from './source';

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
          .filter((f) => f.startsWith(notesDir()) && !isSkipped(notesRel(f)) && notesRel(f) !== LANDING)
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
    const [header, ...body] = table.children ?? [];
    const kind = rowKind(textOf(header?.children?.[0] ?? { type: 'text' }));
    if (!kind) continue;
    for (const row of body) {
      const label = textOf(row.children?.[0] ?? { type: 'text' }).trim();
      if (!isRowLabel(label)) continue;
      if (!rows.has(kind)) rows.set(kind, new Map());
      if (!rows.get(kind)!.has(label)) rows.get(kind)!.set(label, rowId(kind, label));
    }
  }
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
 * A page's numbered table rows as it renders: for each row its kind, label
 * and the address of its anchor. A row whose anchor a heading of the page
 * already has gets no id of its own (see rows.ts) and is reached at that
 * heading instead. Worked out once per file, for rows.ts and the links.
 */
function pageRows(file: string): { kind: string; label: string; id: string; url: string; own: boolean }[] {
  return cached(file, 'rows', () => {
    const taken = renderedAnchors(file);
    const rows: { kind: string; label: string; id: string; url: string; own: boolean }[] = [];
    for (const part of renderedBodies(file)) {
      for (const [kind, labels] of tableRows(part.body)) {
        for (const [label, id] of labels) {
          const own = !taken.has(id);
          rows.push({ kind, label, id, own, url: own ? `${part.url}#${id}` : (anchorUrl(file, id) ?? `${part.url}#${id}`) });
        }
      }
    }
    return rows;
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
      // Ids are matched in any case: prose may write "q3" for Q3.
      const id = String(question?.id ?? '').toUpperCase();
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
 * The plan pages of a page's folder, in the order they answer: first the
 * plan the task links use (`planFor`: the page itself, or the folder's
 * page declaring tasks or PRs), then PLAN.md, then a planning page of type
 * plan. Only pages the site builds.
 */
export function folderPlans(file: string): string[] {
  const plans = [planFor(file)?.file, siblingPages(file).get('PLAN')?.file, markdownFiles(dirname(file)).find((f) => page(f).data.type === 'plan')];
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
    const found = new Map<string, Map<string, string>>();
    for (const { kind, label, url } of pageRows(plan)) {
      if (out.has(kind)) continue;
      if (!found.has(kind)) found.set(kind, new Map());
      if (!found.get(kind)!.has(label)) found.get(kind)!.set(label, url);
    }
    for (const [kind, rows] of found) out.set(kind, rows);
  }
  return out;
}

/**
 * The heading anchors a page renders, which a table row's anchor must not
 * repeat: on a split page, those of its parts, whose own `# ` lines are
 * page titles rather than headings.
 */
export function renderedAnchors(file: string): Set<string> {
  return cached(file, 'anchors', () => new Set(renderedBodies(file).flatMap(({ body }) => headings(body).map(({ slug }) => slug))));
}
