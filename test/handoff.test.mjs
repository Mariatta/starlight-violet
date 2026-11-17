/** A handoff's header: its questions, their fields and its next steps. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { main } from './helpers.mjs';

const header = () => {
  const page = main('work/handoff');
  return page.slice(page.indexOf('handoff-header'), page.indexOf('id="summary"'));
};
const row = (id) => {
  const page = header();
  const start = page.indexOf(`<tr id="${id}"`);
  assert.ok(start >= 0, `no row ${id}`);
  return page.slice(start, page.indexOf('</tr>', start));
};

describe('open questions', () => {
  test('each question has a row with its id as the anchor', () => {
    for (const id of ['q3', 'q4', 'q9']) row(id);
  });
  test('references in a question link', () => assert.match(row('q3'), /<a href="\/work\/spec\/#32-exports">SPEC 3\.2<\/a>/));
  test('blocks render inline Markdown, links, and raw HTML as text', () => {
    const cell = row('q3');
    assert.match(cell, /Stage <a href="\/work\/plan\/#stage-1">1<\/a>/);
    assert.match(cell, /<code>&lt;id&gt;<\/code>/);
    assert.match(cell, /&lt;b&gt;bold&lt;\/b&gt;/);
  });
  test('an answer links its references', () => assert.match(row('q4'), /decision <a href="\/decisions\/0001-first\/">0001<\/a>/));
});

describe('next steps', () => {
  const steps = () => {
    const page = header();
    return page.slice(page.indexOf('<ol class="sl-steps"'), page.indexOf('</ol>', page.indexOf('<ol class="sl-steps"')));
  };
  test('are numbered like Starlight steps, one paragraph each', () => {
    assert.match(steps(), /^<ol class="sl-steps" role="list">/);
    assert.equal(steps().match(/<li><p>/g)?.length, 3);
  });
  test('render code spans', () => assert.match(steps(), /Run <code>make test<\/code> on <code>main<\/code>/));
  test('link references', () => assert.match(steps(), /Settle <a href="\/work\/handoff\/#q3">Q3<\/a> to <a href="\/work\/handoff\/#q9">Q9<\/a>/));
  test('a step starting "1." stays a sentence, not a list', () => {
    assert.match(steps(), /<p>1\. Follow decision/);
    assert.doesNotMatch(steps(), /<li><p><ol/);
  });
});
