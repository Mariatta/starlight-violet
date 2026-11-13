/**
 * Reading a note's Markdown source line by line, as the renderer will see it,
 * and remembering what was worked out from a file until the file changes.
 * Shared by the plan, heading and table-row readers, so they agree with each
 * other and with the rendered page.
 */
import { existsSync, statSync } from 'node:fs';

/**
 * Which lines are inside fenced code, the fence lines included. A fence
 * opens with three or more backticks or tildes (indented at most three
 * spaces; a backtick fence's info string has no backtick) and closes on a
 * line of the same character, at least as long, and nothing else; an
 * unclosed fence runs to the end, as in CommonMark.
 */
export function fencedLines(lines: readonly string[]): boolean[] {
  const inside: boolean[] = [];
  let fence: { char: string; length: number } | undefined;
  for (const line of lines) {
    if (fence) {
      inside.push(true);
      const close = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line)?.[1];
      if (close && close[0] === fence.char && close.length >= fence.length) fence = undefined;
      continue;
    }
    const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (open && !(open[1][0] === '`' && open[2].includes('`'))) {
      fence = { char: open[1][0], length: open[1].length };
      inside.push(true);
    } else inside.push(false);
  }
  return inside;
}

const memo = new Map<string, { mtime: number; value: unknown }>();
/** Entries kept at most; the least recently used goes first, so a long dev session does not grow it forever. */
const LIMIT = 20000;

/**
 * A value worked out from a file or folder, worked out again only when its
 * modification time changes: one page renders many fragments (the body,
 * every handoff field), and each asks about the same few files.
 */
export function cached<T>(path: string, key: string, compute: () => T): T {
  const mtime = existsSync(path) ? statSync(path).mtimeMs : -1;
  const id = `${key}:${path}`;
  const hit = memo.get(id);
  memo.delete(id);
  if (hit && hit.mtime === mtime) {
    memo.set(id, hit);
    return hit.value as T;
  }
  const value = compute();
  memo.set(id, { mtime, value });
  if (memo.size > LIMIT) memo.delete(memo.keys().next().value!);
  return value;
}
