/* =====================================================================
   main.js — входная точка
   ===================================================================== */
import {Game} from './game.js';
import {BootScene} from './boot.js';
import {MatchScene} from './match.js';
import {VKB} from './bridge.js';

window.__ad=(kind,slot)=>VKB.track('ad_'+kind+'_'+slot,1);
Game.boot([BootScene,MatchScene]);