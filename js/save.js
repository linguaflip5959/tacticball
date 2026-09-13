/* =====================================================================
   save.js — локальный сейв + синк в VK Cloud Storage
   ===================================================================== */
import {VKB} from './bridge.js';
import {BASE_SQUAD} from './utils.js';

export const Save={KEY:'tacticball_v1',
 d:{coins:200,wins:0,losses:0,draws:0,matches:0,goals:0,streak:0,bestStreak:0,diff:1,form:'classic',
    forms:['classic'],sound:true,tutorial:false,sharedAt:0,
    squad:BASE_SQUAD.map(p=>({...p}))},          // копия, не ссылка!
 load(){ try{const r=localStorage.getItem(this.KEY); if(r){const p=JSON.parse(r);
   if(p.squad&&p.squad.length===5)Object.assign(this.d,p); else Object.assign(this.d,p,{squad:this.d.squad});}}catch(e){} },
 write(){ const s=JSON.stringify(this.d); try{localStorage.setItem(this.KEY,s);}catch(e){} VKB.storageSet(this.KEY,s); },
 cloud(){ return VKB.storageGet(this.KEY).then(c=>{ if(!c)return;
    const a=this.d;
    if((c.matches||0)>(a.matches||0)){ c.squad=(c.squad&&c.squad.length===5)?c.squad:a.squad; Object.assign(a,c); }
    else { a.coins=Math.max(a.coins,c.coins||0); a.wins=Math.max(a.wins,c.wins||0);
      a.matches=Math.max(a.matches,c.matches||0); a.goals=Math.max(a.goals,c.goals||0);
      a.bestStreak=Math.max(a.bestStreak,c.bestStreak||0); a.forms=Array.from(new Set([].concat(c.forms||[],a.forms||[]))); }
    this.write(); }); }
};
export const upCost=lvl=>Math.round(60*Math.pow(lvl,1.4));   // БАЛАНС: было 70·lvl^1.55