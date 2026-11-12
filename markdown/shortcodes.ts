/**
 * Shortcodes: a leaf directive such as `::planning{status=draft}` on a line
 * of its own is replaced, at build time, by Markdown generated from the notes.
 * Each entry in SHORTCODES takes the directive's attributes and returns
 * Markdown.
 */
import type { MdastPluginEntry } from 'satteri';
import { fileURLToPath } from 'node:url';
import { getKind, progressBar, statusBadge, statusLabel } from '../kinds';
import { getOptions } from '../options';
import { idFor, issueRefs, issueUrl, notesDir, notesPages, notesRel, pageUrl, readKind, readPage, sectionDescription, sections, slugify, splitTitle, words, type PageInfo } from '../lib/notes';
import { planFor, type Plan } from '../lib/plans';
import { readDecisions, readHandoffs } from '../lib/records';

type Attributes = Record<string, string | null | undefined>;

function cell(value: unknown): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/** A Markdown table; a column empty in every row is left out. */
function table(fullHeader: string[], fullRows: string[][]): string {
  if (fullRows.length === 0) return '> Nothing matches.';
  const keep = fullHeader.map((_, i) => fullRows.some((row) => String(row[i] ?? '').trim() !== ''));
  const header = fullHeader.filter((_, i) => keep[i]);
  const rows = fullRows.map((row) => row.filter((_, i) => keep[i]));
  const line = (cells: string[]) => `| ${cells.map(cell).join(' | ')} |`;
  return [line(header), `|${header.map(() => '---').join('|')}|`, ...rows.map(line)].join('\n');
}

function issueLinks(...issues: (string | undefined)[]): string {
  return issues.filter(Boolean).map((i) => `[${i}](${issueUrl(i!)})`).join(', ');
}

/** The plan a table is about: the page's own, or `topic=<folder>`'s; a message when there is none. */
function planOrMessage(file: string | undefined, topic: string | null | undefined): Plan | string {
  const plan = planFor(file, topic);
  if (plan) return plan;
  return topic ? `> No plan with tasks or PRs in \`planning/${topic}/\`.` : '> This page has no plan; add `topic=<folder>`.';
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The page's date, by its kind's date field; undefined when it has none. */
function pageDate(data: Record<string, unknown>): string | undefined {
  const field = getKind(data.kind)?.dateField ?? 'updated';
  const value = data[field] ?? data.updated;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === 'string' ? value : undefined;
}

/** A plan's tasks done, as a progress bar; empty for a page without tasks. */
function taskProgress(data: Record<string, unknown>): string {
  const tasks = Array.isArray(data.tasks) ? (data.tasks as { status?: string }[]) : [];
  if (tasks.length === 0) return '';
  return progressBar(tasks.filter((task) => task.status === 'done').length, tasks.length, 'tasks done');
}

export const SHORTCODES: Record<string, (attributes: Attributes, file?: string) => string> = {
  /**
   * The landing page's cards: one per top-level folder of the notes, in
   * sidebar order, with its name and its one-line description, leading to
   * the section's page. `::sections{hide=hours}` leaves folders out.
   */
  sections({ hide }) {
    const hidden = new Set((hide ?? '').split(',').map((name) => name.trim()).filter(Boolean));
    const cards = sections()
      .filter((section) => !hidden.has(section))
      .map((section) => {
        const description = sectionDescription(section);
        return `<a class="notes-card" href="${pageUrl(slugify(section))}"><span class="notes-card-title">${escape(words(section))}</span>${description ? `<span class="notes-card-description">${escape(description)}</span>` : ''}</a>`;
      });
    return `<div class="notes-cards not-content">${cards.join('')}</div>`;
  },

  /** Every page in one top-level folder, newest first: `::folder{name=finance}`. */
  folder({ name }) {
    const { looseFiles } = getOptions();
    const rows = notesPages()
      .filter((file) => {
        const rel = notesRel(file);
        return rel.includes('/') ? rel.split('/')[0] === name : name === looseFiles;
      })
      .map((file) => {
        const { data, body } = readPage(file);
        const id = idFor(file, notesDir());
        const stem = notesRel(file).split('/').at(-1)!.replace(/\.md$/, '').split('.')[0];
        return { url: pageUrl(id), title: String(data.title ?? splitTitle(body).title ?? words(stem)), date: pageDate(data), data };
      })
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.title.localeCompare(b.title))
      .map(({ url, title, date, data }) => [
        `[${title}](${url})`,
        data.kind ? statusLabel(String(data.type ?? data.kind)) : '',
        data.kind && data.status ? statusBadge(String(data.kind), String(data.status)) : '',
        date ?? '',
      ]);
    return table(['Page', 'Kind', 'Status', 'Date'], rows);
  },

  /**
   * Every planning page, newest change first, optionally narrowed:
   * `::planning{status=draft}`, `::planning{topic=export-screen}`,
   * `::planning{type=plan}`.
   */
  planning({ status, topic, type }) {
    const rows = readKind('planning')
      .filter((p) => !status || p.data.status === status)
      .filter((p) => !topic || p.topic === topic)
      .filter((p) => !type || p.data.type === type)
      .sort((a, b) => String(b.data.updated).localeCompare(String(a.data.updated)) || a.url.localeCompare(b.url))
      .map(({ url, title, topicLabel, data }) => [
        `[${title}](${url})`,
        topicLabel,
        statusLabel(String(data.type)),
        statusBadge('planning', String(data.status)),
        taskProgress(data),
        String(data.updated),
        issueLinks(...issueRefs(data)),
      ]);
    return table(['Page', 'Topic', 'Type', 'Status', 'Progress', 'Last updated', 'Issues'], rows);
  },

  /** One row per topic folder under planning/: its pages and their statuses. */
  topics() {
    const byTopic = new Map<string, PageInfo[]>();
    for (const page of readKind('planning')) byTopic.set(page.topic, [...(byTopic.get(page.topic) ?? []), page]);
    const rows = [...byTopic.values()].map((pages) => {
      const latest = pages.map((p) => String(p.data.updated)).sort().at(-1) ?? '';
      const issues = [...new Set(pages.flatMap((p) => issueRefs(p.data)))];
      return [
        pages[0].topicLabel,
        pages
          .map((p) => `[${statusLabel(String(p.data.type))}](${p.url}) ${statusBadge('planning', String(p.data.status))}`)
          .join('<br>'),
        latest,
        issues.map((i) => `[${i}](${issueUrl(i)})`).join(', '),
      ];
    });
    return table(['Topic', 'Pages', 'Last updated', 'Issues'], rows);
  },

  /**
   * Every page of one kind, a site's own included: `::pages{kind=risk}`,
   * `::pages{kind=risk status=open}`. Newest change first when the kind has
   * `updated`, else by title.
   */
  pages({ kind, status }) {
    if (!kind) return '> `::pages` needs a kind, such as `::pages{kind=risk}`.';
    const field = getKind(kind)?.dateField ?? 'updated';
    const day = (data: Record<string, unknown>) => {
      const value = data[field];
      return value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '');
    };
    const rows = readKind(kind)
      .filter((p) => !status || p.data.status === status)
      .sort((a, b) => day(b.data).localeCompare(day(a.data)) || a.title.localeCompare(b.title))
      .map(({ url, title, data }) => [
        `[${title}](${url})`,
        data.status ? statusBadge(kind, String(data.status)) : '',
        day(data),
        issueLinks(...issueRefs(data)),
      ]);
    return table(['Page', 'Status', field === 'updated' ? 'Last updated' : 'Date', 'Issues'], rows);
  },

  /** Every decision, or those with one status: `::decisions{status=locked}`. */
  decisions({ status }) {
    const wanted = status?.toLowerCase();
    const rows = readDecisions()
      .filter((d) => !wanted || d.status === wanted)
      .map((d) => [`[${d.number}](${d.url})`, d.title, statusBadge('decision', d.status), d.date]);
    return table(['No.', 'Decision', 'Status', 'Date'], rows);
  },

  /** Every handoff with its status and how many questions are open. */
  handoffs() {
    const rows = readHandoffs()
      .sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)))
      .map(({ url, data }) => {
        const questions = (data.open_questions as { answer?: string | null }[] | undefined) ?? [];
        const open = questions.filter((q) => !q.answer).length;
        return [
          `[${data.title}](${url})`,
          statusBadge('handoff', String(data.status)),
          String(data.date),
          String(data.from),
          String(data.to),
          `${open} of ${questions.length}`,
        ];
      });
    return table(['Handoff', 'Status', 'Date', 'From', 'To', 'Open questions'], rows);
  },

  /** The open questions of one handoff: `::questions{of=finance}`. */
  questions({ of }) {
    const handoff = readHandoffs().find((h) => h.id === of || h.id.endsWith(`/${of}`));
    if (!handoff) return `> No handoff with id \`${of ?? ''}\`.`;
    const questions = (handoff.data.open_questions as Record<string, string>[] | undefined) ?? [];
    const rows = questions.map((q) => [q.id, q.question, q.blocks ?? '', q.answer ?? '*open*']);
    return table(['', 'Question', 'Blocks', 'Answer'], rows);
  },

  /** Every reference page , newest change first: `::references{status=current}`. */
  references({ status }) {
    const rows = readKind('reference')
      .filter((p) => !status || p.data.status === status)
      .sort((a, b) => String(b.data.updated).localeCompare(String(a.data.updated)) || a.url.localeCompare(b.url))
      .map(({ url, title, data }) => [
        `[${title}](${url})`,
        statusBadge('reference', String(data.status)),
        String(data.updated),
        issueLinks(...issueRefs(data)),
      ]);
    return table(['Page', 'Status', 'Last updated', 'Issues'], rows);
  },

  /** The plan's pull requests: `::prs`, or `::prs{topic=export-screen}`. */
  prs({ topic }, file) {
    const plan = planOrMessage(file, topic);
    if (typeof plan === 'string') return plan;
    const taskUrl = new Map(plan.tasks.map((t) => [t.number, t.url]));
    const ships = plan.prs.some((pr) => pr.ships);
    const rows = plan.prs.map((pr) => [
      `[PR ${pr.number}](${pr.url})`,
      pr.title,
      pr.branch ? `\`${pr.branch}\`` : '',
      pr.tasks.map((n) => `[${n}](${taskUrl.get(n)})`).join(', '),
      ...(ships ? [pr.ships ?? ''] : []),
      statusBadge('work', pr.status),
      issueLinks(pr.issue, pr.pull),
    ]);
    return table(['PR', 'Title', 'Branch', 'Tasks', ...(ships ? ['What ships'] : []), 'Status', 'Issue / PR'], rows);
  },

  /** The plan's tasks: `::tasks`, `::tasks{pr=2}`, `::tasks{status=todo}`, `::tasks{topic=...}`. */
  tasks({ topic, pr, status }, file) {
    const plan = planOrMessage(file, topic);
    if (typeof plan === 'string') return plan;
    const prUrl = new Map(plan.prs.map((p) => [p.number, p.url]));
    const rows = plan.tasks
      .filter((t) => !pr || t.pr === Number(pr))
      .filter((t) => !status || t.status === status)
      .map((t) => [
        `[Task ${t.number}](${t.url})`,
        t.title,
        t.pr ? `[PR ${t.pr}](${prUrl.get(t.pr)})` : '',
        statusBadge('work', t.status),
        issueLinks(t.issue),
      ]);
    return table(['Task', 'Title', 'PR', 'Status', 'Issue'], rows);
  },
};

export function shortcodesPlugin(): MdastPluginEntry {
  return ({ fileURL }) => {
    const file = fileURL ? fileURLToPath(fileURL) : undefined;
    return {
      name: 'notes-shortcodes',
      leafDirective(node) {
        const render = SHORTCODES[node.name];
        if (!render) return;
        return { raw: `${render(node.attributes ?? {}, file)}\n` };
      },
    };
  };
}
