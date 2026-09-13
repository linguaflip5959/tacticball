/* =====================================================================
   game.js — контроллер: меню, состав, кнопки, бутстрап
   ===================================================================== */
import {TPH,DIFFS,FORMS,NAMES,POSN,clamp,dist,$} from './utils.js';
import {Save,upCost} from './save.js';
import {VKB} from './bridge.js';
import {UI} from './ui.js';
import {SFX} from './sfx.js';

export const Game={
 boot(scenes){
  Save.load();
  const start=()=>{
   this.ph=new Phaser.Game({type:Phaser.AUTO,parent:'game',backgroundColor:'#06120e',
     scale:{mode:Phaser.Scale.RESIZE,width:'100%',height:'100%',autoCenter:Phaser.Scale.CENTER_BOTH},
     scene:scenes});
   this.ph.events.on('ready',()=>{ this.sc=this.ph.scene.getScene('match'); this.wire(); this.afterBoot(); });
  };
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(start).catch(start); else start();
 },
  afterBoot(){
  this.menuStats(); this.squad();
  VKB.init(); VKB.user().then(u=>{ if(u)$('m-user').textContent='Тренер '+u.first_name+', «Барсуки» ждут свистка!'; });
  Save.cloud().then(()=>{ this.menuStats(); this.squad(); });
  SFX.on=Save.d.sound; $('btn-sound').textContent=Save.d.sound?'🔊':'🔇';
  document.querySelectorAll('.diff').forEach(d=>d.classList.toggle('on',+d.dataset.d===Save.d.diff));
  // QA: отладочная консоль — включается ТОЛЬКО параметром ?debug в адресе
  if(new URLSearchParams(location.search).has('debug')){
    const sc=this.sc;
    window.TB={
      hurt(i=0){ const mine=sc.units.filter(u=>u.team==='me'); const u=mine[i]||mine[0];
        if(u){ sc.injure(u); return '🩹 травмирован: '+u.name; } return 'матч не начат'; },
      info(){ return { phase:sc.phase, turn:sc.turnTeam, score:sc.scoreMe+':'+sc.scoreAi,
        ball:sc.ball?{ gx:sc.ball.gx, gy:sc.ball.gy,
          holder:sc.ball.holder&&sc.ball.holder.name, onGround:sc.ball.onGround }:null }; },
      sc };
  }
 },
 ad(slot){ return VKB.rewarded(slot); },
 menuStats(){
  $('m-wins').textContent=Save.d.wins+'/'+Save.d.matches;
  $('m-goals').textContent=Save.d.goals;
  $('m-coins').textContent=UI.fmt(Save.d.coins);
  $('q-coins').textContent=UI.fmt(Save.d.coins);
 },
 syncHud(){
  const sc=this.sc; if(!sc)return;
  $('s-me').textContent=sc.scoreMe||0; $('s-ai').textContent=sc.scoreAi||0;
  const ht=sc.halfTurn||0;
  const half=sc.half||1, turnNo=((ht-1)%TPH)+1;   // P1-5: номер хода внутри тайма, во 2-м тайме снова с 1
  $('h-turn').textContent='ТАЙМ '+half+' · ХОД '+clamp(turnNo,1,TPH)+'/'+TPH;
  $('h-turn').classList.toggle('ai',sc.turnTeam==='ai');
  $('h-acts').textContent='⚡ действий: '+(sc.actionsLeft?sc.actionsLeft():0);
  const rf=sc.rerollFree||0, ra=sc.rerollAd||0;
  $('h-reroll').textContent='🎲 переброс: '+rf+(ra?'(+'+ra+' за рекламу)':'');
  $('h-reroll').classList.toggle('zero',rf<=0&&ra>=2);
  $('h-coins').textContent=UI.fmt(Save.d.coins);
  $('btn-pause-doc').style.display=(sc.docUsed||sc.phase==='over')?'none':'flex';
 },
  syncCard(u){
  const p=$('pcard');
  if(!u){ p.classList.remove('on'); ['a-pass','a-shoot','a-tackle','a-wait'].forEach(id=>$(id).disabled=true); return; }
  p.classList.add('on');
  $('p-av').textContent=u.num; $('p-av').style.background=u.team==='me'?'radial-gradient(circle at 32% 28%,#8fdcff,#39c2ff 55%,#0d5f8a)':'radial-gradient(circle at 32% 28%,#ffc2cd,#ff4d6d 55%,#8a1029)';
  $('p-nm').textContent='№'+u.num+' '+u.name+(u.hasBall?' · 🟡 МЯЧ':'')+(u.acted?' · 💤 действовал':'');
  $('p-st').innerHTML='СКР <b>'+u.st.spd+'</b> · ПАС <b>'+u.st.pas+'</b> · УДР <b>'+u.st.sht+'</b> · ОТБ <b>'+u.st.tkl+'</b>';
  const dis=!u.acted;
  const canP=dis&&u.hasBall&&this.sc.units.some(t=>t.team==='me'&&!t.injured&&t!==u&&
    dist(u.gx,u.gy,t.gx,t.gy)<=this.sc.passRange(u));
  const canS=dis&&u.hasBall&&this.sc.canShoot(u);
  const canT=dis&&this.sc.units.some(t=>t.team==='ai'&&!t.injured&&t.hasBall&&Math.abs(t.gx-u.gx)<=1&&Math.abs(t.gy-u.gy)<=1);
  $('a-pass').disabled=!canP; $('a-shoot').disabled=!canS; $('a-tackle').disabled=!canT; $('a-wait').disabled=!dis;
  $('a-pass-t').textContent=canP?(u.st.pas>3?'точно':'обычно'):'нет мяча/целей';
  if(canS){ const st=this.sc.shootTarget(u); $('a-shoot-t').textContent=st.d.toFixed(1)+' кл · '+st.t+'+'; }
  else $('a-shoot-t').textContent='далеко';
  if(canT){ const c=this.sc.units.find(t=>t.team==='ai'&&t.hasBall&&!t.injured); const tt=this.sc.tackTarget(u,c);
    $('a-tack-t').textContent=tt.t+'+'; } else $('a-tack-t').textContent='нет цели';
 },
 squad(){
  const L=$('sq-list'); L.innerHTML='';
  Save.d.squad.forEach((p,i)=>{
    const d=document.createElement('div'); d.className='pl';
    d.innerHTML='<div class="plh"><div class="pav" style="background:radial-gradient(circle at 32% 28%,#8fdcff,#39c2ff 55%,#0d5f8a)">'+(i+1)+'</div>'+
      '<div class="nm">'+NAMES[i]+'</div><div class="pos">'+POSN[i]+'</div></div>';
    const row=document.createElement('div'); row.className='strow';
    [['СКР','spd'],['ПАС','pas'],['УДР','sht'],['ОТБ','tkl']].forEach(s=>{
      const lvl=p[s[1]], mx=lvl>=6, c=upCost(lvl);
      const e=document.createElement('div'); e.className='st'+(mx?' max':'');
      e.innerHTML='<div class="t">'+s[0]+'</div><div class="n">'+lvl+'</div>'+
        '<button '+(mx||Save.d.coins<c?'disabled':'')+'>'+(mx?'МАКС':'🪙'+c)+'</button>';
      e.querySelector('button').onclick=()=>{
        if(mx||Save.d.coins<c)return;
        Save.d.coins-=c; p[s[1]]=lvl+1; Save.write(); SFX.init();SFX.coin();
        VKB.track('upgrade_'+s[1],1); this.squad(); this.menuStats(); this.syncHud();
        UI.toast('⬆️ '+NAMES[i]+': '+s[0]+' → '+(lvl+1),true);
      };
      row.appendChild(e);
    });
    d.appendChild(row); L.appendChild(d);
  });
  const F=$('form-list'); F.innerHTML='';
  FORMS.forEach(f=>{
    const own=Save.d.forms.includes(f.id), eq=Save.d.form===f.id;
    const e=document.createElement('div'); e.className='pl'+(eq?' ':'');
    e.style.borderColor=eq?'rgba(47,224,122,.5)':'rgba(255,255,255,.14)';
    e.innerHTML='<div class="plh"><div class="nm">'+(eq?'✅ ':'')+f.name+'</div></div>';
    const b=document.createElement('button'); b.className='buy'; b.style.cssText='width:100%;border:0;border-radius:10px;padding:8px;font-family:Russo One,sans-serif;font-size:12px;cursor:pointer';
    if(eq){b.textContent='АКТИВНА';b.disabled=true;b.style.background='linear-gradient(180deg,#8dffa8,#2fe07a)';b.style.color='#062a13';}
    else if(own){b.textContent='ВЫБРАТЬ';b.style.background='linear-gradient(180deg,#b6ecff,#39c2ff)';b.style.color='#04283c';
      b.onclick=()=>{Save.d.form=f.id;Save.write();SFX.ui();this.squad();UI.toast('Схема: '+f.name);};}
    else {b.textContent='🪙 '+f.price;b.style.background='linear-gradient(180deg,#fff0b0,#ffcf3f)';b.style.color='#3d2600';
      b.disabled=Save.d.coins<f.price;
      b.onclick=()=>{ if(Save.d.coins<f.price)return; Save.d.coins-=f.price; Save.d.forms.push(f.id); Save.d.form=f.id;
        Save.write(); SFX.coin(); VKB.track('formation_buy',1); this.squad(); this.menuStats(); UI.toast('Схема «'+f.name+'» куплена!',true); };}
    e.appendChild(b); F.appendChild(e);
  });
 },
 wire(){
  const sc=this.sc;
  let rulesFrom='menu';                                   // P3-19: помним, откуда открыли правила
  const go=id=>{SFX.init();SFX.resume();SFX.ui();UI.show(id);};
  $('btn-play').onclick=()=>{ UI.hide(); sc.startMatch(); };
  $('btn-squad').onclick=()=>{ this.squad(); go('sc-squad'); };
  $('btn-squad-close').onclick=()=>{ this.menuStats(); go('sc-menu'); };
  $('btn-howto').onclick=()=>{ rulesFrom='menu'; go('sc-howto'); };
  $('btn-howto-close').onclick=()=>{ Save.d.tutorial=true;Save.write();
    go(rulesFrom==='pause'?'sc-pause':'sc-menu'); };      // P3-19: возврат по месту открытия
  document.querySelectorAll('.diff').forEach(d=>d.onclick=()=>{
    Save.d.diff=+d.dataset.d; Save.write(); SFX.init();SFX.ui();
    document.querySelectorAll('.diff').forEach(x=>x.classList.toggle('on',x===d));
    UI.toast('Сложность: '+DIFFS[Save.d.diff].n+' (награда x'+DIFFS[Save.d.diff].mul+')',true);
  });
  $('btn-pause').onclick=()=>{ if(sc.phase==='menu'||sc.phase==='over')return; SFX.ui(); sc.scene.pause(); this.syncHud(); go('sc-pause'); };
  $('btn-resume').onclick=()=>{ SFX.ui(); UI.hide(); sc.scene.resume(); };
  $('btn-pause-rules').onclick=()=>{ rulesFrom='pause'; go('sc-howto'); };
  $('btn-pause-doc').onclick=()=>{ SFX.ui(); UI.hide(); sc.scene.resume(); sc.doctor(); };
  $('btn-quit').onclick=()=>{ sc.phase='over';
    Save.d.matches++; Save.d.losses++; Save.d.streak=0; Save.write();   // P3-18: техническое поражение — как на кнопке написано
    sc.scene.resume(); sc.scene.restart(); UI.show('sc-menu'); this.menuStats(); };
  $('btn-sound').onclick=()=>{ Save.d.sound=!Save.d.sound; SFX.on=Save.d.sound; Save.write();
    $('btn-sound').textContent=Save.d.sound?'🔊':'🔇'; if(Save.d.sound){SFX.init();SFX.ui();} };
  $('h-reroll').onclick=()=>{ if(!sc||sc.rerollFree>0||sc.rerollAd>=2)return;
    UI.toast('Перебросы доступны сразу после провала броска 🎲'); };
  // действия
  $('a-pass').onclick=()=>{ if(sc.phase!=='idle')return; SFX.ui(); sc.actPass(); };
  $('a-tackle').onclick=()=>{ if(sc.phase!=='idle')return; SFX.ui(); sc.actTackle(); };
  $('a-shoot').onclick=()=>{ if(sc.phase!=='idle')return; const u=sc.sel; if(!u||u.acted)return; SFX.ui(); sc.doShoot(u); };
  $('a-wait').onclick=()=>{ const u=sc.sel; if(!u)return; SFX.ui(); u.acted=true; sc.markActed(u); sc.afterAction(); };
  $('a-end').onclick=()=>{ if(sc.phase==='ai'||sc.phase==='over'||sc.phase==='menu')return; SFX.ui(); sc.endTurn(); };
  // итог
  $('btn-x2').onclick=()=>{ if(sc.x2Used)return;
    this.ad('x2').then(ok=>{ if(ok){ sc.x2Used=true; const add=sc.lastCoins; Save.d.coins+=add; Save.write();
      $('r-coins').textContent='+'+(sc.lastCoins+add); $('btn-x2').style.display='none'; this.menuStats(); this.syncHud();
      SFX.coin(); UI.toast('💰 x2! +'+add+' монет',true); } else UI.toast('Ролик не досмотрен','red'); }); };
  $('btn-rematch').onclick=()=>{ UI.hide(); sc.startMatch(); };
  $('btn-r-menu').onclick=()=>{ sc.phase='menu'; sc.scene.restart(); UI.show('sc-menu'); this.menuStats(); };
  $('btn-share').onclick=()=>{ VKB.share().then(()=>{ sc.shared=true; Save.d.coins+=100; Save.write();
    this.menuStats(); this.syncHud(); SFX.coin(); $('btn-share').style.display='none';
    UI.toast('📤 Спасибо за репост! +100 🪙',true); VKB.track('share',1); }); };
  document.addEventListener('touchmove',e=>{ if(!e.target.closest('.gdd,.sq'))e.preventDefault(); },{passive:false});
  window.addEventListener('contextmenu',e=>e.preventDefault());
  // первый запуск — правила (закрытие вернёт в меню, а не в пустоту)
  if(!Save.d.tutorial) setTimeout(()=>UI.show('sc-howto'),400);
 }
};