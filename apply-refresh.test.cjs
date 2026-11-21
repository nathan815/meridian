'use strict';
const assert=require('node:assert/strict');
const {mergeItems,applyFeedback}=require('./apply-refresh.cjs');

const previous=[
  {id:'older',title:'Older'},
  {id:'ranked',title:'Old title'},
  {id:'omitted',title:'Keep history'}
];
const proposed=[
  {id:'new-priority',title:'New priority'},
  {id:'ranked',title:'Updated title'}
];
const merged=mergeItems(previous,proposed);
assert.deepEqual(merged.map(item=>item.id),['new-priority','ranked','older','omitted']);
assert.equal(merged[1].title,'Updated title');
const snapshot={art:{actions:4},actions:{focus:'Potentially stale',items:merged}};
applyFeedback(snapshot,{version:1,updatedAt:'2026-01-02T03:04:05Z',dismissals:[{id:'ranked',reason:'incorrect',dismissedAt:'2026-01-02T03:04:05Z'}]});
assert.deepEqual(snapshot.actions.items.map(item=>item.id),['new-priority','older','omitted']);
assert.equal(snapshot.actions.focus,undefined);
assert.equal(snapshot.art.actions,3);
console.log('Briefing refresh priority and feedback filtering passed.');
