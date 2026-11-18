/**
 * Notes the build must refuse, each with a message naming the page. Each
 * case builds a copy of the test site and its notes, plus one bad page, in
 * a folder of its own, so test/site and its generated files are never
 * touched while the other tests read them. The cases build at the same time.
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

async function build(file, markdown) {
  const command = astro();
  const dir = mkdtempSync(join(tmpdir(), 'violet-test-'));
  try {
    cpSync(SITE, join(dir, 'site'), { recursive: true, filter: (from) => !SKIP.has(from.slice(SITE.length + 1).split('/')[0]) });
    symlinkSync(realpathSync(join(SITE, 'node_modules')), join(dir, 'site', 'node_modules'));
    cpSync(join(SITE, '../notes'), join(dir, 'notes'), { recursive: true });
    mkdirSync(dirname(join(dir, 'notes', file)), { recursive: true });
    writeFileSync(join(dir, 'notes', file), markdown);
    return await run(process.execPath, [command, 'build'], { cwd: join(dir, 'site'), timeout: TIMEOUT, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('builds that fail', { concurrency: true }, () => {
  test('a kind page missing a required section', async () => {
    const { status, output } = await build('work/empty-checklist.md', '---\nkind: checklist\ntitle: Empty\nstatus: open\nupdated: 2026-11-17\n---\n\n## Whats next\n');
    assert.notEqual(status, 0);
    assert.match(output, /empty-checklist\.md is a checklist and must have these level-two sections: What's next\. Missing: What's next\./);
  });
  test('a :task that the plan does not declare', async () => {
    const { status, output } = await build('work/unknown-task.md', '---\ntitle: Unknown task\n---\n\nSee :task[99].\n');
    assert.notEqual(status, 0);
    assert.match(output, /unknown-task\.md: :task\[99\] matches no task/);
  });
  test('a plan heading for a task the front matter lacks', async () => {
    const plan = '---\nkind: planning\ntype: plan\nstatus: approved\nupdated: 2026-11-17\ntasks:\n  - { number: 1 }\n---\n\n# Other plan\n\n## Task 1: One\n\n## Task 7: Not declared\n';
    const { status, output } = await build('other/PLAN.md', plan);
    assert.notEqual(status, 0);
    assert.match(output, /other\/PLAN\.md: the heading for task 7 is not in the front matter's tasks/);
  });
});
