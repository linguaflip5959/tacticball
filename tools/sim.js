#!/usr/bin/env node
/* =====================================================================
   sim.js — Монте-Карло «ТАКТИК-БОЛ» · Node 14+, без зависимостей
   Модель: docs/MODEL.md + баланс Э3 + фикс «ИИ пасует вперёд».
   Запуск:  node tools/sim.js        → 10 000 матчей на сложность
            node tools/sim.js 2000   → 2 000 (быстрый прогон)
   ===================================================================== */
'use strict';

const CFG={
  N:parseInt(process.argv[2]||'10000',10),
  AI_ACT_AFTER_MOVE:true,
  PASS_PRESS_MIN:1,   // носитель пасует только при давлении ≥ N врагов
};

const COLS=9, ROWS=12; let TPH=4;


const DIFFS=[
  {n:'ДВОР',mul:1.0,gk:-0.9,aiReroll:0,boost:-1},
  {n:'ЛИГА',mul:1.6,gk:0.0, aiReroll:1,boost:0},
  {n:'ПРО', mul:2.4,gk:1.0, aiReroll:2,boost:1},
];
const BASE=[[3,3,2,4],[4,3,3,3],[3,4,3,3],[4,3,4,2],[5,2,5,2]]; // [СКР,ПАС,УДР,ОТБ]
const FORM=[[4,1],[2,3],[6,3],[3,5],[5,5]];

const F={ // формулы post-Э3 — ручки «следующих рычагов»
  passBase:4, passDist:0.7, passStat:0.6, passPress:0.9,
  shotBase:5, shotDist:0.85, shotStat:0.75, shotAngle:0.55, shotPress:0.9,
  tackBase:6.5, tackHold:0.5, tackOwn:0.7,
  shotZone:5.2, passRangeK:2, passRangeM:0.6, rubber:0.8, pressCost:1,
};
// переопределения из CLI: node tools/sim.js 10000 tackBase=7.5 pressCost=0
process.argv.slice(3).forEach(s=>{ const p=s.split('=');
  if(p[1]!==undefined){ if(p[0] in F) F[p[0]]=parseFloat(p[1]);
    else if(p[0]==='TPH') TPH=parseInt(p[1]); } });

const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);
const rint=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const rh=t=>Math.round(t*2)/2;
const d6=()=>1+Math.floor(Math.random()*6);
const key=(x,y)=>x+','+y;

function mkSquad(team,boost){
  return BASE.map((b,i)=>({team,idx:i,
    st:[clamp(b[0]+boost,1,7),clamp(b[1]+boost,1,7),clamp(b[2]+boost,1,7),clamp(b[3]+boost,1,7)],
    gx:0,gy:0,acted:false,injured:false,mSpent:0,hasBall:false}));
}
function initMatch(di){
  return {diff:DIFFS[di],half:1,halfTurn:0,turnTeam:null,over:false,
    scoreMe:0,scoreAi:0,rubber:0,meRerolls:2,aiRerolls:DIFFS[di].aiReroll,
    units:[...mkSquad('me',0),...mkSquad('ai',DIFFS[di].boost)],
    ball:{gx:4,gy:6,holder:null,onGround:true},
    st:{passA:0,passOK:0,shotA:0,goal:0,tackA:0,tackOK:0,inj:0,turns:0,emptyTurns:0,rolls:0}};
}

/* ---------- мяч и поле ---------- */
function giveBall(S,u){ for(const q of S.units)q.hasBall=false;
  if(u){u.hasBall=true;S.ball={gx:u.gx,gy:u.gy,holder:u,onGround:false};} }
function dropBall(S,x,y){ for(const q of S.units)q.hasBall=false;
  S.ball={gx:clamp(x,0,COLS-1),gy:clamp(y,0,ROWS-1),holder:null,onGround:true}; }
function injure(S,u){ if(u.hasBall)dropBall(S,u.gx,u.gy);
  u.injured=true;u.acted=true;u.hasBall=false;S.st.inj++; }
function adjEnemies(S,team,x,y){ let n=0;
  for(const e of S.units) if(e.team!==team&&!e.injured&&Math.abs(e.gx-x)<=1&&Math.abs(e.gy-y)<=1)n++;
  return n; }
function place(S){
  for(const u of S.units){ const p=FORM[u.idx];
    u.gx=p[0]; u.gy=(u.team==='me')?(ROWS-1-p[1]):p[1];
    u.acted=false; u.mSpent=0; u.hasBall=false; } }
function kickoff(S,team){
  place(S);
  const mx=Math.floor(COLS/2),my=Math.floor(ROWS/2);
  const healthy=S.units.filter(u=>u.team===team&&!u.injured);
  let u=healthy.find(q=>q.gx===mx&&q.gy===my)
       || healthy.sort((a,b)=>dist(a.gx,a.gy,mx,my)-dist(b.gx,b.gy,mx,my))[0]
       || S.units.find(q=>q.team===team);
  const free=S.units.find(q=>!q.injured&&q!==u&&q.gx===mx&&q.gy===my);
  if(free){ const tx=u.gx,ty=u.gy; u.gx=free.gx;u.gy=free.gy;free.gx=tx;free.gy=ty; }
  giveBall(S,u);
}

/* ---------- формулы ---------- */
const rubberTerm=(S,team)=>S.rubber*(team==='me'?1:-1);
const goalY=team=>(team==='me')?-0.5:ROWS-0.5;
const inZone=(x,y,team)=>dist(x,y,4,goalY(team))<=F.shotZone;
function passTarget(S,u,m){
  const d=dist(u.gx,u.gy,m.gx,m.gy);
  let t=F.passBase+d*F.passDist-u.st[1]*F.passStat
        +adjEnemies(S,u.team,u.gx,u.gy)*F.passPress-rubberTerm(S,u.team);
  return rh(clamp(t,3,12));
}
function shotTarget(S,u){
  const d=dist(u.gx,u.gy,4,goalY(u.team));
  let t=F.shotBase+d*F.shotDist-u.st[2]*F.shotStat+Math.abs(u.gx-4)*F.shotAngle
        +adjEnemies(S,u.team,u.gx,u.gy)*F.shotPress
        +(u.team==='me'?1:-1)*S.diff.gk-rubberTerm(S,u.team);
  return rh(clamp(t,3,12));
}
function tackTarget(S,u,c){
  let t=F.tackBase+c.st[3]*F.tackHold-u.st[3]*F.tackOwn-rubberTerm(S,u.team);
  return rh(clamp(t,3,12));
}

/* ---------- броски и перебросы ---------- */
function rollOnce(target){ const a=d6(),b=d6();
  const fum=(a===1&&b===1), crit=(a===6&&b===6);
  return {ok:crit?true:(fum?false:(a+b>=target)),fum,sum:a+b}; }
function roll(S,team,target){
  let r=rollOnce(target);
  while(!r.ok){
    const stock=(team==='me')?S.meRerolls:S.aiRerolls;
    const chance=(team==='me')?1:0.55;
    if(stock>0&&Math.random()<chance){
      if(team==='me')S.meRerolls--;else S.aiRerolls--;
      r=rollOnce(target);
    } else break;
  }
  return r;
}

/* ---------- движение (дейкстра с бюджетом) ---------- */
function moveMap(S,u){
  const budget=Math.max(0,u.st[0]-u.mSpent);
  const cost=new Map([[key(u.gx,u.gy),0]]), prev=new Map();
  const pq=[{c:0,x:u.gx,y:u.gy}];
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
  while(pq.length){
    pq.sort((a,b)=>a.c-b.c);
    const cur=pq.shift();
    if(cur.c>(cost.get(key(cur.x,cur.y))??1e9))continue;
    for(const d of DIRS){
      const nx=cur.x+d[0],ny=cur.y+d[1];
      if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;
      if(S.units.find(q=>!q.injured&&q!==u&&q.gx===nx&&q.gy===ny))continue;
      let step=1;
      for(const e of S.units){
        if(e.team===u.team||e.injured)continue;
        if(Math.abs(e.gx-nx)<=1&&Math.abs(e.gy-ny)<=1&&!(e.gx===nx&&e.gy===ny)){step+=F.pressCost;break;}
      }
      const nc=cur.c+step;
      if(nc>budget)continue;
      const k=key(nx,ny);
      if(nc<(cost.get(k)??1e9)){cost.set(k,nc);prev.set(k,key(cur.x,cur.y));pq.push({c:nc,x:nx,y:ny});}
    }
  }
  const out=new Map();
  cost.delete(key(u.gx,u.gy));
  for(const [k,c] of cost){
    const path=[];let cur=k;
    while(cur){const p=cur.split(',');path.unshift([+p[0],+p[1]]);cur=prev.get(cur);}
    path.shift();                                  // стартовую клетку — с пути (P1-6)
    out.set(k,{cost:c,path});
  }
  return out;
}
function walk(S,u,path){
  for(const [x,y] of path){
    u.gx=x;u.gy=y;
    if(S.ball.holder===u){S.ball.gx=x;S.ball.gy=y;}
    else if(S.ball.onGround&&S.ball.gx===x&&S.ball.gy===y){giveBall(S,u);}
  }
}

/* ---------- действия ---------- */
function doShoot(S,u){
  S.st.shotA++;S.st.rolls++;u.acted=true;
  if(roll(S,u.team,shotTarget(S,u)).ok){
    S.st.goal++; if(u.team==='me')S.scoreMe++;else S.scoreAi++;
    return 'goal';
  }
  const x=(u.team==='me')?clamp(u.gx+rint(-1,1),0,COLS-1):u.gx;  // асимметрия из кода
  dropBall(S,x,(u.team==='me')?1:ROWS-2);
  return 'turnover';
}
function doPass(S,u,m){
  S.st.passA++;S.st.rolls++;u.acted=true;
  if(roll(S,u.team,passTarget(S,u,m)).ok){S.st.passOK++;giveBall(S,m);return 'ok';}
  const D8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
  const d=D8[Math.floor(Math.random()*(u.team==='me'?8:6))];     // асимметрия из кода
  dropBall(S,m.gx+d[0],m.gy+d[1]);
  return 'turnover';
}
function doTackle(S,u,c){
  S.st.tackA++;S.st.rolls++;u.acted=true;
  const r=roll(S,u.team,tackTarget(S,u,c));
  if(r.ok){S.st.tackOK++;giveBall(S,u);return 'ok';}
  if(r.sum<=3)injure(S,u);        // И3: неудачный отбор с суммой ≤3 — травма
  return 'turnover';
}

/* ---------- мозг (один, зеркальный; направление-зависимый) ---------- */
function bestPass(S,u){
  const team=u.team, me=(team==='me'), gY=goalY(team);
  const range=F.passRangeK+u.st[1]*F.passRangeM;
  let best=null,bs=-1e9;
  for(const m of S.units){
    if(m.team!==team||m.injured||m===u)continue;
    if(dist(u.gx,u.gy,m.gx,m.gy)>range)continue;
    const pt=passTarget(S,u,m);
    const sc=(me?(ROWS-m.gy):m.gy)*0.6-pt*1.2-adjEnemies(S,team,m.gx,m.gy)*1.5;
    if(sc>bs){bs=sc;best={m,pt};}
  }
  return best;
}
function tryAct(S,u){ // удар/пас, если условия — возвращает результат или null
  if(u.hasBall&&inZone(u.gx,u.gy,u.team)&&Math.random()<0.85){
    if(shotTarget(S,u)<=7.5)return doShoot(S,u);
  }
  if(u.hasBall){
    const b=bestPass(S,u);
    const press=adjEnemies(S,u.team,u.gx,u.gy);
    const dGoal=dist(u.gx,u.gy,4,goalY(u.team));
    if(b&&b.pt<=8&&press>=CFG.PASS_PRESS_MIN&&Math.random()<0.8)return doPass(S,u,b.m);
  }
  return null;
}
function actUnit(S,u){
  const team=u.team, me=(team==='me'), gY=goalY(team);
  const pre=tryAct(S,u);
  if(pre)return pre;
  const carrier=u.hasBall;
  const mm=moveMap(S,u);
  let target=null,bt=-1e9;
  for(const [k,v] of mm){
    const gx=+k.split(',')[0],gy=+k.split(',')[1];
    let s;
    if(carrier){
      s=-dist(gx,gy,4,gY)*2.2+(inZone(gx,gy,team)?6:0)
        -adjEnemies(S,team,gx,gy)*1.6-v.cost*0.25;
    }else{
      const h=S.ball.holder;
      if(h&&h.team===team){
        s=-dist(gx,gy,4,gY)*1.2-dist(gx,gy,h.gx,h.gy)*0.5-adjEnemies(S,team,gx,gy)*1.2;
      }else if(h){
        const dh=dist(gx,gy,h.gx,h.gy);
        s=-dh*2.6+((dh<=1.4)?4:0)-Math.abs(gy-(me?1:ROWS-2))*0.2;
      }else{
        s=-dist(gx,gy,S.ball.gx,S.ball.gy)*3;
      }
      s-=v.cost*0.2;
    }
    if(s>bt){bt=s;target=v;}
  }
  if(target&&target.path.length){u.mSpent+=target.cost;walk(S,u,target.path);}
  u.acted=true;
  // «сдвинуться и сыграть»: человеку всегда, ИИ — по флагу (Находка №2)
  if((me||CFG.AI_ACT_AFTER_MOVE)&&!u.injured){
    const post=tryAct(S,u);
    if(post)return post;
  }
  const h=S.ball.holder;
  if(h&&h.team!==team&&!u.injured&&Math.abs(h.gx-u.gx)<=1&&Math.abs(h.gy-u.gy)<=1&&Math.random()<0.8){
    return doTackle(S,u,h);
  }
  return 'ok';
}

/* ---------- ход матча ---------- */
function teamTurn(S){
  const team=S.turnTeam, st=S.st;
  S.halfTurn++; st.turns++;
  if(S.halfTurn===TPH+1)S.half=2;
  S.rubber=(S.half===2)?((S.scoreMe<S.scoreAi)?F.rubber:((S.scoreAi<S.scoreMe)?-F.rubber:0)):0;
  for(const u of S.units)if(u.team===team){u.acted=false;u.mSpent=0;}
  const rollsBefore=st.rolls;
  const order=S.units.filter(u=>u.team===team&&!u.injured)
    .sort((a,b)=>((b.hasBall?1:0)-(a.hasBall?1:0)));
  for(const u of order){
    if(u.acted||u.injured)continue;
    const res=actUnit(S,u);
    if(res==='goal'||res==='turnover'){
      if(st.rolls===rollsBefore)st.emptyTurns++;
      if(S.halfTurn>=TPH*2){S.over=true;return;}
      S.turnTeam=(team==='me')?'ai':'me';
      if(res==='goal')kickoff(S,S.turnTeam);   // гол «съедает» слот хода
      return;
    }
  }
  if(st.rolls===rollsBefore)st.emptyTurns++;
  if(S.halfTurn>=TPH*2){S.over=true;return;}
  S.turnTeam=(team==='me')?'ai':'me';
}
function playMatch(di){
  const S=initMatch(di);
  S.turnTeam='me';
  kickoff(S,'me');
  while(!S.over)teamTurn(S);
  return S;
}

/* ---------- агрегатор и вывод ---------- */
function playBlock(N,di){
  const A={win:0,draw:0,loss:0,gMe:0,gAi:0,hist:new Array(11).fill(0),
    passA:0,passOK:0,shotA:0,goal:0,tackA:0,tackOK:0,inj:0,turns:0,empty:0,coins:0,streak:0};
  for(let i=0;i<N;i++){
    const S=playMatch(di);
    const me=S.scoreMe,ai=S.scoreAi;
    A.gMe+=me;A.gAi+=ai;A.hist[Math.min(me+ai,10)]++;
    if(me>ai){A.win++;A.streak++;}else if(me===ai){A.draw++;A.streak=0;}else{A.loss++;A.streak=0;}
    A.coins+=Math.round(((me>ai?120:(me===ai?60:25))+me*35+((A.streak>1&&me>ai)?A.streak*15:0))*S.diff.mul);
    A.passA+=S.st.passA;A.passOK+=S.st.passOK;A.shotA+=S.st.shotA;A.goal+=S.st.goal;
    A.tackA+=S.st.tackA;A.tackOK+=S.st.tackOK;A.inj+=S.st.inj;
    A.turns+=S.st.turns;A.empty+=S.st.emptyTurns;
  }
  return A;
}
const pct=(v,n)=>(100*v/Math.max(n,1)).toFixed(1)+'%';
function printBlock(name,A,N){
  console.log(name.padEnd(5)+' | вин '+pct(A.win,N)+' · ничь '+pct(A.draw,N)+' · пор '+pct(A.loss,N)
    +' | голы '+(A.gMe/N).toFixed(2)+' : '+(A.gAi/N).toFixed(2)+' (тотал '+((A.gMe+A.gAi)/N).toFixed(2)+')');
  console.log('     | пас '+pct(A.passOK,A.passA)+' · удар '+pct(A.goal,A.shotA)+' · отбор '+pct(A.tackOK,A.tackA)
    +' · травм/м '+(A.inj/N).toFixed(2)+' · пуст.ходов '+pct(A.empty,A.turns)
    +' · монет/м '+Math.round(A.coins/N));
  console.log('     | тотал голов: '+A.hist.map((v,i)=>i+(i===10?'+':'')+':'+pct(v,N)).join(' ')+'\n');
}
function fullMaxCost(){
  let c=0;
  for(const p of BASE)for(const lvl of p)for(let l=lvl;l<6;l++)c+=Math.round(60*Math.pow(l,1.4));
  return c;
}
function main(){
  console.log('====== ТАКТИК-БОЛ · Монте-Карло ======');
  console.log('N='+CFG.N+' на сложность · AI_ACT_AFTER_MOVE='+CFG.AI_ACT_AFTER_MOVE
    +(CFG.AI_ACT_AFTER_MOVE?' (ИИ ходит и играет)':' (ИИ как в игре сейчас)'));
  console.log('Модель: пост-Э3 (угол 0.55, давление 0.9, отбор 6.5) + фикс «ИИ пасует вперёд»\n');
  const avg=[];
  for(let di=0;di<DIFFS.length;di++){
    const A=playBlock(CFG.N,di);
    printBlock(DIFFS[di].n,A,CFG.N);
    avg.push(A.coins/CFG.N);
  }
  const cost=fullMaxCost();
  console.log('Полная прокачка состава: '+cost+' монет');
  DIFFS.forEach((d,i)=>console.log('  до «шестёрок у всех» ≈ '+Math.round(cost/avg[i])
    +' матчей ('+d.n+', награда '+Math.round(avg[i])+'/м)'));
}
main();