import test from 'node:test';
import assert from 'node:assert/strict';
import {generateMap,generateBootCamp,findPath,walkable,lineClear,moveUnit,TILE,COLS,ROWS,difficultyFor,missionStatus,updateSites,createCampaign,deploySquad,settleMission,settleBootCamp,recruitsLeft,rankStats,spawnFromHuts,pointInPolygon,aimAssist,RECRUIT_POOL,T_WATER,T_WALL,dropTrail,followPoint,waveTarget,blastGates,explosiveShotsOnMap,hutCountFor} from '../engine.js';

test('same seed and mission reproduce terrain, enemies and supplies',()=>{
  assert.deepEqual(generateMap(12345,3),generateMap(12345,3));
  assert.notDeepEqual(generateMap(12345).tiles,generateMap(54321).tiles);
});
test('all objectives, patrols and supplies are accessible for 60 maps',()=>{
  for(let seed=1;seed<=60;seed++){
    const map=generateMap(seed*7919,seed%12+1);
    assert.equal(new Set(map.enemies.map(e=>`${e.x}:${e.y}`)).size,map.enemies.length,'guards must not overlap');
    for(const goal of [...map.huts,...map.enemies,...map.pickups,...map.sites,map.extraction]){
      assert.ok(walkable(map,goal.x,goal.y),`Spawn on obstacle, seed ${map.seed}`);
      const path=findPath(map,map.spawn,goal);
      assert.ok(path.length,`Unreachable objective, seed ${map.seed}`);
      for(let i=0;i<path.length;i++)assert.ok(lineClear(map,i?path[i-1]:map.spawn,path[i]),`Path clips an obstacle, seed ${map.seed}`);
    }
  }
});
test('navigation routes around walls and never cuts a blocked corner',()=>{
  const map={tiles:new Uint8Array(COLS*ROWS)};
  for(let y=0;y<10;y++)map.tiles[y*COLS+5]=2;
  const start={x:3*TILE+24,y:3*TILE+24},goal={x:7*TILE+24,y:3*TILE+24};
  assert.equal(lineClear(map,start,goal),false);
  const path=findPath(map,start,goal);assert.ok(path.some(p=>p.y>=10*TILE));
  const u={...start,path};for(let i=0;i<3000&&u.path.length;i++){moveUnit(map,u,.02,112);assert.ok(walkable(map,u.x,u.y));}
  assert.ok(Math.hypot(u.x-goal.x,u.y-goal.y)<1);
});
test('difficulty is capped and each biome appears in the campaign',()=>{
  assert.equal(generateMap(8,1).enemies.length,8);
  assert.equal(generateMap(8,99).enemies.length,32);
  assert.equal(new Set([1,2,3].map(m=>generateMap(8,m).biome.name)).size,3);
  assert.equal(generateMap(8,1).huts.length,2);
  assert.equal(generateMap(8,3).huts.length,3);
});


test('landscapes change dimensions, topology and landing direction across the campaign',()=>{
  const maps=Array.from({length:12},(_,i)=>generateMap(12345,i+1));
  assert.equal(new Set(maps.map(m=>m.layout.id)).size,6);
  assert.equal(new Set(maps.map(m=>m.operation.type)).size,4);
  assert.ok(new Set(maps.map(m=>`${m.cols}x${m.rows}`)).size>=6);
  assert.ok(maps[0].tiles.length<maps[1].tiles.length);
  const orientations=new Set();
  for(let seed=1;seed<=30;seed++){
    const m=generateMap(seed,2);orientations.add(`${m.spawn.x<m.width/2}:${m.spawn.y<m.height/2}`);
    assert.equal(m.tiles.length,m.cols*m.rows);
    assert.ok(m.tiles.includes(4),'river must have crossings');
    for(const e of m.enemies)assert.ok(Math.hypot(e.x-m.spawn.x,e.y-m.spawn.y)>=480);
  }
  assert.equal(orientations.size,4);
});

test('threat grows gradually, enemy roles unlock in stages and scaling stops',()=>{
  for(let mission=2;mission<=20;mission++){
    const a=difficultyFor(mission-1),b=difficultyFor(mission);
    assert.ok(b.enemies>=a.enemies&&b.enemies-a.enemies<=2);
    assert.ok(b.damage>=a.damage&&b.damage-a.damage<=.351);
    assert.ok(b.speed>=a.speed&&b.speed-a.speed<=1.701);
  }
  assert.deepEqual(difficultyFor(13),difficultyFor(999));
  assert.deepEqual([...new Set(generateMap(3,1).enemies.map(e=>e.role))],['rifle']);
  assert.ok(generateMap(3,2).enemies.some(e=>e.role==='scout'));
  assert.ok(generateMap(3,3).enemies.some(e=>e.role==='marksman'));
  assert.ok(generateMap(3,6).enemies.some(e=>e.role==='gunner'));
});

test('capture needs presence, decays when contested or abandoned, then completes',()=>{
  const map=generateMap(42,4),site=map.sites[0],squad=[{...site,hp:100}];
  map.enemies.forEach(e=>e.hp=0);
  updateSites(map,[],20);assert.equal(site.progress,0);
  updateSites(map,squad,3);assert.equal(site.progress,3);assert.equal(site.done,false);
  const guard=map.enemies[0];Object.assign(guard,{x:site.x,y:site.y,hp:65});
  updateSites(map,squad,2);assert.ok(site.progress<3);assert.equal(site.contested,true);
  guard.hp=0;updateSites(map,[],3);assert.ok(site.progress<3);
  updateSites(map,squad,8);assert.equal(site.done,true);
  assert.equal(missionStatus(map,squad).primary,false,'both radios are required');
});

test('sabotage and rescue require extraction but allow surviving enemies',()=>{
  for(const mission of [2,3,4]){
    const map=generateMap(42,mission),squad=[{...map.spawn,hp:100},{...map.spawn,hp:100}];
    assert.equal(missionStatus(map,squad).won,false);
    if(mission===2)map.huts.forEach(h=>h.hp=0);else map.sites.forEach(s=>s.done=true);
    squad[1].x+=200;assert.equal(missionStatus(map,squad).won,false,'all survivors must return');
    squad[1].hp=0;assert.equal(missionStatus(map,squad).won,true);
    squad[0].hp=0;assert.equal(missionStatus(map,squad).won,false,'a dead squad never wins');
  }
});

test('navigation respects rectangular map boundaries including invalid start positions',()=>{
  const map={cols:12,rows:40,tiles:new Uint8Array(12*40)};
  const a={x:24,y:24},b={x:11*TILE+24,y:39*TILE+24};
  assert.ok(findPath(map,a,b).length);
  assert.equal(walkable(map,12*TILE,24),false);
  assert.equal(walkable(map,24,40*TILE),false);
  assert.deepEqual(findPath(map,{x:-1,y:24},b),[]);
});

test('soldiers can swim water but walls still block, and pathfinding prefers bridges',()=>{
  const map={cols:12,rows:8,tiles:new Uint8Array(12*8)};
  for(let y=0;y<8;y++)map.tiles[y*12+5]=T_WATER;
  map.tiles[3*12+5]=4;
  assert.equal(walkable(map,5*TILE+24,24),true);
  assert.equal(walkable(map,5*TILE+24,24,{fly:true}),true);
  const wall={cols:8,rows:8,tiles:new Uint8Array(64)};wall.tiles[20]=T_WALL;
  assert.equal(walkable(wall,4*TILE+24,2*TILE+24),false);
  const start={x:2*TILE+24,y:3*TILE+24},goal={x:8*TILE+24,y:3*TILE+24};
  const path=findPath(map,start,goal);
  assert.ok(path.some(p=>Math.floor(p.x/TILE)===5&&Math.floor(p.y/TILE)===3),'bridge is the cheap crossing');
});

test('campaign roster, promotions and permadeath',()=>{
  const c=createCampaign();
  assert.equal(c.roster.length,RECRUIT_POOL);
  assert.equal(c.roster[0].name,'JOOLS');
  const spawn={x:10,y:10},squad=deploySquad(c,spawn,[]);
  assert.equal(squad.length,4);assert.equal(squad[0].name,'JOOLS');
  squad[0].hp=0;settleMission(c,squad,1,true);
  assert.equal(c.roster[0].dead,true);assert.equal(c.graves.length,1);
  assert.equal(c.roster[1].rank,1);
  const next=deploySquad(c,spawn,squad.filter(u=>u.hp>0));
  assert.equal(next[0].name,'JOPS');assert.ok(next.every(u=>u.recruitId!==0));
  assert.equal(recruitsLeft(c),RECRUIT_POOL-1);
  const stats=rankStats(7);assert.ok(stats.range>rankStats(0).range);assert.ok(stats.cooldown<rankStats(0).cooldown);
});

test('mines spawn fully visible from mission two',()=>{
  const maps=Array.from({length:20},(_,i)=>generateMap(i+1,2+i%8));
  const mines=maps.flatMap(m=>m.mines);
  assert.ok(mines.length>=10);
  assert.ok(mines.every(m=>m.reveal===1&&m.armed&&!m.exploded));
  assert.ok(mines.some(m=>m.kind==='mine'));
  assert.ok(maps.some(m=>m.biome.id==='jungle'&&m.mines.some(mine=>mine.kind==='bamboo')));
});

test('huts emit a rifleman until destroyed',()=>{
  const map=generateMap(9,1),before=map.enemies.length;
  map.huts[0].spawnTimer=0;spawnFromHuts(map,0.05);
  assert.equal(map.enemies.length,before+1);
  assert.equal(map.enemies.at(-1).role,'rifle');
  map.huts.forEach(h=>{h.hp=0;h.spawnTimer=0;});
  spawnFromHuts(map,0.05);assert.equal(map.enemies.length,before+1);
});

test('lasso polygon and aim assist lock onto the cone',()=>{
  const poly=[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}];
  assert.equal(pointInPolygon({x:5,y:5},poly),true);
  assert.equal(pointInPolygon({x:20,y:5},poly),false);
  const origin={x:0,y:0},aim={x:100,y:0};
  const locked=aimAssist(origin,aim,[{x:90,y:8,hp:50},{x:90,y:80,hp:50}],0.7,200);
  assert.equal(locked.x,90);assert.equal(locked.y,8);
});

test('snake trail follows the leader',()=>{
  const leader={x:0,y:0,trail:[],angle:0};
  for(let x=0;x<=80;x+=10){leader.x=x;dropTrail(leader);}
  assert.ok(leader.trail.length>3);
  const behind=followPoint(leader,1,22);
  assert.ok(behind.x<leader.x);
});

test('mission ammo is tight and maps hide enough explosives for bunkers',()=>{
  assert.equal(difficultyFor(1).grenades,2);assert.equal(difficultyFor(1).rockets,0);
  assert.equal(difficultyFor(3).grenades,hutCountFor(3));
  for(let mission=1;mission<=12;mission++){
    const map=generateMap(mission*17,mission);
    const shots=map.difficulty.grenades+map.difficulty.rockets+explosiveShotsOnMap(map);
    assert.ok(shots>=map.huts.length,`mission ${mission} needs explosives for every bunker`);
    if(mission>=2)assert.ok(map.huts.every(h=>h.choke&&h.flank));
    if(mission>=3)assert.ok(map.gates.length>=1);
  }
});

test('gates open only to blasts and spawned waves push through the choke',()=>{
  const map=generateMap(21,3),gate=map.gates[0];
  assert.ok(gate);assert.equal(gate.open,false);
  const tile=map.tiles[gate.cells[0].y*map.cols+gate.cells[0].x];
  assert.equal(tile,T_WALL);
  blastGates(map,{x:gate.x+400,y:gate.y},110);assert.equal(gate.open,false);
  blastGates(map,gate,110);assert.equal(gate.open,true);
  map.huts[0].spawnTimer=0;const before=map.enemies.length;spawnFromHuts(map,0.05);
  const wave=map.enemies.at(-1);
  assert.equal(map.enemies.length,before+1);
  assert.ok(waveTarget(map,wave));
});

test('boot camp is a drill that never wins and deaths are permanent',()=>{
  const map=generateBootCamp(7);
  assert.equal(map.bootcamp,true);assert.equal(map.operation.type,'drill');
  assert.equal(missionStatus(map,[{hp:100,...map.spawn}]).won,false);
  const c=createCampaign(),squad=deploySquad(c,map.spawn,[]);
  squad[0].hp=0;settleBootCamp(c,squad,1);
  assert.equal(c.roster[0].dead,true);assert.equal(c.roster[1].rank,0);
});
