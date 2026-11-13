/**
 * A plan page's tasks and pull requests: declared in its front matter
 * (`tasks`, `prs`), each matched to its heading in the body (`### Task 3: ...`,
 * `# PR 2: ...`) so a reference can link straight to it. Shared by the
 * loader's checks, the shortcodes, the inline directives and the auto-links.
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Slugger from 'github-slugger';
import { idFor, notesDir, pageUrl, readKind, readPage, splitTitle } from './notes';
import { cached, fencedLines } from './source';

export interface PlanTask {
  number: number;
  title: string;
  status: string;
  issue?: string;
  /** The PR that ships it, from the plan's `prs`. */
  pr?: number;
  url: string;
}

export interface PlanPr {
  number: number;
  title: string;
  status: string;
  branch?: string;
  ships?: string;
  issue?: string;
  pull?: string;
  tasks: number[];
  url: string;
}

export interface Plan {
  file: string;
  url: string;
  tasks: PlanTask[];
  prs: PlanPr[];
  /** Headings that look like tasks or PRs but are not in the front matter, and the reverse. */
  problems: string[];
}

/**
 * One page of a page's rendering. A page with `split: true` in its front
 * matter renders as several: what comes before its first level-one heading
 * (the overview, at the page's own address), then one page per level-one
 * section, at `<page>/<part>/`. A plan's `# PR 2: ...` section is `pr-2`.
 * Any other page is one part.
 */
export interface Part {
  id: string;
  url: string;
  body: string;
  /** The section's heading; undefined for the overview. */
  title?: string;
  /** The PR whose section this is. */
  pr?: number;
  /** The anchors of its headings. */
  anchors: Heading[];
}

/** Whether a page's front matter asks for it to be split. */
export function isSplit(data: Record<string, unknown>): boolean {
  return data.split === true;
}

/** The parts of a page; `body` is without its title heading. */
export function pageParts(id: string, data: Record<string, unknown>, body: string): Part[] {
  const url = pageUrl(id);
  if (!isSplit(data)) return [{ id, url, body, anchors: headings(body) }];
  const lines = body.split('\n');
  const code = fencedLines(lines);
  const starts: { line: number; text: string }[] = [];
  lines.forEach((line, index) => {
    const match = !code[index] && /^#\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) starts.push({ line: index, text: match[1] });
  });
  const slugger = new Slugger();
  const overview = lines.slice(0, starts[0]?.line ?? lines.length).join('\n');
  const parts: Part[] = [{ id, url, body: overview, anchors: headings(overview) }];
  starts.forEach(({ line, text }, index) => {
    const partBody = lines.slice(line + 1, starts[index + 1]?.line ?? lines.length).join('\n');
    const pr = PR_HEADING.exec(text);
    const slug = pr ? `pr-${pr[1]}` : slugger.slug(plain(text));
    const partId = `${id}/${slug}`;
    parts.push({ id: partId, url: pageUrl(partId), body: partBody, title: plain(text), pr: pr ? Number(pr[1]) : undefined, anchors: headings(partBody) });
  });
  return parts;
}

/** Where an anchor of a page lives: in a split page, the part with that heading. */
export function anchorUrl(file: string, hash: string): string | undefined {
  if (!existsSync(file)) return;
  const anchors = cached(file, 'part-anchors', () => {
    const { data, body } = readPage(file);
    const found = new Map<string, string>();
    if (isSplit(data)) {
      for (const part of pageParts(idFor(file, notesDir()), data, splitTitle(body).body)) {
        for (const { slug } of part.anchors) if (!found.has(slug)) found.set(slug, `${part.url}#${slug}`);
      }
    }
    return found;
  });
  return anchors.get(hash);
}

const TASK_HEADING = /^task\s+(\d+)\b[:.\s-]*(.*)$/i;
const PR_HEADING = /^pr\s+(\d+)\b[:.\s-]*(.*)$/i;

interface Heading {
  depth: number;
  text: string;
  slug: string;
}

/** The body's headings with the anchors the renderer gives them; fenced code is skipped. */
export function headings(body: string): Heading[] {
  const slugger = new Slugger();
  const found: Heading[] = [];
  const lines = body.split('\n');
  const code = fencedLines(lines);
  for (const [index, line] of lines.entries()) {
    if (code[index]) continue;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) found.push({ depth: match[1].length, text: match[2], slug: slugger.slug(match[2]) });
  }
  return found;
}

function plain(text: string): string {
  return text.replace(/`/g, '').trim();
}

type Raw = Record<string, unknown>;

/** The plan in one file: front matter entries joined to their headings. Undefined when it declares none. */
export function readPlan(file: string): Plan | undefined {
  // A generated page has an address in the notes but no file there.
  if (!existsSync(file)) return;
  const { data, body } = readPage(file);
  const rawTasks = (data.tasks as Raw[] | undefined) ?? [];
  const rawPrs = (data.prs as Raw[] | undefined) ?? [];
  if (rawTasks.length === 0 && rawPrs.length === 0) return;
  const id = idFor(file, notesDir());
  const url = pageUrl(id);
  const problems: string[] = [];
  // Where each task and PR is: an anchor on the page, or on its part of a split page.
  const taskHeadings = new Map<number, Heading>();
  const prHeadings = new Map<number, Heading>();
  const taskUrls = new Map<number, string>();
  const prUrls = new Map<number, string>();
  for (const part of pageParts(id, data, splitTitle(body).body)) {
    if (part.pr !== undefined && part.title) {
      prHeadings.set(part.pr, { depth: 1, text: part.title, slug: '' });
      prUrls.set(part.pr, part.url);
    }
    for (const heading of part.anchors) {
      const task = TASK_HEADING.exec(heading.text);
      if (task) {
        taskHeadings.set(Number(task[1]), heading);
        taskUrls.set(Number(task[1]), `${part.url}#${heading.slug}`);
      }
      const pr = PR_HEADING.exec(heading.text);
      if (pr) {
        prHeadings.set(Number(pr[1]), heading);
        prUrls.set(Number(pr[1]), `${part.url}#${heading.slug}`);
      }
    }
  }
  const prOf = new Map<number, number>();
  for (const pr of rawPrs) for (const n of (pr.tasks as number[] | undefined) ?? []) prOf.set(n, Number(pr.number));

  const tasks = rawTasks.map((raw) => {
    const number = Number(raw.number);
    const heading = taskHeadings.get(number);
    if (!heading) problems.push(`task ${number} has no "Task ${number}" heading`);
    return {
      number,
      title: String(raw.title ?? (heading ? plain(TASK_HEADING.exec(heading.text)![2]) : '')),
      status: String(raw.status ?? 'todo'),
      issue: raw.issue as string | undefined,
      pr: prOf.get(number),
      url: taskUrls.get(number) ?? url,
    };
  });
  const declared = new Set(tasks.map((t) => t.number));
  for (const number of taskHeadings.keys()) {
    if (!declared.has(number)) problems.push(`the heading for task ${number} is not in the front matter's tasks`);
  }

  const prs = rawPrs.map((raw) => {
    const number = Number(raw.number);
    const heading = prHeadings.get(number);
    if (rawPrs.length > 0 && !heading) problems.push(`PR ${number} has no "PR ${number}" heading`);
    const listed = ((raw.tasks as number[] | undefined) ?? []).map(Number);
    for (const n of listed) if (!declared.has(n)) problems.push(`PR ${number} lists task ${n}, which is not in tasks`);
    return {
      number,
      title: String(raw.title ?? (heading ? plain(PR_HEADING.exec(heading.text)![2]) : '')),
      status: String(raw.status ?? 'todo'),
      branch: raw.branch as string | undefined,
      ships: raw.ships as string | undefined,
      issue: raw.issue as string | undefined,
      pull: raw.pull as string | undefined,
      tasks: listed,
      url: prUrls.get(number) ?? url,
    };
  });
  return { file, url, tasks, prs, problems };
}

/**
 * The folders of planning pages that `topic` names: a folder's name, such as
 * `export-screen`, or its path in the notes, such as `work/export-screen`.
 * Planning pages can live in any folder; nothing assumes one called planning/.
 */
export function planningFolders(topic: string): string[] {
  const folders = readKind('planning')
    .filter((page) => page.folder === topic || page.topic === topic)
    .map((page) => page.folder);
  return [...new Set(folders)].sort();
}

/**
 * The plan a page refers to: the page itself when it declares tasks or PRs,
 * else the page in its folder that does. With a topic, the plan in the
 * planning folder of that name; a name two folders share must be given as a
 * path.
 */
export function planFor(file: string | undefined, topic?: string | null): Plan | undefined {
  if (topic) {
    const folder = planningFolder(topic, file);
    if (folder !== undefined) return planInFolder(join(notesDir(), folder));
    // A plan whose pages declare no kind: the folder at that path, or under planning/ as before.
    for (const path of [topic, join('planning', topic)]) {
      const plan = planInFolder(join(notesDir(), path));
      if (plan) return plan;
    }
    return;
  }
  if (!file || !file.startsWith(notesDir())) return;
  return readPlan(file) ?? planInFolder(dirname(file));
}

/**
 * The one planning folder `topic` names, or undefined when none does; a name
 * two folders share fails the build, naming the page that used it.
 */
export function planningFolder(topic: string, file: string | undefined): string | undefined {
  const folders = planningFolders(topic);
  if (folders.length > 1) {
    throw new Error(`${file ?? 'a site page'}: topic=${topic} names more than one planning folder (${folders.join(', ')}); give its path, such as topic=${folders[0]}`);
  }
  return folders[0];
}

function planInFolder(folder: string): Plan | undefined {
  if (!existsSync(folder)) return;
  for (const entry of readdirSync(folder).sort()) {
    if (!entry.endsWith('.md')) continue;
    const plan = readPlan(join(folder, entry));
    if (plan) return plan;
  }
}
