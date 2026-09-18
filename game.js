import {TILE,generateMap,generateBootCamp,walkable,lineClear,findPath,moveUnit,distance,missionStatus,updateSites,spawnFromHuts,createCampaign,deploySquad,settleMission,settleBootCamp,recruitsLeft,rankStats,pointInPolygon,vehicleCapacity,vehicleSpeed,tileAt,soldierFromRecruit,T_ICE,dropTrail,followPoint,waveTarget,blastGates,applyGates,respawnDummies,upcomingRecruits,MEDALS,RANKS,BIOMES,theaterFor} from './engine.js';
import {SAVE_KEY,encodeSave,decodeSave} from './save.js';

const $=id=>document.getElementById(id);
const APP_VERSION=window.TF_BUILD||'';
let pendingReload=false;
function applyPendingReload(){
  if(!pendingReload)return false;
  location.reload();
  return true;
}
async function checkAppVersion(){
  if(!APP_VERSION||typeof fetch!=='function')return;
  try{
    const r=await fetch('version.json?t='+Date.now(),{cache:'no-store'});
    if(!r.ok)return;
    const next=(await r.json()).v;
    if(!next||String(next)===String(APP_VERSION))return;
    if(state.phase==='playing'||state.phase==='paused'){
      if(!pendingReload){pendingReload=true;toast('Nowa wersja czeka. Odśwież po misji.');}
      return;
    }
    location.reload();
  }catch{}
}
function isTouchUI(){
  return !!(window.matchMedia?.('(pointer: coarse)')?.matches
    || window.matchMedia?.('(hover: none)')?.matches
    || window.matchMedia?.('(max-width: 600px)')?.matches
    || window.matchMedia?.('(max-height: 500px) and (max-width: 960px)')?.matches);
}
function syncTouchUI(){
  document.documentElement?.classList?.toggle('touch-ui',isTouchUI());
}
function syncSoundButton(){
  const on=!!state.sound;
  $('sound')?.classList.toggle('sound-on',on);
  $('sound')?.setAttribute('aria-label',on?'Wyłącz dźwięk':'Włącz dźwięk');
  if($('sound-label'))$('sound-label').textContent=`DŹWIĘK: ${on?'ON':'OFF'}`;
}
const canvas=$('game'),ctx=canvas.getContext('2d'),mini=$('minimap'),mc=mini.getContext('2d');
const GROUP_COL=['#d5ed91','#8fd4e8','#e8c56a','#e89b7a'];
const pointers=new Map();
const MINI_PREF_KEY='tiny-front-minimap';
function readMiniPref(){try{return localStorage.getItem(MINI_PREF_KEY)==='hidden';}catch{return false;}}
const state={phase:'map',mission:1,score:0,grenades:6,rockets:2,elapsed:0,kills:0,deaths:0,hutsDone:0,selected:new Set([0,1,2,3]),bullets:[],particles:[],bombs:[],decals:[],rings:[],camera:{x:0,y:0},pointer:{x:0,y:0,worldX:0,worldY:0},firing:false,keys:new Set(),follow:true,touchMode:'move',lassoMode:false,heavyAim:null,lasso:null,shake:0,sound:false,toastTime:0,uiTime:0,campaign:createCampaign(),bootcamp:false,groupLeader:{0:0},promotions:[],graveOpen:false,miniHidden:readMiniPref()};
let saveActive=false,saveTimer=0,saveFailed=false,missionLinkCleared=false,spawnHint=false;
let map,squad,terrain,miniTerrain,viewW=1000,viewH=700,scale=1,audioCtx,lastTime=0,visualTime=0;
const urlParams=new URLSearchParams(location.search),initialSeed=Number(urlParams.get('seed'));
const initialMission=Number(urlParams.get('mission'));
if(Number.isInteger(initialMission)&&initialMission>=1&&initialMission<=999)state.mission=initialMission;
function freshSeed(){return crypto.getRandomValues(new Uint32Array(1))[0]%99999999;}
function format(n,size=2){return String(n).padStart(size,'0');}
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);}
function liveSquad(){return squad.filter(u=>u.hp>0);}
function selectedSquad(){return squad.filter(u=>u.hp>0&&state.selected.has(u.id));}

function initMission(seed=freshSeed(),retry=false,saved=null,opts={}){
  const prevPhase=state.phase,prevSquad=squad;
  const boot=!!(opts.bootcamp||saved?.state?.bootcamp);
  map=saved?.map??(boot?generateBootCamp(seed):generateMap(seed,state.mission));
  if(saved?.map)applyGates(map);
  Object.assign(state,{elapsed:0,kills:0,deaths:0,hutsDone:0,bullets:[],particles:[],bombs:[],decals:[],rings:[],firing:false,grenades:map.difficulty.grenades,rockets:map.difficulty.rockets,selected:new Set([0,1,2,3]),follow:true,shake:0,hutHint:false,evacReady:false,stars:0,bonus:0,heavyAim:null,lasso:null,lassoMode:false,touchMode:'move',bootcamp:!!map.bootcamp,groupLeader:{0:0},promotions:[],graveOpen:false});
  if(!retry)state.missionStartScore=state.score;
  spawnHint=false;pointers.clear();
  state.camera.x=map.spawn.x;state.camera.y=map.spawn.y;
  if(saved){
    Object.assign(state,saved.state,{phase:saved.state.phase==='playing'?'paused':saved.state.phase});
    squad=saved.squad.map((u,i)=>{
      const rec=state.campaign.roster[u.recruitId]||{id:u.recruitId,name:u.name,rank:u.rank||0};
      return Object.assign(soldierFromRecruit(rec,i,map.spawn),u);
    });
  }else if(retry&&prevSquad&&(prevPhase==='paused'||prevPhase==='won')){
    squad=prevSquad.map((u,i)=>soldierFromRecruit(state.campaign.roster[u.recruitId],i,map.spawn));
  }else if(opts.bootcamp&&prevSquad){
    squad=prevSquad.filter(u=>u.hp>0).map((u,i)=>soldierFromRecruit(state.campaign.roster[u.recruitId],i,map.spawn));
    if(squad.length<4)squad=deploySquad(state.campaign,map.spawn,squad);
  }else if(retry&&prevPhase==='lost'){
    squad=deploySquad(state.campaign,map.spawn,[]);
  }else if(prevPhase==='won'&&prevSquad){
    squad=deploySquad(state.campaign,map.spawn,prevSquad.filter(u=>u.hp>0));
  }else{
    squad=deploySquad(state.campaign,map.spawn,[]);
  }
  if(!squad.length){state.phase='over';showOverlay('over');return;}
  if(!saved)state.selected=new Set(squad.map(u=>u.id));
  state.groupLeader={};
  for(const u of squad)if(u.hp>0&&state.groupLeader[u.group]==null)state.groupLeader[u.group]=u.id;
  buildTerrain();buildSquadUI();updateUI();resize();drawHill();
  if($('touch-mode')){$('touch-mode').textContent='RUCH';$('touch-mode').classList.remove('active');$('touch-mode').setAttribute('aria-label','Tryb: ruch');}
  $('operation-title').textContent=map.operation.name;$('mission-terrain').textContent=`${map.layout.name} · ${map.cols} × ${map.rows}`;$('mission-difficulty').textContent=`ZAGROŻENIE ${map.difficulty.level}/13`; $('biome-label').textContent=map.biome.label;
  document.querySelector('.operation-number').innerHTML=`${format(state.mission)} <span>/ ∞</span>`;
  $('header-mission').textContent=`MISJA ${format(state.mission)}`;$('seed-label').textContent=format(seed,8);$('weather').textContent=map.biome.sky;
}

function saveProgress(manual=false){
  if(manual)saveActive=true;
  if(!saveActive)return;
  try{
    localStorage.setItem(SAVE_KEY,encodeSave(state,map,squad));
    if(hasMissionLink&&!missionLinkCleared){
      const url=new URL(location.href);url.searchParams.delete('seed');url.searchParams.delete('mission');
      window.history.replaceState(null,'',url.href);missionLinkCleared=true;
    }
    saveTimer=0;saveFailed=false;
    $('save-status').textContent='Postęp zapisany w tej przeglądarce. Autozapis co 5 sekund.';
    $('save').textContent='ZAPISZ';$('save').title='Zapisz postęp teraz. Automatyczny zapis jest aktywny.';
    if(manual)toast('Zapisano postęp. Możesz bezpiecznie zamknąć grę.');
  }catch{
    $('save-status').textContent='Nie udało się zapisać postępu. Sprawdź dostęp do pamięci przeglądarki i spróbuj ponownie.';
    $('save').textContent='PONÓW ZAPIS';$('save').title='Zapis nie powiódł się. Kliknij, aby spróbować ponownie.';
    if(manual||!saveFailed)toast('Zapis nie powiódł się. Postęp może zniknąć po zamknięciu strony.');
    saveFailed=true;saveTimer=0;
  }
}
function loadProgress(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw)return false;
    const saved=decodeSave(raw,generateMap);
    if(hasMissionLink&&(saved.state.mission!==state.mission||(urlParams.has('seed')&&saved.map.seed!==initialSeed)))return false;
    state.mission=saved.state.mission;state.campaign=saved.state.campaign;initMission(saved.map.seed,false,saved);
    saveActive=true;showOverlay(state.phase);
    $('save-status').textContent='Wczytano zapis. Postęp będzie zapisywany automatycznie w tej przeglądarce.';
    if(state.phase==='paused'){
      $('overlay-eyebrow').textContent=`ZAPISANA OPERACJA / ${format(state.mission,3)}`;
      $('overlay-title').textContent='Witaj z powrotem.';
      $('overlay-description').textContent='Twój oddział i cele misji czekają dokładnie tam, gdzie zapisano rozgrywkę. Wznów, gdy będziesz gotowy.';
      $('deploy').innerHTML='KONTYNUUJ GRĘ <span>↗</span>';
    }
    return true;
  }catch{
    $('save-status').textContent='Zapis jest niedostępny, uszkodzony lub niezgodny z tą wersją gry. Możesz rozpocząć nową operację.';
    return false;
  }
}

function buildTerrain(){
  terrain=document.createElement('canvas');terrain.width=map.width;terrain.height=map.height;
  const c=terrain.getContext('2d'),b=map.biome,rng=(seed=>{let a=(map.seed+33)>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};})(),COLS=map.cols,ROWS=map.rows;
  c.imageSmoothingEnabled=false;
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const t=map.tiles[y*COLS+x],px=x*TILE,py=y*TILE;
    const fill=t===1?b.water:t===3?b.path:t===4?'#887f53':t===5?'#c4a15a':t===6?'#e4ecdf':t===7?'#c5d4d8':b.ground;
    rect(c,px,py,TILE,TILE,fill);
    if(t===4){for(let k=0;k<TILE;k+=8){rect(c,px,py+k,TILE,2,'#645f42');rect(c,px+2,py+k+2,TILE-4,2,'#a39b6b');}rect(c,px+2,py,3,TILE,'#c1b588');rect(c,px+TILE-5,py,3,TILE,'#c1b588');continue;}
    if(t===5){for(let k=0;k<8;k++){rect(c,px+rng()*40,py+rng()*40,6+rng()*10,2,'#a88848');}continue;}
    if(t===6){for(let k=0;k<6;k++){rect(c,px+rng()*38,py+rng()*30,10,5,'#f2f6ea');}continue;}
    if(t===7){for(let k=0;k<5;k++){rect(c,px+rng()*40,py+rng()*40,12,2,'#e7eef0');}continue;}
    for(let k=0;k<(t===1?4:14);k++){
      const dx=Math.floor(rng()*22)*2,dy=Math.floor(rng()*22)*2;
      if(t===1)rect(c,px+dx,py+dy,6+Math.floor(rng()*6),2,rng()<.6?b.waterLight:b.water);
      else if(t===3){rect(c,px+dx,py+dy,2+rng()*3,2,rng()<.5?b.ground:b.light);}
      else{rect(c,px+dx,py+dy,2+rng()*4,2,rng()<.5?b.light:b.dark);if(rng()<.3)rect(c,px+dx+2,py+dy-3,2,4,b.dark);}
    }
    if(t!==1&&t!==4&&t!==7){for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<COLS&&ny<ROWS&&map.tiles[ny*COLS+nx]===1){rect(c,px+(dx===1?42:0),py+(dy===1?42:0),dx?6:48,dy?6:48,b.dark);rect(c,px+(dx===1?46:0),py+(dy===1?46:0),dx?2:48,dy?2:48,b.light);}}}
  }
  for(let i=0;i<480;i++){const x=rng()*map.width,y=rng()*map.height;if(walkable(map,x,y)&&map.tiles[Math.floor(y/TILE)*COLS+Math.floor(x/TILE)]===0){rect(c,x,y,2,3,rng()<.7?'#bbc27d':'#d5d3a0');}}
  c.strokeStyle='#dbe5a580';c.lineWidth=3;c.setLineDash([10,7]);c.strokeRect(map.spawn.x-63,map.spawn.y-56,151,147);c.setLineDash([]);
  c.font='bold 12px monospace';c.fillStyle='#dbe5a5aa';c.fillText(map.operation.type==='clear'?'LĄDOWANIE':'EWAKUACJA',map.spawn.x-44,map.spawn.y+115);
  miniTerrain=document.createElement('canvas');miniTerrain.width=COLS*4;miniTerrain.height=ROWS*4;
  const m=miniTerrain.getContext('2d');
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const t=map.tiles[y*COLS+x];rect(m,x*4,y*4,4,4,t===1?b.water:t===2?b.tree:t===3?b.path:t===4?'#a39b6b':t===5?'#c4a15a':t===6?'#e4ecdf':t===7?'#c5d4d8':b.ground);}
}

function drawSoldier(c,u,x,y,enemy=false,portrait=false){
  const moving=u.path?.length>0,step=moving?Math.sin(visualTime*15+u.id)*3:0;
  const dip=u.swimming&&!portrait?6:0;
  if(!portrait){c.fillStyle='#23331d55';c.beginPath();c.ellipse(x+3,y+7,10,5,0,0,Math.PI*2);c.fill();}
  const uniform=enemy?(u.role==='marksman'?'#777e8a':u.role==='scout'?'#bd995b':u.role==='gunner'?'#824e49':'#a26848'):'#526541',light=enemy?'#c18a5c':'#81935b',helmet=enemy?'#785143':'#425738';
  rect(c,x-6,y+3+dip,4,7+step,'#333e30');rect(c,x+2,y+3+dip,4,7-step,'#333e30');
  rect(c,x-7,y-7+dip,14,12,uniform);rect(c,x-5,y-7+dip,4,10,light);rect(c,x+3,y-5+dip,5,8,helmet);
  rect(c,x-4,y-13+dip,9,8,'#d5bb88');rect(c,x+3,y-10+dip,3,4,'#ad8d5f');
  rect(c,x-6,y-17+dip,12,6,helmet);rect(c,x-4,y-19+dip,8,3,light);rect(c,x-7,y-13+dip,14,3,helmet);
  if(portrait){rect(c,x-4,y-10,2,2,'#383d2a');rect(c,x+2,y-10,2,2,'#383d2a');return;}
  if(enemy&&u.role!=='rifle'){c.font='bold 10px monospace';c.fillStyle='#fff0c0';c.textAlign='center';c.fillText(u.role==='marksman'?'⌖':u.role==='scout'?'»':'Ⅱ',x,y-31);c.textAlign='left';}
  if(!u.swimming){c.save();c.translate(Math.round(x),Math.round(y-2));c.rotate(u.angle);rect(c,3,-2,16,4,'#30382d');rect(c,7,-3,6,2,'#818c68');rect(c,4,2,5,3,'#d5bb88');
  if(u.flash>0){rect(c,19,-3,7,6,'#ffeb9c');rect(c,24,-1,5,2,'#fff2d4');}c.restore();}
}

function drawHill(){
  const c=$('hill-canvas');if(!c||!c.getContext)return;
  const g=c.getContext('2d'),w=c.width||360,h=c.height||92;
  g.fillStyle='#1a231c';g.fillRect(0,0,w,h);
  g.fillStyle='#3f5a32';g.beginPath();g.ellipse(w/2,h+8,w*0.48,h*0.7,0,Math.PI,0);g.fill();
  g.fillStyle='#4d6c3c';g.beginPath();g.ellipse(w/2,h+14,w*0.4,h*0.55,0,Math.PI,0);g.fill();
  const graves=state.campaign.graves.slice(-24);
  graves.forEach((gr,i)=>{
    const x=28+(i%12)*26,y=h-18-Math.floor(i/12)*20-(i%5);
    g.fillStyle='#d7d0ae';g.fillRect(x,y-12,3,14);g.fillRect(x-4,y-9,11,3);
    g.fillStyle='#c4c7a8';g.font='6px monospace';g.fillText((gr.name||'').slice(0,4),x-6,y+6);
  });
  $('recruit-count').textContent=String(Math.max(0,recruitsLeft(state.campaign)-liveSquad().length));
  $('grave-count').textContent=String(state.campaign.graves.length);
  if($('grave-list'))$('grave-list').innerHTML=state.campaign.graves.slice().reverse().map(gr=>`<li><strong>${gr.name}</strong> · ${RANKS[gr.rank]||RANKS[0]} · MISJA ${format(gr.mission)}</li>`).join('')||'<li>Jeszcze nikt nie zszedł ze wzgórza.</li>';
}

function medalGlyphs(u){return (u.medals||[]).map(id=>MEDALS[id]?.glyph||'').join(' ');}
function buildSquadUI(){
  $('squad-list').innerHTML=squad.map((u,i)=>`<button class="soldier selected" id="soldier-${i}" title="Wybierz ${u.name} (${i+1})"><canvas class="portrait" width="32" height="36" id="portrait-${i}"></canvas><div class="soldier-info"><div class="soldier-name">${u.name} <span class="medals">${medalGlyphs(u)}</span><span id="hp-${i}">100 HP</span></div><div class="rank" id="rank-${i}">${rankStats(u.rank).name}</div><div class="health"><i id="health-${i}" style="width:100%"></i></div></div><kbd>${i+1}</kbd></button>`).join('');
  squad.forEach((u,i)=>{drawSoldier($(`portrait-${i}`).getContext('2d'),u,16,23,false,true);$(`soldier-${i}`).onclick=()=>select(i);});
}
function select(id){if(!squad[id]||squad[id].hp<=0)return;state.selected=new Set([id]);updateUI();toast(`${squad[id].name} czeka na rozkaz`);}
function promoteLeader(id){
  if(!squad[id]||squad[id].hp<=0)return;
  const group=squad[id].group;
  state.groupLeader[group]=id;
  state.selected=new Set(liveSquad().filter(u=>u.group===group).map(u=>u.id));
  updateUI();toast(`${squad[id].name} prowadzi pododdział`);
}
function regroup(){state.selected=new Set(liveSquad().map(u=>u.id));updateUI();toast('Cały oddział wybrany');}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');state.toastTime=3.2;}

function splitSquad(){
  const units=selectedSquad();
  if(units.length<2){toast('Potrzeba co najmniej dwóch żołnierzy, by podzielić oddział.');return;}
  const used=new Set(liveSquad().map(u=>u.group));
  let g=0;while(used.has(g))g++;
  units.slice(Math.ceil(units.length/2)).forEach(u=>u.group=g);
  state.selected=new Set(units.slice(0,Math.ceil(units.length/2)).map(u=>u.id));
  state.groupLeader[units[0].group]=units[0].id;
  state.groupLeader[g]=units[Math.ceil(units.length/2)].id;
  updateUI();toast('Oddział podzielony na podgrupy');beep('move');
}
function mergeSquad(){
  const focus=selectedSquad()[0]||liveSquad()[0];if(!focus)return;
  for(const u of liveSquad())if(distance(u,focus)<240)u.group=focus.group;
  state.selected=new Set(liveSquad().filter(u=>u.group===focus.group).map(u=>u.id));
  updateUI();toast('Zjednoczono grupy w pobliżu');beep('move');
}
function cycleGroup(){
  const groups=[...new Set(liveSquad().map(u=>u.group))].sort((a,b)=>a-b);if(!groups.length)return;
  const cur=selectedSquad()[0]?.group??groups[0];
  const next=groups[(groups.indexOf(cur)+1)%groups.length];
  state.selected=new Set(liveSquad().filter(u=>u.group===next).map(u=>u.id));
  updateUI();toast(`Pododdział ${next+1}`);
}
function finishLasso(){
  const poly=state.lasso;state.lasso=null;state.lassoMode=false;
  $('touch-lasso')?.classList.remove('active');
  if(!poly||poly.length<3)return;
  const inside=liveSquad().filter(u=>pointInPolygon(u,poly));
  if(!inside.length){toast('Lasso nie objęło żołnierzy.');return;}
  const used=new Set(liveSquad().map(u=>u.group));
  let g=0;while(used.has(g))g++;
  inside.forEach(u=>u.group=g);
  state.selected=new Set(inside.map(u=>u.id));
  updateUI();toast(`Lasso: pododdział ${inside.map(u=>u.name).join(', ')}`);
}

function updateUI(){
  if(!map||!squad)return;
  const status=missionStatus(map,squad),type=map.operation.type;
  const completed=map.sites.filter(s=>s.done).length,activeSite=map.sites.find(s=>!s.done);
  const siteProgress=activeSite?` · ${Math.floor(activeSite.progress)}/${activeSite.required} s${activeSite.contested?' · WRÓG W STREFIE':''}`:'';
  $('primary-label').textContent={clear:'Wyeliminuj garnizon',sabotage:'Zniszcz posterunki',rescue:'Uwolnij jeńca',capture:'Przejmij radiostacje'}[type];
  $('primary-progress').textContent=type==='clear'?`${state.kills} / ${map.enemies.length} wyeliminowanych`:type==='sabotage'?`${state.hutsDone} / ${map.huts.length} zniszczonych`:`${completed} / ${map.sites.length} zabezpieczonych${siteProgress}`;
  $('secondary-label').textContent=type==='clear'?'Zniszcz posterunki':'Ewakuuj cały oddział';
  $('secondary-progress').textContent=type==='clear'?`${state.hutsDone} / ${map.huts.length} zniszczonych`:status.primary?`${liveSquad().filter(u=>distance(u,map.extraction)<map.extraction.radius).length} / ${liveSquad().length} w strefie`:'Najpierw wykonaj główny cel';
  for(const[id,done]of[['enemy-objective',status.primary],['hut-objective',status.secondary]]){$(id).classList.toggle('done',done);$(id).querySelector('.check').textContent=done?'✓':'·';}
  $('objective-count').textContent=`${Number(status.primary)+Number(status.secondary)}/2`;
  $('alive-count').textContent=format(liveSquad().length);$('grenades').textContent=format(state.grenades);$('rockets').textContent=format(state.rockets);$('score').textContent=format(state.score,4);
  if($('touch-grenade-n'))$('touch-grenade-n').textContent=format(state.grenades);
  if($('touch-rocket-n'))$('touch-rocket-n').textContent=format(state.rockets);
  $('timer').textContent=`${format(Math.floor(state.elapsed/60))}:${format(Math.floor(state.elapsed%60))}`;
  for(const u of squad){
    $(`soldier-${u.id}`).classList.toggle('selected',state.selected.has(u.id)&&u.hp>0);
    $(`soldier-${u.id}`).classList.toggle('dead',u.hp<=0);
    $(`soldier-${u.id}`).disabled=u.hp<=0;
    $(`hp-${u.id}`).textContent=u.hp>0?`${Math.ceil(u.hp)} HP`:'POLEGŁ';
    $(`health-${u.id}`).style.width=`${Math.max(0,u.hp)}%`;
    $(`health-${u.id}`).style.background=u.hp<35?'#e6a078':'';
    if($(`rank-${u.id}`))$(`rank-${u.id}`).textContent=rankStats(u.rank).name;
    $(`soldier-${u.id}`).style.borderLeft=`3px solid ${GROUP_COL[u.group%GROUP_COL.length]}`;
  }
  const active=state.phase==='playing';$('field-status').textContent=active?'OPERACJA W TOKU':state.phase==='paused'?'OPERACJA WSTRZYMANA':state.phase==='won'?'SEKTOR ZABEZPIECZONY':state.phase==='lost'||state.phase==='over'?'UTRACONO KONTAKT':'OCZEKIWANIE NA ROZKAZ';
  $('connection-status').textContent=active?'ŁĄCZNOŚĆ AKTYWNA':'ODDZIAŁ W GOTOWOŚCI';
  $('pause').innerHTML=state.phase==='paused'?'▶ <span class="btn-label">WZNÓW</span>':'Ⅱ <span class="btn-label">PAUZA</span>';
  $('center-cam')?.classList.toggle('hidden',state.follow||state.phase!=='playing');
  $('home-score').textContent=String(state.kills);$('away-score').textContent=String(state.deaths);
  syncMini();
}
function syncMini(){
  $('minimap-wrap')?.classList.toggle('collapsed',!!state.miniHidden);
  $('battlefield')?.classList.toggle('mini-hidden',!!state.miniHidden);
  if($('touch-mini')){
    $('touch-mini').textContent='MAPA';
    $('touch-mini').classList.toggle('map-off',!!state.miniHidden);
    $('touch-mini').setAttribute('aria-label',state.miniHidden?'Pokaż mapę taktyczną':'Ukryj mapę taktyczną');
  }
}
function toggleMini(){
  state.miniHidden=!state.miniHidden;
  try{localStorage.setItem(MINI_PREF_KEY,state.miniHidden?'hidden':'shown');}catch{}
  syncMini();
  toast(state.miniHidden?'Ukryto mapę taktyczną':'Przywrócono mapę taktyczną');
}

function resize(){
  const r=canvas.getBoundingClientRect();viewW=Math.max(1,r.width);viewH=Math.max(1,r.height);
  const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(viewW*dpr);canvas.height=Math.round(viewH*dpr);
  scale=viewW<600?.85:1.1;ctx.imageSmoothingEnabled=false;clampCamera();
}
function clampCamera(){const halfW=viewW/scale/2,halfH=viewH/scale/2;state.camera.x=map.width<=halfW*2?map.width/2:Math.max(halfW,Math.min(map.width-halfW,state.camera.x));state.camera.y=map.height<=halfH*2?map.height/2:Math.max(halfH,Math.min(map.height-halfH,state.camera.y));}
function screenToWorld(x,y){return{x:(x-viewW/2)/scale+state.camera.x,y:(y-viewH/2)/scale+state.camera.y};}

function issueMove(target){
  if(state.phase!=='playing')return;
  const fly=selectedSquad().some(u=>{const v=vehicleOf(u);return v&&v.type==='heli';});
  if(!walkable(map,target.x,target.y,{fly})){toast('Teren niedostępny. Wybierz drogę lub otwarty teren.');return;}
  const units=selectedSquad();if(!units.length){regroup();return;}
  const vehicles=new Set(units.map(u=>vehicleOf(u)).filter(Boolean));
  for(const v of vehicles){
    if(v.type==='turret')continue;
    v.path=findPath(map,v,target,{fly:v.type==='heli'});
  }
  const onFoot=units.filter(u=>u.vehicleId==null);
  if(onFoot.length){
    const gid=onFoot[0].group;
    const leader=onFoot.find(u=>u.id===state.groupLeader[gid])||onFoot[0];
    state.groupLeader[gid]=leader.id;
    leader.followLeaderId=null;leader.followIndex=0;
    leader.path=findPath(map,leader,target);
    if(leader.path.length&&walkable(map,target.x,target.y)&&lineClear(map,leader.path[leader.path.length-1],target))leader.path.push(target);
    dropTrail(leader);leader.trail=[{x:leader.x,y:leader.y},...leader.path];
    const followers=onFoot.filter(u=>u!==leader);
    followers.forEach((u,i)=>{
      u.followLeaderId=leader.id;u.followIndex=i+1;u.path=[];
    });
  }
  state.rings.push({...target,life:1,max:1});beep('move');
}

function shoot(unit,target,enemy=false){
  if(unit.swimming)return;
  const stats=enemy?{accuracy:1,cooldown:0.24}:{...rankStats(unit.rank)};
  const a=Math.atan2(target.y-unit.y,target.x-unit.x),spread=(Math.random()-.5)*(enemy?.11:.045)*stats.accuracy;
  unit.angle=a;unit.flash=.07;unit.cooldown=enemy?(map.difficulty.fireDelay+Math.random()*.25)*(unit.role==='gunner'?.5:unit.role==='marksman'?1.4:1):stats.cooldown;
  const v=vehicleOf(unit);const extra=v&&v.type==='tank'?12:v&&v.type==='heli'?6:0;
  state.bullets.push({x:unit.x+Math.cos(a)*17,y:unit.y-2+Math.sin(a)*17,vx:Math.cos(a+spread)*640,vy:Math.sin(a+spread)*640,enemy,life:.83,damage:(enemy?map.difficulty.damage*(unit.role==='marksman'?1.6:unit.role==='gunner'?.8:1):23)+extra,owner:unit.id});
  if(!enemy)beep('shot');
}
function throwHeavy(type='grenade',target){
  if(state.phase!=='playing')return;
  const ammo=type==='rocket'?'rockets':'grenades',range=type==='rocket'?520:340;
  if(state[ammo]<=0){toast(type==='rocket'?'Brak rakiet. Szukaj skrzynek z wyrzutnią.':'Brak granatów. Szukaj pomarańczowych skrzynek z amunicją.');return;}
  target=target||{x:state.pointer.worldX,y:state.pointer.worldY};
  const units=selectedSquad().filter(u=>!u.swimming).sort((a,b)=>distance(a,target)-distance(b,target));if(!units.length){toast('Nie da się strzelać w wodzie.');return;}
  const u=units[0],d=distance(u,target);if(d>range){toast(`Za daleko! Zasięg: ${range}.`);return;}
  if(d<35){toast('Celuj dalej od żołnierza.');return;}
  state[ammo]--;state.bombs.push({from:{x:u.x,y:u.y},to:target,life:0,duration:type==='rocket'?.55:.8,kind:type,blast:type==='rocket'?150:110});beep('throw');updateUI();
}
function throwGrenade(){throwHeavy('grenade');}
function throwRocket(){throwHeavy('rocket');}
function explode(p,blast=110){
  state.shake=7;beep('explosion');
  for(let i=0;i<48;i++){const a=Math.random()*Math.PI*2,s=25+Math.random()*160;state.particles.push({x:p.x,y:p.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+Math.random()*.65,max:1,color:['#f2d388','#eaa168','#ded3a5','#545743','#343e30'][i%5],size:3+Math.random()*7});}
  state.decals.push({...p,type:'crater'});
  for(const e of map.enemies)if(e.hp>0&&distance(p,e)<blast)damageEnemy(e,120*(1-distance(p,e)/(blast+45)));
  for(const h of map.huts)if(h.hp>0&&distance(p,h)<blast){h.hp=0;state.hutsDone++;state.score+=300;toast('Posterunek zniszczony +300');}
  for(const u of liveSquad())if(distance(p,u)<blast)damageSoldier(u,140*(1-distance(p,u)/(blast+45)));
  for(const civ of map.civilians||[])if(civ.hp>0&&distance(p,civ)<blast)damageCivilian(civ,40);
  if(blastGates(map,p,blast)){buildTerrain();toast('Barykada zerwana.');}
  for(const t of map.turrets||[])if(t.hp>0&&distance(p,t)<blast)t.hp=0;
  for(const v of map.vehicles||[])if(v.hp>0&&distance(p,v)<blast)wreckVehicle(v,80*(1-distance(p,v)/(blast+45)));
  for(const m of map.mines||[])if(!m.exploded&&distance(p,m)<blast*0.7){m.exploded=true;m.armed=false;}
  updateUI();
}
function damageEnemy(e,amount,owner){
  if(e.hp<=0)return;e.hp-=amount;e.alert=8;for(const other of map.enemies)if(other.hp>0&&distance(e,other)<180)other.alert=5;
  if(e.hp<=0){
    if(e.role==='dummy'){for(let i=0;i<5;i++)state.particles.push({x:e.x,y:e.y,vx:(Math.random()-.5)*40,vy:(Math.random()-.5)*40,life:.4,max:.4,color:'#ccba87',size:2});return;}
    state.kills++;state.score+=100;if(owner!==undefined&&squad[owner])squad[owner].kills++;state.decals.push({x:e.x,y:e.y,type:'enemy',angle:e.angle});for(let i=0;i<5;i++)state.particles.push({x:e.x,y:e.y,vx:(Math.random()-.5)*40,vy:(Math.random()-.5)*40,life:.4,max:.4,color:'#ccba87',size:2});
  }
}
function damageCivilian(civ,amount=40){
  if(civ.hp<=0)return;civ.hp=Math.max(0,civ.hp-amount);if(civ.hp>0)return;
  civ.path=[];state.score=Math.max(0,state.score-200);
  state.decals.push({x:civ.x,y:civ.y,type:'enemy',angle:civ.angle||0});
  toast(civ.kind==='chicken'?'Kura zginęła. War has never been so much fun.':'Cywil zginął. War has never been so much fun.');
  beep('loss');updateUI();
}
function damageSoldier(u,amount){
  if(u.hp<=0)return;
  u.hp=Math.max(0,u.hp-amount);
  if(u.hp===0){
    u.path=[];state.selected.delete(u.id);state.deaths++;
    if(u.vehicleId!=null){const v=vehicleOf(u);if(v)v.occupants=v.occupants.filter(id=>id!==u.id);u.vehicleId=null;}
    state.decals.push({x:u.x,y:u.y,type:'ally',angle:u.angle});toast(`${rankStats(u.rank).name} ${u.name} poległ. Dbaj o resztę oddziału.`);beep('loss');
    if(!state.selected.size)state.selected=new Set(liveSquad().map(s=>s.id));updateUI();
  }
}
function vehicleOf(u){return u.vehicleId==null?null:(map.vehicles||[]).find(v=>v.id===u.vehicleId&&v.hp>0)||null;}
function wreckVehicle(v,amount=999){
  if(v.hp<=0)return;v.hp=Math.max(0,v.hp-amount);if(v.hp>0)return;
  v.path=[];for(const id of [...v.occupants]){const u=squad.find(s=>s.id===id);if(u){u.vehicleId=null;if(u.hp>0)damageSoldier(u,100);}}
  v.occupants=[];state.decals.push({x:v.x,y:v.y,type:'crater'});toast(`${({jeep:'Dżip',tank:'Czołg',heli:'Helikopter',turret:'Wieżyczka'})[v.type]||'Pojazd'} zniszczony`);
}
function toggleVehicle(){
  const units=selectedSquad();if(!units.length)return;
  if(units.every(u=>u.vehicleId!=null)){exitVehicle(units);return;}
  const v=(map.vehicles||[]).filter(v=>v.hp>0).sort((a,b)=>distance(a,units[0])-distance(b,units[0]))[0];
  if(!v||distance(v,units[0])>36){toast('Podejdź do dżipa, czołgu, helikoptera lub wieżyczki (E).');return;}
  const cap=vehicleCapacity(v.type);
  for(const u of units){
    if(v.occupants.length>=cap)break;
    if(u.vehicleId!=null)continue;
    u.vehicleId=v.id;u.path=[];v.occupants.push(u.id);
  }
  toast(v.type==='turret'?'Obsada wieżyczki':`Wsiadacie do: ${v.type}`);beep('pickup');
}
function exitVehicle(units){
  for(const u of units){
    const v=vehicleOf(u);if(!v){u.vehicleId=null;continue;}
    v.occupants=v.occupants.filter(id=>id!==u.id);u.vehicleId=null;
    u.x=v.x+18;u.y=v.y+14;u.path=[];
  }
  toast('Wysiadka');
}

function tick(dt){
  if(state.toastTime>0){state.toastTime-=dt;if(state.toastTime<=0)$('toast').classList.remove('visible');}
  if(state.phase!=='playing')return;
  state.elapsed+=dt;state.shake=Math.max(0,state.shake-dt*22);
  const alive=liveSquad(),aim=screenToWorld(state.pointer.x,state.pointer.y);
  state.pointer.worldX=aim.x;state.pointer.worldY=aim.y;
  const dx=Number(state.keys.has('d')||state.keys.has('arrowright'))-Number(state.keys.has('a')||state.keys.has('arrowleft'));
  const dy=Number(state.keys.has('s')||state.keys.has('arrowdown'))-Number(state.keys.has('w')||state.keys.has('arrowup'));
  if(dx||dy){state.follow=false;state.camera.x+=dx*560*dt;state.camera.y+=dy*560*dt;}
  if(state.follow&&alive.length){const focus=selectedSquad().length?selectedSquad():alive;const x=focus.reduce((n,u)=>n+u.x,0)/focus.length,y=focus.reduce((n,u)=>n+u.y,0)/focus.length;state.camera.x+=(x-state.camera.x)*Math.min(1,dt*3);state.camera.y+=(y-state.camera.y)*Math.min(1,dt*3);}
  clampCamera();
  if(state.heavyAim){const u=selectedSquad()[0];if(u)state.heavyAim.from={x:u.x,y:u.y};state.heavyAim.to={x:state.pointer.worldX,y:state.pointer.worldY};}
  for(const v of map.vehicles||[]){
    if(v.hp<=0)continue;v.cooldown-=dt;v.flash=Math.max(0,(v.flash||0)-dt);
    v.flying=v.type==='heli';v.heavy=v.type==='tank';v.air=v.flying;
    if(v.type!=='turret')moveUnit(map,v,dt,vehicleSpeed(v.type));
    for(const id of v.occupants){const u=squad[id];if(u&&u.hp>0){u.x=v.x;u.y=v.y;u.angle=v.angle;u.path=[];u.swimming=false;}}
    if((v.type==='tank'||v.type==='jeep')&&(v.path.length||Math.hypot(v.vx||0,v.vy||0)>12)){
      for(const t of [...alive,...map.enemies.filter(e=>e.hp>0)]){
        if(v.occupants.includes(t.id))continue;
        if(distance(v,t)<17){t.role?damageEnemy(t,90):damageSoldier(t,90);}
      }
      for(const civ of map.civilians||[])if(civ.hp>0&&distance(v,civ)<17)damageCivilian(civ,40);
    }
    if(v.type==='tank'&&tileAt(map,v.x,v.y)===T_ICE&&(v.sink||0)>1.5)wreckVehicle(v);
  }
  for(const u of alive){
    u.cooldown-=dt;u.flash=Math.max(0,(u.flash||0)-dt);
    dropTrail(u);
    if(u.vehicleId==null){
      if(u.followLeaderId!=null){
        const leader=squad[u.followLeaderId];
        if(!leader||leader.hp<=0)u.followLeaderId=null;
        else{
          const t=followPoint(leader,u.followIndex||1);
          const dest=walkable(map,t.x,t.y)?t:leader;
          if(distance(u,dest)>14){
            if(!u.path.length||distance(u.path[0],dest)>28)u.path=findPath(map,u,dest);
          }else u.path=[];
        }
      }
      moveUnit(map,u,dt,112);
    }
    if(u.sink>1.65){damageSoldier(u,100);if(u.hp<=0)toast(`${u.name} zniknął w ruchomych piaskach.`);}
    const stats=rankStats(u.rank);
    if(u.cooldown<=0&&!u.swimming){
      if(state.firing&&state.selected.has(u.id)){shoot(u,{x:state.pointer.worldX,y:state.pointer.worldY});}
      else{let target=null,best=stats.range;for(const e of map.enemies)if(e.hp>0){const d=distance(u,e);if(d<best&&lineClear(map,u,e)){target=e;best=d;}}if(target)shoot(u,target);}
    }
  }
  for(const e of map.enemies){
    if(e.hp<=0)continue;e.cooldown-=dt;e.flash=Math.max(0,(e.flash||0)-dt);e.repath-=dt;e.patrol-=dt;e.alert-=dt;
    if(e.role==='dummy'){e.path=[];continue;}
    let target=null,best=map.difficulty.awareness+(e.role==='marksman'?90:0);
    for(const u of alive){const d=distance(e,u);if(d<best&&(e.alert>0||lineClear(map,e,u))){target=u;best=d;}}
    const range=e.role==='marksman'?390:e.role==='scout'?215:285;
    if(target){
      const seesTarget=lineClear(map,e,target);if(seesTarget)e.alert=5;
      if(best<range&&seesTarget){
        e.path=[];e.angle=Math.atan2(target.y-e.y,target.x-e.x);
        if(e.cooldown<=0){e.aimTime+=dt;if(e.role!=='marksman'||e.aimTime>=.9){shoot(e,target,true);e.aimTime=0;}}
      }else{
        e.aimTime=0;
        if(e.repath<=0){
          const flank=e.role==='scout'?{x:target.x+Math.cos(e.id*2.4)*110,y:target.y+Math.sin(e.id*2.4)*110}:target;
          e.path=findPath(map,e,walkable(map,flank.x,flank.y)?flank:target);e.repath=1.3;
        }
      }
    }else{
      e.aimTime=0;
      const wave=waveTarget(map,e);
      if(wave){
        if(e.repath<=0){e.path=findPath(map,e,wave);e.repath=1.1;}
      }else if(e.patrol<=0){const radius=e.role==='scout'?300:160,t={x:e.home.x+(Math.random()-.5)*radius,y:e.home.y+(Math.random()-.5)*radius};if(walkable(map,t.x,t.y)&&distance(t,map.spawn)>380)e.path=findPath(map,e,t);e.patrol=4+Math.random()*4;}
    }
    moveUnit(map,e,dt,map.difficulty.speed*(e.role==='scout'?1.4:e.role==='gunner'?.75:1));
  }
  for(const civ of map.civilians||[]){
    if(civ.hp<=0)continue;
    civ.cooldown-=dt;civ.flee=Math.max(0,(civ.flee||0)-dt);
    const scare=alive.find(u=>distance(u,civ)<90)||state.bullets.find(b=>distance(b,civ)<70)||state.bombs.find(b=>distance(b.to,civ)<140);
    if(scare)civ.flee=1.8;
    if(civ.flee>0){
      const away=scare||alive[0]||map.spawn;
      const t={x:civ.x+(civ.x-away.x),y:civ.y+(civ.y-away.y)};
      if(civ.cooldown<=0){civ.path=findPath(map,civ,walkable(map,t.x,t.y)?t:civ);civ.cooldown=.4;}
    }else if(civ.cooldown<=0){
      const t={x:civ.x+(Math.random()-.5)*120,y:civ.y+(Math.random()-.5)*120};
      if(walkable(map,t.x,t.y))civ.path=findPath(map,civ,t);
      civ.cooldown=2+Math.random()*3;
    }
    moveUnit(map,civ,dt,civ.kind==='chicken'?95:52);
  }
  for(const t of map.turrets||[]){
    if(t.hp<=0)continue;t.cooldown-=dt;t.flash=Math.max(0,(t.flash||0)-dt);
    let target=null,best=340;
    for(const u of alive){const d=distance(t,u);if(d<best&&lineClear(map,t,u)){target=u;best=d;}}
    if(target&&t.cooldown<=0){
      t.angle=Math.atan2(target.y-t.y,target.x-t.x);t.flash=.08;t.cooldown=1.05;
      state.bullets.push({x:t.x+Math.cos(t.angle)*18,y:t.y+Math.sin(t.angle)*18,vx:Math.cos(t.angle)*620,vy:Math.sin(t.angle)*620,enemy:true,life:.8,damage:map.difficulty.damage*1.2,owner:0});
    }
  }
  for(const b of state.bullets){
    const steps=Math.ceil(Math.hypot(b.vx,b.vy)*dt/7);
    for(let i=0;i<steps&&b.life>0;i++){
      b.x+=b.vx*dt/steps;b.y+=b.vy*dt/steps;
      if(!walkable(map,b.x,b.y)){b.life=0;spark(b.x,b.y);break;}
      const targets=b.enemy?alive:map.enemies;
      for(const t of targets)if(t.hp>0&&distance(b,t)<12){b.enemy?damageSoldier(t,b.damage):damageEnemy(t,b.damage,b.owner);b.life=0;spark(b.x,b.y);break;}
      if(b.life>0){for(const civ of map.civilians||[])if(civ.hp>0&&distance(b,civ)<12){damageCivilian(civ,b.damage);b.life=0;spark(b.x,b.y);break;}}
      if(!b.enemy&&b.life>0){
        for(const h of map.huts)if(h.hp>0&&Math.abs(b.x-h.x)<30&&Math.abs(b.y-h.y)<25){b.life=0;spark(b.x,b.y);if(!state.hutHint){state.hutHint=true;toast('Posterunki są opancerzone — użyj granatu (G) lub rakiety (R).');}break;}
        for(const v of map.vehicles||[])if(v.hp>0&&distance(b,v)<18){wreckVehicle(v,b.damage);b.life=0;spark(b.x,b.y);break;}
        for(const tur of map.turrets||[])if(tur.hp>0&&distance(b,tur)<16){tur.hp-=b.damage;b.life=0;spark(b.x,b.y);break;}
      }
    }b.life-=dt;
  }
  state.bullets=state.bullets.filter(b=>b.life>0);
  for(const b of state.bombs){b.life+=dt;if(b.life>=b.duration&&!b.exploded){b.exploded=true;explode(b.to,b.blast||110);}}
  state.bombs=state.bombs.filter(b=>!b.exploded);
  for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.95;p.vy*=.95;}state.particles=state.particles.filter(p=>p.life>0);
  for(const r of state.rings)r.life-=dt;state.rings=state.rings.filter(r=>r.life>0);
  for(const p of map.pickups)if(!p.taken){const u=alive.find(u=>distance(u,p)<26);if(u){if(p.type==='med'&&alive.some(s=>s.hp<100)){alive.forEach(s=>s.hp=Math.min(100,s.hp+40));p.taken=true;toast('Apteczka: +40 zdrowia dla całego oddziału');beep('pickup');}else if(p.type==='grenade'){state.grenades+=3;p.taken=true;toast('Zaopatrzenie: +3 granaty');beep('pickup');}else if(p.type==='rocket'){state.rockets+=2;p.taken=true;toast('Zaopatrzenie: +2 rakiety');beep('pickup');}}}
  if(state.mission<=2&&!state.bootcamp&&state.grenades===0&&!state.bombs.length&&state.hutsDone<map.huts.length&&!map.pickups.some(p=>p.type==='grenade'&&!p.taken)){
    map.pickups.push({x:map.spawn.x,y:map.spawn.y,type:'grenade',taken:false});toast('Zrzut granatów czeka w strefie lądowania.');
  }
  for(const m of map.mines||[]){
    if(m.exploded||!m.armed)continue;
    const hit=[...alive,...map.enemies.filter(e=>e.hp>0),(map.vehicles||[]).filter(v=>v.hp>0&&v.type!=='heli')].flat().find(u=>u&&distance(u,m)<20);
    if(hit){m.exploded=true;m.armed=false;explode(m,m.kind==='bamboo'?90:120);toast(m.kind==='bamboo'?'Pułapka bambusowa!':'Mina!');}
  }
  const spawned=spawnFromHuts(map,dt);
  if(spawned&&!spawnHint){spawnHint=true;toast('Wróg wylewa się z budynku — wysadź posterunek!');}
  respawnDummies(map,dt);
  updateSites(map,squad,dt);
  const status=missionStatus(map,squad);
  if(map.operation.type!=='clear'&&status.primary&&!state.evacReady){state.evacReady=true;toast('Cel wykonany! Doprowadź wszystkich ocalałych do zielonej strefy ewakuacji.');beep('pickup');}
  state.uiTime-=dt;if(state.uiTime<=0){updateUI();state.uiTime=.15;}
  if(liveSquad().length===0)endMission(false);
  else if(status.won)endMission(true);
  if(state.phase==='playing'){saveTimer+=dt;if(saveTimer>=5)saveProgress();}
}
function spark(x,y){state.particles.push({x,y,vx:0,vy:0,life:.12,max:.12,color:'#f8e4ac',size:4});}

function drawGate(c,g){
  rect(c,g.x-18,g.y-10,36,20,'#5c5340');rect(c,g.x-16,g.y-8,32,16,'#7a6e52');
  for(let i=0;i<4;i++)rect(c,g.x-14+i*8,g.y-8,2,16,'#3e382c');
  c.font='7px monospace';c.fillStyle='#efd58a';c.textAlign='center';c.fillText('BRAMA',g.x,g.y-16);c.textAlign='left';
}
function drawCivilian(c,civ){
  if(civ.kind==='chicken'){
    rect(c,civ.x-5,civ.y-2,10,6,'#e8d9a8');rect(c,civ.x+4,civ.y-4,5,4,'#e8d9a8');rect(c,civ.x+8,civ.y-3,4,2,'#c45d45');rect(c,civ.x-3,civ.y+4,2,4,'#c45d45');rect(c,civ.x+2,civ.y+4,2,4,'#c45d45');
    return;
  }
  rect(c,civ.x-4,civ.y+2,3,7,'#3a3428');rect(c,civ.x+1,civ.y+2,3,7,'#3a3428');
  rect(c,civ.x-6,civ.y-8,12,12,'#6b5a3e');rect(c,civ.x-4,civ.y-14,8,7,'#d5bb88');
}
function drawTree(c,d){
  const x=d.x,y=d.y,b=map.biome;
  c.fillStyle='#29351e33';c.beginPath();c.ellipse(x+10,y+13,27,13,0,0,Math.PI*2);c.fill();
  if(d.type==='rock'){rect(c,x-15,y-9,29,20,b.rock);rect(c,x-10,y-15,19,7,b.rock);rect(c,x-11,y-10,9,4,b.light);rect(c,x+8,y-6,6,17,b.dark);rect(c,x-10,y+9,20,4,b.dark);return;}
  rect(c,x-3,y-5,6,21,'#60563c');rect(c,x-1,y+4,3,10,'#93815a');
  if((state.mission-1)%4===1){rect(c,x-5,y-31,10,38,b.tree);rect(c,x-17,y-16,12,7,b.tree);rect(c,x-18,y-27,6,14,b.treeLight);rect(c,x+5,y-22,12,7,b.tree);rect(c,x+12,y-35,6,18,b.treeLight);rect(c,x-3,y-29,3,28,b.treeLight);return;}
  const v=d.variant*2;rect(c,x-18-v,y-24,36+v*2,22,b.tree);rect(c,x-24,y-20,48,11,b.tree);rect(c,x-13,y-38,26,16,b.tree);rect(c,x-19,y-30,38,12,b.treeLight);rect(c,x-10,y-42,20,14,b.treeLight);rect(c,x-18,y-26,16,9,b.treeLight);rect(c,x-7,y-39,9,5,(state.mission-1)%4===2?'#c7d6c6':'#71864a');rect(c,x+9,y-20,11,10,b.tree);rect(c,x-14,y-8,29,7,b.tree);
  if((state.mission-1)%4===2){rect(c,x-11,y-38,20,4,'#dce4d5');rect(c,x-18,y-27,29,4,'#c9d7c6');}
}
function drawHut(c,h){
  const x=h.x,y=h.y;
  if(h.hp<=0){rect(c,x-35,y-23,70,56,'#4e503ccc');rect(c,x-31,y-19,18,29,'#767158');rect(c,x+15,y-9,16,32,'#66684d');rect(c,x-23,y+13,43,8,'#8f8763');rect(c,x-10,y-11,21,23,'#383e30');return;}
  rect(c,x-37,y-28,79,65,'#34412855');
  for(let i=0;i<5;i++){rect(c,x-49+i*19,y+39,16,9,'#a4a077');rect(c,x-48+i*19,y+39,14,3,'#beb68a');}
  rect(c,x-31,y-19,63,45,'#80734f');rect(c,x-29,y+9,59,15,'#6b6447');
  rect(c,x-9,y+5,17,23,'#343d2e');rect(c,x-24,y+2,10,10,'#343d2e');rect(c,x+14,y+2,10,10,'#343d2e');
  rect(c,x-36,y-34,73,34,'#575e49');rect(c,x-30,y-41,62,9,'#737b5b');
  for(let i=0;i<8;i++){rect(c,x-32+i*9,y-32,3,30,'#84896a');rect(c,x-30+i*9,y-32,1,30,'#9ca07b');}
  rect(c,x-37,y-3,75,5,'#414c39');rect(c,x+46,y-56,3,80,'#4c4d38');
  rect(c,x+49,y-56,24,13,'#b96d4f');rect(c,x+49,y-56,24,3,'#d08e69');
  c.strokeStyle='#e7d594';c.lineWidth=1.5;c.strokeRect(x-7,y-65,14,14);c.fillStyle='#e7d594';c.font='bold 9px monospace';c.textAlign='center';c.fillText('×',x,y-54);c.textAlign='left';
}
function drawPickup(c,p){
  if(p.taken)return;const x=p.x,y=p.y+Math.sin(visualTime*2)*2;
  c.fillStyle='#26372244';c.beginPath();c.ellipse(x,y+11,12,5,0,0,Math.PI*2);c.fill();
  const col=p.type==='med'?'#d0d5ae':p.type==='rocket'?'#7d9bb0':'#c69359';
  rect(c,x-10,y-9,20,18,'#374630');rect(c,x-8,y-7,16,13,col);rect(c,x-8,y+5,16,3,p.type==='med'?'#989f7c':'#976a42');
  if(p.type==='med'){rect(c,x-2,y-5,4,10,'#778d55');rect(c,x-5,y-2,10,4,'#778d55');}else if(p.type==='rocket'){rect(c,x-2,y-6,4,12,'#dfe7c8');rect(c,x-4,y-6,8,3,'#c45d45');}else{rect(c,x-3,y-4,6,9,'#574d32');rect(c,x-1,y-6,3,3,'#574d32');}
}
function drawJeep(c,v){
  c.fillStyle='#23331d55';c.beginPath();c.ellipse(1,3,22,12,0,0,Math.PI*2);c.fill();
  const tire='#1a1c16',hub='#7a6e4e',olive='#6b7a4d',shade='#465436',glass='#d7e4b4';
  rect(c,-18,-17,13,8,tire);rect(c,-18,9,13,8,tire);rect(c,7,-17,13,8,tire);rect(c,7,9,13,8,tire);
  rect(c,-15,-15,7,4,hub);rect(c,-15,11,7,4,hub);rect(c,10,-15,7,4,hub);rect(c,10,11,7,4,hub);
  rect(c,-19,-13,16,4,olive);rect(c,-19,9,16,4,olive);rect(c,5,-13,18,4,olive);rect(c,5,9,18,4,olive);
  rect(c,-20,-9,42,18,olive);
  rect(c,-18,-7,8,14,shade);
  rect(c,-8,-7,16,14,'#242c1e');
  rect(c,8,-8,16,16,olive);rect(c,10,-6,13,5,'#84965c');rect(c,10,3,13,4,shade);
  rect(c,22,-7,5,14,'#2a3126');rect(c,23,-5,3,2,tire);rect(c,23,-1,3,2,tire);rect(c,23,3,3,2,tire);
  rect(c,26,-8,3,16,'#4a4e3c');rect(c,22,-12,4,4,'#efe4a8');rect(c,22,8,4,4,'#efe4a8');
  rect(c,7,-8,2,16,shade);rect(c,8,-7,2,14,glass);
  rect(c,-5,-6,7,5,'#5c4a36');rect(c,-5,1,7,5,'#5c4a36');rect(c,3,-5,3,3,'#2c3328');
  rect(c,-9,-11,2,22,shade);rect(c,-9,-12,14,2,shade);rect(c,-9,10,14,2,shade);
  rect(c,-25,-6,7,12,tire);rect(c,-23,-4,4,8,hub);
  if(v.occupants.length){rect(c,-4,-6,6,5,'#425738');if(v.occupants.length>1)rect(c,-4,1,6,5,'#425738');}
  if(v.occupants.some(id=>squad[id]?.flash>0))rect(c,12,-3,6,6,'#ffeb9c');
}
function drawTank(c,v){
  c.fillStyle='#23331d55';c.beginPath();c.ellipse(2,3,26,14,0,0,Math.PI*2);c.fill();
  const hull='#5a6248',dark='#3e4634',track='#1a1c16',iron='#2c3328',light='#6e7658';
  rect(c,-26,-17,52,8,track);rect(c,-26,9,52,8,track);
  for(let i=0;i<8;i++){rect(c,-24+i*6,-16,4,6,'#2a2e24');rect(c,-24+i*6,10,4,6,'#2a2e24');}
  rect(c,-24,-10,46,20,hull);rect(c,-22,-8,14,16,dark);rect(c,10,-8,12,16,light);rect(c,20,-6,4,12,dark);
  rect(c,-26,-4,4,3,iron);rect(c,-26,1,4,3,iron);
  rect(c,-10,-9,22,18,dark);rect(c,-8,-7,16,14,hull);rect(c,-4,-4,8,8,iron);
  if(v.occupants.length)rect(c,-3,-3,6,6,'#425738');
  rect(c,12,-4,8,8,dark);rect(c,10,-3,28,6,iron);rect(c,36,-4,5,8,iron);
  if(v.occupants.some(id=>squad[id]?.flash>0))rect(c,38,-5,8,10,'#ffeb9c');
}
function drawHeli(c,v){
  c.fillStyle='#23331d66';c.beginPath();c.ellipse(0,10,22,9,0,0,Math.PI*2);c.fill();
  const body='#5a684c',dark='#2f382c',glass='#c5d6a8',skid='#2c3328';
  rect(c,-16,8,38,3,skid);rect(c,-16,12,38,3,skid);rect(c,-10,6,3,8,skid);rect(c,10,6,3,8,skid);
  rect(c,-34,-3,22,6,body);rect(c,-36,-12,5,22,dark);rect(c,-38,-8,3,4,dark);rect(c,-38,4,3,4,dark);
  rect(c,-14,-8,30,16,body);rect(c,-10,-6,12,12,dark);rect(c,12,-7,16,14,body);rect(c,16,-5,12,10,glass);rect(c,20,-3,5,6,'#e8f0d0');
  if(v.occupants.length){rect(c,18,-3,5,5,'#425738');if(v.occupants.length>1)rect(c,8,-3,5,5,'#425738');}
  rect(c,-2,-12,4,8,dark);
  c.save();c.rotate(visualTime*14);c.globalAlpha=.5;rect(c,-3,-28,6,56,dark);rect(c,-28,-3,56,6,dark);c.restore();
  rect(c,-5,-5,10,10,'#3e4634');rect(c,-3,-3,6,6,'#6e7658');
  if(v.occupants.some(id=>squad[id]?.flash>0))rect(c,26,-4,7,7,'#ffeb9c');
}
function drawEmplacement(c,angle,flash,occupied){
  rect(c,-16,-12,32,26,'#6a5b40');rect(c,-13,-9,26,20,'#5a5040');
  rect(c,-18,-8,5,16,'#7a6b50');rect(c,13,-8,5,16,'#7a6b50');rect(c,-12,10,24,5,'#7a6b50');
  rect(c,-8,-8,16,16,'#3e3a30');
  c.save();c.rotate(angle);
  rect(c,-7,-7,16,14,'#4a4538');rect(c,-5,-5,12,10,'#6a5b40');rect(c,6,-5,10,10,'#3e4634');rect(c,8,-3,24,6,'#2c3328');rect(c,30,-4,4,8,'#2c3328');
  if(occupied)rect(c,-3,-4,7,7,'#425738');
  if(flash)rect(c,32,-5,8,10,'#ffeb9c');
  c.restore();
}
function drawVehicle(c,v){
  const x=v.x,y=v.y;
  if(v.hp<=0){
    c.save();c.translate(x,y);c.rotate(v.type==='turret'?0:v.angle||0);
    if(v.type==='jeep'){rect(c,-18,-16,12,6,'#2a2c24');rect(c,-18,10,12,6,'#2a2c24');rect(c,7,-16,12,6,'#2a2c24');rect(c,7,10,12,6,'#2a2c24');rect(c,-20,-8,38,16,'#4a4e3c88');rect(c,-24,-5,6,10,'#2a2c24');}
    else if(v.type==='tank'){rect(c,-26,-16,50,7,'#2a2c24');rect(c,-26,9,50,7,'#2a2c24');rect(c,-22,-8,42,16,'#4a4e3c88');rect(c,8,-2,18,4,'#2a2c24');}
    else if(v.type==='heli'){rect(c,-18,-6,34,12,'#4a4e3c88');rect(c,-32,-2,16,4,'#2a2c24');rect(c,-20,-16,4,28,'#2a2c2488');}
    else{rect(c,-14,-10,28,22,'#4a4e3c88');rect(c,4,-3,16,5,'#2a2c24');}
    c.restore();return;
  }
  c.save();c.translate(x,y);
  if(v.type==='turret')drawEmplacement(c,v.angle,v.occupants.some(id=>squad[id]?.flash>0),v.occupants.length>0);
  else{
    c.rotate(v.angle);
    if(v.type==='heli')drawHeli(c,v);
    else if(v.type==='tank')drawTank(c,v);
    else drawJeep(c,v);
  }
  c.restore();
  const barY=v.type==='heli'?y-34:y-26;
  rect(c,x-12,barY,24,3,'#33442c');rect(c,x-12,barY,24*v.hp/v.maxHp,3,'#d6ed92');
}
function drawMine(c,m){
  if(m.exploded)return;
  const x=m.x,y=m.y;
  c.strokeStyle='#c45d4588';c.lineWidth=1;c.setLineDash([3,3]);c.beginPath();c.arc(x,y,14,0,Math.PI*2);c.stroke();c.setLineDash([]);
  if(m.kind==='bamboo'){rect(c,x-3,y-14,6,24,'#7a8a4a');rect(c,x-10,y-5,20,4,'#c45d45');rect(c,x-2,y-16,4,6,'#9aaa5a');}
  else{c.fillStyle='#1a1e16';c.beginPath();c.arc(x,y,8,0,Math.PI*2);c.fill();c.fillStyle='#c45d45';c.beginPath();c.arc(x,y,3,0,Math.PI*2);c.fill();rect(c,x-1,y-7,2,14,'#d6ed92');rect(c,x-7,y-1,14,2,'#d6ed92');}
}
function drawTurret(c,t){
  if(t.hp<=0){rect(c,t.x-14,t.y-10,28,22,'#3e4236');rect(c,t.x-2,t.y-2,16,4,'#2a2c24');return;}
  c.save();c.translate(t.x,t.y);drawEmplacement(c,t.angle,t.flash>0,false);c.restore();
}

function drawMissionMarkers(){
  for(const site of map.sites){
    ctx.strokeStyle=site.done?'#d6ed92':site.contested?'#ed9479':'#efd58a';ctx.lineWidth=2;ctx.setLineDash([7,5]);ctx.beginPath();ctx.arc(site.x,site.y,72,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    rect(ctx,site.x-18,site.y-16,36,32,'#263a30');
    if(site.kind==='radio'){rect(ctx,site.x-10,site.y-10,20,16,'#bac8aa');rect(ctx,site.x+8,site.y-34,2,25,'#e9d997');}else{drawSoldier(ctx,{id:0,angle:0},site.x,site.y);}
    ctx.textAlign='center';ctx.font='bold 10px monospace';ctx.fillStyle='#f2e9be';ctx.fillText(site.done?'✓ ZABEZPIECZONO':site.kind==='radio'?'RADIOSTACJA':'JENIEC',site.x,site.y-46);
    rect(ctx,site.x-30,site.y+28,60,5,'#273725');rect(ctx,site.x-30,site.y+28,60*site.progress/site.required,5,site.contested?'#ed9479':'#d6ed92');ctx.textAlign='left';
  }
  if(map.operation.type!=='clear'&&!map.bootcamp){
    const p=map.extraction;ctx.strokeStyle=state.evacReady?'#d6ed92':'#d6ed9255';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.stroke();ctx.font='bold 12px monospace';ctx.fillStyle=ctx.strokeStyle;ctx.textAlign='center';ctx.fillText(state.evacReady?'EWAKUACJA · ZBIERZ ODDZIAŁ':'EWAKUACJA PO WYKONANIU CELU',p.x,p.y-110);ctx.textAlign='left';
  }
}

function render(){
  const dpr=canvas.width/viewW;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,viewW,viewH);ctx.imageSmoothingEnabled=false;
  ctx.save();ctx.translate(viewW/2+(Math.random()-.5)*state.shake,viewH/2+(Math.random()-.5)*state.shake);ctx.scale(scale,scale);ctx.translate(-Math.round(state.camera.x),-Math.round(state.camera.y));
  ctx.drawImage(terrain,0,0);drawMissionMarkers();
  for(const e of map.enemies)if(e.hp>0&&e.role==='marksman'&&e.aimTime>0){ctx.strokeStyle='#f4a077aa';ctx.lineWidth=1;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(e.angle)*390,e.y+Math.sin(e.angle)*390);ctx.stroke();ctx.setLineDash([]);}
  for(const d of state.decals){if(d.type==='crater'){ctx.fillStyle='#39422f66';ctx.beginPath();ctx.ellipse(d.x,d.y,38,27,0,0,Math.PI*2);ctx.fill();rect(ctx,d.x-16,d.y-9,28,15,'#343b2d66');}else{rect(ctx,d.x-9,d.y-3,18,7,d.type==='ally'?'#44583c':'#855f47');rect(ctx,d.x+8,d.y-4,6,6,'#b7a579');}}
  for(const u of selectedSquad()){
    if(u.path.length&&state.phase==='playing'){ctx.strokeStyle='#e3edb043';ctx.lineWidth=1;ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(u.x,u.y);for(const p of u.path)ctx.lineTo(p.x,p.y);ctx.stroke();ctx.setLineDash([]);}
    ctx.strokeStyle=GROUP_COL[u.group%GROUP_COL.length];ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(u.x,u.y+5,14,8,0,0,Math.PI*2);ctx.stroke();
  }
  for(const r of state.rings){ctx.globalAlpha=r.life;ctx.strokeStyle='#ecf5b7';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(r.x,r.y,10+(1-r.life)*22,6+(1-r.life)*13,0,0,Math.PI*2);ctx.stroke();rect(ctx,r.x-4,r.y,8,1,'#eff8c6');rect(ctx,r.x,r.y-4,1,8,'#eff8c6');ctx.globalAlpha=1;}
  if(state.lasso&&state.lasso.length>1){ctx.strokeStyle='#d6ed92';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(state.lasso[0].x,state.lasso[0].y);for(const p of state.lasso)ctx.lineTo(p.x,p.y);ctx.closePath();ctx.stroke();ctx.setLineDash([]);}
  if(state.heavyAim){
    const a=state.heavyAim,t=0.5;ctx.strokeStyle='#efd496';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();
    ctx.moveTo(a.from.x,a.from.y);ctx.quadraticCurveTo((a.from.x+a.to.x)/2,(a.from.y+a.to.y)/2-80,a.to.x,a.to.y);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(a.to.x,a.to.y,a.type==='rocket'?70:45,0,Math.PI*2);ctx.stroke();
    void t;
  }
  for(const p of map.pickups)drawPickup(ctx,p);
  const visible=(x,y)=>Math.abs(x-state.camera.x)<viewW/scale/2+100&&Math.abs(y-state.camera.y)<viewH/scale/2+100;
  const scenery=[
    ...map.decorations.filter(d=>visible(d.x,d.y)).map(d=>({y:d.y,draw:()=>drawTree(ctx,d)})),
    ...map.huts.map(h=>({y:h.y+18,draw:()=>drawHut(ctx,h)})),
    ...(map.gates||[]).filter(g=>!g.open).map(g=>({y:g.y,draw:()=>drawGate(ctx,g)}))
  ];
  scenery.sort((a,b)=>a.y-b.y);scenery.forEach(d=>d.draw());
  for(const m of map.mines||[])if(visible(m.x,m.y))drawMine(ctx,m);
  const drawables=[
    ...(map.turrets||[]).filter(t=>visible(t.x,t.y)).map(t=>({y:t.y,draw:()=>drawTurret(ctx,t)})),
    ...(map.vehicles||[]).filter(v=>visible(v.x,v.y)).map(v=>({y:v.y+8,draw:()=>drawVehicle(ctx,v)})),
    ...(map.civilians||[]).filter(c=>c.hp>0&&visible(c.x,c.y)).map(c=>({y:c.y,draw:()=>drawCivilian(ctx,c)})),
    ...map.enemies.filter(e=>e.hp>0&&visible(e.x,e.y)).map(e=>({y:e.y,draw:()=>{drawSoldier(ctx,e,e.x,e.y,true);if(e.alert>0){rect(ctx,e.x-7,e.y-26,14,2,'#794833');rect(ctx,e.x-7,e.y-26,14*e.hp/e.maxHp,2,'#e5a080');}}})),
    ...liveSquad().filter(u=>u.vehicleId==null).map(u=>({y:u.y,draw:()=>{drawSoldier(ctx,u,u.x,u.y);rect(ctx,u.x-10,u.y-27,20,3,'#33442c');rect(ctx,u.x-10,u.y-27,20*u.hp/100,3,u.hp<35?'#e9a173':'#d6ed92');ctx.font='7px monospace';ctx.textAlign='center';ctx.fillStyle=state.groupLeader[u.group]===u.id?'#d6ed92':'#f0f2d4';ctx.fillText(state.groupLeader[u.group]===u.id?u.name.slice(0,4):String(u.id+1),u.x,u.y-32);ctx.textAlign='left';}}))
  ];
  drawables.sort((a,b)=>a.y-b.y);drawables.forEach(d=>d.draw());
  for(const b of state.bullets){ctx.strokeStyle=b.enemy?'#f0b87c':'#faf2b5';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-b.vx*.017,b.y-b.vy*.017);ctx.stroke();}
  for(const b of state.bombs){const t=b.life/b.duration,x=b.from.x+(b.to.x-b.from.x)*t,y=b.from.y+(b.to.y-b.from.y)*t-Math.sin(t*Math.PI)*80;ctx.fillStyle='#26332155';ctx.beginPath();ctx.ellipse(x,b.from.y+(b.to.y-b.from.y)*t,6,3,0,0,Math.PI*2);ctx.fill();rect(ctx,x-3,y-4,6,7,b.kind==='rocket'?'#c45d45':'#e9d997');ctx.strokeStyle='#efd49688';ctx.lineWidth=1;ctx.beginPath();ctx.arc(b.to.x,b.to.y,b.blast?b.blast*0.4:45,0,Math.PI*2);ctx.stroke();}
  for(const p of state.particles){ctx.globalAlpha=Math.min(1,p.life/p.max*2);rect(ctx,p.x,p.y,p.size,p.size,p.color);}ctx.globalAlpha=1;
  if(state.phase==='playing'){
    const targets=state.evacReady?[{...map.extraction,kind:'evac'}]:map.operation.type==='rescue'||map.operation.type==='capture'?map.sites.filter(s=>!s.done).map(s=>({...s,kind:'site'})):[...map.huts.filter(h=>h.hp>0).map(h=>({...h,kind:'hut'})),...(map.operation.type==='clear'&&state.hutsDone===map.huts.length?map.enemies.filter(e=>e.hp>0).map(e=>({...e,kind:'enemy'})): [])];
    for(const h of targets){const hx=h.x-state.camera.x,hy=h.y-state.camera.y,halfW=viewW/scale/2-46,halfH=viewH/scale/2-70;if(Math.abs(hx)>halfW||Math.abs(hy)>halfH){const ratio=Math.min(halfW/Math.abs(hx||1),halfH/Math.abs(hy||1)),x=state.camera.x+hx*ratio,y=state.camera.y+hy*ratio;ctx.fillStyle='#263121df';ctx.beginPath();ctx.arc(x,y,14,0,Math.PI*2);ctx.fill();ctx.fillStyle=h.kind==='evac'?'#d6ed92':h.kind==='enemy'?'#e39b77':'#e8d28f';ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(hy,hx));ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-4,-5);ctx.lineTo(-4,5);ctx.fill();ctx.restore();}}
  }
  ctx.restore();
  const vignette=ctx.createRadialGradient(viewW/2,viewH/2,viewW*.16,viewW/2,viewH/2,Math.max(viewW,viewH)*.7);vignette.addColorStop(0,'#17241600');vignette.addColorStop(1,'#15201644');ctx.fillStyle=vignette;ctx.fillRect(0,0,viewW,viewH);
  renderMini();
}
function miniProjection(){const scale=Math.min(mini.width/map.width,mini.height/map.height);return {scale,x:(mini.width-map.width*scale)/2,y:(mini.height-map.height*scale)/2};}
function renderMini(){
  if(state.miniHidden)return;
  const p=miniProjection(),sx=p.scale,sy=p.scale;
  mc.fillStyle='#1c241d';mc.fillRect(0,0,mini.width,mini.height);mc.save();mc.translate(p.x,p.y);
  mc.drawImage(miniTerrain,0,0,map.width*sx,map.height*sy);
  for(const h of map.huts)rect(mc,h.x*sx-3,h.y*sy-3,6,6,h.hp>0?'#e8d591':'#4b573b');
  for(const e of map.enemies)if(e.hp>0)rect(mc,e.x*sx-1,e.y*sy-1,3,3,'#e79b7c');
  for(const site of map.sites){mc.strokeStyle=site.done?'#d6ed92':'#f7dc87';mc.strokeRect(site.x*sx-4,site.y*sy-4,8,8);}
  if(map.operation.type!=='clear'){mc.strokeStyle=state.evacReady?'#d6ed92':'#84976e';mc.beginPath();mc.arc(map.extraction.x*sx,map.extraction.y*sy,5,0,Math.PI*2);mc.stroke();}
  for(const p of map.pickups)if(!p.taken)rect(mc,p.x*sx-1,p.y*sy-1,3,3,p.type==='med'?'#e0e5bb':p.type==='rocket'?'#7d9bb0':'#d6a764');
  for(const m of map.mines||[])if(!m.exploded)rect(mc,m.x*sx-1,m.y*sy-1,3,3,'#c45d45');
  for(const v of map.vehicles||[])if(v.hp>0)rect(mc,v.x*sx-2,v.y*sy-2,5,5,'#9bb56e');
  for(const u of liveSquad())rect(mc,u.x*sx-2,u.y*sy-2,4,4,'#e2f5a3');
  mc.strokeStyle='#edf1d5aa';mc.lineWidth=1;mc.strokeRect((state.camera.x-viewW/scale/2)*sx,(state.camera.y-viewH/scale/2)*sy,viewW/scale*sx,viewH/scale*sy);mc.restore();
}

function drawWorldMap(){
  const c=$('world-map');if(!c||!c.getContext)return;
  const g=c.getContext('2d'),w=c.width||360,h=c.height||110;
  g.fillStyle='#182018';g.fillRect(0,0,w,h);
  g.fillStyle='#314433';g.beginPath();g.ellipse(w*.32,h*.62,90,28,0,0,Math.PI*2);g.fill();
  g.fillStyle='#3d5340';g.beginPath();g.ellipse(w*.7,h*.48,80,34,0,0,Math.PI*2);g.fill();
  const pins=[{x:70,y:48},{x:155,y:38},{x:240,y:42},{x:310,y:58}];
  BIOMES.forEach((b,i)=>{
    const p=pins[i],active=theaterFor(state.mission).id===b.id;
    g.fillStyle=active?'#d6ed92':b.ground;g.beginPath();g.arc(p.x,p.y,active?8:5,0,Math.PI*2);g.fill();
    g.fillStyle=active?'#eef6c8':'#9aa684';g.font='7px monospace';g.textAlign='center';g.fillText(b.id.toUpperCase(),p.x,p.y+18);
  });
  g.textAlign='left';
}
function hubRosterHtml(){
  const next=upcomingRecruits(state.campaign,squad,4);
  const row=u=>`${u.name} ${medalGlyphs(u)} · ${rankStats(u.rank).name}`;
  return `<div class="hub-roster"><div><strong>WYRUSZAJĄ</strong>${squad.map(row).join('<br>')}</div><div><strong>KOLEJKA</strong>${next.map(row).join('<br>')||'—'}</div></div>`;
}
function showOverlay(kind){
  if((kind==='map'||kind==='briefing')&&applyPendingReload())return;
  if(kind==='map'||kind==='briefing')state.phase=kind;
  $('overlay').classList.remove('hidden');
  $('overlay').classList.toggle('hub',kind==='map');
  $('overlay').classList.toggle('paused',kind==='paused');
  $('overlay').scrollTop=0;
  const left=recruitsLeft(state.campaign);
  const promo=(state.promotions||[]).map(p=>`${p.name} → ${RANKS[p.to]}${p.medals?.length?' '+p.medals.map(id=>MEDALS[id].glyph).join(''):''}`).join(' · ');
  const data={
    map:{eyebrow:`TEATR DZIAŁAŃ / ${format(state.mission,3)}`,title:map.operation.name,description:`${map.operation.brief} ${map.layout.hint}`,button:'WYRUSZ',secondary:'⟳  Wylosuj inny teren'},
    briefing:{eyebrow:`DEPESZA Z DOWÓDZTWA / ${format(state.mission,3)}`,title:map.operation.name,description:`${map.operation.brief} ${map.layout.hint}`,button:'ROZPOCZNIJ OPERACJĘ',secondary:'⟳  Wylosuj inny teren'},
    paused:{eyebrow:state.bootcamp?'TRENING WSTRZYMANY':'ŁĄCZNOŚĆ WSTRZYMANA',title:state.bootcamp?'Tu też giną<br>na zawsze.':'Chwila<br>na oddech.',description:state.bootcamp?'Manekiny nie strzelają. Polegli znikają z kolejki. WRÓĆ DO MAPY kończy trening.':isTouchUI()?'Oddział czeka. RUCH: stuknij mapę. OGIEŃ: przytrzymaj palec. Stuknij żołnierza, żeby prowadzić grupę.':'Oddział czeka na twój sygnał. X dzieli drużynę, C scala grupy w pobliżu, Tab przełącza grupy, 1–4 wybiera żołnierza, Shift+przeciągnięcie to lasso. WASD lub strzałki to zwiad, F wraca kamerę, E to pojazd. Pauza: Spacja, P albo Escape. Żołnierze automatycznie strzelają do wrogów w zasięgu.',button:'WRÓĆ NA POLE BITWY',secondary:state.bootcamp?'↖  Wróć do mapy':'↻  Rozpocznij misję od nowa'},
    won:{eyebrow:`RAPORT Z MISJI / ${format(state.mission,3)}`,title:'Sektor<br>zabezpieczony.',description:`${'★'.repeat(state.stars)}${'☆'.repeat(3-state.stars)} · ${liveSquad().length} z 4 żołnierzy wraca do bazy. Premia: +${state.bonus}. ${promo||'Ocalali awansują.'} Gwiazdki: wykonanie misji, pełny oddział, czas poniżej ${Math.floor(map.parTime/60)}:${format(map.parTime%60)}.`,button:'NASTĘPNA MISJA',secondary:'⟳  Rozegraj ten teren ponownie'},
    lost:{eyebrow:'RAPORT Z MISJI / UTRACONO KONTAKT',title:'To jeszcze<br>nie koniec.',description:`Polegli znikają na zawsze. Na wzgórzu zostało ${left} ochotników. Dziel oddział na przesmyku, oszczędzaj ładunki na bunkry.`,button:'PONÓW OPERACJĘ',secondary:'⟳  Wylosuj inny teren'},
    over:{eyebrow:'KAMPANIA ZAKOŃCZONA',title:'Wzgórze<br>bohaterów.',description:'360 ochotników zeszło z zielonego wzgórza. Wojna pożarła ich wszystkich. War has never been so much fun.',button:'NOWA KAMPANIA',secondary:'—'}
  }[kind];
  if(!data)return;
  $('overlay-note').innerHTML=`${map.layout.name} · ${map.cols} × ${map.rows} · Zagrożenie ${map.difficulty.level}/13. Premia czasu do ${Math.floor(map.parTime/60)}:${format(map.parTime%60)} (bez limitu misji). ${state.mission>=6?'Ciężcy (Ⅱ) prowadzą szybki ogień. ':''}${state.mission>=3?'Strzelcy (⌖) celują przez chwilę — zejdź z linii. ':state.mission>=2?'Zwiadowcy (») szybko obchodzą flankę. ':''}<br>LPM ruch · PPM ogień · G granat · R rakieta · X podziel · C scal · Tab grupa · 1–4 żołnierz · Shift lasso · WASD/strzałki zwiad · F kamera · E pojazd · Spacja/P/Esc pauza`;
  $('overlay-eyebrow').textContent=data.eyebrow;$('overlay-title').innerHTML=data.title;$('overlay-description').textContent=data.description;$('deploy').innerHTML=`${data.button} <span>↗</span>`;$('reroll').textContent=data.secondary;
  $('scoreboard').classList.toggle('hidden',kind!=='won'&&kind!=='lost'&&kind!=='over');
  $('world-map')?.classList.toggle('hidden',kind!=='map'||state.graveOpen);
  $('hub-roster')&&($('hub-roster').innerHTML=kind==='map'&&!state.graveOpen?hubRosterHtml():'');
  $('hub-roster')?.classList.toggle('hidden',kind!=='map'||state.graveOpen);
  $('hub-actions')?.classList.toggle('hidden',kind!=='map');
  $('grave-panel')?.classList.toggle('hidden',kind!=='map'||!state.graveOpen);
  if($('toggle-graves'))$('toggle-graves').textContent=state.graveOpen?'UKRYJ CMENTARZ':'CMENTARZ';
  $('heroes-hill')?.classList.toggle('hidden',kind==='map'&&state.graveOpen);
  if(kind==='map')drawWorldMap();
  $('briefing-details').innerHTML=(kind==='won'||kind==='lost'||kind==='over')?`<div><strong>${format(state.kills)}</strong><span>WYELIMINOWANYCH</span></div><div><strong>${$('timer').textContent}</strong><span>CZAS OPERACJI</span></div><div><strong>${state.score}</strong><span>PUNKTÓW</span></div>`:`<div><strong>04</strong><span>ŻOŁNIERZY</span></div><div><strong>${format(map.enemies.length)}</strong><span>PRZECIWNIKÓW</span></div><div><strong>${format(map.sites.length||map.huts.length)}</strong><span>${map.operation.type==='rescue'?'JENIEC':map.operation.type==='capture'?'RADIOSTACJE':map.bootcamp?'MANEKINY':'POSTERUNKI'}</span></div>`;
  drawHill();updateUI();
}
function startMission(){
  saveActive=true;state.phase='playing';state.firing=false;state.keys.clear();$('overlay').classList.add('hidden');updateUI();canvas.focus();beep('start');
  const lead=squad.find(u=>u.id===state.groupLeader[u.group])||liveSquad()[0];
  toast(state.bootcamp?'Tu też giną na zawsze.':state.evacReady?'Zbierz ocalałych w strefie ewakuacji.':lead?`NAPRZÓD! ${lead.name} prowadzi.`:map.operation.brief);
  saveProgress();
}
function pause(){if(state.phase==='playing'){state.phase='paused';state.firing=false;state.keys.clear();showOverlay('paused');saveProgress();}else if(state.phase==='paused')startMission();}
function endMission(won){
  state.deaths=squad.filter(u=>u.hp<=0).length;
  if(state.bootcamp){
    settleBootCamp(state.campaign,squad,state.mission);
    const left=recruitsLeft(state.campaign);
    state.firing=false;state.keys.clear();
    if(left<=0){state.phase='over';drawHill();showOverlay('over');saveProgress();return;}
    leaveBootCamp();return;
  }
  if(won){state.stars=1+Number(liveSquad().length===4)+Number(state.elapsed<=map.parTime);}
  state.promotions=settleMission(state.campaign,squad,state.mission,won,{stars:state.stars});
  const left=recruitsLeft(state.campaign);
  state.phase=won?'won':left<=0?'over':'lost';
  state.firing=false;state.keys.clear();
  if(won){
    const medalBonus=state.promotions.reduce((n,p)=>n+(p.medals?.length||0)*100,0);
    state.bonus=liveSquad().length*250+(state.elapsed<=map.parTime?500:0);
    state.score+=state.bonus+medalBonus;beep('win');
  }else beep('loss');
  updateUI();drawHill();showOverlay(state.phase);saveProgress();
}
function enterBootCamp(){
  if(state.phase!=='map'&&state.phase!=='briefing')return;
  state.opsSeed=map.seed;state.opsPhase='map';
  initMission(freshSeed(),true,null,{bootcamp:true});
  startMission();
}
function leaveBootCamp(){
  settleBootCamp(state.campaign,squad,state.mission);
  state.bootcamp=false;state.phase='map';
  initMission(state.opsSeed||freshSeed());
  if(!squad.length){state.phase='over';showOverlay('over');return;}
  showOverlay('map');saveProgress();
}

function beep(type){
  if(!state.sound)return;
  try{
    audioCtx??=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();
    const now=audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);
    const f={shot:110,explosion:75,move:550,throw:260,pickup:850,start:440,win:660,loss:180}[type]||400,dur=type==='explosion'?.5:type==='shot'?.06:.16;
    o.type=type==='shot'||type==='explosion'?'sawtooth':'square';o.frequency.setValueAtTime(f,now);o.frequency.exponentialRampToValueAtTime(type==='explosion'?20:type==='win'?1100:f*.6,now+dur);g.gain.setValueAtTime(type==='shot'?.018:.045,now);g.gain.exponentialRampToValueAtTime(.0001,now+dur);o.start(now);o.stop(now+dur);
  }catch{state.sound=false;syncSoundButton();}
}

function beginHeavy(type){if(state.phase!=='playing')return;const u=selectedSquad()[0];state.heavyAim={type,from:u?{x:u.x,y:u.y}:{x:state.pointer.worldX,y:state.pointer.worldY},to:{x:state.pointer.worldX,y:state.pointer.worldY}};}
function endPointer(e){
  const rec=pointers.get(e.pointerId);pointers.delete(e.pointerId);
  if(!rec){if(!pointers.size)state.firing=false;return;}
  if(rec.role==='lasso')finishLasso();
  if(rec.role==='heavy'){const aim=state.heavyAim;state.heavyAim=null;if(aim)throwHeavy(aim.type,aim.to);}
}

canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointermove',e=>{
  const r=canvas.getBoundingClientRect();state.pointer.x=e.clientX-r.left;state.pointer.y=e.clientY-r.top;
  const p=screenToWorld(state.pointer.x,state.pointer.y);state.pointer.worldX=p.x;state.pointer.worldY=p.y;
  $('coordinates').textContent=`SEKTOR ${format(Math.floor(p.x/TILE))} / ${format(Math.floor(p.y/TILE))}`;
  const rec=pointers.get(e.pointerId);if(!rec)return;
  if(rec.role==='lasso')state.lasso.push(p);
  else if(rec.role==='heavy'&&state.heavyAim)state.heavyAim.to=p;
});
canvas.addEventListener('pointerdown',e=>{
  e.preventDefault();if(state.phase!=='playing')return;canvas.focus();
  const r=canvas.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top,p=screenToWorld(sx,sy);
  Object.assign(state.pointer,{x:sx,y:sy,worldX:p.x,worldY:p.y});
  if(state.heavyAim){pointers.set(e.pointerId,{role:'heavy'});canvas.setPointerCapture(e.pointerId);return;}
  if(state.lassoMode||e.shiftKey){state.lasso=[p];pointers.set(e.pointerId,{role:'lasso'});canvas.setPointerCapture(e.pointerId);return;}
  if(e.button===2||(e.pointerType==='touch'&&state.touchMode==='fire')){
    state.firing=true;canvas.setPointerCapture(e.pointerId);return;
  }
  if(e.button===0){
    const hit=e.pointerType==='touch'?22:15;
    const clicked=liveSquad().find(u=>distance(u,p)<hit);
    if(clicked){promoteLeader(clicked.id);return;}
    issueMove(p);
  }
});
window.addEventListener('pointerup',e=>{endPointer(e);if(!pointers.size)state.firing=false;});
canvas.addEventListener('pointercancel',endPointer);
mini.addEventListener('pointerdown',e=>{if(state.miniHidden||state.phase!=='playing')return;const r=mini.getBoundingClientRect(),p=miniProjection(),x=((e.clientX-r.left)/r.width*mini.width-p.x)/p.scale,y=((e.clientY-r.top)/r.height*mini.height-p.y)/p.scale;if(x<0||y<0||x>map.width||y>map.height)return;state.camera.x=x;state.camera.y=y;state.follow=false;clampCamera();});
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement)return;
  const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(key))e.preventDefault();
  if(e.repeat)return;
  if(key==='m'){toggleMini();return;}
  if(key===' '||key==='escape'||key==='p'){pause();return;}
  if(state.phase!=='playing')return;state.keys.add(key);
  if(key==='g')throwGrenade();if(key==='r')throwRocket();if(key==='q')regroup();if(key==='x')splitSquad();if(key==='c')mergeSquad();if(key==='tab')cycleGroup();
  if(key==='e')toggleVehicle();
  if(key==='f'){state.follow=true;toast('Kamera śledzi oddział');}
  if(['1','2','3','4'].includes(key))select(Number(key)-1);
});
window.addEventListener('keyup',e=>state.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{state.firing=false;state.keys.clear();if(state.phase==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(state.phase==='playing')pause();else saveProgress();}else checkAppVersion();});
window.addEventListener('pagehide',()=>saveProgress());
$('save').onclick=()=>saveProgress(true);
$('new-campaign').onclick=()=>{
  if(!window.confirm('Rozpocząć nową kampanię? Bieżący zapis zostanie zastąpiony.'))return;
  state.mission=1;state.score=0;state.phase='map';state.keys.clear();state.campaign=createCampaign();state.bootcamp=false;
  initMission();showOverlay('map');saveActive=true;saveProgress();
};
$('pause').onclick=pause;$('regroup').onclick=regroup;$('split').onclick=splitSquad;$('merge').onclick=mergeSquad;
$('center-cam').onclick=()=>{state.follow=true;toast('Kamera śledzi oddział');};
$('sound').onclick=()=>{state.sound=!state.sound;syncSoundButton();beep('move');};
$('deploy').onclick=()=>{
  if(state.phase==='over'){$('new-campaign').onclick();return;}
  if(state.phase==='won'){state.mission++;initMission();state.phase='map';showOverlay('map');saveProgress();return;}
  else if(state.phase==='lost'){state.score=state.missionStartScore;initMission(map.seed,true);}
  startMission();
};
$('reroll').onclick=()=>{
  if(state.phase==='over')return;
  if(state.bootcamp&&(state.phase==='paused'||state.phase==='playing')){leaveBootCamp();return;}
  if(state.phase==='paused'||state.phase==='won'){state.score=state.missionStartScore;initMission(map.seed,true);startMission();}
  else{if(state.phase==='lost')state.score=state.missionStartScore;initMission();state.phase=state.phase==='briefing'?'briefing':'map';showOverlay(state.phase);saveProgress();}
};
$('copy-seed').onclick=async()=>{const url=new URL(location.href);url.searchParams.set('seed',map.seed);url.searchParams.set('mission',state.mission);try{await navigator.clipboard.writeText(url.href);toast('Skopiowano link z ziarnem mapy');}catch{toast(`Ziarno mapy: ${map.seed}, misja: ${state.mission}`);}};
$('touch-mode').onclick=()=>{
  state.touchMode=state.touchMode==='move'?'fire':'move';
  const fire=state.touchMode==='fire';
  $('touch-mode').textContent=fire?'OGIEŃ':'RUCH';
  $('touch-mode').classList.toggle('active',fire);
  $('touch-mode').setAttribute('aria-label',fire?'Tryb: ogień':'Tryb: ruch');
  toast(fire?'Przytrzymaj palec, żeby strzelać':'Stuknij mapę, żeby wysłać oddział');
};
$('touch-grenade').onpointerdown=e=>{e.preventDefault();beginHeavy('grenade');pointers.set(e.pointerId,{role:'heavy'});};
$('touch-rocket').onpointerdown=e=>{e.preventDefault();beginHeavy('rocket');pointers.set(e.pointerId,{role:'heavy'});};
$('touch-grenade').onclick=()=>{if(!state.heavyAim)throwGrenade();};
$('touch-rocket').onclick=()=>{if(!state.heavyAim)throwRocket();};
$('touch-split').onclick=splitSquad;$('touch-merge').onclick=mergeSquad;
$('touch-lasso').onclick=()=>{state.lassoMode=!state.lassoMode;$('touch-lasso').classList.toggle('active',state.lassoMode);toast(state.lassoMode?'Zakreśl pętlę wokół żołnierzy':'Lasso wyłączone');};
$('touch-center').onclick=()=>{state.follow=true;toast('Kamera śledzi oddział');};
$('touch-mini')&&($('touch-mini').onclick=toggleMini);
$('hide-mini')&&($('hide-mini').onclick=toggleMini);
$('show-mini')&&($('show-mini').onclick=toggleMini);
$('bootcamp')&&($('bootcamp').onclick=enterBootCamp);
$('toggle-graves')&&($('toggle-graves').onclick=()=>{state.graveOpen=!state.graveOpen;showOverlay(state.phase==='map'?'map':state.phase);});
new ResizeObserver(resize).observe($('battlefield'));
syncTouchUI();
syncSoundButton();
for(const query of ['(pointer: coarse)','(hover: none)','(max-width: 600px)','(max-height: 500px)']){
  window.matchMedia?.(query)?.addEventListener?.('change',syncTouchUI);
}
const hasMissionLink=(urlParams.has('seed')&&Number.isInteger(initialSeed)&&initialSeed>=0)||(Number.isInteger(initialMission)&&initialMission>=1&&initialMission<=999);
if(!loadProgress()){
  initMission(Number.isInteger(initialSeed)&&urlParams.has('seed')&&initialSeed>=0?initialSeed:freshSeed());showOverlay(hasMissionLink?'briefing':'map');
  if(hasMissionLink)$('save-status').textContent='Mapa z linku. Rozpoczęcie operacji lub ręczny zapis zastąpi poprzedni zapis.';
}
function frame(time){const dt=Math.min((time-lastTime)/1000,.04);lastTime=time;visualTime=time/1000;tick(dt);render();requestAnimationFrame(frame);}
requestAnimationFrame(frame);

window.tinyFront={snapshot:()=>({phase:state.phase,seed:map.seed,mission:state.mission,score:state.score,grenades:state.grenades,elapsed:state.elapsed,camera:{...state.camera},squad:squad.map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp,pathLength:u.path.length,name:u.name,rank:u.rank})),enemies:map.enemies.filter(e=>e.hp>0).length,huts:map.huts.filter(h=>h.hp>0).length,selected:[...state.selected],width:map.width,height:map.height,layout:map.layout.id,operation:map.operation.type,difficulty:map.difficulty.level,sites:map.sites.map(s=>({x:s.x,y:s.y,done:s.done,progress:s.progress})),evacReady:state.evacReady,graves:state.campaign.graves.length,recruits:recruitsLeft(state.campaign)})};
