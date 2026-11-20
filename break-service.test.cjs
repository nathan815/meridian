'use strict';
const assert = require('node:assert/strict');
const {ONE_HOUR_MS, DEFER_GRACE_MS, meetingsFromSnapshot, deferralEnd} = require('./break-core.js');
const {DEFAULTS} = require('./break-preferences.js');
const {createBreakService} = require('./break-service.js');

const at = value => Date.parse(`2026-11-20T${value}:00.000Z`);
assert.equal(deferralEnd([
  {start: at('10:00'), end: at('11:00')},
  {start: at('11:00'), end: at('12:00')},
  {start: at('13:00'), end: at('13:30')}
], at('10:30')), at('12:00') + DEFER_GRACE_MS, 'back-to-back meetings should defer through the chain');
assert.deepEqual(meetingsFromSnapshot({agenda: {items: [
  {title: 'Planning', start: '2026-11-20T10:00:00Z', end: '2026-11-20T11:00:00Z'},
  {title: 'OOF', start: '2026-11-20T11:00:00Z', end: '2026-11-20T12:00:00Z'},
  {title: 'Holiday', allDay: true, start: '2026-11-20T00:00:00Z', end: '2026-11-21T00:00:00Z'}
]}}), [{start: at('10:00'), end: at('11:00')}], 'away and all-day events should not block reminders');

let now = at('09:00');
let stored;
let alarm;
let notifications = 0;
const notificationReminders = [];
let cues = 0;
const cueSounds = [];
let ids = 0;
let storedPreferences = structuredClone(DEFAULTS);
const ledger = [];
let snapshot = {agenda: {items: []}};
const api = {
  now: () => now,
  store: {
    get: async () => structuredClone(stored),
    set: async value => { stored = structuredClone(value); }
  },
  ledger: {append: async event => ledger.push(event)},
  preferences: {
    get: async () => structuredClone(storedPreferences),
    set: async value => { storedPreferences = structuredClone(value); }
  },
  id: () => `event-${++ids}`,
  alarms: {
    clear: async name => { if (alarm?.name === name) alarm = null; },
    create: async (name, info) => { alarm = {name, ...info}; }
  },
  calendar: {getSnapshot: async () => snapshot},
  notify: async reminder => { notifications++;notificationReminders.push(reminder); },
  playCue: async sound => { cues++;cueSounds.push(sound); }
};
const service = createBreakService(api);

(async () => {
  await service.punchIn();
  assert.equal(stored.active, true);
  assert.equal(stored.mode, 'working');
  assert.deepEqual(ledger.map(event => event.type), ['punch-in']);
  assert.equal(alarm.when, at('10:00'), 'punch-in should schedule the first reminder one hour later');
  assert.equal(notifications, 0, 'punch-in must not deliver immediately');

  snapshot = {agenda: {items: [
    {title: 'Review', start: '2026-11-20T10:00:00Z', end: '2026-11-20T11:00:00Z'},
    {title: 'Design', start: '2026-11-20T11:00:00Z', end: '2026-11-20T12:00:00Z'}
  ]}};
  now = at('10:00');
  await service.handleAlarm();
  assert.equal(notifications, 0);
  assert.equal(cues, 0);
  assert.equal(alarm.when, at('12:00') + DEFER_GRACE_MS, 'meeting reminder should move to the end of the meeting chain');

  now = alarm.when;
  await service.handleAlarm();
  assert.equal(notifications, 1, 'deferred reminder should deliver once');
  assert.equal(cues, 1, 'deferred reminder should play one cue');
  assert.equal(alarm.when, now + 10 * 60 * 1000, 'an overdue reminder should repeat at the configured cadence');

  await service.handleAlarm();
  assert.equal(notifications, 1, 'an early duplicate alarm should not redeliver');
  assert.equal(cues, 1);

  now = alarm.when;
  await service.handleAlarm();
  assert.equal(notifications, 2, 'an overdue reminder should repeat when no break was taken');
  assert.equal(cues, 2);
  assert.equal(alarm.when, now + 10 * 60 * 1000);
  const scheduledRepeat = alarm.when;
  await service.updatePreferences({...storedPreferences, sound: 'rising'});
  assert.equal(alarm.when, scheduledRepeat, 'changing delivery preferences should not move the reminder schedule');
  assert.equal((await service.getPreferences()).sound, 'rising', 'a newly selected sound should persist when settings are reopened');

  assert.equal(await service.takeBreakForReminder(notificationReminders[0]), false, 'an action from an older reminder should be ignored');
  assert.equal(stored.mode, 'working');
  assert.equal(await service.takeBreakForReminder(notificationReminders.at(-1)), true, 'the latest reminder action should begin the break');
  assert.equal(await service.takeBreakForReminder(notificationReminders.at(-1)), false, 'duplicate notification actions should be ignored');
  assert.equal(stored.mode, 'break');
  assert.equal(alarm, null, 'taking a break should suspend reminders');
  await service.updatePreferences({intervalMinutes: 45, warningLeadMinutes: 5, repeatMinutes: 7, soundEnabled: true, sound: 'bell', notificationsEnabled: false});
  now += 20 * 60 * 1000;
  await service.resume();
  assert.equal(stored.mode, 'working');
  assert.equal(alarm.when, now + 45 * 60 * 1000, 'resume should use the configured interval');
  assert.equal(await service.takeBreakForReminder(notificationReminders.at(-1)), false, 'a reminder action from before resume should stay stale');
  assert.equal(stored.mode, 'working');
  snapshot = {agenda: {items: []}};
  now = alarm.when;
  await service.handleAlarm();
  assert.equal(notifications, 2, 'disabled notifications should not be delivered');
  assert.equal(cues, 3, 'enabled sound should still be delivered independently');
  assert.equal(cueSounds.at(-1), 'bell', 'the selected sound should be delivered');
  assert.equal(alarm.when, now + 7 * 60 * 1000, 'custom overdue cadence should schedule the next follow-up');

  await service.punchOut();
  assert.equal(stored.active, false);
  assert.equal(alarm, null, 'punch-out should clear the alarm');
  await service.handleAlarm();
  assert.equal(notifications, 2, 'inactive shifts should ignore background alarms');
  assert.deepEqual(ledger.map(event => event.type), ['punch-in', 'break-start', 'break-end', 'punch-out']);

  stored = {active: true, mode: 'working', punchedInAt: at('08:00'), nextReminderAt: at('09:00')};
  now = at('13:00');
  await service.restore();
  assert.equal(alarm.when, now + 1000, 'a browser restart should restore one overdue reminder without replaying missed hours');
  console.log('Break scheduling, deferral, delivery, restart, and punch-out passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
