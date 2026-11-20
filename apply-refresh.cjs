const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
function mergeItems(previous, proposed){
  const items=new Map(previous.map(item=>[item.id,item]));
  for(const item of proposed){
    if(typeof item.id!=='string'||!item.id.trim())throw Error('Missing action ID');
    const old=items.get(item.id);
    if(old?.completion)continue;
    if(item.completion){
      const {reason,source,date}=item.completion;
      if(![reason,source,date].every(x=>typeof x==='string'&&x.trim())||!Number.isFinite(Date.parse(date)))throw Error(`Missing dated completion evidence: ${item.id}`);
    }
    if(!old&&!item.title)throw Error(`Missing new action title: ${item.id}`);
    if(!old)items.set(item.id,item);
    else if(item.completion)items.set(item.id,{...old,completion:item.completion});
  }
  return [...items.values()];
}
if(require.main===module){
  const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
  const dest=path.join(__dirname,'briefing.json'), candidate=process.argv[2];
  if(!candidate||path.resolve(candidate)===dest)throw Error('Provide a separate candidate snapshot');
  const next=read(candidate);
  const previous=read(dest).actions;
  next.actions.items=mergeItems(previous.items,next.actions.items);
  next.actions.generatedAt=next.actions.note?previous.generatedAt:new Date().toISOString();
  const tmp=dest+'.'+randomUUID()+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(next,null,2)+'\n');fs.renameSync(tmp,dest);
}
module.exports={mergeItems};
