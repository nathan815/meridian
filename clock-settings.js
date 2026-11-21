'use strict';
(() => {
  function move(clocks, from, to) {
    if (from === to || from < 0 || to < 0 || from >= clocks.length || to >= clocks.length) return clocks;
    const updated = clocks.map(clock => [...clock]);
    updated.splice(to, 0, updated.splice(from, 1)[0]);
    return updated;
  }

  function rename(clocks, index, name) {
    const updatedName = name.trim();
    if (!updatedName || !clocks[index]) return clocks;
    return clocks.map((clock, current) => current === index ? [updatedName, clock[1]] : [...clock]);
  }

  function primaryTimeZone(saved, clocks, fallback = 'America/New_York') {
    let value;
    try {
      value = JSON.parse(saved);
    } catch {}
    const timeZone = typeof value === 'string' ? value : Array.isArray(value) ? value[1] : null;
    return clocks.some(clock => clock[1] === timeZone) ? timeZone :
      clocks.find(clock => clock[1] === fallback)?.[1] || clocks[0]?.[1] || fallback;
  }

  function offset(timeZone, moment = new Date()) {
    const zonePart = new Intl.DateTimeFormat('en-US', {timeZone, timeZoneName: 'longOffset'})
      .formatToParts(moment).find(part => part.type === 'timeZoneName').value;
    return zonePart === 'GMT' ? 'UTC+00:00' : zonePart.replace('GMT', 'UTC');
  }

  const timeZoneNameCache = new Map();
  function formattedTimeZoneName(timeZone, timeZoneName, moment) {
    return new Intl.DateTimeFormat('en-US', {timeZone, timeZoneName})
      .formatToParts(moment).find(part => part.type === 'timeZoneName').value;
  }

  function timeZoneNames(timeZone, year = new Date().getFullYear()) {
    const key = `${timeZone}:${year}`;
    if (timeZoneNameCache.has(key)) return timeZoneNameCache.get(key);
    if (timeZone === 'UTC') {
      const details = {label: 'Coordinated Universal Time (UTC)', aliases: []};
      timeZoneNameCache.set(key, details);
      return details;
    }
    const winter = new Date(`${year}-01-15T12:00:00Z`);
    const summer = new Date(`${year}-07-15T12:00:00Z`);
    const generic = formattedTimeZoneName(timeZone, 'longGeneric', winter);
    const city = timeZone.split('/').at(-1).replaceAll('_', ' ');
    const label = generic.includes(city) ? generic : `${generic} (${city})`;
    const aliases = [...new Set([
      formattedTimeZoneName(timeZone, 'long', winter),
      formattedTimeZoneName(timeZone, 'short', winter),
      formattedTimeZoneName(timeZone, 'long', summer),
      formattedTimeZoneName(timeZone, 'short', summer)
    ])].filter(name => name !== generic && !/^(?:GMT|UTC)[+-]/.test(name));
    const details = {label, aliases};
    timeZoneNameCache.set(key, details);
    return details;
  }

  function timeZoneLabel(timeZone, moment = new Date()) {
    return timeZoneNames(timeZone, moment.getUTCFullYear()).label;
  }

  function timeZoneSuggestion(timeZone, moment = new Date()) {
    const {label, aliases} = timeZoneNames(timeZone, moment.getUTCFullYear());
    return [label, ...aliases, offset(timeZone, moment)].join(' · ');
  }

  const api = {move, rename, primaryTimeZone, offset, timeZoneLabel, timeZoneSuggestion};
  globalThis.MeridianClockSettings = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
