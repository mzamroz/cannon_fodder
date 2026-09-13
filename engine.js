export const TILE = 48, COLS = 48, ROWS = 36;
export const BIOMES = [
  {name:'Zielony horyzont',label:'LAS UMIARKOWANY · ŚWIT',ground:'#76874b',light:'#829257',dark:'#687940',path:'#a1a16b',water:'#476f73',waterLight:'#678b85',tree:'#344b31',treeLight:'#526638',rock:'#818675',sky:'19°C ↗ WIATR 4 KM/H'},
  {name:'Piasek i stal',label:'PUSTYNNE POGRANICZE · POŁUDNIE',ground:'#b7a36a',light:'#c5b478',dark:'#a9985e',path:'#d5c28c',water:'#5d9690',waterLight:'#83b2a0',tree:'#596740',treeLight:'#78804c',rock:'#978265',sky:'34°C ↗ WIATR 12 KM/H'},
  {name:'Cichy mróz',label:'PÓŁNOCNY FRONT · PORANEK',ground:'#bcc8b9',light:'#d2d9c7',dark:'#a8b9ac',path:'#dce0d0',water:'#5f8792',waterLight:'#87acb1',tree:'#425e51',treeLight:'#678274',rock:'#859591',sky:'−8°C ↗ WIATR 7 KM/H'}
];
export function random(seed) { let a=seed>>>0; return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}; }
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function generateMap(seed,mission=1) {
  const rng=random(seed), tiles=new Uint8Array(COLS*ROWS), decorations=[], huts=[], enemies=[], pickups=[];
  const biome=BIOMES[(mission-1)%3];
  const at=(x,y)=>y*COLS+x;
  const riverX=17+Math.floor(rng()*8);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const river=riverX+Math.sin(y*.23)*3;
    tiles[at(x,y)]=Math.abs(x-river)<1.5?1:0;
    if(rng()<.08&&tiles[at(x,y)]===0)tiles[at(x,y)]=2;
  }
  // Two crossings and a connected road network guarantee access to each objective.
  const roads=[9,26];
  for(const y of roads)for(let x=2;x<COLS-2;x++)for(let k=-1;k<=1;k++)tiles[at(x,y+k)]=tiles[at(x,y+k)]===1?4:3;
  for(let y=3;y<ROWS-2;y++)for(const x of [6,39])for(let k=-1;k<=1;k++)tiles[at(x+k,y)]=3;
  const spawn={x:6*TILE+24,y:27*TILE+24};
  function clear(cx,cy,r=2){for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++)if(x>0&&y>0&&x<COLS-1&&y<ROWS-1)tiles[at(x,y)]=3;}
  clear(6,27,3);
  const spots=[{x:37+Math.floor(rng()*5),y:7+Math.floor(rng()*4)},{x:37+Math.floor(rng()*5),y:24+Math.floor(rng()*5)},{x:7+Math.floor(rng()*4),y:6+Math.floor(rng()*4)}];
  const hutCount=mission<3?2:3;
  for(let i=0;i<hutCount;i++){
    const p=spots[i]; clear(p.x,p.y,3);
    const roadY=i===1?26:9;
    for(let y=Math.min(p.y,roadY);y<=Math.max(p.y,roadY);y++)for(let k=-1;k<=1;k++)tiles[at(p.x+k,y)]=3;
    huts.push({x:p.x*TILE+24,y:p.y*TILE+24,hp:100,maxHp:100,id:i});
  }
  // Remove isolated walkable pockets so no patrol or supply is unreachable.
  const visited=new Set(), queue=[at(6,27)];visited.add(queue[0]);
  for(let i=0;i<queue.length;i++){const n=queue[i],x=n%COLS,y=Math.floor(n/COLS);for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,nn=at(nx,ny);if(nx>=0&&ny>=0&&nx<COLS&&ny<ROWS&&!visited.has(nn)&&tiles[nn]!==1&&tiles[nn]!==2){visited.add(nn);queue.push(nn);}}}
  for(let i=0;i<tiles.length;i++)if(tiles[i]!==1&&tiles[i]!==2&&!visited.has(i))tiles[i]=2;
  function placeNear(p,r){for(let i=0;i<100;i++){const x=p.x+(rng()-.5)*r,y=p.y+(rng()-.5)*r,cx=Math.floor(x/TILE),cy=Math.floor(y/TILE);if(cx>1&&cy>1&&cx<COLS-2&&cy<ROWS-2&&visited.has(at(cx,cy)))return{x,y};}return{x:p.x,y:p.y+TILE};}
  const count=8+Math.min(mission-1,12)*2;
  for(let i=0;i<count;i++){const home=huts[i%huts.length],p=placeNear(home,430);enemies.push({...p,home:{...p},hp:65,maxHp:65,id:i,cooldown:rng()*2,angle:rng()*Math.PI*2,path:[],repath:0,patrol:rng()*3,alert:0});}
  for(const p of [{x:13*TILE,y:26*TILE},{x:30*TILE,y:9*TILE},{x:39*TILE,y:18*TILE},{x:6*TILE,y:15*TILE}]){const q=placeNear(p,100);pickups.push({...q,type:pickups.length%2?'grenade':'med',taken:false});}
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const t=tiles[at(x,y)];if(t===2)decorations.push({x:x*TILE+24,y:y*TILE+24,type:rng()<.78?'tree':'rock',variant:Math.floor(rng()*3)});}
  return {seed,mission,biome,tiles,huts,enemies,pickups,decorations,spawn,width:COLS*TILE,height:ROWS*TILE};
}
export function walkable(map,x,y){const cx=Math.floor(x/TILE),cy=Math.floor(y/TILE);return cx>=0&&cy>=0&&cx<COLS&&cy<ROWS&&![1,2].includes(map.tiles[cy*COLS+cx]);}
export function lineClear(map,a,b){const d=distance(a,b),steps=Math.ceil(d/12);for(let i=1;i<=steps;i++){if(!walkable(map,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps))return false;}return true;}
export function findPath(map,start,end){
  const sx=Math.floor(start.x/TILE),sy=Math.floor(start.y/TILE);
  let ex=Math.max(0,Math.min(COLS-1,Math.floor(end.x/TILE))),ey=Math.max(0,Math.min(ROWS-1,Math.floor(end.y/TILE)));
  if(!walkable(map,ex*TILE+24,ey*TILE+24)){
    let found=false;for(let r=1;r<7&&!found;r++)for(let dy=-r;dy<=r&&!found;dy++)for(let dx=-r;dx<=r;dx++)if(walkable(map,(ex+dx)*TILE+24,(ey+dy)*TILE+24)){ex+=dx;ey+=dy;found=true;break;}
    if(!found)return[];
  }
  const initial=sy*COLS+sx,goal=ey*COLS+ex;
  if(initial===goal)return[{x:ex*TILE+24,y:ey*TILE+24}];
  const open=[initial],cost=new Float32Array(COLS*ROWS).fill(Infinity),parent=new Int32Array(COLS*ROWS).fill(-1),closed=new Uint8Array(COLS*ROWS);
  cost[initial]=0;
  const heuristic=n=>Math.hypot(n%COLS-ex,Math.floor(n/COLS)-ey);
  while(open.length){let best=0;for(let i=1;i<open.length;i++)if(cost[open[i]]+heuristic(open[i])<cost[open[best]]+heuristic(open[best]))best=i;
    const n=open.splice(best,1)[0];if(n===goal){const route=[];let cur=goal;while(cur!==initial){route.push({x:(cur%COLS)*TILE+24,y:Math.floor(cur/COLS)*TILE+24});cur=parent[cur];}route.reverse();if(!lineClear(map,start,route[0]))route.unshift({x:sx*TILE+24,y:sy*TILE+24});return route;}
    closed[n]=1;const x=n%COLS,y=Math.floor(n/COLS);
    for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=x+dx,ny=y+dy;if(!walkable(map,nx*TILE+24,ny*TILE+24))continue;if(dx&&dy&&(!walkable(map,(x+dx)*TILE+24,y*TILE+24)||!walkable(map,x*TILE+24,(y+dy)*TILE+24)))continue;const nn=ny*COLS+nx;if(closed[nn])continue;const next=cost[n]+(dx&&dy?1.414:1);if(next<cost[nn]){if(cost[nn]===Infinity)open.push(nn);cost[nn]=next;parent[nn]=n;}}
  }return[];
}
export function moveUnit(map,unit,dt,speed){if(!unit.path.length)return;const p=unit.path[0],d=distance(unit,p),step=speed*dt;unit.angle=Math.atan2(p.y-unit.y,p.x-unit.x);if(d<=step){unit.x=p.x;unit.y=p.y;unit.path.shift();}else{const x=unit.x+(p.x-unit.x)/d*step,y=unit.y+(p.y-unit.y)/d*step;if(walkable(map,x,y)){unit.x=x;unit.y=y;}else unit.path=[];}}
