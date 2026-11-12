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

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i;
const TASKS = /\b(Tasks?)(\s+)(\d+(?:(?:,\s*|\s+and\s+|,\s*and\s+|\s+to\s+)\d+)*)\b/g;
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
  for (const part of match[3].split(/(\d+)/).filter(Boolean)) {
    const url = /^\d+$/.test(part) ? urls.get(part) : undefined;
    if (url) {
      nodes.push(link(part, url));
      linked = true;
    } else nodes.push(text(part));
  }
  return linked ? { start: match.index!, end: match.index! + match[0].length, nodes } : undefined;
}

/** Split a text value into text and links; undefined when nothing links. */
function autolink(value: string, tasks: Map<string, string>, decisions: Map<string, string>): PhrasingContent[] | undefined {
  const matches: Match[] = [];
  if (tasks.size > 0) for (const m of value.matchAll(TASKS)) matches.push(...[numbered(m, tasks)].filter((x) => x !== undefined));
  if (decisions.size > 0) for (const m of value.matchAll(DECISIONS)) matches.push(...[numbered(m, decisions)].filter((x) => x !== undefined));
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
    const tasks = new Map((plan()?.tasks ?? []).map((t) => [String(t.number), t.url]));
    const decisions = getOptions().kinds.includes('decision')
      ? new Map(readDecisions().map((d) => [d.number, d.url]))
      : new Map<string, string>();
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
        if (tasks.size === 0 && decisions.size === 0) return;
        if (parent && (parent.type === 'link' || parent.type === 'heading')) return;
        const nodes = autolink(value, tasks, decisions);
        if (nodes) ctx.replaceNode(node, nodes);
      },
    };
  };
}
