/**
 * Notes the build must refuse, each with a message naming the page, and
 * pages it must warn about. Each case builds a copy of the test site and its
 * notes, plus one page, in a folder of its own, so test/site and its
 * generated files are never touched while the other tests read them. The
 * cases build at the same time.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { NOT_BUILT, SITE } from './helpers.mjs';

/** What the copy of the test site leaves out: what a build makes, and the packages, which it links to. */
const SKIP = new Set(['dist', 'node_modules', '.astro', '.astro-cache']);
/** How long one build may take before its case fails, rather than hanging the run. */
const TIMEOUT = 120_000;

/** Astro's own command, run with this Node, so nothing is fetched or asked for. */
function astro() {
  const dir = join(SITE, 'node_modules/astro');
  if (!existsSync(join(dir, 'package.json'))) throw new Error(NOT_BUILT);
  return join(realpathSync(dir), JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).bin.astro);
}

/** Run a command to its end: its exit status (null when killed) and all it printed. */
function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    // Decoded as a stream, so a character split across two chunks is read whole.
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', reject);
    child.on('close', (status, signal) => resolve({ status, output: signal ? `${output}\nkilled by ${signal}: the build took over ${TIMEOUT / 1000}s` : output }));
  });
}

/**
 * Build a copy of the test site with one more file, at a path under the copy
 * (`notes/...` or `site/...`), any files in `also`, and optionally one file
 * fewer. `step: 'sync'`
 * runs only the content loader: a whole build of the copy fails in Vite, which
 * does not follow its linked node_modules, so a case that expects success syncs.
 */
async function build(file, markdown, { without, also = {}, violet, step = 'build' } = {}) {
  const command = astro();
  const dir = mkdtempSync(join(tmpdir(), 'violet-test-'));
  try {
    cpSync(SITE, join(dir, 'site'), { recursive: true, filter: (from) => !SKIP.has(from.slice(SITE.length + 1).split('/')[0]) });
    symlinkSync(realpathSync(join(SITE, 'node_modules')), join(dir, 'site', 'node_modules'));
    cpSync(join(SITE, '../notes'), join(dir, 'notes'), { recursive: true });
    if (without) rmSync(join(dir, without));
    // Options added last to the site's Violet options, as source text, so they win over its own.
    if (violet) {
      const config = join(dir, 'site', 'astro.config.mjs');
      const text = readFileSync(config, 'utf8');
      if (!text.includes('sidebar: false,')) throw new Error(`${join(SITE, 'astro.config.mjs')} has no "sidebar: false," to add Violet options after`);
      writeFileSync(config, text.replace('sidebar: false,', `sidebar: false, ${violet},`));
    }
    for (const [path, text] of [[file, markdown], ...Object.entries(also)]) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    return await run(process.execPath, [command, step], { cwd: join(dir, 'site'), timeout: TIMEOUT, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('builds that fail', { concurrency: true }, () => {
  test('a kind page missing a required section', async () => {
    const { status, output } = await build('notes/work/empty-checklist.md', '---\nkind: checklist\ntitle: Empty\nstatus: open\nupdated: 2026-11-17\n---\n\n## Whats next\n');
    assert.notEqual(status, 0);
    assert.match(output, /empty-checklist\.md is a checklist and must have these level-two sections: What's next\. Missing: What's next\./);
  });
  test('a :task that the plan does not declare', async () => {
    const { status, output } = await build('notes/work/unknown-task.md', '---\ntitle: Unknown task\n---\n\nSee :task[99].\n');
    assert.notEqual(status, 0);
    assert.match(output, /unknown-task\.md: :task\[99\] matches no task/);
  });
  test('a plan heading for a task the front matter lacks', async () => {
    const plan = '---\nkind: planning\ntype: plan\nstatus: approved\nupdated: 2026-11-17\ntasks:\n  - { number: 1 }\n---\n\n# Other plan\n\n## Task 1: One\n\n## Task 7: Not declared\n';
    const { status, output } = await build('notes/other/PLAN.md', plan);
    assert.notEqual(status, 0);
    assert.match(output, /other\/PLAN\.md: the heading for task 7 is not in the front matter's tasks/);
  });
});

describe('syncs that warn', { concurrency: true }, () => {
  /** The start of every warning about a page Violet does not read. */
  const skipping = (shown) => `Skipping ${shown}: Violet reads Markdown pages ending in .md only.`;
  test("an MDX home page in the site's own pages", async () => {
    const { status, output } = await build('site/src/content/docs/index.mdx', "---\ntitle: Welcome\n---\n\nimport { Card } from '@astrojs/starlight/components';\n", { step: 'sync' });
    assert.equal(status, 0, output);
    // The test site's notes have an index.md, so the home page is that one.
    assert.ok(output.includes(`${skipping('src/content/docs/index.mdx')} /violet-tests/ shows ../notes/index.md instead; remove it.`), output);
    assert.doesNotMatch(output, /no home page/);
  });
  test('an MDX home page and no other', async () => {
    const { status, output } = await build('notes/index.mdx', '---\ntitle: Welcome\n---\n', { without: 'notes/index.md', step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/index.mdx')} The site has no home page: rename it to index.md, without MDX imports or components, or put an index.md at the top of the notes.`), output);
  });
  test("an MDX folder page, whose address Violet's section page takes", async () => {
    const { status, output } = await build('notes/work/index.mdx', '---\ntitle: Work\n---\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/work/index.mdx')} /violet-tests/work/ shows the work section page; make it the folder's page by renaming it to README.md, without MDX imports or components, or remove it.`), output);
  });
  test('an MDX folder page in a folder with no page', async () => {
    const { status, output } = await build('notes/work/sub/index.mdx', '---\ntitle: Sub\n---\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/work/sub/index.mdx')} /violet-tests/work/sub/ has no page; make it the folder's page by renaming it to README.md, without MDX imports or components, or remove it.`), output);
  });
  test('an MDX folder page beside the folder\'s README.md', async () => {
    const { status, output } = await build('notes/work/index.mdx', '---\ntitle: Work\n---\n', { also: { 'notes/work/README.md': '# Work\n' }, step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/work/index.mdx')} /violet-tests/work/ shows ../notes/work/README.md instead; remove it.`), output);
  });
  test('an MDX README at the top of the notes, beside the home page', async () => {
    const { status, output } = await build('notes/README.mdx', '# Notes\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/README.mdx')} /violet-tests/ shows ../notes/index.md instead; remove it.`), output);
  });
  test("an MDX partial in the site's own pages", async () => {
    const { status, output } = await build('site/src/content/docs/_partial.mdx', 'Shared text.\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.doesNotMatch(output, /_partial\.mdx/);
  });
  test('an MDX page the skip option leaves out', async () => {
    const { status, output } = await build('notes/work/sketch.draft.mdx', '---\ntitle: Sketch\n---\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.doesNotMatch(output, /sketch\.draft\.mdx/);
  });
  test('an MDX page in the notes', async () => {
    const { status, output } = await build('notes/work/diagram.mdx', '---\ntitle: Diagram\n---\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/work/diagram.mdx')} Rename it to .md, without MDX imports or components, or remove it.`), output);
  });
  test("an MDX folder page where the decisions list is", async () => {
    const { status, output } = await build('notes/decisions/index.mdx', '---\ntitle: Decisions\n---\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/decisions/index.mdx')} /violet-tests/decisions/ shows the decisions list instead; remove it.`), output);
  });
  test('an MDX folder page where the decisions list is, beside a README', async () => {
    const { status, output } = await build('notes/decisions/index.mdx', '---\ntitle: Decisions\n---\n', {
      also: { 'notes/decisions/README.md': '# Decisions\n' },
      step: 'sync',
    });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/decisions/index.mdx')} /violet-tests/decisions/ shows the decisions list instead; remove it.`), output);
  });
  test('an MDX home page whose name is not in lower case', async () => {
    const { status, output } = await build('notes/Index.mdx', '---\ntitle: Welcome\n---\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/Index.mdx')} /violet-tests/ shows ../notes/index.md instead; remove it.`), output);
  });
  test('an MDX readme in lower case, which is a page of its own', async () => {
    // Only README is a folder's page; readme.md would be one at /readme/, so renaming it is right.
    const { status, output } = await build('notes/readme.mdx', '# Notes\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/readme.mdx')} Rename it to .md, without MDX imports or components, or remove it.`), output);
  });
  test('an MDX page with an upper-case extension', async () => {
    const { status, output } = await build('notes/work/Diagram.MDX', '---\ntitle: Diagram\n---\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/work/Diagram.MDX')} Rename it to .md, without MDX imports or components, or remove it.`), output);
  });
  test('a Markdoc page on a site without Markdoc', async () => {
    // Starlight reads .mdoc only with the Markdoc integration, so it is no page here.
    const { status, output } = await build('notes/work/sheet.mdoc', '# Sheet\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.doesNotMatch(output, /sheet\.mdoc/);
  });
  test('an MDX page beside a page that fails the build', async () => {
    const { status, output } = await build('notes/work/diagram.mdx', '---\ntitle: Diagram\n---\n', {
      also: {
        'notes/work/unknown-task.md': '---\ntitle: Unknown task\n---\n\nSee :task[99].\n',
        'notes/work/prose.mdx': '---\ntitle: Prose\n---\n',
        'notes/work/Spec.mdx': '---\ntitle: Spec\n---\n',
        'notes/work/index.mdx': '---\ntitle: Work\n---\n',
      },
      step: 'sync',
    });
    assert.notEqual(status, 0);
    assert.match(output, /unknown-task\.md: :task\[99\] matches no task/);
    // A page of its own keeps its advice; an index page's needs the addresses, which the failed build never knew.
    assert.ok(output.includes(`${skipping('../notes/work/diagram.mdx')} Rename it to .md, without MDX imports or components, or remove it.`), output);
    assert.ok(output.includes(`${skipping('../notes/work/prose.mdx')} Renaming it to .md would clash with ../notes/work/prose.md: give it another name ending in .md, without MDX imports or components, or remove it.`), output);
    assert.ok(output.includes(`${skipping('../notes/work/Spec.mdx')} Renaming it to .md would clash with ../notes/work/SPEC.md: give it another name ending in .md, without MDX imports or components, or remove it.`), output);
    assert.ok(output.includes(`${skipping('../notes/work/index.mdx')}\n`), output);
  });
  test('an MDX page beside a Markdown page of the same name', async () => {
    const { status, output } = await build('notes/work/prose.mdx', '---\ntitle: Prose\n---\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/work/prose.mdx')} Renaming it to .md would clash with ../notes/work/prose.md, at /violet-tests/work/prose/: give it another name ending in .md, without MDX imports or components, or remove it.`), output);
  });
  test('an MDX page beside a Markdown page of the same name in another case', async () => {
    const { status, output } = await build('notes/work/Spec.mdx', '---\ntitle: Spec\n---\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/work/Spec.mdx')} Renaming it to .md would clash with ../notes/work/SPEC.md, at /violet-tests/work/spec/: give it another name ending in .md, without MDX imports or components, or remove it.`), output);
  });
  test('an MDX README beside a readme.md, a page of its own', async () => {
    const { status, output } = await build('notes/work/sub/README.mdx', '# Sub\n', { also: { 'notes/work/sub/readme.md': '---\nkind: reference\nstatus: current\nupdated: 2026-11-20\n---\n\n# Read me\n' }, step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/work/sub/README.mdx')} /violet-tests/work/sub/ has no page, and renaming it to README.md would clash with ../notes/work/sub/readme.md: rename that file first, or remove this one.`), output);
  });
  test('an MDX index page in a folder beside a readme.md, a page of its own', async () => {
    const { status, output } = await build('notes/work/sub/index.mdx', '# Sub\n', { also: { 'notes/work/sub/readme.md': '---\nkind: reference\nstatus: current\nupdated: 2026-11-20\n---\n\n# Read me\n' }, step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/work/sub/index.mdx')} /violet-tests/work/sub/ has no page, and renaming it to README.md would clash with ../notes/work/sub/readme.md: rename that file first, or remove this one.`), output);
  });
  test('an MDX README at the top of the notes beside a readme.md, with no home page', async () => {
    // The advice renames it to index.md, which clashes with nothing; readme.md is a page of its own.
    const { status, output } = await build('notes/README.mdx', '# Notes\n', { without: 'notes/index.md', also: { 'notes/readme.md': '# Read me\n' }, step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/README.mdx')} The site has no home page: rename it to index.md, without MDX imports or components, or put an index.md at the top of the notes.`), output);
  });
  test('an MDX README at the top of the notes, filed under a folder by looseFiles', async () => {
    const { status, output } = await build('notes/README.mdx', '# Notes\n', { violet: "looseFiles: 'misc'", step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/README.mdx')} /violet-tests/misc/ has no page; make it the folder's page by renaming it to README.md, without MDX imports or components, or remove it.`), output);
  });
  test('an MDX home page beside an index.md the skip option leaves out', async () => {
    const { status, output } = await build('notes/README.mdx', '# Notes\n', { violet: "skip: ['work/DRAFT.md', 'work/*.draft.mdx', 'index.md']", step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/README.mdx')} The site has no home page, and renaming it to index.md would clash with ../notes/index.md: rename that file first, or remove this one.`), output);
  });
  test('an MDX page beside a Markdown file the skip option leaves out, named in another case', async () => {
    const { status, output } = await build('notes/work/draft.mdx', '---\ntitle: Draft\n---\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/work/draft.mdx')} Renaming it to .md would clash with ../notes/work/DRAFT.md: give it another name ending in .md, without MDX imports or components, or remove it.`), output);
  });
  test('an MDX page beside a Markdown file the skip option leaves out', async () => {
    const { status, output } = await build('notes/work/DRAFT.mdx', '---\ntitle: Draft\n---\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/work/DRAFT.mdx')} Renaming it to .md would clash with ../notes/work/DRAFT.md: give it another name ending in .md, without MDX imports or components, or remove it.`), output);
  });
  test('a page with an upper-case extension beside a page that fails the build', async () => {
    // On a filesystem that ignores case, Diagram.MD is the Diagram.md renaming it would make: no clash.
    const { status, output } = await build('notes/work/Diagram.MD', '# Diagram\n', { also: { 'notes/work/unknown-task.md': '---\ntitle: Unknown task\n---\n\nSee :task[99].\n' }, step: 'sync' });
    assert.notEqual(status, 0);
    assert.ok(output.includes(`${skipping('../notes/work/Diagram.MD')} Rename it to .md, or remove it.`), output);
  });
  test("a Markdown partial in the site's own pages", async () => {
    // Read as a page, its unknown task would fail the build.
    const { status, output } = await build('site/src/content/docs/_shared.md', '---\ntitle: Shared\n---\n\nSee :task[99].\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.doesNotMatch(output, /_shared\.md/);
  });
  test('a page ending in .markdown', async () => {
    const { status, output } = await build('notes/work/old.markdown', '# Old\n', { step: 'sync' });
    assert.equal(status, 0, output);
    assert.ok(output.includes(`${skipping('../notes/work/old.markdown')} Rename it to .md, or remove it.`), output);
  });
});
