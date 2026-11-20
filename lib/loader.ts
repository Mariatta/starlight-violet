/**
 * The content loader behind Starlight's `docs` collection. It reads every
 * Markdown page of the notes folder in place, Violet's guide pages and the
 * site's own pages; gives each a title (front matter, else the first heading,
 * else the file name); checks pages against their kind; and renders the body
 * with the site's Markdown pipeline so shortcodes and links apply. Pages the
 * site generates (the `extraPages` option) join them.
 */
import type { Loader } from 'astro/loaders';
import { basename, dirname, extname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ZodError } from 'astro/zod';
import { getKind, isKind, progressBar, sectionProblem, statusBadge } from '../kinds';
import { PLANNING_TYPES } from '../kinds/planning';
import { getOptions, KIND_NAMES, PACKAGE } from '../options';
import { addHeadingLinks } from './headings';
import { idFor, isSkipped, isUnread, LANDING, listMarkdown, listUnread, notesInSiteRepo, notesPages, notesRel, pageUrl, readPage, sectionDescription, sections, sitePath, slugify, sourceUrl, splitTitle, words } from './notes';
import { isSplit, pageParts, readPlan, sectionHeadings, type Plan } from './plans';
import { notFrontMatter, renderPlain } from '../markdown/plain';
import { FIELD_HASH } from '../markdown/rows';

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

/** A page in a format Violet does not read, with the address it is for when it is an index or README page. */
interface Unread {
  shown: string;
  extension: string;
  id?: string;
}

/** What every warning about a page Violet does not read starts with; on its own when the build stopped before the rest was known. */
function skipping(shown: string): string {
  return `Skipping ${shown}: Violet reads Markdown pages ending in .md only.`;
}

/**
 * The warning for a page Violet does not read, saying what to do with it:
 * `taken` maps each address to the page that has it, and `sectionPages` are
 * those a folder's README.md would replace.
 */
function unreadWarning({ shown, extension, id }: Unread, taken: Map<string, string>, sectionPages: Set<string>): string {
  const without = extension === '.mdx' ? ', without MDX imports or components' : extension === '.mdoc' ? ', without Markdoc tags' : '';
  if (!id) return `${skipping(shown)} Rename it to .md${without}, or remove it.`;
  const at = taken.get(id);
  // A page the site has there already, other than a section page a README.md would replace.
  if (at && !sectionPages.has(id)) return `${skipping(shown)} ${pageUrl(id)} shows ${at} instead; remove it.`;
  if (id === 'index') return `${skipping(shown)} The site has no home page: rename it to index.md${without}, or put an index.md at the top of the notes.`;
  // A folder's own page is its README.md: an index.md in a folder is a page of its own, at /folder/index/.
  return `${skipping(shown)} ${pageUrl(id)} ${at ? `shows ${at}` : 'has no page'}; make it the folder's page by renaming it to README.md${without}, or remove it.`;
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
        // A body that starts with a horizontal rule (right under the page's front matter or
        // its title) would be read by renderMarkdown as front matter, dropping everything up
        // to the next rule. An empty comment first keeps it a rule.
        const rendered = await renderMarkdown(/^\s*(?:---|\+\+\+)/.test(body) ? `<!-- -->\n${body}` : body, { fileURL });
        return { ...rendered, html: addHeadingLinks(rendered.html) };
      };

      // Starlight reads `.mdoc` pages only when the site has Markdoc, and so warns about them only then.
      const markdoc = config.integrations.some(({ name }) => name === '@astrojs/markdoc');

      /**
       * Pages in a format Violet does not read, each with the address an
       * index or README page among them is for: Starlight's template ships its
       * home page as an `index.mdx`.
       */
      const findUnread = (): Unread[] => {
        const unread: Unread[] = [];
        for (const { dir, role } of sources) {
          if (role === 'guide') continue;
          for (const file of listUnread(dir, markdoc)) {
            if (role === 'notes' && isSkipped(notesRel(file))) continue;
            // Starlight reads no page whose name starts with `_` either: it is a partial.
            if (role === 'site' && basename(file).startsWith('_')) continue;
            const rel = relative(dir, file);
            const extension = extname(rel);
            const folder = dirname(rel);
            const stem = basename(rel, extension);
            // A README's address is the one it would get as README.md.
            const id = stem === 'index' ? (folder === '.' ? 'index' : slugify(folder)) : stem === 'README' ? idFor(join(dir, folder, 'README.md'), dir) : undefined;
            unread.push({ shown: relative(root, file), extension: extension.toLowerCase(), id });
          }
        }
        return unread;
      };

      /** Every page, parsed, checked and rendered, with the address each took; throws on a bad page. */
      const collect = async () => {
        const entries: any[] = [];
        const placed: Placed[] = [];
        const taken = new Map<string, string>();
        /** The section pages Violet made, which a folder's README.md would replace. */
        const sectionPages = new Set<string>();
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
              // A field is not the body: its numbered rows must not repeat the body's row ids.
              const fieldURL = new URL(FIELD_HASH, fileURL);
              const inline = async (text: string, options?: { html?: boolean }) => {
                const html = options?.html === false ? await renderPlain(text, fieldURL) : (await renderMarkdown(notFrontMatter(text), { fileURL: fieldURL })).html;
                return html.replace(/^<p>|<\/p>\s*$/g, '');
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
        // The decision kind's list is a route of its own at /decisions/, with or without a decisions folder.
        const decisionsList = options.kinds.includes('decision') && !taken.has('decisions');
        if (decisionsList) taken.set('decisions', 'the decisions list');
        for (const section of sections()) {
          const id = slugify(section);
          if (taken.has(id) || (section === 'decisions' && decisionsList)) continue;
          taken.set(id, `the ${section} section page`);
          sectionPages.add(id);
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
        return { entries, taken, sectionPages };
      };

      /** The warning last given for each page Violet does not read, so that in dev a change elsewhere does not repeat it. */
      let warned = new Map<string, string>();
      /** Replace the store only once every page parsed, so a bad edit in dev keeps the last good pages. */
      const sync = async () => {
        const unread = findUnread();
        let collected: Awaited<ReturnType<typeof collect>>;
        try {
          collected = await collect();
        } catch (error) {
          // The build stops here, before the addresses are known: name the pages it skipped anyway.
          for (const page of unread) {
            if (warned.has(page.shown)) continue;
            logger.warn(skipping(page.shown));
            warned.set(page.shown, skipping(page.shown));
          }
          throw error;
        }
        const { entries, taken, sectionPages } = collected;
        const warnings = new Map(unread.map((page) => [page.shown, unreadWarning(page, taken, sectionPages)]));
        for (const [shown, warning] of warnings) if (warned.get(shown) !== warning) logger.warn(warning);
        warned = warnings;
        store.clear();
        for (const entry of entries) store.set(entry);
        logger.info(`${entries.length} pages`);
      };

      await sync();
      if (watcher) {
        for (const { dir } of sources) watcher.add(dir);
        const onChange = (event: 'change' | 'add' | 'unlink') => (changed: string) => {
          // Adding or removing a page Violet does not read changes the warnings; saving one changes nothing it shows.
          const page = changed.endsWith('.md') || (event !== 'change' && isUnread(basename(changed), markdoc));
          const feeds = page || (options.extraPages?.feeds?.(changed) ?? false);
          if (!feeds || !sources.some(({ dir }) => changed.startsWith(dir))) return;
          sync().catch((error: Error) => {
            logger.error(`Kept the last good pages; fix and save again: ${error.message}`);
          });
        };
        watcher.on('change', onChange('change'));
        watcher.on('add', onChange('add'));
        watcher.on('unlink', onChange('unlink'));
      }
    },
  };
}
