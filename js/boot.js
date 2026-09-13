/* =====================================================================
   boot.js — генерируем текстуры и стартуем матч
   ===================================================================== */
import {genDice,genToken,genBall,genMisc} from './textures.js';

export class BootScene extends Phaser.Scene{
 constructor(){super('boot');}
 create(){ genMisc(this); genToken(this); genBall(this); genDice(this); this.scene.start('match'); }
}