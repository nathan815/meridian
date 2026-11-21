(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.MeridianPreviewData=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const text=(value,max=500)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):null;
  const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null;
  function url(value){
    if(typeof value!=='string')return null;
    try{
      const parsed=new URL(value);
      return ['https:','http:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password?parsed.href:null;
    }catch{return null;}
  }
  function action(item){
    if(!object(item))return null;
    const id=text(item.id,200),title=text(item.title),source=text(item.source);
    if(!id||!title||!source)return null;
    const result={id,title,source};
    const context=text(item.context,2000),href=url(item.url);
    if(context)result.context=context;
    if(href)result.url=href;
    if(object(item.completion)){
      const reason=text(item.completion.reason),completionSource=text(item.completion.source),completed=date(item.completion.date);
      if(reason&&completionSource&&completed){
        result.completion={reason,source:completionSource,date:completed};
        const completionUrl=url(item.completion.url);
        if(completionUrl)result.completion.url=completionUrl;
      }
    }
    return result;
  }
  function agenda(item){
    if(!object(item))return null;
    const title=text(item.title),start=date(item.start),end=date(item.end);
    if(!title||!start||!end||Date.parse(end)<=Date.parse(start))return null;
    const result={title,start,end,allDay:item.allDay===true};
    const href=url(item.url);
    if(href)result.url=href;
    return result;
  }
  function pullRequest(item){
    if(!object(item))return null;
    const id=typeof item.id==='string'||Number.isSafeInteger(item.id)?String(item.id).slice(0,100):null;
    const title=text(item.title),href=url(item.url);
    if(!id||!title||!href)return null;
    return {id,title,url:href,role:item.role==='Yours'?'Yours':'For review'};
  }
  function group(value,normalizer){
    const source=object(value)?value:{};
    const items=Array.isArray(source.items)?source.items.slice(0,100).map(normalizer).filter(Boolean):[];
    const result={items};
    const note=text(source.note,2000);
    if(note)result.note=note;
    return result;
  }
  function reviewLibrary(value){
    if(!object(value))return null;
    const libraryUrl=url(value.url);
    if(!libraryUrl)return null;
    const items=Array.isArray(value.items)?value.items.slice(0,20).map(item=>{
      if(!object(item))return null;
      const id=typeof item.id==='string'||Number.isSafeInteger(item.id)?String(item.id).slice(0,100):null;
      const title=text(item.title),reportUrl=url(item.url);
      if(!id||!title||!reportUrl)return null;
      const result={id,title,url:reportUrl};
      const prUrl=url(item.prUrl),recommendation=text(item.recommendation),state=text(item.state);
      if(prUrl)result.prUrl=prUrl;
      if(recommendation)result.recommendation=recommendation;
      if(state)result.state=state;
      return result;
    }).filter(Boolean):[];
    return {url:libraryUrl,items,checkedAt:date(value.checkedAt)};
  }
  function normalize(value){
    if(!object(value))return null;
    const updated=date(value.updated),actions=group(value.actions,action),agendaItems=group(value.agenda,agenda),prs=group(value.prs,pullRequest);
    if(!updated)return null;
    actions.generatedAt=date(value.actions?.generatedAt)||updated;
    const focus=text(value.actions?.focus,2000);
    if(focus)actions.focus=focus;
    const art=object(value.art)?{
      date:/^\d{4}-\d{2}-\d{2}$/.test(value.art.date)?value.art.date:updated.slice(0,10),
      style:['contours','orbits','loom','ribbons','glass','rosette'].includes(value.art.style)?value.art.style:'contours',
      seed:Number.isInteger(value.art.seed)?value.art.seed:0,
      palette:Number.isInteger(value.art.palette)&&value.art.palette>=0&&value.art.palette<=2?value.art.palette:0,
      events:agendaItems.items.length,
      prs:prs.items.length,
      actions:actions.items.length
    }:{date:updated.slice(0,10),style:'contours',seed:0,palette:0,events:agendaItems.items.length,prs:prs.items.length,actions:actions.items.length};
    const result={updated,art,actions,agenda:agendaItems,prs};
    const reviews=reviewLibrary(value.reviewLibrary);
    if(reviews)result.reviewLibrary=reviews;
    return result;
  }
  function read(protocol,value){
    return protocol==='file:'?normalize(value):null;
  }
  return Object.freeze({normalize,read,reviewLibrary});
});
