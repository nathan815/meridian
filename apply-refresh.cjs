const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {randomUUID}=require('node:crypto');
const feedbackCore=require('./briefing-feedback.js');
function mergeItems(previous, proposed){
  const previousItems=new Map(previous.map(item=>[item.id,item])), items=[],seen=new Set();
  for(const item of proposed){
    if(typeof item.id!=='string'||!item.id.trim())throw Error('Missing action ID');
    const old=previousItems.get(item.id);
    if(item.completion){
      const {reason,source,date}=item.completion;
      if(![reason,source,date].every(x=>typeof x==='string'&&x.trim())||!Number.isFinite(Date.parse(date)))throw Error(`Missing dated completion evidence: ${item.id}`);
    }
    if(!old&&!item.title)throw Error(`Missing new action title: ${item.id}`);
    items.push(old?.completion?old:old?{...old,...item,completion:item.completion||old.completion}:item);
    seen.add(item.id);
  }
  return [...items,...previous.filter(item=>!seen.has(item.id))];
}
function defaultFeedbackPath(){
  const localData=process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local');
  return process.env.MERIDIAN_FEEDBACK_PATH||path.join(localData,'Meridian','briefing-feedback.json');
}
function readFeedback(file=defaultFeedbackPath()){
  if(!fs.existsSync(file)&&!process.env.MERIDIAN_FEEDBACK_PATH&&file===defaultFeedbackPath()){
    const legacy=path.join(os.homedir(),'Downloads','meridian-briefing-feedback.json');
    if(fs.existsSync(legacy))file=legacy;
  }
  if(!fs.existsSync(file))return feedbackCore.normalize(null);
  return feedbackCore.normalize(JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')));
}
function applyFeedback(next,feedback){
  const before=next.actions.items.length;
  next.actions.items=feedbackCore.apply(next.actions.items,feedback);
  if(next.actions.items.length!==before)delete next.actions.focus;
  if(next.art)next.art.actions=next.actions.items.length;
  return next;
}
if(require.main===module){
  const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
  const dest=path.join(__dirname,'briefing.json'), candidate=process.argv[2],feedbackPath=process.argv[3]||defaultFeedbackPath();
  if(!candidate||path.resolve(candidate)===dest)throw Error('Provide a separate candidate snapshot');
  const next=read(candidate);
  const previous=read(dest).actions;
  next.actions.items=mergeItems(previous.items,next.actions.items);
  applyFeedback(next,readFeedback(feedbackPath));
  next.actions.generatedAt=next.actions.note?previous.generatedAt:new Date().toISOString();
  const tmp=dest+'.'+randomUUID()+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(next,null,2)+'\n');fs.renameSync(tmp,dest);
}
module.exports={mergeItems,defaultFeedbackPath,readFeedback,applyFeedback};
