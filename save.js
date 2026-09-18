export const SAVE_KEY='tiny-front-save';
const VERSION=2;
const stateFields=['phase','mission','score','missionStartScore','grenades','rockets','elapsed','kills','hutsDone','stars','bonus','evacReady','hutHint','camera','follow','bullets','bombs','decals','deaths'];
const soldierFields=['x','y','hp','angle','path','cooldown','kills','name','rank','recruitId','group','vehicleId','vx','vy','sink'];
const enemyFields=['x','y','hp','angle','path','cooldown','repath','patrol','alert','aimTime','role','home','maxHp','id','spawned'];
const pick=(object,fields)=>Object.fromEntries(fields.map(key=>[key,object[key]]));

export function encodeSave(state,map,squad){
  return JSON.stringify({version:VERSION,seed:map.seed,
    state:{...pick(state,stateFields),selected:[...state.selected]},
    squad:squad.map(u=>pick(u,soldierFields)),
    enemies:map.enemies.map(u=>pick(u,enemyFields)),
    huts:map.huts.map(h=>({hp:h.hp,spawnTimer:h.spawnTimer??8})),
    sites:map.sites.map(s=>pick(s,['progress','done','contested'])),
    pickups:map.pickups.map(p=>pick(p,['x','y','type','taken'])),
    mines:(map.mines||[]).map(m=>pick(m,['x','y','kind','armed','exploded','reveal'])),
    turrets:(map.turrets||[]).map(t=>pick(t,['x','y','id','hp','cooldown','angle'])),
    vehicles:(map.vehicles||[]).map(v=>pick(v,['x','y','id','type','hp','angle','occupants','path','vx','vy','cooldown'])),
    campaign:state.campaign});
}

const number=value=>typeof value==='number'&&Number.isFinite(value);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const boolean=value=>typeof value==='boolean';
const choice=(...values)=>value=>values.includes(value);
const object=(value,schema)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(schema).every(([key,check])=>check(value[key]));
const list=(check,max=10000)=>value=>Array.isArray(value)&&value.length<=max&&value.every(check);
const point=value=>object(value,{x:number,y:number});
const unit={x:number,y:number,hp:number,angle:number,path:list(point,4096),cooldown:number};
const bullet=value=>object(value,{x:number,y:number,vx:number,vy:number,enemy:boolean,life:number,damage:number,owner:integer});
const bomb=value=>object(value,{from:point,to:point,life:number,duration:v=>number(v)&&v>0})&&(value.kind===undefined||choice('grenade','rocket')(value.kind));
const decal=value=>object(value,{x:number,y:number,type:choice('crater','enemy','ally')})&&(value.type==='crater'||number(value.angle));
const recruit=value=>object(value,{id:integer,name:v=>typeof v==='string'&&v.length>0&&v.length<=24,rank:v=>integer(v)&&v<=7,dead:boolean});
const grave=value=>object(value,{name:v=>typeof v==='string',rank:v=>integer(v)&&v<=7,mission:v=>integer(v)&&v>=1});
const campaign=value=>object(value,{roster:v=>list(recruit,360)(v)&&v.length===360,graves:list(grave,360)});

export function decodeSave(raw,generateMap){
  const data=JSON.parse(raw);
  if(!data||data.version!==VERSION||!integer(data.seed))throw new Error('Unsupported save');
  const s=data.state;
  if(!object(s,{phase:choice('briefing','playing','paused','won','lost','over'),mission:v=>integer(v)&&v>=1,
    score:integer,missionStartScore:integer,grenades:integer,rockets:integer,elapsed:v=>number(v)&&v>=0,
    kills:integer,hutsDone:integer,stars:v=>integer(v)&&v<=3,bonus:integer,deaths:integer,
    evacReady:boolean,hutHint:boolean,camera:point,follow:boolean,
    selected:list(v=>integer(v)&&v<4,4),bullets:list(bullet),bombs:list(bomb),decals:list(decal)})||
    !campaign(data.campaign)||
    !list(u=>object(u,{...unit,kills:integer,name:v=>typeof v==='string',rank:v=>integer(v)&&v<=7,recruitId:integer,group:integer,vehicleId:v=>v===null||integer(v),vx:number,vy:number,sink:number}))(data.squad)||data.squad.length!==4||
    !list(u=>object(u,{x:number,y:number,hp:number,angle:number,path:list(point,4096),cooldown:number,repath:number,patrol:number,alert:number,aimTime:number}))(data.enemies)||
    data.enemies.length<1||
    !list(h=>object(h,{hp:number,spawnTimer:v=>number(v)&&v>=0}))(data.huts)||
    !list(site=>object(site,{progress:v=>number(v)&&v>=0,done:boolean,contested:boolean}))(data.sites)||
    !list(p=>object(p,{x:number,y:number,type:choice('med','grenade','rocket'),taken:boolean}))(data.pickups)||
    !list(m=>object(m,{x:number,y:number,kind:choice('mine','bamboo'),armed:boolean,exploded:boolean,reveal:number}))(data.mines||[])||
    !list(t=>object(t,{x:number,y:number,id:integer,hp:number,cooldown:number,angle:number}))(data.turrets||[])||
    !list(v=>object(v,{x:number,y:number,id:integer,type:choice('jeep','tank','heli','turret'),hp:number,angle:number,occupants:list(integer,4),path:list(point,4096),vx:number,vy:number,cooldown:number}))(data.vehicles||[]))
    throw new Error('Invalid save');
  const map=generateMap(data.seed,s.mission);
  const baseEnemies=map.enemies.length;
  if(data.enemies.length<baseEnemies||data.huts.length!==map.huts.length||data.sites.length!==map.sites.length||
    s.missionStartScore>s.score||s.hutsDone!==data.huts.filter(h=>h.hp<=0).length||
    data.squad.some(u=>u.hp<0||u.hp>100)||data.enemies.some(e=>e.hp>120)||
    data.sites.some((site,i)=>site.progress>map.sites[i].required)||
    s.bullets.some(b=>b.owner>=(b.enemy?data.enemies.length:4))||
    data.squad.some(u=>u.recruitId>=360||data.campaign.roster[u.recruitId]?.dead&&u.hp>0))throw new Error('Inconsistent save');
  const killed=data.enemies.filter(e=>e.hp<=0).length;
  if(s.kills!==killed)throw new Error('Inconsistent save');
  map.enemies=data.enemies.map((e,i)=>{
    const base=map.enemies[i]||{role:'rifle',maxHp:65,home:{x:e.x,y:e.y},id:i,spawned:true};
    return Object.assign({},base,pick(e,['x','y','hp','angle','path','cooldown','repath','patrol','alert','aimTime']));
  });
  map.huts.forEach((h,i)=>Object.assign(h,pick(data.huts[i],['hp','spawnTimer'])));
  map.sites.forEach((site,i)=>Object.assign(site,pick(data.sites[i],['progress','done','contested'])));
  map.pickups=data.pickups.map(p=>pick(p,['x','y','type','taken']));
  if(data.mines)map.mines=data.mines.map(m=>({...m,reveal:1}));
  if(data.turrets)map.turrets=data.turrets.map((t,i)=>Object.assign({},map.turrets[i]||{maxHp:80,flash:0},t));
  if(data.vehicles)map.vehicles=data.vehicles.map((v,i)=>Object.assign({},map.vehicles[i]||{maxHp:v.hp,flash:0},v));
  return {map,state:{...pick(s,stateFields),selected:new Set(s.selected),campaign:data.campaign},squad:data.squad.map(u=>pick(u,soldierFields))};
}
