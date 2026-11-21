(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.MeridianBriefingFeedback=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const VERSION=1;
  const REASONS=new Set(['not-mine','incorrect','no-longer-relevant']);
  function normalize(value){
    const dismissals=Array.isArray(value?.dismissals)?value.dismissals.filter(entry=>
      entry&&typeof entry.id==='string'&&entry.id.trim()&&REASONS.has(entry.reason)&&
      typeof entry.dismissedAt==='string'&&Number.isFinite(Date.parse(entry.dismissedAt))
    ).map(entry=>({
      id:entry.id,
      reason:entry.reason,
      dismissedAt:entry.dismissedAt,
      ...(typeof entry.detail==='string'&&entry.detail.trim()?{detail:entry.detail.trim().slice(0,500)}:{})
    })):[];
    return {
      version:VERSION,
      updatedAt:typeof value?.updatedAt==='string'&&Number.isFinite(Date.parse(value.updatedAt))?value.updatedAt:null,
      dismissals:[...new Map(dismissals.map(entry=>[entry.id,entry])).values()]
    };
  }
  function dismiss(value,id,reason,detail='',now=new Date()){
    if(typeof id!=='string'||!id.trim())throw Error('Missing action ID');
    if(!REASONS.has(reason))throw Error('Invalid dismissal reason');
    const feedback=normalize(value), dismissedAt=now.toISOString();
    const entry={id,reason,dismissedAt,...(detail.trim()?{detail:detail.trim().slice(0,500)}:{})};
    return {version:VERSION,updatedAt:dismissedAt,dismissals:[...feedback.dismissals.filter(item=>item.id!==id),entry]};
  }
  function apply(items,value){
    const dismissed=new Set(normalize(value).dismissals.map(entry=>entry.id));
    return items.filter(item=>!dismissed.has(item.id));
  }
  function order(items,value){
    const saved=Array.isArray(value)?value:[];
    const known=new Set(items.map(item=>item.id)), ordered=saved.filter((id,index)=>known.has(id)&&saved.indexOf(id)===index);
    const orderedSet=new Set(ordered),iterator=ordered[Symbol.iterator]();
    return items.map(item=>{
      if(!orderedSet.has(item.id))return item;
      const id=iterator.next().value;
      return items.find(candidate=>candidate.id===id);
    });
  }
  return Object.freeze({VERSION,normalize,dismiss,apply,order});
});
