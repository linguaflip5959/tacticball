/* =====================================================================
   main.js — входная точка
   ===================================================================== */
import {Game} from './game.js';
import {BootScene} from './boot.js';
import {MatchScene} from './match.js';
import {VKB} from './bridge.js';

VKB.init();                    // VK-FIX: «приложение живо» — немедленно, ВК снимает прелоадер
console.log('[ТБ] main: мост', (window.vk&&window.vk.bridge)?'жив — работаем через ВК':'не найден — мок-режим');
window.__ad=(kind,slot)=>VKB.track('ad_'+kind+'_'+slot,1);
Game.boot([BootScene,MatchScene]);