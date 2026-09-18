import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as engine from '../engine.js';
import * as saves from '../save.js';

// Run the real game loop with a minimal rendering surface. No duplicate simulation.
function game(mission=1,options={}){
  const storage=options.storage??new Map(),events={};
  const localStorage=options.localStorage??{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  const noop=()=>{},drawing=new Proxy({createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
  const nodes=new Map();
  function classList(){const set=new Set();return {add:(...n)=>n.forEach(c=>set.add(c)),remove:(...n)=>n.forEach(c=>set.delete(c)),toggle:(c,force)=>{const on=force===undefined?!set.has(c):!!force;if(on)set.add(c);else set.delete(c);return on;},contains:c=>set.has(c)};}
  function node(id){if(!nodes.has(id))nodes.set(id,{id,width:192,height:144,style:{},classList:classList(),getContext:()=>drawing,getBoundingClientRect:()=>({width:1100,height:700,left:0,top:0}),querySelector:()=>node(`${id}-child`),setAttribute:noop,addEventListener:noop,focus:noop});return nodes.get(id);}
  const context=vm.createContext({...engine,...saves,localStorage,testEvents:events,console,Math,Number,String,Set,URL,URLSearchParams,Uint32Array,devicePixelRatio:1,crypto:{getRandomValues:a=>(a[0]=12345,a)},location:{search:options.search??(mission===1?'':`?mission=${mission}`),href:'http://localhost:5173/'},navigator:{},document:{getElementById:node,querySelector:node,createElement:()=>node(Math.random()),addEventListener:(name,fn)=>events[name]=fn},window:{history:{replaceState:(state,title,url)=>events.savedURL=url},addEventListener:(name,fn)=>events[name]=fn,confirm:options.confirm??(()=>true)},ResizeObserver:class{observe(){}},requestAnimationFrame:noop});
  const source=readFileSync(new URL('../game.js',import.meta.url),'utf8').replace(/^import .*?;\n/gm,'');
  vm.runInContext(source+'\nthis.testGame={state,events:testEvents,document,saveProgress,endMission,get map(){return map},get squad(){return squad},tick,initMission,startMission,pause,issueMove,throwGrenade,throwRocket,throwHeavy,splitSquad,mergeSquad,cycleGroup,toggleVehicle,toggleMini,damageEnemy,damageSoldier,damageCivilian,explode,select,promoteLeader,regroup,enterBootCamp,leaveBootCamp,render,renderMini,miniProjection,clampCamera,shoot,buttons: $};',context);
  return context.testGame;
}

test('squad moves, selection works, pause freezes the simulation',()=>{
  const g=game();g.startMission();const before=g.squad.map(u=>({x:u.x,y:u.y}));
  g.issueMove({x:g.map.spawn.x+96,y:g.map.spawn.y+96});for(let i=0;i<100;i++)g.tick(.02);
  assert.ok(g.squad[0].path.length===0||Math.hypot(g.squad[0].x-before[0].x,g.squad[0].y-before[0].y)>50);
  assert.ok(g.squad.filter((u,i)=>Math.hypot(u.x-before[i].x,u.y-before[i].y)>40).length>=3);
  g.select(2);assert.deepEqual([...g.state.selected],[2]);g.regroup();assert.equal(g.state.selected.size,4);
  g.pause();const elapsed=g.state.elapsed;g.tick(10);assert.equal(g.state.elapsed,elapsed);assert.equal(g.state.phase,'paused');g.pause();assert.equal(g.state.phase,'playing');
});
test('grenades destroy objectives, victory advances to a fresh biome',()=>{
  const g=game();g.startMission();
  for(const e of g.map.enemies)g.damageEnemy(e,100,0);
  for(const h of g.map.huts){
    const u=g.squad[0];u.x=h.x-150;u.y=h.y;g.state.selected=new Set([0]);g.state.pointer.worldX=h.x;g.state.pointer.worldY=h.y;
    const grenades=g.state.grenades;g.throwGrenade();assert.equal(g.state.grenades,grenades-1);assert.equal(g.state.bombs.length,1);
    for(let i=0;i<45;i++)g.tick(.02);
    assert.equal(h.hp,0);
  }
  assert.equal(g.state.phase,'won');assert.equal(g.state.hutsDone,2);assert.ok(g.state.score>=2400);
  g.buttons('deploy').onclick();assert.equal(g.state.phase,'map');g.buttons('deploy').onclick();assert.equal(g.state.phase,'playing');assert.equal(g.state.mission,2);assert.equal(g.map.biome.label,'PUSTYNNE POGRANICZE · POŁUDNIE');assert.equal(g.squad.length,4);assert.equal(g.state.kills,0);
});
test('squad loss can be retried without changing terrain or retaining earned points',()=>{
  const g=game();g.startMission();const seed=g.map.seed;g.damageEnemy(g.map.enemies[0],100,0);for(const u of g.squad)g.damageSoldier(u,100);g.tick(.02);
  assert.equal(g.state.phase,'lost');g.buttons('deploy').onclick();assert.equal(g.map.seed,seed);assert.equal(g.state.phase,'playing');assert.equal(g.state.score,0);assert.equal(g.squad.every(u=>u.hp===100),true);
});
test('grenade range and emergency supply prevent unwinnable early missions',()=>{
  const g=game();g.startMission();g.state.pointer.worldX=g.map.spawn.x+1000;g.state.pointer.worldY=g.map.spawn.y;g.throwGrenade();assert.equal(g.state.grenades,2);
  g.state.grenades=0;g.map.pickups.forEach(p=>p.taken=true);g.tick(.02);const supply=g.map.pickups.find(p=>!p.taken&&p.type==='grenade');assert.ok(supply);assert.equal(supply.x,g.map.spawn.x);g.tick(.02);assert.equal(g.state.grenades,3);
});
test('later missions do not drop free grenades at the landing zone',()=>{
  const g=game(3);g.startMission();
  g.state.grenades=0;g.map.pickups.forEach(p=>p.taken=true);g.tick(.02);
  assert.equal(g.map.pickups.some(p=>!p.taken&&p.type==='grenade'),false);
});

test('automatic fire hits enemies and medical supplies heal the squad',()=>{
  const g=game();g.startMission();
  // Isolate a skirmish on open ground using the actual bullet and AI update loop.
  g.map.tiles.fill(0);
  g.map.enemies.forEach(e=>{e.x=2100;e.y=200;e.home={x:e.x,y:e.y};e.patrol=100;});
  const enemy=g.map.enemies[0];enemy.x=g.map.spawn.x+180;enemy.y=g.map.spawn.y;enemy.home={x:enemy.x,y:enemy.y};
  for(let i=0;i<150;i++)g.tick(.02);
  assert.ok(enemy.hp<=0);assert.equal(g.state.kills,1);assert.equal(g.state.score,100);
  g.squad.forEach(u=>u.hp=50);g.map.pickups.push({x:g.squad[0].x,y:g.squad[0].y,type:'med',taken:false});g.tick(.02);
  assert.ok(g.squad.every(u=>u.hp===90));
});


test('rescue completes through the real loop and requires the entire surviving squad at extraction',()=>{
  const g=game(3);g.startMission();g.map.enemies.forEach(e=>e.hp=0);
  const site=g.map.sites[0];g.squad.forEach(u=>{u.x=site.x;u.y=site.y;});
  for(let i=0;i<151;i++)g.tick(.02);
  assert.equal(site.done,true);assert.equal(g.state.evacReady,true);assert.equal(g.state.phase,'playing');
  g.squad.slice(1).forEach(u=>{u.x=g.map.spawn.x;u.y=g.map.spawn.y;});g.tick(.02);assert.equal(g.state.phase,'playing');
  Object.assign(g.squad[0],g.map.spawn);g.tick(.02);assert.equal(g.state.phase,'won');assert.equal(g.state.stars,3);
});

test('retry resets captured sites, extraction and mission rewards',()=>{
  const g=game(4);g.startMission();g.map.sites[0].done=true;g.map.sites[0].progress=8;
  g.state.evacReady=true;g.pause();g.buttons('reroll').onclick();
  assert.equal(g.state.evacReady,false);assert.equal(g.map.sites.every(s=>!s.done&&s.progress===0),true);assert.equal(g.state.stars,0);
});

test('minimap preserves world proportions and all landscape render paths execute',()=>{
  for(let mission=1;mission<=6;mission++){
    const g=game(mission),p=g.miniProjection();g.render();
    assert.ok(p.x>=0&&p.y>=0);assert.ok(g.map.width*p.scale<=192);assert.ok(g.map.height*p.scale<=144);
    assert.ok(Math.abs(g.map.width*p.scale+2*p.x-192)<.001);
    assert.ok(Math.abs(g.map.height*p.scale+2*p.y-144)<.001);
  }
});

test('marksmen telegraph shots and cover breaks their aim',()=>{
  const g=game(3);g.startMission();g.map.tiles.fill(0);g.map.enemies.forEach(e=>e.hp=0);
  const e=g.map.enemies.find(e=>e.role==='marksman');
  Object.assign(e,{hp:55,x:g.map.width/2,y:g.map.height/2,cooldown:0,aimTime:0});
  g.squad.forEach(u=>{u.x=e.x+350;u.y=e.y;});
  g.tick(.4);assert.ok(e.aimTime>0);assert.equal(g.state.bullets.some(b=>b.enemy),false);
  g.pause();const aimed=e.aimTime;g.tick(1);assert.equal(e.aimTime,aimed);g.pause();
  const col=Math.floor((e.x+150)/engine.TILE);for(let y=0;y<g.map.rows;y++)g.map.tiles[y*g.map.cols+col]=2;
  g.tick(.02);assert.equal(e.aimTime,0);
  g.map.tiles.fill(0);g.tick(.5);g.tick(.5);assert.ok(e.cooldown>0,'marksman fires after an uninterrupted windup');
});


test('sabotage can finish after the bonus time with enemies alive',()=>{
  const g=game(2);g.startMission();g.state.elapsed=g.map.parTime+1;g.tick(.02);
  assert.equal(g.state.phase,'playing','the bonus time is not a failure deadline');
  g.map.huts.forEach(h=>g.explode(h));g.tick(.02);
  assert.equal(g.state.phase,'won');assert.ok(g.map.enemies.some(e=>e.hp>0));
  assert.equal(g.state.stars,2);assert.equal(g.state.bonus,1000);
});

const snapshot=g=>JSON.parse(saves.encodeSave(g.state,g.map,g.squad));

test('manual save restores the complete battle on pause, including projectiles and capture progress',()=>{
  const storage=new Map(),g=game(4,{storage});g.startMission();
  g.state.missionStartScore=800;g.state.score=800;
  g.damageEnemy(g.map.enemies[0],100,2);g.damageSoldier(g.squad[1],100);
  g.squad[0].hp=63;g.squad[0].path=[{x:g.map.spawn.x+24,y:g.map.spawn.y}];
  g.map.sites[0].progress=4.25;g.map.sites[0].contested=true;
  g.map.pickups[0].taken=true;g.map.pickups.push({...g.map.spawn,type:'grenade',taken:false});
  g.explode(g.map.huts[0]);g.state.elapsed=42.5;
  g.state.selected=new Set([2]);g.state.follow=false;g.state.firing=true;g.state.keys.add('w');
  g.shoot(g.squad[2],g.map.enemies[1]);g.shoot(g.map.enemies[1],g.squad[2],true);
  g.state.bombs.push({from:{x:g.squad[0].x,y:g.squad[0].y},to:{...g.map.huts[1]},life:.3,duration:.8});
  g.buttons('save').onclick();const expected=snapshot(g);expected.state.phase='paused';
  const loaded=game(1,{storage});assert.deepEqual(snapshot(loaded),expected);
  assert.equal(loaded.state.firing,false);assert.equal(loaded.state.keys.size,0);
  const elapsed=loaded.state.elapsed;loaded.tick(10);assert.equal(loaded.state.elapsed,elapsed);
  assert.match(loaded.buttons('deploy').innerHTML,/KONTYNUUJ/);
  loaded.render();loaded.buttons('deploy').onclick();loaded.tick(.02);
  assert.equal(loaded.state.phase,'playing');assert.ok(loaded.state.elapsed>elapsed);
});

test('autosave runs every five seconds and saves when pausing, hiding or leaving the page',()=>{
  const storage=new Map(),g=game(1,{storage});g.startMission();
  const saved=()=>JSON.parse(storage.get(saves.SAVE_KEY));
  assert.equal(saved().state.elapsed,0);
  g.tick(2);assert.equal(saved().state.elapsed,0);g.tick(3.01);assert.equal(saved().state.elapsed,5.01);
  g.tick(.1);g.pause();assert.equal(saved().state.phase,'paused');assert.equal(saved().state.elapsed,g.state.elapsed);
  g.startMission();g.tick(.1);g.events.pagehide();assert.equal(saved().state.elapsed,g.state.elapsed);
  g.document.hidden=true;g.events.visibilitychange();assert.equal(saved().state.phase,'paused');
});

test('victory reload preserves the reward once and saves the next mission briefing',()=>{
  const storage=new Map(),g=game(1,{storage});g.startMission();
  g.map.enemies.forEach(e=>g.damageEnemy(e,100,0));g.map.huts.forEach(h=>g.explode(h));g.tick(.02);
  const score=g.state.score,loaded=game(1,{storage});
  assert.equal(loaded.state.phase,'won');assert.equal(loaded.state.score,score);loaded.render();
  loaded.tick(1);assert.equal(loaded.state.score,score);loaded.buttons('deploy').onclick();
  const next=game(1,{storage});assert.equal(next.state.phase,'map');assert.equal(next.state.mission,2);
  assert.equal(next.state.score,score);assert.equal(next.state.missionStartScore,score);
  next.buttons('deploy').onclick();next.tick(.02);assert.equal(next.state.score,score);
});

test('defeat reload can retry the same terrain and roll back only the current mission score',()=>{
  const storage=new Map(),g=game(2,{storage});g.state.score=1200;g.initMission(54321);g.startMission();
  g.damageEnemy(g.map.enemies[0],100,0);g.squad.forEach(u=>g.damageSoldier(u,100));g.tick(.02);
  const loaded=game(1,{storage});assert.equal(loaded.state.phase,'lost');assert.equal(loaded.state.score,1300);
  loaded.buttons('deploy').onclick();assert.equal(loaded.state.score,1200);assert.equal(loaded.map.seed,54321);
  const retry=game(1,{storage});assert.equal(retry.state.phase,'paused');assert.equal(retry.state.score,1200);
  assert.ok(retry.squad.every(u=>u.hp===100));assert.equal(retry.state.kills,0);
});

test('mission links keep the existing save until explicitly starting or saving',()=>{
  const storage=new Map(),g=game(1,{storage});g.startMission();g.tick(1);g.pause();
  const before=storage.get(saves.SAVE_KEY),linked=game(1,{storage,search:'?seed=0&mission=3'});
  assert.equal(linked.state.phase,'briefing');assert.equal(linked.state.mission,3);assert.equal(linked.map.seed,0);
  linked.events.pagehide();linked.buttons('reroll').onclick();assert.equal(storage.get(saves.SAVE_KEY),before);
  assert.equal(game(1,{storage}).state.mission,1);
  linked.buttons('deploy').onclick();assert.equal(game(1,{storage}).state.mission,3);
  assert.equal(new URL(linked.events.savedURL).search,'');
  const reloaded=game(1,{storage,search:`?seed=${linked.map.seed}&mission=3`});
  assert.equal(reloaded.state.phase,'paused');assert.equal(reloaded.map.seed,linked.map.seed);
});

test('corrupt, partial and unsupported saves fall back without overwriting stored data',()=>{
  const storage=new Map(),g=game(1,{storage});g.startMission();const valid=snapshot(g);
  const mutations=[data=>data.version++,data=>delete data.state.camera,data=>data.squad[0].path=null,
    data=>data.enemies.pop(),data=>data.state.score=-1,data=>data.state.kills++,
    data=>data.state.bombs=[{from:{x:0,y:0},to:{x:1,y:1},life:0,duration:0}],
    data=>data.sites.push({progress:0,done:false,contested:false})];
  const invalid=['{','null','{}',...mutations.map(mutate=>{const data=structuredClone(valid);mutate(data);return JSON.stringify(data);})];
  for(const raw of invalid){
    storage.set(saves.SAVE_KEY,raw);const loaded=game(1,{storage});assert.equal(loaded.state.phase,'map');
    assert.match(loaded.buttons('save-status').textContent,/uszkodzony/);loaded.render();loaded.events.pagehide();
    assert.equal(storage.get(saves.SAVE_KEY),raw);
  }
});

test('unavailable storage never stops play and a failed write can be retried',()=>{
  let blocked=true,raw=null;
  const localStorage={getItem(){if(blocked)throw new Error('SecurityError');return raw;},setItem(key,value){if(blocked)throw new Error('QuotaExceededError');raw=value;}};
  const g=game(1,{localStorage});g.startMission();g.tick(5.01);g.buttons('save').onclick();
  assert.equal(g.state.phase,'playing');assert.match(g.buttons('toast').textContent,/nie powiódł/);
  assert.equal(g.buttons('save').textContent,'PONÓW ZAPIS');
  blocked=false;g.buttons('save').onclick();assert.match(g.buttons('toast').textContent,/Zapisano/);
  assert.equal(game(1,{localStorage}).state.phase,'paused');
});

test('new campaign can be cancelled, then replaces the save with mission one',()=>{
  const storage=new Map(),g=game(3,{storage});g.startMission();g.pause();const before=storage.get(saves.SAVE_KEY);
  const cancelled=game(1,{storage,confirm:()=>false});cancelled.buttons('new-campaign').onclick();
  assert.equal(storage.get(saves.SAVE_KEY),before);
  g.buttons('new-campaign').onclick();const loaded=game(1,{storage});
  assert.equal(loaded.state.mission,1);assert.equal(loaded.state.score,0);assert.equal(loaded.state.phase,'map');
});

test('split and merge create persistent subgroups',()=>{
  const g=game();g.startMission();
  g.splitSquad();
  assert.equal(g.state.selected.size,2);
  assert.ok(g.squad.some(u=>u.group!==g.squad[0].group));
  g.mergeSquad();
  assert.equal(new Set(g.squad.map(u=>u.group)).size,1);
  assert.equal(g.state.selected.size,4);
});

test('grenades inflict friendly fire but not at grenade-test range',()=>{
  const g=game();g.startMission();
  const hp=g.squad[0].hp;
  g.explode({x:g.squad[0].x+200,y:g.squad[0].y});
  assert.equal(g.squad[0].hp,hp);
  g.explode({x:g.squad[0].x,y:g.squad[0].y});
  assert.ok(g.squad[0].hp<hp);
});

test('posterunki spawn reinforcements after a delay and stop when destroyed',()=>{
  const g=game();g.startMission();
  const before=g.map.enemies.length;
  g.map.huts[0].spawnTimer=0;g.tick(.02);
  assert.ok(g.map.enemies.length>before);
  g.map.huts.forEach(h=>h.hp=0);g.state.hutsDone=g.map.huts.length;
  const mid=g.map.enemies.length;
  g.map.huts.forEach(h=>h.spawnTimer=0);g.tick(.02);
  assert.equal(g.map.enemies.length,mid);
});

test('permadeath replaces fallen soldiers from the recruit pool',()=>{
  const g=game();g.startMission();
  const first=g.squad.map(u=>u.name);
  g.squad.forEach(u=>g.damageSoldier(u,100));g.tick(.02);
  assert.equal(g.state.phase,'lost');
  assert.equal(g.state.campaign.graves.length,4);
  g.buttons('deploy').onclick();
  assert.equal(g.squad.length,4);
  assert.ok(g.squad.every(u=>u.hp===100));
  assert.ok(g.squad.every(u=>!first.includes(u.name)));
  assert.equal(engine.recruitsLeft(g.state.campaign),356);
});

test('survivors are promoted and keep their names into the next mission',()=>{
  const g=game();g.startMission();
  g.map.enemies.forEach(e=>g.damageEnemy(e,100,0));g.map.huts.forEach(h=>g.explode(h));g.tick(.02);
  const names=g.squad.filter(u=>u.hp>0).map(u=>u.name);
  assert.equal(g.state.phase,'won');
  g.buttons('deploy').onclick();
  assert.ok(g.squad.every(u=>names.includes(u.name)));
  assert.ok(g.squad.every(u=>u.rank===1));
});

test('rockets consume a separate ammo pool and huts still fall',()=>{
  const g=game(2);g.startMission();
  const rockets=g.state.rockets,hut=g.map.huts[0];
  g.squad[0].x=hut.x-120;g.squad[0].y=hut.y;g.state.selected=new Set([0]);
  g.state.pointer.worldX=hut.x;g.state.pointer.worldY=hut.y;
  g.throwRocket();assert.equal(g.state.rockets,rockets-1);
  for(let i=0;i<40;i++)g.tick(.02);
  assert.equal(hut.hp,0);
});

test('mines are visible immediately and still detonate on contact',()=>{
  const g=game(2);g.startMission();
  const mine=g.map.mines[0];
  assert.ok(mine);assert.equal(mine.reveal,1);assert.equal(mine.exploded,false);
  g.tick(1);assert.equal(mine.reveal,1);assert.equal(mine.exploded,false);
  g.render();
  Object.assign(g.squad[0],{x:mine.x,y:mine.y});
  g.tick(.02);
  assert.equal(mine.exploded,true);assert.equal(mine.armed,false);
});

test('campaign ends when the recruit pool is empty',()=>{
  const g=game();g.startMission();
  g.state.campaign.roster.forEach(r=>r.dead=true);
  g.squad.forEach(u=>{g.state.campaign.roster[u.recruitId].dead=false;g.damageSoldier(u,100);});
  g.tick(.02);
  assert.equal(g.state.phase,'over');
});

test('squad snakes behind the leader instead of spreading into a blob',()=>{
  const g=game();g.startMission();
  const start=g.squad.map(u=>({x:u.x,y:u.y}));
  g.issueMove({x:g.map.spawn.x+220,y:g.map.spawn.y});
  assert.ok(g.squad[0].path.length);
  assert.ok(g.squad.slice(1).every(u=>u.followLeaderId===0||u.path.length===0));
  for(let i=0;i<80;i++)g.tick(.02);
  const moved=g.squad.map((u,i)=>Math.hypot(u.x-start[i].x,u.y-start[i].y));
  assert.ok(moved[0]>80);
  assert.ok(moved.slice(1).every(d=>d>40));
  const spread=Math.max(...g.squad.map(u=>u.x))-Math.min(...g.squad.map(u=>u.x));
  assert.ok(spread<140,'followers stay in a file, not a wide blob');
});

test('killing a civilian costs score',()=>{
  const g=game();g.startMission();
  g.map.civilians=[{x:g.squad[0].x+8,y:g.squad[0].y,hp:20,maxHp:20,kind:'villager',path:[],flee:0,angle:0,id:0}];
  const score=g.state.score;
  g.explode(g.map.civilians[0]);
  assert.equal(g.map.civilians[0].hp,0);
  assert.equal(g.state.score,Math.max(0,score-200));
});

test('three-star victory awards a star medal',()=>{
  const g=game();g.startMission();
  g.map.enemies.forEach(e=>g.damageEnemy(e,100,0));g.map.huts.forEach(h=>g.explode(h));g.tick(.02);
  assert.equal(g.state.phase,'won');assert.equal(g.state.stars,3);
  assert.ok(g.state.campaign.roster[0].medals.includes('star'));
});

test('hub cemetery toggle replaces the world map with named graves',()=>{
  const g=game();
  assert.equal(g.state.phase,'map');assert.equal(g.state.graveOpen,false);
  g.buttons('toggle-graves').onclick();
  assert.equal(g.state.graveOpen,true);
  assert.match(g.buttons('toggle-graves').textContent,/UKRYJ CMENTARZ/);
  g.buttons('toggle-graves').onclick();
  assert.equal(g.state.graveOpen,false);
  assert.equal(g.buttons('toggle-graves').textContent,'CMENTARZ');
});

test('tactical map can be hidden and later restored',()=>{
  const storage=new Map(),g=game(1,{storage});
  assert.equal(g.state.miniHidden,false);
  g.buttons('hide-mini').onclick();
  assert.equal(g.state.miniHidden,true);
  assert.equal(g.buttons('minimap-wrap').classList.contains('collapsed'),true);
  assert.equal(storage.get('tiny-front-minimap'),'hidden');
  g.startMission();
  assert.equal(g.state.miniHidden,true,'hiding survives mission start');
  g.renderMini();
  g.buttons('show-mini').onclick();
  assert.equal(g.state.miniHidden,false);
  assert.equal(g.buttons('minimap-wrap').classList.contains('collapsed'),false);
  g.toggleMini();
  assert.equal(g.state.miniHidden,true);
  const kept=game(1,{storage});
  assert.equal(kept.state.miniHidden,true);
  assert.equal(kept.state.miniHidden,true);
  kept.buttons('touch-mini').onclick();
  assert.equal(kept.state.miniHidden,false);
});

test('autosave after bunker waves reloads the paused battle',()=>{
  const storage=new Map(),g=game(1,{storage});g.startMission();
  g.map.huts.forEach(h=>h.spawnTimer=0);
  for(let i=0;i<80;i++)g.tick(.05);
  assert.ok(g.map.enemies.length>8);
  g.events.pagehide();
  const loaded=game(1,{storage});
  assert.equal(loaded.state.phase,'paused');
  assert.match(loaded.buttons('save-status').textContent,/Wczytano/);
});

test('boot camp deaths are permanent and do not advance the mission',()=>{
  const g=game();
  g.enterBootCamp();
  assert.equal(g.state.bootcamp,true);assert.equal(g.state.phase,'playing');
  assert.equal(g.map.bootcamp,true);assert.equal(g.state.mission,1);
  const name=g.squad[0].name;
  g.damageSoldier(g.squad[0],100);
  g.leaveBootCamp();
  assert.equal(g.state.bootcamp,false);assert.equal(g.state.phase,'map');assert.equal(g.state.mission,1);
  assert.ok(g.state.campaign.graves.some(gr=>gr.name===name));
  assert.ok(g.squad.every(u=>u.name!==name));
});
