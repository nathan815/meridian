'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const test=require('node:test');
const host=require('./briefing-feedback-host.cjs');

test('native host writes normalized feedback without a file picker',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'meridian-feedback-'));
  const file=path.join(directory,'feedback.json');
  const result=host.writeFeedback({
    version:1,
    updatedAt:'2026-11-21T01:00:00.000Z',
    dismissals:[{
      id:'action-1',
      reason:'not-mine',
      dismissedAt:'2026-11-21T01:00:00.000Z',
      detail:'Local correction'
    }]
  },file);
  assert.equal(result.status,'written');
  assert.equal(result.name,'feedback.json');
  assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).dismissals[0].id,'action-1');
  fs.rmSync(directory,{recursive:true,force:true});
});

test('native host preserves dismissals already handed to the hourly reader',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'meridian-feedback-'));
  const file=path.join(directory,'feedback.json');
  host.writeFeedback({
    updatedAt:'2026-11-21T01:00:00.000Z',
    dismissals:[{id:'existing',reason:'incorrect',dismissedAt:'2026-11-21T01:00:00.000Z'}]
  },file);
  const result=host.writeFeedback({
    updatedAt:'2026-11-21T01:05:00.000Z',
    dismissals:[{id:'new',reason:'not-mine',dismissedAt:'2026-11-21T01:05:00.000Z'}]
  },file);
  assert.deepEqual(result.feedback.dismissals.map(entry=>entry.id),['existing','new']);
  assert.equal(result.feedback.updatedAt,'2026-11-21T01:05:00.000Z');
  fs.rmSync(directory,{recursive:true,force:true});
});

test('native host accepts a framed extension message',()=>{
  const body=Buffer.from(JSON.stringify({type:'writeFeedback',feedback:{dismissals:[]}}));
  const input=Buffer.alloc(body.length+4);
  input.writeUInt32LE(body.length);
  body.copy(input,4);
  assert.equal(host.readMessage(input).type,'writeFeedback');
});

test('default feedback location is app-local instead of Downloads',()=>{
  const expected=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'Meridian','briefing-feedback.json');
  assert.equal(host.feedbackPath(),expected);
});
