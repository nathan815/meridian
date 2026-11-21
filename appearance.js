'use strict';
const updateArtwork = (() => {
  const el=id=>document.getElementById(id);
  const ideas=[
    ['contours','Calendar contours','Each saved event adds a contour to the ridgelines.'],
    ['orbits','Review orbits','Each saved PR adds an orbit and a satellite.'],
    ['loom','Action loom','Each briefing item adds a colored thread to the weave.'],
    ['ribbons','Signal ribbons','Fine waveform traces fold into layered ribbons.'],
    ['glass','Prism field','Translucent triangular facets meet along irregular seams.'],
    ['rosette','Spiral garden','Tiny tapered leaves spiral outward in a sunflower pattern.']
  ];
  const theme=el('theme'), media=matchMedia('(prefers-color-scheme: dark)');
  const pref=key=>localStorage.getItem('meridian.'+key);
  const persist=(key,value)=>localStorage.setItem('meridian.'+key,value);
  const defaultSolarSchedule=['06:00','18:00'];
  const savedTheme=pref('theme');
  let mode=['dark','light','solar'].includes(savedTheme)?savedTheme:'system';
  theme.querySelector(`input[value="${mode}"]`).checked=true;
  function solarMessage(schedule, detail){
    el('solarSchedule').textContent=schedule;
    el('solarStatus').textContent=detail;
  }
  function savedCoordinates(){
    const coords=(pref('solarCoords')||'').split(',').map(Number);
    return coords.length===2&&coords.every(Number.isFinite)?coords:null;
  }
  function fixedSchedule(){
    try{
      const saved=JSON.parse(pref('solarSchedule'));
      return Array.isArray(saved)&&saved.length===2&&saved.every(value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value))&&saved[0]!==saved[1]?saved:defaultSolarSchedule;
    }catch{
      return defaultSolarSchedule;
    }
  }
  function timeLabel(value){
    const [hour,minute]=value.split(':').map(Number);
    return new Date(2000,0,1,hour,minute).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}).replace(':00','').toLowerCase();
  }
  function fixedScheduleLabel(){
    const [light,dark]=fixedSchedule();
    return `Fixed ${timeLabel(light)}–${timeLabel(dark)} local time`;
  }
  function coordinateLabel([lat,lon]){
    const direction=(value,positive,negative)=>`${Math.abs(value)}° ${value>=0?positive:negative}`;
    return `${direction(lat,'N','S')}, ${direction(lon,'E','W')}`;
  }
  function civilTwilight(now,coords){
    const threshold=MeridianSolar.civilTwilightThreshold, dayStart=new Date(now), dayEnd=new Date(now);
    dayStart.setHours(0,0,0,0);
    dayEnd.setHours(24,0,0,0);
    const end=dayEnd.getTime(), step=10*60000;
    let previous=dayStart.getTime(), previousAbove=MeridianSolar.solarElevation(new Date(previous),coords)>=threshold;
    const result={dawn:null,dusk:null,above:previousAbove};
    for(let current=previous+step;current<=end;current+=step){
      const currentAbove=MeridianSolar.solarElevation(new Date(current),coords)>=threshold;
      if(currentAbove!==previousAbove){
        let low=previous,high=current;
        for(let index=0;index<16;index++){
          const middle=(low+high)/2, middleAbove=MeridianSolar.solarElevation(new Date(middle),coords)>=threshold;
          if(middleAbove===previousAbove)low=middle;else high=middle;
        }
        result[currentAbove?'dawn':'dusk']=high;
      }
      previous=current;
      previousAbove=currentAbove;
    }
    return result;
  }
  function twilightLabel(now,coords){
    const twilight=civilTwilight(now,coords);
    const display=value=>new Date(value).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
    if(twilight.dawn&&twilight.dusk)return `Today: civil dawn ${display(twilight.dawn)}, dusk ${display(twilight.dusk)}.`;
    if(twilight.dawn)return `Today: civil dawn ${display(twilight.dawn)}; no civil dusk crossing.`;
    if(twilight.dusk)return `Today: no civil dawn crossing; dusk ${display(twilight.dusk)}.`;
    return `Today: no civil dawn or dusk crossing; the sun remains ${twilight.above?'above':'below'} civil twilight.`;
  }
  function locationFailure(error){
    const coords=savedCoordinates();
    const providerMessage=typeof error?.message==='string'&&error.message.trim()?` ${error.message.trim()}`:'';
    const reason=error?.code===1?'Location access is blocked. Allow location for Meridian in your browser settings.':
      error?.code===2?`The location provider could not determine a position.${providerMessage}`:
      error?.code===3?'Location detection timed out. Check that Windows Location Services is enabled.':
      `Location detection failed.${providerMessage}`;
    if(coords) solarMessage('Location-based civil dawn to dusk',`${reason} Still using saved detected location: ${coordinateLabel(coords)}. ${twilightLabel(new Date(),coords)}`);
    else solarMessage(fixedScheduleLabel(),`${reason} Location is not being used.`);
  }
  function detectPosition(){
    return new Promise((resolve,reject)=>{
      let settled=false,timer;
      const finish=callback=>value=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        callback(value);
      };
      timer=setTimeout(()=>finish(reject)({code:3}),13000);
      navigator.geolocation.getCurrentPosition(finish(resolve),finish(reject),{timeout:12000});
    });
  }
  function solarTone(now){
    const coords=savedCoordinates();
    if(!coords){
      el('useFixedSchedule').hidden=true;
      const [light,dark]=fixedSchedule(), current=now.getHours()*60+now.getMinutes();
      const [lightHour,lightMinute]=light.split(':').map(Number), [darkHour,darkMinute]=dark.split(':').map(Number);
      const lightAt=lightHour*60+lightMinute, darkAt=darkHour*60+darkMinute;
      const isLight=lightAt<darkAt?current>=lightAt&&current<darkAt:current>=lightAt||current<darkAt;
      solarMessage(fixedScheduleLabel(),'Location is not being used. Use your location for civil dawn and dusk.');
      return isLight?'light':'dark';
    }
    el('useFixedSchedule').hidden=false;
    solarMessage('Location-based civil dawn to dusk',`Saved detected location: ${coordinateLabel(coords)}. ${twilightLabel(now,coords)}`);
    return MeridianSolar.solarElevation(now,coords)>=MeridianSolar.civilTwilightThreshold?'light':'dark';
  }
  function tone(){
    el('solarOptions').hidden=mode!=='solar';
    document.documentElement.dataset.tone=mode==='solar'?solarTone(new Date()):mode==='system'?(media.matches?'dark':'light'):mode;
  }
  const solarLocation=el('solarLocation');
  el('useFixedSchedule').onclick=()=>{
    localStorage.removeItem('meridian.solarCoords');
    tone();
    el('solarStatus').textContent='Location disabled. Using your saved fixed schedule.';
  };
  solarLocation.onclick=async()=>{
    if(location.protocol!=='chrome-extension:'){
      solarMessage(savedCoordinates()?'Location-based civil dawn to dusk':fixedScheduleLabel(),'Location detection is available in the installed extension.');
      return;
    }
    if(!navigator.geolocation){locationFailure({code:2});return;}
    solarLocation.disabled=true;
    solarLocation.textContent='Detecting…';
    el('solarStatus').textContent='Waiting for the browser to detect your location…';
    try{
      const {coords}=await detectPosition();
      if(!Number.isFinite(coords?.latitude)||!Number.isFinite(coords?.longitude))throw {code:2};
      const detected=[Math.round(coords.latitude),Math.round(coords.longitude)];
      persist('solarCoords',detected.join(','));
      tone();
      solarMessage('Location-based civil dawn to dusk',`Detected location saved: ${coordinateLabel(detected)}. ${twilightLabel(new Date(),detected)}`);
    }catch(error){
      locationFailure(error);
    }finally{
      solarLocation.disabled=false;
      solarLocation.textContent='Use my location';
    }
  };
  const solarScheduleDialog=el('solarScheduleDialog'), solarScheduleForm=el('solarScheduleForm');
  el('editSolarSchedule').onclick=()=>{
    [el('solarLightStart').value,el('solarDarkStart').value]=fixedSchedule();
    solarScheduleDialog.showModal();
  };
  el('cancelSolarSchedule').onclick=()=>solarScheduleDialog.close();
  for(const id of ['solarLightStart','solarDarkStart'])el(id).oninput=()=>el('solarDarkStart').setCustomValidity('');
  solarScheduleForm.onsubmit=event=>{
    event.preventDefault();
    const schedule=[el('solarLightStart').value,el('solarDarkStart').value];
    if(schedule[0]===schedule[1]){
      el('solarDarkStart').setCustomValidity('Light and dark times must be different.');
      el('solarDarkStart').reportValidity();
      return;
    }
    persist('solarSchedule',JSON.stringify(schedule));
    solarScheduleDialog.close();
    tone();
  };
  setInterval(()=>{if(!document.hidden&&mode==='solar')tone();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tone();});
  theme.onchange=e=>{mode=e.target.value;persist('theme',mode);tone();};media.addEventListener('change',tone);tone();
  const appearanceDialog=el('appearance'), settingsDialog=el('settings');
  el('appearanceButton').onclick=()=>appearanceDialog.showModal();
  el('settingsButton').onclick=()=>settingsDialog.showModal();
  el('settingsAppearance').onclick=()=>{
    settingsDialog.close();
    requestAnimationFrame(()=>appearanceDialog.showModal());
  };
  const ns='http://www.w3.org/2000/svg';
  function shape(parent,tag,attrs){
    const n=document.createElementNS(ns,tag);
    for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);
    parent.append(n);return n;
  }
  function contours(svg,n,phase,colors){
    for(const [x,y,scale] of [[85,170,1],[900,90,.86],[730,650,1.3]]){
      const g=shape(svg,'g',{transform:`translate(${x} ${y}) scale(${scale})`});
      for(let j=0;j<7+n;j++){
        const r=24+j*16;const points=[];
        for(let i=0;i<120;i++){
          const a=i*Math.PI/60, wave=1+.15*Math.sin(3*a+phase)+.1*Math.cos(5*a-phase);
          points.push(`${(r*wave*Math.cos(a)*1.42).toFixed(1)},${(r*wave*Math.sin(a)).toFixed(1)}`);
        }
        shape(g,'polygon',{points:points.join(' '),fill:j===0?colors[1]:'none',stroke:colors[j%3],opacity:j===0?.85:.58,'stroke-width':j%4===0?2.3:1.2});
      }
    }
  }
  function orbits(svg,n,phase,colors){
    for(const [x,y,k] of [[95,185,1],[900,440,.92]]){
      const g=shape(svg,'g',{transform:`translate(${x} ${y}) rotate(${-30+phase*3}) scale(${k})`});
      shape(g,'circle',{r:44,fill:colors[1],opacity:.78});
      for(let i=0;i<n;i++){
        const rx=90+i*39,ry=48+i*23,a=i*2.4+phase;
        shape(g,'ellipse',{rx,ry,fill:'none',stroke:colors[i%3],'stroke-width':2,opacity:.75});
        shape(g,'circle',{cx:rx*Math.cos(a),cy:ry*Math.sin(a),r:6+i%3*3,fill:colors[i%3]});
      }
    }
  }
  function loom(svg,n,phase,colors){
    const g=shape(svg,'g',{transform:`rotate(${-27+phase*2} 500 300)`});
    for(let i=-6;i<18;i++){
      const x=i*82;
      shape(g,'path',{d:`M${x} -450v1500`,stroke:colors[0],'stroke-width':29,opacity:.27});
      for(let j=0;j<n;j++){
        const y=-420+j*15;
        shape(g,'path',{d:`M-350 ${i*82+y}h1700`,stroke:colors[1+j%2],'stroke-width':8,opacity:.64});
      }
      for(let k=-6;k<16;k+=2)shape(g,'rect',{x:x-14,y:(k+(i&1))*82-13,width:28,height:26,fill:colors[0],opacity:.68});
    }
  }
  function ribbons(svg,n,phase,colors){
    for(let band=0;band<3;band++){
      const g=shape(svg,'g',{fill:'none',stroke:colors[band],opacity:.78});
      for(let j=0;j<20+n;j++){
        const points=[];
        for(let x=-15;x<=1020;x+=15){
          const a=x/166+phase+band*.88;
          points.push(`${x},${(98+band*192+Math.sin(a)*97+Math.sin(2*a+j*.047)*(27+j*2)+j*2).toFixed(1)}`);
        }
        shape(g,'polyline',{points:points.join(' '),'stroke-width':j%7===0?2.3:1.15});
      }
    }
  }
  function glass(svg,n,phase,colors){
    const tile=136-n*3;
    const vertex=(x,y)=>[x*tile+tile*.29*Math.sin(x*3+y*7+phase),y*tile+tile*.28*Math.cos(y*5-x*3+phase)];
    for(let y=-1;y<Math.ceil(600/tile)+1;y++)for(let x=-1;x<Math.ceil(1000/tile)+1;x++){
      const a=vertex(x,y),b=vertex(x+1,y),c=vertex(x+1,y+1),d=vertex(x,y+1);
      for(const [k,poly] of [[0,[a,b,c]],[1,[a,c,d]]]){
        const light=(1+Math.sin(x*2-y*5+k*3+phase))/2;
        shape(svg,'polygon',{points:poly.join(' '),fill:colors[Math.abs(x+y*2+k)%3],'fill-opacity':.07+.52*light,stroke:'var(--ground)','stroke-width':1.4});
      }
    }
  }
  function rosette(svg,n,phase,colors){
    for(const [cx,cy,scale] of [[85,145,1],[917,470,1.3]]){
      const g=shape(svg,'g',{transform:`translate(${cx} ${cy}) scale(${scale})`});
      for(let j=0;j<100+n*5;j++){
        const a=j*2.399963+phase,r=Math.sqrt(j)*19;
        shape(g,'path',{d:'M-8 0Q-1-8 13 0Q2 7-8 0Z',transform:`translate(${r*Math.cos(a)} ${r*Math.sin(a)}) rotate(${a*180/Math.PI+25}) scale(${.45+Math.sqrt(j)/9})`,fill:colors[Math.floor(Math.sqrt(j))%3],opacity:.4+.45*(1+Math.cos(a))/2});
      }
    }
  }
  let postcardId=0;
  function postcard(svg,recipe){
    const meetings=Array.from({length:24},(_,hour)=>Math.max(0,Math.min(60,Number(recipe.meetings?.[hour])||0)));
    const seed=Number.isInteger(recipe.seed)?recipe.seed:0;
    const variation=((Number.isInteger(recipe.hue)?recipe.hue:seed*37)%360+360)%360;
    const skyHue=202+Math.round(18*Math.sin(variation*Math.PI/180));
    const landHue=174+Math.round(25*Math.cos((variation+35)*Math.PI/180));
    const sunHue=35+Math.round(11*Math.sin((variation+120)*Math.PI/180));
    const id=`postcard-${postcardId++}`;
    const defs=shape(svg,'defs',{});
    const sky=shape(defs,'linearGradient',{id:`${id}-sky`,x1:0,y1:0,x2:0,y2:1});
    shape(sky,'stop',{offset:0,'stop-color':'var(--ground)'});
    shape(sky,'stop',{offset:.7,'stop-color':`hsl(${skyHue} 30% 56%)`,'stop-opacity':.2});
    shape(sky,'stop',{offset:1,'stop-color':`hsl(${sunHue} 45% 66%)`,'stop-opacity':.17});
    shape(svg,'rect',{width:1000,height:600,fill:`url(#${id}-sky)`});

    const sunLeft=seed%2===0;
    const sunX=sunLeft?128+(seed*17)%105:767+(seed*17)%105;
    shape(svg,'circle',{cx:sunX,cy:112+(seed*13)%54,r:34+(seed%4)*4,fill:`hsl(${sunHue} 56% 68%)`,opacity:.36});
    shape(svg,'path',{d:'M0 354C155 345 268 359 413 351S739 347 1000 356',fill:'none',stroke:`hsl(${skyHue} 34% 66%)`,'stroke-width':2,opacity:.32});

    const scheduleHeight=x=>{
      let height=0;
      for(let hour=0;hour<24;hour++){
        const distance=(x-hour/23*1000)/52;
        height+=meetings[hour]/60*Math.exp(-distance*distance);
      }
      return height;
    };
    const ridgePath=(baseline,amplitude,calendarScale,phase)=>{
      const points=[];
      for(let x=0;x<=1000;x+=10){
        const edge=.18+.82*Math.pow(Math.abs(x-500)/500,1.55);
        const terrain=Math.sin(x/93+phase)*.48+Math.sin(x/39-phase*1.7)*.24+Math.sin(x/17+phase*.6)*.08;
        const calendar=scheduleHeight(x)*calendarScale*(.55+.45*edge);
        const y=baseline-terrain*amplitude*edge-calendar;
        points.push(`${x},${y.toFixed(1)}`);
      }
      return `M0 600L${points.join('L')}L1000 600Z`;
    };
    const layers=[
      [398,50,24,seed*.031,skyHue-8,25,43,.46],
      [448,70,38,seed*.047+1.7,landHue+18,28,37,.58],
      [510,92,52,seed*.061+3.1,landHue,31,30,.72],
      [568,118,67,seed*.079+4.6,landHue-18,34,23,.84]
    ];
    for(const [baseline,amplitude,calendarScale,phase,hue,saturation,lightness,opacity] of layers){
      shape(svg,'path',{d:ridgePath(baseline,amplitude,calendarScale,phase),fill:`hsl(${hue} ${saturation}% ${lightness}%)`,opacity});
    }

    for(const [y,width,opacity] of [[442,32,.14],[493,24,.12]]){
      shape(svg,'path',{d:`M0 ${y}C180 ${y-13} 282 ${y+14} 445 ${y+2}S724 ${y-10} 1000 ${y+4}`,fill:'none',stroke:'var(--ground)','stroke-width':width,opacity,'stroke-linecap':'round'});
    }
    const tree=([x,y,height],flip)=>{
      const direction=flip?-1:1;
      shape(svg,'path',{d:`M${x} ${y}v${-height}m0 ${height*.22}l${direction*height*.2} ${height*.28}m${-direction*height*.2} ${-height*.13}l${-direction*height*.24} ${height*.31}`,fill:'none',stroke:`hsl(${landHue-22} 31% 19%)`,'stroke-width':Math.max(2,height*.045),opacity:.62,'stroke-linecap':'round'});
    };
    const edgeTrees=[
      [38,546,58],[82,525,82],[132,548,50],
      [868,542,54],[920,517,88],[968,545,62]
    ];
    edgeTrees.forEach((treeData,index)=>tree(treeData,index>2));
  }
  const renderers={contours,orbits,loom,ribbons,glass,rosette};
  const bounded=n=>Math.min(12,Math.max(0,Number.isInteger(n)?n:0));
  let state,lastKey;
  function art(target,kind,recipe){
    const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1000 600');svg.setAttribute('preserveAspectRatio','xMidYMid slice');svg.setAttribute('aria-hidden','true');
    let colors=['var(--a)','var(--b)','var(--c)'];
    const offset=state?.palette??0;colors=colors.slice(offset).concat(colors.slice(0,offset));
    if(Number.isInteger(recipe?.hue))colors=[0,38,151].map((shift,i)=>`hsl(${(recipe.hue+shift)%360} ${46+i*9}% ${48+i*6}%)`);
    if(kind==='postcard')postcard(svg,recipe);
    else{
      const density=state[kind]??({ribbons:state.actions,glass:state.contours,rosette:state.orbits}[kind])??4;
      renderers[kind](svg,recipe?.density??density,(recipe?.seed??state?.seed??0)%360*Math.PI/180,colors);
    }
    target.replaceChildren(svg);
  }
  const savedSelect=el('savedArt');
  function readRecipes(){return JSON.parse(pref('recipes')||'[]');}
  let saved=readRecipes();
  function savedName(r){
    if(r.kind==='postcard')return `Landscape postcard · ${new Date(r.date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`;
    return `${ideas.find(([k])=>k===r.kind)[1]} · ${r.id.slice(-6).toUpperCase()}`;
  }
  function syncSaved(){
    savedSelect.replaceChildren(new Option('Choose a design',''),...saved.map(r=>new Option(savedName(r),r.id)));
    if(!state)return;
    const recent=el('recentArt');recent.replaceChildren();
    for(const recipe of saved.slice(0,6)){
      const {label,thumb}=artChoice(recipe.id,savedName(recipe));
      const badge=document.createElement('span');badge.className='generatedBadge';badge.title='Generated design';badge.setAttribute('role','img');badge.setAttribute('aria-label','Generated design');
      const icon=shape(badge,'svg',{viewBox:'0 0 16 16','aria-hidden':'true'});
      shape(icon,'path',{d:'M7 1 8.6 5.4 13 7 8.6 8.6 7 13 5.4 8.6 1 7 5.4 5.4Z M13 10l.8 2.2L16 13l-2.2.8L13 16l-.8-2.2L10 13l2.2-.8Z',fill:'currentColor'});
      art(thumb,recipe.kind,recipe);label.append(badge);
      const tile=document.createElement('div');tile.className='savedTile';
      const remove=document.createElement('button');remove.type='button';remove.className='deleteDesign';
      remove.ariaLabel=remove.title=`Delete ${savedName(recipe)}`;
      const bin=shape(remove,'svg',{viewBox:'0 0 24 24','aria-hidden':'true',fill:'none',stroke:'currentColor','stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round'});
      shape(bin,'path',{d:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7'});
      remove.onclick=()=>{
        const remaining=readRecipes().filter(r=>r.id!==recipe.id);
        persist('recipes',JSON.stringify(remaining));saved=remaining;syncSaved();
        if(choice===recipe.id)selectArt('daily');else paint();
        el('generateArt').focus();
      };
      tile.append(label,remove);recent.append(tile);
    }
  }
  syncSaved();
  let choice=pref('art');if(!ideas.some(([id])=>id===choice)&&!saved.some(r=>r.id===choice))choice='daily';
  function paint(){
    const recipe=saved.find(r=>r.id===choice);
    const selected=recipe?.kind??(choice==='daily'?state.style:choice);
    art(el('wallpaper'),selected,recipe);
    savedSelect.value=recipe?.id??'';
    for(const r of el('appearance').querySelectorAll('[name=art]'))r.checked=r.value===choice;
    el('artDetail').textContent=recipe?`Applied saved design: ${savedName(recipe)}.`:`Daily composition: ${ideas.find(([id])=>id===state.style)[1]} · ${state.date}. Uses counts only, never titles or names.`;
  }
  function selectArt(id){persist('art',id);choice=id;paint();}
  savedSelect.onchange=()=>{if(savedSelect.value)selectArt(savedSelect.value);else paint();};
  el('generateArt').onclick=()=>{
    const [style,hue,seed,density]=crypto.getRandomValues(new Uint32Array(4));
    const recipe={id:'art-'+crypto.randomUUID(),kind:ideas[style%ideas.length][0],hue:hue%360,seed:seed%360,density:3+density%10};
    try{
      const recipes=[recipe,...readRecipes()];persist('recipes',JSON.stringify(recipes));saved=recipes;syncSaved();selectArt(recipe.id);
    }catch(error){el('artDetail').textContent=`Could not save this design: ${error.message}`;}
  };
  el('savePostcard').onclick=()=>{
    if(!state)return;
    const existing=readRecipes().find(recipe=>recipe.kind==='postcard'&&recipe.date===state.date);
    const recipe={id:existing?.id||'postcard-'+state.date,kind:'postcard',date:state.date,hue:(state.seed*37+state.palette*83)%360,seed:state.seed,meetings:state.meetings};
    try{
      const recipes=[recipe,...readRecipes().filter(item=>item.id!==recipe.id)];
      persist('recipes',JSON.stringify(recipes));saved=recipes;syncSaved();selectArt(recipe.id);
      el('artDetail').textContent=`Saved landscape postcard for ${new Date(state.date+'T12:00:00').toLocaleDateString()}. It uses meeting timing only.`;
    }catch(error){el('artDetail').textContent=`Could not save this postcard: ${error.message}`;}
  };
  const choices=el('artChoices');
  function artChoice(id,title){
    const label=document.createElement('label');label.className='artChoice';
    const radio=document.createElement('input');radio.type='radio';radio.name='art';radio.value=id;
    const thumb=document.createElement('span');thumb.className='sample';thumb.id='sample-'+id;
    const name=document.createElement('strong');name.textContent=title;
    radio.onchange=()=>selectArt(id);label.append(radio,thumb,name);
    return {label,thumb};
  }
  for(const [id,title,desc] of ideas){
    const {label}=artChoice(id,title);
    const description=document.createElement('small');description.textContent=desc;label.append(description);choices.append(label);
  }
  const daily=document.createElement('label');daily.className='setting';
  const auto=document.createElement('input');auto.type='radio';auto.name='art';auto.value='daily';daily.append(auto,'Use the daily Copilot composition');el('recentArt').after(daily);
  for(const r of el('appearance').querySelectorAll('[name=art]')){
    r.checked=r.value===choice;r.onchange=()=>selectArt(r.value);
  }
  const visitor=el('visitor');
  const visitorShapes={
    boat:'<path d="M2 12h24l-4 6H8Z"/><path d="M14 2v10M14 3l8 7h-8Z"/>',
    fox:'<path d="M4 13 8 4l6 5 6-5 4 9-4 7H8Z"/><path d="m9 13 3 2 3-2"/>',
    satellite:'<path d="M9 8h10v10H9Z"/><path d="m9 10-6-4v8l6 2m10-6 6-4v8l-6 2M14 2v6"/>'
  };
  function paintVisitor(){
    const variants=Object.keys(visitorShapes), variant=variants[(state.seed+Number(state.date.replaceAll('-','')))%variants.length];
    visitor.innerHTML=`<svg viewBox="0 0 28 22" aria-hidden="true">${visitorShapes[variant]}</svg>`;
    visitor.className=variant;
    visitor.title=`Hidden ${variant}`;
    visitor.setAttribute('aria-label',`Hidden ${variant}`);
    visitor.style.setProperty('--visitor-x',state.seed%2?'6px':'calc(100vw - 36px)');
    visitor.style.setProperty('--visitor-y',`${10+(state.seed*29)%70}vh`);
  }
  visitor.onclick=()=>{
    visitor.classList.remove('visiting');
    requestAnimationFrame(()=>visitor.classList.add('visiting'));
    setTimeout(()=>visitor.classList.remove('visiting'),700);
  };
  return data=>{
    const rec=data.art||{};
    const valid=ideas.some(([id])=>id===rec.style)&&Number.isInteger(rec.seed)&&Number.isInteger(rec.palette)&&rec.palette>=0&&rec.palette<=2&&/^\d{4}-\d{2}-\d{2}$/.test(rec.date);
    const targetDate=valid?rec.date:String(data.updated).slice(0,10);
    const dayStart=new Date(targetDate+'T00:00:00'),dayEnd=new Date(dayStart);dayEnd.setDate(dayEnd.getDate()+1);
    const meetings=Array.from({length:24},()=>0);
    for(const event of data.agenda.items){
      if(event.allDay||/\b(?:oof|dto|ooo|out[\s-]+of[\s-]+office)\b/i.test(event.title))continue;
      const start=new Date(Math.max(Date.parse(event.start),dayStart.getTime()));
      const end=new Date(Math.min(Date.parse(event.end),dayEnd.getTime()));
      if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))continue;
      const cursor=new Date(start);cursor.setMinutes(0,0,0);
      for(;cursor<end;cursor.setHours(cursor.getHours()+1))meetings[cursor.getHours()]=Math.min(60,meetings[cursor.getHours()]+Math.max(1,Math.round((Math.min(end,cursor.getTime()+3600000)-Math.max(start,cursor))/60000)));
    }
    state=valid?{date:rec.date,seed:rec.seed,palette:rec.palette,style:rec.style,contours:bounded(rec.events),orbits:bounded(rec.prs),loom:bounded(rec.actions),meetings}:
      {date:String(data.updated).slice(0,10),seed:0,palette:0,style:'contours',contours:bounded(data.agenda.items.length),orbits:bounded(data.prs.items.length),loom:bounded(data.actions.items.length),meetings};
    const key=JSON.stringify(state);if(key===lastKey)return;lastKey=key;
    for(const [id] of ideas)art(el('sample-'+id),id);syncSaved();paint();paintVisitor();
  };
})();
