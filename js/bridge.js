/* =====================================================================
   bridge.js — обёртка VK Bridge + мок-реклама для локального QA
   Сверено с dev.vk.com:
   • глобал моста — window.vkBridge (старый window.vk.bridge — запасной)
   • rewarded — VKWebAppShowNativeAds, ad_format:'reward'
   • StorageGet отвечает полем keys (не objects!)
   • TrackEvent — event_name + event_params
   • SetViewSettings — только Android/iOS, text_color не существует
   ===================================================================== */
import {$} from './utils.js';

export const VKB=(function(){
 const bridge=(window.vkBridge&&window.vkBridge.send)?window.vkBridge
   :((window.vk&&window.vk.bridge)?window.vk.bridge:null);
 console.log('[ТБ] мост:', bridge?'жив ✓':'НЕ НАЙДЕН — проверь скрипт моста');
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
  init(){ if(!bridge){ console.warn('[ТБ] VKWebAppInit НЕ отправлен — моста нет'); return; }
   send('VKWebAppInit').then(r=>console.log('[ТБ] VKWebAppInit →',JSON.stringify(r)))
     .catch(e=>console.warn('[ТБ] VKWebAppInit отклонён:',e));
   safe('VKWebAppSetViewSettings',{status_bar_style:'light',action_bar_color:'#06120e'}); },
  user(){ return send('VKWebAppGetUserInfo').then(d=>(d&&d.first_name)?d:null).catch(()=>null); },
  storageGet(k){ return send('VKWebAppStorageGet',{keys:[k]}).then(r=>{
      try{ const it=(r&&r.keys)?r.keys[0]:null;                 // по докам: ответ — поле keys
        return it?JSON.parse(it.value):null; }catch(e){ return null; }
    }).catch(()=>null); },
  storageSet(k,v){ safe('VKWebAppStorageSet',{key:k,value:v}); },
  share(){ return send('VKWebAppShare',{link:location.href}).then(()=>true).catch(()=>false); },
  track(e,v){ safe('VKWebAppTrackEvent',{event_name:e,event_params:{value:v||1}}); },
  rewarded(slot){
   window.__ad&&window.__ad('show',slot);
   if(!bridge) return mockAd(slot).then(ok=>{window.__ad&&window.__ad(ok?'reward':'fail',slot);return ok;});
   return new Promise(resolve=>{
    let done=false,t=null;
    const finish=ok=>{ if(done)return; done=true; clearTimeout(t);
      window.__ad&&window.__ad(ok?'reward':'fail',slot); resolve(ok); };
    t=setTimeout(()=>finish(false),150000);                    // страховка от зависшего рекламного промиса
    send('VKWebAppShowNativeAds',{ad_format:'reward'})
      .then(r=>{ console.log('[ТБ] rewarded('+slot+') →',JSON.stringify(r));
        finish(!(r&&r.result===false)); })                     // result:false = закрыл, иначе — награда
      .catch(e=>{ console.warn('[ТБ] rewarded('+slot+') ошибка:',e); finish(false); });
   });
  }
 };
})();