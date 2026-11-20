'use strict';
importScripts('break-core.js', 'break-preferences.js', 'break-service.js');

const stateKey = 'meridian.shift';
const ledgerKey = 'meridian.workTime';
const preferenceKey = 'meridian.breakPreferences';
const alarms = {
  clear: name => new Promise(resolve => chrome.alarms.clear(name, resolve)),
  create: (name, info) => {
    chrome.alarms.create(name, info);
    return Promise.resolve();
  }
};
const store = {
  get: async () => (await chrome.storage.local.get(stateKey))[stateKey],
  set: value => chrome.storage.local.set({[stateKey]: value})
};
const ledger = {
  append: async event => {
    const stored = await chrome.storage.local.get(ledgerKey);
    const events = Array.isArray(stored[ledgerKey]) ? stored[ledgerKey] : [];
    await chrome.storage.local.set({[ledgerKey]: [...events, event]});
  }
};
const preferences = {
  get: async () => (await chrome.storage.local.get(preferenceKey))[preferenceKey],
  set: value => chrome.storage.local.set({[preferenceKey]: value})
};
async function ensureOffscreen() {
  if (chrome.offscreen.hasDocument && await chrome.offscreen.hasDocument()) return;
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']});
    if (contexts.length) return;
  }
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play a gentle break reminder cue.'
    });
  } catch (error) {
    if (!String(error.message).includes('single offscreen')) throw error;
  }
}
const reminderNotificationPrefix = 'meridian-break-reminder:';
const testNotificationId = 'meridian-break-test';
const reminderNotificationId = reminder => `${reminderNotificationPrefix}${reminder.punchedInAt}:${reminder.workStartedAt}:${reminder.reminderAt}`;
function reminderFromNotificationId(id) {
  if (!id.startsWith(reminderNotificationPrefix)) return null;
  const values = id.slice(reminderNotificationPrefix.length).split(':').map(Number);
  return values.length === 3 && values.every(Number.isFinite) ?
    {punchedInAt: values[0], workStartedAt: values[1], reminderAt: values[2]} : null;
}
function notify(reminder = null) {
  const test = !reminder;
  const options = {
    type: 'basic',
    iconUrl: 'notification-icon.png',
    title: test ? 'Break reminder test' : 'Time to take a break',
    message: test ? 'Desktop notifications are enabled for break reminders.' : 'Stand up and walk away for a few minutes.',
    priority: 1,
    silent: true
  };
  options.buttons = [{title: 'Take a break'}];
  return new Promise((resolve, reject) => chrome.notifications.create(test ? testNotificationId : reminderNotificationId(reminder), options, id => {
    if (chrome.runtime.lastError) reject(Error(chrome.runtime.lastError.message));
    else resolve(id);
  }));
}
async function playCue(sound) {
  await ensureOffscreen();
  await chrome.runtime.sendMessage({type: 'meridian.break.playCue', sound});
}
const service = MeridianBreakService.createBreakService({
  alarms,
  store,
  ledger,
  preferences,
  id: () => crypto.randomUUID(),
  now: () => Date.now(),
  calendar: {
    getSnapshot: async () => {
      const response = await fetch(chrome.runtime.getURL('briefing.json'), {cache: 'no-store'});
      if (!response.ok) return {agenda: {items: []}};
      return response.json();
    }
  },
  notify,
  playCue
});
async function testReminder(value) {
  const selected = MeridianBreakPreferences.validate(value);
  const result = {
    sound: {enabled: selected.soundEnabled, delivered: false},
    notification: {enabled: selected.notificationsEnabled, delivered: false}
  };
  if (selected.soundEnabled) {
    try {
      await playCue(selected.sound);
      result.sound.delivered = true;
    } catch (error) {
      result.sound.error = error.message;
    }
  }
  if (selected.notificationsEnabled) {
    try {
      await notify();
      result.notification.delivered = true;
    } catch (error) {
      result.notification.error = error.message;
    }
  }
  return result;
}

let operationQueue = Promise.resolve();
const run = operation => {
  operationQueue = operationQueue.then(operation, operation);
  return operationQueue;
};
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === service.ALARM_NAME) run(() => service.handleAlarm());
});
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === testNotificationId && buttonIndex === 0) {
    chrome.notifications.clear(notificationId);
    chrome.tabs.create({url: chrome.runtime.getURL('index.html#test-break-action')});
    return;
  }
  const reminder = buttonIndex === 0 ? reminderFromNotificationId(notificationId) : null;
  if (reminder) {
    run(async () => {
      if (await service.takeBreakForReminder(reminder)) chrome.notifications.clear(notificationId);
    });
  }
});
chrome.notifications.onClicked.addListener(notificationId => {
  if (notificationId === testNotificationId) {
    chrome.notifications.clear(notificationId);
    chrome.tabs.create({url: chrome.runtime.getURL('index.html#test-break-action')});
    return;
  }
  if (!reminderFromNotificationId(notificationId)) return;
  chrome.notifications.clear(notificationId);
  chrome.tabs.create({url: chrome.runtime.getURL('index.html#break-control')});
});
chrome.runtime.onStartup.addListener(() => run(() => service.restore()));
chrome.runtime.onInstalled.addListener(() => run(() => service.restore()));
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const actions = {
    'meridian.shift.punchIn': service.punchIn,
    'meridian.shift.punchOut': service.punchOut,
    'meridian.shift.takeBreak': service.takeBreak,
    'meridian.shift.resume': service.resume
  };
  if (message?.type === 'meridian.break.test') {
    testReminder(message.preferences).then(test => sendResponse({ok: true, test}), error => sendResponse({ok: false, error: error.message}));
    return true;
  }
  const action = message?.type === 'meridian.shift.status' ? service.getStatus :
    message?.type === 'meridian.break.preferences.save' ? () => service.updatePreferences(message.preferences) :
    actions[message?.type];
  if (!action) return false;
  run(action).then(async state => sendResponse({
    ok: true,
    state,
    preferences: await service.getPreferences(),
    supportedSounds: [...MeridianBreakPreferences.SOUNDS]
  }),
    error => sendResponse({ok: false, error: error.message}));
  return true;
});
