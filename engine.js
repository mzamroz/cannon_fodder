export const TILE = 48, COLS = 48, ROWS = 36;
export const T_GROUND=0,T_WATER=1,T_WALL=2,T_PATH=3,T_BRIDGE=4,T_SAND=5,T_DRIFT=6,T_ICE=7;
export const RECRUIT_POOL=360;
export const RANKS=['SZEREGOWY','KAPRAL','SIERŻANT','PORUCZNIK','KAPITAN','MAJOR','PUŁKOWNIK','GENERAŁ'];
export const BIOMES = [
  {name:'Zielony horyzont',label:'LAS UMIARKOWANY · ŚWIT',ground:'#76874b',light:'#829257',dark:'#687940',path:'#a1a16b',water:'#476f73',waterLight:'#678b85',tree:'#344b31',treeLight:'#526638',rock:'#818675',sky:'19°C ↗ WIATR 4 KM/H',id:'jungle'},
  {name:'Piasek i stal',label:'PUSTYNNE POGRANICZE · POŁUDNIE',ground:'#b7a36a',light:'#c5b478',dark:'#a9985e',path:'#d5c28c',water:'#5d9690',waterLight:'#83b2a0',tree:'#596740',treeLight:'#78804c',rock:'#978265',sky:'34°C ↗ WIATR 12 KM/H',id:'desert'},
  {name:'Cichy mróz',label:'PÓŁNOCNY FRONT · PORANEK',ground:'#bcc8b9',light:'#d2d9c7',dark:'#a8b9ac',path:'#dce0d0',water:'#5f8792',waterLight:'#87acb1',tree:'#425e51',treeLight:'#678274',rock:'#859591',sky:'−8°C ↗ WIATR 7 KM/H',id:'snow'},
  {name:'Stalowy labirynt',label:'BAZA WOJSKOWA · NOC',ground:'#5c6358',light:'#6e7568',dark:'#4a5248',path:'#7a7d6c',water:'#3d5558',waterLight:'#547074',tree:'#3a4038',treeLight:'#555c52',rock:'#6a6e66',sky:'12°C ↗ WIATR 2 KM/H',id:'base'}
];
export function random(seed) { let a=seed>>>0; return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}; }
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const OPERATIONS = {
  clear:{name:'Rozpoznanie bojem',brief:'Wyeliminuj garnizon i zniszcz wszystkie posterunki granatami. Wykorzystaj osłony i zbierz zapasy przed kolejnym starciem.'},
  sabotage:{name:'Uderz i zniknij',brief:'Zniszcz posterunki granatami, potem doprowadź wszystkich ocalałych do strefy ewakuacji. Nie musisz eliminować każdego patrolu.'},
  rescue:{name:'Powrót do domu',brief:'Dotrzyj do oznaczonego jeńca i zabezpieczaj jego pozycję przez 3 sekundy. Następnie wróć wszystkimi ocalałymi do ewakuacji. Pozostałe cele są opcjonalne.'},
  capture:{name:'Cisza w eterze',brief:'Przejmij obie radiostacje: utrzymaj oddział w żółtym kręgu przez 8 sekund bez wroga w pobliżu. Następnie ewakuuj wszystkich ocalałych.'}
};
const LAYOUTS = [
  {id:'woodland',name:'Leśne polany',cols:30,rows:24,hint:'Krótkie podejścia i odizolowane grupy przeciwników. Rzeki brodzisz wpław — bez broni.'},
  {id:'river',name:'Dwie przeprawy',cols:46,rows:28,hint:'Rzeka dzieli teren. Wybierz most lub dłuższą przeprawę wpław drugim brzegiem.'},
  {id:'islands',name:'Archipelag',cols:38,rows:40,hint:'Wąskie groble łączą wyspy. Zabezpiecz wyjście z przeprawy przed ruchem.'},
  {id:'canyon',name:'Wąwóz',cols:58,rows:24,hint:'Skalne grzbiety dzielą front na korytarze. Boczne przejścia pozwalają flankować.'},
  {id:'basin',name:'Wokół jeziora',cols:42,rows:42,hint:'Jezioro rozdziela dwie drogi natarcia. Zapasy czekają na obu flankach.'},
  {id:'fortress',name:'Pas umocnień',cols:50,rows:36,hint:'Ciasne linie osłon i drzwi-spawnerzy. Rakieta w korytarzu rani także swoich.'}
];
const NAME_STEMS=['JOOLS','JOPS','STOO','RJ','UBER','SCOTT','JON','BILLY','ADAM','BEN','CHUCK','DOUG','ED','FRANK','GUS','HANK','IAN','JAKE','KEN','LEO','MAX','NED','OWEN','PAT','QUINN','RAY','SAM','TED','VIC','WILL','XAV','YAN','ZED','ALF','BOB','COLIN','DIRK','ERNIE','FRED','GREG','HARRY','IVAN','JACK','KARL','LOU','MICK','NICK','OSCAR','PETE','ROLF','SID','TOM','ULF','VERN','WALT','BASIL','CLIVE','DUKE','EMIL','FLOYD','GLEN','HUGH','IGOR','JULES','KIRK','LEM','MOE','NORM','OTIS','PAUL','REED','STAN','TROY','VERN','WADE','YVES'];
export function recruitName(i){
  if(i<NAME_STEMS.length)return NAME_STEMS[i];
  return `${NAME_STEMS[i%NAME_STEMS.length]}${Math.floor(i/NAME_STEMS.length)+1}`;
}
export function rankStats(rank=0){
  const r=Math.max(0,Math.min(7,rank|0));
  return {name:RANKS[r],accuracy:1-r*.07,cooldown:.24*(1-r*.045),range:300+r*18,reaction:1-r*.05};
}
export const MEDALS={star:{id:'star',glyph:'★',name:'Gwiazda operacji'},cross:{id:'cross',glyph:'✣',name:'Krzyż zasługi'},heart:{id:'heart',glyph:'♥',name:'Serce lwa'}};
export function hutCountFor(mission){return mission<3?2:mission<8?3:4;}
export function theaterFor(mission){return BIOMES[(Math.max(1,mission)-1)%4];}
export function createCampaign(){
  return {roster:Array.from({length:RECRUIT_POOL},(_,id)=>({id,name:recruitName(id),rank:0,dead:false,medals:[]})),graves:[]};
}
export function recruitsLeft(campaign){return campaign.roster.filter(r=>!r.dead).length;}
export function upcomingRecruits(campaign,squad=[],n=4){
  const used=new Set((squad||[]).map(u=>u.recruitId));
  return campaign.roster.filter(r=>!r.dead&&!used.has(r.id)).slice(0,n);
}
export function soldierFromRecruit(recruit,id,spawn){
  return {id,recruitId:recruit.id,name:recruit.name,rank:recruit.rank||0,group:0,x:spawn.x+(id%2)*27,y:spawn.y+Math.floor(id/2)*27,hp:100,maxHp:100,angle:-Math.PI/2,path:[],cooldown:id*.05,kills:0,vehicleId:null,vx:0,vy:0,sink:0,flash:0,trail:[],medals:Array.isArray(recruit.medals)?[...recruit.medals]:[]};
}
export function deploySquad(campaign,spawn,keep=[]){
  const squad=[];
  for(const u of keep){
    if(squad.length>=4)break;
    const r=campaign.roster[u.recruitId];
    if(!r||r.dead)continue;
    squad.push(soldierFromRecruit(r,squad.length,spawn));
  }
  for(const r of campaign.roster){
    if(squad.length>=4)break;
    if(r.dead||squad.some(s=>s.recruitId===r.id))continue;
    squad.push(soldierFromRecruit(r,squad.length,spawn));
  }
  return squad;
}
export function settleMission(campaign,squad,mission,won,ctx={}){
  const deaths=squad.filter(u=>u.hp<=0).length,promotions=[];
  for(const u of squad){
    const r=campaign.roster[u.recruitId];
    if(!r)continue;
    if(u.hp<=0){
      if(!r.dead){r.dead=true;campaign.graves.push({name:r.name,rank:r.rank||0,mission});}
    }else if(won){
      const from=r.rank||0;
      r.rank=Math.min(7,from+1);
      r.medals=Array.isArray(r.medals)?r.medals:[];
      const fresh=[];
      if(ctx.stars===3&&!r.medals.includes('star')){r.medals.push('star');fresh.push('star');}
      if((u.kills||0)>=8&&!r.medals.includes('cross')){r.medals.push('cross');fresh.push('cross');}
      if(deaths>0&&!r.medals.includes('heart')){r.medals.push('heart');fresh.push('heart');}
      promotions.push({name:r.name,from,to:r.rank,medals:fresh});
    }
  }
  return promotions;
}
export function settleBootCamp(campaign,squad,mission){return settleMission(campaign,squad,mission,false);}
export function difficultyFor(mission){
  const level=Math.max(0,Math.min(12,mission-1)),huts=hutCountFor(mission);
  return {level:level+1,enemies:8+level*2,speed:55+level*1.7,damage:6+Math.min(4,level*.35),
    fireDelay:1.3-level*.025,awareness:330+level*5,grenades:mission<=1?2:huts,rockets:mission<=1?0:mission<5?1:2};
}
export function generateMap(seed,mission=1) {
  mission=Number.isFinite(mission)?Math.max(1,Math.floor(mission)):1;
  const rng=random(seed),layout=LAYOUTS[(mission-1)%LAYOUTS.length],difficulty=difficultyFor(mission);
  const baseCols=layout.cols+Math.floor(rng()*3)*2,baseRows=layout.rows+Math.floor(rng()*3)*2;
  const transpose=rng()<.5,flipX=rng()<.5,flipY=rng()<.5;
  const cols=transpose?baseRows:baseCols,rows=transpose?baseCols:baseRows;
  const tiles=new Uint8Array(cols*rows),decorations=[],huts=[],enemies=[],pickups=[];
  const biome=BIOMES[(mission-1)%4],type=['clear','sabotage','rescue','capture'][(mission-1)%4];
  const point=(u,v)=>{let x=flipX?1-u:u,y=flipY?1-v:v;if(transpose)[x,y]=[y,x];return {x:Math.round(3+x*(cols-7)),y:Math.round(3+y*(rows-7))};};
  const world=p=>({x:p.x*TILE+24,y:p.y*TILE+24});
  const at=(x,y)=>y*cols+x;
  const spawnCell=point(.04,.68+rng()*.2),spawn=world(spawnCell);
  const anchors=[point(.73+rng()*.17,.1+rng()*.2),point(.73+rng()*.17,.72+rng()*.16),point(.22+rng()*.2,.08+rng()*.12),point(.4+rng()*.18,.78+rng()*.12)];
  const clusters=Array.from({length:Math.floor(cols*rows/65)},()=>({x:rng()*cols,y:rng()*rows,r:1.1+rng()*2}));
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    let u=x/(cols-1),v=y/(rows-1);if(transpose)[u,v]=[v,u];if(flipX)u=1-u;if(flipY)v=1-v;
    let water=false,wall=false;
    if(layout.id==='river')water=Math.abs(u-(.5+Math.sin(v*8)*.065))<.045;
    if(layout.id==='islands')water=Math.abs(u-(.5+Math.sin(v*9)*.055))<.04||Math.abs(v-(.49+Math.cos(u*7)*.06))<.04;
    if(layout.id==='basin')water=((u-.51)/.22)**2+((v-.49)/.25)**2<1;
    if(layout.id==='canyon')wall=(Math.abs(v-.35)<.055||Math.abs(v-.65)<.055)&&u>.13&&u<.88;
    if(layout.id==='fortress')wall=(Math.abs(u-.4)<.022||Math.abs(u-.7)<.022)&&v>.07&&v<.93;
    if(biome.id==='base'&&layout.id!=='fortress')wall=wall||((Math.abs(u-.55)<.018||Math.abs(v-.5)<.018)&&u>.18&&u<.86&&v>.12&&v<.88);
    const forest=clusters.some(c=>Math.hypot(x-c.x,y-c.y)<c.r)&&rng()<(biome.id==='jungle'?.82:.76);
    tiles[at(x,y)]=water?T_WATER:wall||forest?T_WALL:T_GROUND;
  }
  function carve(x,y){if(x>0&&y>0&&x<cols-1&&y<rows-1){const i=at(x,y);tiles[i]=tiles[i]===T_WATER||tiles[i]===T_BRIDGE?T_BRIDGE:T_PATH;}}
  function clear(p,r=2){for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)carve(p.x+dx,p.y+dy);}
  function road(a,b,width=1){let {x,y}=a;const horizontal=rng()<.5;const paint=()=>{for(let dy=-width;dy<=width;dy++)for(let dx=-width;dx<=width;dx++)carve(x+dx,y+dy);};paint();for(const axis of horizontal?['x','y']:['y','x']){while((axis==='x'?x:y)!==b[axis]){if(axis==='x')x+=Math.sign(b.x-x);else y+=Math.sign(b.y-y);paint();}}}
  const routes={
    woodland:{nodes:[[.12,.78],[.32,.52],[.32,.18],[.8,.2],[.83,.81]],edges:[[0,1],[1,2],[2,3],[1,4],[3,4]],width:0},
    river:{nodes:[[.12,.8],[.13,.2],[.85,.2],[.85,.8]],edges:[[0,1],[1,2],[2,3],[3,0]],width:1},
    islands:{nodes:[[.12,.8],[.24,.23],[.5,.5],[.84,.22],[.82,.82]],edges:[[0,2],[1,2],[2,3],[2,4],[0,1]],width:0},
    canyon:{nodes:[[.12,.8],[.5,.8],[.88,.8],[.88,.5],[.12,.5],[.12,.2],[.52,.2],[.88,.2]],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[1,6]],width:0},
    basin:{nodes:[[.13,.8],[.16,.18],[.5,.12],[.86,.2],[.87,.82],[.5,.88]],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]],width:1},
    fortress:{nodes:[[.12,.8],[.24,.18],[.54,.18],[.54,.8],[.85,.8],[.85,.2]],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[0,3]],width:0}
  }[layout.id];
  const junctions=routes.nodes.map(([u,v])=>point(u,v));
  road(spawnCell,junctions[0],routes.width);
  for(const [a,b] of routes.edges)road(junctions[a],junctions[b],routes.width);
  clear(spawnCell,3);
  const hutCount=hutCountFor(mission),gates=[],civilians=[];
  function clampCell(p){return {x:Math.max(2,Math.min(cols-3,p.x)),y:Math.max(2,Math.min(rows-3,p.y))};}
  function fortifyHut(hutCell){
    const vx=spawnCell.x-hutCell.x,vy=spawnCell.y-hutCell.y,len=Math.hypot(vx,vy)||1;
    const ux=vx/len,uy=vy/len,px=-uy,py=ux;
    const choke=clampCell({x:Math.round(hutCell.x+ux*4),y:Math.round(hutCell.y+uy*4)});
    if(mission>=2){
      for(let i=-3;i<=3;i++){
        if(i===0)continue;
        const x=Math.round(choke.x+px*i),y=Math.round(choke.y+py*i);
        if(x>1&&y>1&&x<cols-2&&y<rows-2&&tiles[at(x,y)]!==T_WATER)tiles[at(x,y)]=T_WALL;
      }
      const flank=clampCell({x:Math.round(hutCell.x+px*7),y:Math.round(hutCell.y+py*7)});
      const elbow=clampCell({x:Math.round(spawnCell.x+px*5),y:Math.round(spawnCell.y+py*5)});
      road(hutCell,flank,0);road(flank,elbow,0);road(elbow,spawnCell,0);clear(flank,1);
      return {choke:world(choke),flank:world(flank),chokeCell:choke};
    }
    return {choke:world(choke),flank:world(hutCell),chokeCell:choke};
  }
  for(let i=0;i<hutCount;i++){
    const p=anchors[i];road(junctions.reduce((a,b)=>distance(a,p)<distance(b,p)?a:b),p,0);clear(p,2);
    const extra=fortifyHut(p);
    huts.push({...world(p),hp:100,maxHp:100,id:i,spawnTimer:4+rng()*3,choke:extra.choke,flank:extra.flank,chokeCell:extra.chokeCell});
  }
  const sites=[];
  if(type==='rescue'||type==='capture'){
    const cells=type==='rescue'?[point(.72+rng()*.16,.4+rng()*.2)]:[point(.25+rng()*.18,.18),point(.73+rng()*.15,.68+rng()*.15)];
    cells.forEach((p,i)=>{road(anchors[i],p,0);clear(p,2);sites.push({...world(p),id:i,kind:type==='rescue'?'rescue':'radio',progress:0,required:type==='rescue'?3:8,done:false,contested:false});});
  }
  const visited=new Set([at(spawnCell.x,spawnCell.y)]),queue=[...visited];
  for(let i=0;i<queue.length;i++){const n=queue[i],x=n%cols,y=Math.floor(n/cols);for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,nn=at(nx,ny);if(nx>=0&&ny>=0&&nx<cols&&ny<rows&&!visited.has(nn)&&tiles[nn]!==T_WATER&&tiles[nn]!==T_WALL){visited.add(nn);queue.push(nn);}}}
  for(let i=0;i<tiles.length;i++)if(tiles[i]!==T_WATER&&tiles[i]!==T_WALL&&!visited.has(i))tiles[i]=T_WALL;
  const occupied=new Set([...huts,...sites].map(p=>at(Math.floor(p.x/TILE),Math.floor(p.y/TILE))));
  if(mission>=3){
    for(const h of huts.slice(0,mission>=8?2:1)){
      const cell=h.chokeCell||{x:Math.floor(h.x/TILE),y:Math.floor(h.y/TILE)};
      const cells=[];
      for(const [dx,dy] of [[0,0],[1,0],[0,1]]){
        const x=cell.x+dx,y=cell.y+dy;
        if(x>1&&y>1&&x<cols-2&&y<rows-2&&tiles[at(x,y)]!==T_WATER&&!occupied.has(at(x,y))){tiles[at(x,y)]=T_WALL;cells.push({x,y});occupied.add(at(x,y));}
      }
      if(cells.length)gates.push({x:cells[0].x*TILE+24,y:cells[0].y*TILE+24,cells,open:false,id:gates.length});
    }
  }
  function placeNear(p,r,minSpawnDistance=0){
    const free=n=>!occupied.has(n)&&tiles[n]!==T_WALL&&tiles[n]!==T_WATER;
    const choices=queue.filter(n=>{const q={x:(n%cols)*TILE+24,y:Math.floor(n/cols)*TILE+24};return free(n)&&distance(q,p)<=r&&distance(q,spawn)>=minSpawnDistance;});
    const pool=choices.length?choices:queue.filter(n=>free(n)&&distance(world({x:n%cols,y:Math.floor(n/cols)}),spawn)>=minSpawnDistance);
    const open=pool.length?pool:queue.filter(free);
    const n=open[Math.floor(rng()*(open.length||1))]??queue[0];occupied.add(n);return {x:(n%cols)*TILE+24,y:Math.floor(n/cols)*TILE+24};
  }
  for(let i=0;i<difficulty.enemies;i++){
    const home=i%4===3&&sites.length?sites[i%sites.length]:huts[i%huts.length],p=placeNear(home,mission===1?170:260,mission===1?560:480);
    const role=mission>=6&&i%7===0?'gunner':mission>=3&&i%5===0?'marksman':mission>=2&&i%4===0?'scout':'rifle';
    const hp={rifle:65,scout:50,marksman:55,gunner:85}[role];
    enemies.push({...p,home:{...p},role,hp,maxHp:hp,id:i,cooldown:1+rng()*2,angle:rng()*Math.PI*2,path:[],repath:0,patrol:rng()*3,alert:0,aimTime:0});
  }
  for(const h of huts)pickups.push({...placeNear(h.flank||h,90),type:'grenade',taken:false});
  pickups.push({...placeNear(world(point(.35,.25)),160),type:'med',taken:false});
  if(mission<=2)pickups.push({x:spawn.x,y:spawn.y,type:'grenade',taken:false});
  if(mission>=2)pickups.push({...placeNear(huts[0],220,400),type:'rocket',taken:false});
  if(mission<=3)pickups.push({...placeNear(world(point(.6,.19)),160),type:'med',taken:false});
  const mines=[],turrets=[],vehicles=[];
  const civN=biome.id==='jungle'||biome.id==='desert'?3+Math.floor(rng()*6):Math.floor(rng()*3);
  for(let i=0;i<civN;i++){
    const p=placeNear(world(junctions[(i+1)%junctions.length]),220,280);
    const cell=at(Math.floor(p.x/TILE),Math.floor(p.y/TILE));
    if(tiles[cell]===T_WALL)continue;
    civilians.push({...p,id:i,hp:20,maxHp:20,kind:i<2&&rng()<.55?'chicken':'villager',angle:rng()*Math.PI*2,path:[],flee:0,cooldown:1+rng()});
  }
  const hazardCount=mission<2?0:2+Math.floor(mission/4);
  for(let i=0;i<hazardCount;i++){
    const kind=biome.id==='jungle'?'bamboo':'mine';
    const spot=placeNear(world(junctions[i%junctions.length]),180,480);
    if([...huts,...sites].every(p=>distance(p,spot)>150))mines.push({...spot,kind,armed:true,exploded:false,reveal:1});
  }
  if(mission>=5){
    const turretN=biome.id==='base'?2:1;
    for(let i=0;i<turretN;i++)turrets.push({...placeNear(huts[i%huts.length],200,520),id:i,hp:80,maxHp:80,cooldown:1+rng(),angle:rng()*Math.PI*2,flash:0});
  }
  if(mission>=2){
    const types=mission>=8?['jeep','tank']:mission>=5?['jeep','heli']:['jeep'];
    if(biome.id==='desert'&&!types.includes('jeep'))types.unshift('jeep');
    for(const [i,vType] of types.entries()){
      const hp=vType==='tank'?240:vType==='heli'?150:vType==='turret'?90:110;
      vehicles.push({...placeNear(spawn,320,70),id:i,type:vType,hp,maxHp:hp,angle:0,occupants:[],vx:0,vy:0,path:[],flash:0,cooldown:0});
    }
  }
  if(biome.id==='base'){
    vehicles.push({...placeNear(huts[0],160,480),id:vehicles.length,type:'turret',hp:90,maxHp:90,angle:0,occupants:[],vx:0,vy:0,path:[],flash:0,cooldown:0});
  }
  for(let y=1;y<rows-1;y++)for(let x=1;x<cols-1;x++){
    const i=at(x,y),t=tiles[i];
    if(t===T_WALL||t===T_BRIDGE||occupied.has(i))continue;
    const far=distance(world({x,y}),spawn)>220;
    if(biome.id==='snow'&&t===T_WATER&&rng()<.45)tiles[i]=T_ICE;
    else if(biome.id==='snow'&&(t===T_GROUND||t===T_PATH)&&far&&rng()<.08)tiles[i]=T_DRIFT;
    else if(biome.id==='desert'&&t===T_GROUND&&far&&rng()<.045)tiles[i]=T_SAND;
  }
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(tiles[at(x,y)]===T_WALL&&!gates.some(g=>g.cells.some(c=>c.x===x&&c.y===y)))decorations.push({x:x*TILE+24,y:y*TILE+24,type:layout.id==='canyon'||layout.id==='fortress'||biome.id==='base'||rng()>.78?'rock':'tree',variant:Math.floor(rng()*3)});
  return {seed,mission,biome,layout:{...layout},difficulty,operation:{type,...OPERATIONS[type]},tiles,huts,enemies,pickups,decorations,sites,mines,turrets,vehicles,gates,civilians,spawn,extraction:{...spawn,radius:100},cols,rows,width:cols*TILE,height:rows*TILE,bootcamp:false,parTime:Math.round((cols+rows)*2.4+enemies.length*3+(type==='clear'?20:70))};
}
export function missionStatus(map,squad){
  const alive=squad.filter(u=>u.hp>0),type=map.operation.type;
  if(type==='drill'||map.bootcamp)return {primary:false,secondary:false,won:false};
  const primary=type==='clear'?map.enemies.every(e=>e.hp<=0):type==='sabotage'?map.huts.every(h=>h.hp<=0):map.sites.every(s=>s.done);
  const secondary=type==='clear'?map.huts.every(h=>h.hp<=0):primary&&alive.length>0&&alive.every(u=>distance(u,map.extraction)<map.extraction.radius);
  return {primary,secondary,won:alive.length>0&&primary&&secondary};
}
export function updateSites(map,squad,dt){
  for(const site of map.sites){
    if(site.done)continue;
    const present=squad.some(u=>u.hp>0&&distance(u,site)<72);
    site.contested=map.enemies.some(e=>e.hp>0&&distance(e,site)<150);
    if(present&&!site.contested){site.progress=Math.min(site.required,site.progress+dt);if(site.progress>=site.required)site.done=true;}
    else if(site.progress>0)site.progress=Math.max(0,site.progress-dt*0.65);
  }
}
export function tileAt(map,x,y){
  const C=map.cols??COLS,R=map.rows??ROWS;
  const cx=Math.floor(x/TILE),cy=Math.floor(y/TILE);
  if(cx<0||cy<0||cx>=C||cy>=R)return -1;
  return map.tiles[cy*C+cx];
}
export function walkable(map,x,y,opts={}){
  const t=tileAt(map,x,y);
  if(t<0)return false;
  if(opts.fly)return t!==-1;
  return t!==T_WALL;
}
export function moveCost(map,x,y,opts={}){
  if(opts.fly)return 1;
  const t=tileAt(map,x,y);
  if(t===T_WATER)return 4.6;
  if(t===T_SAND)return 3.2;
  if(t===T_DRIFT)return 1.85;
  if(t===T_ICE)return 1.15;
  return 1;
}
export function lineClear(map,a,b){const d=distance(a,b),steps=Math.ceil(d/12);for(let i=1;i<=steps;i++){if(!walkable(map,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps))return false;}return true;}
export function findPath(map,start,end,opts={}){
  const C=map.cols??COLS,R=map.rows??ROWS;
  if(!walkable(map,start.x,start.y,opts)||!Number.isFinite(end.x)||!Number.isFinite(end.y))return [];
  const sx=Math.floor(start.x/TILE),sy=Math.floor(start.y/TILE);
  let ex=Math.max(0,Math.min(C-1,Math.floor(end.x/TILE))),ey=Math.max(0,Math.min(R-1,Math.floor(end.y/TILE)));
  if(!walkable(map,ex*TILE+24,ey*TILE+24,opts)){
    let found=false;for(let r=1;r<7&&!found;r++)for(let dy=-r;dy<=r&&!found;dy++)for(let dx=-r;dx<=r;dx++)if(walkable(map,(ex+dx)*TILE+24,(ey+dy)*TILE+24,opts)){ex+=dx;ey+=dy;found=true;break;}
    if(!found)return[];
  }
  const initial=sy*C+sx,goal=ey*C+ex;
  if(initial===goal)return[{x:ex*TILE+24,y:ey*TILE+24}];
  const open=[initial],cost=new Float32Array(C*R).fill(Infinity),parent=new Int32Array(C*R).fill(-1),closed=new Uint8Array(C*R);
  cost[initial]=0;
  const heuristic=n=>Math.hypot(n%C-ex,Math.floor(n/C)-ey);
  while(open.length){let best=0;for(let i=1;i<open.length;i++)if(cost[open[i]]+heuristic(open[i])<cost[open[best]]+heuristic(open[best]))best=i;
    const n=open.splice(best,1)[0];if(n===goal){const route=[];let cur=goal;while(cur!==initial){route.push({x:(cur%C)*TILE+24,y:Math.floor(cur/C)*TILE+24});cur=parent[cur];}route.reverse();if(!lineClear(map,start,route[0]))route.unshift({x:sx*TILE+24,y:sy*TILE+24});return route;}
    closed[n]=1;const x=n%C,y=Math.floor(n/C);
    for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const nx=x+dx,ny=y+dy;if(!walkable(map,nx*TILE+24,ny*TILE+24,opts))continue;
      if(dx&&dy&&(!walkable(map,(x+dx)*TILE+24,y*TILE+24,opts)||!walkable(map,x*TILE+24,(y+dy)*TILE+24,opts)))continue;
      const nn=ny*C+nx;if(closed[nn])continue;
      const next=cost[n]+(dx&&dy?1.414:1)*moveCost(map,nx*TILE+24,ny*TILE+24,opts);
      if(next<cost[nn]){if(cost[nn]===Infinity)open.push(nn);cost[nn]=next;parent[nn]=n;}
    }
  }return[];
}
export function moveUnit(map,unit,dt,speed){
  const flying=!!(unit.flying||unit.air);
  const t=tileAt(map,unit.x,unit.y);
  unit.swimming=!flying&&t===T_WATER;
  if(!flying&&t===T_SAND)unit.sink=(unit.sink||0)+dt*(unit.path?.length?0.4:1);
  else if(!flying&&t===T_ICE&&(unit.heavy||unit.type==='tank'))unit.sink=(unit.sink||0)+dt*0.7;
  else if(t!==T_SAND)unit.sink=0;
  let spd=speed;
  if(!flying){
    if(t===T_WATER)spd*=0.32;
    else if(t===T_SAND)spd*=0.4;
    else if(t===T_DRIFT)spd*=0.55;
  }
  if(!flying&&t===T_ICE){
    unit.vx=unit.vx||0;unit.vy=unit.vy||0;
    if(unit.path?.length){
      const p=unit.path[0],d=distance(unit,p)||1;
      unit.vx+=(p.x-unit.x)/d*240*dt;unit.vy+=(p.y-unit.y)/d*240*dt;
      unit.angle=Math.atan2(p.y-unit.y,p.x-unit.x);
      if(d<20)unit.path.shift();
    }
    const max=spd*1.35,mag=Math.hypot(unit.vx,unit.vy)||1;
    if(mag>max){unit.vx*=max/mag;unit.vy*=max/mag;}
    unit.vx*=Math.pow(0.48,dt);unit.vy*=Math.pow(0.48,dt);
    const nx=unit.x+unit.vx*dt,ny=unit.y+unit.vy*dt;
    if(walkable(map,nx,ny,{fly:flying})){unit.x=nx;unit.y=ny;}else{unit.vx*=-0.25;unit.vy*=-0.25;}
    return;
  }
  unit.vx=0;unit.vy=0;
  if(!unit.path?.length)return;
  const p=unit.path[0],d=distance(unit,p),step=spd*dt;unit.angle=Math.atan2(p.y-unit.y,p.x-unit.x);
  if(d<=step){unit.x=p.x;unit.y=p.y;unit.path.shift();}
  else{const x=unit.x+(p.x-unit.x)/d*step,y=unit.y+(p.y-unit.y)/d*step;if(walkable(map,x,y,{fly:flying})){unit.x=x;unit.y=y;}else unit.path=[];}
}
export function spawnFromHuts(map,dt){
  if(map.bootcamp)return 0;
  let spawned=0;
  const cap=map.difficulty.enemies+12;
  const alive=map.enemies.filter(e=>e.hp>0).length;
  for(const h of map.huts){
    if(h.hp<=0)continue;
    h.spawnTimer=(h.spawnTimer??5)-dt;
    if(h.spawnTimer>0||alive+spawned>=cap)continue;
    h.spawnTimer=4+Math.random()*3;
    const ang=Math.random()*Math.PI*2,p={x:h.x+Math.cos(ang)*36,y:h.y+Math.sin(ang)*28};
    const spot=walkable(map,p.x,p.y)?p:{x:h.x,y:h.y+40};
    if(!walkable(map,spot.x,spot.y))continue;
    map.enemies.push({x:spot.x,y:spot.y,home:{x:h.x,y:h.y},role:'rifle',hp:65,maxHp:65,id:map.enemies.length,cooldown:.4,angle:ang,path:[],repath:0,patrol:2,alert:4,aimTime:0,spawned:true,push:true});
    spawned++;
  }
  return spawned;
}
export function waveTarget(map,enemy){
  if(!enemy.spawned&&!enemy.push)return null;
  const hut=map.huts.find(h=>h.hp>0&&distance(h,enemy.home)<56);
  if(!hut)return null;
  return hut.choke||map.spawn;
}
export function dropTrail(unit,gap=10,max=80){
  const t=unit.trail||(unit.trail=[]);
  const last=t[0];
  if(!last||distance(unit,last)>=gap)t.unshift({x:unit.x,y:unit.y});
  if(t.length>max)t.length=max;
  return t;
}
export function followPoint(leader,index,spacing=22){
  const t=leader.trail||[],steps=Math.max(1,Math.round(spacing/10)),i=Math.min(Math.max(0,t.length-1),index*steps);
  if(t[i])return t[i];
  const a=leader.angle||0;
  return {x:leader.x-Math.cos(a)*spacing*(index+1),y:leader.y-Math.sin(a)*spacing*(index+1)};
}
export function blastGates(map,p,blast=110){
  let opened=0;
  for(const g of map.gates||[]){
    if(g.open)continue;
    if(distance(g,p)>=blast)continue;
    g.open=true;opened++;
    for(const cell of g.cells){
      const i=cell.y*(map.cols||COLS)+cell.x;
      if(map.tiles[i]===T_WALL)map.tiles[i]=T_PATH;
    }
  }
  return opened;
}
export function applyGates(map){
  for(const g of map.gates||[]){
    for(const cell of g.cells||[]){
      const i=cell.y*(map.cols||COLS)+cell.x;
      if(g.open){if(map.tiles[i]===T_WALL)map.tiles[i]=T_PATH;}
      else if(map.tiles[i]!==T_WATER)map.tiles[i]=T_WALL;
    }
  }
}
export function explosiveShotsOnMap(map){
  const crates=(map.pickups||[]).filter(p=>!p.taken&&(p.type==='grenade'||p.type==='rocket'));
  return crates.reduce((n,p)=>n+(p.type==='rocket'?2:3),0);
}
export function generateBootCamp(seed=1){
  const rng=random(seed),cols=24,rows=18,tiles=new Uint8Array(cols*rows),biome=BIOMES[0];
  const at=(x,y)=>y*cols+x,world=(x,y)=>({x:x*TILE+24,y:y*TILE+24});
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)tiles[at(x,y)]=(x<1||y<1||x>cols-2||y>rows-2||(rng()<.08&&x>3&&y>3&&x<cols-4&&y<rows-4))?T_WALL:T_PATH;
  const spawn=world(3,14),enemies=[],decorations=[];
  for(let i=0;i<8;i++){
    const p=world(8+Math.floor(rng()*10),3+Math.floor(rng()*8));
    enemies.push({...p,home:{...p},role:'dummy',hp:40,maxHp:40,id:i,cooldown:99,angle:0,path:[],repath:0,patrol:99,alert:0,aimTime:0,spawned:false,respawn:0});
  }
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(tiles[at(x,y)]===T_WALL)decorations.push({x:x*TILE+24,y:y*TILE+24,type:rng()>.7?'rock':'tree',variant:Math.floor(rng()*3)});
  const barrels=[{...world(12,6),hp:100,maxHp:100,id:0,spawnTimer:99},{...world(18,10),hp:100,maxHp:100,id:1,spawnTimer:99}];
  return {seed,mission:0,biome,layout:{id:'woodland',name:'Obóz treningowy',cols,rows,hint:'Tu też giną na zawsze. Ćwicz strzał, granat i dżip.'},
    difficulty:{level:0,enemies:8,speed:40,damage:4,fireDelay:9,awareness:80,grenades:12,rockets:4},
    operation:{type:'drill',name:'Obóz treningowy',brief:'Strzelaj do manekinów, ćwicz granaty na baryłkach i wsiądź do dżipa. Polegli nie wracają do kolejki.'},
    tiles,huts:barrels,enemies,pickups:[{...world(5,12),type:'grenade',taken:false},{...world(6,12),type:'rocket',taken:false},{...world(4,12),type:'med',taken:false}],
    decorations,sites:[],mines:[],turrets:[],
    vehicles:[{...world(5,10),id:0,type:'jeep',hp:110,maxHp:110,angle:0,occupants:[],vx:0,vy:0,path:[],flash:0,cooldown:0}],
    gates:[],civilians:[],spawn,extraction:{...spawn,radius:80},cols,rows,width:cols*TILE,height:rows*TILE,bootcamp:true,parTime:999};
}
export function respawnDummies(map,dt){
  if(!map.bootcamp)return;
  for(const e of map.enemies){
    if(e.role!=='dummy')continue;
    if(e.hp>0){e.respawn=0;continue;}
    e.respawn=(e.respawn||0)+dt;
    if(e.respawn>=2){e.hp=e.maxHp;e.x=e.home.x;e.y=e.home.y;e.respawn=0;e.path=[];}
  }
}
export function pointInPolygon(p,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if(((a.y>p.y)!==(b.y>p.y))&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y+1e-6)+a.x)inside=!inside;
  }
  return inside;
}
export function aimAssist(origin,aim,enemies,cone=.65,range=340){
  const want=Math.atan2(aim.y-origin.y,aim.x-origin.x);
  let best=null,bestDiff=cone;
  for(const e of enemies){
    if(e.hp<=0)continue;
    const d=distance(origin,e);if(d>range||d<8)continue;
    const ang=Math.atan2(e.y-origin.y,e.x-origin.x);
    const diff=Math.abs(Math.atan2(Math.sin(ang-want),Math.cos(ang-want)));
    if(diff<bestDiff){bestDiff=diff;best=e;}
  }
  return best||aim;
}
export function vehicleCapacity(type){return {jeep:2,tank:2,heli:3,turret:1}[type]||1;}
export function vehicleSpeed(type){return {jeep:210,tank:95,heli:230,turret:0}[type]||140;}
