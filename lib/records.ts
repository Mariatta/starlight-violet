/** The decision and handoff pages as records, for the shortcodes, headers, links and the decisions page. */
import { readKind } from './notes';

export interface Decision {
  number: string;
  id: string;
  url: string;
  title: string;
  status: string;
  date: string;
}

/** Every decision page, with its number, status (lower case) and date from its front matter. */
export function readDecisions(): Decision[] {
  return readKind('decision')
    .map(({ id, url, title, data }) => ({
      number: String(data.number ?? ''),
      id,
      url,
      title: title.replace(/^\d{4}\.\s*/, ''),
      status: String(data.status ?? '').toLowerCase(),
      date: String(data.date ?? ''),
    }))
    .sort((a, b) => a.number.localeCompare(b.number));
}

export interface Handoff {
  file: string;
  id: string;
  url: string;
  data: Record<string, unknown>;
}

/** Every handoff page, unvalidated; the loader validates. */
export function readHandoffs(): Handoff[] {
  return readKind('handoff').map(({ file, id, url, data }) => ({ file, id, url, data }));
}
