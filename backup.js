'use strict';
(() => {
  const VERSION = 6;
  const breakPreferenceCore = globalThis.MeridianBreakPreferences || (typeof require !== 'undefined' ? require('./break-preferences.js') : null);
  const PREFIX = 'meridian.';
  const DEFAULT_PINS = [['GitHub', 'https://github.com/'], ['Outlook', 'https://outlook.office.com/'], ['Teams', 'https://teams.microsoft.com/'], ['Microsoft Learn', 'https://learn.microsoft.com/']];
  const DEFAULT_CLOCKS = [['Eastern', 'America/New_York'], ['Pacific', 'America/Los_Angeles'], ['India', 'Asia/Kolkata'], ['UTC', 'UTC']];
  const BUILTIN_ART = new Set(['daily', 'contours', 'orbits', 'loom', 'ribbons', 'glass', 'rosette']);
  const DEFAULT_SOLAR_SCHEDULE = ['06:00', '18:00'];
  const exactKeys = (value, allowed) => Object.keys(value).every(key => allowed.includes(key));
  const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
  const validSolarSchedule = value => Array.isArray(value) && value.length === 2 &&
    value.every(item => typeof item === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(item)) && value[0] !== value[1];
  const pairList = (value, validValue) => Array.isArray(value) && value.length <= 100 && value.every(item =>
    Array.isArray(item) && item.length === 2 && text(item[0], 45) && validValue(item[1]));
  const validUrl = value => {
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.href === value;
    } catch {
      return false;
    }
  };
  const validZone = value => {
    if (!text(value, 100)) return false;
    try {
      new Intl.DateTimeFormat('en', {timeZone: value});
      return true;
    } catch {
      return false;
    }
  };
  function validRecipe(recipe) {
    if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return false;
    if (!exactKeys(recipe, ['id', 'kind', 'hue', 'seed', 'density', 'date', 'meetings'])) return false;
    if (!text(recipe.id, 100) || !text(recipe.kind, 20)) return false;
    if (recipe.kind === 'postcard') {
      return /^\d{4}-\d{2}-\d{2}$/.test(recipe.date) &&
        Number.isInteger(recipe.hue) && recipe.hue >= 0 && recipe.hue < 360 &&
        Number.isInteger(recipe.seed) && recipe.seed >= 0 && recipe.seed < 360 &&
        Array.isArray(recipe.meetings) && recipe.meetings.length === 24 &&
        recipe.meetings.every(value => Number.isInteger(value) && value >= 0 && value <= 60);
    }
    return ['contours', 'orbits', 'loom', 'ribbons', 'glass', 'rosette'].includes(recipe.kind) &&
      [recipe.hue, recipe.seed, recipe.density].every(Number.isInteger) &&
      recipe.hue >= 0 && recipe.hue < 360 && recipe.seed >= 0 && recipe.seed < 360 &&
      recipe.density >= 3 && recipe.density <= 12;
  }
  function validate(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      !exactKeys(payload, ['format', 'version', 'exportedAt', 'data']) ||
      payload.format !== 'meridian-backup' || ![1, 2, 3, 4, 5, VERSION].includes(payload.version) ||
      !Number.isFinite(Date.parse(payload.exportedAt))) throw Error('This is not a supported Meridian backup.');
    const data = payload.data;
    const allowedKeys = ['pins', 'clocks', 'primaryClock', 'theme', 'art', 'recipes'];
    if (payload.version >= 2) allowedKeys.push('workTime');
    if (payload.version >= 3) allowedKeys.push('solarSchedule');
    if (payload.version >= 4) allowedKeys.push('breakPreferences');
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !exactKeys(data, allowedKeys)) throw Error('The backup contains unsupported data.');
    if (!pairList(data.pins, validUrl)) throw Error('The pinned sites are invalid.');
    if (!pairList(data.clocks, validZone)) throw Error('The world clocks are invalid.');
    let primaryClock = null;
    if (data.primaryClock !== null) {
      if (payload.version >= 6) {
        if (!validZone(data.primaryClock) || !data.clocks.some(clock => clock[1] === data.primaryClock)) {
          throw Error('The primary clock is invalid.');
        }
        primaryClock = data.primaryClock;
      } else {
        if (!Array.isArray(data.primaryClock) || data.primaryClock.length !== 2 ||
          !text(data.primaryClock[0], 45) || !validZone(data.primaryClock[1]) ||
          !data.clocks.some(clock => JSON.stringify(clock) === JSON.stringify(data.primaryClock))) {
          throw Error('The primary clock is invalid.');
        }
        primaryClock = data.primaryClock[1];
      }
    }
    if (!['system', 'light', 'dark', 'solar'].includes(data.theme)) throw Error('The color mode is invalid.');
    if (!text(data.art, 100)) throw Error('The selected background is invalid.');
    if (!Array.isArray(data.recipes) || data.recipes.length > 100 || !data.recipes.every(validRecipe)) throw Error('The saved art is invalid.');
    const workTime = payload.version === 1 ? [] : data.workTime;
    if (!Array.isArray(workTime) || workTime.length > 50000 || !workTime.every(event =>
      event && typeof event === 'object' && !Array.isArray(event) && exactKeys(event, ['id', 'type', 'at']) &&
      text(event.id, 100) && MeridianWorkTimeCore.eventTypes.has(event.type) &&
      typeof event.at === 'string' && Number.isFinite(Date.parse(event.at)))) throw Error('The work-time records are invalid.');
    const solarSchedule = payload.version >= 3 ? data.solarSchedule : DEFAULT_SOLAR_SCHEDULE;
    if (!validSolarSchedule(solarSchedule)) throw Error('The fixed dawn and dusk schedule is invalid.');
    const breakPreferences = payload.version >= 4 ?
      breakPreferenceCore.validate(payload.version === 4 ? breakPreferenceCore.upgrade(data.breakPreferences) : data.breakPreferences) :
      structuredClone(breakPreferenceCore.DEFAULTS);
    const recipeIds = new Set(data.recipes.map(recipe => recipe.id));
    if (!BUILTIN_ART.has(data.art) && !recipeIds.has(data.art)) throw Error('The selected background is missing from saved art.');
    return structuredClone({...data, primaryClock, workTime, solarSchedule, breakPreferences});
  }
  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(PREFIX + key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }
  function exportPayload(workTime = [], breakPreferences = breakPreferenceCore.DEFAULTS) {
    const clocks = readJson('clocks', DEFAULT_CLOCKS);
    let primaryClock = null;
    try {
      const saved = JSON.parse(localStorage.getItem(PREFIX + 'primaryClock'));
      const timeZone = typeof saved === 'string' ? saved : Array.isArray(saved) ? saved[1] : null;
      if (clocks.some(clock => clock[1] === timeZone)) primaryClock = timeZone;
    } catch {}
    const solarSchedule = readJson('solarSchedule', DEFAULT_SOLAR_SCHEDULE);
    return {
      format: 'meridian-backup',
      version: VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        pins: readJson('pins', DEFAULT_PINS),
        clocks,
        primaryClock,
        theme: localStorage.getItem(PREFIX + 'theme') || 'system',
        art: localStorage.getItem(PREFIX + 'art') || 'daily',
        recipes: readJson('recipes', []),
        solarSchedule: validSolarSchedule(solarSchedule) ? solarSchedule : DEFAULT_SOLAR_SCHEDULE,
        breakPreferences: breakPreferenceCore.normalize(breakPreferences),
        workTime
      }
    };
  }
  function replace(data) {
    const values = {
      pins: JSON.stringify(data.pins),
      clocks: JSON.stringify(data.clocks),
      primaryClock: data.primaryClock ? JSON.stringify(data.primaryClock) : null,
      theme: data.theme,
      art: data.art,
      recipes: JSON.stringify(data.recipes),
      solarSchedule: JSON.stringify(data.solarSchedule)
    };
    const previous = Object.fromEntries(Object.keys(values).map(key => [key, localStorage.getItem(PREFIX + key)]));
    try {
      for (const [key, value] of Object.entries(values)) {
        if (value === null) localStorage.removeItem(PREFIX + key);
        else localStorage.setItem(PREFIX + key, value);
      }
    } catch (error) {
      for (const [key, value] of Object.entries(previous)) {
        if (value === null) localStorage.removeItem(PREFIX + key);
        else localStorage.setItem(PREFIX + key, value);
      }
      throw error;
    }
  }
  const api = {validate, exportPayload, replace};
  globalThis.MeridianBackup = api;
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;
  const $ = id => document.getElementById(id);
  let pending;
  $('exportData').onclick = async () => {
    let workTime = [];
    let breakPreferences = breakPreferenceCore.DEFAULTS;
    if (location.protocol === 'chrome-extension:' && chrome.storage?.local) {
      const stored = await chrome.storage.local.get(['meridian.workTime', 'meridian.breakPreferences']);
      if (Array.isArray(stored['meridian.workTime'])) workTime = stored['meridian.workTime'];
      breakPreferences = breakPreferenceCore.normalize(stored['meridian.breakPreferences']);
    }
    const blob = new Blob([JSON.stringify(exportPayload(workTime, breakPreferences), null, 2) + '\n'], {type: 'application/json'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `meridian-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  };
  $('importData').onclick = () => {
    $('settingsDetail').textContent = '';
    $('importFile').click();
  };
  $('importFile').onchange = async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      pending = validate(JSON.parse(await file.text()));
      const postcards = pending.recipes.filter(recipe => recipe.kind === 'postcard').length;
      const designs = pending.recipes.length - postcards;
      $('importSummary').textContent = `${pending.pins.length} pins · ${pending.clocks.length} clocks · ${designs} saved designs · ${postcards} postcards · ${pending.workTime.length} time records`;
      $('importPreview').showModal();
    } catch (error) {
      pending = null;
      $('settingsDetail').textContent = `Import not changed: ${error.message}`;
    }
  };
  $('cancelImport').onclick = () => {
    pending = null;
    $('importPreview').close();
  };
  $('importPreview').addEventListener('close', () => {
    pending = null;
  });
  $('confirmImport').onclick = async () => {
    if (!pending) return;
    let previous;
    try {
      let previousWorkTime = [];
      let previousBreakPreferences = breakPreferenceCore.DEFAULTS;
      if (location.protocol === 'chrome-extension:' && chrome.storage?.local) {
        const stored = await chrome.storage.local.get(['meridian.shift', 'meridian.workTime', 'meridian.breakPreferences']);
        if (stored['meridian.shift']?.active) {
          $('importSummary').textContent = 'Clock out before importing work-time records. Nothing changed.';
          return;
        }
        previousWorkTime = Array.isArray(stored['meridian.workTime']) ? stored['meridian.workTime'] : [];
        previousBreakPreferences = breakPreferenceCore.normalize(stored['meridian.breakPreferences']);
        await chrome.storage.local.set({
          'meridian.workTime': pending.workTime,
          'meridian.breakPreferences': pending.breakPreferences
        });
      }
      previous = exportPayload(previousWorkTime, previousBreakPreferences).data;
      replace(pending);
      pending = null;
      location.reload();
    } catch (error) {
      if (location.protocol === 'chrome-extension:' && chrome.storage?.local && previous) {
        await chrome.storage.local.set({
          'meridian.workTime': previous.workTime,
          'meridian.breakPreferences': previous.breakPreferences
        });
      }
      $('importSummary').textContent = `Nothing changed: ${error.message}`;
    }
  };
})();
