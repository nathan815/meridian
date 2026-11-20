'use strict';
const assert = require('node:assert/strict');

class MemoryStorage {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

global.MeridianWorkTimeCore = require('./work-time-core.js');
global.MeridianBreakPreferences = require('./break-preferences.js');
global.localStorage = new MemoryStorage({
  'meridian.pins': JSON.stringify([['Docs', 'https://learn.microsoft.com/']]),
  'meridian.clocks': JSON.stringify([['Eastern', 'America/New_York'], ['UTC', 'UTC']]),
  'meridian.primaryClock': JSON.stringify(['UTC', 'UTC']),
  'meridian.theme': 'dark',
  'meridian.solarSchedule': JSON.stringify(['07:30', '19:15']),
  'meridian.art': 'postcard-2026-11-20',
  'meridian.recipes': JSON.stringify([{
    id: 'postcard-2026-11-20',
    kind: 'postcard',
    date: '2026-11-20',
    hue: 143,
    seed: 143,
    meetings: Array.from({length: 24}, (_, hour) => hour === 14 ? 60 : 0)
  }])
});

const backup = require('./backup.js');
const workTime = [
  {id: 'punch-1', type: 'punch-in', at: '2026-11-20T14:00:00.000Z'},
  {id: 'punch-2', type: 'punch-out', at: '2026-11-20T22:00:00.000Z'}
];
const breakPreferences = {intervalMinutes: 45, warningLeadMinutes: 5, repeatMinutes: 7, soundEnabled: false, sound: 'rising', notificationsEnabled: true};
const fixture = backup.exportPayload(workTime, breakPreferences);
const validated = backup.validate(JSON.parse(JSON.stringify(fixture)));
const legacy = JSON.parse(JSON.stringify(fixture));
legacy.version = 1;
delete legacy.data.workTime;
delete legacy.data.solarSchedule;
delete legacy.data.breakPreferences;
assert.deepEqual(backup.validate(legacy).workTime, [], 'version 1 backups should import without starting or inventing work records');
assert.deepEqual(backup.validate(legacy).solarSchedule, ['06:00', '18:00'], 'legacy backups should use the default fixed schedule');
const versionTwo = JSON.parse(JSON.stringify(fixture));
versionTwo.version = 2;
delete versionTwo.data.solarSchedule;
delete versionTwo.data.breakPreferences;
assert.deepEqual(backup.validate(versionTwo).solarSchedule, ['06:00', '18:00'], 'version 2 backups should use the default fixed schedule');
const versionThree = JSON.parse(JSON.stringify(fixture));
versionThree.version = 3;
delete versionThree.data.breakPreferences;
assert.deepEqual(backup.validate(versionThree).breakPreferences, MeridianBreakPreferences.DEFAULTS, 'version 3 backups should use default break settings');
const versionFour = JSON.parse(JSON.stringify(fixture));
versionFour.version = 4;
delete versionFour.data.breakPreferences.repeatMinutes;
assert.deepEqual(backup.validate(versionFour).breakPreferences, {...breakPreferences, repeatMinutes: 10}, 'version 4 backups should preserve settings and add the default overdue cadence');

global.localStorage = new MemoryStorage();
backup.replace(validated);
assert.deepEqual(backup.exportPayload(validated.workTime, validated.breakPreferences).data, fixture.data, 'fresh-profile round trip should preserve exported data');

const before = backup.exportPayload(validated.workTime, validated.breakPreferences).data;
const invalid = JSON.parse(JSON.stringify(fixture));
invalid.data.pins[0][1] = 'javascript:alert(1)';
assert.throws(() => backup.validate(invalid), /pinned sites/i);
assert.deepEqual(backup.exportPayload(validated.workTime, validated.breakPreferences).data, before, 'invalid import should not mutate storage');
const invalidBreaks = JSON.parse(JSON.stringify(fixture));
invalidBreaks.data.breakPreferences.warningLeadMinutes = invalidBreaks.data.breakPreferences.intervalMinutes;
assert.throws(() => backup.validate(invalidBreaks), /break reminder settings/i);

console.log('Backup round trip and invalid-import isolation passed.');
