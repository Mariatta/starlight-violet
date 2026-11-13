/**
 * The registry of kinds. A page declares one in front matter and gets its
 * schema, its section rule, its header and its inline-Markdown rendering. A
 * site turns kinds on with the `kinds` option; a page may only declare one
 * that is on.
 */
import { getOptions, type BadgeVariant, type KindName } from '../options';
import { DECISION_SECTIONS, DECISION_VARIANT, decisionSchema, renderDecision } from './decision';
import { HANDOFF_SECTIONS, handoffSchema, renderHandoff, STATUS_VARIANT as HANDOFF_VARIANT } from './handoff';
import { planningSchema, PLANNING_VARIANT, renderPlanning, WORK_VARIANT } from './planning';
import { referenceSchema, REFERENCE_VARIANT, renderReference } from './reference';

/** Render inline Markdown; `{ html: false }` shows raw HTML in it as text. */
type Inline = (text: string, options?: { html?: boolean }) => Promise<string>;
export type { BadgeVariant };

export interface Kind {
  label: string;
  schema: { parse(data: unknown): unknown };
  /** Starlight badge variant per status. */
  variants: Record<string, BadgeVariant>;
  /** `exact`: the body's level-two headings are these, in order. `required`: these must be among them. */
  sections?: { exact: readonly string[] } | { required: readonly string[] };
  /** Render the inline-Markdown fields of validated data to HTML, in place. */
  render?: (data: any, inline: Inline) => Promise<void>;
  /** The front matter field holding the page's date. */
  dateField?: string;
}

export const KINDS: Record<KindName, Kind> = {
  planning: { label: 'Planning', schema: planningSchema, variants: PLANNING_VARIANT, render: renderPlanning, dateField: 'updated' },
  reference: { label: 'Reference', schema: referenceSchema, variants: REFERENCE_VARIANT, render: renderReference, dateField: 'updated' },
  handoff: {
    label: 'Handoff',
    schema: handoffSchema,
    variants: HANDOFF_VARIANT,
    sections: { exact: HANDOFF_SECTIONS },
    render: renderHandoff,
    dateField: 'date',
  },
  decision: {
    label: 'Decision',
    schema: decisionSchema,
    variants: DECISION_VARIANT,
    sections: { required: DECISION_SECTIONS },
    render: renderDecision,
    dateField: 'date',
  },
};

/** Badge variants for the status of one task or PR, which is not a page. */
const OTHER_VARIANTS: Record<string, Record<string, BadgeVariant>> = { work: WORK_VARIANT };

/** Whether `name` is a kind this site uses: a built-in kind it turned on, or one of its own. */
export function isKind(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const { kinds, customKinds } = getOptions();
  return (kinds as string[]).includes(name) || name in customKinds;
}

/** The kind called `name`, Violet's or the site's own; undefined when the site does not use it. */
export function getKind(name: unknown): Kind | undefined {
  if (!isKind(name)) return;
  const custom = getOptions().customKinds[name];
  if (custom) {
    return { label: custom.label, schema: custom.schema, variants: custom.variants ?? {}, sections: custom.sections, render: custom.render, dateField: custom.dateField };
  }
  return KINDS[name as KindName];
}

/** 'picked-up' to 'Picked up'. */
export function statusLabel(status: string): string {
  const text = String(status).replace(/-/g, ' ');
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export function statusVariant(kind: string, status: string): BadgeVariant {
  const variants = OTHER_VARIANTS[kind] ?? getKind(kind)?.variants ?? (KINDS as Record<string, Kind>)[kind]?.variants;
  return variants?.[status] ?? 'default';
}

/** The badge as HTML, for generated Markdown; the classes are styled in Violet's CSS like Starlight's Badge. */
export function statusBadge(kind: string, status: string): string {
  return `<span class="note-badge note-badge-${statusVariant(kind, status)}">${statusLabel(status)}</span>`;
}

/**
 * A progress bar with its count, as HTML: `6 of 14 tasks done`. The count
 * is visible text, which screen readers read; the bar is hidden from them so
 * the count is not announced twice. `total` must be above 0.
 */
export function progressBar(done: number, total: number, what: string): string {
  const text = escapeHtml(`${done} of ${total} ${what}`);
  return `<span class="note-progress"><progress value="${done}" max="${total}" aria-hidden="true"></progress><span>${text}</span></span>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The sections a body is missing or has out of order, as a message, or undefined when it conforms. */
export function sectionProblem(kind: Kind, found: string[]): string | undefined {
  if (!kind.sections) return;
  if ('exact' in kind.sections) {
    const expected = [...kind.sections.exact];
    if (JSON.stringify(found) === JSON.stringify(expected)) return;
    return `must have exactly these level-two sections, in order: ${expected.join(', ')}. Found: ${found.join(', ') || 'none'}.`;
  }
  const missing = kind.sections.required.filter((section) => !found.includes(section));
  if (missing.length === 0) return;
  return `must have these level-two sections: ${kind.sections.required.join(', ')}. Missing: ${missing.join(', ')}.`;
}
