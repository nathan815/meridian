'use strict';
const assert = require('node:assert/strict');
const {summarize, aggregateVisits, estimateBrowsingActivity} = require('./work-time-core.js');
const event = (id, type, at) => ({id, type, at: new Date(`2026-11-${at}:00`).toISOString()});
const events = [
  event('1', 'punch-in', '19T23:00'),
  event('2', 'break-start', '20T01:00'),
  event('3', 'break-end', '20T01:20'),
  event('4', 'punch-out', '20T03:00'),
  event('5', 'punch-in', '20T14:00')
];
const summary = summarize(events, new Date('2026-11-19T00:00:00').getTime(), new Date('2026-11-21T00:00:00').getTime(), new Date('2026-11-20T15:00:00').getTime());
assert.equal(summary.workMs, 4 * 60 * 60 * 1000 + 40 * 60 * 1000);
assert.equal(summary.breakMs, 20 * 60 * 1000);
assert.equal(summary.longestWorkMs, 2 * 60 * 60 * 1000);
assert.equal(summary.open, true);
assert.equal(summary.openMode, 'work');
assert.equal(summary.daily.length, 2, 'a shift crossing midnight should split into daily totals');
assert.equal(summary.daily[0].workMs, 60 * 60 * 1000);
assert.equal(summary.daily[1].workMs, 3 * 60 * 60 * 1000 + 40 * 60 * 1000);
const historical = summarize([
  event('x', 'punch-in', '19T23:00'),
  event('y', 'punch-out', '20T02:00')
], new Date('2026-11-19T00:00:00').getTime(), new Date('2026-11-20T00:00:00').getTime(), new Date('2026-11-20T12:00:00').getTime());
assert.equal(historical.open, false, 'a historical range should not call a later-closed shift open');
assert.deepEqual(aggregateVisits([
  new Date('2026-11-20T09:00:00').getTime(),
  new Date('2026-11-20T09:30:00').getTime(),
  new Date('2026-11-21T09:00:00').getTime()
], new Date('2026-11-20T00:00:00').getTime(), new Date('2026-11-21T00:00:00').getTime()), {'2026-11-20': 2});
const browsing = estimateBrowsingActivity([
  new Date('2026-11-20T09:00:00').getTime(),
  new Date('2026-11-20T09:00:00').getTime(),
  new Date('2026-11-20T09:03:00').getTime(),
  new Date('2026-11-20T09:08:00').getTime(),
  new Date('2026-11-20T09:20:00').getTime(),
  new Date('2026-11-20T09:22:00').getTime()
], new Date('2026-11-20T00:00:00').getTime(), new Date('2026-11-21T00:00:00').getTime());
assert.equal(browsing.visitCount, 5, 'duplicate visit timestamps should count once');
assert.equal(browsing.activeIntervalCount, 3, 'only gaps of five minutes or less should count');
assert.equal(browsing.estimatedMs, 10 * 60000, 'long gaps and time after the last visit should not be invented');
assert.deepEqual(browsing.daily['2026-11-20'], {visitCount: 5, estimatedMs: 10 * 60000});
const acrossMidnight = estimateBrowsingActivity([
  new Date('2026-11-20T23:58:00').getTime(),
  new Date('2026-11-21T00:02:00').getTime()
], new Date('2026-11-20T00:00:00').getTime(), new Date('2026-11-22T00:00:00').getTime());
assert.equal(acrossMidnight.daily['2026-11-20'].estimatedMs, 2 * 60000);
assert.equal(acrossMidnight.daily['2026-11-21'].estimatedMs, 2 * 60000);
console.log('Work-time intervals, browsing estimates, midnight splitting, breaks, and open shifts passed.');
