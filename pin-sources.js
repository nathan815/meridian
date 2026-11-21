'use strict';
$('add').before($('pinSourcesTemplate').content.cloneNode(true));
let sourceSession=0,bookmarkRequest=0;
const allowedSources=new Set();
const isCurrent=id=>id===sourceSession&&$('editor').open&&!$('pinSources').hidden;
const queryField=$('bookmarkQuery'),popover=$('siteSuggestions');
function dismissSites(){
  ++bookmarkRequest;
  popover.hidePopover();queryField.setAttribute('aria-expanded','false');
}
function openSites(){
  if(!popover.matches(':popover-open')){
    popover.showPopover();queryField.setAttribute('aria-expanded','true');findSites(sourceSession);
  }
}
function showCandidates(target,items,empty){
  const buttons=items.map(({name,url,detail})=>{
    const b=node('button','candidate');b.type='button';b.title=url;
    b.append(siteMark(name,url),node('strong','',name),node('small','',detail));
    if(target.id==='historyResults'){
      const wrapper=node('div','frequentCandidate'),plus=node('button','quickPin');
      plus.type='button';plus.ariaLabel=plus.title=`Pin ${name}`;buttonIcon(plus,'M12 5v14M5 12h14');
      plus.onclick=()=>{
        const items=read('pins');
        if(!items.some(([,u])=>address(u)===address(url)))save('pins',[...items,[name,address(url)]]);
        pins();listEntries();wrapper.remove();dismissSites();queryField.focus();dismissSites();
      };
      wrapper.append(b,plus);
      b.onclick=()=>{dismissSites();$('label').value=name.slice(0,45);$('value').value=url;$('value').setCustomValidity('');$('add').querySelector('button').focus();};
      return wrapper;
    }
    b.onclick=()=>{dismissSites();$('label').value=name.slice(0,45);$('value').value=url;$('value').setCustomValidity('');$('add').querySelector('button').focus();};
    return b;
  });
  target.replaceChildren(...(buttons.length?buttons:[node('p','empty',empty)]));
}
async function findSites(id){
  const request=++bookmarkRequest, q=$('bookmarkQuery').value.trim(),target=$('bookmarkResults');
  target.replaceChildren();$('historyResults').replaceChildren();
  if(!popover.matches(':popover-open'))return;
  if(!q){
    if(allowedSources.has('history'))return frequentSites(id,request);
    $('siteStatus').textContent='Type to search bookmarks, or enable history for frequent sites.';return;
  }
  $('siteStatus').textContent='Searching…';
  const sources=[...allowedSources];
  const results=await Promise.allSettled(sources.map(type=>type==='bookmarks'?chrome.bookmarks.search(q):chrome.history.search({text:q,startTime:Date.now()-14*86400000,maxResults:60})));
  if(!isCurrent(id)||request!==bookmarkRequest)return;
  $('siteStatus').textContent='Search results';
  const seen=new Set(read('pins').map(([,u])=>address(u))),items=[],errors=[];
  results.forEach((result,i)=>{
    if(result.status==='rejected'){errors.push(`Could not search ${sources[i]}: ${result.reason.message}`);return;}
    let count=0;
    for(const page of result.value){
      const url=address(page.url);if(!url||seen.has(url))continue;
      seen.add(url);items.push({url,name:page.title||new URL(url).hostname,detail:`${sources[i]==='bookmarks'?'Bookmark':'History'} · ${new URL(url).host}`});
      if(++count===6)break;
    }
  });
  showCandidates(target,items,errors.length?'Search incomplete.':'No matching unpinned sites.');
  for(const error of errors)target.append(node('p','empty',error));
}
async function frequentSites(id,request){
  const target=$('historyResults'),endTime=Date.now(),startTime=endTime-14*86400000;
  $('siteStatus').textContent='Searching recent visits…';
  try{
    const pages=await chrome.history.search({text:'',startTime,endTime,maxResults:2000});
    const counts=new Map(),pinned=new Set(read('pins').filter(([,u])=>address(u)).map(([,u])=>new URL(u).origin));
    for(let i=0;i<pages.length;i+=20){
      if(!isCurrent(id)||request!==bookmarkRequest)return;
      await Promise.all(pages.slice(i,i+20).map(async p=>{
        const url=address(p.url);if(!url)return;
        const origin=new URL(url).origin;if(pinned.has(origin))return;
        // HistoryItem.visitCount includes visits before the requested window.
        const visits=await chrome.history.getVisits({url:p.url});
        const count=visits.filter(v=>v.visitTime>=startTime&&v.visitTime<=endTime).length;
        if(count)counts.set(origin,(counts.get(origin)||0)+count);
      }));
    }
    if(!isCurrent(id)||request!==bookmarkRequest)return;
    $('siteStatus').textContent='Frequent sites · last 14 days';
    const top=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,6);
    showCandidates(target,top.map(([url,n])=>({name:new URL(url).host,url,detail:`${n} visit${n===1?'':'s'}`})),'No unpinned sites visited in this period.');
    if(pages.length===2000)target.append(node('small','','Based on the 2,000 most recently visited URLs.'));
  }catch{if(isCurrent(id)&&request===bookmarkRequest)$('siteStatus').textContent='Browsing history could not be read. You can still add a URL below.';}
}
async function sourceAccess(type,id,request=false){
  const bookmarks=type==='bookmarks',button=$(bookmarks?'allowBookmarks':'allowHistory'),target=$('accessStatus');
  try{
    const manifest=globalThis.chrome?.runtime?.getManifest?.();
    if(!manifest?.optional_permissions?.includes(type)||!chrome.permissions?.request){
      button.hidden=true;
      target.textContent=`Reload Meridian on your browser's Extensions page, then open a fresh new tab to enable ${type}.`;
      return;
    }
    const allowed=await chrome.permissions[request?'request':'contains']({permissions:[type]});
    if(!isCurrent(id))return;
    button.hidden=allowed;
    if(allowed)allowedSources.add(type);else allowedSources.delete(type);
    $('bookmarkQuery').hidden=!allowedSources.size;
    if(allowed&&request)target.textContent='';
    if(popover.matches(':popover-open'))findSites(id);
    if(request&&!allowed)target.textContent='Access not granted. You can still add a URL below.';
  }catch(error){if(isCurrent(id))target.textContent=`Could not ${request?'request':'check'} ${type} access: ${error.message}`;}
}
function openPinSources(sites){
  const id=++sourceSession;
  dismissSites();$('accessStatus').textContent='';
  allowedSources.clear();
  $('pinSources').hidden=!sites;
  for(const key of ['bookmarkResults','historyResults'])$(key).replaceChildren();
  $('bookmarkQuery').value='';$('bookmarkQuery').hidden=true;
  if(!sites)return;
  const extension=location.protocol==='chrome-extension:';
  $('pinPreviewHint').hidden=extension;$('pinBrowserTools').hidden=!extension;
  if(extension)for(const [type,button] of [['bookmarks','allowBookmarks'],['history','allowHistory']]){
    $(button).hidden=false;$(button).onclick=()=>sourceAccess(type,id,true);sourceAccess(type,id);
  }
}
queryField.onfocus=openSites;queryField.onclick=openSites;
queryField.oninput=()=>{if(popover.matches(':popover-open'))findSites(sourceSession);else openSites();};
document.addEventListener('pointerdown',e=>{if(popover.matches(':popover-open')&&!$('siteFinder').contains(e.target))dismissSites();});
$('siteFinder').addEventListener('focusout',e=>{if(e.relatedTarget&&!$('siteFinder').contains(e.relatedTarget))dismissSites();});
$('siteFinder').addEventListener('keydown',e=>{if(e.key==='Escape'&&popover.matches(':popover-open')){e.preventDefault();e.stopPropagation();queryField.focus();dismissSites();}});
$('editor').addEventListener('close',()=>{++sourceSession;$('bookmarkResults').replaceChildren();$('historyResults').replaceChildren();$('bookmarkQuery').value='';});

if(location.protocol==='chrome-extension:'&&chrome.permissions){
  const mainQuery=$('query'),mainMode=$('mode'),mainPopover=node('div','mainSearchSuggestions');
  const mainStatus=node('small','mainSearchStatus'),mainResults=node('div','mainSearchResults'),mainAccess=node('div','mainSearchAccess');
  const mainHeader=node('div','mainSearchHeader'),mainEnterHint=node('small','mainEnterHint','Press Enter to search the web');
  const sourceSettingStatus=$('searchSourceSettingsStatus');
  const sourceSettingInputs=new Map([
    ['bookmarks',$('searchBookmarksEnabled')],
    ['history',$('searchHistoryEnabled')]
  ]);
  const sourcePreferenceKey='meridian.searchSources';
  const mainBatchSize=8;
  const mainSourceLimit=200,mainCandidateLimit=2000;
  let mainRequest=0,mainCandidates=[],mainItems=[],mainRendered=0,mainSelected=-1,mainLastScrollTop=0;
  let loadingRequest=0,loadingTimer;
  const enabledSources=new Set(),sourceButtons=new Map();
  function readSourcePreferences(){
    try{
      const saved=JSON.parse(localStorage.getItem(sourcePreferenceKey));
      if(saved?.bookmarks===true)enabledSources.add('bookmarks');
      if(saved?.history===true)enabledSources.add('history');
    }catch{}
  }
  function persistSourcePreferences(){
    localStorage.setItem(sourcePreferenceKey,JSON.stringify({
      bookmarks:enabledSources.has('bookmarks'),
      history:enabledSources.has('history')
    }));
  }
  function syncSourceControls(){
    for(const [type,button] of sourceButtons){
      const active=enabledSources.has(type);
      button.setAttribute('aria-pressed',String(active));button.classList.toggle('active',active);
    }
    for(const [type,input] of sourceSettingInputs)input.checked=enabledSources.has(type);
  }
  mainPopover.id='mainSearchSuggestions';mainPopover.setAttribute('popover','manual');mainPopover.setAttribute('role','listbox');
  mainHeader.append(mainAccess,mainEnterHint);
  mainPopover.append(mainHeader,mainStatus,mainResults);document.body.append(mainPopover);
  mainQuery.setAttribute('aria-controls',mainPopover.id);mainQuery.setAttribute('aria-expanded','false');
  mainQuery.setAttribute('aria-autocomplete','list');
  const mainOpen=()=>mainPopover.matches(':popover-open');
  function cancelSearchLoading(request=loadingRequest){
    if(request!==loadingRequest)return;
    clearTimeout(loadingTimer);loadingRequest=0;
    mainStatus.classList.remove('searching');
  }
  function delaySearchLoading(request){
    cancelSearchLoading();loadingRequest=request;
    loadingTimer=setTimeout(()=>{
      if(request!==mainRequest||request!==loadingRequest||!mainOpen())return;
      mainStatus.textContent='Searching…';mainStatus.classList.add('searching');
    },160);
  }
  function dismissMain(){
    ++mainRequest;mainCandidates=[];mainItems=[];mainRendered=0;mainSelected=-1;mainLastScrollTop=0;
    cancelSearchLoading();
    if(mainOpen())mainPopover.hidePopover();
    mainQuery.setAttribute('aria-expanded','false');mainQuery.removeAttribute('aria-activedescendant');
  }
  function showMain(){
    if(!mainOpen())mainPopover.showPopover();
    mainQuery.setAttribute('aria-expanded','true');
  }
  async function mainSources(){
    const checks=await Promise.all(['bookmarks','history'].map(type=>chrome.permissions.contains({permissions:[type]})));
    return new Set(['bookmarks','history'].filter((_,index)=>checks[index]));
  }
  for(const type of ['bookmarks','history']){
    const button=node('button','sourcePill',type[0].toUpperCase()+type.slice(1));button.type='button';
    button.setAttribute('aria-pressed','false');
    button.onclick=()=>setSourcePreference(type,!enabledSources.has(type));
    sourceButtons.set(type,button);mainAccess.append(button);
  }
  function updateSourcePills(granted){
    let changed=false;
    for(const [type,button] of sourceButtons){
      if(!granted.has(type)&&enabledSources.delete(type))changed=true;
      const active=enabledSources.has(type);
      button.setAttribute('aria-pressed',String(active));button.classList.toggle('active',active);
    }
    if(changed){
      try{
        persistSourcePreferences();
      }catch(error){
        sourceSettingStatus.textContent=`Search sources were not updated: ${error.message}`;
        syncSourceControls();
        return;
      }
      syncSourceControls();
      sourceSettingStatus.textContent='A saved source was turned off because its browser permission is no longer available.';
    }
  }
  async function setSourcePreference(type,enabled){
    sourceSettingStatus.textContent='';
    const wasEnabled=enabledSources.has(type);
    if(enabled){
      const allowed=await chrome.permissions.contains({permissions:[type]})||
        await chrome.permissions.request({permissions:[type]});
      if(!allowed){
        syncSourceControls();
        sourceSettingStatus.textContent=`${type[0].toUpperCase()+type.slice(1)} access was not granted.`;
        return;
      }
      enabledSources.add(type);
    }else enabledSources.delete(type);
    try{
      persistSourcePreferences();
    }catch(error){
      if(wasEnabled)enabledSources.add(type);else enabledSources.delete(type);
      syncSourceControls();
      sourceSettingStatus.textContent=`Search sources were not saved: ${error.message}`;
      return;
    }
    syncSourceControls();
    globalThis.MeridianSettingsStatus.saved();
    if(mainOpen())updateMain(!mainQuery.value.trim());
  }
  async function reconcileSourcePermissions(){
    const granted=await mainSources();
    updateSourcePills(granted);
  }
  function appendMainBatch(){
    const total=mainItems.length,next=mainItems.slice(mainRendered,mainRendered+mainBatchSize);
    const rows=next.map((item,offset)=>{
      const index=mainRendered+offset;
      const button=node('a','mainSearchCandidate');button.id=`main-search-result-${index}`;button.href=item.url;
      button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.title=item.url;
      button.setAttribute('aria-posinset',String(index+1));button.setAttribute('aria-setsize',String(total));
      const copy=node('span');copy.append(node('strong','',item.name),node('small','',item.detail));
      button.append(siteMark(item.name,item.url),copy);
      button.onclick=dismissMain;
      mainCandidates.push(button);return button;
    });
    mainResults.append(...rows);mainRendered+=rows.length;
  }
  function renderMain(items,empty){
    mainCandidates=[];mainItems=items;mainRendered=0;mainSelected=-1;
    mainQuery.removeAttribute('aria-activedescendant');mainResults.replaceChildren();
    mainPopover.scrollTop=0;mainLastScrollTop=0;
    if(items.length)appendMainBatch();else mainResults.append(node('p','empty',empty));
  }
  function selectMain(direction){
    if(!mainCandidates.length)return;
    mainSelected=(mainSelected+direction+mainCandidates.length)%mainCandidates.length;
    mainCandidates.forEach((button,index)=>{
      const selected=index===mainSelected;button.classList.toggle('selected',selected);button.setAttribute('aria-selected',String(selected));
    });
    const selected=mainCandidates[mainSelected];
    mainQuery.setAttribute('aria-activedescendant',selected.id);selected.scrollIntoView({block:'nearest'});
  }
  async function localMatches(query,allowed,request){
    delaySearchLoading(request);
    try{
      const types=['bookmarks','history'].filter(type=>allowed.has(type));
      const results=await Promise.allSettled(types.map(type=>type==='bookmarks'?
        chrome.bookmarks.search(query):chrome.history.search({text:query,startTime:Date.now()-30*86400000,maxResults:mainCandidateLimit})));
      if(request!==mainRequest||!mainOpen())return;
      const merged=new Map();
      for(const [index,result] of results.entries()){
        if(result.status!=='fulfilled')continue;
        const type=types[index];
        const sourcePaths=new Set();
        for(const page of result.value.slice(0,mainCandidateLimit)){
          const url=address(page.url);if(!url)continue;
          const parsed=new URL(url),key=parsed.origin+parsed.pathname;
          if(!sourcePaths.has(key)){
            if(sourcePaths.size===mainSourceLimit)break;
            sourcePaths.add(key);
          }
          const item=merged.get(key)||{bookmarkUrl:'',historyUrl:'',bookmarkName:'',historyName:'',lastVisitTime:null,fromBookmark:false,fromHistory:false};
          if(type==='bookmarks'){
            item.fromBookmark=true;
            if(!item.bookmarkUrl){
              item.bookmarkUrl=url;item.bookmarkName=page.title||'';
            }
          }
          else{
            item.fromHistory=true;
            const visited=Number.isFinite(page.lastVisitTime)?page.lastVisitTime:null;
            if(!item.historyUrl||visited!==null&&(item.lastVisitTime===null||visited>item.lastVisitTime)){
              item.historyUrl=url;item.historyName=page.title||'';
            }
            if(visited!==null)item.lastVisitTime=Math.max(item.lastVisitTime||0,visited);
          }
          merged.set(key,item);
        }
      }
      const relativeVisit=timestamp=>{
        if(!Number.isFinite(timestamp))return '';
        const elapsed=Math.max(0,Date.now()-timestamp);
        if(elapsed<60000)return 'Visited just now';
        if(elapsed<3600000){
          const minutes=Math.floor(elapsed/60000);
          return `Visited ${minutes} minute${minutes===1?'':'s'} ago`;
        }
        if(elapsed<86400000){
          const hours=Math.floor(elapsed/3600000);
          return `Visited ${hours} hour${hours===1?'':'s'} ago`;
        }
        const days=Math.floor(elapsed/86400000);
        return `Visited ${days} day${days===1?'':'s'} ago`;
      };
      const items=[...merged.values()].map(item=>{
        const url=item.bookmarkUrl||item.historyUrl,host=new URL(url).host,visit=relativeVisit(item.lastVisitTime);
        const source=item.fromHistory?(item.fromBookmark?'Bookmark and history':'Recent history'):'Bookmark';
        return {
          name:item.bookmarkName||item.historyName||new URL(url).hostname,
          url,
          detail:[source,visit,host].filter(Boolean).join(' · ')
        };
      });
      mainStatus.textContent='Local matches';
      renderMain(items,'No local matches. Press Enter to search the web.');
    }finally{
      cancelSearchLoading(request);
    }
  }
  async function updateMain(emptyClick=false){
    if(mainMode.value!=='Web'){dismissMain();return;}
    const query=mainQuery.value.trim();
    if(!query&&!emptyClick){dismissMain();return;}
    const request=++mainRequest;showMain();
    const granted=await mainSources();
    if(request!==mainRequest||!mainOpen())return;
    updateSourcePills(granted);
    const enabled=new Set([...enabledSources].filter(type=>granted.has(type)));
    if(!enabled.size){
      cancelSearchLoading();
      mainStatus.textContent='Local search is off by default.';
      if(mainResults.childElementCount)mainResults.replaceChildren();
      return;
    }
    if(query){
      await localMatches(query,enabled,request);
    }else{
      cancelSearchLoading();
      const sourceNames=[...enabled].map(type=>type[0].toUpperCase()+type.slice(1)).join(' and ');
      mainStatus.textContent=`Type to search ${sourceNames}. Or press Enter to search the web.`;
      if(mainResults.childElementCount)mainResults.replaceChildren();
    }
  }
  mainQuery.addEventListener('click',()=>updateMain(!mainQuery.value.trim()));
  mainQuery.addEventListener('input',()=>updateMain(false));
  mainPopover.addEventListener('scroll',()=>{
    const movingDown=mainPopover.scrollTop>mainLastScrollTop;
    mainLastScrollTop=mainPopover.scrollTop;
    if(movingDown&&mainRendered<mainItems.length&&mainPopover.scrollTop+mainPopover.clientHeight>=mainPopover.scrollHeight-72)appendMainBatch();
  });
  mainQuery.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&mainOpen()){event.preventDefault();event.stopPropagation();dismissMain();return;}
    if(!mainOpen())return;
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();selectMain(event.key==='ArrowDown'?1:-1);return;
    }
    if(event.key==='Enter'&&mainSelected>=0){
      event.preventDefault();mainCandidates[mainSelected].click();
    }
  });
  mainMode.addEventListener('change',()=>{
    mainEnterHint.textContent=mainMode.value==='Copilot'?'Press Enter to open Copilot':'Press Enter to search the web';
    dismissMain();
  });
  $('search').addEventListener('submit',dismissMain);
  document.addEventListener('pointerdown',event=>{
    if(mainOpen()&&!$('search').contains(event.target)&&!mainPopover.contains(event.target))dismissMain();
  });
  for(const [type,input] of sourceSettingInputs)input.onchange=()=>{
    input.disabled=true;
    setSourcePreference(type,input.checked).finally(()=>input.disabled=false);
  };
  $('settingsButton').addEventListener('click',reconcileSourcePermissions);
  window.addEventListener('storage',event=>{
    if(event.key!==sourcePreferenceKey)return;
    enabledSources.clear();readSourcePreferences();syncSourceControls();
    if(mainOpen())updateMain(!mainQuery.value.trim());
  });
  readSourcePreferences();syncSourceControls();
}
