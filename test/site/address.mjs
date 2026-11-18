// The test site's origin and base, read by its config and by the tests
// (test/helpers.mjs), so the two never drift apart. It has a base, as the
// docs site does, so a link that loses it fails; its origin is one no
// fixture links to.
export const ORIGIN = 'https://violet.test';
export const BASE = '/violet-tests/';
