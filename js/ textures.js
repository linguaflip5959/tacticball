/* =====================================================================
   textures.js — процедурная генерация всех текстур (0 внешних ассетов)
   ===================================================================== */

export function genDice(sc){
 for(let f=1;f<=6;f++){
  const S=92,g=sc.make.graphics({add:false}); g.clear();
  g.fillStyle(0x000000,.35); g.fillRoundedRect(6,9,S-8,S-8,18);
  g.fillStyle(0xfdfdfd,1); g.fillRoundedRect(4,4,S-8,S-8,18);
  g.lineStyle(3,0xb9c4bd,1); g.strokeRoundedRect(4,4,S-8,S-8,18);
  g.fillStyle(0xffffff,.7); g.fillRoundedRect(10,9,S-20,16,8);
  const P={1:[[.5,.5]],2:[[.28,.28],[.72,.72]],3:[[.28,.28],[.5,.5],[.72,.72]],
    4:[[.28,.28],[.72,.28],[.28,.72],[.72,.72]],5:[[.28,.28],[.72,.28],[.5,.5],[.28,.72],[.72,.72]],
    6:[[.28,.25],[.72,.25],[.28,.5],[.72,.5],[.28,.75],[.72,.75]]}[f];
  P.forEach(p=>{ g.fillStyle(0x141a17,1); g.fillCircle(4+(S-8)*p[0],4+(S-8)*p[1],S*.085); });
  g.generateTexture('dice'+f,S,S); g.destroy();
 }
}
export function genToken(sc){
 const S=88,g=sc.make.graphics({add:false}); g.clear();
 g.fillStyle(0xffffff,1); g.fillCircle(S/2,S/2,S/2-3);
 g.lineStyle(4,0x000000,.45); g.strokeCircle(S/2,S/2,S/2-5);
 g.fillStyle(0xffffff,.35); g.fillEllipse(S/2,S*.33,S*.62,S*.34);
 g.fillStyle(0x000000,.18); g.fillEllipse(S/2,S*.72,S*.66,S*.28);
 g.generateTexture('token',S,S); g.destroy();
}
export function genBall(sc){
 const S=52,r=S/2-2,g=sc.make.graphics({add:false}); g.clear();
 g.fillStyle(0xffffff,1); g.fillCircle(r+2,r+2,r);
 g.lineStyle(2,0x2a2a2a,.9); g.strokeCircle(r+2,r+2,r);
 g.fillStyle(0x1b1b1b,1);
 const poly=(cx,cy,rr,n,rot)=>{ g.beginPath(); for(let i=0;i<n;i++){const a=rot+i*Math.PI*2/n;
   const x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr; i?g.lineTo(x,y):g.moveTo(x,y);} g.closePath(); g.fillPath(); };
 poly(r+2,r+2,r*.36,5,-Math.PI/2);
 for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5; poly(r+2+Math.cos(a)*r*.78,r+2+Math.sin(a)*r*.78,r*.22,5,a);}
 g.generateTexture('ball',S,S); g.destroy();
}
export function genMisc(sc){
 let g=sc.make.graphics({add:false});
 g.fillStyle(0xffffff,1); g.fillCircle(8,8,8); g.generateTexture('dot',16,16); g.destroy();
 g=sc.make.graphics({add:false}); g.fillStyle(0x000000,.34); g.fillEllipse(48,20,96,40);
 g.generateTexture('shadow',96,40); g.destroy();
 const t=sc.textures.createCanvas('glow',128,128),c=t.getContext();
 const gr=c.createRadialGradient(64,64,0,64,64,64);
 gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.35,'rgba(255,255,255,.4)'); gr.addColorStop(1,'rgba(255,255,255,0)');
 c.fillStyle=gr; c.fillRect(0,0,128,128); t.refresh();
}