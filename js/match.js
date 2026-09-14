/* =====================================================================
   match.js — MatchScene: ядро матча (поле, ходы, кубики, ИИ)
   ===================================================================== */
import {COLS,ROWS,TPH,DIFFS,FORMS,NAMES,POSN,BASE_SQUAD,clamp,lerp,rint,rnd,pick,hex,dist,key,$} from './utils.js';
import {SFX} from './sfx.js';
import {VKB} from './bridge.js';
import {Save} from './save.js';
import {UI} from './ui.js';
import {Game} from './game.js';

const MY=0x39c2ff, AI=0xff4d6d;
export class MatchScene extends Phaser.Scene{
 constructor(){super('match');}

 create(){
  this.units=[]; this.sel=null; this.phase='menu'; this.turnTeam='me';
  this.fxL=this.add.container(0,0).setDepth(70);
  this.ground=this.add.graphics().setDepth(-10);
  this.cells=this.add.graphics().setDepth(-6);
  this.ballSpr=this.add.image(0,0,'ball').setDepth(40);
  this.ballGlow=this.add.image(0,0,'glow').setDepth(39).setAlpha(.5).setTint(0xffe680);
  this.unitLayer=this.add.container(0,0).setDepth(20);
  this.confetti=this.add.particles(0,0,'dot',{speed:{min:90,max:330},angle:{min:200,max:340},
    scale:{start:.55,end:0},alpha:{start:1,end:0},lifespan:950,gravityY:520,emitting:false}).setDepth(65);
  this.dust=this.add.particles(0,0,'dot',{speed:{min:20,max:90},scale:{start:.45,end:0},
    alpha:{start:.6,end:0},lifespan:420,gravityY:200,emitting:false}).setDepth(41);

    this.layout();
  this.drawStadium();                                   // P0-2: поле рисуем сами, а не «когда повезёт с resize»
  this.input.on('pointerdown',this.onTap,this);
  this._onResize=()=>{ this.layout(); this.drawStadium(); this.redrawUnits(); this.syncSprites(true); };
  this.scale.on('resize',this._onResize);
  this.events.on('shutdown',()=>{ this.input.off('pointerdown',this.onTap,this);
    this.scale.off('resize',this._onResize); });        // P0-3: снимаем слушатель — иначе течка при каждом рестарте
  Game.syncHud();
 }

 /* ---------- геометрия ---------- */
 layout(){
  const W=this.scale.width,H=this.scale.height,L=this.L={};
  L.W=W; L.H=H;
  const topPad=H*0.135, botPad=H*0.215;
  const availW=W*.965, availH=Math.max(180,H-topPad-botPad);
  L.cs=Math.floor(Math.min(availW/COLS, availH/ROWS));
  L.gw=L.cs*COLS; L.gh=L.cs*ROWS;
  L.ox=Math.floor((W-L.gw)/2);
  L.oy=Math.floor(topPad+(availH-L.gh)/2);
  L.oy=clamp(L.oy,Math.floor(H*.10),Math.floor(H*.80-L.gh));
 }
 cx(gx){return this.L.ox+this.L.cs*(gx+.5);}
 cy(gy){return this.L.oy+this.L.cs*(gy+.5);}
 cellAt(x,y){ const L=this.L;
  const gx=Math.floor((x-L.ox)/L.cs), gy=Math.floor((y-L.oy)/L.cs);
  return (gx<0||gy<0||gx>=COLS||gy>=ROWS)?null:{gx,gy}; }

 drawStadium(){
  const g=this.ground,W=this.L.W,H=this.L.H; g.clear();
  // фон-трибуны
  g.fillStyle(0x0b1a2b,1); g.fillRect(0,0,W,H);
  let seed=1234; const R=()=>{seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff;};
  for(let i=0;i<2600;i++){
    const x=R()*W,y=R()*H;
    if(x>this.L.ox-14&&x<this.L.ox+this.L.gw+14&&y>this.L.oy-14&&y<this.L.oy+this.L.gh+14)continue;
    const pal=[0xff5d5d,0xffd23f,0x5dd0ff,0xffffff,0x7bffa8,0xff9bd0,0xc3a2ff];
    g.fillStyle(pal[Math.floor(R()*7)],.5+R()*.4); g.fillCircle(x,y,1.3+R()*1.4);
  }
  g.fillStyle(0x000000,.35); g.fillRect(0,0,W,H*.09); g.fillRect(0,H*.9,W,H*.1);
  // рекламные борта вокруг поля
  const bx=this.L.ox-11,by=this.L.oy-11,bw=this.L.gw+22,bh=this.L.gh+22;
  g.fillStyle(0x0a1a13,1); g.fillRoundedRect(bx-4,by-4,bw+8,bh+8,10);
  const cols=[0x2fe07a,0xffcf3f,0x39c2ff,0xff4d6d,0xa06bff];
  const seg=10;
  for(let i=0;i<seg;i++){ const c=cols[i%5];
    g.fillStyle(c,.85); g.fillRoundedRect(bx+(bw/seg)*i+2,by-3,bw/seg-4,7,3);
    g.fillStyle(c,.85); g.fillRoundedRect(bx+(bw/seg)*i+2,by+bh-4,bw/seg-4,7,3); }
  for(let i=0;i<Math.floor(bh/26);i++){ const c=cols[(i+2)%5];
    g.fillStyle(c,.7); g.fillRoundedRect(bx-3,by+i*26+3,7,22,3);
    g.fillStyle(c,.7); g.fillRoundedRect(bx+bw-4,by+i*26+3,7,22,3); }
  // газон
  const px=this.L.ox,py=this.L.oy,pw=this.L.gw,ph=this.L.gh;
  for(let r=0;r<ROWS;r++){ g.fillStyle(r%2?0x2ea24c:0x27913f,1); g.fillRect(px,py+r*this.L.cs,pw,this.L.cs); }
  g.fillStyle(0xffffff,.045); g.fillTriangle(px,py,px+pw,py,px+pw,py+ph);
  g.fillStyle(0x000000,.10); g.fillRect(px,py,pw*.12,ph); g.fillRect(px+pw*.88,py,pw*.12,ph);
  // разметка
  const ln=(x1,y1,x2,y2,w)=>{ g.lineStyle(w||2,0xffffff,.72); g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.strokePath(); };
  g.lineStyle(2.5,0xffffff,.75); g.strokeRect(px+1,py+1,pw-2,ph-2);
  ln(px,py+ph/2,px+pw,py+ph/2,2.5);
  g.lineStyle(2.5,0xffffff,.75); g.strokeCircle(px+pw/2,py+ph/2,this.L.cs*1.35);
  g.fillStyle(0xffffff,.8); g.fillCircle(px+pw/2,py+ph/2,3.2);
  // штрафные
  const bw2=this.L.cs*5, bh2=this.L.cs*2.6, sw=this.L.cs*3, sh=this.L.cs*1.2;
  g.strokeRect(px+(pw-bw2)/2,py,bw2,bh2); g.strokeRect(px+(pw-bw2)/2,py+ph-bh2,bw2,bh2);
  g.strokeRect(px+(pw-sw)/2,py,sw,sh);   g.strokeRect(px+(pw-sw)/2,py+ph-sh,sw,sh);
  g.fillStyle(0xffffff,.8); g.fillCircle(px+pw/2,py+bh2*.72,3); g.fillCircle(px+pw/2,py+ph-bh2*.72,3);
  // ворота
  const gw=this.L.cs*3, gh=this.L.cs*.62;
  const goal=(yy,dir)=>{
    const x0=px+(pw-gw)/2;
    g.fillStyle(0x06170f,.6); g.fillRect(x0,dir<0?yy-gh:yy,gw,gh);
    g.lineStyle(1,0xffffff,.28);
    const st=Math.max(6,this.L.cs*.28);
    for(let x=x0;x<=x0+gw;x+=st){ g.beginPath(); g.moveTo(x,dir<0?yy-gh:yy); g.lineTo(x,dir<0?yy:yy+gh); g.strokePath(); }
    for(let i=1;i<4;i++){ const y=(dir<0?yy-gh:yy)+ (gh/4)*i; g.beginPath(); g.moveTo(x0,y); g.lineTo(x0+gw,y); g.strokePath(); }
    g.lineStyle(4,0xfdfdfd,1); g.strokeRect(x0-2,dir<0?yy-gh:yy,gw+4,gh);
    g.lineStyle(5,0xffffff,.85); g.beginPath(); g.moveTo(x0-2,yy); g.lineTo(x0+gw+2,yy); g.strokePath();
  };
  goal(py,-1); goal(py+ph,1);
 }

 /* ---------- юниты ---------- */
 makeUnits(){
  this.units.forEach(u=>u.spr&&u.spr.destroy());
  this.units=[];
  const form=FORMS.find(f=>f.id===Save.d.form)||FORMS[0];
  for(let t=0;t<2;t++){
   for(let i=0;i<5;i++){
    const st=t===1?Save.d.squad[i]:this.aiStats(i);
    const u={team:t?'ai':'me',idx:i,num:i+1,name:t?['ЗУБ','БРОНЯ','ТАРА́Н','КОПЫТО','ГРОМ'][i]:NAMES[i],
      pos:POSN[i],                                              // P4: было t?POSN[i]:POSN[i]
      st:{spd:st.spd,pas:st.pas,sht:st.sht,tkl:st.tkl},
      acted:false,injured:false,hasBall:false,gx:0,gy:0,spr:null};
    this.units.push(u);
   }
  }
  this.units.forEach(u=>this.buildSprite(u));
  this.placeFormation(form);
 }
 aiStats(i){
  const boost=Save.d.diff===2?1:(Save.d.diff===0?-1:0);
  const o={}; for(const k in BASE_SQUAD[i]) o[k]=clamp(BASE_SQUAD[i][k]+boost,1,7);
  return o;
 }
 buildSprite(u){
  const L=this.L, c=this.add.container(0,0);
  const sh=this.add.image(0,L.cs*.30,'shadow').setDisplaySize(L.cs*.86,L.cs*.34).setAlpha(.5);
  const ring=this.add.graphics();
  const body=this.add.image(0,0,'token').setDisplaySize(L.cs*.80,L.cs*.80).setTint(u.team==='me'?MY:AI);
  const num=this.add.text(0,0,String(u.num),{fontFamily:'Russo One, sans-serif',
    fontSize:Math.round(L.cs*.34)+'px',color:'#ffffff',stroke:'rgba(0,0,0,.55)',strokeThickness:3}).setOrigin(.5);
  const mark=this.add.text(0,-L.cs*.44,'',{fontSize:Math.round(L.cs*.30)+'px'}).setOrigin(.5);
  c.add([sh,ring,body,num,mark]);
  this.unitLayer.add(c);
  u.spr=c; u.body=body; u.ring=ring; u.numT=num; u.mark=mark; u.sh=sh;
  u.tintCol=u.team==='me'?MY:AI;
 }
 redrawUnits(){
  const L=this.L;
  this.units.forEach(u=>{ if(!u.spr)return;
    u.sh.setPosition(0,L.cs*.30).setDisplaySize(L.cs*.86,L.cs*.34);
    u.body.setDisplaySize(L.cs*.80,L.cs*.80);
    // P0-1 FIX: было .setStrokeThickness(3) — такого метода нет в Phaser 3.80
    u.numT.setFontSize(Math.round(L.cs*.34)).setStroke('rgba(0,0,0,.55)',3);
    u.mark.setFontSize(Math.round(L.cs*.30)).setPosition(0,-L.cs*.44);
    this.drawRing(u);
  });
  this.ballSpr.setDisplaySize(L.cs*.46,L.cs*.46);
  this.ballGlow.setDisplaySize(L.cs*1.5,L.cs*1.5);
 }
 drawRing(u){
  const L=this.L,g=u.ring; g.clear();
  const r=L.cs*.44;
  if(u.hasBall){ g.lineStyle(3,0xffe066,1); g.strokeCircle(0,0,r);
    g.lineStyle(1.5,0xffe066,.45); g.strokeCircle(0,0,r+4); }
  if(this.sel===u){ g.lineStyle(3,0xffffff,1); g.strokeCircle(0,0,r+7);
    g.fillStyle(0xffffff,.10); g.fillCircle(0,0,r+7); }
  if(u.injured){ g.lineStyle(2.5,0xff4d6d,.9); g.strokeCircle(0,0,r-2); }
 }
 placeFormation(form){
  this.units.forEach(u=>{
    const p=form.pos[u.idx];
    u.gx=p[0];
    u.gy = u.team==='me' ? (ROWS-1-p[1]) : p[1];
    u.acted=false; u.hasBall=false; u.mSpent=0;              // P2: бюджет обнуляем, травму НЕ лечим
    u.spr.setAlpha(u.injured?.42:1); u.mark.setText(u.injured?'🩹':'');
    u.spr.setPosition(this.cx(u.gx),this.cy(u.gy)); this.drawRing(u);   // P4: без объекта-посредника
  });
 }
  syncSprites(instant){
  this.units.forEach(u=>{ if(!u.spr)return; const x=this.cx(u.gx),y=this.cy(u.gy);
    if(instant)u.spr.setPosition(x,y); });
  const b=this.ball;
  if(b){ this.placeBall(b.gx,b.gy,instant); }                // P4: пустой if-артефакт срезан
 }
 anyAt(gx,gy){ return this.units.find(u=>u.gx===gx&&u.gy===gy&&!u.injured); }   // P4: unitAt-близнец уволен

 /* ---------- мяч ---------- */
 placeBall(gx,gy,instant){
  const x=this.cx(gx),y=this.cy(gy);
  this.ballGlow.setPosition(x,y);
  if(instant){ this.ballSpr.setPosition(x,y-this.L.cs*.12); return; }
  this.ballSpr.setPosition(x,y-this.L.cs*.12);
 }
 giveBall(u){
  this.units.forEach(x=>{ if(x.hasBall){x.hasBall=false; this.drawRing(x);} });
  if(u){ u.hasBall=true; this.ball={gx:u.gx,gy:u.gy,holder:u,onGround:false}; this.drawRing(u);
    this.placeBall(u.gx,u.gy,true); }
  else { this.ball.onGround=true; this.ball.holder=null; this.placeBall(this.ball.gx,this.ball.gy); }
 }
 dropBall(gx,gy){ this.ball={gx,gy,holder:null,onGround:true};
  this.units.forEach(x=>{x.hasBall=false;this.drawRing(x);}); this.placeBall(gx,gy); }

 /* ---------- подсветка ---------- */
 highlight(map,color,fill){
  const g=this.cells,L=this.L; g.clear();
  const pad=L.cs*.08;
  map.forEach((v,k)=>{ const p=k.split(','); const x=L.ox+L.cs*(+p[0]),y=L.oy+L.cs*(+p[1]);
    g.fillStyle(color,fill===undefined?.26:fill); g.fillRoundedRect(x+pad,y+pad,L.cs-pad*2,L.cs-pad*2,L.cs*.16);
    g.lineStyle(2,color,.85); g.strokeRoundedRect(x+pad,y+pad,L.cs-pad*2,L.cs-pad*2,L.cs*.16);
  });
 }
 clearHi(){ this.cells.clear(); }

 /* ---------- движение (дейкстра) ---------- */
 moveMap(u){
  const L=this.L,budget=Math.max(0,u.st.spd-(u.mSpent||0)), start={gx:u.gx,gy:u.gy};   // P2-10: СКР = бюджет на ход
  const cost=new Map([[key(start.gx,start.gy),0]]);
  const prev=new Map(); const pq=[{gx:start.gx,gy:start.gy,c:0}];
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  while(pq.length){
    pq.sort((a,b)=>a.c-b.c); const cur=pq.shift();
    if(cur.c>(cost.get(key(cur.gx,cur.gy))??1e9))continue;
    for(const d of dirs){
      const nx=cur.gx+d[0],ny=cur.gy+d[1];
      if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;
      const occ=this.anyAt(nx,ny); if(occ&&occ!==u)continue;
      let step=1;
      // зона прессинга: клетка рядом с соперником дороже
      for(const e of this.units){ if(e.team===u.team||e.injured)continue;
        if(Math.abs(e.gx-nx)<=1&&Math.abs(e.gy-ny)<=1&&!(e.gx===nx&&e.gy===ny)){ step+=1; break; } }
      const nc=cur.c+step; if(nc>budget)continue;
      const k=key(nx,ny);
      if(nc<(cost.get(k)??1e9)){ cost.set(k,nc); prev.set(k,{gx:cur.gx,gy:cur.gy}); pq.push({gx:nx,gy:ny,c:nc}); }
    }
  }
  cost.delete(key(start.gx,start.gy));
  const out=new Map();
  cost.forEach((c,k)=>{ // восстанавливаем путь
    const path=[]; let cur=k;
    while(cur){ const p=cur.split(','); path.unshift({gx:+p[0],gy:+p[1]}); const pr=prev.get(cur); cur=pr?key(pr.gx,pr.gy):null; }
    path.shift();                                  // P1-6: сносим стартовую клетку — не было «шага на месте»
    out.set(k,{cost:c,path});
  });
  return out;
 }
 walk(u,path,cb){
  this.phase='anim'; let i=0;
  const stepFn=()=>{
    if(i>=path.length){ this.syncBallHolder(u); cb&&cb(); return; }
    const c=path[i++]; u.gx=c.gx; u.gy=c.gy;
    const x=this.cx(c.gx),y=this.cy(c.gy);
    SFX.step();
    this.tweens.add({targets:u.body,y:-this.L.cs*.16,duration:60,yoyo:true});
    this.tweens.add({targets:u.spr,x,y,duration:105,ease:'Sine.easeInOut',onComplete:()=>{
      this.syncBallHolder(u);
      if(this.ball&&this.ball.onGround&&this.ball.gx===u.gx&&this.ball.gy===u.gy&&!u.injured){
        this.giveBall(u); UI.toast((u.team==='me'?'⚽ ':'🔴 ')+u.name+' подобрал мяч'); SFX.coin();
        this.dust.emitParticleAt(x,y+this.L.cs*.3,8);
      }
      stepFn();
    }});
  };
  stepFn();
 }
 syncBallHolder(u){ if(this.ball&&this.ball.holder===u){ this.ball.gx=u.gx; this.ball.gy=u.gy; this.placeBall(u.gx,u.gy,true);} }

 /* ---------- кубики ---------- */
 roll(cfg){
  // cfg={label,target,mod,rerollable,cb}
  const W=this.scale.width,H=this.scale.height;
  this.phase='anim';
  this.fxL.removeAll(true);
  const dim=this.add.graphics(); dim.fillStyle(0x000000,.42); dim.fillRect(0,0,W,H); this.fxL.add(dim);
  const lab=this.add.text(W/2,H*.335,cfg.label,{fontFamily:'Russo One, sans-serif',
    fontSize:Math.round(Math.min(26,W*.055))+'px',color:'#fff',stroke:'#000',strokeThickness:5,align:'center'}).setOrigin(.5).setAlpha(0);
  this.fxL.add(lab);
  const need=this.add.text(W/2,H*.395,'нужно '+(cfg.target-Math.round(cfg.mod*10)/10)+' на 2d6  (мод '+(cfg.mod>=0?'+':'')+Math.round(cfg.mod*10)/10+')',
    {fontFamily:'Rubik, sans-serif',fontSize:Math.round(Math.min(15,W*.034))+'px',color:'#ffe9a8',stroke:'#000',strokeThickness:4}).setOrigin(.5).setAlpha(0);
  this.fxL.add(need);
  const s=Math.min(74,W*.17);
  const d1=this.add.image(W/2-s*.62,H*.50,'dice1').setDisplaySize(s,s).setAlpha(0);
  const d2=this.add.image(W/2+s*.62,H*.50,'dice1').setDisplaySize(s,s).setAlpha(0);
  this.fxL.add([d1,d2]);
  const res=this.add.text(W/2,H*.605,'',{fontFamily:'Russo One, sans-serif',fontSize:Math.round(Math.min(30,W*.065))+'px',
    color:'#fff',stroke:'#000',strokeThickness:6}).setOrigin(.5).setAlpha(0);
  this.fxL.add(res);
  this.tweens.add({targets:[lab,need],alpha:1,duration:180});
  this.tweens.add({targets:[d1,d2],alpha:1,scale:{from:.3,to:s/92},duration:200,ease:'Back.easeOut'});
  const iv=this.time.addEvent({delay:75,repeat:8,callback:()=>{
    d1.setTexture('dice'+rint(1,6)); d2.setTexture('dice'+rint(1,6));
    d1.setAngle(rnd(-22,22)); d2.setAngle(rnd(-22,22)); SFX.dice(); }});
  this.time.delayedCall(780,()=>{
    const v1=rint(1,6),v2=rint(1,6);
    d1.setTexture('dice'+v1); d2.setTexture('dice'+v2); d1.setAngle(0); d2.setAngle(0);
    const dbl=v1===v2, total=v1+v2+(cfg.mod||0);
    let ok = dbl&&v1===6 ? true : (dbl&&v1===1 ? false : total>=cfg.target);
    const sum=v1+v2;
    res.setText(sum+' + '+(Math.round((cfg.mod||0)*10)/10)+' = '+Math.round(total*10)/10);
    this.tweens.add({targets:res,alpha:1,y:H*.615,duration:200});
    const verdict=this.add.text(W/2,H*.675,
      (dbl&&v1===6)?'💥 КРИТ! УСПЕХ':(dbl&&v1===1)?'💀 КАТАСТРОФА!':(ok?'✅ УСПЕХ':'❌ ПРОВАЛ'),
      {fontFamily:'Russo One, sans-serif',fontSize:Math.round(Math.min(26,W*.058))+'px',
       color:(dbl&&v1===6)?'#c6ff4f':(ok?'#8dffa8':'#ff9bb0'),stroke:'#000',strokeThickness:6}).setOrigin(.5).setAlpha(0);
    this.fxL.add(verdict);
    this.tweens.add({targets:verdict,alpha:1,scale:{from:.5,to:1},duration:230,ease:'Back.easeOut'});
    SFX.tone(ok?700:260,.2,'square',.12,ok?1100:140);
    this.time.delayedCall(1050,()=>{
      this.fxL.removeAll(true);
      if(!ok&&cfg.rerollable&&this.canReroll()) { this.offerReroll(cfg,{v1,v2,sum,total,dbl,ok}); }
      else cfg.cb(ok,{v1,v2,sum,total,dbl,crit:dbl&&v1===6,fumble:dbl&&v1===1});
    });
  });
 }
 canReroll(){ return this.rerollFree>0||this.rerollAd<2; }
 offerReroll(cfg,info){                                       // P4: v1,v2,ok — уволены
  this.phase='reroll';
  const p=$('rr'); $('rr-n').textContent=this.rerollFree;
  $('rr-free').style.display=this.rerollFree>0?'flex':'none';
  $('rr-free').disabled=this.rerollFree<=0;
  $('rr-ad').style.display=(this.rerollAd<2&&Game.adsReady)?'flex':'none';   // VK: кнопка — только при готовой рекламе
  $('rr-info').innerHTML=cfg.label+' — провал. <b>Потеря хода!</b><br>Перебросить кубики?';
  p.classList.add('on');
  const close=()=>{ p.classList.remove('on'); $('rr-free').onclick=null; $('rr-ad').onclick=null; $('rr-accept').onclick=null; };
  $('rr-free').onclick=()=>{ if(this.rerollFree<=0)return; this.rerollFree--; close(); SFX.ui();
    VKB.track('reroll_free',1); Game.syncHud(); this.roll(cfg); };
  $('rr-ad').onclick=()=>{ close(); SFX.ui();
    Game.ad('reroll').then(g=>{ if(g){ this.rerollAd++; this.rerollFree++; UI.toast('🎲 Переброс получен!',true); Game.syncHud(); this.roll(cfg); }
      else { UI.toast('Ролик не досмотрен','red'); cfg.cb(false,info); } }); };
  $('rr-accept').onclick=()=>{ close(); SFX.ui(); cfg.cb(false,info); };
 }

 /* ---------- выбор и команды ---------- */
 onTap(ptr){
  if(this.phase!=='idle'&&this.phase!=='target')return;
  if(UI.any()||$('rr').classList.contains('on'))return;
  const c=this.cellAt(ptr.x,ptr.y); if(!c)return;
  if(this.phase==='target'){ this.handleTarget(c.gx,c.gy); return; }
  const u=this.anyAt(c.gx,c.gy);
  if(u&&u.team==='me'&&!u.acted){ this.select(u); return; }
  if(this.sel&&this.moveCells&&this.moveCells.has(key(c.gx,c.gy))){
    const m=this.moveCells.get(key(c.gx,c.gy));
    const u2=this.sel; this.clearHi();
    u2.mSpent=(u2.mSpent||0)+m.cost;                          // P2-10: списываем бюджет
    this.walk(u2,m.path,()=>{ this.phase='idle'; this.select(u2); SFX.ui(); });
    return;
  }
  this.deselect();
 }
 select(u){
  this.sel=u; this.phase='idle';
  this.moveCells = (u.acted||u.injured)?new Map():this.moveMap(u);
  this.targetMode=null;
  this.highlightTargets();
  Game.syncCard(u);
  this.units.forEach(x=>this.drawRing(x));
  SFX.ui();
 }
 deselect(){ this.sel=null; this.moveCells=null; this.targetMode=null; this.clearHi();
  this.units.forEach(x=>this.drawRing(x)); Game.syncCard(null); }
highlightTargets(){
  if(!this.sel){this.clearHi();return;}
  if(this.moveCells&&this.moveCells.size) this.highlight(this.moveCells,0x2fe07a,.22);
 }
 canShoot(u){
  const goalRow=u.team==='me'?-0.5:ROWS-0.5;
  const d=Math.hypot(u.gx-(COLS-1)/2,u.gy-goalRow);
  return d<=5.2;
 }
  shootTarget(u){
  const goalRow=u.team==='me'?-0.5:ROWS-0.5;
  const d=Math.hypot(u.gx-(COLS-1)/2,u.gy-goalRow);
  const angle=Math.abs(u.gx-(COLS-1)/2)*.55;
  const press=this.pressure(u);
  let t=5+d*.85-u.st.sht*.75+angle+press*.9;    // БАЛАНС: угол 0.275→0.55, давление 0.7→0.9
  const D=DIFFS[Save.d.diff];
  if(u.team==='me') t+=D.gk; else t-=D.gk;
  if(this.rubber) t-= this.rubber*(u.team==='me'?1:-1);
  return {t:clamp(Math.round(t*2)/2,3,12),d};
 }
 passTarget(u,t){
  const d=dist(u.gx,u.gy,t.gx,t.gy);
  const t2=4+d*.7-u.st.pas*.6+this.pressure(u)*.9 - (this.rubber||0)*(u.team==='me'?1:-1);
  return {t:clamp(Math.round(t2*2)/2,3,12),d};
 }
  tackTarget(u,c){
  const t2=6.5+c.st.tkl*.5-u.st.tkl*.7 - (this.rubber||0)*(u.team==='me'?1:-1);   // P2b: база 5→6.5
  return {t:clamp(Math.round(t2*2)/2,3,12)};
 }
 pressure(u){ let n=0; for(const e of this.units){ if(e.team!==u.team&&!e.injured&&Math.abs(e.gx-u.gx)<=1&&Math.abs(e.gy-u.gy)<=1)n++; } return n; }
 passRange(u){ return 2+u.st.pas*.6; }

 /* ---------- действия игрока ---------- */
  actPass(){
  const u=this.sel; if(!u||u.acted)return;
  this.phase='target'; this.targetMode='pass';
  const map=new Map();
  this.units.forEach(t=>{ if(t.team==='me'&&!t.injured&&t!==u&&dist(u.gx,u.gy,t.gx,t.gy)<=this.passRange(u))
    map.set(key(t.gx,t.gy),1); });
  this.passMap=map;
  const g=this.cells; g.clear();
  map.forEach((v,k)=>{ const p=k.split(','); const x=this.L.ox+this.L.cs*(+p[0]),y=this.L.oy+this.L.cs*(+p[1]);
    g.fillStyle(0x39c2ff,.24); g.fillRoundedRect(x+3,y+3,this.L.cs-6,this.L.cs-6,this.L.cs*.16);
    g.lineStyle(2.5,0x9be8ff,.95); g.strokeRoundedRect(x+3,y+3,this.L.cs-6,this.L.cs-6,this.L.cs*.16); });
  UI.toast('Выбери кому пасовать (синие клетки)');
  Game.syncCard(u);
 }
 actTackle(){
  const u=this.sel; if(!u||u.acted)return;
  this.phase='target'; this.targetMode='tackle';
  const map=new Map();
  this.units.forEach(t=>{ if(t.team==='ai'&&!t.injured&&t.hasBall&&Math.abs(t.gx-u.gx)<=1&&Math.abs(t.gy-u.gy)<=1) map.set(key(t.gx,t.gy),1); });
  this.tackMap=map;
  const g=this.cells; g.clear();
  map.forEach((v,k)=>{ const p=k.split(','); const x=this.L.ox+this.L.cs*(+p[0]),y=this.L.oy+this.L.cs*(+p[1]);
    g.fillStyle(0xff4d6d,.3); g.fillRoundedRect(x+3,y+3,this.L.cs-6,this.L.cs-6,this.L.cs*.16);
    g.lineStyle(2.5,0xffb3c1,.95); g.strokeRoundedRect(x+3,y+3,this.L.cs-6,this.L.cs-6,this.L.cs*.16); });
  UI.toast('Выбери соперника для отбора','red');
 }
 handleTarget(gx,gy){
  const u=this.sel,k=key(gx,gy);
  if(this.targetMode==='pass'){
    if(!this.passMap||!this.passMap.has(k)){ this.cancelTarget(); return; }
    const t=this.units.find(x=>x.gx===gx&&x.gy===gy&&x.team==='me');
    this.cancelTarget(); this.doPass(u,t);
  } else if(this.targetMode==='tackle'){
    if(!this.tackMap||!this.tackMap.has(k)){ this.cancelTarget(); return; }
    const t=this.units.find(x=>x.gx===gx&&x.gy===gy);
    this.cancelTarget(); this.doTackle(u,t);
  }
 }
 cancelTarget(){ this.targetMode=null; this.highlightTargets(); this.phase='idle'; if(this.sel)Game.syncCard(this.sel); }

 doPass(u,t){
  const pt=this.passTarget(u,t);
  SFX.kick();
  this.roll({label:'📤 ПАС · '+u.name+' → '+t.name, target:pt.t, mod:0, rerollable:u.team==='me',
   cb:(ok,info)=>{
    u.acted=true; this.markActed(u);
    this.animateBall(u.gx,u.gy,t.gx,t.gy,ok,()=>{
      if(ok){ this.giveBall(t); UI.toast('📤 Пас точен!'); this.afterAction(); }
      else { this.fumblePass(u,t); }
    });
   }});
 }
 fumblePass(u,t){
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
  const d=pick(dirs), gx=clamp(t.gx+d[0],0,COLS-1), gy=clamp(t.gy+d[1],0,ROWS-1);   // P1-7: одно направление на обе оси
  this.animateBall(u.gx,u.gy,gx,gy,false,()=>{
    const who=this.anyAt(gx,gy);
    this.dropBall(gx,gy);
    UI.toast(who?('⚡ Перехват! '+who.name):'💨 Мяч ушёл в сторону!','red');
    VKB.track('turnover_pass',1);
    this.turnover(who?'Перехват!':'Пас не дошёл!');
  });
 }
 doShoot(u){
  if(!u.hasBall){UI.toast('Мяч не у этого игрока','red');return;}
  const st=this.shootTarget(u);
  SFX.kick();
  this.roll({label:'🥅 УДАР · '+u.name+' ('+st.d.toFixed(1)+' кл.)',target:st.t,mod:0,rerollable:u.team==='me',
   cb:(ok,info)=>{
    u.acted=true; this.markActed(u);
    const goalRow=u.team==='me'?-1:ROWS;
    const tx=(COLS-1)/2+rnd(-1,1), ty=goalRow;
    this.animateBall(u.gx,u.gy,tx,ty,ok,()=>{
      if(ok||info.crit) this.scoreGoal(u.team,u);
      else { SFX.fail(); UI.toast('🧤 Вратарь забирает!','red'); VKB.track('shot_saved',1);
        this.dropBall(clamp(u.gx+rint(-1,1),0,COLS-1), u.team==='me'?1:ROWS-2);   // P2-15: было rnd(-1,1)|0 — почти всегда 0
        this.turnover('Удар отражён!'); }
    });
   }});
 }
 doTackle(u,c){
  const tt=this.tackTarget(u,c);
  SFX.tackle();
  this.roll({label:'🛡️ ОТБОР · '+u.name+' vs '+c.name,target:tt.t,mod:0,rerollable:u.team==='me',
   cb:(ok,info)=>{
    u.acted=true; this.markActed(u);
    this.tweens.add({targets:u.spr,x:this.cx(c.gx)+(this.cx(u.gx)-this.cx(c.gx))*.55,
      y:this.cy(c.gy)+(this.cy(u.gy)-this.cy(u.gy))*.55,duration:130,yoyo:true,ease:'Quad.easeOut'});
    this.cameras.main.shake(140,.008);
    this.dust.emitParticleAt(this.cx(c.gx),this.cy(c.gy)+this.L.cs*.3,12);
    if(ok){ this.giveBall(u); UI.toast('🛡️ Отбор! Мяч у «'+u.name+'»',true); VKB.track('tackle_win',1);
      this.afterAction(); }
    else {
      if(info.fumble){ this.injure(u); UI.toast('💀 '+u.name+' получает травму!','red'); VKB.track('injury',1); }
      this.turnover('Отбор не удался!');
    }
   }});
 }
  injure(u){ if(u.hasBall)this.dropBall(u.gx,u.gy);   // P1-8: сначала мяч на землю, потом флаги — проверка всегда была false
  u.injured=true; u.acted=true; u.hasBall=false;
  u.spr.setAlpha(.42); u.mark.setText('🩹'); this.drawRing(u); SFX.fail(); }
 markActed(u){ if(u.injured){u.mark.setText('🩹');return;} u.mark.setText(u.acted?'💤':'');
  u.spr.setAlpha(u.acted?.62:1); this.drawRing(u); }

 animateBall(fx,fy,tx,ty,ok,cb){
  const L=this.L;
  const x0=this.cx(fx),y0=this.cy(fy),x1=this.cx(tx),y1=this.cy(ty);
  const holder=this.ball&&this.ball.holder;
  if(holder){holder.hasBall=false;this.drawRing(holder);}
  this.ball={gx:fx,gy:fy,holder:null,onGround:false};
  const obj={x:x0,y:y0-L.cs*.12,t:0};
  const dur=clamp(dist(x0,y0,x1,y1)*2.4,260,700);
  SFX.kick();
  this.tweens.add({targets:obj,t:1,duration:dur,ease:'Sine.easeIn',
    onUpdate:()=>{ const p=obj.t;
      this.ballSpr.setPosition(lerp(x0,x1,p), lerp(y0,y1,p)-Math.sin(Math.PI*p)*L.cs*1.1);
      this.ballGlow.setPosition(lerp(x0,x1,p), lerp(y0,y1,p)-Math.sin(Math.PI*p)*L.cs*1.1);
      this.ballSpr.setAngle(p*720*(ok?1:-1));
      this.ballSpr.setDisplaySize(L.cs*(.46-.10*Math.sin(Math.PI*p)),L.cs*(.46-.10*Math.sin(Math.PI*p)));
    },
    onComplete:()=>{ this.ballSpr.setDisplaySize(L.cs*.46,L.cs*.46); cb&&cb(); }});
 }

  scoreGoal(team){
  const L=this.L;
  if(team==='me')this.scoreMe++; else this.scoreAi++;
  SFX.goal(); this.cameras.main.shake(280,.014); this.cameras.main.flash(200,255,240,150);
  this.confetti.emitParticleAt(L.W/2,L.oy+(team==='me'?0:L.gh),46);
  this.bigText(team==='me'?'ГОООЛ!':'ГОЛ В ТВОИ ВОРОТА',team==='me'?0x2fe07a:0xff4d6d);
  VKB.track('goal_'+team,1);
  Game.syncHud();
  this.phase='anim';
  this.time.delayedCall(1500,()=>{
    if(this.halfTurn>=TPH*2){ this.endMatch(); return; }
    this.kickoff(team==='me'?'ai':'me');
  });
 }

 /* ---------- ход / матч ---------- */
  startMatch(){
  this.scoreMe=0; this.scoreAi=0; this.half=1; this.halfTurn=0; this.turnsLost=0;
  this.rerollFree=2; this.rerollAd=0; this.docUsed=false; this.x2Used=false; this.shared=false;
  this.rubber=0;
  this.makeUnits(); this.redrawUnits();
  SFX.init(); SFX.resume(); SFX.whistle();
  this.bigText('ТАЙМ 1',0x39c2ff);
  VKB.track('match_start',Save.d.diff+1);
  this.time.delayedCall(900,()=>this.kickoff('me'));
 }
 kickoff(team){
  const form=FORMS.find(f=>f.id===Save.d.form)||FORMS[0];
  this.placeFormation(form);
  this.units.forEach(u=>{u.acted=false;u.spr.setAlpha(u.injured?.42:1);u.mark.setText(u.injured?'🩹':'');this.drawRing(u);});   // P2-12: травмы переживают гол
  this.sel=null; this.clearHi(); Game.syncCard(null);
  // мяч в центр, владеет начинающая команда
  const mid={gx:Math.floor(COLS/2),gy:Math.floor(ROWS/2)};
  const u=this.units.find(x=>x.team===team&&!x.injured&&x.gx===mid.gx&&x.gy===mid.gy)
        || this.units.filter(x=>x.team===team&&!x.injured).sort((a,b)=>dist(a.gx,a.gy,mid.gx,mid.gy)-dist(b.gx,b.gy,mid.gx,mid.gy))[0]
        || this.units.find(x=>x.team===team);   // страховка: если вся команда в лазарете — не падаем
  const free=this.anyAt(mid.gx,mid.gy);
  if(free&&free!==u){ // меняем местами
    const tg={gx:u.gx,gy:u.gy}; u.gx=free.gx; u.gy=free.gy; free.gx=tg.gx; free.gy=tg.gy;
  }
  this.giveBall(u);
  this.syncSprites(true);
  this.dust.emitParticleAt(this.cx(mid.gx),this.cy(mid.gy),10);
  this.startTurn(team);
 }
 startTurn(team){
  this.turnTeam=team; this.halfTurn++;
  if(this.halfTurn===TPH+1){ this.half=2; this.bigText('ТАЙМ 2',0xffcf3f); SFX.whistle(); }
  if(this.half===2) this.rubber=(this.scoreMe<this.scoreAi)?0.8:((this.scoreAi<this.scoreMe)?-0.8:0);   // P2-14: пересчёт каждый ход
  this.units.forEach(u=>{ if(u.team===team){ u.acted=false; u.mSpent=0; if(!u.injured){u.spr.setAlpha(1);u.mark.setText('');} this.drawRing(u);} });
  Game.syncHud();
  if(team==='ai'){ this.phase='ai'; this.sel=null; this.clearHi(); Game.syncCard(null);
    UI.toast('🔴 Ход «Бульдогов»…','red');
    this.time.delayedCall(700,()=>this.aiTurn()); }
  else { this.phase='idle'; UI.toast('🔵 Твой ход — выбери игрока'); }
 }
 actionsLeft(){ return this.units.filter(u=>u.team==='me'&&!u.acted&&!u.injured).length; }
 afterAction(){
  Game.syncHud(); this.deselect();
  if(this.actionsLeft()===0){ this.time.delayedCall(450,()=>this.endTurn()); }
  else { this.phase='idle'; UI.toast('Осталось действий: '+this.actionsLeft()); }
 }
 endTurn(){
  if(this.phase==='over')return;
  this.sel=null; this.clearHi(); Game.syncCard(null);
  if(this.halfTurn>=TPH*2){ this.endMatch(); return; }
  this.startTurn(this.turnTeam==='me'?'ai':'me');
 }
 turnover(reason){
  if(this.turnTeam==='me')this.turnsLost++;   // P2-11: в статистику — только свои потери
  VKB.track('turnover',1);
  UI.toast('⚠️ '+reason+' Смена хода.','red'); SFX.fail();
  this.sel=null; this.clearHi(); Game.syncCard(null);
  this.phase='anim';
  this.time.delayedCall(1100,()=>{ if(this.halfTurn>=TPH*2)this.endMatch(); else this.endTurn(); });
 }
 endMatch(){
  this.phase='over'; SFX.whistle();
  const me=this.scoreMe,ai=this.scoreAi;
  const win=me>ai, draw=me===ai;
  Save.d.matches++;
  if(win){Save.d.wins++;Save.d.streak++;Save.d.bestStreak=Math.max(Save.d.bestStreak,Save.d.streak);}
  else if(draw){Save.d.draws++;Save.d.streak=0;}
  else {Save.d.losses++;Save.d.streak=0;}
  Save.d.goals+=me;
  const D=DIFFS[Save.d.diff];
  let coins=Math.round(((win?120:draw?60:25)+me*35+ (Save.d.streak>1&&win?Save.d.streak*15:0))*D.mul);
  Save.d.coins+=coins; Save.write();
  this.lastCoins=coins; this.lastWin=win; this.lastDraw=draw;
  $('r-title').textContent=win?'🏆 ПОБЕДА!':draw?'🤝 НИЧЬЯ':'😤 ПОРАЖЕНИЕ';
  $('r-sub').textContent=win?'«Барсуки» рвут лигу!':draw?'Равная игра — дожми в следующий раз':'Соперник оказался хитрее';
  $('r-score').innerHTML='<span style="color:#39c2ff">'+me+'</span> : <span style="color:#ff4d6d">'+ai+'</span>';
  $('r-goals').textContent=me; $('r-turns').textContent=this.turnsLost;
  $('r-diff').textContent=D.n; $('r-coins').textContent='+'+coins;
  $('r-rec').style.display=(win&&Save.d.streak>=3)?'block':'none';
  $('btn-x2').style.display=(this.x2Used||!Game.adsReady)?'none':'flex'; $('btn-x2').disabled=coins<=0;
  $('btn-share').style.display=this.shared?'none':'flex';
  VKB.track('match_end',me*10+ai);
  UI.show('sc-result');
  Game.syncHud();
 }
 bigText(txt,color){
  const W=this.scale.width,H=this.scale.height;
  const t=this.add.text(W/2,H*.44,txt,{fontFamily:'Russo One, sans-serif',
    fontSize:Math.round(Math.min(40,W*.085))+'px',color:'#fff',stroke:hex(color),strokeThickness:9,
    shadow:{offsetX:0,offsetY:5,color:'#000',blur:12,fill:true}}).setOrigin(.5).setDepth(80);
  t.setScale(.3).setAlpha(0);
  this.tweens.add({targets:t,scale:1,alpha:1,duration:220,ease:'Back.easeOut'});
  this.tweens.add({targets:t,y:H*.42,duration:300,delay:240,yoyo:true});
  this.tweens.add({targets:t,alpha:0,scale:1.1,duration:380,delay:1150,onComplete:()=>t.destroy()});
 }

 /* ---------- ИИ ---------- */
 aiTurn(){
  if(this.phase==='over')return;
  const order=this.units.filter(u=>u.team==='ai'&&!u.injured)
    .sort((a,b)=>(b.hasBall?100:0)-(a.hasBall?100:0));
  const D=DIFFS[Save.d.diff];
  this.aiRerolls=D.aiReroll;
  let i=0;
  const next=()=>{
    if(this.phase==='over')return;
    if(i>=order.length||this.turnTeam!=='ai'){ this.endTurn(); return; }
    const u=order[i++];
    if(u.acted||u.injured){ next(); return; }
    this.aiAct(u,next);
  };
  next();
 }
 aiAct(u,next){
  const goalRow=ROWS-0.5;
  const carrier=u.hasBall;
  const shoot=this.canShoot(u)&&carrier;
  const st=shoot?this.shootTarget(u):null;
  const press=this.pressure(u);
  const dGoal=Math.hypot(u.gx-(COLS-1)/2,u.gy-goalRow);
  if(carrier&&shoot&&st.t<=7.5&&Math.random()<.85){
    this.aiRoll('🥅 УДАР · '+u.name,st.t,0,(ok,info)=>{
      u.acted=true; this.markActed(u);
      this.animateBall(u.gx,u.gy,(COLS-1)/2+rnd(-1,1),ROWS,ok,()=>{
        if(ok||info.crit){ this.scoreGoal('ai',u); }
        else { this.dropBall(clamp(u.gx,0,COLS-1),ROWS-2); UI.toast('🧤 Твой вратарь тащит!','gold');
          this.time.delayedCall(700,()=>{ if(this.phase!=='over')this.endTurn(); }); }
      });
    });
    return;
  }
  if(carrier){
    // пас лучшему партнёру
    const mates=this.units.filter(x=>x.team==='ai'&&!x.injured&&x!==u&&dist(u.gx,u.gy,x.gx,x.gy)<=this.passRange(u));
    const best=mates.map(m=>({m,pt:this.passTarget(u,m),score:0}))
       .map(o=>{ o.score=o.m.gy*0.6 - o.pt.t*1.2 - this.pressure(o.m)*1.5; return o; })   // ИИ-ФИКС: пас ВПЕРЁД
      .sort((a,b)=>b.score-a.score)[0];
    if(best&&best.pt.t<=8&&press>0&&Math.random()<.8){   // ИИ-ФИКС: без прессинга носитель БЕЖИТ
      this.aiRoll('📤 ПАС · '+u.name+' → '+best.m.name,best.pt.t,0,(ok)=>{
        u.acted=true; this.markActed(u);
        this.animateBall(u.gx,u.gy,best.m.gx,best.m.gy,ok,()=>{
          if(ok){ this.giveBall(best.m); UI.toast('🔴 Пас «Бульдогов» точен','red'); this.time.delayedCall(420,next); }
          else { this.fumbleAI(u,best.m); }
        });
      });
      return;
    }
  }
  // перемещение
  const mm=this.moveMap(u);
  let target=null;
  if(carrier){
    let bs=-1e9;
    mm.forEach((v,k)=>{ const p=k.split(','); const gx=+p[0],gy=+p[1];
      const d=Math.hypot(gx-(COLS-1)/2,gy-goalRow);
      let s=-d*2.2 + (this.canShootAt(gx,gy)?6:0) - this.pressureAt(gx,gy,'ai')*1.6 - v.cost*.25;
      if(s>bs){bs=s;target=v;} });
  } else {
    const ballU=this.ball&&this.ball.holder;
    let bs=-1e9;
    mm.forEach((v,k)=>{ const p=k.split(','); const gx=+p[0],gy=+p[1];
      let s=0;
      if(ballU&&ballU.team==='ai'){ // поддержка атаки
        s=-Math.hypot(gx-(COLS-1)/2,gy-goalRow)*1.2 - dist(gx,gy,ballU.gx,ballU.gy)*.5 - this.pressureAt(gx,gy,'ai')*1.2;
      } else if(ballU){ // прессинг
        s=-dist(gx,gy,ballU.gx,ballU.gy)*2.6 + (dist(gx,gy,ballU.gx,ballU.gy)<=1.4?4:0) - Math.abs(gy-(ROWS-2))*.2;
      } else { s=-dist(gx,gy,this.ball.gx,this.ball.gy)*3; }
      s-=v.cost*.2;
      if(s>bs){bs=s;target=v;} });
  }
  if(!target||!target.path||!target.path.length){ u.acted=true; this.markActed(u); this.time.delayedCall(220,next); return; }
  this.walk(u,target.path,()=>{
        // ИИ-ФИКС: «сдвинуться и сыграть» — как человек. Сначала удар, потом пас.
    if(u.hasBall&&!u.injured&&this.canShoot(u)){
      const st2=this.shootTarget(u);
      if(st2.t<=7.5&&Math.random()<.85){
        this.aiRoll('🥅 УДАР · '+u.name,st2.t,0,(ok,info)=>{
          this.animateBall(u.gx,u.gy,(COLS-1)/2+rnd(-1,1),ROWS,ok,()=>{
            if(ok||info.crit){ this.scoreGoal('ai',u); }
            else { this.dropBall(clamp(u.gx,0,COLS-1),ROWS-2); UI.toast('🧤 Твой вратарь тащит!','gold');
              this.time.delayedCall(700,()=>{ if(this.phase!=='over')this.endTurn(); }); }
          });
        });
        return;
      }
    }
    if(u.hasBall&&!u.injured){
      const mates=this.units.filter(x=>x.team==='ai'&&!x.injured&&x!==u&&dist(u.gx,u.gy,x.gx,x.gy)<=this.passRange(u));
      let best2=null,bs=-1e9;
      mates.forEach(m=>{ const pt=this.passTarget(u,m);
        const sc=m.gy*.6-pt.t*1.2-this.pressure(m)*1.5;
        if(sc>bs){bs=sc;best2={m,pt};} });
      if(best2&&best2.pt.t<=8&&this.pressure(u)>0&&Math.random()<.8){
        this.aiRoll('📤 ПАС · '+u.name+' → '+best2.m.name,best2.pt.t,0,(ok)=>{
          this.animateBall(u.gx,u.gy,best2.m.gx,best2.m.gy,ok,()=>{
            if(ok){ this.giveBall(best2.m); UI.toast('🔴 Пас «Бульдогов» точен','red'); this.time.delayedCall(420,next); }
            else { this.fumbleAI(u,best2.m); }
          });
        });
        return;
      }
    }
    u.acted=true; this.markActed(u);
    // отбор после движения
    if(!u.hasBall&&this.ball&&this.ball.holder&&this.ball.holder.team==='me'){
      const c=this.ball.holder;
      if(Math.abs(c.gx-u.gx)<=1&&Math.abs(c.gy-u.gy)<=1&&Math.random()<.8){
        const tt=this.tackTarget(u,c);
        this.time.delayedCall(260,()=>{
          this.aiRoll('🛡️ ОТБОР · '+u.name+' vs '+c.name,tt.t,0,(ok,info)=>{
            SFX.tackle(); this.cameras.main.shake(120,.007);
            this.tweens.add({targets:u.spr,x:this.cx(c.gx)+(this.cx(u.gx)-this.cx(c.gx))*.55,
              y:this.cy(c.gy)+(this.cy(u.gy)-this.cy(u.gy))*.55,duration:130,yoyo:true});
                        if(ok){ this.giveBall(u); UI.toast('🔴 '+u.name+' отобрал мяч!','red'); this.time.delayedCall(420,next); }
            else { if(info.fumble){this.injure(u);UI.toast('💀 '+u.name+' травмирован','gold');}
              this.turnover('Отбор «Бульдогов» сорвался!'); }
          });
        });
        return;
      }
    }
    this.time.delayedCall(240,next);
  });
 }
 aiRoll(label,target,mod,cb){
  const doIt=(tries)=>{
   this.roll({label,target,mod,rerollable:false,cb:(ok,info)=>{
     if(!ok&&tries>0&&Math.random()<.55){ // ИИ иногда перебрасывает (сложность)
       UI.toast('🔴 Соперник использует переброс','red'); this.aiRoll(label,target,mod,(o,i)=>cb(o,i)); return; }
     cb(ok,info);
   }});
  };
  doIt(this.aiRerolls>0?(this.aiRerolls--,1):0);
 }
 canShootAt(gx,gy){ return Math.hypot(gx-(COLS-1)/2,gy-(ROWS-0.5))<=5.2; }
 pressureAt(gx,gy,team){ let n=0; for(const e of this.units){ if(e.team===team||e.injured)continue;
   if(Math.abs(e.gx-gx)<=1&&Math.abs(e.gy-gy)<=1)n++; } return n; }
 fumbleAI(u,t){
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]];
  const d=pick(dirs), gx=clamp(t.gx+d[0],0,COLS-1), gy=clamp(t.gy+d[1],0,ROWS-1);   // P1-7
  this.animateBall(u.gx,u.gy,gx,gy,false,()=>{
    const who=this.anyAt(gx,gy); this.dropBall(gx,gy);
    UI.toast(who?('⚡ '+who.name+' перехватил!'):'💨 Мяч скачет по полю!','gold');
    this.time.delayedCall(800,()=>{ if(this.phase!=='over')this.endTurn(); });
  });
 }

 /* ---------- доктор ---------- */
 doctor(){
  if(this.docUsed)return;
  Game.ad('doc').then(ok=>{
    if(!ok){UI.toast('Ролик не досмотрен','red');return;}
    this.docUsed=true; SFX.heal();
    let n=0;
    this.units.forEach(u=>{ if(u.injured){u.injured=false;u.acted=false;u.mSpent=0;u.spr.setAlpha(1);u.mark.setText('');n++;this.drawRing(u);
      this.dust.emitParticleAt(u.spr.x,u.spr.y,10);} });          // P2-13: действие возвращаем только вылеченным
    UI.toast('🩺 Доктор! '+(n?'Вылечено: '+n+'. В строй!':'Лазарет и так пуст'),true);
    this.cameras.main.flash(160,150,255,190);
    VKB.track('ad_reward_doc',1); Game.syncHud();
  });
 }
}