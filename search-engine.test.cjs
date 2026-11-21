'use strict';
const assert = require('node:assert/strict');
const searchEngine = require('./search-engine.js');

assert.deepEqual(searchEngine.normalize(null), {engine: 'google', customTemplate: ''});
assert.equal(searchEngine.searchUrl(null, 'weather tomorrow'), 'https://www.google.com/search?q=weather+tomorrow');

const bing = searchEngine.normalize({engine: 'bing', customTemplate: ''});
assert.equal(searchEngine.searchUrl(bing, 'weather tomorrow'), 'https://www.bing.com/search?q=weather+tomorrow');

const customTemplate = 'https://search.example.com/find?q={query}&category=all';
const custom = searchEngine.normalize({engine: 'custom', customTemplate});
const specialQuery = 'C# arrays & maps / 100%?';
const customUrl = new URL(searchEngine.searchUrl(custom, specialQuery));
assert.equal(customUrl.origin, 'https://search.example.com');
assert.equal(customUrl.searchParams.get('q'), specialQuery);
assert.equal(customUrl.searchParams.get('category'), 'all');

for (const invalid of [
  'javascript:alert({query})',
  'https://user:password@example.com/?q={query}',
  'https://example.com/#q={query}',
  'https://example.com/search',
  'https://{query}.example.com/'
]) {
  assert.equal(searchEngine.validCustomTemplate(invalid), false, invalid);
}
assert.deepEqual(
  searchEngine.normalize({engine: 'custom', customTemplate: 'https://example.com/search'}),
  {engine: 'google', customTemplate: ''}
);

console.log('Search engine defaults, saved choices, and custom query encoding passed.');
