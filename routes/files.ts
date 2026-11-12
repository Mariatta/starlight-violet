/**
 * The notes' non-Markdown files (mockups, screenshots, CSS, scripts), served
 * under the `files.prefix` option so relative links from the pages resolve.
 * Only known file types are served, and a site adds more with `files.types`.
 * Environment files are not among them, and `.git`, dotfiles and the
 * folders listed in `files.private`, so nothing private beyond the pages
 * themselves reaches the browser. Injected only when the site serves files.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { isServedFile, listFiles, notesDir } from '../lib/notes';
import { getOptions } from '../options';

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  jsx: 'text/plain; charset=utf-8',
  ts: 'text/plain; charset=utf-8',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  csv: 'text/csv; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  py: 'text/plain; charset=utf-8',
};

/** The type a file is served as, or undefined when the file is not served. */
export function servedType(file: string): string | undefined {
  const name = file.slice(file.lastIndexOf('/') + 1);
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : name;
  // Environment files hold secrets, so `env` is served only when the site adds it
  // to `files.types`; dotfiles such as `.env` are never served.
  const { files } = getOptions();
  if (files && Object.hasOwn(files.types, extension)) return files.types[extension];
  return Object.hasOwn(TYPES, extension) ? TYPES[extension] : undefined;
}

export const getStaticPaths: GetStaticPaths = () => {
  const { files } = getOptions();
  return listFiles(notesDir(), notesDir(), files ? files.private : [])
    .filter((file) => servedType(file) !== undefined && isServedFile(file))
    .map((file) => ({ params: { path: relative(notesDir(), file) } }));
};

export const GET: APIRoute = async ({ params }) => {
  const file = join(notesDir(), params.path ?? '');
  const type = servedType(file);
  if (!type || !isServedFile(file)) return new Response('Not found', { status: 404 });
  return new Response(await readFile(file), { headers: { 'Content-Type': type } });
};
