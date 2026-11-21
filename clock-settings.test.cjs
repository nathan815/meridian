'use strict';
const assert = require('node:assert/strict');
const clockSettings = require('./clock-settings.js');

const original = [
  ['Eastern', 'America/New_York'],
  ['Pacific', 'America/Los_Angeles'],
  ['UTC', 'UTC']
];
const renamed = clockSettings.rename(original, 1, 'West coast');
const reordered = clockSettings.move(renamed, 1, 0);

assert.deepEqual(reordered, [
  ['West coast', 'America/Los_Angeles'],
  ['Eastern', 'America/New_York'],
  ['UTC', 'UTC']
], 'rename and reorder should preserve each clock time-zone identity');
assert.equal(clockSettings.primaryTimeZone(JSON.stringify(['Pacific', 'America/Los_Angeles']), reordered),
  'America/Los_Angeles', 'legacy primary clock settings should survive a rename');
assert.equal(clockSettings.primaryTimeZone(JSON.stringify('America/Los_Angeles'), reordered),
  'America/Los_Angeles', 'primary clock identity should not depend on its label');
assert.deepEqual(original[1], ['Pacific', 'America/Los_Angeles'], 'clock edits should not mutate the input');
assert.equal(clockSettings.offset('America/New_York', new Date('2026-01-15T12:00:00Z')), 'UTC-05:00',
  'offsets should account for standard time');
assert.equal(clockSettings.offset('America/New_York', new Date('2026-07-15T12:00:00Z')), 'UTC-04:00',
  'offsets should account for daylight saving time');
assert.equal(clockSettings.offset('Asia/Kolkata', new Date('2026-07-15T12:00:00Z')), 'UTC+05:30',
  'offsets should preserve fractional hours');
assert.equal(clockSettings.timeZoneLabel('Asia/Kolkata'), 'India Standard Time (Kolkata)',
  'Kolkata should be discoverable using familiar India time-zone terms');
const easternSuggestion = clockSettings.timeZoneSuggestion('America/New_York', new Date('2026-01-15T12:00:00Z'));
assert.match(easternSuggestion, /Eastern Time \(New York\)/, 'suggestions should include a common generic name and city');
assert.match(easternSuggestion, /Eastern Standard Time/, 'standard names should remain searchable year-round');
assert.match(easternSuggestion, /Eastern Daylight Time/, 'daylight names should remain searchable year-round');
assert.match(easternSuggestion, /UTC-05:00/, 'suggestions should include the current offset');
const indiaSuggestion = clockSettings.timeZoneSuggestion('Asia/Kolkata', new Date('2026-07-15T12:00:00Z'));
assert.match(indiaSuggestion, /^India Standard Time \(Kolkata\)/, 'non-DST suggestions should use a friendly common name');
assert.match(indiaSuggestion, /UTC\+05:30$/, 'non-DST suggestions should retain their fractional offset');

console.log('World clock rename, reorder, and identity checks passed.');
