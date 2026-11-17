/**
 * Notes the build must refuse, each with a message naming the page. Each
 * case builds the test notes plus one bad page into a folder of its own.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { SITE } from './helpers.mjs';

function build(file, markdown) {
  const dir = mkdtempSync(join(tmpdir(), 'violet-test-'));
  try {
    cpSync(join(SITE, '../notes'), join(dir, 'notes'), { recursive: true });
    mkdirSync(dirname(join(dir, 'notes', file)), { recursive: true });
    writeFileSync(join(dir, 'notes', file), markdown);
    const run = spawnSync('npx', ['astro', 'build'], {
      cwd: SITE,
      encoding: 'utf8',
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', VIOLET_TEST_NOTES: join(dir, 'notes'), VIOLET_TEST_OUT: join(dir, 'dist') },
    });
    return { status: run.status, output: run.stdout + run.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('builds that fail', () => {
  test('a kind page missing a required section', () => {
    const { status, output } = build('work/empty-checklist.md', '---\nkind: checklist\ntitle: Empty\nstatus: open\nupdated: 2026-11-17\n---\n\n## Whats next\n');
    assert.notEqual(status, 0);
    assert.match(output, /empty-checklist\.md is a checklist and must have these level-two sections: What's next/);
  });
  test('a :task that the plan does not declare', () => {
    const { status, output } = build('work/unknown-task.md', '---\ntitle: Unknown task\n---\n\nSee :task[99].\n');
    assert.notEqual(status, 0);
    assert.match(output, /unknown-task\.md: :task\[99\] matches no task/);
  });
  test('a plan heading for a task the front matter lacks', () => {
    const plan = '---\nkind: planning\ntype: plan\nstatus: approved\nupdated: 2026-11-17\ntasks:\n  - { number: 1 }\n---\n\n# Other plan\n\n## Task 1: One\n\n## Task 7: Not declared\n';
    const { status, output } = build('other/PLAN.md', plan);
    assert.notEqual(status, 0);
    assert.match(output, /other\/PLAN\.md: the heading for task 7 is not in the front matter's tasks/);
  });
});
