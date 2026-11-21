'use strict';
(() => {
  const button = document.getElementById('punchButton');
  const label = document.getElementById('punchLabel');
  const breakButton = document.getElementById('breakButton');
  const breakLabel = document.getElementById('breakLabel');
  const breakPauseIcon = document.getElementById('breakPauseIcon');
  const status = document.getElementById('shiftStatus');
  const clockState = document.getElementById('clockState');
  const clockDetail = document.getElementById('clockDetail');
  const breakWarning = document.getElementById('breakWarning');
  const shiftControl = status.closest('.shiftControl');
  const settingsForm = document.getElementById('breakSettingsForm');
  const intervalInput = document.getElementById('breakInterval');
  const warningInput = document.getElementById('breakWarningLead');
  const repeatInput = document.getElementById('breakRepeat');
  const soundEnabled = document.getElementById('breakSoundEnabled');
  const soundSelect = document.getElementById('breakSound');
  const notificationsEnabled = document.getElementById('breakNotificationsEnabled');
  const notificationHelp = notificationsEnabled.closest('.settingName').querySelector('.helpTip');
  const testButton = document.getElementById('testBreakReminder');
  const settingsStatus = document.getElementById('breakSettingsStatus');
  let state = {active: false};
  let preferences = MeridianBreakPreferences.normalize();
  let workerSounds = new Set(['chime', 'bell', 'pulse']);
  let focusBreakControl = location.hash === '#break-control';
  notificationHelp.ariaLabel = 'Desktop notification: Asks your browser to show a silent system notification.';
  notificationHelp.dataset.tooltip = 'Ask your browser to show a silent system notification.';
  const time = value => new Date(value).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
  function updateClockStatus() {
    const view = MeridianBreakStatus.model(state, Date.now(), preferences);
    status.dataset.tone = view.tone;
    clockState.textContent = view.stateLabel;
    clockDetail.textContent = view.detail;
    breakWarning.hidden = !view.warning;
    breakWarning.textContent = view.warning;
  }
  function showPreferences(next) {
    preferences = MeridianBreakPreferences.normalize(next);
    intervalInput.value = preferences.intervalMinutes;
    warningInput.value = preferences.warningLeadMinutes;
    repeatInput.value = preferences.repeatMinutes;
    warningInput.max = Math.max(0, preferences.intervalMinutes - 1);
    soundEnabled.checked = preferences.soundEnabled;
    soundSelect.value = preferences.sound;
    soundSelect.disabled = !preferences.soundEnabled;
    notificationsEnabled.checked = preferences.notificationsEnabled;
  }
  function render(next, nextPreferences) {
    state = next;
    if (nextPreferences) showPreferences(nextPreferences);
    label.textContent = state.active ? 'Clock out' : 'Clock in';
    button.classList.toggle('active', state.active);
    button.setAttribute('aria-pressed', String(state.active));
    breakButton.hidden = !state.active;
    breakLabel.textContent = state.mode === 'break' ? 'Resume' : 'Take a break';
    breakPauseIcon.hidden = state.mode === 'break';
    breakButton.classList.toggle('active', state.mode === 'break');
    updateClockStatus();
    if (focusBreakControl) {
      focusBreakControl = false;
      requestAnimationFrame(() => {
        if (!breakButton.hidden) breakButton.focus();
        else {
          shiftControl.tabIndex = -1;
          shiftControl.focus();
        }
      });
    }
    if (!state.active) {
      status.title = 'Clock in to start local work-time tracking and hourly break reminders.';
      return;
    }
    if (state.mode === 'break') {
      status.title = 'Break reminders are paused. Resume starts a new uninterrupted-work hour.';
      return;
    }
    status.title = `Next break reminder at ${time(state.nextReminderAt)}. Browser or operating system settings can silence notifications.`;
  }
  function preferencesFromForm() {
    warningInput.setCustomValidity('');
    const value = {
      intervalMinutes: Number(intervalInput.value),
      warningLeadMinutes: Number(warningInput.value),
      repeatMinutes: Number(repeatInput.value),
      soundEnabled: soundEnabled.checked,
      sound: soundSelect.value,
      notificationsEnabled: notificationsEnabled.checked
    };
    if (value.warningLeadMinutes >= value.intervalMinutes) {
      warningInput.setCustomValidity('The warning lead time must be shorter than the reminder interval.');
      warningInput.reportValidity();
      throw Error('The warning lead time must be shorter than the reminder interval.');
    }
    return MeridianBreakPreferences.validate(value);
  }
  function setSettingsStatus(text, kind = '') {
    settingsStatus.textContent = text;
    settingsStatus.dataset.kind = kind;
  }
  async function send(type, extra = {}) {
    const response = await chrome.runtime.sendMessage({type, ...extra});
    if (!response?.ok) throw Error(response?.error || 'The reminder service did not respond.');
    if (Array.isArray(response.supportedSounds)) workerSounds = new Set(response.supportedSounds);
    render(response.state, response.preferences);
    return response;
  }
  if (location.protocol !== 'chrome-extension:' || !globalThis.chrome?.runtime?.sendMessage) {
    button.disabled = true;
    breakButton.disabled = true;
    clockState.textContent = 'Off the clock';
    clockDetail.textContent = 'Installed extension required for reminders.';
    status.title = 'Background alarms, sound, and desktop notifications are unavailable in the file preview.';
    setSettingsStatus('Background alarms, sound, and desktop notifications are unavailable in the file preview.');
    for (const control of settingsForm.elements) control.disabled = true;
    return;
  }
  button.onclick = async () => {
    if (state.active && !confirm('Clock out and end this shift?')) return;
    button.disabled = true;
    try {
      await send(state.active ? 'meridian.shift.punchOut' : 'meridian.shift.punchIn');
    } catch (error) {
      clockState.textContent = 'Reminder unavailable';
      status.title = error.message;
    } finally {
      button.disabled = false;
      breakButton.disabled = false;
    }
  };
  breakButton.onclick = async () => {
    button.disabled = true;
    breakButton.disabled = true;
    try {
      await send(state.mode === 'break' ? 'meridian.shift.resume' : 'meridian.shift.takeBreak');
    } catch (error) {
      clockState.textContent = 'Reminder unavailable';
      status.title = error.message;
    } finally {
      button.disabled = false;
      breakButton.disabled = false;
    }
  };
  intervalInput.oninput = () => {
    warningInput.max = Math.max(0, Number(intervalInput.value) - 1);
    warningInput.setCustomValidity('');
  };
  warningInput.oninput = () => warningInput.setCustomValidity('');
  repeatInput.oninput = () => repeatInput.setCustomValidity('');
  async function savePreferences() {
    try {
      const selected = preferencesFromForm();
      await send('meridian.break.preferences.save', {preferences: selected});
      if (settingsStatus.dataset.kind === 'validation') setSettingsStatus('');
      globalThis.MeridianSettingsStatus.saved();
      return selected;
    } catch (error) {
      setSettingsStatus(error.message, 'validation');
      showPreferences(preferences);
      return null;
    }
  }
  intervalInput.onchange = savePreferences;
  warningInput.onchange = savePreferences;
  repeatInput.onchange = savePreferences;
  soundEnabled.onchange = () => {
    soundSelect.disabled = !soundEnabled.checked;
    savePreferences();
  };
  soundSelect.onchange = async () => {
    if (!workerSounds.has(soundSelect.value)) {
      setSettingsStatus('Reload the unpacked extension once to activate the newly added sounds. Your reminder settings were not changed.', 'validation');
      showPreferences(preferences);
      return;
    }
    const selected = await savePreferences();
    if (!selected) return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'meridian.break.test',
        preferences: {...selected, soundEnabled: true, notificationsEnabled: false}
      });
      if (!response?.ok || !response.test.sound.delivered) {
        throw Error(response?.error || response?.test.sound.error || 'The selected sound could not be played.');
      }
    } catch (error) {
      setSettingsStatus(`Sound preview failed: ${error.message}`, 'test');
    }
  };
  notificationsEnabled.onchange = savePreferences;
  settingsForm.onsubmit = event => {
    event.preventDefault();
    savePreferences();
  };
  testButton.onclick = async () => {
    let selected;
    try {
      selected = preferencesFromForm();
    } catch (error) {
      setSettingsStatus(error.message, 'validation');
      return;
    }
    if (!selected.soundEnabled && !selected.notificationsEnabled) {
      setSettingsStatus('Both reminder channels are off. Enable sound or desktop notifications to test.', 'test');
      return;
    }
    testButton.disabled = true;
    setSettingsStatus('Testing enabled reminder channels…', 'test');
    try {
      const response = await chrome.runtime.sendMessage({type: 'meridian.break.test', preferences: selected});
      if (!response?.ok) throw Error(response?.error || 'The reminder test did not respond.');
      const messages = [];
      if (response.test.sound.enabled) messages.push(response.test.sound.delivered ? 'Sound played.' : `Sound failed: ${response.test.sound.error || 'unknown error'}.`);
      if (response.test.notification.enabled) messages.push(response.test.notification.delivered ?
        'Desktop notification sent to your browser; browser or operating system settings may suppress it.' :
        `Desktop notification failed: ${response.test.notification.error || 'unknown error'}.`);
      setSettingsStatus(messages.join(' '), 'test');
    } catch (error) {
      setSettingsStatus(error.message, 'test');
    } finally {
      testButton.disabled = false;
    }
  };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['meridian.shift']?.newValue) render(changes['meridian.shift'].newValue);
    if (area === 'local' && changes['meridian.breakPreferences']) {
      showPreferences(changes['meridian.breakPreferences'].newValue);
      updateClockStatus();
    }
  });
  send('meridian.shift.status').catch(error => {
    button.disabled = true;
    clockState.textContent = 'Reminder unavailable';
    status.title = error.message;
  });
  setInterval(updateClockStatus, 15000);
})();
