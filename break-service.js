'use strict';
(() => {
  const preferenceCore = globalThis.MeridianBreakPreferences || (typeof require !== 'undefined' ? require('./break-preferences.js') : null);
  const ALARM_NAME = 'meridian-break';
  const initialState = () => ({
    active: false,
    mode: 'off',
    punchedInAt: null,
    workStartedAt: null,
    lastBreakEndedAt: null,
    breakStartedAt: null,
    nextReminderAt: null,
    lastReminderAt: null
  });
  function createBreakService(api) {
    const preferences = async () => preferenceCore.normalize(await api.preferences.get());
    const intervalMs = value => value.intervalMinutes * 60000;
    const repeatMs = value => value.repeatMinutes * 60000;
    const nextDue = (state, selected) => state.lastReminderAt && state.lastReminderAt >= (state.workStartedAt || state.punchedInAt) ?
      state.lastReminderAt + repeatMs(selected) : (state.workStartedAt || state.punchedInAt) + intervalMs(selected);
    const read = async () => {
      const stored = await api.store.get();
      const state = initialState();
      for (const key of Object.keys(state)) {
        if (stored?.[key] !== undefined) state[key] = stored[key];
      }
      if (state.active && state.mode === 'off') state.mode = 'working';
      if (state.active && state.mode === 'working' && !state.workStartedAt) state.workStartedAt = state.lastBreakEndedAt || state.punchedInAt;
      return state;
    };
    const write = state => api.store.set(state);
    const record = type => api.ledger.append({id: api.id(), type, at: new Date(api.now()).toISOString()});
    async function schedule(state, when) {
      await api.alarms.clear(ALARM_NAME);
      await api.alarms.create(ALARM_NAME, {when});
      state.nextReminderAt = when;
      await write(state);
      return state;
    }
    async function punchIn() {
      const state = await read();
      if (state.active) return state;
      const now = api.now();
      await record('punch-in');
      Object.assign(state, initialState(), {active: true, mode: 'working', punchedInAt: now, workStartedAt: now});
      return schedule(state, now + intervalMs(await preferences()));
    }
    async function punchOut() {
      const current = await read();
      if (!current.active) return current;
      await record('punch-out');
      const state = initialState();
      await api.alarms.clear(ALARM_NAME);
      await write(state);
      return state;
    }
    async function takeBreak() {
      const state = await read();
      if (!state.active || state.mode !== 'working') return state;
      const now = api.now();
      await record('break-start');
      await api.alarms.clear(ALARM_NAME);
      Object.assign(state, {mode: 'break', breakStartedAt: now, workStartedAt: null, nextReminderAt: null});
      await write(state);
      return state;
    }
    async function takeBreakForReminder(reminder) {
      const state = await read();
      if (!state.active || state.mode !== 'working' ||
        state.punchedInAt !== reminder.punchedInAt ||
        state.workStartedAt !== reminder.workStartedAt ||
        state.lastReminderAt !== reminder.reminderAt) return false;
      await takeBreak();
      return true;
    }
    async function resume() {
      const state = await read();
      if (!state.active || state.mode !== 'break') return state;
      const now = api.now();
      await record('break-end');
      Object.assign(state, {mode: 'working', breakStartedAt: null, workStartedAt: now, lastBreakEndedAt: now, lastReminderAt: null});
      return schedule(state, now + intervalMs(await preferences()));
    }
    async function restore() {
      const state = await read();
      if (!state.active) {
        await api.alarms.clear(ALARM_NAME);
        return state;
      }
      if (state.mode === 'break') {
        await api.alarms.clear(ALARM_NAME);
        await write(state);
        return state;
      }
      const currentPreferences = await preferences();
      const when = Math.max(api.now() + 1000, nextDue(state, currentPreferences));
      return schedule(state, when);
    }
    async function updatePreferences(value) {
      const next = preferenceCore.validate(value);
      const previous = await preferences();
      await api.preferences.set(next);
      const state = await read();
      if (!state.active || state.mode === 'break') return state;
      const cadenceChanged = state.lastReminderAt && state.lastReminderAt >= (state.workStartedAt || state.punchedInAt) ?
        previous.repeatMinutes !== next.repeatMinutes : previous.intervalMinutes !== next.intervalMinutes;
      if (!cadenceChanged) return state;
      const due = nextDue(state, next);
      return schedule(state, Math.max(api.now() + 1000, due));
    }
    async function handleAlarm() {
      const state = await read();
      if (!state.active) {
        await api.alarms.clear(ALARM_NAME);
        return state;
      }
      if (state.mode === 'break') {
        await api.alarms.clear(ALARM_NAME);
        return state;
      }
      const now = api.now();
      if (state.nextReminderAt && now + 30000 < state.nextReminderAt) return state;
      state.lastReminderAt = now;
      const currentPreferences = await preferences();
      await schedule(state, now + repeatMs(currentPreferences));
      if (currentPreferences.notificationsEnabled) {
        await api.notify({
          punchedInAt: state.punchedInAt,
          workStartedAt: state.workStartedAt,
          reminderAt: state.lastReminderAt
        });
      }
      if (currentPreferences.soundEnabled) await api.playCue(currentPreferences.sound);
      return state;
    }
    return {ALARM_NAME, punchIn, punchOut, takeBreak, takeBreakForReminder, resume, restore, updatePreferences, handleAlarm, getStatus: read, getPreferences: preferences};
  }
  const api = {ALARM_NAME, createBreakService};
  globalThis.MeridianBreakService = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
