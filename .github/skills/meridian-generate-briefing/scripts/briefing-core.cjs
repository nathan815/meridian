'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {randomUUID} = require('node:crypto');

const SECTIONS = ['actions', 'agenda', 'prs'];
const DISMISSAL_REASONS = new Set(['not-mine', 'incorrect', 'no-longer-relevant']);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function validDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`${label} must be an object`);
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw Error(`${label} must be a non-empty string`);
}

function validateCompletion(completion, id) {
  requireObject(completion, `Completion for ${id}`);
  for (const key of ['reason', 'source']) requireString(completion[key], `Completion ${key} for ${id}`);
  if (!validDate(completion.date)) throw Error(`Completion date for ${id} must be a valid date`);
  if (completion.url != null) requireString(completion.url, `Completion URL for ${id}`);
}

function validateAction(item) {
  requireObject(item, 'Action');
  requireString(item.id, 'Action ID');
  requireString(item.title, `Action title for ${item.id}`);
  requireString(item.source, `Action source for ${item.id}`);
  if (item.url != null) requireString(item.url, `Action URL for ${item.id}`);
  if (item.context != null && typeof item.context !== 'string') throw Error(`Action context for ${item.id} must be a string`);
  if (item.completion != null) validateCompletion(item.completion, item.id);
}

function validateAgendaItem(item, index) {
  requireObject(item, `Agenda item ${index}`);
  requireString(item.title, `Agenda title at index ${index}`);
  if (!validDate(item.start) || !validDate(item.end)) throw Error(`Agenda item ${index} must have valid start and end dates`);
  if (Date.parse(item.end) <= Date.parse(item.start)) throw Error(`Agenda item ${index} must end after it starts`);
  if (item.url != null) requireString(item.url, `Agenda URL at index ${index}`);
  if (item.allDay != null && typeof item.allDay !== 'boolean') throw Error(`Agenda allDay at index ${index} must be a boolean`);
}

function validatePr(item, index) {
  requireObject(item, `Pull request ${index}`);
  if (!(typeof item.id === 'string' && item.id.trim()) && !Number.isSafeInteger(item.id)) throw Error(`Pull request ${index} must have an ID`);
  requireString(item.title, `Pull request title at index ${index}`);
  requireString(item.url, `Pull request URL at index ${index}`);
  if (!['For review', 'Yours'].includes(item.role)) throw Error(`Pull request role at index ${index} must be "For review" or "Yours"`);
}

function validateGroup(group, section, itemValidator) {
  requireObject(group, section);
  if (!Array.isArray(group.items)) throw Error(`${section}.items must be an array`);
  group.items.forEach(itemValidator);
  if (group.note != null && typeof group.note !== 'string') throw Error(`${section}.note must be a string`);
}

function validateBriefing(briefing) {
  requireObject(briefing, 'Briefing');
  if (!validDate(briefing.updated)) throw Error('updated must be a valid date');
  validateGroup(briefing.actions, 'actions', validateAction);
  if (!validDate(briefing.actions.generatedAt)) throw Error('actions.generatedAt must be a valid date');
  if (briefing.actions.focus != null && typeof briefing.actions.focus !== 'string') throw Error('actions.focus must be a string');
  validateGroup(briefing.agenda, 'agenda', validateAgendaItem);
  validateGroup(briefing.prs, 'prs', validatePr);
  return briefing;
}

function mergeItems(previous, proposed) {
  const previousItems = new Map(previous.map(item => [item.id, item]));
  const items = [];
  const seen = new Set();
  for (const item of proposed) {
    requireObject(item, 'Action');
    requireString(item.id, 'Action ID');
    const old = previousItems.get(item.id);
    if (!old) {
      validateAction(item);
      items.push(item);
      seen.add(item.id);
      continue;
    }
    const completion = item.completion || old.completion;
    const merged = old.completion ? old : {...old, ...item, ...(completion ? {completion} : {})};
    validateAction(merged);
    items.push(merged);
    seen.add(item.id);
  }
  return [...items, ...previous.filter(item => !seen.has(item.id))];
}

function normalizeFeedback(value) {
  const dismissals = Array.isArray(value?.dismissals) ? value.dismissals.filter(entry =>
    entry && typeof entry.id === 'string' && entry.id.trim() &&
    DISMISSAL_REASONS.has(entry.reason) &&
    typeof entry.dismissedAt === 'string' && Number.isFinite(Date.parse(entry.dismissedAt))
  ) : [];
  return {dismissals: [...new Map(dismissals.map(entry => [entry.id, entry])).values()]};
}

function defaultFeedbackPath() {
  const localData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return process.env.MERIDIAN_FEEDBACK_PATH || path.join(localData, 'Meridian', 'briefing-feedback.json');
}

function readFeedback(file = defaultFeedbackPath()) {
  if (!fs.existsSync(file) && !process.env.MERIDIAN_FEEDBACK_PATH && file === defaultFeedbackPath()) {
    const legacy = path.join(os.homedir(), 'Downloads', 'meridian-briefing-feedback.json');
    if (fs.existsSync(legacy)) file = legacy;
  }
  return fs.existsSync(file) ? normalizeFeedback(readJson(file)) : normalizeFeedback(null);
}

function applyFeedback(briefing, feedback) {
  const dismissed = new Set(normalizeFeedback(feedback).dismissals.map(entry => entry.id));
  const before = briefing.actions.items.length;
  briefing.actions.items = briefing.actions.items.filter(item => !dismissed.has(item.id));
  if (briefing.actions.items.length !== before) delete briefing.actions.focus;
  if (briefing.art) briefing.art.actions = briefing.actions.items.length;
  return briefing;
}

function applyPatch(previous, patch, now = new Date().toISOString()) {
  validateBriefing(previous);
  requireObject(patch, 'Patch');
  const allowed = new Set(['updated', ...SECTIONS]);
  for (const key of Object.keys(patch)) if (!allowed.has(key)) throw Error(`Unsupported briefing field: ${key}`);
  if (!SECTIONS.some(section => Object.hasOwn(patch, section))) throw Error('Patch must include at least one briefing section');

  const next = structuredClone(previous);
  if (Object.hasOwn(patch, 'agenda')) next.agenda = structuredClone(patch.agenda);
  if (Object.hasOwn(patch, 'prs')) next.prs = structuredClone(patch.prs);
  if (Object.hasOwn(patch, 'actions')) {
    requireObject(patch.actions, 'actions patch');
    const allowedActionFields = new Set(['items', 'focus', 'note', 'generatedAt']);
    for (const key of Object.keys(patch.actions)) if (!allowedActionFields.has(key)) throw Error(`Unsupported actions field: ${key}`);
    next.actions = {...next.actions, ...structuredClone(patch.actions)};
    if (Object.hasOwn(patch.actions, 'items')) {
      if (!Array.isArray(patch.actions.items)) throw Error('actions.items must be an array');
      next.actions.items = mergeItems(previous.actions.items, patch.actions.items);
    }
    next.actions.generatedAt = next.actions.note ? previous.actions.generatedAt : patch.actions.generatedAt || now;
  }
  next.updated = patch.updated || now;
  return validateBriefing(next);
}

function writeAtomic(file, value) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, {flag: 'wx'});
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    fs.rmSync(tmp, {force: true});
    throw error;
  }
}

function resolveFile(file) {
  return path.resolve(file || path.join(process.cwd(), 'briefing.json'));
}

module.exports = {
  SECTIONS,
  applyFeedback,
  applyPatch,
  defaultFeedbackPath,
  mergeItems,
  readFeedback,
  readJson,
  resolveFile,
  validateBriefing,
  writeAtomic
};
