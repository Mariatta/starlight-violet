/**
 * The content loader behind Starlight's `docs` collection. It reads every
 * Markdown page of the notes folder in place, Violet's guide pages and the
 * site's own pages; gives each a title (front matter, else the first heading,
 * else the file name); checks pages against their kind; and renders the body
 * with the site's Markdown pipeline so shortcodes and links apply. Pages the
 * site generates (the `extraPages` option) join them.
 */
import type { Loader } from 'astro/loaders';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ZodError } from 'astro/zod';
import { getKind, isKind, progressBar, sectionProblem, statusBadge } from '../kinds';
import { PLANNING_TYPES } from '../kinds/planning';
import { getOptions, KIND_NAMES, PACKAGE } from '../options';
import { addHeadingLinks } from './headings';
import { idFor, isSkipped, LANDING, listMarkdown, notesInSiteRepo, notesPages, notesRel, pageUrl, readPage, sectionDescription, sections, sitePath, slugify, sourceUrl, splitTitle, words } from './notes';
import { isSplit, pageParts, readPlan, sectionHeadings, type Plan } from './plans';
import { notFrontMatter, renderPlain } from '../markdown/plain';

/** Violet's guide pages are filed under this folder. */
export const GUIDE = 'guide';

function describe(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => `${issue.path.join('.') || 'front matter'}: ${issue.message}`).join('; ');
  }
  return (error as Error).message;
}

/** Whether a guide page belongs on this site: a kind's contract only when the kind is on. */
function guideWanted(rel: string, kinds: string[]): boolean {
  const kind = /^kinds\/([^/]+)\.md$/.exec(rel)?.[1];
  return !kind || kinds.includes(kind);
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The header of one PR's page of a split plan: its status, branch and tasks, and the way back to the plan. */
function prHeader(plan: Plan | undefined, number: number, planTitle: string): string {
  const pr = plan?.prs.find((item) => item.number === number);
  if (!pr || !plan) return '';
  const tasks = plan.tasks.filter((task) => pr.tasks.includes(task.number));
  const rows = [
    ['Status', statusBadge('work', pr.status)],
    pr.branch && ['Branch', `<code>${escape(pr.branch)}</code>`],
    pr.ships && ['Ships', escape(pr.ships)],
    tasks.length > 0 && ['Tasks', tasks.map((task) => `<a href="${task.url}">Task ${task.number}</a>`).join(', ')],
    tasks.length > 0 && ['Progress', progressBar(tasks.filter((task) => task.status === 'done').length, tasks.length, 'tasks done')],
    ['Plan', `<a href="${plan.url}">${escape(planTitle)}</a>`],
  ].filter(Boolean) as string[][];
  return `<table class="kind-meta"><tbody>${rows.map(([th, td]) => `<tr><th>${th}</th><td>${td}</td></tr>`).join('')}</tbody></table>\n\n`;
}

/** What the previous and next links need to know of a page. */
interface Placed {
  index: number;
  id: string;
  title: string;
  kind?: string;
  folder: string;
  order: number;
  /** The page a part was split from. */
  partOf?: string;
  /** Whether the page's own front matter sets `prev` or `next`. */
  own: { prev: boolean; next: boolean };
}

/**
 * The reading orders that get previous and next links: a planning folder
 * (context, brainstorm, spec, plan, then the plan's parts), the decisions by
 * number, and the parts of any other split page.
 */
function chains(placed: Placed[]): Placed[][] {
  const out: Placed[][] = [];
  const folders = new Map<string, Placed[]>();
  const pages = new Map<string, Placed[]>();
  const byId = new Map(placed.map((p) => [p.id, p]));
  for (const page of placed) {
    const kind = page.partOf ? byId.get(page.partOf)?.kind : page.kind;
    if (kind === 'planning') folders.set(page.folder, [...(folders.get(page.folder) ?? []), page]);
    else if (page.partOf || placed.some((p) => p.partOf === page.id)) {
      const key = page.partOf ?? page.id;
      pages.set(key, [...(pages.get(key) ?? []), page]);
    }
  }
  for (const folder of folders.values()) out.push(folder.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)));
  out.push(...pages.values());
  out.push(placed.filter((p) => p.kind === 'decision' && !p.partOf).sort((a, b) => a.id.localeCompare(b.id)));
  return out.filter((chain) => chain.length > 1);
}

interface Source {
  dir: string;
  role: 'notes' | 'guide' | 'site';
}

export function notesLoader(): Loader {
  return {
    name: `${PACKAGE}:notes`,
    load: async ({ store, parseData, generateDigest, renderMarkdown, logger, watcher, config }) => {
      const options = getOptions();
      const root = fileURLToPath(config.root);
      if (options.sourceLink && !notesInSiteRepo()) {
        logger.warn('The notes are not in the same git checkout as the site, so their pages get no source link; sourceLink covers the site\'s own pages only.');
      }
      const sources: Source[] = [
        { dir: options.notesDir, role: 'notes' },
        { dir: options.guideDir, role: 'guide' },
        { dir: options.siteDocsDir, role: 'site' },
      ];

      const render = async (body: string, fileURL: URL) => {
        const rendered = await renderMarkdown(body, { fileURL });
        return { ...rendered, html: addHeadingLinks(rendered.html) };
      };

      /** Every page, parsed, checked and rendered; throws on a bad one. */
      const collect = async () => {
        const entries: any[] = [];
        const placed: Placed[] = [];
        const taken = new Map<string, string>();
        for (const { dir, role } of sources) {
          for (const file of listMarkdown(dir)) {
            const rel = role === 'notes' ? sitePath(file, dir) : relative(dir, file);
            if (role === 'notes' && isSkipped(notesRel(file))) continue;
            if (role === 'guide' && !guideWanted(rel, options.kinds)) continue;
            const page = readPage(file);
            const shown = relative(root, file);
            if (page.yamlError) {
              logger.warn(`Skipping ${shown}: front matter is not YAML (${page.yamlError.message})`);
              continue;
            }
            const sitePathOf = role === 'guide' ? `${GUIDE}/${rel}` : rel;
            const id = role === 'guide' ? slugify(`${GUIDE}/${rel.replace(/\.md$/, '')}`) : idFor(file, dir);
            if (taken.has(id) && id === 'index') throw new Error(`${shown} and ${taken.get(id)} are both a landing page; keep one`);
            if (taken.has(id)) throw new Error(`${shown} and ${taken.get(id)} both want the address /${id}/; rename one`);
            taken.set(id, shown);

            const { title, body } = splitTitle(page.body);
            // `badge.prompt.md` is labelled by `badge`.
            const stem = rel.split('/').at(-1)!.replace(/\.md$/, '').split('.')[0];
            const data: Record<string, unknown> = { ...page.data, title: page.data.title ?? title ?? words(stem), source: shown };
            // The page's link to its Markdown file on GitHub. Violet's own guide
            // pages come from the package, not the repo, so they get none.
            // With sourceLink on, a page Violet can build no address for gets no
            // link, rather than Starlight's editLink.baseUrl plus a path it made up.
            const source = role === 'guide' ? undefined : sourceUrl(file);
            if (page.data.editUrl === undefined && (role === 'guide' || source || options.sourceLink)) data.editUrl = source ?? false;
            if (role === 'notes' && options.shortLabels.some((prefix) => rel.startsWith(prefix)) && !/README\.md$/i.test(rel)) {
              data.sidebar = { label: words(stem) };
            }

            // The landing page is the site's front door, not a page of any kind.
            if (role === 'notes' && notesRel(file) !== LANDING) {
              const relInNotes = notesRel(file);
              const rule = options.require.find(([pattern]) => pattern.test(relInNotes));
              if (rule && data.kind === undefined) {
                throw new Error(`${shown} must declare \`kind: ${rule[1]}\` in its front matter`);
              }
              if (rule && data.kind !== rule[1]) {
                throw new Error(`${shown} declares kind "${String(data.kind)}", but files there are of kind "${rule[1]}"`);
              }
            }
            if (data.kind !== undefined) {
              if (!isKind(data.kind)) {
                const known = (KIND_NAMES as readonly string[]).includes(String(data.kind));
                throw new Error(
                  known
                    ? `${shown}: kind "${String(data.kind)}" is not turned on for this site; add it to Violet's \`kinds\` option`
                    : `${shown}: unknown kind "${String(data.kind)}"; this site's kinds: ${[...options.kinds, ...Object.keys(options.customKinds)].join(', ') || 'none'}`,
                );
              }
              const kind = getKind(data.kind)!;
              try {
                kind.schema.parse(data);
              } catch (error) {
                throw new Error(`${shown} is not a valid ${data.kind} page: ${describe(error)}`);
              }
              const sectionsFound = sectionHeadings(body);
              const problem = sectionProblem(kind, sectionsFound);
              if (problem) throw new Error(`${shown} is a ${data.kind} and ${problem}`);
              const planProblems = role === 'notes' ? (readPlan(file)?.problems ?? []) : [];
              if (planProblems.length > 0) throw new Error(`${shown}: ${planProblems.join('; ')}`);
            }

            if (role === 'notes' && data.kind === 'planning' && typeof data.type === 'string') {
              // Planning pages read in the order the work happens, not by file name.
              const rank = (PLANNING_TYPES as readonly string[]).indexOf(data.type) + 1;
              data.sidebar = { order: rank * 100, ...(data.sidebar as object | undefined) };
            }
            const order = (data.sidebar as { order?: number } | undefined)?.order;
            const parts = role === 'notes' && isSplit(page.data) ? pageParts(id, page.data, body) : undefined;

            const fileURL = pathToFileURL(file);
            const parsed = await parseData({ id, data, filePath: shown });
            const kind = getKind(parsed.kind);
            if (kind?.render) {
              const inline = async (text: string, options?: { html?: boolean }) => {
                const toHtml = async (source: string) => (await renderMarkdown(source, { fileURL })).html.replace(/^<p>|<\/p>\s*$/g, '');
                const source = notFrontMatter(text);
                return options?.html === false ? renderPlain(source, toHtml) : toHtml(source);
              };
              await kind.render(parsed, inline);
            }
            const own = { prev: page.data.prev !== undefined, next: page.data.next !== undefined };
            const folder = dirname(sitePathOf);
            placed.push({ index: entries.length, id, title: String(parsed.title), kind: typeof parsed.kind === 'string' ? parsed.kind : undefined, folder, order: order ?? 0, own });
            const shownBody = parts ? parts[0].body : body;
            entries.push({
              id,
              data: parsed,
              body: shownBody,
              // Starlight groups the sidebar by the path under src/content/docs,
              // so a page from elsewhere claims the path it would have there.
              filePath: role === 'site' ? shown : `src/content/docs/${sitePathOf}`,
              digest: generateDigest(page.body + JSON.stringify(page.data)),
              rendered: await render(shownBody, fileURL),
            });

            const plan = parts ? readPlan(file) : undefined;
            for (const [index, part] of (parts ?? []).entries()) {
              if (index === 0) continue;
              if (taken.has(part.id)) throw new Error(`${shown}: its section "${part.title}" wants the address /${part.id}/, which ${taken.get(part.id)} has`);
              taken.set(part.id, `${shown} (${part.title})`);
              const partBody = (part.pr !== undefined ? prHeader(plan, part.pr, String(parsed.title)) : '') + part.body;
              const partData = {
                title: part.title,
                source: shown,
                // A part's source is the page it was split from.
                ...(data.editUrl !== undefined && { editUrl: data.editUrl }),
                ...(order !== undefined && { sidebar: { order: order + index } }),
              };
              placed.push({ index: entries.length, id: part.id, title: part.title!, folder, order: (order ?? 0) + index, partOf: id, own: { prev: false, next: false } });
              entries.push({
                id: part.id,
                data: await parseData({ id: part.id, data: partData, filePath: shown }),
                body: partBody,
                // Beside the page in the sidebar, in section order.
                filePath: `src/content/docs/${sitePathOf.replace(/\.md$/, '')}-${String(index).padStart(2, '0')}.md`,
                digest: generateDigest(partBody + JSON.stringify(partData)),
                rendered: await render(partBody, fileURL),
              });
            }
          }
        }

        for (const page of options.extraPages?.pages() ?? []) {
          const file = join(options.notesDir, page.rel);
          const id = idFor(file, options.notesDir).replace(/\/index$/, '');
          if (taken.has(id) && id === 'index') throw new Error(`${taken.get(id)} and the generated ${page.rel} are both a landing page; keep one`);
          if (taken.has(id)) {
            throw new Error(`${taken.get(id)} takes the address /${id}/, which the generated ${page.rel} needs; rename one of them`);
          }
          taken.set(id, `generated ${page.rel}`);
          const data = { title: page.title, source: `generated from ${page.rel.replace(/\.md$/, '')}`, editUrl: false, ...(page.sidebar && { sidebar: page.sidebar }) };
          entries.push({
            id,
            data: await parseData({ id, data, filePath: relative(root, file) }),
            body: page.body,
            filePath: `src/content/docs/${sitePath(file, options.notesDir)}`,
            digest: generateDigest(page.body + JSON.stringify(data)),
            rendered: await render(page.body, pathToFileURL(file)),
          });
        }
        // Every top-level folder gets a page of its own, for the landing page's
        // cards to lead to: its README when it has one, else this one, which
        // lists its pages. The decisions have theirs at /decisions/.
        // The kinds declared in each top-level folder, read once.
        const kindsBySection = new Map<string, unknown[]>();
        for (const file of notesPages()) {
          const rel = notesRel(file);
          const section = rel.includes('/') ? rel.split('/')[0] : options.looseFiles;
          const kind = readPage(file).data.kind;
          if (section && kind !== undefined) kindsBySection.set(section, [...(kindsBySection.get(section) ?? []), kind]);
        }
        for (const section of sections()) {
          const id = slugify(section);
          if (taken.has(id) || (section === 'decisions' && options.kinds.includes('decision'))) continue;
          taken.set(id, `the ${section} section page`);
          // A folder of planning pages, whatever it is called, gets its planning tables.
          const kindsHere = new Set(kindsBySection.get(section) ?? []);
          const planningOnly = kindsHere.size === 1 && kindsHere.has('planning');
          const body = planningOnly
            ? `::topics{in=${section}}\n\n## Recently updated\n\n::planning{in=${section}}\n`
            : `::folder{name=${section}}\n`;
          const description = sectionDescription(section);
          const data = { title: words(section), ...(description && { description }), editUrl: false, sidebar: { label: 'Overview', order: 0 } };
          entries.push({
            id,
            data: await parseData({ id, data, filePath: `src/content/docs/${section}/index.md` }),
            body,
            filePath: `src/content/docs/${section}/index.md`,
            digest: generateDigest(body + JSON.stringify(data)),
            rendered: await render(body, pathToFileURL(join(options.notesDir, section, 'index.md'))),
          });
        }

        for (const chain of chains(placed)) {
          chain.forEach((page, i) => {
            const data = entries[page.index].data;
            const [before, after] = [chain[i - 1], chain[i + 1]];
            if (before && !page.own.prev) data.prev = { link: pageUrl(before.id), label: before.title };
            if (after && !page.own.next) data.next = { link: pageUrl(after.id), label: after.title };
          });
        }
        return entries;
      };

      /** Replace the store only once every page parsed, so a bad edit in dev keeps the last good pages. */
      const sync = async () => {
        const entries = await collect();
        store.clear();
        for (const entry of entries) store.set(entry);
        logger.info(`${entries.length} pages`);
      };

      await sync();
      if (watcher) {
        for (const { dir } of sources) watcher.add(dir);
        const onChange = (changed: string) => {
          const feeds = changed.endsWith('.md') || (options.extraPages?.feeds?.(changed) ?? false);
          if (!feeds || !sources.some(({ dir }) => changed.startsWith(dir))) return;
          sync().catch((error: Error) => {
            logger.error(`Kept the last good pages; fix and save again: ${error.message}`);
          });
        };
        watcher.on('change', onChange);
        watcher.on('add', onChange);
        watcher.on('unlink', onChange);
      }
    },
  };
}
