/* =====================================================================
   bridge.js — обёртка VK Bridge + мок-реклама для локального QA
   ===================================================================== */
import {$} from './utils.js';

export const VKB=(function(){
 const bridge=(window.vk&&window.vk.bridge)?window.vk.bridge:null;
 function send(m,p){ if(!bridge)return Promise.resolve(null);
   try{const r=bridge.send(m,p||{}); return (r&&r.then)?r:Promise.resolve(r);}catch(e){return Promise.reject(e);} }
 function safe(m,p){ send(m,p).catch(()=>{}); }
 const ADS={reroll:{t:'Переброс кубиков',d:'Смотри ролик — получишь ещё один переброс в этом матче.'},
   doc:{t:'Доктор',d:'Смотри ролик — врачи вернут травмированных в игру.'},
   x2:{t:'Удвоение монет',d:'Смотри ролик — награда за матч удвоится.'}};
 function mockAd(slot){ return new Promise(res=>{
   const box=$('fakead'),tm=$('fa-timer'),pr=$('fa-prog'),bt=$('fa-btn'),ti=$('fa-title'),tx=$('fa-text');
   const i=ADS[slot]||ADS.x2; ti.textContent=i.t; tx.textContent=i.d;
   box.classList.add('on'); bt.disabled=true; let left=3; tm.textContent='3'; pr.style.width='0%';
   const iv=setInterval(()=>{ left-=.1; pr.style.width=((3-left)/3*100)+'%'; tm.textContent=Math.max(0,Math.ceil(left));
     if(left<=0){clearInterval(iv);tm.textContent='0';bt.disabled=false;} },100);
   bt.onclick=()=>{clearInterval(iv);box.classList.remove('on');bt.onclick=null;res(true);};
 }); }
 return {isVK:!!bridge,
  init(){ safe('VKWebAppInit'); safe('VKWebAppSetViewSettings',{status_bar_style:'light',action_bar_color:'#06120e',action_bar_text_color:'white'}); },
  user(){ return send('VKWebAppGetUserInfo').then(d=>(d&&d.first_name)?d:null).catch(()=>null); },
  storageGet(k){ return send('VKWebAppStorageGet',{keys:[k]}).then(r=>{
      try{const it=(r&&r.objects)?r.objects[0]:null; return it?JSON.parse(it.value):null;}catch(e){return null;}
    }).catch(()=>null); },
  storageSet(k,v){ safe('VKWebAppStorageSet',{key:k,value:v}); },
  share(){ return send('VKWebAppShare',{link:location.href}).then(()=>true).catch(()=>false); },
  track(e,v){ safe('VKWebAppTrackEvent',{event_type:e,conversion_value:v||1,event_type_value:v||1}); },
  rewarded(slot){
   window.__ad&&window.__ad('show',slot);
   if(!bridge) return mockAd(slot).then(ok=>{window.__ad&&window.__ad(ok?'reward':'fail',slot);return ok;});
   return new Promise(resolve=>{
    let done=false,timer=null;
    const finish=ok=>{ if(done)return; done=true; clearTimeout(timer);
      try{bridge.unsubscribe(h);}catch(e){} window.__ad&&window.__ad(ok?'reward':'fail',slot); resolve(ok); };
    function h(e){ const d=e&&e.detail; if(!d)return; const t=d.type;
      if(t==='VKWebAppRewardedVideoResult')finish(true);
      else if(t==='VKWebAppRewardedVideoFailed')finish(false);
      else if(t==='VKWebAppRewardedVideoDidClose')setTimeout(()=>finish(true),120); }
    try{bridge.subscribe(h);}catch(e){}
    timer=setTimeout(()=>finish(true),75000);
    send('VKWebAppShowRewardedVideo').catch(()=>finish(false));
   });
  }
 };
})();