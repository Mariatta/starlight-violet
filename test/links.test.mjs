/** References in a work folder's prose: what links, where to, and what stays text. */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { links, linksIn, main } from './helpers.mjs';

const PROSE = 'work/prose';
/** The links of a labelled sentence, as "text → address". */
const at = (label, page = PROSE) => linksIn(page, label).map(({ text, href }) => `${text} → ${href}`);

describe('questions', () => {
  test('Q3 links to its row on the folder handoff', () => assert.deepEqual(at('QA'), ['Q3 → /work/handoff/#q3']));
  test('Q3 to Q9 links both ends', () => assert.deepEqual(at('QB'), ['Q3 → /work/handoff/#q3', 'Q9 → /work/handoff/#q9']));
  test('a lowercase q4 links', () => assert.deepEqual(at('QC'), ['q4 → /work/handoff/#q4']));
  test('a lowercase q in an address or a name is not a question', () => assert.deepEqual(at('QF'), []));
  test('a capital Q is a question before a dash', () => assert.deepEqual(at('QG'), ['Q3 → /work/handoff/#q3', 'Q9 → /work/handoff/#q9']));
  test('a capital Q before a dot and more is a name, not a question', () => assert.deepEqual(at('QH'), []));
  test('a quarter is not a question', () => {
    assert.deepEqual(at('QD'), []);
    assert.deepEqual(at('QE'), []);
  });
});

describe('pages and sections', () => {
  test('a capitalised page of the folder links', () => assert.deepEqual(at('PA'), ['SPEC → /work/spec/']));
  test('SPEC 3.2 links its section', () => assert.deepEqual(at('PB'), ['SPEC 3.2 → /work/spec/#32-exports']));
  test('§6 and §6.4 each link their own section, never 6.1', () =>
    assert.deepEqual(at('PC'), ['SPEC §6 → /work/spec/#6-storage', '§6.4 → /work/spec/#64-retention']));
  test('section 6 and principle 2', () => {
    assert.deepEqual(at('PD'), ['SPEC section 6 → /work/spec/#6-storage']);
    assert.deepEqual(at('PE'), ['SPEC principle 2 → /work/spec/#principles']);
  });
  test('a page named with .md links', () => assert.deepEqual(at('PL'), ['PLAN.md → /work/plan/']));
  test('"§2 of SPEC" links the page only', () => assert.deepEqual(at('PF'), ['SPEC → /work/spec/']));
  test('a path, a longer name, README and a skipped page stay text', () => {
    for (const label of ['PG', 'PH', 'PI', 'PJ']) assert.deepEqual(at(label), [], label);
  });
  test('a length of time is not a section', () => assert.deepEqual(at('PK'), ['SPEC → /work/spec/']));
  test('a page naming itself is not linked, though its sections are', () =>
    assert.deepEqual(at('SF', 'work/spec'), ['SPEC 3.2 → /work/spec/#32-exports']));
  test('on the page itself, a section after one it lacks still links', () => assert.deepEqual(at('SG', 'work/spec'), ['§3.2 → /work/spec/#32-exports']));
  test('on a split page, its own name with a section links another part', () =>
    assert.deepEqual(at('GA', 'split/guide/3-testing'), ['GUIDE §6 → /split/guide/6-storage/']));
  test("on a split page, a part's own heading is its section, at the part", () => {
    assert.deepEqual(at('SC', 'split/notes'), ['GUIDE §3 → /split/guide/3-testing/']);
    assert.deepEqual(at('SD', 'split/notes'), ['GUIDE §6 → /split/guide/6-storage/']);
  });
  test('on a split page, a heading is anchored as its part renders it', () =>
    assert.deepEqual(at('SE', 'split/notes'), ['GUIDE §6.1 → /split/guide/6-storage/#61-buckets']));
});

describe('tasks and table rows', () => {
  test('Task 3 links its heading', () => assert.deepEqual(at('TA'), ['3 → /work/plan/#task-3-tell']));
  test('each task of a list links', () => assert.deepEqual(at('TB'), ['1 → /work/plan/#task-1-build', '2 → /work/plan/#task-2--ship']));
  test('task 1.2 links its table row', () => assert.deepEqual(at('TC'), ['1.2 → /work/plan/#task-1-2']));
  test('Task 3.2 with no row 3.2 links Task 3', () => assert.deepEqual(at('TD'), ['3 → /work/plan/#task-3-tell']));
  test('stages link their rows', () => {
    assert.deepEqual(at('TE'), ['1 → /work/plan/#stage-1']);
    assert.deepEqual(at('TF'), ['1 → /work/plan/#stage-1', '2 → /work/plan/#stage-2']);
  });
  test('in lower case, only a dotted number links', () => assert.deepEqual(at('TL'), []));
  test('a row numbered beside a footnote links', () => assert.deepEqual(at('TJ'), ['5 → /work/plan/#task-5']));
  test('a task the plan does not declare stays text, quoted and listed example headings included', () => assert.deepEqual(at('TK'), []));
  test('after "each", or before a count or a length of time, stays text', () => {
    for (const label of ['TG', 'TH', 'TI']) assert.deepEqual(at(label), [], label);
  });
});

describe('decisions', () => {
  test('decision 0001 links', () => assert.deepEqual(at('DA'), ['0001 → /decisions/0001-first/']));
});

describe('text already in a link or code', () => {
  test('a raw <a> keeps its text unlinked', () => assert.deepEqual(at('NA'), ['inside SPEC 3.2 → https://example.com']));
  test('emphasis inside a link is not linked again', () => assert.deepEqual(at('NB'), ['the SPEC 3.2 → https://example.com']));
  test('code stays code', () => assert.deepEqual(at('NC'), []));
  test('no anchor is nested in another', () => assert.doesNotMatch(main(PROSE), /<a\s[^>]*>(?:(?!<\/a>).)*<a\s/s));
});

describe('outside a work folder', () => {
  test('Q3, SPEC and Task 3 stay text', () => assert.deepEqual(links('plain/outside'), []));
});
