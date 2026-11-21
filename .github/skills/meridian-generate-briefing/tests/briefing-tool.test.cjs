'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {applyFeedback, applyPatch, validateBriefing, writeAtomic} = require('../scripts/briefing-core.cjs');

const base = {
  updated: '2026-11-20T12:00:00.000Z',
  actions: {
    generatedAt: '2026-11-20T12:00:00.000Z',
    focus: 'Ship the safe refresh path.',
    items: [
      {id: 'action-open', title: 'Review the patch', source: 'Synthetic fixture'},
      {id: 'action-done', title: 'Write the proposal', source: 'Synthetic fixture', completion: {reason: 'Merged', source: 'Synthetic receipt', date: '2026-11-20T11:00:00.000Z'}}
    ]
  },
  agenda: {items: [{title: 'Planning', start: '2026-11-20T15:00:00.000Z', end: '2026-11-20T15:30:00.000Z'}]},
  prs: {items: [{id: 42, title: 'Scoped briefing updates', url: 'https://example.test/pull/42', role: 'Yours'}]}
};

const patch = {
  actions: {
    focus: 'Validate the refresh path.',
    items: [
      {id: 'action-new', title: 'Document the agent interface', source: 'Synthetic fixture'},
      {id: 'action-open', title: 'Review the validated patch', source: 'Synthetic fixture'},
      {id: 'action-done', title: 'Do not replace history', source: 'Synthetic fixture'}
    ]
  }
};
const next = applyPatch(base, patch, '2026-11-20T13:00:00.000Z');
assert.deepEqual(next.agenda, base.agenda, 'an actions patch should preserve untouched sections');
assert.deepEqual(next.prs, base.prs, 'an actions patch should preserve untouched sections');
assert.equal(next.actions.items.find(item => item.id === 'action-open').title, 'Review the validated patch');
assert.deepEqual(next.actions.items.find(item => item.id === 'action-done'), base.actions.items[1], 'completed actions should retain their history');
assert.equal(next.actions.items.find(item => item.id === 'action-new').title, 'Document the agent interface');
assert.equal(next.actions.generatedAt, '2026-11-20T13:00:00.000Z');
assert.deepEqual(next.actions.items.map(item => item.id), ['action-new', 'action-open', 'action-done'], 'the proposed order should set action priority');

const dismissed = applyFeedback(structuredClone(next), {
  dismissals: [{id: 'action-open', reason: 'incorrect', dismissedAt: '2026-11-20T13:05:00.000Z'}]
});
assert.deepEqual(dismissed.actions.items.map(item => item.id), ['action-new', 'action-done']);
assert.equal(dismissed.actions.focus, undefined, 'filtering a dismissed action should clear potentially stale focus text');

const failed = structuredClone(base);
assert.throws(() => applyPatch(failed, {agenda: {items: [{title: 'Broken', start: 'not-a-date', end: 'also-broken'}]}}), /valid start and end dates/);
assert.deepEqual(failed, base, 'invalid patches should not mutate the current briefing');

const warning = applyPatch(base, {actions: {note: 'Source unavailable', items: []}}, '2026-11-20T14:00:00.000Z');
assert.equal(warning.actions.generatedAt, base.actions.generatedAt, 'failed refreshes should retain the last successful action generation time');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-briefing-'));
const destination = path.join(directory, 'briefing.json');
writeAtomic(destination, validateBriefing(next));
assert.deepEqual(JSON.parse(fs.readFileSync(destination, 'utf8')), next, 'atomic writes should persist the validated snapshot');
fs.rmSync(directory, {recursive: true});

console.log('Briefing scoped update validation passed.');
