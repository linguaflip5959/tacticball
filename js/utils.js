/* =====================================================================
   utils.js — константы игры + общие хелперы
   ===================================================================== */

export const COLS=9, ROWS=12, TPH=6;   // БАЛАНС-И3: было 4
export const DIFFS=[
 {n:'ДВОР', mul:1.0, gk:-0.9, aiReroll:0},
 {n:'ЛИГА', mul:1.6, gk:0,    aiReroll:1},
 {n:'ПРО',  mul:2.4, gk:+1.0, aiReroll:2}
];
export const BASE_SQUAD=[                   // P4: стартовые статы (были скопипащены в 2 местах)
 {spd:3,pas:3,sht:2,tkl:4},{spd:4,pas:3,sht:3,tkl:3},{spd:3,pas:4,sht:3,tkl:3},
 {spd:4,pas:3,sht:4,tkl:2},{spd:5,pas:2,sht:5,tkl:2}];
export const FORMS=[
 {id:'classic',name:'Классика 1-2-2',price:0,pos:[[4,1],[2,3],[6,3],[3,5],[5,5]]},
 {id:'wall',   name:'Стена 2-3',     price:600,pos:[[2,1],[6,1],[4,3],[2,5],[6,5]]},
 {id:'arrow',  name:'Стрела 1-1-3',  price:1400,pos:[[4,1],[4,3],[2,5],[4,5],[6,5]]}
];
export const NAMES=['КУВАЛДА','ТУРБО','СТЕНКА','ВИХРЬ','ПУШКА'];
export const POSN=['ЗАЩ','ПРАВ','ЦЕНТР','ЛЕВ','ФОРВ'];

export const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
export const lerp=(a,b,t)=>a+(b-a)*t;
export const rint=(a,b)=>Math.floor(a+Math.random()*(b-a+1));
export const rnd=(a,b)=>a+Math.random()*(b-a);
export const pick=a=>a[Math.floor(Math.random()*a.length)];
export const hex=n=>'#'+('000000'+n.toString(16)).slice(-6);
export const dist=(a,b,c,d)=>Math.hypot(a-c,b-d);
export const key=(x,y)=>x+','+y;
export const $=id=>document.getElementById(id);