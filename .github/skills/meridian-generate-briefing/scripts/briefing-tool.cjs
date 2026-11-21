#!/usr/bin/env node
'use strict';

const {applyFeedback, applyPatch, readFeedback, readJson, resolveFile, validateBriefing, writeAtomic} = require('./briefing-core.cjs');

function usage() {
  return 'Usage:\n  node briefing-tool.cjs inspect [actions|agenda|prs|all] [--file <briefing.json>]\n  node briefing-tool.cjs apply <patch.json> [--file <briefing.json>] [--feedback <briefing-feedback.json>]';
}

function option(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  if (!args[index + 1]) throw Error(`Missing value for ${name}`);
  return args[index + 1];
}

function positional(args) {
  const values = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index].startsWith('--')) index++;
    else values.push(args[index]);
  }
  return values;
}

function run(args = process.argv.slice(2)) {
  const [command, ...rest] = args;
  const values = positional(rest);
  const destination = resolveFile(option(rest, '--file'));
  const current = validateBriefing(readJson(destination));

  if (command === 'inspect') {
    const section = values[0] || 'all';
    if (!['all', 'actions', 'agenda', 'prs'].includes(section)) throw Error(`Unknown section: ${section}`);
    const result = section === 'all' ? current : {[section]: current[section]};
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === 'apply') {
    if (!values[0]) throw Error(usage());
    const next = applyFeedback(
      applyPatch(current, readJson(resolveFile(values[0]))),
      readFeedback(option(rest, '--feedback') || undefined)
    );
    writeAtomic(destination, next);
    process.stdout.write(`Updated ${destination}\n`);
    return;
  }
  throw Error(usage());
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {run};
