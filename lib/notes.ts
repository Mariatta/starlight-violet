/**
 * The notes folder as data: how a file becomes a page id and an address, and
 * the readers the loader, the sidebar, the shortcodes and the links share.
 * Everything here runs at build time on the Node side.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { getOptions } from '../options';

const SKIP_DIRS = new Set(['.git', 'node_modules', '_build', 'site', 'dist']);
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const H1 = /^\s*# (.+)\r?\n/;

export interface Page {
  file: string;
  data: Record<string, unknown>;
  body: string;
  yamlError?: Error;
}

export function notesDir(): string {
  return getOptions().notesDir;
}

/** A file's path relative to the notes folder. */
export function notesRel(file: string): string {
  return relative(notesDir(), file);
}

/** The notes file that is the site's landing page: an `index.md` at the top of the notes. */
export const LANDING = 'index.md';

/** Whether the site leaves this notes file out. */
export function isSkipped(rel: string): boolean {
  return getOptions().skip.some((pattern) => pattern.test(rel));
}

/** Every Markdown file under `dir`, skipping dotfiles and build folders. */
export function listMarkdown(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listMarkdown(path));
    else if (entry.name.endsWith('.md')) files.push(path);
  }
  return files.sort();
}

/** Every Markdown page of the notes folder the site keeps. */
export function notesPages(): string[] {
  return listMarkdown(notesDir()).filter((file) => !isSkipped(notesRel(file)) && notesRel(file) !== LANDING);
}

/** Every file under `dir`, skipping dotfiles, build folders and, at the top, private folders. */
export function listFiles(dir: string, top = dir, privateDirs: string[] = []): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
    if (dir === top && privateDirs.includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path, top, privateDirs));
    else files.push(path);
  }
  return files.sort();
}

/** Front matter and body of a Markdown file; a YAML error is reported, not thrown. */
export function readPage(file: string): Page {
  const text = readFileSync(file, 'utf8');
  const match = FRONT_MATTER.exec(text);
  if (!match) return { file, data: {}, body: text };
  try {
    return { file, data: parseYaml(match[1]) ?? {}, body: text.slice(match[0].length) };
  } catch (error) {
    return { file, data: {}, body: text, yamlError: error as Error };
  }
}

/** The first level-one heading, and the body without it. */
export function splitTitle(body: string): { title?: string; body: string } {
  const match = H1.exec(body);
  if (!match) return { body };
  return { title: match[1].trim(), body: body.slice(match[0].length) };
}

/** '0019-agpl-and-more' to '0019 AGPL and more' (with `agpl` an acronym); a run of numbers stays joined. */
export function words(stem: string, acronyms: string[] = getOptions().acronyms): string {
  const parts: string[] = [];
  for (const part of stem.replace(/_/g, '-').split('-').filter(Boolean)) {
    const last = parts.at(-1);
    if (last && /^[\d-]+$/.test(last) && /^\d/.test(part)) parts[parts.length - 1] = `${last}-${part}`;
    else parts.push(part);
  }
  const upper = new Set(acronyms.map((a) => a.toLowerCase()));
  const cased = parts.map((p) => (upper.has(p.toLowerCase()) ? p.toUpperCase() : p));
  const first = parts.findIndex((p) => /^[a-z]/i.test(p));
  if (first >= 0 && !upper.has(parts[first].toLowerCase())) {
    cased[first] = cased[first][0].toUpperCase() + cased[first].slice(1);
  }
  return cased.join(' ') || stem;
}

/** URL-safe id segments: lower case, runs of anything else become a dash. */
export function slugify(path: string): string {
  return path
    .split('/')
    .map((segment) => segment.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .join('/');
}

/**
 * A file's path as the site files it: top-level notes files move under
 * `looseFiles` when set, except the landing page.
 */
export function sitePath(file: string, root: string): string {
  const rel = relative(root, file);
  const { looseFiles, notesDir: notes } = getOptions();
  return looseFiles && root === notes && !rel.includes('/') && rel !== LANDING ? `${looseFiles}/${rel}` : rel;
}

/** The page id of a Markdown file: its site path without `.md` and without a trailing README. */
export function idFor(file: string, root: string): string {
  const rel = sitePath(file, root).replace(/\.md$/, '').replace(/(^|\/)README$/, '');
  return slugify(rel) || 'index';
}

/** A page's address, including the site's base. */
export function pageUrl(id: string): string {
  const { base } = getOptions();
  return id === 'index' || id === '' ? base : `${base}${id}/`;
}

/** The address of a notes file that the site serves as a file, when it serves files. */
export function staticUrl(file: string): string | undefined {
  const { files, base } = getOptions();
  if (!files) return;
  const prefix = `${base.replace(/\/$/, '')}${files.prefix}`;
  return prefix + notesRel(file).split('/').map(encodeURIComponent).join('/');
}

/** Whether a file is one the files route serves. */
export function isServedFile(file: string): boolean {
  const { files } = getOptions();
  const notes = notesDir();
  if (!files || !file.startsWith(notes) || !existsSync(file) || !statSync(file).isFile()) return false;
  const parts = notesRel(file).split('/');
  return !files.private.includes(parts[0]) && !parts.some((part) => part.startsWith('.') || SKIP_DIRS.has(part));
}

/** `#12` or `other-repo#34` to the issue's address on GitHub; undefined without a `github` option. */
export function issueUrl(issue: string): string {
  const { github } = getOptions();
  const [repo, number] = issue.split('#');
  if (!github) return `#${number}`;
  return `https://github.com/${github.org}/${repo || github.repo}/issues/${number}`;
}

/** The issue references of raw front matter, whether listed as `#12` or as `{ ref: '#12', ... }`. */
export function issueRefs(data: Record<string, unknown>): string[] {
  return ((data.issues as unknown[] | undefined) ?? []).map((item) =>
    typeof item === 'string' ? item : String((item as { ref?: string }).ref ?? ''),
  );
}

export interface PageInfo {
  file: string;
  id: string;
  url: string;
  title: string;
  /** The page's folder in the notes, such as `planning/export-screen`. */
  folder: string;
  /** The name of the folder holding the page, such as `export-screen`; empty for a page at the top of the notes. */
  topic: string;
  /** The page's top-level folder, as the sidebar and section pages group it; `looseFiles` for a page at the top. */
  section: string;
  topicLabel: string;
  data: Record<string, unknown>;
}

/** Every notes page of one kind, unvalidated; the loader validates. */
export function readKind(kind: string): PageInfo[] {
  const pages: PageInfo[] = [];
  for (const file of notesPages()) {
    const { data, body } = readPage(file);
    if (data.kind !== kind) continue;
    const rel = notesRel(file).split('/');
    const dirs = rel.slice(0, -1);
    const topic = dirs.at(-1) ?? '';
    const id = idFor(file, notesDir());
    pages.push({
      file,
      id,
      url: pageUrl(id),
      title: String(data.title ?? splitTitle(body).title ?? rel.at(-1)),
      folder: dirs.join('/'),
      topic,
      section: dirs[0] ?? getOptions().looseFiles ?? '',
      topicLabel: topic ? words(topic) : '',
      data,
    });
  }
  return pages;
}

/** What a section is for, when neither the site nor the folder's README says. */
const SECTION_DEFAULTS: Record<string, string> = {
  planning: 'Context, brainstorms, specs and plans, a folder per piece of work',
  reference: 'How the built system works: design notes, runbooks and guides',
  decisions: 'Numbered architecture decisions, and where each stands',
  handoffs: 'What one session leaves so the next can start',
};

/** A top-level folder's one-line description: the site's, else its README's `description`, else Violet's default. */
export function sectionDescription(section: string): string | undefined {
  const own = getOptions().sectionDescriptions[section];
  if (own) return own;
  const readme = join(notesDir(), section, 'README.md');
  if (existsSync(readme)) {
    const description = readPage(readme).data.description;
    if (typeof description === 'string') return description;
  }
  return SECTION_DEFAULTS[section];
}

/** Whether a top-level folder has a README, which is then its section page. */
export function hasReadme(section: string): boolean {
  return existsSync(join(notesDir(), section, 'README.md'));
}

/** The top-level folders of the notes that hold pages, in sidebar order, with loose files last. */
export function sections(): string[] {
  const { looseFiles } = getOptions();
  const found = new Set<string>();
  for (const file of notesPages()) {
    const rel = notesRel(file);
    if (rel.includes('/')) found.add(rel.split('/')[0]);
    else if (looseFiles) found.add(looseFiles);
  }
  return [...found].sort((a, b) => (a === looseFiles ? 1 : b === looseFiles ? -1 : a.localeCompare(b)));
}

type Autogenerate = { autogenerate: { directory: string } };
export type SidebarItem = Autogenerate | { label: string; items: Autogenerate[] } | { slug: string; label?: string };

/**
 * The sidebar entries of one top-level group. A subfolder becomes a group
 * labelled by its name's words (Starlight's autogenerate would show the raw
 * folder name); files directly in the folder are listed by slug.
 */
export function sidebarItems(section: string): SidebarItem[] {
  const prefix = `${section}/`;
  const ids = notesPages().map((file) => idFor(file, notesDir())).filter((id) => id.startsWith(prefix));
  const rests = ids.map((id) => id.slice(prefix.length));
  const folders = [...new Set(rests.filter((rest) => rest.includes('/')).map((rest) => rest.split('/')[0]))];
  if (folders.length === 0) return [{ autogenerate: { directory: section } }];
  // The section's own page (its README, or the one Violet makes) leads the group.
  const sectionPage: SidebarItem[] = section === 'decisions' && getOptions().kinds.includes('decision') ? [] : [hasReadme(section) ? { slug: section } : { slug: section, label: 'Overview' }];
  return [
    ...sectionPage,
    ...folders.sort().map((folder) => ({ label: words(folder), items: [{ autogenerate: { directory: `${section}/${folder}` } }] })),
    ...ids.filter((id) => !id.slice(prefix.length).includes('/')).map((slug) => ({ slug })),
  ];
}

/** The root of the git checkout holding `dir`, or undefined outside one. A worktree's `.git` is a file. */
function gitRoot(dir: string): string | undefined {
  let current = dir;
  while (true) {
    if (existsSync(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

const roots = new Map<string, string | undefined>();

function rootOf(dir: string): string | undefined {
  if (!roots.has(dir)) roots.set(dir, gitRoot(dir));
  return roots.get(dir);
}

/** The git checkout holding the site, which the `github` option names. */
function siteRoot(): string | undefined {
  return rootOf(getOptions().siteDocsDir);
}

/** Whether source links can reach the notes: they are in the site's own git checkout. */
export function notesInSiteRepo(): boolean {
  const root = rootOf(notesDir());
  return root !== undefined && root === siteRoot();
}

/**
 * The address of a file on GitHub, for a page's source link: the file view or
 * the editor, as the `sourceLink` option says. Undefined when source links are
 * off or the file is not in a git checkout.
 */
export function sourceUrl(file: string): string | undefined {
  const { sourceLink, github } = getOptions();
  if (!sourceLink || !github) return;
  const root = rootOf(dirname(file));
  // `github` names the site's repository; a file in another checkout (notes
  // kept in a sibling repo or a submodule) is not in it, so no link.
  if (!root || root !== siteRoot()) return;
  const path = relative(root, file).split(sep).map(encodeURIComponent).join('/');
  return `https://github.com/${github.org}/${github.repo}/${sourceLink === 'edit' ? 'edit' : 'blob'}/${github.branch.split('/').map(encodeURIComponent).join('/')}/${path}`;
}
