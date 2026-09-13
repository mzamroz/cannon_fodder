import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as engine from '../engine.js';

// Run the real game loop with a minimal rendering surface. No duplicate simulation.
function game(){
  const noop=()=>{},drawing=new Proxy({createRadialGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
  const nodes=new Map();
  function node(id){if(!nodes.has(id))nodes.set(id,{id,width:192,height:144,style:{},classList:{add:noop,remove:noop,toggle:noop},getContext:()=>drawing,getBoundingClientRect:()=>({width:1100,height:700,left:0,top:0}),querySelector:()=>node(`${id}-child`),setAttribute:noop,addEventListener:noop,focus:noop});return nodes.get(id);}
  const context=vm.createContext({...engine,console,Math,Number,String,Set,URL,URLSearchParams,Uint32Array,devicePixelRatio:1,crypto:{getRandomValues:a=>(a[0]=12345,a)},location:{search:'',href:'http://localhost:5173/'},navigator:{},document:{getElementById:node,querySelector:node,createElement:()=>node(Math.random()),addEventListener:noop},window:{addEventListener:noop},ResizeObserver:class{observe(){}},requestAnimationFrame:noop});
  const source=readFileSync(new URL('../game.js',import.meta.url),'utf8').replace(/^import .*?;\n/,'');
  vm.runInContext(source+'\nthis.testGame={state,get map(){return map},get squad(){return squad},tick,initMission,startMission,pause,issueMove,throwGrenade,damageEnemy,damageSoldier,explode,select,regroup,buttons: $};',context);
  return context.testGame;
}

test('squad moves, selection works, pause freezes the simulation',()=>{
  const g=game();g.startMission();const before=g.squad.map(u=>({x:u.x,y:u.y}));
  g.issueMove({x:g.map.spawn.x+220,y:g.map.spawn.y-48});for(let i=0;i<100;i++)g.tick(.02);
  assert.ok(g.squad.every((u,i)=>Math.hypot(u.x-before[i].x,u.y-before[i].y)>70));
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
  g.buttons('deploy').onclick();assert.equal(g.state.phase,'playing');assert.equal(g.state.mission,2);assert.equal(g.map.biome.label,'PUSTYNNE POGRANICZE · POŁUDNIE');assert.equal(g.squad.length,4);assert.equal(g.state.kills,0);
});
test('squad loss can be retried without changing terrain or retaining earned points',()=>{
  const g=game();g.startMission();const seed=g.map.seed;g.damageEnemy(g.map.enemies[0],100,0);for(const u of g.squad)g.damageSoldier(u,100);g.tick(.02);
  assert.equal(g.state.phase,'lost');g.buttons('deploy').onclick();assert.equal(g.map.seed,seed);assert.equal(g.state.phase,'playing');assert.equal(g.state.score,0);assert.equal(g.squad.every(u=>u.hp===100),true);
});
test('grenade range and emergency supply prevent unwinnable missions',()=>{
  const g=game();g.startMission();g.state.pointer.worldX=g.map.spawn.x+1000;g.state.pointer.worldY=g.map.spawn.y;g.throwGrenade();assert.equal(g.state.grenades,6);
  g.state.grenades=0;g.map.pickups.forEach(p=>p.taken=true);g.tick(.02);const supply=g.map.pickups.find(p=>!p.taken&&p.type==='grenade');assert.ok(supply);assert.equal(supply.x,g.map.spawn.x);g.tick(.02);assert.equal(g.state.grenades,3);
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
