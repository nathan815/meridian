'use strict';
(() => {
  const preferenceCore = globalThis.MeridianBreakPreferences || (typeof require !== 'undefined' ? require('./break-preferences.js') : null);
  const minute = 60000;
  const elapsed = milliseconds => {
    const total = Math.max(0, Math.floor(milliseconds / minute));
    const hours = Math.floor(total / 60), minutes = total % 60;
    return hours ? `${hours}h${minutes ? ` ${minutes}m` : ''}` : `${minutes}m`;
  };
  function model(state, now = Date.now(), preferences = preferenceCore.DEFAULTS) {
    if (!state?.active) return {stateLabel: 'Off the clock', detail: 'Clock in to start tracking work time.', tone: 'off', warning: ''};
    const shiftElapsed = elapsed(now - state.punchedInAt);
    if (state.mode === 'break') {
      return {stateLabel: 'On break', detail: `${elapsed(now - state.breakStartedAt)} away · ${shiftElapsed} shift`, tone: 'break', warning: ''};
    }
    const continuousMs = Math.max(0, now - (state.workStartedAt || state.punchedInAt));
    const selected = preferenceCore.normalize(preferences);
    const intervalMs = selected.intervalMinutes * minute;
    const warningAt = intervalMs - selected.warningLeadMinutes * minute;
    if (continuousMs >= intervalMs) return {
      stateLabel: 'On the clock',
      detail: `${shiftElapsed} · ${continuousMs === intervalMs ? 'Break due now' : `Break overdue by ${elapsed(continuousMs - intervalMs)}`}`,
      tone: 'overdue',
      warning: ''
    };
    if (selected.warningLeadMinutes > 0 && continuousMs >= warningAt) return {
      stateLabel: 'On the clock',
      detail: `${shiftElapsed} · Break due in ${Math.ceil((intervalMs - continuousMs) / minute)}m`,
      tone: 'nearing',
      warning: ''
    };
    return {stateLabel: 'On the clock', detail: `${shiftElapsed} · Break due in ${Math.ceil((intervalMs - continuousMs) / minute)}m`, tone: 'working', warning: ''};
  }
  const api = {model, elapsed};
  globalThis.MeridianBreakStatus = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
