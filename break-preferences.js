'use strict';
(() => {
  const DEFAULTS = Object.freeze({
    intervalMinutes: 60,
    warningLeadMinutes: 10,
    repeatMinutes: 10,
    soundEnabled: true,
    sound: 'chime',
    notificationsEnabled: true
  });
  const SOUNDS = new Set(['chime', 'bell', 'pulse', 'woodblock', 'drop', 'rising']);
  function validate(value) {
    const keys = ['intervalMinutes', 'warningLeadMinutes', 'repeatMinutes', 'soundEnabled', 'sound', 'notificationsEnabled'];
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || !Object.keys(value).every(key => keys.includes(key)) ||
      !Number.isInteger(value.intervalMinutes) || value.intervalMinutes < 15 || value.intervalMinutes > 240 ||
      !Number.isInteger(value.warningLeadMinutes) || value.warningLeadMinutes < 0 ||
      value.warningLeadMinutes >= value.intervalMinutes ||
      !Number.isInteger(value.repeatMinutes) || value.repeatMinutes < 1 || value.repeatMinutes > 60 ||
      typeof value.soundEnabled !== 'boolean' || !SOUNDS.has(value.sound) ||
      typeof value.notificationsEnabled !== 'boolean') throw Error('The break reminder settings are invalid.');
    return structuredClone(value);
  }
  function normalize(value) {
    try {
      return validate(upgrade(value));
    } catch {
      return structuredClone(DEFAULTS);
    }
  }
  function upgrade(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || 'repeatMinutes' in value) return value;
    return {...value, repeatMinutes: DEFAULTS.repeatMinutes};
  }
  const api = {DEFAULTS, SOUNDS, validate, normalize, upgrade};
  globalThis.MeridianBreakPreferences = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
