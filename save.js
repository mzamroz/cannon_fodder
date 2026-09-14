// Bump the version when the generator or the saved gameplay schema changes.
export const SAVE_KEY='tiny-front-save';
const VERSION=1;
const stateFields=['phase','mission','score','missionStartScore','grenades','elapsed','kills','hutsDone','stars','bonus','evacReady','hutHint','camera','follow','bullets','bombs','decals'];
const soldierFields=['x','y','hp','angle','path','cooldown','kills'];
const enemyFields=['x','y','hp','angle','path','cooldown','repath','patrol','alert','aimTime'];
const pick=(object,fields)=>Object.fromEntries(fields.map(key=>[key,object[key]]));

export function encodeSave(state,map,squad){
  return JSON.stringify({version:VERSION,seed:map.seed,
    state:{...pick(state,stateFields),selected:[...state.selected]},
    squad:squad.map(u=>pick(u,soldierFields)),
    enemies:map.enemies.map(u=>pick(u,enemyFields)),
    huts:map.huts.map(h=>({hp:h.hp})),
    sites:map.sites.map(s=>pick(s,['progress','done','contested'])),
    pickups:map.pickups.map(p=>pick(p,['x','y','type','taken']))});
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
const bomb=value=>object(value,{from:point,to:point,life:number,duration:v=>number(v)&&v>0});
const decal=value=>object(value,{x:number,y:number,type:choice('crater','enemy','ally')})&&(value.type==='crater'||number(value.angle));

// Validate the entire snapshot before touching the current game. Static terrain,
// unit identities and mission rules always come from the versioned generator.
export function decodeSave(raw,generateMap){
  const data=JSON.parse(raw);
  if(!data||data.version!==VERSION||!integer(data.seed))throw new Error('Unsupported save');
  const s=data.state;
  if(!object(s,{phase:choice('briefing','playing','paused','won','lost'),mission:v=>integer(v)&&v>=1,
    score:integer,missionStartScore:integer,grenades:integer,elapsed:v=>number(v)&&v>=0,
    kills:integer,hutsDone:integer,stars:v=>integer(v)&&v<=3,bonus:integer,
    evacReady:boolean,hutHint:boolean,camera:point,follow:boolean,
    selected:list(v=>integer(v)&&v<4,4),bullets:list(bullet),bombs:list(bomb),decals:list(decal)})||
    !list(u=>object(u,{...unit,kills:integer}))(data.squad)||data.squad.length!==4||
    !list(u=>object(u,{...unit,repath:number,patrol:number,alert:number,aimTime:number}))(data.enemies)||
    !list(h=>object(h,{hp:number}))(data.huts)||
    !list(site=>object(site,{progress:v=>number(v)&&v>=0,done:boolean,contested:boolean}))(data.sites)||
    !list(p=>object(p,{x:number,y:number,type:choice('med','grenade'),taken:boolean}))(data.pickups))throw new Error('Invalid save');
  const map=generateMap(data.seed,s.mission);
  if(data.enemies.length!==map.enemies.length||data.huts.length!==map.huts.length||data.sites.length!==map.sites.length||
    s.missionStartScore>s.score||s.kills!==data.enemies.filter(e=>e.hp<=0).length||s.hutsDone!==data.huts.filter(h=>h.hp<=0).length||
    data.squad.some(u=>u.hp<0||u.hp>100)||data.enemies.some((e,i)=>e.hp>map.enemies[i].maxHp)||
    data.sites.some((site,i)=>site.progress>map.sites[i].required)||
    s.bullets.some(b=>b.owner>=(b.enemy?map.enemies.length:4)))throw new Error('Inconsistent save');
  for(const [key,fields] of [['enemies',enemyFields],['huts',['hp']],['sites',['progress','done','contested']]]){
    map[key].forEach((entry,i)=>Object.assign(entry,pick(data[key][i],fields)));
  }
  map.pickups=data.pickups.map(p=>pick(p,['x','y','type','taken']));
  return {map,state:{...pick(s,stateFields),selected:new Set(s.selected)},squad:data.squad.map(u=>pick(u,soldierFields))};
}
