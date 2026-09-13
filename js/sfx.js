/* =====================================================================
   sfx.js — WebAudio-синтез звуков (0 КБ ассетов)
   ===================================================================== */

export const SFX={ctx:null,on:true,master:null,
 init(){ if(this.ctx)return; try{this.ctx=new (window.AudioContext||window.webkitAudioContext)();
   this.master=this.ctx.createGain(); this.master.gain.value=.45; this.master.connect(this.ctx.destination);}catch(e){} },
 resume(){ if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume(); },
 tone(f,d,t,v,f2){ if(!this.on||!this.ctx)return; const c=this.ctx,now=c.currentTime;
   const o=c.createOscillator(),g=c.createGain(); o.type=t||'sine'; o.frequency.setValueAtTime(f,now);
   if(f2)o.frequency.exponentialRampToValueAtTime(Math.max(30,f2),now+d);
   g.gain.setValueAtTime(0,now); g.gain.linearRampToValueAtTime(v||.2,now+.012);
   g.gain.exponentialRampToValueAtTime(.001,now+d); o.connect(g); g.connect(this.master); o.start(now); o.stop(now+d+.05); },
 noise(d,v,f,q){ if(!this.on||!this.ctx)return; const c=this.ctx,now=c.currentTime;
   const len=Math.floor(c.sampleRate*d),b=c.createBuffer(1,len,c.sampleRate),ch=b.getChannelData(0);
   for(let i=0;i<len;i++)ch[i]=(Math.random()*2-1)*(1-i/len);
   const s=c.createBufferSource(); s.buffer=b; const bp=c.createBiquadFilter();
   bp.type='bandpass'; bp.frequency.value=f||800; bp.Q.value=q||1;
   const g=c.createGain(); g.gain.setValueAtTime(v||.2,now); g.gain.exponentialRampToValueAtTime(.001,now+d);
   s.connect(bp); bp.connect(g); g.connect(this.master); s.start(now); },
 dice(){ this.noise(.07,.28,1800,2); },
 step(){ this.noise(.05,.12,420,1); },
 kick(){ this.noise(.1,.3,300,1.2); this.tone(160,.16,'sine',.3,55); },
 whistle(){ this.tone(2300,.15,'square',.12); this.tone(2760,.2,'square',.1,2400); },
 goal(){ this.tone(523,.12,'square',.16); setTimeout(()=>this.tone(659,.12,'square',.16),95);
   setTimeout(()=>this.tone(880,.26,'square',.17),190); this.noise(1.2,.18,1000,.6); },
 fail(){ this.tone(300,.28,'sawtooth',.13,95); },
 tackle(){ this.noise(.16,.3,240,1); this.tone(110,.2,'sine',.2,60); },
 coin(){ this.tone(1180,.07,'square',.11); setTimeout(()=>this.tone(1760,.11,'square',.1),60); },
 ui(){ this.tone(680,.05,'square',.07); },
 heal(){ this.tone(660,.18,'triangle',.14,1320); }
};