/**
 * The Starlight plugin. In the site's astro.config:
 *
 *   starlight({ title: '...', plugins: [violet({ notes: '../docs', kinds: ['planning'] })] })
 *
 * and in src/content.config.ts, the loader and schema from `starlight-violet/content`.
 */
import type { StarlightPlugin, StarlightUserConfig } from '@astrojs/starlight/types';
import { isSatteriProcessor } from '@astrojs/markdown-satteri';
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listMarkdown, sections, sidebarItems, words } from './lib/notes';
import { notesLinksPlugin } from './markdown/links';
import { stepsPlugin } from './markdown/steps';
import { shortcodesPlugin } from './markdown/shortcodes';
import {
  globToRegExp,
  KIND_NAMES,
  PACKAGE,
  setOptions,
  type VioletOptions,
  type ResolvedOptions,
} from './options';

export type { ExtraPage, KindName, VioletOptions } from './options';

/** Starlight components Violet replaces; a site that overrides one too must render Violet's from its own. */
const OVERRIDES = { MarkdownContent: `${PACKAGE}/components/MarkdownContent.astro` } as const;

/** The custom kinds' header components, as a module Violet's MarkdownContent imports. */
const HEADERS_MODULE = 'virtual:starlight-violet/kind-headers';

function headersPlugin(resolved: ResolvedOptions) {
  const resolvedId = `\0${HEADERS_MODULE}`;
  const entries = Object.entries(resolved.customHeaders);
  const code = [
    ...entries.map(([, path], i) => `import H${i} from ${JSON.stringify(path)};`),
    `export default { ${entries.map(([name], i) => `${JSON.stringify(name)}: H${i}`).join(', ')} };`,
  ].join('\n');
  return {
    name: `${PACKAGE}:kind-headers`,
    resolveId: (id: string) => (id === HEADERS_MODULE ? resolvedId : undefined),
    load: (id: string) => (id === resolvedId ? code : undefined),
  };
}

/**
 * In the dev server, a site with `trailingSlash: 'always'` answers 404 to a
 * served notes file, such as `/files/images/diagram.svg`, because the files
 * route's pattern has no extension. Add the slash before Astro sees the
 * request. A build writes real files, so it needs nothing.
 */
function servedFilesPlugin(resolved: ResolvedOptions) {
  const files = resolved.files;
  return {
    name: `${PACKAGE}:served-files`,
    configureServer(server: { middlewares: { stack: { route: string; handle: Function }[] } }) {
      if (!files) return;
      // Vite may already have taken the site's base off the address.
      const prefixes = [files.prefix, `${resolved.base.replace(/\/$/, '')}${files.prefix}`];
      const handle = (req: { url?: string }, _res: unknown, next: () => void) => {
        const [path, query] = (req.url ?? '').split('?');
        if (prefixes.some((prefix) => path.startsWith(prefix)) && /\.[^/]+$/.test(path)) req.url = `${path}/${query ? `?${query}` : ''}`;
        next();
      };
      // First, ahead of Astro's own handler.
      server.middlewares.stack.unshift({ route: '', handle });
    },
  };
}

function withSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

function resolveOptions(options: VioletOptions, rootDir: string, base: string): ResolvedOptions {
  const kinds = options.kinds ?? [];
  for (const kind of kinds) {
    if (!(KIND_NAMES as readonly string[]).includes(kind)) {
      throw new Error(`${PACKAGE}: unknown kind "${kind}" in the kinds option; Violet has ${KIND_NAMES.join(', ')}`);
    }
  }
  const customKinds = options.customKinds ?? {};
  const customHeaders: Record<string, string> = {};
  for (const [name, kind] of Object.entries(customKinds)) {
    if ((KIND_NAMES as readonly string[]).includes(name)) {
      throw new Error(`${PACKAGE}: customKinds.${name} has the name of a built-in kind; turn Violet's on with the kinds option, or pick another name`);
    }
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`${PACKAGE}: custom kind name "${name}" must be lower case letters, digits and dashes`);
    if (!kind?.schema?.parse) throw new Error(`${PACKAGE}: customKinds.${name} needs a schema`);
    if (kind.header) {
      const path = resolve(rootDir, kind.header);
      if (!existsSync(path)) throw new Error(`${PACKAGE}: customKinds.${name}.header ${kind.header} does not exist`);
      customHeaders[name] = path;
    }
  }
  const known = [...kinds, ...Object.keys(customKinds)];
  const require = Object.entries(options.require ?? {}).map(([glob, kind]) => {
    if (!known.includes(kind)) throw new Error(`${PACKAGE}: require names kind "${kind}", which is neither in kinds nor in customKinds`);
    return [globToRegExp(glob), kind] as [RegExp, string];
  });
  const notesDir = withSlash(resolve(rootDir, options.notes));
  if (!existsSync(notesDir)) throw new Error(`${PACKAGE}: the notes folder ${notesDir} does not exist (the notes option is ${options.notes})`);
  return {
    notesDir,
    siteDocsDir: withSlash(resolve(rootDir, 'src/content/docs')),
    guideDir: fileURLToPath(new URL('./pages/', import.meta.url)),
    base: withSlash(base || '/'),
    kinds,
    customKinds,
    customHeaders,
    require,
    looseFiles: options.looseFiles,
    skip: (options.skip ?? []).map(globToRegExp),
    shortLabels: options.shortLabels ?? [],
    acronyms: options.acronyms ?? [],
    sidebar: options.sidebar ?? 'folders',
    github: options.github,
    owner: options.owner,
    sectionDescriptions: options.sectionDescriptions ?? {},
    files: options.files ? { prefix: withSlash(options.files.prefix), private: options.files.private ?? [], types: options.files.types ?? {} } : false,
    wide: options.wide ?? true,
    mdastPlugins: options.mdastPlugins ?? [],
    extraPages: options.extraPages,
  };
}

/** The sidebar built from the notes' folders, then the site's own pages and Violet's guide. */
function folderSidebar(resolved: ResolvedOptions): NonNullable<StarlightUserConfig['sidebar']> {
  const sitePages = listMarkdown(resolved.siteDocsDir)
    .map((file) => relative(resolved.siteDocsDir, file).replace(/\.md$/, ''))
    // A site's own contract pages under guide/kinds/ join Violet's in "Page kinds".
    .filter((slug) => slug !== 'index' && !slug.startsWith('guide/'));
  return [
    { label: 'Home', link: '/' },
    ...sections().map((dir) => ({ label: words(dir), items: sidebarItems(dir) })),
    {
      label: 'This site',
      collapsed: true,
      items: [
        { slug: 'guide/writing' },
        ...sitePages.map((slug) => ({ slug })),
        { label: 'Page kinds', items: [{ autogenerate: { directory: 'guide/kinds' } }] },
        { slug: 'guide/shortcodes' },
        { slug: 'guide/extending' },
      ],
    },
  ];
}

export default function violet(options: VioletOptions): StarlightPlugin {
  return {
    name: PACKAGE,
    hooks: {
      'config:setup'({ config, astroConfig, updateConfig, addIntegration, addRouteMiddleware, logger }) {
        const resolved = resolveOptions(options, fileURLToPath(astroConfig.root), astroConfig.base);
        setOptions(resolved);

        const components = { ...config.components };
        for (const [name, entrypoint] of Object.entries(OVERRIDES)) {
          const existing = components[name as keyof typeof components];
          if (existing && existing !== entrypoint) {
            logger.warn(
              `This site overrides <${name}>, which ${PACKAGE} replaces too. Render ${entrypoint} from your override so kind headers still show.`,
            );
            continue;
          }
          (components as Record<string, string>)[name] = entrypoint;
        }

        const configured = config.expressiveCode;
        type Shiki = { langAlias?: Record<string, string>; [key: string]: unknown };
        const expressiveCode: false | { shiki?: Shiki; [key: string]: unknown } =
          configured === false ? false : typeof configured === 'object' ? { ...(configured as object) } : {};
        if (expressiveCode) {
          const shiki: Shiki = { ...(expressiveCode.shiki ?? {}) };
          // Django templates highlight as Jinja, the closest grammar Shiki ships.
          shiki.langAlias = { django: 'jinja', ...(shiki.langAlias ?? {}) };
          expressiveCode.shiki = shiki;
        }

        updateConfig({
          components,
          customCss: [
            ...(config.customCss ?? []),
            `${PACKAGE}/styles/notes.css`,
            ...(resolved.wide ? [`${PACKAGE}/styles/wide.css`] : []),
          ],
          ...(resolved.sidebar === 'folders' && { sidebar: folderSidebar(resolved) }),
          ...(expressiveCode !== false && { expressiveCode }),
        });

        addRouteMiddleware({ entrypoint: `${PACKAGE}/middleware` });

        addIntegration({
          name: `${PACKAGE}:integration`,
          hooks: {
            'astro:config:setup'({ config: astroSetupConfig, injectRoute, updateConfig: updateAstroConfig }) {
              updateAstroConfig({ vite: { plugins: [headersPlugin(resolved), servedFilesPlugin(resolved)] } });
              // The Sätteri processor is meant to be extended in place, which keeps any
              // plugins the site gave it. Directives (`::prs`, `:task[3]`) are a feature
              // it parses only when asked.
              const processor = astroSetupConfig.markdown.processor;
              if (!isSatteriProcessor(processor)) {
                throw new Error(`${PACKAGE} needs Astro's Sätteri Markdown processor; this site uses "${processor.name}".`);
              }
              processor.options.mdastPlugins.push(stepsPlugin(), shortcodesPlugin(), notesLinksPlugin(), ...resolved.mdastPlugins);
              processor.options.features.directive = true;
              if (resolved.kinds.includes('decision')) {
                injectRoute({ pattern: '/decisions', entrypoint: `${PACKAGE}/routes/decisions.astro`, prerender: true });
              }
              if (resolved.files) {
                injectRoute({ pattern: `${resolved.files.prefix}[...path]`, entrypoint: `${PACKAGE}/routes/files.ts`, prerender: true });
              }
            },
          },
        });
      },
    },
  };
}
