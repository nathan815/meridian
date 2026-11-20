'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const media = matchMedia('(prefers-color-scheme: dark)');
  const theme = localStorage.getItem('meridian.theme') || 'system';
  document.documentElement.dataset.tone = theme === 'dark' || theme === 'solar' && (new Date().getHours() < 6 || new Date().getHours() >= 18) || theme === 'system' && media.matches ? 'dark' : 'light';
  const localDate = date => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date - offset).toISOString().slice(0, 10);
  };
  const start = new Date();start.setHours(0, 0, 0, 0);start.setDate(start.getDate() - 6);
  $('rangeStart').value = localDate(start);
  $('rangeEnd').value = localDate(new Date());
  let events = [], summary, browserActivity;
  const duration = milliseconds => {
    const minutes = Math.round(milliseconds / 60000), hours = Math.floor(minutes / 60), remainder = minutes % 60;
    return hours ? `${hours}h ${remainder ? remainder + 'm' : ''}`.trim() : `${remainder}m`;
  };
  const range = () => {
    const from = new Date($('rangeStart').value + 'T00:00:00');
    const through = new Date($('rangeEnd').value + 'T00:00:00');through.setDate(through.getDate() + 1);
    return {start: from.getTime(), end: through.getTime()};
  };
  const eventLabels = {'punch-in': 'Punched in', 'break-start': 'Started a break', 'break-end': 'Resumed work', 'punch-out': 'Punched out'};
  function render() {
    const selected = range();
    if (!Number.isFinite(selected.start) || !Number.isFinite(selected.end) || selected.end <= selected.start) return;
    summary = MeridianWorkTimeCore.summarize(events, selected.start, selected.end);
    const days = Math.round((selected.end - selected.start) / 86400000);
    $('workLabel').textContent = days === 7 ? '7-day net work' : 'Selected net work';
    $('workTotal').textContent = duration(summary.workMs);
    $('breakTotal').textContent = duration(summary.breakMs);
    $('longestTotal').textContent = duration(summary.longestWorkMs);
    $('insight').textContent = summary.workMs === 0 ? 'No recorded work time in this range yet.' :
      summary.longestWorkMs >= 60 * 60000 ? 'At least one uninterrupted work stretch passed the one-hour break goal.' :
      'Recorded work stretches stayed within the one-hour break goal.';
    $('openNotice').hidden = !summary.open;
    $('openNotice').textContent = summary.open ? `An open ${summary.openMode === 'break' ? 'break' : 'shift'} is counted through the current time.` : '';
    const visitMax = browserActivity ? Math.max(1, ...Object.values(browserActivity.daily).map(day => day.visitCount)) : 1;
    const totalsByDate = new Map(summary.daily.map(day => [day.date, day]));
    const allDays = [];
    for (const cursor = new Date(selected.start); cursor < selected.end; cursor.setDate(cursor.getDate() + 1)) {
      const date = localDate(cursor);
      allDays.push(totalsByDate.get(date) || {date, workMs: 0, breakMs: 0});
    }
    const header = '<div class="dailyRow header"><span>Date</span><span>Net work</span><span>Breaks</span><span>Browser estimate</span></div>';
    const daily = allDays.map(day => {
      const activity = browserActivity?.daily[day.date];
      const browsing = activity == null ? '—' :
        `${duration(activity.estimatedMs)} · ${activity.visitCount} visits<div class="visitBar"><i style="width:${activity.visitCount / visitMax * 100}%"></i></div>`;
      return `<div class="dailyRow"><span>${new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'})}</span><span>${duration(day.workMs)}</span><span>${duration(day.breakMs)}</span><span>${browsing}</span></div>`;
    }).join('');
    $('daily').innerHTML = header + daily;
    const selectedEvents = events.filter(event => {
      const at = Date.parse(event.at);
      return at >= selected.start && at < selected.end;
    }).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    $('timeline').replaceChildren(...selectedEvents.map(event => {
      const row = document.createElement('div');row.className = 'logRow';
      const time = document.createElement('time');time.dateTime = event.at;
      time.textContent = new Date(event.at).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
      const label = document.createElement('strong');label.textContent = eventLabels[event.type];
      row.append(time, label);return row;
    }));
    if (!selectedEvents.length) $('timeline').innerHTML = '<p class="empty">No punches or breaks in this range.</p>';
  }
  async function load() {
    if (location.protocol === 'chrome-extension:' && chrome.storage?.local) {
      const stored = await chrome.storage.local.get('meridian.workTime');
      events = Array.isArray(stored['meridian.workTime']) ? stored['meridian.workTime'].filter(MeridianWorkTimeCore.validEvent) : [];
    }
    render();
  }
  for (const id of ['rangeStart', 'rangeEnd']) $(id).onchange = () => {browserActivity = null;$('historyNote').textContent = 'Browser activity is not loaded. Visit timestamps can add context, but they do not prove work or inactivity.';render();};
  $('compareHistory').onclick = async () => {
    if (location.protocol !== 'chrome-extension:' || !chrome.history) {
      $('historyNote').textContent = 'Browser history comparison is available only in the installed extension.';
      return;
    }
    $('compareHistory').disabled = true;$('historyNote').textContent = 'Aggregating visit timestamps locally…';
    try {
      const granted = await chrome.permissions.request({permissions: ['history']});
      if (!granted) throw Error('History access was not enabled.');
      const selected = range(), results = await chrome.history.search({text: '', startTime: selected.start, endTime: selected.end, maxResults: 2000});
      const visitTimes = [];
      for (let index = 0; index < results.length; index += 40) {
        const batch = await Promise.all(results.slice(index, index + 40).map(item => chrome.history.getVisits({url: item.url})));
        for (const itemVisits of batch) for (const visit of itemVisits) visitTimes.push(visit.visitTime);
      }
      browserActivity = MeridianWorkTimeCore.estimateBrowsingActivity(visitTimes, selected.start, selected.end);
      $('historyNote').textContent = browserActivity.activeIntervalCount ?
        `Estimated ${duration(browserActivity.estimatedMs)} of browsing activity from ${browserActivity.visitCount} unique visit timestamps. The estimate counts only gaps of five minutes or less between successive visits and adds no time after the last visit. URLs and titles were not saved; this is context, not proof of work or inactivity.` :
        `Found ${browserActivity.visitCount} unique visit timestamp${browserActivity.visitCount === 1 ? '' : 's'}, but there was not enough closely spaced activity to estimate a duration. The estimate adds no time after the last visit or across gaps longer than five minutes. URLs and titles were not saved.`;
      render();
    } catch (error) {
      $('historyNote').textContent = error.message;
    } finally {
      $('compareHistory').disabled = false;
    }
  };
  function copilotSummary() {
    const selected = range();
    const daily = summary.daily.map(day => {
      const activity = browserActivity?.daily[day.date];
      return `${day.date}: ${duration(day.workMs)} net work, ${duration(day.breakMs)} breaks${activity ? `, ${duration(activity.estimatedMs)} estimated browsing from ${activity.visitCount} unique visit timestamps` : ''}`;
    }).join('\n') || 'No recorded days.';
    return `Analyze this aggregate work-time record from ${$('rangeStart').value} through ${$('rangeEnd').value}. Look for sustainable scheduling patterns and suggest specific break timing improvements. Do not infer productivity, effort, or inactivity from browser visits.\n\nNet work: ${duration(summary.workMs)}\nRecorded breaks: ${duration(summary.breakMs)}\nLongest work stretch between recorded breaks: ${duration(summary.longestWorkMs)}\nOpen record counted through now: ${summary.open ? 'yes' : 'no'}\nBrowser activity included as context: ${browserActivity ? `${duration(browserActivity.estimatedMs)} estimated from ${browserActivity.visitCount} unique visit timestamps; only successive gaps of five minutes or less counted, with no time added after the last visit` : 'no'}\n\nDaily aggregates:\n${daily}`;
  }
  $('previewCopilot').onclick = () => {$('copilotText').value = copilotSummary();$('copilotPreview').showModal();};
  $('closePreview').onclick = () => $('copilotPreview').close();
  $('copyCopilot').onclick = async () => {
    await navigator.clipboard.writeText($('copilotText').value);
    location.assign('https://m365.cloud.microsoft/chat');
  };
  load();
})();
