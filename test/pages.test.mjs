/** Plans, split pages, kinds and the site as a whole. */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { before, describe, test } from 'node:test';
import { BASE, DIST, html, ids, linksIn, main, ORIGIN, pageLinks } from './helpers.mjs';

describe('table rows', () => {
  test('numbered rows get anchors', () => {
    const found = ids('work/plan');
    for (const id of ['stage-1', 'stage-2', 'task-1-2', 'task-5']) assert.ok(found.includes(id), id);
  });
  test('on a split plan, a row keeps its anchor and its links stay on its part', () => {
    assert.ok(ids('split/plan/part-b').includes('stage-1'));
    assert.deepEqual(
      linksIn('split/notes', 'SA').map(({ href }) => href),
      ['/split/plan/part-b/#stage-1'],
    );
  });
});

describe('headings', () => {
  test('a quoted or listed "Task" heading is not one of the plan tasks', () => {
    // The plan declares tasks 1 to 3; the build fails if Task 8 or 9 counted. Both still render, in their quote and list.
    const plan = main('work/plan');
    assert.match(plan, /<blockquote>\s*(?:<div[^>]*>\s*)?<h2[^>]*\sid="task-9-a-quoted-example-not-a-task"/);
    assert.match(plan, /<li>\s*(?:<div[^>]*>\s*)?<h2[^>]*\sid="task-8-a-listed-example-not-a-task"/);
  });
  test('a heading with -- keeps the anchor of its rendered text', () => assert.ok(ids('work/plan').includes('task-2--ship')));
  test("a required section with an apostrophe is found", () => assert.match(main('work/checklist'), /What’s next/));
});

describe('pages', () => {
  test('a body that starts with a horizontal rule keeps what follows it', () => {
    const page = main('work/ruled');
    assert.match(page, /Between the rules/);
    assert.match(page, /After the rules/);
  });
  test('a skipped page is not built', () => assert.ok(!existsSync(join(DIST, 'work/draft'))));
});

describe('the whole site', () => {
  const pages = [];
  before(() => {
    html('');
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name === 'index.html') pages.push(relative(DIST, dir));
      }
    };
    walk(DIST);
  });

  test('no page has an id twice', () => {
    for (const page of pages) {
      const seen = new Set();
      for (const id of ids(page)) {
        assert.ok(!seen.has(id), `${page || '/'} has id ${id} twice`);
        seen.add(id);
      }
    }
  });
  test('every link inside the site reaches a page and an anchor it has', () => {
    let checked = 0;
    for (const page of pages) {
      // Every link on the page (sidebar, header and table of contents too), read as the browser reads it:
      // same-page anchors and relative links included.
      const base = new URL(`${BASE}${page}/`.replace(/\/\/$/, '/'), ORIGIN);
      const decode = (part, raw) => {
        try {
          return decodeURIComponent(part);
        } catch {
          assert.fail(`${page}: ${raw} is not a valid address`);
        }
      };
      for (const { raw } of pageLinks(page)) {
        let url;
        try {
          url = new URL(raw, base);
        } catch {
          assert.fail(`${page}: ${raw} is not a valid address`);
        }
        if (url.origin !== ORIGIN) continue;
        const path = decode(url.pathname, raw);
        assert.ok(path.startsWith(BASE), `${page}: ${raw} is outside the base`);
        const target = path.slice(BASE.length).replace(/\/$/, '');
        assert.ok(existsSync(join(DIST, target, 'index.html')), `${page}: ${raw} has no page`);
        const hash = decode(url.hash.slice(1), raw);
        if (hash) assert.ok(ids(target).includes(hash), `${page}: ${raw} has no anchor`);
        checked++;
      }
    }
    assert.ok(checked > 50, `only ${checked} links checked`);
  });
  test('the test pages are all there', () => {
    assert.ok(pages.length > 10);
    for (const page of ['work/prose', 'work/handoff', 'work/plan', 'split/plan/part-a', 'split/plan/part-b', 'decisions/0001-first']) assert.ok(pages.includes(page), page);
  });
});
