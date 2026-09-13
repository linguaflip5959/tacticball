/* =====================================================================
   ui.js — экраны, тосты, форматирование
   ===================================================================== */
import {$} from './utils.js';

export const UI={
 show(id){ this.hide(); if(id){$(id).classList.add('on');} },
 hide(){ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on')); $('rr').classList.remove('on'); },
 any(){ return !!document.querySelector('.screen.on'); },
 toast(m,cls){ const t=$('toast'); t.textContent=m; t.className='on '+(cls||'');
   clearTimeout(this._t); this._t=setTimeout(()=>t.className='',1900); },
 fmt(n){ return n>=10000?(n/1000).toFixed(1).replace('.0','')+'k':String(n); }
};