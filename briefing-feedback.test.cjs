'use strict';
const assert=require('node:assert/strict');
const feedback=require('./briefing-feedback.js');

const items=[{id:'first'},{id:'new-priority'},{id:'second'}];
const dismissed=feedback.dismiss(null,'second','not-mine','Wrong owner.',new Date('2026-01-02T03:04:05Z'));
assert.deepEqual(feedback.apply(items,dismissed).map(item=>item.id),['first','new-priority']);
assert.deepEqual(feedback.order(items,['second','first']).map(item=>item.id),['second','new-priority','first']);
assert.deepEqual(feedback.order(items,['missing','second','second','first']).map(item=>item.id),['second','new-priority','first']);
assert.equal(feedback.normalize(dismissed).dismissals[0].detail,'Wrong owner.');
assert.throws(()=>feedback.dismiss(null,'first','unsupported'),/reason/i);
console.log('Briefing feedback dismissal and ordering passed.');
