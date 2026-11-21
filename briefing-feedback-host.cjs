'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const feedbackCore=require('./briefing-feedback.js');

function feedbackPath(){
  const localData=process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local');
  return process.env.MERIDIAN_FEEDBACK_PATH||path.join(localData,'Meridian','briefing-feedback.json');
}
function legacyFeedbackPath(){
  return path.join(os.homedir(),'Downloads','meridian-briefing-feedback.json');
}
function readMessage(input){
  if(input.length<4)throw Error('Missing native message header');
  const length=input.readUInt32LE(0);
  if(length>1024*1024||input.length!==length+4)throw Error('Invalid native message length');
  return JSON.parse(input.subarray(4).toString('utf8'));
}
function writeMessage(message){
  const body=Buffer.from(JSON.stringify(message));
  const header=Buffer.alloc(4);
  header.writeUInt32LE(body.length);
  process.stdout.write(Buffer.concat([header,body]));
}
function writeFeedback(value,file=feedbackPath()){
  const incoming=feedbackCore.normalize(value);
  let existing=feedbackCore.normalize(null);
  const sources=[file];
  if(!process.env.MERIDIAN_FEEDBACK_PATH&&file===feedbackPath()&&legacyFeedbackPath()!==file){
    sources.unshift(legacyFeedbackPath());
  }
  for(const source of sources){
    if(!fs.existsSync(source))continue;
    const saved=feedbackCore.normalize(JSON.parse(fs.readFileSync(source,'utf8').replace(/^\uFEFF/,'')));
    const dismissals=new Map(existing.dismissals.map(entry=>[entry.id,entry]));
    for(const entry of saved.dismissals)dismissals.set(entry.id,entry);
    const timestamps=[existing.updatedAt,saved.updatedAt].filter(Boolean).sort();
    existing={version:feedbackCore.VERSION,updatedAt:timestamps.at(-1)||null,dismissals:[...dismissals.values()]};
  }
  const dismissals=new Map(existing.dismissals.map(entry=>[entry.id,entry]));
  for(const entry of incoming.dismissals)dismissals.set(entry.id,entry);
  const timestamps=[existing.updatedAt,incoming.updatedAt].filter(Boolean).sort();
  const feedback={
    version:feedbackCore.VERSION,
    updatedAt:timestamps.at(-1)||null,
    dismissals:[...dismissals.values()]
  };
  const temp=`${file}.${randomUUID()}.tmp`;
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(temp,JSON.stringify(feedback,null,2)+'\n');
  fs.renameSync(temp,file);
  return {status:'written',name:path.basename(file),feedback};
}
function main(input){
  const message=readMessage(input);
  if(message.type!=='writeFeedback')throw Error('Unsupported native message');
  return writeFeedback(message.feedback);
}
if(require.main===module){
  const chunks=[];
  process.stdin.on('data',chunk=>chunks.push(chunk));
  process.stdin.on('end',()=>{
    try{writeMessage(main(Buffer.concat(chunks)));}
    catch(error){writeMessage({status:'error',message:error.message});}
  });
}
module.exports={feedbackPath,legacyFeedbackPath,readMessage,writeFeedback,main};
