import test from 'node:test';
import assert from 'node:assert/strict';
import {generateMap,findPath,walkable,lineClear,moveUnit,TILE,COLS,ROWS} from '../engine.js';

test('same seed and mission reproduce terrain, enemies and supplies',()=>{
  assert.deepEqual(generateMap(12345,3),generateMap(12345,3));
  assert.notDeepEqual(generateMap(12345).tiles,generateMap(54321).tiles);
});
test('all objectives, patrols and supplies are accessible for 60 maps',()=>{
  for(let seed=1;seed<=60;seed++){
    const map=generateMap(seed*7919,seed%12+1);
    for(const goal of [...map.huts,...map.enemies,...map.pickups]){
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
