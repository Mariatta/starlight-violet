/** A handoff's header: its questions, their fields and its next steps. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BASE, between, main } from './helpers.mjs';

// Addresses in raw HTML carry the test site's base.
const B = BASE.replace(/\/$/, '');

const header = () => between(main('work/handoff'), 'class="handoff-header"', 'id="summary"');
const row = (id) => between(header(), `<tr id="${id}"`, '</tr>');
const steps = () => between(header(), '<ol class="sl-steps"', '</ol>');

describe('open questions', () => {
  test('each question has a row with its id as the anchor', () => {
    for (const id of ['q3', 'q4', 'q9']) row(id);
  });
  test('references in a question link', () => assert.match(row('q3'), new RegExp(`<a href="${B}/work/spec/#32-exports">SPEC 3\\.2</a>`)));
  test('blocks render inline Markdown, links, and raw HTML as text', () => {
    const cell = row('q3');
    assert.match(cell, new RegExp(`Stage <a href="${B}/work/plan/#stage-1">1</a>`));
    assert.match(cell, /<code>&lt;id&gt;<\/code>/);
    assert.match(cell, /&lt;b&gt;bold&lt;\/b&gt;/);
  });
  test('an answer links its references', () => assert.match(row('q4'), new RegExp(`decision <a href="${B}/decisions/0001-first/">0001</a>`)));
});

describe('next steps', () => {
  test('are numbered like Starlight steps, one paragraph each', () => {
    assert.match(steps(), /^<ol class="sl-steps" role="list">/);
    assert.equal(steps().match(/<li><p>/g)?.length, 3);
  });
  test('render code spans', () => assert.match(steps(), /Run <code>make test<\/code> on <code>main<\/code>/));
  test('link references', () =>
    assert.match(steps(), new RegExp(`Settle <a href="${B}/work/handoff/#q3">Q3</a> to <a href="${B}/work/handoff/#q9">Q9</a>`)));
  test('a step starting "1." stays a sentence, not a list', () => {
    assert.match(steps(), /<p>1\. Follow decision/);
    assert.doesNotMatch(steps(), /<li><p><ol/);
  });
});
