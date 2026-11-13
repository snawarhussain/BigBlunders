/* Slice-profile-enabled PDG continuation: Figures 21–25.
   The numerical visuals are generated in-browser from a waveform-resolved
   relaxation-free Bloch solve. Nothing below is a prerecorded illustration. */
(function(){
'use strict';

const style=document.createElement('style');
style.textContent=`
.slice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(12px,1.4vw,22px);width:100%;max-width:none}
.slice-grid>.card,.slice-wide{min-width:0;width:100%;overflow:hidden}
.slice-grid canvas,.slice-wide canvas{width:100%!important;height:auto!important;max-width:none}
.slice-metric-row{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px;width:100%;max-width:none}
.slice-metric{border:1px solid var(--line);border-radius:9px;background:rgba(22,27,34,.82);padding:9px 11px;color:var(--fg3);font:10px/1.35 var(--mono)}
.slice-metric b{display:block;color:var(--fg);font-size:13px;margin-top:2px}.slice-metric em{color:var(--acc2);font-style:normal}
.slice-equation{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:9px;width:100%;max-width:none}
.slice-equation>div{border:1px solid var(--line);border-radius:9px;background:rgba(22,27,34,.82);padding:11px 13px;color:var(--fg2);font-size:11px;line-height:1.5}
.slice-equation code{display:block;color:var(--acc2);font:11px/1.55 var(--mono);white-space:pre-wrap}.slice-equation b{color:var(--fg)}
.slice-legend{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:1px 5px;color:var(--fg3);font:10px var(--mono)}
.slice-legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:-1px}
@container stage (max-width:900px){.slice-grid,.slice-equation{grid-template-columns:1fr}.slice-metric-row{grid-template-columns:repeat(2,minmax(120px,1fr))}}
@media(max-width:660px){.slice-metric-row{grid-template-columns:1fr}}
`;
document.head.appendChild(style);

const GAMMA_HZ=42.576e6;
const FAT_HZ=-440;
const RELS=['pp','pz','mp','mz','zp','zz'];
const REL_LABEL={pp:'F⁺ → F⁺',pz:'F⁺ → Z',mp:'F⁻ → F⁺',mz:'F⁻ → Z',zp:'Z → F⁺',zz:'Z → Z'};
const REL_COLOR={pp:C.Fp,pz:C.Z,mp:C.Fm,mz:C.vio,zp:C.acc2,zz:C.Z};
const bankCache=new Map();

function fit(cv,w,h){const d=canvasDpr();cv.width=Math.round(w*d);cv.height=Math.round(h*d);cv.style.width=w+'px';cv.style.height=h+'px';cv.logicalW=w;cv.logicalH=h;cv.getContext('2d').setTransform(d,0,0,d,0,0);}
function responsiveCanvas(card,cv,ratio,minH=260,maxH=520){const w=Math.max(500,Math.floor(card.clientWidth-18));fit(cv,w,Math.max(minH,Math.min(maxH,w*ratio)));}
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
function sinc(x){return Math.abs(x)<1e-10?1:Math.sin(Math.PI*x)/(Math.PI*x);}
function cdiv(a,s){return cx(a.re/s,a.im/s);}
function cpolar(r,p){return cx(r*Math.cos(p),r*Math.sin(p));}
function csum(list){return list.reduce((a,b)=>cadd(a,b),cx());}
function cmatMul(A,B){const out=Array.from({length:A.length},()=>Array.from({length:B[0].length},()=>cx()));for(let i=0;i<A.length;i++)for(let j=0;j<B[0].length;j++)for(let k=0;k<B.length;k++)out[i][j]=cadd(out[i][j],cmul(A[i][k],B[k][j]));return out;}
function rmatMul(A,B){return A.map((r,i)=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)));}
function rzMat(th){const c=Math.cos(th),s=Math.sin(th);return [[c,-s,0],[s,c,0],[0,0,1]];}
function rotateVector(v,w,dt){const q=Math.hypot(w[0],w[1],w[2]);if(q<1e-14)return v.slice();const a=q*dt,c=Math.cos(a),s=Math.sin(a),u=w.map(x=>x/q),dot=u[0]*v[0]+u[1]*v[1]+u[2]*v[2];return [v[0]*c+(u[1]*v[2]-u[2]*v[1])*s+u[0]*dot*(1-c),v[1]*c+(u[2]*v[0]-u[0]*v[2])*s+u[1]*dot*(1-c),v[2]*c+(u[0]*v[1]-u[1]*v[0])*s+u[2]*dot*(1-c)];}
function cartToCircular(R){
  const s=IS2;
  const S=[[cx(s),cx(0,s),cx()],[cx(s),cx(0,-s),cx()],[cx(),cx(),cx(1)]];
  const SH=[[cx(s),cx(s),cx()],[cx(0,-s),cx(0,s),cx()],[cx(),cx(),cx(1)]];
  const Rc=R.map(row=>row.map(v=>cx(v)));
  return cmatMul(cmatMul(S,Rc),SH);
}
function pulseDefinition(P){
  const duration=P.duration||4,thickness=(P.thickness||5)*1e-3,tbw=P.tbw||5.2,Nt=128,dt=duration/Nt;
  const env=[];for(let j=0;j<Nt;j++){const u=(j+.5)/Nt-.5;env.push(sinc(tbw*u)*(.54+.46*Math.cos(TAU*u)));}
  /* The requested flip angle defines the nominal transmit waveform.  Local
     B1 scaling is applied afterwards, so b1=0.8 really produces an 80% local
     rotation instead of being silently renormalized away. */
  const area=env.reduce((s,v)=>s+v*dt,0),scale=(P.alpha*D2R)/area,omega=env.map(v=>v*scale*(P.b1||1));
  const bw=tbw/(duration*1e-3),G=bw/(GAMMA_HZ*thickness),L=(P.domainFactor||4)*thickness,dk=1/L;
  return {duration,thickness,tbw,Nt,dt,env,omega,G,L,dk,rephaseDuration:duration*.32,rephaseG:-G*duration/(2*duration*.32)};
}
function intravoxelB0AtZ(P,z,d){return 2*(P.b0Slope||0)*z/d.L;}
function solveAtZ(P,z,speciesHz=0,fraction=1,wantMatrix=true){
  const d=pulseDefinition(P),phase=(P.phase||0)*D2R,offset=(P.b0||0)+speciesHz-(P.freq||0)+intravoxelB0AtZ(P,z,d),total=d.duration+d.rephaseDuration,target=clamp(fraction,0,1)*total;
  let cols=[[1,0,0],[0,1,0],[0,0,1]],elapsed=0;
  for(let j=0;j<d.Nt&&elapsed<target;j++){
    const step=Math.min(d.dt,target-elapsed),w=[d.omega[j]*Math.cos(phase),d.omega[j]*Math.sin(phase),TAU*(GAMMA_HZ*d.G*z+offset)/1000];
    cols=cols.map(v=>rotateVector(v,w,step));elapsed+=step;
  }
  const rdt=d.rephaseDuration/40;
  for(let j=0;j<40&&elapsed<target;j++){
    const step=Math.min(rdt,target-elapsed),w=[0,0,TAU*(GAMMA_HZ*d.rephaseG*z+offset)/1000];
    cols=cols.map(v=>rotateVector(v,w,step));elapsed+=step;
  }
  if(!wantMatrix)return cols[2];
  return [[cols[0][0],cols[1][0],cols[2][0]],[cols[0][1],cols[1][1],cols[2][1]],[cols[0][2],cols[1][2],cols[2][2]]];
}
function solveCenteredAtZ(P,z,speciesHz=0){
  const d=pulseDefinition(P),phase=(P.phase||0)*D2R,offset=(P.b0||0)+speciesHz-(P.freq||0)+intravoxelB0AtZ(P,z,d);let cols=[[1,0,0],[0,1,0],[0,0,1]];
  for(let j=0;j<d.Nt;j++){const w=[d.omega[j]*Math.cos(phase),d.omega[j]*Math.sin(phase),TAU*(GAMMA_HZ*d.G*z+offset)/1000];cols=cols.map(v=>rotateVector(v,w,d.dt));}
  let R=[[cols[0][0],cols[1][0],cols[2][0]],[cols[0][1],cols[1][1],cols[2][1]],[cols[0][2],cols[1][2],cols[2][2]]];
  const gradHalf=TAU*GAMMA_HZ*d.G*z*(d.duration/2)/1000;
  R=rmatMul(rmatMul(rzMat(-gradHalf),R),rzMat(-gradHalf));
  return R;
}
function bankKey(P){return [P.alpha,P.tbw,P.duration,P.thickness,P.b0,P.b0Slope||0,P.freq,P.b1,P.phase,P.fatHz??FAT_HZ,P.nz||97,P.maxDelta||18,P.domainFactor||4].join('|');}
function makeBank(P){
  const key=bankKey(P);if(bankCache.has(key))return bankCache.get(key);
  const d=pulseDefinition(P),Nz=P.nz||97,z=Array.from({length:Nz},(_,i)=>-d.L/2+(i+.5)*d.L/Nz),deltas=Array.from({length:2*(P.maxDelta||18)+1},(_,i)=>i-(P.maxDelta||18));
  function species(shift){
    const R=z.map(q=>cartToCircular(solveCenteredAtZ(P,q,shift))),all={};
    const idx={pp:[0,0],pz:[2,0],mp:[0,1],mz:[2,1],zp:[0,2],zz:[2,2]};
    for(const rel of RELS){const [ro,ci]=idx[rel];all[rel]=deltas.map(delta=>{let a=cx();for(let l=0;l<Nz;l++)a=cadd(a,cmul(R[l][ro][ci],cexp(-TAU*delta*z[l]/d.L)));return cdiv(a,Nz);});}
    return {R,taps:all};
  }
  const water=species(0),fat=species(P.fatHz??FAT_HZ),combined={};
  for(const rel of RELS)combined[rel]=water.taps[rel].map((a,i)=>cabs(a)>=cabs(fat.taps[rel][i])?a:fat.taps[rel][i]);
  const out={def:d,z,deltas,water,fat,combined};bankCache.set(key,out);if(bankCache.size>28)bankCache.delete(bankCache.keys().next().value);return out;
}
function tapSet(bank,which){return which==='water'?bank.water.taps:which==='fat'?bank.fat.taps:bank.combined;}
function tapSupport(bank,which,cut){const taps=tapSet(bank,which),energy=bank.deltas.map((_,i)=>RELS.reduce((s,r)=>s+cabs(taps[r][i])**2,0)),mx=Math.max(...energy,1e-14);return bank.deltas.filter((_,i)=>Math.sqrt(energy[i]/mx)>=cut);}
function stateParams(S,phase=0){return {alpha:S.alpha,tbw:S.tbw,duration:S.duration||4,thickness:S.thickness||5,b0:S.b0||0,b0Slope:S.b0Slope||0,freq:S.freq||0,b1:S.b1||1,fatHz:Number.isFinite(S.fatHz)?S.fatHz:FAT_HZ,phase,nz:S.nz||97,maxDelta:S.maxDelta||18,domainFactor:S.domainFactor||4};}
function phaseFactor(rel,phi){return rel==='pz'?cexp(-phi):rel==='mp'?cexp(2*phi):(rel==='mz'||rel==='zp')?cexp(phi):cx(1);}
function addMetricRow(stage,items){const r=document.createElement('div');r.className='slice-metric-row';r.innerHTML=items.map(x=>`<div class="slice-metric">${x.k}<b>${x.v}</b>${x.s?`<em>${x.s}</em>`:''}</div>`).join('');stage.appendChild(r);return r;}
function addLegend(parent,items){const d=document.createElement('div');d.className='slice-legend';d.innerHTML=items.map(x=>`<span><i style="background:${x.c}"></i>${x.t}</span>`).join('');parent.appendChild(d);}
function drawAxesText(g,x,y,text,col=C.fg3,align='left',font='10px ui-monospace,monospace'){g.fillStyle=col;g.textAlign=align;g.font=font;g.fillText(text,x,y);}
function watchWidth(el,draw){let width=0,raf=0;const ro=new ResizeObserver(([entry])=>{const next=Math.round(entry.contentRect.width);if(next===width)return;width=next;cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);});ro.observe(el);CLEAN.push(()=>{cancelAnimationFrame(raf);ro.disconnect();});}

function drawPulseWaveform(cv,S,progress=1){clear(cv);const P=stateParams(S,S.phase||0),d=pulseDefinition(P),g=cv.getContext('2d'),W=cv.logicalW,H=cv.logicalH,L=58,R=16,top=20,bottom=28,pw=W-L-R,split=H*.53,total=d.duration+d.rephaseDuration,X=t=>L+t/total*pw;
  const baseline=[split*.54,split+48];g.strokeStyle=C.line;g.lineWidth=1;for(const y of baseline){g.beginPath();g.moveTo(L,y);g.lineTo(W-R,y);g.stroke();}
  drawAxesText(g,L-10,baseline[0]+3,'RF',C.fg3,'right');drawAxesText(g,L-10,baseline[1]+3,'Gz',C.fg3,'right');
  const maxEnv=Math.max(...d.env.map(Math.abs));g.beginPath();d.env.forEach((v,j)=>{const x=X((j+.5)*d.dt),y=baseline[0]-v/maxEnv*split*.33;j?g.lineTo(x,y):g.moveTo(x,y);});g.strokeStyle=C.acc2;g.lineWidth=2;g.stroke();
  g.beginPath();g.moveTo(X(0),baseline[1]);g.lineTo(X(0),baseline[1]-28);g.lineTo(X(d.duration),baseline[1]-28);g.lineTo(X(d.duration),baseline[1]);g.lineTo(X(d.duration),baseline[1]-d.rephaseG/d.G*18);g.lineTo(X(total),baseline[1]-d.rephaseG/d.G*18);g.lineTo(X(total),baseline[1]);g.strokeStyle=C.vio;g.lineWidth=1.8;g.stroke();
  g.save();g.globalAlpha=.1;g.fillStyle=C.acc2;g.fillRect(X(0),8,X(d.duration)-X(0),H-bottom-8);g.fillStyle=C.vio;g.fillRect(X(d.duration),8,X(total)-X(d.duration),H-bottom-8);g.restore();
  const tc=d.duration/2;g.strokeStyle=C.warn;g.setLineDash([4,3]);g.beginPath();g.moveTo(X(tc),8);g.lineTo(X(tc),H-bottom);g.stroke();g.setLineDash([]);drawAxesText(g,X(tc)+5,17,'RF centre',C.warn);
  const cur=clamp(progress,0,1)*total;g.strokeStyle=C.echo;g.lineWidth=2;g.beginPath();g.moveTo(X(cur),6);g.lineTo(X(cur),H-bottom);g.stroke();
  drawAxesText(g,L,H-8,'0');drawAxesText(g,X(d.duration),H-8,`${d.duration.toFixed(1)} ms`,C.fg3,'center');drawAxesText(g,W-R,H-8,`${total.toFixed(2)} ms`,C.fg3,'right');
  drawAxesText(g,W-R,18,`TBW ${S.tbw.toFixed(1)} · ${S.alpha.toFixed(0)}° · Gz ${(d.G*1e3).toFixed(2)} mT/m`,C.fg2,'right','11px ui-monospace,monospace');
}
function profileData(S,progress=1,species='water'){const P=stateParams(S,S.phase||0),d=pulseDefinition(P),N=121,z=Array.from({length:N},(_,i)=>(-d.L/2+i*d.L/(N-1))),shift=species==='fat'?FAT_HZ:0,M=z.map(q=>solveAtZ(P,q,shift,progress,false));return {d,z,M};}
function sampledIndices(n,count){const N=clamp(Math.round(count||25),8,n);return Array.from({length:N},(_,j)=>Math.round(j*(n-1)/(N-1))).filter((v,i,a)=>i===0||v!==a[i-1]);}
function drawProfile(cv,S,progress=1,species='water',spinDensity=25){clear(cv);const {d,z,M}=profileData(S,progress,species),g=cv.getContext('2d'),Q=new Plot(cv,{l:56,r:18,t:24,b:38}).dom(-d.L*500,d.L*500,-1.08,1.08);Q.frame('slice position z (mm)','magnetization',{nx:8,ny:4,xfmt:v=>v.toFixed(0)});Q.clip(()=>{
  Q.line([[-d.thickness*500,-1.08],[-d.thickness*500,1.08]],'rgba(74,168,255,.26)',1,[4,3]);Q.line([[d.thickness*500,-1.08],[d.thickness*500,1.08]],'rgba(74,168,255,.26)',1,[4,3]);
  Q.line(z.map((q,i)=>[q*1000,M[i][2]]),C.Z,1.6);
  for(let i=1;i<z.length;i++){const a=M[i-1],b=M[i],ph=Math.atan2((a[1]+b[1])*.5,(a[0]+b[0])*.5),A=[z[i-1]*1000,Math.hypot(a[0],a[1])],B=[z[i]*1000,Math.hypot(b[0],b[1])];Q.line([A,B],phaseCol(ph,.95),2.6);}
  });
  drawAxesText(g,Q.m.l+8,Q.m.t+16,'|M⊥(z)| — phase colour',C.Fp);drawAxesText(g,Q.m.l+8,Q.m.t+32,'Mz(z)',C.Z);
  const railY=Q.Y(-.77),scale=20;for(const i of sampledIndices(z.length,spinDensity)){const m=M[i],x=Q.X(z[i]*1000),ph=Math.atan2(m[1],m[0]),a=Math.hypot(m[0],m[1]);g.strokeStyle=phaseCol(ph,.8);g.lineWidth=1.2;g.beginPath();g.moveTo(x,railY);g.lineTo(x+Math.cos(ph)*scale*a,railY-Math.sin(ph)*scale*a);g.stroke();g.fillStyle=phaseCol(ph,.9);g.beginPath();g.arc(x+Math.cos(ph)*scale*a,railY-Math.sin(ph)*scale*a,2,0,TAU);g.fill();}
  drawAxesText(g,Q.m.l+8,Q.Y(-.93),`${sampledIndices(z.length,spinDensity).length} top-view transverse spins distributed along physical z`,C.fg3);
}

/* ---------------- FIGURE 21 -------------------------------------- */
FIGS.push({ch:'VI · Slice-profile-enabled PDG',num:'21',title:'Waveform-resolved slice selection creates a finite complex profile',sub:'Step through a shaped RF pulse and its Gz rephaser; every curve is generated by the Bloch equation.',build(stage,ctrl){
  const S={alpha:90,tbw:5.2,duration:4,thickness:5,b0:0,freq:0,b1:1,phase:0,progress:1,species:'water',nSpins:25};
  explain(`<b>Figure 21.</b> A finite RF waveform played with <span class="eq">Gz(t)</span> does not act as one spatially uniform hard-pulse matrix. The browser integrates the relaxation-free Bloch equation for every displayed position and basis vector. Step through the pulse to see excitation accumulate; the negative lobe then removes the nominal linear slice-gradient phase while preserving the finite transition band and residual phase profile.`);
  const row=document.createElement('div');row.className='slice-grid';stage.appendChild(row);const wave=mkCanvas(row,720,310,'A · actual waveform partition — RF span, centre reference, and Gz rephaser');const prof=mkCanvas(row,720,390,'B · finite slice profile from the same solve');
  addLegend(row,[{c:C.acc2,t:'RF envelope'},{c:C.vio,t:'Gz and rephaser'},{c:C.echo,t:'current time'},{c:C.Z,t:'Mz'},{c:C.Fp,t:'|M⊥| with phase hue'}]);
  const metrics=addMetricRow(stage,[]);
  const guide=document.createElement('div');guide.className='guided-strip';stage.appendChild(guide);
  function draw(){responsiveCanvas(wave.parentElement,wave,.40,255,350);responsiveCanvas(prof.parentElement,prof,.54,310,450);drawPulseWaveform(wave,S,S.progress);drawProfile(prof,S,S.progress,S.species,S.nSpins);const d=pulseDefinition(stateParams(S,S.phase));const time=S.progress*(d.duration+d.rephaseDuration),off=S.b0+(S.species==='fat'?FAT_HZ:0)-S.freq;metrics.innerHTML=[['slice bandwidth',`${(S.tbw/(S.duration*1e-3)/1000).toFixed(2)} kHz`],['slice gradient',`${(d.G*1e3).toFixed(2)} mT/m`],['effective offset',`${off.toFixed(0)} Hz`],['displayed spins',`${S.nSpins}`]].map(([k,v])=>`<div class="slice-metric">${k}<b>${v}</b></div>`).join('');const label=S.progress<d.duration/(d.duration+d.rephaseDuration)?'inside the RF-active span':S.progress<.995?'inside the slice rephaser':'complete pulse plus rephaser';guide.innerHTML=`<h3>${label} · t = ${time.toFixed(2)} ms</h3><div class="step-status"><b>${S.species==='water'?'Water':'Fat'}:</b> the solve uses Δf<sub>eff</sub> = Δf<sub>B0</sub> + Δf<sub>species</sub> − f<sub>RF</sub> = ${off.toFixed(0)} Hz. The coloured transverse curve reports magnitude and phase; Mz is drawn separately.</div>`;}
  let g=ctlGroup('Bloch time step');const pc=slider(g,'sequence progress',0,1,.005,S.progress,v=>(100*v).toFixed(0)+'%',v=>{S.progress=v;draw();});playToggle(g,'play RF and rephaser',()=>{S.progress=(S.progress+.012)%1.012;pc.set(S.progress);draw();},30);buttonRow(g,[{t:'before RF',f:()=>{S.progress=0;pc.set(0);draw();}},{t:'RF centre',f:()=>{const d=pulseDefinition(stateParams(S));S.progress=(d.duration*.5)/(d.duration+d.rephaseDuration);pc.set(S.progress);draw();}},{t:'after RF',f:()=>{const d=pulseDefinition(stateParams(S));S.progress=d.duration/(d.duration+d.rephaseDuration);pc.set(S.progress);draw();}},{t:'after rephaser',f:()=>{S.progress=1;pc.set(1);draw();}}]);
  let p=ctlGroup('Slice-selective pulse');slider(p,'flip angle',10,180,5,S.alpha,v=>v+'°',v=>{S.alpha=v;draw();});slider(p,'time-bandwidth product',2,10,.2,S.tbw,v=>v.toFixed(1),v=>{S.tbw=v;draw();});slider(p,'RF duration',1.5,8,.25,S.duration,v=>v.toFixed(2)+' ms',v=>{S.duration=v;draw();});slider(p,'slice thickness',2,12,.5,S.thickness,v=>v.toFixed(1)+' mm',v=>{S.thickness=v;draw();});slider(p,'B1 scale',.65,1.35,.01,S.b1,v=>v.toFixed(2),v=>{S.b1=v;draw();});slider(p,'displayed spin density',8,81,1,S.nSpins,v=>v+' spins',v=>{S.nSpins=Math.round(v);draw();});
  let f=ctlGroup('Frequency and species');segmented(f,'displayed compartment',[{t:'water',v:'water'},{t:'fat',v:'fat'}],S.species,v=>{S.species=v;draw();});slider(f,'voxel B0 off-resonance',-500,500,10,S.b0,v=>v.toFixed(0)+' Hz',v=>{S.b0=v;draw();});slider(f,'RF frequency offset',-500,500,10,S.freq,v=>v.toFixed(0)+' Hz',v=>{S.freq=v;draw();});slider(f,'RF phase',-180,180,5,S.phase,v=>v.toFixed(0)+'°',v=>{S.phase=v;draw();});note(f,'Fat is solved during the RF waveform with a −440 Hz teaching offset at 3 T; it is not added afterward as a decorative phase.');
  watchWidth(row,draw);draw();
}});

function drawConnectivity(cv,S,mode){clear(cv);const bank=makeBank(stateParams(S,0)),taps=tapSet(bank,'combined'),support=tapSupport(bank,'water',S.tapCut),g=cv.getContext('2d'),W=cv.logicalW,H=cv.logicalH,left=110,right=W-55,top=55,bottom=H-42,ys={P:top,Z:bottom-16},source=S.source;
  drawAxesText(g,18,24,mode==='local'?'order-local hard-pulse operator':'waveform-resolved sparse convolution',C.fg,'left','600 13px sans-serif');
  const srcs=source==='both'?['P','Z']:[source],x0=left;srcs.forEach((s,i)=>{const y=ys[s]+(source==='both'?(i?18:-18):0);g.fillStyle=s==='P'?C.Fp:C.Z;g.beginPath();g.arc(x0,y,8,0,TAU);g.fill();drawAxesText(g,x0-16,y+4,s==='P'?'stored F⁺':'Z',s==='P'?C.Fp:C.Z,'right');});
  const hard=Tmat(S.alpha,S.phase||0),local=[{rel:'pp',src:'P',dst:'P',a:hard[0][0]},{rel:'pz',src:'P',dst:'Z',a:hard[2][0]},{rel:'mp',src:'P',dst:'P',a:hard[0][1]},{rel:'mz',src:'P',dst:'Z',a:hard[2][1]},{rel:'zp',src:'Z',dst:'P',a:hard[0][2]},{rel:'zz',src:'Z',dst:'Z',a:hard[2][2]}];
  let edges=[];if(mode==='local')edges=local.filter(e=>srcs.includes(e.src)).map(e=>({...e,d:0}));else{for(const rel of RELS){const src=['zp','zz'].includes(rel)?'Z':'P';if(!srcs.includes(src))continue;const dst=['pz','mz','zz'].includes(rel)?'Z':'P';bank.deltas.forEach((d,i)=>{const a=taps[rel][i];if(support.includes(d)&&cabs(a)>=S.tapCut*.18)edges.push({rel,src,dst,a,d});});}}
  const ds=mode==='local'?[0]:[...new Set(edges.map(e=>e.d))].sort((a,b)=>a-b),span=Math.max(1,Math.max(...ds.map(Math.abs))),X=d=>right-(span-d)/(2*span)*(right-left-100);
  for(const d of ds){const x=X(d);g.strokeStyle='rgba(107,119,133,.16)';g.beginPath();g.moveTo(x,top-28);g.lineTo(x,bottom+8);g.stroke();drawAxesText(g,x,bottom+28,`Δ${d>=0?'+':''}${d}`,C.fg3,'center');for(const dst of ['P','Z']){g.strokeStyle='rgba(107,119,133,.25)';g.fillStyle=C.panel;g.beginPath();g.arc(x,ys[dst],7,0,TAU);g.fill();g.stroke();}}
  const mx=Math.max(...edges.map(e=>cabs(e.a)),1e-9);for(const e of edges){const sy=ys[e.src]+(source==='both'?(e.src==='Z'?18:-18):0),tx=X(e.d),ty=ys[e.dst],mag=cabs(e.a),col=phaseCol(carg(e.a),.55+.4*mag/mx);g.strokeStyle=col;g.lineWidth=.35+4*mag/mx;g.beginPath();g.moveTo(x0+9,sy);g.bezierCurveTo(x0+90,sy,tx-60,ty,tx-8,ty);g.stroke();g.fillStyle=e.dst==='P'?C.Fp:C.Z;g.beginPath();g.arc(tx,ty,3+3*mag/mx,0,TAU);g.fill();}
  drawAxesText(g,right,top-14,'output F⁺',C.Fp,'right');drawAxesText(g,right,ys.Z-14,'output Z',C.Z,'right');drawAxesText(g,18,H-10,mode==='local'?'Only Δ=0 exists: channel mixing stays at one order.':`${support.length} water-support offsets applied to nominal combined taps · width = |tap| · hue = phase`,C.fg3);
}

function reconstructedProfile(bank,species,support){
  const obj=species==='fat'?bank.fat:bank.water,taps=obj.taps,out=[];
  for(let i=0;i<bank.z.length;i++){
    const z=bank.z[i],directP=obj.R[i][0][2],directZ=obj.R[i][2][2];let recP=cx(),recZ=cx();
    for(const d of support){const j=bank.deltas.indexOf(d),basis=cexp(TAU*d*z/bank.def.L);recP=cadd(recP,cmul(taps.zp[j],basis));recZ=cadd(recZ,cmul(taps.zz[j],basis));}
    out.push({z,directP,directZ,recP,recZ});
  }
  const rmsP=Math.sqrt(out.reduce((s,q)=>s+(Math.SQRT2*cabs(q.recP)-Math.SQRT2*cabs(q.directP))**2,0)/out.length),rmsZ=Math.sqrt(out.reduce((s,q)=>s+(q.recZ.re-q.directZ.re)**2,0)/out.length);
  return {out,rmsP,rmsZ};
}
function drawReconstructedProfile(cv,S){
  clear(cv);const bank=makeBank(stateParams(S,0)),support=tapSupport(bank,'water',S.tapCut),R=reconstructedProfile(bank,S.profileSpecies,support),g=cv.getContext('2d'),d=bank.def,Q=new Plot(cv,{l:60,r:22,t:30,b:42}).dom(-d.L*500,d.L*500,-1.08,1.08);
  Q.frame('slice position z (mm)','magnetization',{nx:8,ny:4,xfmt:v=>v.toFixed(0)});Q.clip(()=>{
    Q.line([[-d.thickness*500,-1.08],[-d.thickness*500,1.08]],'rgba(74,168,255,.24)',1,[4,3]);Q.line([[d.thickness*500,-1.08],[d.thickness*500,1.08]],'rgba(74,168,255,.24)',1,[4,3]);
    Q.line(R.out.map(q=>[q.z*1000,Math.SQRT2*cabs(q.directP)]),'rgba(230,237,243,.64)',1.25,[5,4]);Q.line(R.out.map(q=>[q.z*1000,q.directZ.re]),'rgba(154,167,181,.52)',1,[2,4]);Q.line(R.out.map(q=>[q.z*1000,q.recZ.re]),C.Z,1.7);
    for(let i=1;i<R.out.length;i++){const a=R.out[i-1],b=R.out[i],ph=carg(cadd(a.recP,b.recP));Q.line([[a.z*1000,Math.SQRT2*cabs(a.recP)],[b.z*1000,Math.SQRT2*cabs(b.recP)]],phaseCol(ph,.98),2.5);}
  });
  drawAxesText(g,Q.m.l+8,Q.m.t+15,'retained-tap |M⊥| — phase colour',C.Fp);drawAxesText(g,Q.m.l+8,Q.m.t+31,'retained-tap Mz',C.Z);drawAxesText(g,Q.m.l+8,Q.m.t+47,'full Bloch reference — dashed gray',C.fg2);
  const railY=Q.Y(-.78),scale=22;for(const i of sampledIndices(R.out.length,S.nSpins)){const q=R.out[i],ph=carg(q.recP),a=Math.SQRT2*cabs(q.recP),x=Q.X(q.z*1000),xe=x+Math.cos(ph)*scale*a,ye=railY-Math.sin(ph)*scale*a;g.strokeStyle=phaseCol(ph,.85);g.lineWidth=1.25;g.beginPath();g.moveTo(x,railY);g.lineTo(xe,ye);g.stroke();g.fillStyle=phaseCol(ph,.98);g.beginPath();g.arc(xe,ye,2,0,TAU);g.fill();}
  drawAxesText(g,Q.m.l+8,Q.Y(-.94),`${sampledIndices(R.out.length,S.nSpins).length} reconstructed transverse spins along physical z`,C.fg3);drawAxesText(g,cv.logicalW-22,18,`${S.profileSpecies} · ${support.length}/${bank.deltas.length} offsets · RMS⊥ ${R.rmsP.toExponential(2)} · RMSz ${R.rmsZ.toExponential(2)}`,C.fg2,'right','11px ui-monospace,monospace');
  return {support: support.length,total:bank.deltas.length,rmsP:R.rmsP,rmsZ:R.rmsZ};
}

/* ---------------- FIGURE 22 -------------------------------------- */
FIGS.push({ch:'VI · Slice-profile-enabled PDG',num:'22',title:'From order-local RF mixing to cross-order slice coupling',sub:'The hard-pulse matrix is the Δ=0 special case; a finite slice pulse connects one parent to many orders.',build(stage,ctrl){
  const S={alpha:90,tbw:5.2,duration:4,thickness:5,b0:0,freq:0,b1:1,phase:0,tapCut:.06,source:'both',profileSpecies:'water',nSpins:29};
  explain(`<b>Figure 22.</b> A hard pulse is spatially uniform, so its Fourier representation contains only <span class="eq">Δ=0</span> and RF mixing is order-local. A slice-selective propagator varies with z. Its retained Fourier matrices <span class="eq">R[Δ]</span> therefore send one parent to multiple output orders: <span class="eq">Qout[n] = ΣΔ R[Δ] Qin[n−Δ]</span>. Panel C reconstructs the physical profile from exactly the retained support and compares it with the full RF-centred Bloch result.`);
  const row=document.createElement('div');row.className='slice-grid';stage.appendChild(row);const a=mkCanvas(row,720,360,'A · hard pulse: one local 3×3 channel rotation');const b=mkCanvas(row,720,360,'B · slice pulse: sparse cross-order convolution');addLegend(stage,RELS.map(r=>({c:REL_COLOR[r],t:`${r}: ${REL_LABEL[r]}`})));const prof=mkCanvas(stage,1380,420,'C · slice profile reconstructed from the retained water-derived support');prof.parentElement.classList.add('slice-wide');const metrics=addMetricRow(stage,[]);
  const eq=document.createElement('div');eq.className='slice-equation';eq.innerHTML='<div><b>Hard pulse</b><code>Qout[n] = Rhard Qin[n]\nRhard[Δ] = 0 for Δ ≠ 0</code></div><div><b>Finite slice pulse</b><code>Qout[n] = ΣΔ R[Δ] Qin[n−Δ]\nkz,out = kz,in + Δ dk</code></div>';stage.appendChild(eq);
  function draw(){responsiveCanvas(a.parentElement,a,.49,300,430);responsiveCanvas(b.parentElement,b,.49,300,430);const wp=Math.max(720,prof.parentElement.clientWidth-18);fit(prof,wp,Math.max(350,Math.min(500,wp*.34)));drawConnectivity(a,S,'local');drawConnectivity(b,S,'cross');const q=drawReconstructedProfile(prof,S);metrics.innerHTML=[['water-derived support',`${q.support} of ${q.total} offsets`],['transverse RMS error',q.rmsP.toExponential(2)],['longitudinal RMS error',q.rmsZ.toExponential(2)],['displayed spins',`${S.nSpins}`]].map(([k,v])=>`<div class="slice-metric">${k}<b>${v}</b></div>`).join('');}
  let g=ctlGroup('Connectivity and retained support');segmented(g,'input family',[{t:'F⁺ + implicit F⁻',v:'P'},{t:'Z',v:'Z'},{t:'both',v:'both'}],S.source,v=>{S.source=v;draw();});slider(g,'relative RF-tap cutoff',.01,.25,.005,S.tapCut,v=>(100*v).toFixed(1)+'%',v=>{S.tapCut=v;draw();});segmented(g,'reconstructed profile',[{t:'water',v:'water'},{t:'fat',v:'fat'}],S.profileSpecies,v=>{S.profileSpecies=v;draw();});slider(g,'displayed spin density',8,81,1,S.nSpins,v=>v+' spins',v=>{S.nSpins=Math.round(v);draw();});
  let p=ctlGroup('Pulse that generates R[Δ]');slider(p,'flip angle',15,180,5,S.alpha,v=>v+'°',v=>{S.alpha=v;draw();});slider(p,'time-bandwidth product',2,10,.2,S.tbw,v=>v.toFixed(1),v=>{S.tbw=v;draw();});slider(p,'RF duration',1.5,8,.25,S.duration,v=>v.toFixed(2)+' ms',v=>{S.duration=v;draw();});slider(p,'slice thickness',2,12,.5,S.thickness,v=>v.toFixed(1)+' mm',v=>{S.thickness=v;draw();});slider(p,'B1 scale',.65,1.35,.01,S.b1,v=>v.toFixed(2),v=>{S.b1=v;draw();});slider(p,'B0 off-resonance',-400,400,10,S.b0,v=>v+' Hz',v=>{S.b0=v;draw();});slider(p,'RF frequency offset',-400,400,10,S.freq,v=>v+' Hz',v=>{S.freq=v;draw();});note(p,'Panel B uses the nominal combined water/fat tap amplitudes with the water-derived support, matching the supplied prepass. Panel C reconstructs one physical species with that same support. The dashed profile is the full Bloch reference; only the coloured retained-tap reconstruction changes when the cutoff changes.');
  watchWidth(row,draw);draw();
}});

function drawTapBank(cv,S){clear(cv);const bank=makeBank(stateParams(S,0)),sets={water:bank.water.taps,fat:bank.fat.taps,combined:bank.combined},taps=sets[S.species],g=cv.getContext('2d'),W=cv.logicalW,H=cv.logicalH,L=66,R=22,T=34,B=34,rowH=(H-T-B)/RELS.length,mx=Math.max(...RELS.flatMap(r=>taps[r].map(cabs)),1e-9),support=tapSupport(bank,S.species,S.tapCut),X=d=>L+(d-bank.deltas[0])/(bank.deltas.at(-1)-bank.deltas[0])*(W-L-R);
  for(let ri=0;ri<RELS.length;ri++){const rel=RELS[ri],y0=T+ri*rowH+rowH*.78;g.strokeStyle=C.line;g.beginPath();g.moveTo(L,y0);g.lineTo(W-R,y0);g.stroke();drawAxesText(g,L-10,T+ri*rowH+rowH*.52,rel,REL_COLOR[rel],'right','700 11px ui-monospace,monospace');bank.deltas.forEach((d,i)=>{const a=taps[rel][i],m=cabs(a)/mx,x=X(d),h=m*rowH*.62,kept=support.includes(d)&&m>=S.tapCut*.15;g.strokeStyle=kept?phaseCol(carg(a),.95):'rgba(107,119,133,.22)';g.lineWidth=kept?1.35:.65;g.beginPath();g.moveTo(x,y0);g.lineTo(x,y0-h);g.stroke();if(kept){g.fillStyle=phaseCol(carg(a),.98);g.beginPath();g.arc(x,y0-h,1.6+2.2*m,0,TAU);g.fill();}});}
  [-15,-10,-5,0,5,10,15].forEach(d=>drawAxesText(g,X(d),H-11,String(d),d===0?C.echo:C.fg3,'center'));drawAxesText(g,(L+W-R)/2,H-2,'tap offset Δ',C.fg2,'center');drawAxesText(g,L,18,`${S.species} bank · phase hue, magnitude height · ${support.length} offsets retained`,C.fg2);
}
function drawSpatialOperator(cv,S){clear(cv);const bank=makeBank(stateParams(S,0)),source=S.species==='water'?bank.water:S.species==='fat'?bank.fat:null,rel=S.rel,g=cv.getContext('2d'),W=cv.logicalW,H=cv.logicalH,L=55,R=18,T=28,B=35,d=bank.def;
  function vals(which){const obj=which==='water'?bank.water:bank.fat,idx={pp:[0,0],pz:[2,0],mp:[0,1],mz:[2,1],zp:[0,2],zz:[2,2]}[rel];return obj.R.map(M=>M[idx[0]][idx[1]]);}
  const lists=S.species==='combined'?[['water',vals('water'),C.Fp],['fat',vals('fat'),C.Fm]]:[[S.species,vals(S.species),S.species==='water'?C.Fp:C.Fm]],all=lists.flatMap(x=>x[1].map(cabs)),mx=Math.max(...all,1e-8),Q=new Plot(cv,{l:L,r:R,t:T,b:B}).dom(-d.L*500,d.L*500,-mx*1.08,mx*1.08);Q.frame('slice position z (mm)',`Rch(z) · ${rel}`,{nx:6,ny:4});
  for(const [name,v,col] of lists){Q.line(bank.z.map((z,i)=>[z*1000,v[i].re]),col,1.7);Q.line(bank.z.map((z,i)=>[z*1000,v[i].im]),col,1,[4,3]);drawAxesText(g,W-24,T+14+(name==='fat'?16:0),`${name}: Re solid / Im dashed`,col,'right');}
  drawAxesText(g,L,17,`${REL_LABEL[rel]} · RF-centred propagator`,REL_COLOR[rel]);
}

/* ---------------- FIGURE 23 -------------------------------------- */
FIGS.push({ch:'VI · Slice-profile-enabled PDG',num:'23',title:'RF-centred Fourier taps: water, fat, and the nominal graph bank',sub:'Inspect all six stored channel relations and how field, frequency, phase, TBW, and species alter their sparse support.',build(stage,ctrl){
  const S={alpha:90,tbw:5.2,duration:4,thickness:5,b0:0,freq:0,b1:1,phase:0,tapCut:.035,species:'combined',rel:'zp'};
  explain(`<b>Figure 23.</b> The end-to-end Bloch propagator is transformed to the RF-centre convention <span class="eq">Rc(z)=Pa⁻¹(z) Rraw(z) Pb⁻¹(z)</span> before Fourier projection, preventing the slice-gradient phase from being counted twice. Six independent reduced-channel tap families are stored. Water and fat are solved separately during the RF span; the nominal graph bank selects, for every relation and Δ, the complex coefficient with the larger magnitude—exactly the component-wise rule in your Python code.`);
  const row=document.createElement('div');row.className='slice-grid';stage.appendChild(row);const pos=mkCanvas(row,720,355,'A · selected entry of the RF-centred spatial propagator');const tap=mkCanvas(row,720,480,'B · six-channel Fourier tap bank');
  const metrics=addMetricRow(stage,[]);const eq=document.createElement('div');eq.className='slice-equation';eq.innerHTML='<div><b>Centre reference and Fourier projection</b><code>Rc(z) = Pa⁻¹(z) Rraw(z) Pb⁻¹(z)\nR[Δ] = (1/L) ∫ Rc(z)e^(−i2πΔz/L) dz</code></div><div><b>Nominal water/fat support</b><code>combined[rel,Δ] = arg max_{c∈{water,fat}} |c[rel,Δ]|\nThe winning complex tap is retained; taps are not summed.</code></div>';stage.appendChild(eq);
  function draw(){responsiveCanvas(pos.parentElement,pos,.48,300,420);responsiveCanvas(tap.parentElement,tap,.66,390,560);const P=stateParams(S,0),bank=makeBank(P),supp=tapSupport(bank,S.species,S.tapCut);drawSpatialOperator(pos,S);drawTapBank(tap,S);const arr=tapSet(bank,S.species)[S.rel],i0=bank.deltas.indexOf(0),max=Math.max(...arr.map(cabs));metrics.innerHTML=[['domain / dk',`${(bank.def.L*1000).toFixed(1)} mm / ${bank.def.dk.toFixed(1)} m⁻¹`],['retained offsets',`${supp.length} of ${bank.deltas.length}`],['selected zero tap',`${cabs(arr[i0]).toFixed(3)} ∠ ${(carg(arr[i0])/D2R).toFixed(0)}°`],['selected peak',`${max.toFixed(3)} (${S.rel})`]].map(([k,v])=>`<div class="slice-metric">${k}<b>${v}</b></div>`).join('');}
  let g=ctlGroup('Tap bank');segmented(g,'species bank',[{t:'water',v:'water'},{t:'fat',v:'fat'},{t:'combined nominal',v:'combined'}],S.species,v=>{S.species=v;draw();});selectBox(g,'selected spatial relation',RELS.map(r=>({v:r,t:`${r} · ${REL_LABEL[r]}`})),S.rel,v=>{S.rel=v;draw();});slider(g,'relative support cutoff',.005,.2,.005,S.tapCut,v=>(100*v).toFixed(1)+'%',v=>{S.tapCut=v;draw();});
  let p=ctlGroup('Waveform and voxel bin');slider(p,'flip angle',15,180,5,S.alpha,v=>v+'°',v=>{S.alpha=v;draw();});slider(p,'time-bandwidth product',2,10,.2,S.tbw,v=>v.toFixed(1),v=>{S.tbw=v;draw();});slider(p,'B0 off-resonance',-600,600,10,S.b0,v=>v+' Hz',v=>{S.b0=v;draw();});slider(p,'RF frequency offset',-600,600,10,S.freq,v=>v+' Hz',v=>{S.freq=v;draw();});slider(p,'B1 scale',.7,1.3,.01,S.b1,v=>v.toFixed(2),v=>{S.b1=v;draw();});
  let ph=ctlGroup('Analytic phase cycling');slider(ph,'RF phase',-180,180,5,S.phase,v=>v+'°',v=>{S.phase=v;draw();});note(ph,'For graph replay the cached zero-phase bank is rephased analytically: pp and zz unchanged; pz·e⁻ⁱφ; mp·e⁺ⁱ²φ; mz and zp·e⁺ⁱφ. The tap plot remains the cached phase-stripped bank so frequency/B0 changes are not confused with phase cycling.');
  watchWidth(row,draw);draw();
}});

function compileSliceGraph(S){
  const bank=makeBank(stateParams(S,0)),taps=tapSet(bank,S.species||'combined'),support=tapSupport(bank,'water',S.tapCut),dk=bank.def.dk,merge=Math.max(.02,S.mergeTol||.15)*dk;let nextId=1,current=[{id:0,type:'Z',k:0,amp:cx(1),rep:0,forced:true,parents:[]}],nodes=current.slice(),edges=[],stats=[];
  const getTap=(rel,d)=>{const i=bank.deltas.indexOf(d);return taps[rel][i];};
  for(let rep=1;rep<=S.reps;rep++){
    const phi=((S.phase0||0)+(rep-1)*(S.phaseInc||0))*D2R,raw=[];
    function spawn(parent,srcK,srcAmp,rel,d,type){let w=cmul(getTap(rel,d),phaseFactor(rel,phi)),amp=cmul(srcAmp,w);if(cabs(amp)<1e-12)return;raw.push({type,k:srcK+d*dk,amp,parent,rel,d,w,forced:d===0||parent.forced});}
    for(const p of current){for(const d of support){if(p.type==='Z'){spawn(p,p.k,p.amp,'zz',d,'Z');spawn(p,p.k,p.amp,'zp',d,'P');}else{spawn(p,p.k,p.amp,'pp',d,'P');spawn(p,p.k,p.amp,'pz',d,'Z');const ma=cconj(p.amp),mk=-p.k;spawn(p,mk,ma,'mp',d,'P');spawn(p,mk,ma,'mz',d,'Z');}}}
    const groups=new Map();for(const q of raw){const kq=Math.round(q.k/merge)*merge,key=q.type+'|'+Math.round(kq/merge);let a=groups.get(key);if(!a){a={id:nextId++,type:q.type,k:kq,amp:cx(),rep,forced:false,parents:[]};groups.set(key,a);}a.amp=cadd(a.amp,q.amp);a.forced=a.forced||q.forced;a.parents.push(q);}
    const merged=[...groups.values()],eligible=merged.filter(n=>cabs(n.amp)>=S.stateThr||n.forced),Pnodes=eligible.filter(n=>n.type==='P').sort((a,b)=>cabs(b.amp)-cabs(a.amp)),Znodes=eligible.filter(n=>n.type==='Z').sort((a,b)=>cabs(b.amp)-cabs(a.amp));
    function keepFamily(a){const forced=a.filter(n=>n.forced),rest=a.filter(n=>!n.forced),cap=Math.max(S.cap,forced.length);return [...forced,...rest.slice(0,Math.max(0,cap-forced.length))];}
    current=[...keepFamily(Pnodes),...keepFamily(Znodes)].sort((a,b)=>a.k-b.k||a.type.localeCompare(b.type));const keptIds=new Set(current.map(n=>n.id));
    for(const n of current)for(const q of n.parents)edges.push({from:q.parent.id,to:n.id,rel:q.rel,d:q.d,w:q.w,rep});
    nodes.push(...current);stats.push({rep,raw:raw.length,merged:merged.length,eligible:eligible.length,kept:current.length,pruned:merged.length-current.length,P:current.filter(n=>n.type==='P').length,Z:current.filter(n=>n.type==='Z').length,forced:current.filter(n=>n.forced).length});
    if(!current.length)break;
  }
  return {bank,support,nodes,edges,stats,current,dk,merge};
}
function drawGrowth(cv,S,G){clear(cv);const g=cv.getContext('2d'),W=cv.logicalW,H=cv.logicalH,L=58,R=20,T=28,B=38,max=Math.max(...G.stats.flatMap(s=>[s.raw,s.merged,s.kept]),1),Q=new Plot(cv,{l:L,r:R,t:T,b:B}).dom(.5,S.reps+.5,0,max*1.12);Q.frame('RF repetition','state contributions / nodes',{nx:S.reps,ny:5,xfmt:v=>Number.isInteger(v)?v:''});const bw=.19;for(const s of G.stats){Q.bar(s.rep-.22,s.raw,bw,'rgba(255,138,92,.55)');Q.bar(s.rep,s.merged,bw,'rgba(199,146,234,.7)');Q.bar(s.rep+.22,s.kept,bw,'rgba(63,214,140,.82)');}drawAxesText(g,L,17,'spawn first → merge equal keys → prune active set',C.fg2);drawAxesText(g,W-18,17,`tap offsets ${G.support.length} · max ${max}`,C.fg3,'right');}
function drawStateCloud(cv,S,G,highlightAncestors=false){clear(cv);const g=cv.getContext('2d'),W=cv.logicalW,H=cv.logicalH,L=64,R=26,T=31,B=42,kmax=Math.max(...G.nodes.map(n=>Math.abs(n.k)),G.dk),Y=k=>T+(kmax-k)/(2*kmax)*(H-T-B),X=r=>L+r/S.reps*(W-L-R);[-kmax,0,kmax].forEach(k=>{const y=Y(k);g.strokeStyle=k===0?'rgba(255,210,63,.24)':'rgba(107,119,133,.16)';g.beginPath();g.moveTo(L,y);g.lineTo(W-R,y);g.stroke();drawAxesText(g,L-8,y+3,k.toFixed(0),k===0?C.echo:C.fg3,'right');});for(let r=0;r<=S.reps;r++){const x=X(r);g.strokeStyle='rgba(107,119,133,.16)';g.beginPath();g.moveTo(x,T);g.lineTo(x,H-B);g.stroke();drawAxesText(g,x,H-17,String(r),C.fg3,'center');}
  const byId=new Map(G.nodes.map(n=>[n.id,n])),ampMax=Math.max(...G.nodes.map(n=>cabs(n.amp)),1e-9);for(const e of G.edges){const a=byId.get(e.from),b=byId.get(e.to);if(!a||!b)continue;g.strokeStyle=REL_COLOR[e.rel]+'55';g.lineWidth=.35+1.3*cabs(e.w);g.beginPath();g.moveTo(X(a.rep),Y(a.k));g.lineTo(X(b.rep),Y(b.k));g.stroke();}
  for(const n of G.nodes){const x=X(n.rep),y=Y(n.k),r=2.4+4*Math.sqrt(cabs(n.amp)/ampMax);g.fillStyle=n.type==='P'?C.Fp:C.Z;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();if(n.forced){g.strokeStyle=C.echo;g.lineWidth=1;g.stroke();}}
  drawAxesText(g,18,(T+H-B)/2,'kz (m⁻¹)',C.fg2,'center');drawAxesText(g,(L+W-R)/2,H-3,'RF repetition',C.fg2,'center');drawAxesText(g,L,17,'retained distribution nodes · exact ancestry edges',C.fg2);
}

/* ---------------- FIGURE 24 -------------------------------------- */
FIGS.push({ch:'VI · Slice-profile-enabled PDG',num:'24',title:'State explosion is controlled after ancestry-preserving merge',sub:'Watch raw RF partitions grow, merge at equal quantized keys, and then enter the bounded active set.',build(stage,ctrl){
  const S={alpha:60,tbw:5.2,duration:4,thickness:5,b0:0,freq:0,b1:1,species:'combined',tapCut:.07,stateThr:.004,mergeTol:.15,cap:55,reps:4,phase0:0,phaseInc:117};
  explain(`<b>Figure 24.</b> Every retained RF offset first creates a distinct contribution edge. Only afterward are children with the same output family and quantized <span class="eq">(kx,ky,kz,τ)</span> key complex-summed. The active set is then bounded by amplitude threshold and a per-family cap, while zero-offset lineage is protected. Changing RF support and changing state pruning are deliberately separate experiments.`);
  const row=document.createElement('div');row.className='slice-grid';stage.appendChild(row);const bars=mkCanvas(row,720,350,'A · raw contributions, equal-key merge, and retained state count');const cloud=mkCanvas(row,720,430,'B · compiled kz graph with ancestry retained');addLegend(row,[{c:C.Fm,t:'raw spawned contributions'},{c:C.vio,t:'merged unique keys'},{c:C.ok,t:'retained active nodes'},{c:C.echo,t:'protected Δ=0 lineage'}]);const metrics=addMetricRow(stage,[]);
  function draw(){responsiveCanvas(bars.parentElement,bars,.48,300,420);responsiveCanvas(cloud.parentElement,cloud,.58,340,500);const G=compileSliceGraph(S);drawGrowth(bars,S,G);drawStateCloud(cloud,S,G);const last=G.stats.at(-1)||{raw:0,merged:0,kept:0,forced:0};metrics.innerHTML=[['water-derived RF support',`${G.support.length} offsets`],['last RF spawn',`${last.raw} contributions`],['after exact-key merge',`${last.merged} nodes`],['active set',`${last.kept} kept · ${last.forced} protected`]].map(([k,v])=>`<div class="slice-metric">${k}<b>${v}</b></div>`).join('');}
  let q=ctlGroup('Graph depth and RF support');slider(q,'RF repetitions',1,6,1,S.reps,v=>v,v=>{S.reps=Math.round(v);draw();});slider(q,'relative RF-tap cutoff',.015,.2,.005,S.tapCut,v=>(100*v).toFixed(1)+'%',v=>{S.tapCut=v;draw();});slider(q,'pulse TBW',2,10,.2,S.tbw,v=>v.toFixed(1),v=>{S.tbw=v;draw();});slider(q,'flip angle',15,150,5,S.alpha,v=>v+'°',v=>{S.alpha=v;draw();});
  let p=ctlGroup('Merge and pruning');slider(p,'state amplitude threshold',0,.04,.001,S.stateThr,v=>v.toFixed(3),v=>{S.stateThr=v;draw();});slider(p,'state cap per family',10,120,5,S.cap,v=>v,v=>{S.cap=Math.round(v);draw();});slider(p,'kz merge bin / dk',.05,.8,.05,S.mergeTol,v=>v.toFixed(2),v=>{S.mergeTol=v;draw();});slider(p,'RF phase increment',0,180,3,S.phaseInc,v=>v+'°',v=>{S.phaseInc=v;draw();});note(p,'Edge ancestry is recorded before merge. A protected Δ=0 ancestor can keep a state even when its present amplitude lies below the threshold, mirroring the supplied Rust prepass safeguard.');
  watchWidth(row,draw);draw();
}});

function drawRepSequence(cv,S){clear(cv);const g=cv.getContext('2d'),W=cv.logicalW,H=cv.logicalH,L=50,R=15,T=10,row={RF:42,Gz:92},pw=W-L-R,X=t=>L+t/S.reps*pw;for(const [lab,y] of Object.entries(row)){g.strokeStyle=C.line;g.beginPath();g.moveTo(L,y);g.lineTo(W-R,y);g.stroke();drawAxesText(g,L-9,y+3,lab,C.fg3,'right');}
  for(let r=0;r<S.reps;r++){const x=X(r+.22),width=pw/S.reps*.30;g.strokeStyle=C.acc2;g.lineWidth=1.5;g.beginPath();for(let j=-14;j<=14;j++){const u=j/4.3,v=sinc(u)*(.54+.46*Math.cos(Math.PI*j/14)),xx=x+(j+14)/28*width,yy=row.RF-v*18;j===-14?g.moveTo(xx,yy):g.lineTo(xx,yy);}g.stroke();g.strokeStyle=C.vio;g.beginPath();g.moveTo(x,row.Gz);g.lineTo(x,row.Gz-18);g.lineTo(x+width,row.Gz-18);g.lineTo(x+width,row.Gz);g.lineTo(x+width,row.Gz+12);g.lineTo(x+width*1.34,row.Gz+12);g.lineTo(x+width*1.34,row.Gz);g.stroke();drawAxesText(g,x+width*.5,18,`${S.alpha}° / ${((S.phase0+r*S.phaseInc)%360).toFixed(0)}°`,C.acc2,'center');drawAxesText(g,X(r+.5),H-8,`rep ${r+1}`,C.fg3,'center');}
}
function ancestorSet(G,id){const parents=new Map();for(const e of G.edges){if(!parents.has(e.to))parents.set(e.to,[]);parents.get(e.to).push(e.from);}const out=new Set([id]),stack=[id];while(stack.length){for(const p of parents.get(stack.pop())||[])if(!out.has(p)){out.add(p);stack.push(p);}}return out;}
function drawInteractiveGraph(cv,S,G,selected,hits){clear(cv);hits.length=0;const g=cv.getContext('2d'),W=cv.logicalW,H=cv.logicalH,L=70,R=28,T=38,B=44,kmax=Math.max(...G.nodes.map(n=>Math.abs(n.k)),G.dk),X=r=>L+r/S.reps*(W-L-R),Y=k=>T+(kmax-k)/(2*kmax)*(H-T-B),byId=new Map(G.nodes.map(n=>[n.id,n])),anc=selected==null?new Set():ancestorSet(G,selected),ampMax=Math.max(...G.nodes.map(n=>cabs(n.amp)),1e-9);
  for(let r=0;r<=S.reps;r++){const x=X(r);g.strokeStyle='rgba(107,119,133,.18)';g.beginPath();g.moveTo(x,T);g.lineTo(x,H-B);g.stroke();drawAxesText(g,x,H-17,r?'after RF '+r:'equilibrium',C.fg3,'center');}[-kmax,0,kmax].forEach(k=>{const y=Y(k);g.strokeStyle=k===0?'rgba(255,210,63,.25)':'rgba(107,119,133,.14)';g.beginPath();g.moveTo(L,y);g.lineTo(W-R,y);g.stroke();drawAxesText(g,L-8,y+3,k.toFixed(0),k===0?C.echo:C.fg3,'right');});
  for(const e of G.edges){const a=byId.get(e.from),b=byId.get(e.to);if(!a||!b)continue;const hot=selected!=null&&anc.has(a.id)&&anc.has(b.id);g.strokeStyle=hot?REL_COLOR[e.rel]:'rgba(107,119,133,.18)';g.lineWidth=hot?1.8:.45+1.1*cabs(e.w);g.beginPath();g.moveTo(X(a.rep)+6,Y(a.k));g.bezierCurveTo((X(a.rep)+X(b.rep))/2,Y(a.k),(X(a.rep)+X(b.rep))/2,Y(b.k),X(b.rep)-6,Y(b.k));g.stroke();}
  for(const n of G.nodes){const x=X(n.rep),y=Y(n.k),r=3+5*Math.sqrt(cabs(n.amp)/ampMax),hot=n.id===selected||anc.has(n.id);g.globalAlpha=selected==null||hot?1:.28;g.fillStyle=n.type==='P'?C.Fp:C.Z;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();if(n.forced||n.id===selected){g.strokeStyle=n.id===selected?C.echo:'rgba(255,210,63,.7)';g.lineWidth=n.id===selected?2:1;g.stroke();}g.globalAlpha=1;hits.push({x,y,r:Math.max(8,r+3),n});}
  drawAxesText(g,L,19,selected==null?'click a node to trace its retained ancestry':`selected node ${selected} · highlighted parents are retained before merging`,selected==null?C.fg2:C.echo);drawAxesText(g,20,(T+H-B)/2,'kz (m⁻¹)',C.fg2,'center');drawAxesText(g,W-R,H-3,`${G.nodes.length} retained nodes · ${G.edges.length} ancestry edges`,C.fg3,'right');
}

/* ---------------- FIGURE 25 -------------------------------------- */
FIGS.push({ch:'VI · Slice-profile-enabled PDG',num:'25',title:'A small slice-profile-enabled PDG, compiled and explored',sub:'Two to four slice-selective repetitions expose the actual channel, tap, phase, merge, and ancestry structure.',build(stage,ctrl){
  const S={alpha:60,tbw:5.2,duration:4,thickness:5,b0:0,freq:0,b1:1,species:'combined',tapCut:.075,stateThr:.005,mergeTol:.15,cap:45,reps:3,phase0:117,phaseInc:117};let G,selected=null,hits=[];
  explain(`<b>Figure 25.</b> This is the complete compact teaching graph: each RF event uses the centre-referenced water/fat tap bank, spawns relation- and offset-specific children, merges equal family–trajectory keys, and retains every surviving ancestry edge. Click a node to trace the exact parents that feed it. Change pulse phase or frequency to see edge weights and node cancellation change without relabelling the underlying physics.`);
  const seqWrap=document.createElement('div');seqWrap.className='slice-wide';stage.appendChild(seqWrap);const seq=mkCanvas(seqWrap,1380,135,'A · repeated slice-selective RF spans — each waveform becomes one graph transition at its centre');const graphWrap=document.createElement('div');graphWrap.className='card slice-wide interactive-graph';graphWrap.innerHTML='<div class="cardtitle">B · retained slice-profile-enabled PDG — click a node to trace ancestry</div><div class="interaction-note">Blue nodes are stored F⁺ distributions; green nodes are Z distributions; edge color identifies the RF relation. Gold rings mark protected zero-offset lineage.</div>';const cv=document.createElement('canvas');graphWrap.appendChild(cv);const tip=document.createElement('div');tip.className='graph-tooltip';graphWrap.appendChild(tip);stage.appendChild(graphWrap);addLegend(stage,RELS.map(r=>({c:REL_COLOR[r],t:`${r}: ${REL_LABEL[r]}`})));const metrics=addMetricRow(stage,[]);
  function draw(){const w1=Math.max(720,seqWrap.clientWidth-18);fit(seq,w1,Math.max(120,Math.min(160,w1*.105)));const w2=Math.max(720,graphWrap.clientWidth-18);fit(cv,w2,Math.max(430,Math.min(610,w2*.43)));G=compileSliceGraph(S);if(selected!=null&&!G.nodes.some(n=>n.id===selected))selected=null;drawRepSequence(seq,S);drawInteractiveGraph(cv,S,G,selected,hits);const last=G.stats.at(-1)||{P:0,Z:0,kept:0};metrics.innerHTML=[['pulse IDs',`${S.reps} reps / 1 cached phase-stripped key`],['water-derived RF support',`${G.support.length} offsets`],['final active family',`${last.P} F⁺ · ${last.Z} Z`],['graph topology',`${G.nodes.length} nodes · ${G.edges.length} edges`]].map(([k,v])=>`<div class="slice-metric">${k}<b>${v}</b></div>`).join('');}
  function pos(e){const r=cv.getBoundingClientRect();return [(e.clientX-r.left)*cv.logicalW/r.width,(e.clientY-r.top)*cv.logicalH/r.height];}
  cv.addEventListener('pointermove',e=>{const [x,y]=pos(e),h=hits.find(q=>Math.hypot(x-q.x,y-q.y)<=q.r);if(!h){tip.classList.remove('open');return;}const n=h.n,parents=n.parents||[],rels=[...new Set(parents.map(p=>p.rel))].join(', ')||'equilibrium';tip.innerHTML=`<b>node ${n.id} · ${n.type==='P'?'stored F⁺':'Z'} distribution</b><span class="key">kz = ${n.k.toFixed(2)} m⁻¹ · repetition ${n.rep}</span><br>|a| = ${cabs(n.amp).toFixed(5)} · phase = ${(carg(n.amp)/D2R).toFixed(1)}°<br>${parents.length} pre-merge contribution${parents.length===1?'':'s'} · relations: ${rels}`;tip.classList.add('open');tip.style.left=Math.min(graphWrap.clientWidth-340,e.clientX-graphWrap.getBoundingClientRect().left+12)+'px';tip.style.top=Math.max(34,e.clientY-graphWrap.getBoundingClientRect().top+12)+'px';});cv.addEventListener('pointerleave',()=>tip.classList.remove('open'));cv.addEventListener('click',e=>{const [x,y]=pos(e),h=hits.find(q=>Math.hypot(x-q.x,y-q.y)<=q.r);selected=h?h.n.id:null;drawInteractiveGraph(cv,S,G,selected,hits);});
  let q=ctlGroup('Sequence and pulse bank');slider(q,'slice-selective repetitions',2,4,1,S.reps,v=>v,v=>{S.reps=Math.round(v);selected=null;draw();});slider(q,'flip angle',15,120,5,S.alpha,v=>v+'°',v=>{S.alpha=v;selected=null;draw();});slider(q,'RF phase start',-180,180,3,S.phase0,v=>v+'°',v=>{S.phase0=v;selected=null;draw();});slider(q,'RF phase increment',0,180,3,S.phaseInc,v=>v+'°',v=>{S.phaseInc=v;selected=null;draw();});slider(q,'time-bandwidth product',2,10,.2,S.tbw,v=>v.toFixed(1),v=>{S.tbw=v;selected=null;draw();});
  let f=ctlGroup('Species and frequency bin');segmented(f,'tap bank',[{t:'water',v:'water'},{t:'fat',v:'fat'},{t:'combined nominal',v:'combined'}],S.species,v=>{S.species=v;selected=null;draw();});slider(f,'voxel B0 off-resonance',-600,600,10,S.b0,v=>v+' Hz',v=>{S.b0=v;selected=null;draw();});slider(f,'RF frequency offset',-600,600,10,S.freq,v=>v+' Hz',v=>{S.freq=v;selected=null;draw();});
  let p=ctlGroup('Sparse topology');slider(p,'RF-tap cutoff',.015,.18,.005,S.tapCut,v=>(100*v).toFixed(1)+'%',v=>{S.tapCut=v;selected=null;draw();});slider(p,'state threshold',0,.03,.001,S.stateThr,v=>v.toFixed(3),v=>{S.stateThr=v;selected=null;draw();});slider(p,'state cap per family',15,90,5,S.cap,v=>v,v=>{S.cap=Math.round(v);selected=null;draw();});slider(p,'kz merge bin / dk',.05,.6,.05,S.mergeTol,v=>v.toFixed(2),v=>{S.mergeTol=v;selected=null;draw();});buttonRow(p,[{t:'clear ancestry highlight',f:()=>{selected=null;drawInteractiveGraph(cv,S,G,selected,hits);}},{t:'select strongest final node',f:()=>{const q=G.current.slice().sort((a,b)=>cabs(b.amp)-cabs(a.amp))[0];selected=q?.id??null;drawInteractiveGraph(cv,S,G,selected,hits);}}]);note(p,'This browser figure mirrors the supplied prepass semantics but is intentionally small enough for a talk. Production Python/PyTorch builds the waveform-resolved tap banks; Rust compiles quantized keys, ancestry, merging, and pruning.');
  watchWidth(stage,draw);draw();
}});

globalThis.__slicePDGLowFieldAPI={GAMMA_HZ,FAT_HZ,RELS,REL_LABEL,REL_COLOR,makeBank,tapSet,tapSupport,stateParams,pulseDefinition,solveAtZ,phaseFactor,fit,responsiveCanvas,clamp,sinc,drawAxesText,watchWidth,addMetricRow,addLegend};

})();
