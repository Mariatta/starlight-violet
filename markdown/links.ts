/**
 * Links inside notes pages, as a Sätteri mdast plugin.
 *
 * - A relative link or image to another Markdown file in the notes becomes
 *   that page's address; to any other notes file, the served copy when the
 *   site serves files.
 * - `:task[3]` and `:pr[2]` link to that task or PR of the plan the page
 *   belongs to (the page itself, else the plan in its folder);
 *   `:task[3]{topic=other-folder}` reaches the plan in another folder of
 *   planning pages, by its name or its path. An unknown number fails the build, naming the page.
 * - In a plan's folder, prose such as "Task 3", "Tasks 6, 7" and "Tasks 1 to
 *   5" links each number the plan declares.
 * - With the decision kind on, "decision 0011" (also "decisions 0005, 0022
 *   and 0019") links to that decision.
 * - In a folder with a handoff, "Q3" (also "Q3 to Q9") links to that
 *   question's row on the handoff.
 * - A capitalised page of the same folder, by name: "SPEC" or "PLAN.md", with
 *   a section when one follows ("PLAN.md §6 and §6.4", "SPEC 3.2", "SPEC
 *   section 7", "SPEC principle 2", which is the Principles section).
 * - "task 1.2", "Stage 1" or "stages 6 and 7" anywhere in a plan's folder
 *   link to that row of the plan's numbered tables (a `#` column numbers
 *   tasks, a `Stage` column stages; rows.ts gives the rows their anchors).
 *
 * - An attribute list right after a link, `[HTML](mockup.html){ target=_blank }`,
 *   sets the link's attributes (`.class`, `#id`, `key=value`), as in
 *   Python-Markdown, kramdown and Pandoc.
 *
 * Text inside links, headings and code is left alone.
 */
import type { MdastPluginEntry } from 'satteri';
import type { Link, PhrasingContent, Text } from 'mdast';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOptions } from '../options';
import { idFor, isServedFile, notesDir, pageUrl, staticUrl } from '../lib/notes';
import { anchorUrl, planFor, type Plan } from '../lib/plans';
import { readDecisions } from '../lib/records';
import { folderQuestions, folderRows, sectionUrl, siblingPages, type Sibling } from '../lib/references';

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i;
const NUMBER = String.raw`\d+(?:\.\d+)*`;
const LIST = String.raw`${NUMBER}(?:(?:,\s*|\s+and\s+|,\s*and\s+|\s+to\s+)${NUMBER})*`;
/** "this stage 2 people" counts; "stage 2" after one of these words is not a reference. */
const NOT_AFTER = String.raw`(?<!\b(?:this|that|these|those|each|every|any|which|what)\s)`;
const TASKS = new RegExp(String.raw`${NOT_AFTER}\b(Tasks?)(\s+)(${LIST})\b`, 'gi');
const STAGES = new RegExp(String.raw`${NOT_AFTER}\b(Stages?)(\s+)(${LIST})\b`, 'gi');
/** "Q3", but not a quarter: "Q1 2027", "2027 Q1". */
const QUESTIONS = /(?<!\b(?:19|20)\d\d\s?)\bQ\d+\b(?!\s?(?:19|20)\d\d\b)/g;
/** A section number: "6", "6.4", "1a". */
const SECTION = String.raw`\d+[a-z]?(?:\.\d+)*`;
/** What may follow a page's name: "§6", "section 7", "principle 2", "3.2". */
const PAGE_SECTION = new RegExp(String.raw`^\s+(?:§\s?(${SECTION})|sections?\s+(${SECTION})|(principles?)\s+\d+\b|(\d+[a-z]|\d+(?:\.\d+)+)\b)`, 'i');
/** A further section of the same page: ", §6.4", " and §2". */
const MORE_SECTIONS = new RegExp(String.raw`^(,\s*|\s+and\s+|\s+or\s+)(§\s?(${SECTION}))`);
const DECISIONS = /\b(decisions?)(\s+)(\d{4}(?:(?:,\s*|\s+and\s+|,\s*and\s+)\d{4})*)/gi;

/** An attribute list, as in Python-Markdown, kramdown and Pandoc: `{ target=_blank .class #id }`. */
const ATTRS = /^\{:?\s*((?:[.#][\w-]+|[\w-]+=(?:"[^"]*"|'[^']*'|[^\s}]+))(?:\s+(?:[.#][\w-]+|[\w-]+=(?:"[^"]*"|'[^']*'|[^\s}]+)))*)\s*\}/;

function attributes(list: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [, item] of list.matchAll(/([.#][\w-]+|[\w-]+=(?:"[^"]*"|'[^']*'|[^\s}]+))/g)) {
    if (item.startsWith('.')) out.className = [...((out.className as string[]) ?? []), item.slice(1)];
    else if (item.startsWith('#')) out.id = item.slice(1);
    else {
      const [key, ...rest] = item.split('=');
      out[key] = rest.join('=').replace(/^["']|["']$/g, '');
    }
  }
  // A new tab should not be able to reach back into this one.
  if (out.target === '_blank' && !out.rel) out.rel = 'noopener';
  return out;
}

function rewrite(url: string, dir: string, file?: string): string | undefined {
  // On a split page, a heading may now be on another of its parts.
  if (url.startsWith('#') && file) return anchorUrl(file, url.slice(1));
  if (EXTERNAL.test(url)) return;
  const [path, hash = ''] = url.split('#');
  const target = resolve(dir, decodeURIComponent(path));
  if (!target.startsWith(notesDir())) return;
  if (target.endsWith('.md')) return (hash && anchorUrl(target, hash)) || pageUrl(idFor(target, notesDir())) + (hash ? `#${hash}` : '');
  if (isServedFile(target)) return staticUrl(target);
}

function text(value: string): Text {
  return { type: 'text', value };
}

function link(value: string, url: string): Link {
  return { type: 'link', url, children: [text(value)] };
}

interface Match {
  start: number;
  end: number;
  nodes: PhrasingContent[];
}

/** "word N, M and K" to text and links, linking each number `urls` knows; undefined when none does. */
function numbered(match: RegExpMatchArray, urls: Map<string, string>): Match | undefined {
  const nodes: PhrasingContent[] = [text(match[1] + match[2])];
  let linked = false;
  for (const part of match[3].split(new RegExp(`(${NUMBER})`)).filter(Boolean)) {
    const url = new RegExp(`^${NUMBER}$`).test(part) ? urls.get(part) : undefined;
    if (url) {
      nodes.push(link(part, url));
      linked = true;
    } else nodes.push(text(part));
  }
  return linked ? { start: match.index!, end: match.index! + match[0].length, nodes } : undefined;
}

/** "SPEC", "PLAN.md §6 and §6.4", "SPEC principle 2": the page, and each section it names. */
function pageRefs(value: string, pages: Map<string, Sibling>): Match[] {
  if (pages.size === 0) return [];
  const names = [...pages.keys()].sort((a, b) => b.length - a.length).map((n) => n.replace(/[-]/g, '\\$&'));
  const matches: Match[] = [];
  // Not part of a path ("finance/PLAN.md", though "./PLAN.md" is this folder) or a longer name ("SPEC-v2", "PLAN.mdx").
  const pattern = String.raw`(?:(?<![\w/.-])\.\/|(?<![\w/.-]))(${names.join('|')})(\.md)?(?![\w-]|\.\w)`;
  for (const m of value.matchAll(new RegExp(pattern, 'g'))) {
    const page = pages.get(m[1])!;
    let end = m.index! + m[0].length;
    const section = PAGE_SECTION.exec(value.slice(end));
    let url = page.url;
    if (section) {
      const number = section[1] ?? section[2] ?? section[4];
      const found = sectionUrl(page, { number, principle: Boolean(section[3]) });
      // A bare "3.2" counts only when the page has that section: "PLAN 2.5 days" is not one.
      if (found || !section[4]) {
        url = found ?? page.url;
        end += section[0].length;
      }
    }
    // A short name ("UI", "API") is a common word; it links as "UI.md" or with a section.
    if (m[1].length < 4 && !m[2] && end === m.index! + m[0].length) continue;
    const nodes: PhrasingContent[] = [link(value.slice(m.index!, end), url)];
    for (let more = MORE_SECTIONS.exec(value.slice(end)); more; more = MORE_SECTIONS.exec(value.slice(end))) {
      const target = sectionUrl(page, { number: more[3] });
      nodes.push(text(more[1]), target ? link(more[2], target) : text(more[2]));
      end += more[0].length;
    }
    matches.push({ start: m.index!, end, nodes });
  }
  return matches;
}

/** Each "Q3" the folder's handoff asks. */
function questionRefs(value: string, questions: Map<string, string>): Match[] {
  if (questions.size === 0) return [];
  return [...value.matchAll(QUESTIONS)]
    .filter((m) => questions.has(m[0]))
    .map((m) => ({ start: m.index!, end: m.index! + m[0].length, nodes: [link(m[0], questions.get(m[0])!)] }));
}

interface Targets {
  tasks: Map<string, string>;
  decisions: Map<string, string>;
  stages: Map<string, string>;
  questions: Map<string, string>;
  pages: Map<string, Sibling>;
}

function hasTargets(t: Targets): boolean {
  return t.tasks.size + t.decisions.size + t.stages.size + t.questions.size + t.pages.size > 0;
}

/** Split a text value into text and links; undefined when nothing links. */
function autolink(value: string, { tasks, decisions, stages, questions, pages }: Targets): PhrasingContent[] | undefined {
  const matches: Match[] = [];
  if (tasks.size > 0) for (const m of value.matchAll(TASKS)) matches.push(...[numbered(m, tasks)].filter((x) => x !== undefined));
  if (stages.size > 0) for (const m of value.matchAll(STAGES)) matches.push(...[numbered(m, stages)].filter((x) => x !== undefined));
  if (decisions.size > 0) for (const m of value.matchAll(DECISIONS)) matches.push(...[numbered(m, decisions)].filter((x) => x !== undefined));
  matches.push(...questionRefs(value, questions), ...pageRefs(value, pages));
  if (matches.length === 0) return;
  matches.sort((a, b) => a.start - b.start);
  const out: PhrasingContent[] = [];
  let cursor = 0;
  for (const { start, end, nodes } of matches) {
    if (start < cursor) continue;
    if (start > cursor) out.push(text(value.slice(cursor, start)));
    out.push(...nodes);
    cursor = end;
  }
  if (cursor < value.length) out.push(text(value.slice(cursor)));
  return out;
}

export function notesLinksPlugin(): MdastPluginEntry {
  return ({ fileURL }) => {
    const file = fileURL ? fileURLToPath(fileURL) : undefined;
    const dir = file && file.startsWith(notesDir()) ? dirname(file) : undefined;
    const plans = new Map<string, Plan | undefined>();
    const plan = (topic?: string | null) => {
      const key = topic ?? '';
      if (!plans.has(key)) plans.set(key, planFor(file, topic));
      return plans.get(key);
    };
    const rows = dir ? folderRows(file!) : new Map<string, Map<string, string>>();
    const tasks = new Map([...(rows.get('task') ?? []), ...(plan()?.tasks ?? []).map((t) => [String(t.number), t.url] as [string, string])]);
    const decisions = getOptions().kinds.includes('decision')
      ? new Map(readDecisions().map((d) => [d.number, d.url]))
      : new Map<string, string>();
    const targets: Targets = {
      tasks,
      decisions,
      stages: rows.get('stage') ?? new Map(),
      questions: dir ? folderQuestions(file!) : new Map(),
      pages: dir ? siblingPages(file!) : new Map(),
    };
    return {
      name: 'notes-links',
      link(node, ctx) {
        if (!dir) return;
        const url = rewrite(node.url, dir, file);
        if (url) ctx.setProperty(node, 'url', url);
      },
      image(node, ctx) {
        if (!dir) return;
        const url = rewrite(node.url, dir);
        if (url) ctx.setProperty(node, 'url', url);
      },
      textDirective(node, ctx) {
        if (node.name !== 'task' && node.name !== 'pr') return;
        const label = ctx.textContent(node).trim();
        const number = Number(label);
        const target = plan(node.attributes?.topic);
        const items: { number: number; url: string }[] = node.name === 'task' ? (target?.tasks ?? []) : (target?.prs ?? []);
        const found = items.find((item) => item.number === number);
        if (!found) {
          throw new Error(
            `${file ?? 'a site page'}: :${node.name}[${label}] matches no ${node.name === 'task' ? 'task' : 'PR'} in ${target ? target.file : 'any plan (add topic=<folder>)'}`,
          );
        }
        ctx.replaceNode(node, link(`${node.name === 'task' ? 'Task' : 'PR'} ${label}`, found.url));
      },
      text(node, ctx) {
        const parent = ctx.parent(node);
        let value = node.value;
        // `[HTML](mockup.html){ target=_blank }`: an attribute list right after a link.
        const index = ctx.indexOf(node);
        const before = parent && index ? parent.children[index - 1] : undefined;
        const attrs = before?.type === 'link' ? ATTRS.exec(value) : null;
        if (before && attrs) {
          ctx.setProperty(before, 'data', { ...before.data, hProperties: { ...(before.data as any)?.hProperties, ...attributes(attrs[1]) } });
          value = value.slice(attrs[0].length);
          if (!value) return ctx.removeNode(node);
          ctx.setProperty(node, 'value', value);
        }
        if (!hasTargets(targets)) return;
        for (let up = parent; up; up = ctx.parent(up as never)) {
          if (up.type === 'link' || up.type === 'linkReference' || up.type === 'heading') return;
        }
        const nodes = autolink(value, targets);
        if (nodes) ctx.replaceNode(node, nodes);
      },
    };
  };
}
