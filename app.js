'use strict';
const $ = id => document.getElementById(id);
function node(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}
function address(value) {
  if (!URL.canParse(value)) return null;
  const u = new URL(value);
  return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null;
}
function notice(text) { $('notice').hidden = false; $('notice').textContent = text; }
if (location.hash === '#test-break-action') {
  notice('Take a break clicked on the test notification!');
  $('notice').classList.add('toast');
  history.replaceState(null, '', location.pathname + location.search);
  setTimeout(() => {
    $('notice').hidden = true;
    $('notice').classList.remove('toast');
  }, 4500);
}
function buttonIcon(button,d){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
  path.setAttribute('d',d);svg.append(path);button.classList.add('iconButton');button.replaceChildren(svg);
}
buttonIcon(document.querySelector('#search .go'),'M4 12h16m-7-7 7 7-7 7');
buttonIcon($('toggleTravel'),'M4 7v5h5M4.6 12a7.5 7.5 0 1 0 2.2-5.3M12 8v4l3 2');
for(const button of document.querySelectorAll('dialog button[aria-label^="Close"]'))buttonIcon(button,'M6 6l12 12M18 6 6 18');
const defaults = {
  pins: [['GitHub','https://github.com'],['Outlook','https://outlook.office.com'],['Teams','https://teams.microsoft.com'],['Microsoft Learn','https://learn.microsoft.com']],
  clocks: [['Eastern','America/New_York'],['Pacific','America/Los_Angeles'],['India','Asia/Kolkata'],['UTC','UTC']],
  done: []
};
function read(key) {
  try { const val = JSON.parse(localStorage.getItem('meridian.'+key)); return Array.isArray(val) ? val : defaults[key]; }
  catch { notice('Saved settings could not be read. Showing defaults.'); return defaults[key]; }
}
function save(key, val) { localStorage.setItem('meridian.'+key, JSON.stringify(val)); }
function readObject(key) {
  try {
    const value=JSON.parse(localStorage.getItem('meridian.'+key));
    return value && typeof value==='object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}
let draggedPin=null;
function pinSlot(e){
  let nearest=null, distance=Infinity;
  for(const [i,pin] of [...$('pins').querySelectorAll('.pin')].entries()){
    const r=pin.getBoundingClientRect();
    const dy=Math.max(r.top-e.clientY,0,e.clientY-r.bottom);
    for(const after of [false,true]){
      const d=Math.hypot(e.clientX-(after?r.right:r.left),dy);
      if(d<distance){distance=d;nearest={pin,after,index:i+Number(after)};}
    }
  }
  return nearest;
}
function clearPinLine(){for(const pin of $('pins').querySelectorAll('[data-drop]'))delete pin.dataset.drop;}
const pinTrash=$('pinTrash');
function endPinDrag(){
  draggedPin=null;clearPinLine();pinTrash.hidden=true;pinTrash.classList.remove('over');
  $('pins').querySelector('.dragging')?.classList.remove('dragging');
}
pinTrash.ondragover=e=>{
  if(draggedPin===null)return;
  e.preventDefault();e.dataTransfer.dropEffect='move';clearPinLine();pinTrash.classList.add('over');
};
pinTrash.ondragleave=e=>{if(!pinTrash.contains(e.relatedTarget))pinTrash.classList.remove('over');};
pinTrash.ondrop=e=>{
  if(draggedPin===null)return;
  e.preventDefault();const index=draggedPin;endPinDrag();
  save('pins',read('pins').filter((_,i)=>i!==index));pins();
};
$('pins').ondragover=e=>{
  if(draggedPin===null)return;
  e.preventDefault();e.dataTransfer.dropEffect='move';
  const slot=pinSlot(e);clearPinLine();slot.pin.dataset.drop=slot.after?'after':'before';
};
$('pins').ondragleave=e=>{if(!$('pins').contains(e.relatedTarget))clearPinLine();};
$('pins').ondrop=e=>{
  if(draggedPin===null)return;
  e.preventDefault();
  const from=draggedPin,slot=pinSlot(e).index;
  endPinDrag();movePin(from,slot>from?slot-1:slot);
};
function movePin(from,to){
  const items=read('pins');
  if(from===to||to<0||to>=items.length)return;
  items.splice(to,0,items.splice(from,1)[0]);save('pins',items);pins();
  $('pins').children[to].focus();
}
function siteMark(name,url){
  const mark=node('b','siteMark',name.slice(0,1));mark.ariaHidden='true';
  if(!address(url))return mark;
  if(new URL(url).hostname==='github.com')mark.classList.add('githubMark');
  const img=node('img');img.alt='';img.draggable=false;img.referrerPolicy='no-referrer';
  img.onload=()=>mark.replaceChildren(img);
  if(location.protocol==='chrome-extension:'){
    const icon=new URL(chrome.runtime.getURL('/_favicon/'));
    icon.searchParams.set('pageUrl',url);
    icon.searchParams.set('size','32');
    img.src=icon.href;
  }else img.src=new URL('/favicon.ico',url).href;
  return mark;
}
function pins() {
  const add=node('button','addPin','+');add.ariaLabel='Add pinned site';add.title='Add pinned site';
  buttonIcon(add,'M12 5v14M5 12h14');
  add.onclick=()=>{edit('pins',true);$('label').focus();};
  $('pins').replaceChildren(...read('pins').map(([name,url],i)=>{
    const a=node('a','pin'); a.href=address(url)||'#';
    const mark=siteMark(name,url);
    a.draggable=true;a.title='Drag to reorder, or use Alt + Left / Right';
    a.ondragstart=e=>{draggedPin=i;e.dataTransfer.setData('text/plain',name);e.dataTransfer.effectAllowed='move';a.classList.add('dragging');pinTrash.hidden=false;};
    a.ondragend=endPinDrag;
    a.onkeydown=e=>{if(e.altKey&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();movePin(i,i+(e.key==='ArrowRight'?1:-1));}};
    a.append(mark,name); return a;
  }),add);
}
const terrains=[
  ['#ffdcca','#503b38','#de9d85','#a96257','#ffefb9'],
  ['#293650','#f5efff','#535878','#373e64','#f4e3bf'],
  ['#d6ece7','#1e4944','#8cbab2','#4d8c85','#fff2c3'],
  ['#f3e7bd','#4b4833','#c8bc86','#948b61','#fff5d5']
];
function horizon(hour) {
  const night=hour<6||hour>=20, p=terrains[night?1:hour<11?3:hour<16?2:0];
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 270 140');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  // All geometry and pigments are local constants, never snapshot or preference text.
  svg.innerHTML=`<defs><pattern id="grain${hour}" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".55" fill="${p[1]}" opacity=".3"/></pattern></defs>
  ${night?'<path d="M215 17a15 15 0 1 0 18 18 17 17 0 0 1-18-18" fill="#f3e5c4"/><path d="M182 18h3m49 38h3m-77-22h2m90-20h2" stroke="#fff"/>':`<circle cx="214" cy="${hour<11?52:hour<16?31:65}" r="16" fill="${p[4]}"/>`}
  <path d="M0 126Q45 111 82 114T152 97Q186 84 207 73T270 51V140H0Z" fill="${p[2]}"/>
  <path d="M0 134Q55 122 95 125T177 107Q210 90 236 89T270 80V140H0Z" fill="${p[3]}"/>
  <path d="M0 134Q55 122 95 125T177 107Q210 90 236 89T270 80V140H0Z" fill="url(#grain${hour})"/>`;
  return [p,svg];
}
$('primaryClock').onchange=e=>{localStorage.setItem('meridian.primaryClock',e.target.value);clocks();};
let travelMinutes=0;
const travelRange=$('travelRange');
$('toggleTravel').onclick=()=>{
  const panel=$('timeTravel'),willOpen=panel.hidden;
  panel.hidden=!willOpen;
  $('toggleTravel').setAttribute('aria-expanded',String(willOpen));
  if(willOpen)travelRange.focus();
  else if(travelMinutes!==0){travelRange.value='0';syncTravel();}
};
function travelMoment(){return new Date(Date.now()+travelMinutes*60000);}
function syncTravel(){
  travelMinutes=Number(travelRange.value);
  const moment=travelMoment(), label=$('travelLabel');
  $('travelNow').disabled=travelMinutes===0;
  if(travelMinutes===0)label.textContent='Now';
  else{
    const day=travelMinutes===1440?'Tomorrow':moment.toLocaleDateString(undefined,{weekday:'short'});
    label.textContent=`${day} · ${moment.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})} · +${travelMinutes/60}h`;
  }
  travelRange.setAttribute('aria-valuetext',label.textContent);
  clocks();
}
travelRange.oninput=syncTravel;
$('travelNow').onclick=()=>{travelRange.value='0';syncTravel();travelRange.focus();};
function clocks() {
  const now=travelMoment();
  const list=read('clocks'), picker=$('primaryClock'), saved=localStorage.getItem('meridian.primaryClock');
  const primary=list.find(c=>JSON.stringify(c)===saved)||list.find(c=>c[1]==='America/New_York')||list[0]||defaults.clocks[0];
  const choices=list.length?list:[primary];
  if(picker.dataset.list!==JSON.stringify(choices)){
    picker.replaceChildren(...choices.map(c=>new Option(c[0],JSON.stringify(c))));
    picker.dataset.list=JSON.stringify(choices);
  }
  picker.value=JSON.stringify(primary);picker.disabled=!list.length;
  $('primaryName').textContent=primary[0];
  const zone={timeZone:primary[1]};
  const liveNow=new Date();
  const parts=new Intl.DateTimeFormat('en-US',{...zone,hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(liveNow);
  const dialValue=type=>Number(parts.find(p=>p.type===type).value);
  const minute=dialValue('minute');
  $('hourHand').setAttribute('transform',`rotate(${dialValue('hour')%12*30+minute/2} 32 32)`);
  $('minuteHand').setAttribute('transform',`rotate(${minute*6} 32 32)`);
  $('primaryNow').replaceChildren(...parts.map(part=>
    part.type==='dayPeriod'?node('span','primaryDayPeriod',part.value):document.createTextNode(part.value)));
  $('today').textContent=liveNow.toLocaleDateString(undefined,{...zone,weekday:'short',month:'short',day:'numeric',year:'numeric'});
  $('clocks').replaceChildren(...list.map(([name,timeZone])=>{
    const fmt=options=>new Intl.DateTimeFormat('en-GB',{...options,timeZone}).format(now);
    const time=fmt({hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    const [colors,art]=horizon(Number(time.slice(0,2)));
    const card=node('div','clock');card.style.setProperty('--sky',colors[0]);card.style.setProperty('--sky-ink',colors[1]);
    const primary=node('time','',fmt({hour:'numeric',minute:'2-digit',hourCycle:'h12'}).toUpperCase());
    primary.dateTime=time;
    const zonePart=new Intl.DateTimeFormat('en-US',{timeZone,timeZoneName:'longOffset'}).formatToParts(now).find(part=>part.type==='timeZoneName').value;
    const offset=zonePart==='GMT'?'UTC+00:00':zonePart.replace('GMT','UTC');
    card.append(art,node('strong','',name),primary,node('small','',`${time} · ${offset}`),node('small','',fmt({weekday:'short',day:'numeric',month:'short'})));return card;
  }));
}
let editing;
function editPin(index,name,url){
  const dialog=$('pinEditDialog'),field=$('pinEditUrl'),title=$('pinEditName');
  title.value=name;field.value=url;field.setCustomValidity('');title.setCustomValidity('');
  $('pinEditForm').onsubmit=e=>{
    e.preventDefault();
    const updatedUrl=address(field.value.trim()),updatedName=title.value.trim();
    if(!updatedName){title.setCustomValidity('Enter a name.');title.reportValidity();return;}
    if(!updatedUrl){field.setCustomValidity('Enter an http or https address.');field.reportValidity();return;}
    const items=read('pins');
    if(items[index]?.[0]!==name||items[index]?.[1]!==url){field.setCustomValidity('This pin changed. Cancel and reopen it.');field.reportValidity();return;}
    items[index]=[updatedName,updatedUrl];save('pins',items);dialog.close();listEntries();pins();
    $('entries').children[index]?.querySelector('button')?.focus();
  };
  dialog.showModal();title.select();
}
$('cancelPinEdit').onclick=()=>$('pinEditDialog').close();
for(const id of ['pinEditName','pinEditUrl'])$(id).oninput=e=>e.target.setCustomValidity('');
function listEntries(){
  $('entries').replaceChildren(...read(editing).map(([name,value],i)=>{
    const row=node('div','entry'), info=node('div'), remove=node('button','','Remove');
    info.append(name,node('div','meta',value)); remove.ariaLabel='Remove '+name;
    remove.onclick=()=>{save(editing,read(editing).filter((_,j)=>i!==j));listEntries();pins();clocks();};
    if(editing==='pins'){
      const pencil=node('button'),actions=node('span','pinActions');
      pencil.ariaLabel=pencil.title='Edit '+name;remove.title=remove.ariaLabel;
      buttonIcon(pencil,'M4 20l4.8-1 12-12-3.8-3.8-12 12L4 20Zm10-14 3.8 3.8');
      buttonIcon(remove,'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7');
      pencil.onclick=()=>editPin(i,name,value);actions.append(pencil,remove);info.title=value;
      row.append(siteMark(name,value),info,actions);return row;
    }
    row.append(info,remove);return row;
  }));
}
function edit(key,addOnly=false) {
  editing=key;const sites=key==='pins';$('editorTitle').textContent=sites?'Pinned sites':'World clock';
  $('editor').classList.toggle('pinEditor',sites);
  $('addSiteHeading').hidden=!sites||addOnly;
  $('add').querySelector('.primary').textContent=sites?'Pin site':'Add';
  $('primarySetting').hidden=sites;
  $('entries').hidden=addOnly;if(addOnly)$('editorTitle').textContent='Add pinned site';
  $('valueLabel').firstChild.textContent=sites?'Website address':'Time zone';$('value').placeholder=sites?'https://example.com':'Europe/Paris';
  $('value').setAttribute('list',sites?'':'zones');$('add').reset();$('value').setCustomValidity('');listEntries();$('editor').showModal();
  openPinSources(sites);
}
const zones=node('datalist');zones.id='zones';
for(const z of ['UTC',...Intl.supportedValuesOf('timeZone')])zones.append(new Option(z,z));
document.body.append(zones);
$('editPins').onclick=()=>edit('pins');$('editClocks').onclick=()=>edit('clocks');$('close').onclick=()=>$('editor').close();
$('value').oninput=()=>$('value').setCustomValidity('');
$('add').onsubmit=e=>{
  e.preventDefault();let val=$('value').value.trim();const name=$('label').value.trim();
  if(!name){$('label').focus();return;}
  try{
    if(editing==='pins'){val=address(val);if(!val)throw Error('Enter an http or https address.');}
    else new Intl.DateTimeFormat('en',{timeZone:val});
  }catch{ $('value').setCustomValidity(editing==='pins'?'Enter an http or https address.':'Choose a valid time zone.');$('value').reportValidity();return;}
  save(editing,[...read(editing),[name,val]]);$('add').reset();listEntries();pins();clocks();
  if($('entries').hidden){$('editor').close();$('pins').querySelector('.addPin').focus();}
};
function linked(title,url) {
  const href=address(url); const el=node(href?'a':'span','title',title);
  if(href)el.href=href;return el;
}
let current;
function prColumns(group){
  const columns=node('div','prColumns');
  for(const heading of ['For review','Yours']){
    const column=node('div','prColumn'), items=group.items.filter(p=>(p.role==='Yours')===(heading==='Yours'));
    column.append(node('h3','',heading));
    for(const p of items){
      const row=node('div','pr');row.append(node('span','meta','#'+p.id),linked(p.title,p.url));column.append(row);
    }
    if(!items.length)column.append(node('p','empty',heading==='Yours'?'No PRs of yours in this snapshot.':'No PRs awaiting your review in this snapshot.'));
    columns.append(column);
  }
  $('prs').replaceChildren(columns);
}
const refreshPopover=$('refreshPopover');
let warningButton;
function warningDetail(note){
  const match=String(note||'').match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})):\s*(.+)$/);
  const stamp=match?.[1], raw=match?.[2]||String(note||'Update failed.');
  const reason=/WorkIQ requires sign-in|HTTP 401/i.test(raw)?
    'Sign in to WorkIQ to resume updates. Showing the previous snapshot.':
    raw.replace(/;\s*refresh paused until reauthenticated\.?/i,'.');
  return {stamp:Number.isFinite(Date.parse(stamp))?stamp:null,reason};
}
function setRefreshWarning(key,note){
  const button=$(key+'Warning');
  if(warningButton===button&&refreshPopover.matches(':popover-open')&&button.dataset.note!==(note||''))refreshPopover.hidePopover();
  button.hidden=!note;
  button.dataset.note=note||'';
}
for(const button of document.querySelectorAll('.refreshWarning')){
  button.onclick=()=>{
    if(refreshPopover.matches(':popover-open')&&warningButton===button){refreshPopover.hidePopover();return;}
    if(refreshPopover.matches(':popover-open'))refreshPopover.hidePopover();
    const detail=warningDetail(button.dataset.note);
    $('refreshFailureTime').textContent=detail.stamp?new Date(detail.stamp).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Time unavailable';
    $('refreshFailureTime').dateTime=detail.stamp||'';
    $('refreshFailureReason').textContent=detail.reason;
    warningButton=button;refreshPopover.showPopover();
    const rect=button.getBoundingClientRect(),width=Math.min(320,innerWidth-24);
    refreshPopover.style.width=width+'px';
    refreshPopover.style.left=Math.max(12,Math.min(innerWidth-width-12,rect.right-width))+'px';
    refreshPopover.style.top=Math.min(innerHeight-refreshPopover.offsetHeight-12,rect.bottom+7)+'px';
  };
}
refreshPopover.addEventListener('toggle',event=>{
  if(warningButton)warningButton.setAttribute('aria-expanded',String(event.newState==='open'));
  if(event.newState==='closed')warningButton=null;
});
function feed(data) {
  current=data;
  const generated=$('briefGenerated'), stamp=data.actions.generatedAt;
  if(Number.isFinite(Date.parse(stamp))){
    generated.dateTime=stamp;
    const mins=Math.max(0,Math.floor((Date.now()-Date.parse(stamp))/60000));
    generated.textContent=mins===0?'Generated just now':`Generated ${mins} ${mins===1?'min':'mins'} ago`;
    generated.title=new Date(stamp).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  }else{
    generated.removeAttribute('datetime');generated.removeAttribute('title');generated.textContent='Generation time unavailable';
  }
  updateArtwork(data);
  const done=read('done');const when=d=>new Date(d).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const rendering={
    actions:a=>{
      const row=node('div','entry'), box=node('input'),body=node('div');box.type='checkbox';box.checked=done.includes(a.id)||Boolean(a.completion);box.disabled=Boolean(a.completion);box.ariaLabel=a.title;
      box.onchange=()=>{
        save('done',box.checked?[...new Set([...read('done'),a.id])]:read('done').filter(x=>x!==a.id));
        const dates=readObject('doneDates');
        if(box.checked)dates[a.id]=localDate(new Date());else delete dates[a.id];
        localStorage.setItem('meridian.doneDates',JSON.stringify(dates));
        renderConstellation(data);
      };
      body.append(linked(a.title,a.url));
      if(a.context)body.append(node('p','briefContext',a.context));
      body.append(node('div','meta',a.source));
      if(a.completion){
        const evidence=node('div','meta',`Completed by Copilot · ${a.completion.date} · ${a.completion.reason} `);
        const source=linked(a.completion.source,a.completion.url);source.className='text';evidence.append(source);body.append(evidence);
      }
      row.append(box,body);return row;
    },
    agenda:e=>{const row=node('div','entry'),b=node('div');b.append(node('div','meta',e.allDay?'All day · '+new Date(e.start).toLocaleDateString():when(e.start)),linked(e.title,e.url));row.append(b);return row;},
  };
  prColumns(data.prs);
  for(const [key,render] of Object.entries(rendering)){
    const group=data[key];let items=group.items;
    if(key==='agenda')items=items.filter(e=>Date.parse(e.end)>Date.now()&&!/\b(?:oof|dto|ooo|out[\s-]+of[\s-]+office)\b/i.test(e.title)).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)).slice(0,4);
    $(key).replaceChildren(...items.map(render));
    if(key==='actions'&&group.focus){
      $(key).prepend(node('p','briefFocus',group.focus));
    }
    setRefreshWarning(key,group.note);
    if(!items.length)$(key).append(node('p','empty',{actions:'No open action items in this briefing.',agenda:'No upcoming events in the saved window.',prs:'No active pull requests in this snapshot.'}[key]));
  }
  setRefreshWarning('prs',data.prs.note);
  $('stamp').textContent='Local snapshot · '+when(data.updated)+(Date.now()-Date.parse(data.updated)>90*60000?' · Refresh overdue':'');
  renderConstellation(data);
}
function localDate(date){
  const offset=date.getTimezoneOffset()*60000;
  return new Date(date-offset).toISOString().slice(0,10);
}
function renderConstellation(data){
  const figure=$('constellation'), svg=figure.querySelector('svg'), caption=$('constellationCaption');
  const today=localDate(new Date()), dates=readObject('doneDates');
  const completed=data.actions.items.filter(action =>
    dates[action.id]===today || action.completion && localDate(new Date(action.completion.date))===today);
  svg.replaceChildren();
  const ns='http://www.w3.org/2000/svg';
  const point=seed=>{
    let hash=2166136261;
    for(const char of seed)hash=Math.imul(hash^char.charCodeAt(0),16777619);
    return {x:24+(hash>>>0)%472,y:18+((hash>>>8)>>>0)%62,r:2+((hash>>>16)>>>0)%3};
  };
  const points=completed.map(action=>point(today+action.id));
  figure.classList.toggle('populated',completed.length>0);
  if(points.length>1){
    const line=document.createElementNS(ns,'polyline');
    line.setAttribute('points',points.map(({x,y})=>`${x},${y}`).join(' '));
    line.setAttribute('class','constellationLine');svg.append(line);
  }
  for(const {x,y,r} of points){
    const star=document.createElementNS(ns,'path');
    star.setAttribute('d',`M${x} ${y-r*2}L${x+r*.7} ${y-r*.7}L${x+r*2} ${y}L${x+r*.7} ${y+r*.7}L${x} ${y+r*2}L${x-r*.7} ${y+r*.7}L${x-r*2} ${y}L${x-r*.7} ${y-r*.7}Z`);
    star.setAttribute('class','constellationStar');svg.append(star);
  }
  caption.textContent=completed.length ? 'Tonight’s constellation, drawn from tasks completed today.' : 'Complete a task today to place a star in tonight’s sky.';
}
async function refresh() {
  try{
    const r=await fetch('briefing.json',{cache:'no-store'});if(!r.ok)throw Error();
    const data=await r.json();feed(data);
  }catch{
    if(current){feed(current);return;}
    const now=new Date(),updated=now.toISOString(),date=updated.slice(0,10);
    feed({
      art:{date,style:'contours',seed:Number(date.replaceAll('-',''))%360,palette:now.getDay()%3,events:0,prs:0,actions:0},
      updated,
      agenda:{items:[]},
      actions:{generatedAt:updated,focus:'Add a local briefing.json snapshot to populate this briefing.',items:[]},
      prs:{items:[]}
    });
  }
}
$('query').placeholder='Search your history or the web...';
$('mode').onchange=()=>{const ai=$('mode').value==='Copilot';$('query').placeholder=ai?'Write a prompt for Microsoft 365 Copilot':'Search your history or the web...';$('search').querySelector('button').ariaLabel=ai?'Copy prompt and open Copilot':'Run search';$('notice').hidden=!ai;if(ai)notice('Your prompt will be copied. Paste it into Microsoft 365 Copilot.');};
$('search').onsubmit=async e=>{
  e.preventDefault();const q=$('query').value.trim();if(!q)return;
  if($('mode').value==='Web'){location.assign('https://www.bing.com/search?q='+encodeURIComponent(q));return;}
  try{await navigator.clipboard.writeText(q);location.assign('https://m365.cloud.microsoft/chat');}
  catch{ $('query').select();notice('Clipboard access is unavailable. Copy the selected prompt, then ');const a=node('a','','open Microsoft 365 Copilot ↗');a.href='https://m365.cloud.microsoft/chat';$('notice').append(a); }
};
let lastClockMinute;
function tickDial(){
  const now=new Date(), minute=Math.floor(now.getTime()/60000);
  $('secondHand').setAttribute('transform',`rotate(${now.getSeconds()*6} 32 32)`);
  if(minute!==lastClockMinute){lastClockMinute=minute;clocks();}
}
pins();tickDial();refresh();
setInterval(()=>{if(!document.hidden)tickDial();},1000);
setInterval(()=>{if(!document.hidden)refresh();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){tickDial();refresh();}});
