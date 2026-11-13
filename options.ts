/**
 * Violet's options, as the site passes them and as Violet resolves
 * them. The plugin resolves them once, in Starlight's config:setup hook, and
 * keeps them where the loader, the Markdown plugins and the components (which
 * run later, in the same build process) can read them.
 */
import type { MdastPluginEntry } from 'satteri';

/** The package's name; the one place it is spelled, apart from package.json. */
export const PACKAGE = 'starlight-violet';

export const KIND_NAMES = ['planning', 'reference', 'handoff', 'decision'] as const;
export type KindName = (typeof KIND_NAMES)[number];

export type BadgeVariant = 'default' | 'note' | 'tip' | 'caution' | 'danger' | 'success';

/** A kind a site defines for itself; see Violet's "Extending" guide page. */
export interface CustomKind {
  /** Shown in error messages and the `::pages` table. */
  label: string;
  /** A zod object schema with `kind: z.literal('<name>')`; spread `commonFields` from `starlight-violet/kinds` for the shared ones. */
  schema: { parse(data: unknown): unknown };
  /** Starlight badge variant per status value. */
  variants?: Record<string, BadgeVariant>;
  /** `exact`: the body's level-two headings are these, in order. `required`: these must be among them. */
  sections?: { exact: readonly string[] } | { required: readonly string[] };
  /** The front matter field holding the page's date, for sorting and showing in `::pages`. Default `updated`. */
  dateField?: string;
  /** A component for the page's header, relative to the site's root; default: Violet's header for status, dates, issues and related. */
  header?: string;
  /** Render inline-Markdown fields of validated data to HTML, in place. */
  render?: (data: any, inline: Inline) => Promise<void>;
}

/** Render inline Markdown to HTML; with `{ html: false }`, raw HTML in it shows as text and block syntax stays literal. */
export type Inline = (text: string, options?: { html?: boolean }) => Promise<string>;

/** A page the site makes from something other than a Markdown file, such as a design specimen. */
export interface ExtraPage {
  /** Where the page would sit in the notes folder, such as `design/map.md`; links resolve from there. */
  rel: string;
  title: string;
  body: string;
  sidebar?: Record<string, unknown>;
}

export interface VioletOptions {
  /** The notes folder, relative to the site's root (where astro.config is), such as `../docs`. */
  notes: string;
  /** Violet's kinds this site uses. Pages may only declare these, and the site's own `customKinds`. */
  kinds?: KindName[];
  /** Kinds this site defines for itself, by name. */
  customKinds?: Record<string, CustomKind>;
  /**
   * Files that must declare a kind, as globs relative to the notes folder:
   * `*` matches within one folder, `**` across folders.
   * Example: `{ 'planning/*\/*.md': 'planning', '*.md': 'reference' }`.
   */
  require?: Record<string, string>;
  /** Files at the top of the notes folder are filed under this folder in the site, such as `reference`. */
  looseFiles?: string;
  /** Files to leave out, as globs relative to the notes folder, such as `README.md`. */
  skip?: string[];
  /** Folders whose pages are labelled by their file names in the sidebar instead of their headings. */
  shortLabels?: string[];
  /** Words shown in capitals in labels made from file names, such as `agpl`. */
  acronyms?: string[];
  /** `folders` builds the sidebar from the notes' top-level folders; `false` leaves it to the site. */
  sidebar?: 'folders' | false;
  /** Whose notes these are: the default owner of a handoff's open questions, named in the guide pages' place of "the owner". */
  owner?: string;
  /** A one-line description per top-level folder, for its card on the landing page (`::sections`) and its section page. */
  sectionDescriptions?: Record<string, string>;
  /**
   * The repository on GitHub: where `#12` and `other-repo#34` in front matter
   * point, and where `sourceLink` goes. `branch` is the branch source links
   * name; default `main`.
   */
  github?: { org: string; repo: string; branch?: string };
  /**
   * A link at the foot of each page to its Markdown file on GitHub, through
   * Starlight's edit link: `'view'` opens the file ("View source"), `'edit'`
   * opens GitHub's editor ("Edit page"). Needs `github`. Default: no link.
   */
  sourceLink?: 'view' | 'edit' | false;
  /**
   * Serve the notes' non-Markdown files (images, mockups) under this path, such as `/notes/`; `false` serves none.
   * `types` adds file extensions to the served ones, by their content type, such as `{ yaml: 'text/plain' }`.
   */
  files?: { prefix: string; private?: string[]; types?: Record<string, string> } | false;
  /** Widen the content column and start it at the sidebar. Default true. */
  wide?: boolean;
  /** The site's own Markdown plugins, run after Violet's. */
  mdastPlugins?: MdastPluginEntry[];
  /** Pages the site generates; `feeds` says which changed files should regenerate them in dev. */
  extraPages?: { pages: () => ExtraPage[]; feeds?: (file: string) => boolean };
}

export interface ResolvedOptions {
  /** Absolute, with a trailing slash. */
  notesDir: string;
  /** The site's own pages, absolute, with a trailing slash. */
  siteDocsDir: string;
  /** Violet's guide pages, absolute, with a trailing slash. */
  guideDir: string;
  /** Astro's `base`, with a trailing slash. */
  base: string;
  kinds: KindName[];
  customKinds: Record<string, CustomKind>;
  /** Absolute paths of custom kinds' header components, by kind. */
  customHeaders: Record<string, string>;
  require: [RegExp, string][];
  looseFiles?: string;
  skip: RegExp[];
  shortLabels: string[];
  acronyms: string[];
  sidebar: 'folders' | false;
  github?: { org: string; repo: string; branch: string };
  sourceLink: 'view' | 'edit' | false;
  owner?: string;
  sectionDescriptions: Record<string, string>;
  files: { prefix: string; private: string[]; types: Record<string, string> } | false;
  wide: boolean;
  mdastPlugins: MdastPluginEntry[];
  extraPages?: VioletOptions['extraPages'];
}

const KEY = Symbol.for(`${PACKAGE}:options`);

/** A glob relative to the notes folder, as a regular expression over relative paths. */
export function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '*' && glob[i + 1] === '*') {
      source += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

export function setOptions(options: ResolvedOptions): void {
  (globalThis as Record<symbol, unknown>)[KEY] = options;
}

/** The resolved options; fails clearly when the plugin is missing from astro.config. */
export function getOptions(): ResolvedOptions {
  const options = (globalThis as Record<symbol, unknown>)[KEY] as ResolvedOptions | undefined;
  if (!options) {
    throw new Error(`${PACKAGE}: add ${PACKAGE}() to starlight({ plugins: [...] }) in astro.config before using its loader.`);
  }
  return options;
}
