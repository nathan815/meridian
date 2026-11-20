'use strict';
(() => {
  const eventTypes = new Set(['punch-in', 'break-start', 'break-end', 'punch-out']);
  function validEvent(event) {
    return event && typeof event.id === 'string' && event.id.length > 0 && eventTypes.has(event.type) &&
      typeof event.at === 'string' && Number.isFinite(Date.parse(event.at));
  }
  function segments(events, rangeStart, rangeEnd, now = Date.now()) {
    const endLimit = Math.min(rangeEnd, now);
    const result = [];
    let mode = 'off', startedAt = null;
    const close = at => {
      if (mode === 'off' || startedAt === null || at <= startedAt) return;
      const start = Math.max(startedAt, rangeStart), end = Math.min(at, endLimit);
      if (end > start) result.push({type: mode, start, end});
    };
    for (const event of events.filter(validEvent).sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
      const at = Date.parse(event.at);
      if (at > now) break;
      if (event.type === 'punch-in' && mode === 'off') {
        mode = 'work';startedAt = at;
      } else if (event.type === 'break-start' && mode === 'work') {
        close(at);mode = 'break';startedAt = at;
      } else if (event.type === 'break-end' && mode === 'break') {
        close(at);mode = 'work';startedAt = at;
      } else if (event.type === 'punch-out' && mode !== 'off') {
        close(at);mode = 'off';startedAt = null;
      }
    }
    const open = mode !== 'off' && startedAt < rangeEnd && now > rangeStart;
    if (open) close(now);
    return {segments: result, open, openMode: open ? mode : null};
  }
  function nextMidnight(timestamp) {
    const date = new Date(timestamp);
    date.setHours(24, 0, 0, 0);
    return date.getTime();
  }
  function dateKey(timestamp) {
    const date = new Date(timestamp), offset = date.getTimezoneOffset() * 60000;
    return new Date(timestamp - offset).toISOString().slice(0, 10);
  }
  function summarize(events, rangeStart, rangeEnd, now = Date.now()) {
    const built = segments(events, rangeStart, rangeEnd, now);
    const days = new Map();
    let longestWork = 0;
    for (const segment of built.segments) {
      if (segment.type === 'work') longestWork = Math.max(longestWork, segment.end - segment.start);
      let cursor = segment.start;
      while (cursor < segment.end) {
        const end = Math.min(segment.end, nextMidnight(cursor));
        const key = dateKey(cursor);
        const day = days.get(key) || {date: key, workMs: 0, breakMs: 0};
        day[segment.type === 'work' ? 'workMs' : 'breakMs'] += end - cursor;
        days.set(key, day);
        cursor = end;
      }
    }
    const daily = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
    return {
      daily,
      workMs: daily.reduce((sum, day) => sum + day.workMs, 0),
      breakMs: daily.reduce((sum, day) => sum + day.breakMs, 0),
      longestWorkMs: longestWork,
      open: built.open,
      openMode: built.openMode
    };
  }
  function aggregateVisits(visitTimes, rangeStart, rangeEnd) {
    const counts = {};
    for (const [key, activity] of Object.entries(estimateBrowsingActivity(visitTimes, rangeStart, rangeEnd).daily)) {
      counts[key] = activity.visitCount;
    }
    return counts;
  }
  function estimateBrowsingActivity(visitTimes, rangeStart, rangeEnd, maxGapMs = 5 * 60000) {
    const sorted = [...new Set(visitTimes.filter(visitTime =>
      Number.isFinite(visitTime) && visitTime >= rangeStart && visitTime < rangeEnd
    ))].sort((a, b) => a - b);
    const daily = {};
    for (const visitTime of sorted) {
      const key = dateKey(visitTime);
      daily[key] ||= {visitCount: 0, estimatedMs: 0};
      daily[key].visitCount += 1;
    }
    let estimatedMs = 0, activeIntervalCount = 0;
    for (let index = 1; index < sorted.length; index += 1) {
      const start = sorted[index - 1], end = sorted[index], gap = end - start;
      if (gap <= 0 || gap > maxGapMs) continue;
      estimatedMs += gap;
      activeIntervalCount += 1;
      let cursor = start;
      while (cursor < end) {
        const segmentEnd = Math.min(end, nextMidnight(cursor));
        const key = dateKey(cursor);
        daily[key] ||= {visitCount: 0, estimatedMs: 0};
        daily[key].estimatedMs += segmentEnd - cursor;
        cursor = segmentEnd;
      }
    }
    return {daily, visitCount: sorted.length, estimatedMs, activeIntervalCount, maxGapMs};
  }
  const api = {eventTypes, validEvent, segments, summarize, dateKey, aggregateVisits, estimateBrowsingActivity};
  globalThis.MeridianWorkTimeCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
