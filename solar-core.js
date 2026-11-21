'use strict';
(() => {
  const radians = Math.PI / 180;
  const civilTwilightThreshold = Math.sin(-6 * radians);
  const daylightThreshold = 0;
  const exactLocations = {
    'America/New_York': [40.7128, -74.006],
    'America/Los_Angeles': [34.0522, -118.2437],
    'Asia/Kolkata': [22.5726, 88.3639],
    UTC: [51.4779, 0]
  };
  const regionalLatitudes = {
    Africa: 5,
    America: 38,
    Antarctica: -75,
    Arctic: 70,
    Asia: 30,
    Atlantic: 35,
    Australia: -30,
    Europe: 50,
    Indian: -20,
    Pacific: -15
  };
  function solarElevation(now, [lat, lon]) {
    const year = now.getUTCFullYear(), start = Date.UTC(year, 0, 1);
    const cycle = 2 * Math.PI * (now - start - 43200000) / (Date.UTC(year + 1, 0, 1) - start);
    const equationOfTime = 229.18 * (.000075 + .001868 * Math.cos(cycle) - .032077 * Math.sin(cycle) - .014615 * Math.cos(2 * cycle) - .040849 * Math.sin(2 * cycle));
    const declination = .006918 - .399912 * Math.cos(cycle) + .070257 * Math.sin(cycle) - .006758 * Math.cos(2 * cycle) + .000907 * Math.sin(2 * cycle) - .002697 * Math.cos(3 * cycle) + .00148 * Math.sin(3 * cycle);
    const hourAngle = (now.getUTCHours() * 60 + now.getUTCMinutes() + equationOfTime + 4 * lon) / 4 - 180;
    return Math.sin(radians * lat) * Math.sin(declination) + Math.cos(radians * lat) * Math.cos(declination) * Math.cos(radians * hourAngle);
  }
  function timeZoneOffsetHours(now, timeZone) {
    const label = new Intl.DateTimeFormat('en-US', {timeZone, timeZoneName: 'longOffset'}).formatToParts(now).find(part => part.type === 'timeZoneName')?.value;
    if (!label || label === 'GMT') return 0;
    const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(label);
    if (!match) return 0;
    return (match[1] === '-' ? -1 : 1) * (Number(match[2]) + Number(match[3]) / 60);
  }
  function representativeCoordinates(timeZone, now = new Date()) {
    if (exactLocations[timeZone]) return exactLocations[timeZone];
    const latitude = regionalLatitudes[timeZone.split('/')[0]] ?? 0;
    return [latitude, timeZoneOffsetHours(now, timeZone) * 15];
  }
  function solarState(now, coordinates) {
    const elevation = solarElevation(now, coordinates);
    const rising = solarElevation(new Date(now.getTime() + 5 * 60000), coordinates) > elevation;
    const phase = elevation >= daylightThreshold ? 'daylight' : elevation >= civilTwilightThreshold ? (rising ? 'dawn' : 'dusk') : 'night';
    return {phase, elevation, rising};
  }
  const api = {civilTwilightThreshold, solarElevation, representativeCoordinates, solarState};
  globalThis.MeridianSolar = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
