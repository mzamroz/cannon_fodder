import {TILE,random,generateMap,walkable,lineClear,findPath,moveUnit,distance,missionStatus,updateSites} from './engine.js';
import {SAVE_KEY,encodeSave,decodeSave} from './save.js';

const $=id=>document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d'),mini=$('minimap'),mc=mini.getContext('2d');
const names=['JOOLS','JOPS','STOO','RJ'];
const state={phase:'briefing',mission:1,score:0,grenades:6,elapsed:0,kills:0,hutsDone:0,selected:new Set([0,1,2,3]),bullets:[],particles:[],bombs:[],decals:[],rings:[],camera:{x:0,y:0},pointer:{x:0,y:0,worldX:0,worldY:0},firing:false,keys:new Set(),follow:true,touchMode:'move',shake:0,sound:false,toastTime:0,uiTime:0};
let saveActive=false,saveTimer=0,saveFailed=false,missionLinkCleared=false;
let map,squad,terrain,miniTerrain,viewW=1000,viewH=700,scale=1,audioCtx,lastTime=0,visualTime=0;
const urlParams=new URLSearchParams(location.search),initialSeed=Number(urlParams.get('seed'));
const initialMission=Number(urlParams.get('mission'));
if(Number.isInteger(initialMission)&&initialMission>=1&&initialMission<=999)state.mission=initialMission;
function freshSeed(){return crypto.getRandomValues(new Uint32Array(1))[0]%99999999;}
function format(n,size=2){return String(n).padStart(size,'0');}
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);}

function initMission(seed=freshSeed(),retry=false,saved=null){
  map=saved?.map??generateMap(seed,state.mission);
  Object.assign(state,{elapsed:0,kills:0,hutsDone:0,bullets:[],particles:[],bombs:[],decals:[],rings:[],firing:false,grenades:map.difficulty.grenades,selected:new Set([0,1,2,3]),follow:true,shake:0,hutHint:false,evacReady:false,stars:0,bonus:0});
  squad=names.map((name,i)=>({id:i,name,x:map.spawn.x+(i%2)*27,y:map.spawn.y+Math.floor(i/2)*27,hp:100,maxHp:100,angle:-Math.PI/2,path:[],cooldown:i*.05,kills:0}));
  if(!retry)state.missionStartScore=state.score;
  state.camera.x=map.spawn.x;state.camera.y=map.spawn.y;
  if(saved){
    Object.assign(state,saved.state,{phase:saved.state.phase==='playing'?'paused':saved.state.phase});
    squad.forEach((u,i)=>Object.assign(u,saved.squad[i]));
  }
  buildTerrain();buildSquadUI();updateUI();resize();
  $('operation-title').textContent=map.operation.name;$('mission-terrain').textContent=`${map.layout.name} · ${map.cols} × ${map.rows}`;$('mission-difficulty').textContent=`ZAGROŻENIE ${map.difficulty.level}/13`; $('biome-label').textContent=map.biome.label;
  document.querySelector('.operation-number').innerHTML=`${format(state.mission)} <span>/ ∞</span>`;
  $('header-mission').textContent=`MISJA ${format(state.mission)}`;$('seed-label').textContent=format(seed,8);$('weather').textContent=map.biome.sky;
}

function saveProgress(manual=false){
  if(manual)saveActive=true;
  if(!saveActive)return;
  try{
    localStorage.setItem(SAVE_KEY,encodeSave(state,map,squad));
    // Once a linked operation becomes the campaign, refresh must follow its
    // latest mission instead of reopening the original link after a victory.
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
    state.mission=saved.state.mission;initMission(saved.map.seed,false,saved);
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
  const c=terrain.getContext('2d'),b=map.biome,rng=random(map.seed+33),COLS=map.cols,ROWS=map.rows;
  c.imageSmoothingEnabled=false;
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const t=map.tiles[y*COLS+x],px=x*TILE,py=y*TILE;
    rect(c,px,py,TILE,TILE,t===1?b.water:t===3?b.path:t===4?'#887f53':b.ground);
    if(t===4){for(let k=0;k<TILE;k+=8){rect(c,px,py+k,TILE,2,'#645f42');rect(c,px+2,py+k+2,TILE-4,2,'#a39b6b');}rect(c,px+2,py,3,TILE,'#c1b588');rect(c,px+TILE-5,py,3,TILE,'#c1b588');continue;}
    for(let k=0;k<(t===1?4:14);k++){
      const dx=Math.floor(rng()*22)*2,dy=Math.floor(rng()*22)*2;
      if(t===1)rect(c,px+dx,py+dy,6+Math.floor(rng()*6),2,rng()<.6?b.waterLight:b.water);
      else if(t===3){rect(c,px+dx,py+dy,2+rng()*3,2,rng()<.5?b.ground:b.light);}
      else{rect(c,px+dx,py+dy,2+rng()*4,2,rng()<.5?b.light:b.dark);if(rng()<.3)rect(c,px+dx+2,py+dy-3,2,4,b.dark);}
    }
    if(t!==1&&t!==4){for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<COLS&&ny<ROWS&&map.tiles[ny*COLS+nx]===1){rect(c,px+(dx===1?42:0),py+(dy===1?42:0),dx?6:48,dy?6:48,b.dark);rect(c,px+(dx===1?46:0),py+(dy===1?46:0),dx?2:48,dy?2:48,b.light);}}}
  }
  // Small clusters of wildflowers, pebbles and worn tyre tracks.
  for(let i=0;i<480;i++){const x=rng()*map.width,y=rng()*map.height;if(walkable(map,x,y)&&map.tiles[Math.floor(y/TILE)*COLS+Math.floor(x/TILE)]===0){rect(c,x,y,2,3,rng()<.7?'#bbc27d':'#d5d3a0');}}
  // Landing zone, hand-painted on the ground.
  c.strokeStyle='#dbe5a580';c.lineWidth=3;c.setLineDash([10,7]);c.strokeRect(map.spawn.x-63,map.spawn.y-56,151,147);c.setLineDash([]);
  c.font='bold 12px monospace';c.fillStyle='#dbe5a5aa';c.fillText(map.operation.type==='clear'?'LĄDOWANIE':'EWAKUACJA',map.spawn.x-44,map.spawn.y+115);
  miniTerrain=document.createElement('canvas');miniTerrain.width=COLS*4;miniTerrain.height=ROWS*4;
  const m=miniTerrain.getContext('2d');
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const t=map.tiles[y*COLS+x];rect(m,x*4,y*4,4,4,t===1?b.water:t===2?b.tree:t===3?b.path:t===4?'#a39b6b':b.ground);}
}

function drawSoldier(c,u,x,y,enemy=false,portrait=false){
  const moving=u.path?.length>0,step=moving?Math.sin(visualTime*15+u.id)*3:0;
  if(!portrait){c.fillStyle='#23331d55';c.beginPath();c.ellipse(x+3,y+7,10,5,0,0,Math.PI*2);c.fill();}
  const uniform=enemy?(u.role==='marksman'?'#777e8a':u.role==='scout'?'#bd995b':u.role==='gunner'?'#824e49':'#a26848'):'#526541',light=enemy?'#c18a5c':'#81935b',helmet=enemy?'#785143':'#425738';
  rect(c,x-6,y+3,4,7+step,'#333e30');rect(c,x+2,y+3,4,7-step,'#333e30');
  rect(c,x-7,y-7,14,12,uniform);rect(c,x-5,y-7,4,10,light);rect(c,x+3,y-5,5,8,helmet);
  rect(c,x-4,y-13,9,8,'#d5bb88');rect(c,x+3,y-10,3,4,'#ad8d5f');
  rect(c,x-6,y-17,12,6,helmet);rect(c,x-4,y-19,8,3,light);rect(c,x-7,y-13,14,3,helmet);
  if(portrait){rect(c,x-4,y-10,2,2,'#383d2a');rect(c,x+2,y-10,2,2,'#383d2a');return;}
  if(enemy&&u.role!=='rifle'){c.font='bold 10px monospace';c.fillStyle='#fff0c0';c.textAlign='center';c.fillText(u.role==='marksman'?'⌖':u.role==='scout'?'»':'Ⅱ',x,y-31);c.textAlign='left';}
  c.save();c.translate(Math.round(x),Math.round(y-2));c.rotate(u.angle);rect(c,3,-2,16,4,'#30382d');rect(c,7,-3,6,2,'#818c68');rect(c,4,2,5,3,'#d5bb88');
  if(u.flash>0){rect(c,19,-3,7,6,'#ffeb9c');rect(c,24,-1,5,2,'#fff2d4');}c.restore();
}

function buildSquadUI(){
  $('squad-list').innerHTML=squad.map((u,i)=>`<button class="soldier selected" id="soldier-${i}" title="Wybierz ${u.name} (${i+1})"><canvas class="portrait" width="32" height="36" id="portrait-${i}"></canvas><div class="soldier-info"><div class="soldier-name">${u.name}<span id="hp-${i}">100 HP</span></div><div class="health"><i id="health-${i}" style="width:100%"></i></div></div><kbd>${i+1}</kbd></button>`).join('');
  squad.forEach((u,i)=>{drawSoldier($(`portrait-${i}`).getContext('2d'),u,16,23,false,true);$(`soldier-${i}`).onclick=()=>select(i);});
}
function select(id){if(squad[id].hp<=0)return;state.selected=new Set([id]);updateUI();toast(`${squad[id].name} czeka na rozkaz`);}
function regroup(){state.selected=new Set(squad.filter(u=>u.hp>0).map(u=>u.id));updateUI();toast('Cały oddział wybrany');}
function liveSquad(){return squad.filter(u=>u.hp>0);}
function selectedSquad(){return squad.filter(u=>u.hp>0&&state.selected.has(u.id));}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');state.toastTime=3.2;}

function updateUI(){
  const status=missionStatus(map,squad),type=map.operation.type;
  const completed=map.sites.filter(s=>s.done).length,activeSite=map.sites.find(s=>!s.done);
  const siteProgress=activeSite?` · ${Math.floor(activeSite.progress)}/${activeSite.required} s${activeSite.contested?' · WRÓG W STREFIE':''}`:'';
  $('primary-label').textContent={clear:'Wyeliminuj garnizon',sabotage:'Zniszcz posterunki',rescue:'Uwolnij jeńca',capture:'Przejmij radiostacje'}[type];
  $('primary-progress').textContent=type==='clear'?`${state.kills} / ${map.enemies.length} wyeliminowanych`:type==='sabotage'?`${state.hutsDone} / ${map.huts.length} zniszczonych`:`${completed} / ${map.sites.length} zabezpieczonych${siteProgress}`;
  $('secondary-label').textContent=type==='clear'?'Zniszcz posterunki':'Ewakuuj cały oddział';
  $('secondary-progress').textContent=type==='clear'?`${state.hutsDone} / ${map.huts.length} zniszczonych`:status.primary?`${liveSquad().filter(u=>distance(u,map.extraction)<map.extraction.radius).length} / ${liveSquad().length} w strefie`:'Najpierw wykonaj główny cel';
  for(const[id,done]of[['enemy-objective',status.primary],['hut-objective',status.secondary]]){$(id).classList.toggle('done',done);$(id).querySelector('.check').textContent=done?'✓':'·';}
  $('objective-count').textContent=`${Number(status.primary)+Number(status.secondary)}/2`;
  $('alive-count').textContent=format(liveSquad().length);$('grenades').textContent=format(state.grenades);$('score').textContent=format(state.score,4);
  $('timer').textContent=`${format(Math.floor(state.elapsed/60))}:${format(Math.floor(state.elapsed%60))}`;
  for(const u of squad){$(`soldier-${u.id}`).classList.toggle('selected',state.selected.has(u.id)&&u.hp>0);$(`soldier-${u.id}`).classList.toggle('dead',u.hp<=0);$(`soldier-${u.id}`).disabled=u.hp<=0;$(`hp-${u.id}`).textContent=u.hp>0?`${Math.ceil(u.hp)} HP`:'POLEGŁ';$(`health-${u.id}`).style.width=`${Math.max(0,u.hp)}%`;$(`health-${u.id}`).style.background=u.hp<35?'#e6a078':'';}
  const active=state.phase==='playing';$('field-status').textContent=active?'OPERACJA W TOKU':state.phase==='paused'?'OPERACJA WSTRZYMANA':state.phase==='won'?'SEKTOR ZABEZPIECZONY':state.phase==='lost'?'UTRACONO KONTAKT':'OCZEKIWANIE NA ROZKAZ';
  $('connection-status').textContent=active?'ŁĄCZNOŚĆ AKTYWNA':'ODDZIAŁ W GOTOWOŚCI';
  $('pause').textContent=state.phase==='paused'?'▶ WZNÓW':'Ⅱ PAUZA';
}

function resize(){
  const r=canvas.getBoundingClientRect();viewW=Math.max(1,r.width);viewH=Math.max(1,r.height);
  // A low resolution world keeps each sprite crisp on Retina screens too.
  const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(viewW*dpr);canvas.height=Math.round(viewH*dpr);
  scale=viewW<600?.85:1.1;ctx.imageSmoothingEnabled=false;clampCamera();
}
function clampCamera(){const halfW=viewW/scale/2,halfH=viewH/scale/2;state.camera.x=map.width<=halfW*2?map.width/2:Math.max(halfW,Math.min(map.width-halfW,state.camera.x));state.camera.y=map.height<=halfH*2?map.height/2:Math.max(halfH,Math.min(map.height-halfH,state.camera.y));}
function screenToWorld(x,y){return{x:(x-viewW/2)/scale+state.camera.x,y:(y-viewH/2)/scale+state.camera.y};}

function issueMove(target){
  if(state.phase!=='playing')return;
  if(!walkable(map,target.x,target.y)){toast('Teren niedostępny. Wybierz drogę lub otwarty teren.');return;}
  const units=selectedSquad();if(!units.length){regroup();return;}
  units.forEach((u,i)=>{
    const spread=units.length>1?{x:(i%2)*22-11,y:Math.floor(i/2)*22-11}:{x:0,y:0};
    const dest={x:target.x+spread.x,y:target.y+spread.y};
    u.path=findPath(map,u,walkable(map,dest.x,dest.y)?dest:target);
    if(u.path.length&&walkable(map,dest.x,dest.y)){const tail=u.path[u.path.length-1];if(lineClear(map,tail,dest))u.path.push(dest);}
  });
  state.rings.push({...target,life:1,max:1});beep('move');
}

function shoot(unit,target,enemy=false){
  const a=Math.atan2(target.y-unit.y,target.x-unit.x),spread=(Math.random()-.5)*(enemy?.11:.045);
  unit.angle=a;unit.flash=.07;unit.cooldown=enemy?(map.difficulty.fireDelay+Math.random()*.25)*(unit.role==='gunner'?.5:unit.role==='marksman'?1.4:1):.24;
  state.bullets.push({x:unit.x+Math.cos(a)*17,y:unit.y-2+Math.sin(a)*17,vx:Math.cos(a+spread)*640,vy:Math.sin(a+spread)*640,enemy,life:.83,damage:enemy?map.difficulty.damage*(unit.role==='marksman'?1.6:unit.role==='gunner'?.8:1):23,owner:unit.id});
  if(!enemy)beep('shot');
}
function throwGrenade(){
  if(state.phase!=='playing')return;
  if(state.grenades<=0){toast('Brak granatów. Szukaj pomarańczowych skrzynek z amunicją.');return;}
  const target={x:state.pointer.worldX,y:state.pointer.worldY};
  const units=selectedSquad().sort((a,b)=>distance(a,target)-distance(b,target));if(!units.length)return;
  const u=units[0],d=distance(u,target);if(d>340){toast('Za daleko! Podejdź bliżej (zasięg granatu: 340).');return;}
  if(d<35){toast('Celuj dalej od żołnierza.');return;}
  state.grenades--;state.bombs.push({from:{x:u.x,y:u.y},to:target,life:0,duration:.8});beep('throw');updateUI();
}
function explode(p){
  state.shake=7;beep('explosion');
  for(let i=0;i<48;i++){const a=Math.random()*Math.PI*2,s=25+Math.random()*160;state.particles.push({x:p.x,y:p.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+Math.random()*.65,max:1,color:['#f2d388','#eaa168','#ded3a5','#545743','#343e30'][i%5],size:3+Math.random()*7});}
  state.decals.push({...p,type:'crater'});
  for(const e of map.enemies)if(e.hp>0&&distance(p,e)<110)damageEnemy(e,120*(1-distance(p,e)/155));
  for(const h of map.huts)if(h.hp>0&&distance(p,h)<110){h.hp=0;state.hutsDone++;state.score+=300;toast('Posterunek zniszczony +300');}
  // Grenades are safe for the squad; positioning and incoming fire remain the challenge.
  updateUI();
}
function damageEnemy(e,amount,owner){
  if(e.hp<=0)return;e.hp-=amount;e.alert=8;for(const other of map.enemies)if(other.hp>0&&distance(e,other)<180)other.alert=5;
  if(e.hp<=0){state.kills++;state.score+=100;if(owner!==undefined)squad[owner].kills++;state.decals.push({x:e.x,y:e.y,type:'enemy',angle:e.angle});for(let i=0;i<5;i++)state.particles.push({x:e.x,y:e.y,vx:(Math.random()-.5)*40,vy:(Math.random()-.5)*40,life:.4,max:.4,color:'#ccba87',size:2});}
}
function damageSoldier(u,amount){
  u.hp=Math.max(0,u.hp-amount);
  if(u.hp===0){u.path=[];state.selected.delete(u.id);state.decals.push({x:u.x,y:u.y,type:'ally',angle:u.angle});toast(`${u.name} poległ. Dbaj o resztę oddziału.`);beep('loss');if(!state.selected.size)state.selected=new Set(liveSquad().map(s=>s.id));updateUI();}
}

function tick(dt){
  if(state.toastTime>0){state.toastTime-=dt;if(state.toastTime<=0)$('toast').classList.remove('visible');}
  if(state.phase!=='playing')return;
  state.elapsed+=dt;state.shake=Math.max(0,state.shake-dt*22);
  const alive=liveSquad(),aim=screenToWorld(state.pointer.x,state.pointer.y);state.pointer.worldX=aim.x;state.pointer.worldY=aim.y;
  const dx=Number(state.keys.has('d')||state.keys.has('arrowright'))-Number(state.keys.has('a')||state.keys.has('arrowleft'));
  const dy=Number(state.keys.has('s')||state.keys.has('arrowdown'))-Number(state.keys.has('w')||state.keys.has('arrowup'));
  if(dx||dy){state.follow=false;state.camera.x+=dx*560*dt;state.camera.y+=dy*560*dt;}
  if(state.follow&&alive.length){const focus=selectedSquad().length?selectedSquad():alive;const x=focus.reduce((n,u)=>n+u.x,0)/focus.length,y=focus.reduce((n,u)=>n+u.y,0)/focus.length;state.camera.x+=(x-state.camera.x)*Math.min(1,dt*3);state.camera.y+=(y-state.camera.y)*Math.min(1,dt*3);}
  clampCamera();
  for(const u of alive){
    u.cooldown-=dt;u.flash=Math.max(0,(u.flash||0)-dt);
    moveUnit(map,u,dt,112);
    if(u.cooldown<=0){
      if(state.firing&&state.selected.has(u.id)){shoot(u,aim);}
      else{let target=null,best=300;for(const e of map.enemies)if(e.hp>0){const d=distance(u,e);if(d<best&&lineClear(map,u,e)){target=e;best=d;}}if(target)shoot(u,target);}
    }
  }
  for(const e of map.enemies){
    if(e.hp<=0)continue;e.cooldown-=dt;e.flash=Math.max(0,(e.flash||0)-dt);e.repath-=dt;e.patrol-=dt;e.alert-=dt;
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
      if(e.patrol<=0){const radius=e.role==='scout'?300:160,t={x:e.home.x+(Math.random()-.5)*radius,y:e.home.y+(Math.random()-.5)*radius};if(walkable(map,t.x,t.y)&&distance(t,map.spawn)>380)e.path=findPath(map,e,t);e.patrol=4+Math.random()*4;}
    }
    moveUnit(map,e,dt,map.difficulty.speed*(e.role==='scout'?1.4:e.role==='gunner'?.75:1));
  }
  for(const b of state.bullets){
    const steps=Math.ceil(Math.hypot(b.vx,b.vy)*dt/7);
    for(let i=0;i<steps&&b.life>0;i++){
      b.x+=b.vx*dt/steps;b.y+=b.vy*dt/steps;
      if(!walkable(map,b.x,b.y)){b.life=0;spark(b.x,b.y);break;}
      const targets=b.enemy?alive:map.enemies;
      for(const t of targets)if(t.hp>0&&distance(b,t)<12){b.enemy?damageSoldier(t,b.damage):damageEnemy(t,b.damage,b.owner);b.life=0;spark(b.x,b.y);break;}
      if(!b.enemy&&b.life>0)for(const h of map.huts)if(h.hp>0&&Math.abs(b.x-h.x)<30&&Math.abs(b.y-h.y)<25){b.life=0;spark(b.x,b.y);if(!state.hutHint){state.hutHint=true;toast('Posterunki są opancerzone — użyj granatu (G).');}break;}
    }b.life-=dt;
  }
  state.bullets=state.bullets.filter(b=>b.life>0);
  for(const b of state.bombs){b.life+=dt;if(b.life>=b.duration&&!b.exploded){b.exploded=true;explode(b.to);}}
  state.bombs=state.bombs.filter(b=>!b.exploded);
  for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.95;p.vy*=.95;}state.particles=state.particles.filter(p=>p.life>0);
  for(const r of state.rings)r.life-=dt;state.rings=state.rings.filter(r=>r.life>0);
  for(const p of map.pickups)if(!p.taken){const u=alive.find(u=>distance(u,p)<26);if(u){if(p.type==='med'&&alive.some(s=>s.hp<100)){alive.forEach(s=>s.hp=Math.min(100,s.hp+40));p.taken=true;toast('Apteczka: +40 zdrowia dla całego oddziału');beep('pickup');}else if(p.type==='grenade'){state.grenades+=3;p.taken=true;toast('Zaopatrzenie: +3 granaty');beep('pickup');}}}
  // Keep objectives completable even if every grenade was spent away from a target.
  if(state.grenades===0&&!state.bombs.length&&state.hutsDone<map.huts.length&&!map.pickups.some(p=>p.type==='grenade'&&!p.taken)){
    map.pickups.push({x:map.spawn.x,y:map.spawn.y,type:'grenade',taken:false});toast('Zrzut granatów czeka w strefie lądowania.');
  }
  updateSites(map,squad,dt);
  const status=missionStatus(map,squad);
  if(map.operation.type!=='clear'&&status.primary&&!state.evacReady){state.evacReady=true;toast('Cel wykonany! Doprowadź wszystkich ocalałych do zielonej strefy ewakuacji.');beep('pickup');}
  state.uiTime-=dt;if(state.uiTime<=0){updateUI();state.uiTime=.15;}
  if(liveSquad().length===0)endMission(false);
  else if(status.won)endMission(true);
  if(state.phase==='playing'){saveTimer+=dt;if(saveTimer>=5)saveProgress();}
}
function spark(x,y){state.particles.push({x,y,vx:0,vy:0,life:.12,max:.12,color:'#f8e4ac',size:4});}

function drawTree(c,d){
  const x=d.x,y=d.y,b=map.biome;
  c.fillStyle='#29351e33';c.beginPath();c.ellipse(x+10,y+13,27,13,0,0,Math.PI*2);c.fill();
  if(d.type==='rock'){rect(c,x-15,y-9,29,20,b.rock);rect(c,x-10,y-15,19,7,b.rock);rect(c,x-11,y-10,9,4,b.light);rect(c,x+8,y-6,6,17,b.dark);rect(c,x-10,y+9,20,4,b.dark);return;}
  rect(c,x-3,y-5,6,21,'#60563c');rect(c,x-1,y+4,3,10,'#93815a');
  if((state.mission-1)%3===1){rect(c,x-5,y-31,10,38,b.tree);rect(c,x-17,y-16,12,7,b.tree);rect(c,x-18,y-27,6,14,b.treeLight);rect(c,x+5,y-22,12,7,b.tree);rect(c,x+12,y-35,6,18,b.treeLight);rect(c,x-3,y-29,3,28,b.treeLight);return;}
  const v=d.variant*2;rect(c,x-18-v,y-24,36+v*2,22,b.tree);rect(c,x-24,y-20,48,11,b.tree);rect(c,x-13,y-38,26,16,b.tree);rect(c,x-19,y-30,38,12,b.treeLight);rect(c,x-10,y-42,20,14,b.treeLight);rect(c,x-18,y-26,16,9,b.treeLight);rect(c,x-7,y-39,9,5,(state.mission-1)%3===2?'#c7d6c6':'#71864a');rect(c,x+9,y-20,11,10,b.tree);rect(c,x-14,y-8,29,7,b.tree);
  if((state.mission-1)%3===2){rect(c,x-11,y-38,20,4,'#dce4d5');rect(c,x-18,y-27,29,4,'#c9d7c6');}
}
function drawHut(c,h){
  const x=h.x,y=h.y;
  if(h.hp<=0){rect(c,x-35,y-23,70,56,'#4e503ccc');rect(c,x-31,y-19,18,29,'#767158');rect(c,x+15,y-9,16,32,'#66684d');rect(c,x-23,y+13,43,8,'#8f8763');rect(c,x-10,y-11,21,23,'#383e30');return;}
  rect(c,x-37,y-28,79,65,'#34412855');
  // Sandbags, timber walls, corrugated roof and a small enemy pennant.
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
  rect(c,x-10,y-9,20,18,'#374630');rect(c,x-8,y-7,16,13,p.type==='med'?'#d0d5ae':'#c69359');rect(c,x-8,y+5,16,3,p.type==='med'?'#989f7c':'#976a42');
  if(p.type==='med'){rect(c,x-2,y-5,4,10,'#778d55');rect(c,x-5,y-2,10,4,'#778d55');}else{rect(c,x-3,y-4,6,9,'#574d32');rect(c,x-1,y-6,3,3,'#574d32');}
}

function drawMissionMarkers(){
  for(const site of map.sites){
    ctx.strokeStyle=site.done?'#d6ed92':site.contested?'#ed9479':'#efd58a';ctx.lineWidth=2;ctx.setLineDash([7,5]);ctx.beginPath();ctx.arc(site.x,site.y,72,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    rect(ctx,site.x-18,site.y-16,36,32,'#263a30');
    if(site.kind==='radio'){rect(ctx,site.x-10,site.y-10,20,16,'#bac8aa');rect(ctx,site.x+8,site.y-34,2,25,'#e9d997');}else{drawSoldier(ctx,{id:0,angle:0},site.x,site.y);}
    ctx.textAlign='center';ctx.font='bold 10px monospace';ctx.fillStyle='#f2e9be';ctx.fillText(site.done?'✓ ZABEZPIECZONO':site.kind==='radio'?'RADIOSTACJA':'JENIEC',site.x,site.y-46);
    rect(ctx,site.x-30,site.y+28,60,5,'#273725');rect(ctx,site.x-30,site.y+28,60*site.progress/site.required,5,site.contested?'#ed9479':'#d6ed92');ctx.textAlign='left';
  }
  if(map.operation.type!=='clear'){
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
    ctx.strokeStyle='#d5ed91';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(u.x,u.y+5,14,8,0,0,Math.PI*2);ctx.stroke();
  }
  for(const r of state.rings){ctx.globalAlpha=r.life;ctx.strokeStyle='#ecf5b7';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(r.x,r.y,10+(1-r.life)*22,6+(1-r.life)*13,0,0,Math.PI*2);ctx.stroke();rect(ctx,r.x-4,r.y,8,1,'#eff8c6');rect(ctx,r.x,r.y-4,1,8,'#eff8c6');ctx.globalAlpha=1;}
  for(const p of map.pickups)drawPickup(ctx,p);
  const visible=(x,y)=>Math.abs(x-state.camera.x)<viewW/scale/2+100&&Math.abs(y-state.camera.y)<viewH/scale/2+100;
  const drawables=[...map.decorations.filter(d=>visible(d.x,d.y)).map(d=>({y:d.y,draw:()=>drawTree(ctx,d)})),...map.huts.map(h=>({y:h.y+18,draw:()=>drawHut(ctx,h)})),...map.enemies.filter(e=>e.hp>0&&visible(e.x,e.y)).map(e=>({y:e.y,draw:()=>{drawSoldier(ctx,e,e.x,e.y,true);if(e.alert>0){rect(ctx,e.x-7,e.y-26,14,2,'#794833');rect(ctx,e.x-7,e.y-26,14*e.hp/e.maxHp,2,'#e5a080');}}})),...liveSquad().map(u=>({y:u.y,draw:()=>{drawSoldier(ctx,u,u.x,u.y);rect(ctx,u.x-10,u.y-27,20,3,'#33442c');rect(ctx,u.x-10,u.y-27,20*u.hp/100,3,u.hp<35?'#e9a173':'#d6ed92');ctx.font='7px monospace';ctx.textAlign='center';ctx.fillStyle='#f0f2d4';ctx.fillText(String(u.id+1),u.x,u.y-32);ctx.textAlign='left';}}))];
  drawables.sort((a,b)=>a.y-b.y);drawables.forEach(d=>d.draw());
  for(const b of state.bullets){ctx.strokeStyle=b.enemy?'#f0b87c':'#faf2b5';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-b.vx*.017,b.y-b.vy*.017);ctx.stroke();}
  for(const b of state.bombs){const t=b.life/b.duration,x=b.from.x+(b.to.x-b.from.x)*t,y=b.from.y+(b.to.y-b.from.y)*t;ctx.fillStyle='#26332155';ctx.beginPath();ctx.ellipse(x,y,6,3,0,0,Math.PI*2);ctx.fill();rect(ctx,x-3,y-Math.sin(t*Math.PI)*80-4,6,7,'#e9d997');ctx.strokeStyle='#efd49688';ctx.lineWidth=1;ctx.beginPath();ctx.arc(b.to.x,b.to.y,45,0,Math.PI*2);ctx.stroke();}
  for(const p of state.particles){ctx.globalAlpha=Math.min(1,p.life/p.max*2);rect(ctx,p.x,p.y,p.size,p.size,p.color);}ctx.globalAlpha=1;
  // Edge markers keep all remaining objectives discoverable without a tutorial.
  if(state.phase==='playing'){
    const targets=state.evacReady?[{...map.extraction,kind:'evac'}]:map.operation.type==='rescue'||map.operation.type==='capture'?map.sites.filter(s=>!s.done).map(s=>({...s,kind:'site'})):[...map.huts.filter(h=>h.hp>0).map(h=>({...h,kind:'hut'})),...(map.operation.type==='clear'&&state.hutsDone===map.huts.length?map.enemies.filter(e=>e.hp>0).map(e=>({...e,kind:'enemy'})):[])];
    for(const h of targets){const hx=h.x-state.camera.x,hy=h.y-state.camera.y,halfW=viewW/scale/2-46,halfH=viewH/scale/2-70;if(Math.abs(hx)>halfW||Math.abs(hy)>halfH){const ratio=Math.min(halfW/Math.abs(hx||1),halfH/Math.abs(hy||1)),x=state.camera.x+hx*ratio,y=state.camera.y+hy*ratio;ctx.fillStyle='#263121df';ctx.beginPath();ctx.arc(x,y,14,0,Math.PI*2);ctx.fill();ctx.fillStyle=h.kind==='evac'?'#d6ed92':h.kind==='enemy'?'#e39b77':'#e8d28f';ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(hy,hx));ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-4,-5);ctx.lineTo(-4,5);ctx.fill();ctx.restore();}}
  }
  ctx.restore();
  // A subtle vignette frames the playable world without hiding terrain.
  const vignette=ctx.createRadialGradient(viewW/2,viewH/2,viewW*.16,viewW/2,viewH/2,Math.max(viewW,viewH)*.7);vignette.addColorStop(0,'#17241600');vignette.addColorStop(1,'#15201644');ctx.fillStyle=vignette;ctx.fillRect(0,0,viewW,viewH);
  renderMini();
}

function miniProjection(){const scale=Math.min(mini.width/map.width,mini.height/map.height);return {scale,x:(mini.width-map.width*scale)/2,y:(mini.height-map.height*scale)/2};}
function renderMini(){
  const p=miniProjection(),sx=p.scale,sy=p.scale;
  mc.fillStyle='#1c241d';mc.fillRect(0,0,mini.width,mini.height);mc.save();mc.translate(p.x,p.y);
  mc.drawImage(miniTerrain,0,0,map.width*sx,map.height*sy);
  for(const h of map.huts)rect(mc,h.x*sx-3,h.y*sy-3,6,6,h.hp>0?'#e8d591':'#4b573b');
  for(const e of map.enemies)if(e.hp>0)rect(mc,e.x*sx-1,e.y*sy-1,3,3,'#e79b7c');
  for(const site of map.sites){mc.strokeStyle=site.done?'#d6ed92':'#f7dc87';mc.strokeRect(site.x*sx-4,site.y*sy-4,8,8);}
  if(map.operation.type!=='clear'){mc.strokeStyle=state.evacReady?'#d6ed92':'#84976e';mc.beginPath();mc.arc(map.extraction.x*sx,map.extraction.y*sy,5,0,Math.PI*2);mc.stroke();}
  for(const p of map.pickups)if(!p.taken)rect(mc,p.x*sx-1,p.y*sy-1,3,3,p.type==='med'?'#e0e5bb':'#d6a764');
  for(const u of liveSquad())rect(mc,u.x*sx-2,u.y*sy-2,4,4,'#e2f5a3');
  mc.strokeStyle='#edf1d5aa';mc.lineWidth=1;mc.strokeRect((state.camera.x-viewW/scale/2)*sx,(state.camera.y-viewH/scale/2)*sy,viewW/scale*sx,viewH/scale*sy);mc.restore();
}

function showOverlay(kind){
  $('overlay').classList.remove('hidden');
  const data={
    briefing:{eyebrow:`DEPESZA Z DOWÓDZTWA / ${format(state.mission,3)}`,title:map.operation.name,description:`${map.operation.brief} ${map.layout.hint}`,button:'ROZPOCZNIJ OPERACJĘ',secondary:'⟳  Wylosuj inny teren'},
    paused:{eyebrow:'ŁĄCZNOŚĆ WSTRZYMANA',title:'Chwila<br>na oddech.',description:'Oddział czeka na twój sygnał. Wybieraj żołnierzy klawiszami 1–4 lub cały oddział klawiszem Q. Żołnierze automatycznie strzelają do wrogów w zasięgu.',button:'WRÓĆ NA POLE BITWY',secondary:'↻  Rozpocznij misję od nowa'},
    won:{eyebrow:`RAPORT Z MISJI / ${format(state.mission,3)}`,title:'Sektor<br>zabezpieczony.',description:`${'★'.repeat(state.stars)}${'☆'.repeat(3-state.stars)} · ${liveSquad().length} z 4 żołnierzy wraca do bazy. Premia: +${state.bonus}. Gwiazdki: wykonanie misji, pełny oddział, czas poniżej ${Math.floor(map.parTime/60)}:${format(map.parTime%60)}. Oddział i zapasy zostaną uzupełnione.`,button:'NASTĘPNA MISJA',secondary:'⟳  Rozegraj ten teren ponownie'},
    lost:{eyebrow:'RAPORT Z MISJI / UTRACONO KONTAKT',title:'To jeszcze<br>nie koniec.',description:'Oddział poległ. Wykorzystuj drzewa i skały jako osłony, trzymaj żołnierzy razem i zbieraj apteczki. Spróbuj ponownie z nowym oddziałem.',button:'PONÓW OPERACJĘ',secondary:'⟳  Wylosuj inny teren'}
  }[kind];
  $('overlay-note').textContent=`${map.layout.name} · ${map.cols} × ${map.rows} · Zagrożenie ${map.difficulty.level}/13. Premia czasu do ${Math.floor(map.parTime/60)}:${format(map.parTime%60)} (bez limitu misji). ${state.mission>=6?'Ciężcy (Ⅱ) prowadzą szybki ogień. ':''}${state.mission>=3?'Strzelcy (⌖) celują przez chwilę — zejdź z linii. ':state.mission>=2?'Zwiadowcy (») szybko obchodzą flankę. ':''}LPM: ruch · PPM: ogień · G: granat.`;
  $('overlay-eyebrow').textContent=data.eyebrow;$('overlay-title').innerHTML=data.title;$('overlay-description').textContent=data.description;$('deploy').innerHTML=`${data.button} <span>↗</span>`;$('reroll').textContent=data.secondary;
  $('briefing-details').innerHTML=(kind==='won'||kind==='lost')?`<div><strong>${format(state.kills)}</strong><span>WYELIMINOWANYCH</span></div><div><strong>${$('timer').textContent}</strong><span>CZAS OPERACJI</span></div><div><strong>${state.score}</strong><span>PUNKTÓW</span></div>`:`<div><strong>04</strong><span>ŻOŁNIERZY</span></div><div><strong>${format(map.enemies.length)}</strong><span>PRZECIWNIKÓW</span></div><div><strong>${format(map.sites.length||map.huts.length)}</strong><span>${map.operation.type==='rescue'?'JENIEC':map.operation.type==='capture'?'RADIOSTACJE':'POSTERUNKI'}</span></div>`;
  updateUI();
}
function startMission(){saveActive=true;state.phase='playing';state.firing=false;state.keys.clear();$('overlay').classList.add('hidden');updateUI();canvas.focus();beep('start');toast(state.evacReady?'Zbierz ocalałych w strefie ewakuacji.':map.operation.brief);saveProgress();}
function pause(){if(state.phase==='playing'){state.phase='paused';state.firing=false;state.keys.clear();showOverlay('paused');saveProgress();}else if(state.phase==='paused')startMission();}
function endMission(won){state.phase=won?'won':'lost';state.firing=false;state.keys.clear();if(won){state.stars=1+Number(liveSquad().length===4)+Number(state.elapsed<=map.parTime);state.bonus=liveSquad().length*250+(state.elapsed<=map.parTime?500:0);state.score+=state.bonus;beep('win');}else beep('loss');updateUI();showOverlay(state.phase);saveProgress();}

function beep(type){
  if(!state.sound)return;
  try{
    audioCtx??=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();
    const now=audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);
    const f={shot:110,explosion:75,move:550,throw:260,pickup:850,start:440,win:660,loss:180}[type]||400,dur=type==='explosion'?.5:type==='shot'?.06:.16;
    o.type=type==='shot'||type==='explosion'?'sawtooth':'square';o.frequency.setValueAtTime(f,now);o.frequency.exponentialRampToValueAtTime(type==='explosion'?20:type==='win'?1100:f*.6,now+dur);g.gain.setValueAtTime(type==='shot'?.018:.045,now);g.gain.exponentialRampToValueAtTime(.0001,now+dur);o.start(now);o.stop(now+dur);
  }catch{state.sound=false;$('sound').textContent='DŹWIĘK: OFF';}
}

canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();state.pointer.x=e.clientX-r.left;state.pointer.y=e.clientY-r.top;const p=screenToWorld(state.pointer.x,state.pointer.y);state.pointer.worldX=p.x;state.pointer.worldY=p.y;$('coordinates').textContent=`SEKTOR ${format(Math.floor(p.x/TILE))} / ${format(Math.floor(p.y/TILE))}`;});
canvas.addEventListener('pointerdown',e=>{
  e.preventDefault();if(state.phase!=='playing')return;canvas.focus();const r=canvas.getBoundingClientRect(),p=screenToWorld(e.clientX-r.left,e.clientY-r.top);Object.assign(state.pointer,{x:e.clientX-r.left,y:e.clientY-r.top,worldX:p.x,worldY:p.y});
  if(e.button===2||(e.pointerType==='touch'&&state.touchMode==='fire')){state.firing=true;canvas.setPointerCapture(e.pointerId);}
  else if(e.button===0){const clicked=liveSquad().find(u=>distance(u,p)<15);if(clicked&&e.pointerType!=='touch')select(clicked.id);else issueMove(p);}
});
window.addEventListener('pointerup',()=>state.firing=false);canvas.addEventListener('pointercancel',()=>state.firing=false);
mini.addEventListener('pointerdown',e=>{if(state.phase!=='playing')return;const r=mini.getBoundingClientRect(),p=miniProjection(),x=((e.clientX-r.left)/r.width*mini.width-p.x)/p.scale,y=((e.clientY-r.top)/r.height*mini.height-p.y)/p.scale;if(x<0||y<0||x>map.width||y>map.height)return;state.camera.x=x;state.camera.y=y;state.follow=false;clampCamera();});
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement)return;
  const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
  if(e.repeat)return;
  if(key===' '||key==='escape'||key==='p'){pause();return;}
  if(state.phase!=='playing')return;state.keys.add(key);
  if(key==='g')throwGrenade();if(key==='q')regroup();if(key==='f'){state.follow=true;toast('Kamera śledzi oddział');}
  if(['1','2','3','4'].includes(key))select(Number(key)-1);
});
window.addEventListener('keyup',e=>state.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{state.firing=false;state.keys.clear();if(state.phase==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(state.phase==='playing')pause();else saveProgress();}});
window.addEventListener('pagehide',()=>saveProgress());
$('save').onclick=()=>saveProgress(true);
$('new-campaign').onclick=()=>{
  if(!window.confirm('Rozpocząć nową kampanię? Bieżący zapis zostanie zastąpiony.'))return;
  state.mission=1;state.score=0;state.phase='briefing';state.keys.clear();
  initMission();showOverlay('briefing');saveActive=true;saveProgress();
};
$('pause').onclick=pause;$('regroup').onclick=regroup;
$('sound').onclick=()=>{state.sound=!state.sound;$('sound').textContent=`DŹWIĘK: ${state.sound?'ON':'OFF'}`;$('sound').setAttribute('aria-label',state.sound?'Wyłącz dźwięk':'Włącz dźwięk');beep('move');};
$('deploy').onclick=()=>{
  if(state.phase==='won'){state.mission++;state.phase='briefing';initMission();showOverlay('briefing');saveProgress();return;}
  else if(state.phase==='lost'){state.score=state.missionStartScore;initMission(map.seed,true);}
  startMission();
};
$('reroll').onclick=()=>{
  if(state.phase==='paused'||state.phase==='won'){state.score=state.missionStartScore;initMission(map.seed,true);startMission();}
  else{if(state.phase==='lost')state.score=state.missionStartScore;initMission();state.phase='briefing';showOverlay('briefing');saveProgress();}
};
$('copy-seed').onclick=async()=>{const url=new URL(location.href);url.searchParams.set('seed',map.seed);url.searchParams.set('mission',state.mission);try{await navigator.clipboard.writeText(url.href);toast('Skopiowano link z ziarnem mapy');}catch{toast(`Ziarno mapy: ${map.seed}, misja: ${state.mission}`);}};
$('touch-mode').onclick=()=>{state.touchMode=state.touchMode==='move'?'fire':'move';$('touch-mode').textContent=`TRYB: ${state.touchMode==='move'?'RUCH':'OGIEŃ'}`;};
$('touch-grenade').onclick=throwGrenade;
$('touch-follow').onclick=()=>{state.follow=true;regroup();};
new ResizeObserver(resize).observe($('battlefield'));
// Explicit mission links open their own briefing; the old save survives until play or manual save.
const hasMissionLink=(urlParams.has('seed')&&Number.isInteger(initialSeed)&&initialSeed>=0)||(Number.isInteger(initialMission)&&initialMission>=1&&initialMission<=999);
if(!loadProgress()){
  initMission(Number.isInteger(initialSeed)&&urlParams.has('seed')&&initialSeed>=0?initialSeed:freshSeed());showOverlay('briefing');
  if(hasMissionLink)$('save-status').textContent='Mapa z linku. Rozpoczęcie operacji lub ręczny zapis zastąpi poprzedni zapis.';
}
function frame(time){const dt=Math.min((time-lastTime)/1000,.04);lastTime=time;visualTime=time/1000;tick(dt);render();requestAnimationFrame(frame);}
requestAnimationFrame(frame);

// Read-only snapshot used for smoke tests and useful when reporting a map bug.
window.tinyFront={snapshot:()=>({phase:state.phase,seed:map.seed,mission:state.mission,score:state.score,grenades:state.grenades,elapsed:state.elapsed,camera:{...state.camera},squad:squad.map(u=>({id:u.id,x:u.x,y:u.y,hp:u.hp,pathLength:u.path.length})),enemies:map.enemies.filter(e=>e.hp>0).length,huts:map.huts.filter(h=>h.hp>0).length,selected:[...state.selected],width:map.width,height:map.height,layout:map.layout.id,operation:map.operation.type,difficulty:map.difficulty.level,sites:map.sites.map(s=>({x:s.x,y:s.y,done:s.done,progress:s.progress})),evacReady:state.evacReady})};
