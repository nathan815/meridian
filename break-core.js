'use strict';
(() => {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const DEFER_GRACE_MS = 60 * 1000;
  const awayPattern = /\b(?:oof|dto|ooo|out[\s-]+of[\s-]+office)\b/i;
  function meetingsFromSnapshot(data) {
    const items = data?.agenda?.items;
    if (!Array.isArray(items)) throw Error('Calendar snapshot is unavailable.');
    return items.flatMap(event => {
      if (!event || event.allDay || awayPattern.test(event.title || '')) return [];
      const start = Date.parse(event.start), end = Date.parse(event.end);
      return Number.isFinite(start) && Number.isFinite(end) && end > start ? [{start, end}] : [];
    }).sort((a, b) => a.start - b.start);
  }
  function deferralEnd(meetings, now) {
    const active = meetings.filter(meeting => meeting.start <= now && meeting.end > now);
    if (!active.length) return null;
    let end = Math.max(...active.map(meeting => meeting.end));
    for (const meeting of meetings) {
      if (meeting.start > end) break;
      if (meeting.start <= end && meeting.end > end) end = meeting.end;
    }
    return end + DEFER_GRACE_MS;
  }
  const api = {ONE_HOUR_MS, DEFER_GRACE_MS, meetingsFromSnapshot, deferralEnd};
  globalThis.MeridianBreakCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
