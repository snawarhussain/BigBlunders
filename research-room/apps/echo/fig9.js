/* Figure 9: synchronized CPMG / EPG views. Loaded before the main explorer script;
   names such as Tmat, Cam and makeSequenceStrip are resolved when the builder runs. */
function buildFigure9(stage,ctrl){
  const S={alpha:120,N:6,esp:20,T1:1e9,T2:1e9,step:0,excPhi:90,refPhi:0,kShow:4,nIso:32,vectors:true,tube:true,ghosts:true,labels:true};
  const EPS=1e-9,channels=['Fp','Fm','Z'],labels={Fp:'F⁺',Fm:'F⁻',Z:'Z'};
  const colors={Fp:'#4aa8ff',Fm:'#ff8a5c',Z:'#3fd68c'},cam=new Cam(-56,48,1);
  lessonBlock('lesson-hero','<div><div class="lesson-kicker">Lesson 9 · the CPMG condition across five linked views</div><h3>See why RF phase changes an echo train, not only where the echoes occur</h3><p>The pulse strip, complex coefficients, spatial harmonics, exact-key merged graph and receiver curve all use the same selected event. Change the phase from CPMG to Carr–Purcell and follow the complex pathway interference.</p></div><div class="lesson-progress"><b>09</b> / sequence → states → pathways → signal</div>');
  explain('<b>CPMG condition in this convention.</b> The excitation is perpendicular to the refocusing axis: <span class="eq">Φexc − Φref = ±90° (mod 180°)</span>. With imperfect refocusing, this phase relation keeps the useful transverse component on the stable rotation axis. The observable coordinate is the single canonical receiver state <span class="eq">F⁺₀</span>, and <span class="eq">|M⊥|/M₀=√2|F⁺₀|</span>. None of the panels below makes a real-only population approximation.');
  const seqStrip=makeSequenceStrip('sequence strip — excitation, refocusing train, gradient moments, ADC windows and selected event');
  const top=stageRow();top.classList.add('fig9-top-grid');
  const coeffCv=mkCanvas(top,660,330,'Graph A · Weigel-style coefficient view, corrected for complex values — outline before RF · fill after RF · left Re · right Im');
  const sigCv=mkCanvas(top,390,330,'echo curve — selected phase train versus phase-matched CPMG reference');
  const gallery=document.createElement('div');gallery.className='card fig9-gallery interactive-graph';
  gallery.innerHTML='<div class="cardtitle">configuration-state gallery and total reconstructed magnetisation (drag to rotate)</div><div class="interaction-note">Bright geometry = selected-event coefficient · faint geometry = basis state · hover for complex value</div>';
  const galleryScroll=document.createElement('div');galleryScroll.className='fig9-gallery-scroll';
  const galleryCv=document.createElement('canvas');galleryScroll.appendChild(galleryCv);gallery.appendChild(galleryScroll);stage.appendChild(gallery);
  const galleryTip=document.createElement('div');galleryTip.className='graph-tooltip';gallery.appendChild(galleryTip);
  const graphRow=stageRow();graphRow.classList.add('fig9-graph');
  const graphCv=mkCanvas(graphRow,1050,470,'Graph B · exact-key merged EPG graph — equilibrium Z₀ → excitation → echo train; explicit F⁺/F⁻ channels and one canonical F⁺₀ receiver node');
  const ro=readout();
  lessonBlock('rf-compact-copy','<details open><summary>How to read Graph A</summary><p>For the RF event associated with the selected sequence step, the <b>outline</b> is the coefficient immediately before RF and the narrower <b>fill</b> is immediately after RF. The left sub-bar is Re and the right is Im. At a gradient or echo step the panel keeps the nearest RF comparison and says so.</p></details><details open><summary>How to read Graph B</summary><code>Z₀ = 1 → 90° excitation → F⁺₀ and F⁻₀<br>same destination key (channel,k) → complex sum<br>F⁺ₖ → F⁺ₖ₊₁ &nbsp;&nbsp; F⁻ₖ → F⁻ₖ₋₁<br>receiver: s = √2 F⁺₀</code><p>The graph starts from the physical equilibrium state, so excitation is a visible RF transition rather than an assumed initial condition. Only redundant F⁻₀ is hidden after excitation. Its conjugate-equivalent display edge attaches to the canonical F⁺₀ node, as in Figure 7.</p></details>');
  lessonBlock('assumption','<b>Model boundary for Figure 9.</b> Instantaneous hard pulses, integer unit gradient moments and relaxation during each ESP/2 are used. The graph merges exact signed <span class="eq">(channel,k)</span> keys. The gallery reconstructs the corresponding periodic physical magnetisation field.');

  const zeroQ=()=>({Fp:cx(),Fm:cx(),Z:cx()});
  const cloneMap=m=>new Map([...m].map(([k,q])=>[k,{Fp:{...q.Fp},Fm:{...q.Fm},Z:{...q.Z}}]));
  const qAt=(m,k)=>m.get(k)||zeroQ();
  function compact(m){for(const [k,q] of [...m])if(channels.every(ch=>cabs(q[ch])<EPS))m.delete(k);return m;}
  function addAt(m,k,ch,v){if(cabs(v)<EPS)return;const q=m.get(k)||zeroQ();q[ch]=cadd(q[ch],v);m.set(k,q);}
  function rfMap(m,a,p){const T=Tmat(a,p),out=new Map();for(const [k,q] of m){const v=[q.Fp,q.Fm,q.Z],r=T.map(row=>row.reduce((z,b,j)=>cadd(z,cmul(b,v[j])),cx()));out.set(k,{Fp:r[0],Fm:r[1],Z:r[2]});}return compact(out);}
  function gradMap(m){const out=new Map();for(const [k,q] of m){addAt(out,k+1,'Fp',q.Fp);addAt(out,k-1,'Fm',q.Fm);addAt(out,k,'Z',q.Z);}return compact(out);}
  function relaxMap(m,dt){const E1=Math.exp(-dt/S.T1),E2=Math.exp(-dt/S.T2),out=new Map();for(const [k,q] of m)out.set(k,{Fp:cscale(q.Fp,E2),Fm:cscale(q.Fm,E2),Z:cscale(q.Z,E1)});addAt(out,0,'Z',cx(1-E1));return compact(out);}
  function cpmgError(){const d=((S.excPhi-S.refPhi)%180+180)%180;return Math.abs(d-90);}

  let hist=[],echoes=[],reference=[],echoLevels=[],pulseSpec=[],gradSpec=[],adcSpec=[],hits=[],stepCtl,alphaCtl,excCtl,refCtl,lastRange=null;
  function simulate(refPhi,record){
    let m=new Map([[0,{Fp:cx(),Fm:cx(),Z:cx(1)}]]),H=[],E=[],L=[],P=[];
    const tExc=Math.max(1,S.esp*.1),before=cloneMap(m),initialPair={pre:cloneMap(m),post:cloneMap(m),alpha:0,phi:S.excPhi,label:'equilibrium before excitation'};
    if(record)H.push({lab:'equilibrium before excitation',ev:'initial',t:0,state:cloneMap(m),pair:initialPair});
    m=rfMap(m,90,S.excPhi);
    const excitation={pre:before,post:cloneMap(m),alpha:90,phi:S.excPhi,label:'90° excitation @ '+S.excPhi+'°'};
    P.push(excitation);if(record)H.push({lab:'after excitation',ev:'rf',t:tExc,state:cloneMap(m),pair:excitation});L.push(cloneMap(m));
    for(let n=1;n<=S.N;n++){
      const half=S.esp/2;m=relaxMap(gradMap(m),half);const pre=cloneMap(m);
      const pair={pre,post:null,alpha:S.alpha,phi:refPhi,label:'refocusing RF #'+n+': '+S.alpha+'° @ '+refPhi+'°'};
      m=rfMap(m,S.alpha,refPhi);pair.post=cloneMap(m);P.push(pair);
      if(record){H.push({lab:'before refocusing RF #'+n,ev:'gradient',t:tExc+(n-.5)*S.esp,state:pre,pair});H.push({lab:'after refocusing RF #'+n,ev:'rf',t:tExc+(n-.5)*S.esp,state:cloneMap(m),pair});}
      m=relaxMap(gradMap(m),half);const sm=cscale(qAt(m,0).Fp,Math.SQRT2);
      E.push({n,t:tExc+n*S.esp,v:sm});L.push(cloneMap(m));
      if(record)H.push({lab:'echo #'+n,ev:'echo',t:tExc+n*S.esp,state:cloneMap(m),pair});
    }
    return {hist:H,echoes:E,levels:L,pairs:P};
  }
  function build(){
    const run=simulate(S.refPhi,true),ref=simulate(S.excPhi-90,false);
    hist=run.hist;echoes=run.echoes;reference=ref.echoes;echoLevels=run.levels;
    const tExc=Math.max(1,S.esp*.1);pulseSpec=[{t:tExc,alpha:90,phi:S.excPhi,label:'90° @ '+S.excPhi+'°',exc:true}];gradSpec=[];adcSpec=[];
    for(let n=1;n<=S.N;n++){
      pulseSpec.push({t:tExc+(n-.5)*S.esp,alpha:S.alpha,phi:S.refPhi,label:S.alpha+'° @ '+S.refPhi+'°'});
      gradSpec.push({t0:tExc+(n-1)*S.esp+.08*S.esp,t1:tExc+(n-.5)*S.esp-.07*S.esp,amp:1,label:'+Δk'});
      gradSpec.push({t0:tExc+(n-.5)*S.esp+.07*S.esp,t1:tExc+n*S.esp-.08*S.esp,amp:1,label:'+Δk'});
      adcSpec.push({t0:tExc+n*S.esp-.05*S.esp,t1:tExc+n*S.esp+.05*S.esp});
    }
    S.step=Math.min(S.step,hist.length-1);
    if(stepCtl){stepCtl.el.max=hist.length-1;stepCtl.set(S.step);}
    draw();
  }

  function stateList(pair){
    const arr=[];for(let k=-S.kShow;k<=S.kShow;k++)for(const ch of channels){const a=qAt(pair.pre,k)[ch],b=qAt(pair.post,k)[ch];if(cabs(a)>1e-5||cabs(b)>1e-5||(ch==='Fp'&&k===0))arr.push({k,ch,a,b});}
    return arr;
  }
  function componentBar(g,P,x,v,w,col,fill){
    const X=P.X(x-w/2),X2=P.X(x+w/2),Y=P.Y(v),Y0=P.Y(0),h=Math.max(1,Math.abs(Y0-Y));g.save();g.strokeStyle=col;g.fillStyle=col;g.lineWidth=1.4;
    if(fill){g.globalAlpha=.72;g.fillRect(X,Math.min(Y,Y0),Math.max(1,X2-X),h);}else g.strokeRect(X+.5,Math.min(Y,Y0)+.5,Math.max(1,X2-X-1),Math.max(1,h-1));g.restore();
  }
  function drawCoefficients(pair,h){
    clear(coeffCv);const list=stateList(pair),mx=Math.max(.08,...list.flatMap(o=>[Math.abs(o.a.re),Math.abs(o.a.im),Math.abs(o.b.re),Math.abs(o.b.im)]))*1.18;
    const P=new Plot(coeffCv,{l:42,r:10,t:37,b:62}).dom(-.65,Math.max(.65,list.length-.35),-mx,mx);
    P.frame('states retained in selected ±k range','complex coefficient',{nx:Math.max(1,list.length-1),ny:4,xfmt:()=>''});P.line([[-.65,0],[Math.max(.65,list.length-.35),0]],C.line,1.2);
    const g=coeffCv.getContext('2d');
    list.forEach((o,i)=>{componentBar(g,P,i-.13,o.a.re,.18,colors[o.ch],false);componentBar(g,P,i+.13,o.a.im,.18,colors[o.ch],false);componentBar(g,P,i-.13,o.b.re,.11,colors[o.ch],true);componentBar(g,P,i+.13,o.b.im,.11,colors[o.ch],true);g.save();g.translate(P.X(i),coeffCv.logicalH-48);g.rotate(-Math.PI/3);g.fillStyle=o.ch==='Fp'&&o.k===0?C.echo:colors[o.ch];g.font='8px ui-monospace,monospace';g.textAlign='right';g.fillText(labels[o.ch]+(o.k>0?'+':'')+o.k,0,0);g.restore();});
    const initial=h.ev==='initial';g.fillStyle=C.fg2;g.font='10px sans-serif';g.textAlign='left';g.fillText(initial?'equilibrium Z₀=1 · excitation has not yet been applied':pair.label+' · '+(h.ev==='rf'?'selected RF event':'nearest RF comparison for this '+h.ev+' step'),44,16);
    g.fillStyle=C.fg3;g.font='9px ui-monospace,monospace';g.fillText(initial?'outline and fill coincide at the current equilibrium coefficient':'outline before · fill after · each pair: Re | Im',44,29);
  }
  function drawEchoes(){
    clear(sigCv);const maxY=Math.max(.08,...echoes.map(e=>cabs(e.v)),...reference.map(e=>cabs(e.v)))*1.12;
    const Q=new Plot(sigCv,{l:47,r:12,t:30,b:36}).dom(.6,S.N+.4,0,maxY);Q.frame('echo number','|M⊥| / M₀',{nx:Math.min(6,S.N),ny:4,xfmt:v=>Math.round(v)});
    Q.clip(()=>{Q.line(reference.map(e=>[e.n,cabs(e.v)]),C.fg3,1.5,[5,3]);Q.line(echoes.map(e=>[e.n,cabs(e.v)]),C.echo,2);echoes.forEach(e=>Q.dot(e.n,cabs(e.v),C.echo,3.5));const h=hist[S.step];if(h.ev==='echo'){const e=echoes.find(e=>Math.abs(e.t-h.t)<1e-6);if(e)Q.dot(e.n,cabs(e.v),'#fff',6);}});
    const g=sigCv.getContext('2d');g.fillStyle=cpmgError()<.5?C.ok:C.warn;g.font='10px ui-monospace,monospace';g.textAlign='left';g.fillText(cpmgError()<.5?'CPMG phase condition satisfied':'phase mismatch from CPMG: '+cpmgError().toFixed(0)+'°',48,16);
    g.fillStyle=C.echo;g.fillRect(50,23,10,2);g.fillStyle=C.fg3;g.fillText('selected',65,26);g.setLineDash([4,3]);g.strokeStyle=C.fg3;g.beginPath();g.moveTo(126,24);g.lineTo(139,24);g.stroke();g.setLineDash([]);g.fillText('CPMG reference',144,26);
  }

  function sizeGallery(){
    const dpr=canvasDpr(),cw=142,ch=150,L=48,T=30,W=L+(2*S.kShow+1)*cw+8,H=T+3*ch+24;
    galleryCv.width=W*dpr;galleryCv.height=H*dpr;galleryCv.style.width=W+'px';galleryCv.style.height=H+'px';galleryCv.logicalW=W;galleryCv.logicalH=H;galleryCv.getContext('2d').setTransform(dpr,0,0,dpr,0,0);return {cw,ch,L,T,W,H};
  }
  function axisRail(g,x,y,s){const A=cam.proj([0,0,-.78],x,y,s),B=cam.proj([0,0,.78],x,y,s);g.strokeStyle=C.line;g.setLineDash([2,3]);g.beginPath();g.moveTo(A[0],A[1]);g.lineTo(B[0],B[1]);g.stroke();g.setLineDash([]);}
  function fieldAt(m,u){let cp=cx(),cm=cx(),zz=cx();for(const [k,q] of m){const e=cexp(TAU*k*u);cp=cadd(cp,cmul(q.Fp,e));cm=cadd(cm,cmul(q.Fm,e));zz=cadd(zz,cmul(q.Z,e));}return [cadd(cp,cm).re*IS2,csub(cp,cm).im*IS2,zz.re];}
  function transverse(g,x,y,s,k,q,hand){
    axisRail(g,x,y,s);const mag=cabs(q),ph=carg(q),N=visibleIsoCount(S.nIso);
    const trace=(r,a)=>{g.save();g.globalAlpha=a;g.strokeStyle=mag>EPS?phaseCol(ph):C.fg3;g.lineWidth=2;g.beginPath();for(let i=0;i<N;i++){const u=i/(N-1)-.5,th=hand*(TAU*k*u+ph),p=cam.proj([Math.cos(th)*r,Math.sin(th)*r,u*1.45],x,y,s);i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]);}g.stroke();g.restore();};
    if(S.ghosts)trace(.44,.13);if(mag>EPS)trace(.44*Math.min(1,Math.SQRT2*mag),.95);
    if(S.vectors&&mag>EPS)eachIsochromat(N,(i,u)=>{const th=hand*(TAU*k*u+ph),r=.44*Math.min(1,Math.SQRT2*mag);arrow3(g,cam,[0,0,u*1.45],[Math.cos(th)*r,Math.sin(th)*r,u*1.45],x,y,s,phaseCol(th),1,3.2);});
  }
  function longitudinal(g,x,y,s,k,q){
    const mag=cabs(q),ph=carg(q),N=visibleIsoCount(S.nIso),ghostStep=Math.max(1,Math.ceil(N/24));eachIsochromat(N,(i,u)=>{const b=[u*1.35,-.38,-.38],base=Math.cos(TAU*k*u);
      if(S.ghosts&&i%ghostStep===0){g.globalAlpha=.12;arrow3(g,cam,b,[b[0],b[1],b[2]+base*.55],x,y,s,base>=0?C.Z:C.vio,1,3);g.globalAlpha=1;}
      if(S.vectors&&mag>EPS){const a=k===0?q.re:mag*Math.cos(TAU*k*u+ph);arrow3(g,cam,b,[b[0],b[1],b[2]+a*.55],x,y,s,a>=0?C.Z:C.vio,1.2,3.4);}
    });
  }
  function totalField(g,m,x,y,s){
    const N=visibleIsoCount(S.nIso),arr=[];eachIsochromat(N,(i,u)=>arr.push({u,M:fieldAt(m,u)}),true);const sc=.5/Math.max(1,...arr.map(o=>Math.hypot(...o.M)));axisRail(g,x,y,s);
    if(S.tube)for(let i=0;i<arr.length-1;i++){const a=arr[i],b=arr[i+1],A=cam.proj([a.M[0]*sc,a.M[1]*sc,a.u*1.45+a.M[2]*sc],x,y,s),B=cam.proj([b.M[0]*sc,b.M[1]*sc,b.u*1.45+b.M[2]*sc],x,y,s);g.strokeStyle=hue(a.u+.5);g.lineWidth=1.6;g.beginPath();g.moveTo(A[0],A[1]);g.lineTo(B[0],B[1]);g.stroke();}
    if(S.vectors)for(const o of arr)arrow3(g,cam,[0,0,o.u*1.45],[o.M[0]*sc,o.M[1]*sc,o.u*1.45+o.M[2]*sc],x,y,s,hue(o.u+.5),1.1,3.5);
    const net=[0,0,0];arr.forEach(o=>o.M.forEach((v,j)=>net[j]+=v/arr.length));arrow3(g,cam,[0,0,0],net.map(v=>v*.5),x,y,s,C.echo,2.5,6);
  }
  function drawGallery(m){
    const sz=sizeGallery(),cw=sz.cw,ch=sz.ch,L=sz.L,T=sz.T,W=sz.W,H=sz.H,g=galleryCv.getContext('2d'),orders=Array.from({length:2*S.kShow+1},(_,i)=>i-S.kShow);hits=[];clear(galleryCv);
    if(lastRange!==S.kShow){lastRange=S.kShow;requestAnimationFrame(()=>galleryScroll.scrollLeft=Math.max(0,(W-galleryScroll.clientWidth)/2));}
    g.font='10px ui-monospace,monospace';g.textAlign='center';orders.forEach((k,i)=>{g.fillStyle=k===0?C.echo:C.fg3;g.fillText('k='+(k>0?'+':'')+k,L+(i+.5)*cw,T-11);});
    const rows=[['Fp',1],['Fm',-1],['Z',0]];
    rows.forEach((row,ri)=>{g.save();g.translate(16,T+(ri+.5)*ch);g.rotate(-Math.PI/2);g.fillStyle=colors[row[0]];g.font='11px ui-monospace,monospace';g.textAlign='center';g.fillText(labels[row[0]]+'ₖ',0,0);g.restore();});
    rows.forEach((row,ri)=>orders.forEach((k,ci)=>{const key=row[0],hand=row[1],x=L+ci*cw,y=T+ri*ch,cxp=x+cw/2,cyp=y+ch/2,s=41,isTotal=key==='Fm'&&k===0;
      g.strokeStyle=isTotal?'#6a5929':C.line;g.strokeRect(x+3.5,y+3.5,cw-7,ch-7);
      if(isTotal){totalField(g,m,cxp,cyp,s);g.fillStyle=C.echo;g.font='8px ui-monospace,monospace';g.fillText('Σ states → M(r,t)',cxp,y+15);hits.push({x1:x,x2:x+cw,y1:y,y2:y+ch,html:'<b>Total physical magnetisation</b>Fourier synthesis of every occupied signed-order coefficient at the selected event.'});return;}
      const q=qAt(m,k)[key],mag=cabs(q),ph=carg(q);key==='Z'?longitudinal(g,cxp,cyp,s,k,q):transverse(g,cxp,cyp,s,k,q,hand);
      g.fillStyle=mag>EPS?phaseCol(ph):C.fg3;g.font='8px ui-monospace,monospace';g.fillText(mag>EPS?'|Q| '+mag.toFixed(3)+' · ∠'+(ph/D2R).toFixed(0)+'°':'unoccupied',cxp,y+ch-10);
      if(key==='Fp'&&k===0&&mag>EPS){g.strokeStyle=C.echo;g.lineWidth=2;g.strokeRect(x+5.5,y+5.5,cw-11,ch-11);g.fillStyle=C.echo;g.fillText('receiver',cxp,y+15);}
      hits.push({x1:x,x2:x+cw,y1:y,y2:y+ch,html:'<b>'+labels[key]+(k>0?'+':'')+k+'</b><span class="key">'+cfmt(q,5)+'</span><br>magnitude '+mag.toFixed(5)+'<br>phase '+(ph/D2R).toFixed(2)+'°'+(key==='Z'?'<br>Vectors remain parallel/antiparallel to Mz.':'')+(key==='Fp'&&k===0?'<br><span class="signal">s=√2F⁺₀</span>':'')});
    }));
    g.fillStyle=C.fg3;g.font='9px ui-monospace,monospace';g.textAlign='left';g.fillText('explicit signed orders −'+S.kShow+'…+'+S.kShow+'; only redundant F⁻₀ is replaced by the total field',L,H-7);
  }

  function graphStates(m){const a=[];for(const [k,q] of m)for(const ch of channels)if(cabs(q[ch])>1e-5&&!(ch==='Fm'&&k===0))a.push({k,ch,amp:q[ch]});return a.sort((x,y)=>x.k-y.k||channels.indexOf(x.ch)-channels.indexOf(y.ch));}
  function drawGraph(){
    clear(graphCv);const g=graphCv.getContext('2d'),W=graphCv.logicalW,H=graphCv.logicalH,L=68,R=22,top=48,bottom=38;
    const equilibrium=new Map([[0,{Fp:cx(),Fm:cx(),Z:cx(1)}]]),graphMaps=[equilibrium,...echoLevels],levels=graphMaps.map(graphStates),maps=levels.map(a=>new Map(a.map(n=>[n.ch+'|'+n.k,n]))),dx=(W-L-R)/Math.max(1,levels.length-1);
    levels.forEach((a,i)=>a.forEach((n,j)=>{n.x=L+i*dx;n.y=top+(j+.5)/Math.max(1,a.length)*(H-top-bottom);}));
    const srcI={Fp:0,Fm:1,Z:2};
    for(let i=1;i<levels.length;i++){
      const isExcitation=i===1,T=Tmat(isExcitation?90:S.alpha,isExcitation?S.excPhi:S.refPhi),prev=graphMaps[i-1];
      for(const [k,q] of prev)for(const sch of channels){
        if(cabs(q[sch])<1e-5)continue;
        const pk=isExcitation?k:(sch==='Fp'?k+1:sch==='Fm'?k-1:k);
        let src=maps[i-1].get(sch+'|'+k);if(!src&&sch==='Fm'&&k===0)src=maps[i-1].get('Fp|0');if(!src)continue;
        for(let d=0;d<3;d++){
          const dch=channels[d],dk=isExcitation?pk:(dch==='Fp'?pk+1:dch==='Fm'?pk-1:pk),dst=maps[i].get(dch+'|'+dk),w=T[d][srcI[sch]];
          if(!dst||cabs(w)<1e-7)continue;
          g.strokeStyle=phaseCol(carg(w),Math.max(.12,Math.min(.55,cabs(w))));g.lineWidth=Math.max(.45,Math.min(2.4,cabs(w)*2.5));g.beginPath();g.moveTo(src.x+4,src.y);g.lineTo(dst.x-4,dst.y);g.stroke();
        }
      }
    }
    levels.forEach((a,i)=>{g.fillStyle=i===0?C.Z:C.fg3;g.font='9px ui-monospace,monospace';g.textAlign='center';g.fillText(i===0?'equilibrium':i===1?'after excitation':'echo '+(i-1),L+i*dx,17);a.forEach(n=>{const mag=cabs(n.amp),r=Math.max(3,Math.min(11,3+8*Math.sqrt(mag))),signal=n.ch==='Fp'&&n.k===0;if(signal){g.strokeStyle=C.echo;g.lineWidth=2.5;g.beginPath();g.arc(n.x,n.y,r+3,0,TAU);g.stroke();}g.fillStyle=phaseCol(carg(n.amp),.76);g.strokeStyle=colors[n.ch];g.lineWidth=1.4;g.beginPath();g.arc(n.x,n.y,r,0,TAU);g.fill();g.stroke();if(S.labels&&a.length<=24){g.fillStyle=signal?C.echo:C.fg2;g.font='8px ui-monospace,monospace';g.fillText(labels[n.ch]+(n.k>0?'+':'')+n.k,n.x,n.y-r-4);}});});
    g.fillStyle=C.fg3;g.font='9px sans-serif';g.textAlign='left';g.fillText('Z₀ equilibrium → excitation → echo train · node area = magnitude · hue = phase · equal (channel,k) destinations are summed · F⁻₀ hidden, never added to F⁺₀',12,H-11);
  }

  function draw(){
    if(!hist.length)return;const h=hist[S.step],m=h.state,pair=h.pair,tExc=Math.max(1,S.esp*.1),tMax=tExc+(S.N+.12)*S.esp;
    seqStrip.draw({tMax,rf:pulseSpec,grad:gradSpec,adc:adcSpec,current:h.t,caption:h.lab+(h.ev==='initial'?': the cursor is before the excitation, with Z₀=1 and F₀±=0.':'. RF height/phase, gradients, ADC windows and the gold cursor share the controls.')});
    drawCoefficients(pair,h);drawEchoes();drawGallery(m);drawGraph();
    const occ=[];for(const [k,q] of m)if(channels.some(ch=>cabs(q[ch])>1e-5))occ.push(k);const s=cscale(qAt(m,0).Fp,Math.SQRT2);
    ro.innerHTML='step '+(S.step+1)+'/'+hist.length+' — <span class="hl">'+h.lab+'</span> at t='+h.t.toFixed(1)+' ms\nCPMG phase error = '+cpmgError().toFixed(1)+'°   ·   occupied signed orders = {'+occ.sort((a,b)=>a-b).join(', ')+'}\nZ₀ = <span class="hl">'+cfmt(qAt(m,0).Z,4)+'</span>   ·   F⁺₀ = <span class="hl">'+cfmt(qAt(m,0).Fp,4)+'</span>   ·   receiver s=√2F⁺₀ = <span class="hl">'+cfmt(s,4)+'</span>   ·   |M⊥|/M₀='+cabs(s).toFixed(4);
  }

  galleryCv.addEventListener('pointermove',e=>{const r=galleryCv.getBoundingClientRect(),x=(e.clientX-r.left)*galleryCv.logicalW/r.width,y=(e.clientY-r.top)*galleryCv.logicalH/r.height,hit=hits.find(h=>x>=h.x1&&x<=h.x2&&y>=h.y1&&y<=h.y2);if(!hit){galleryTip.classList.remove('open');return;}const cr=gallery.getBoundingClientRect();galleryTip.innerHTML=hit.html;galleryTip.classList.add('open');galleryTip.style.left=Math.max(8,Math.min(gallery.clientWidth-320,e.clientX-cr.left+12))+'px';galleryTip.style.top=Math.max(30,e.clientY-cr.top+12)+'px';});
  galleryCv.addEventListener('pointerleave',()=>galleryTip.classList.remove('open'));

  let g=ctlGroup('CPMG pulse train');alphaCtl=slider(g,'refocusing flip angle α',10,180,1,S.alpha,v=>v+'°',v=>{S.alpha=v;build();});slider(g,'number of echoes',1,12,1,S.N,v=>v,v=>{S.N=v;build();});slider(g,'echo spacing ESP',6,50,1,S.esp,v=>v+' ms',v=>{S.esp=v;build();});
  let g2=ctlGroup('RF phase condition');excCtl=slider(g2,'excitation phase Φexc',-180,180,1,S.excPhi,v=>v+'°',v=>{S.excPhi=v;build();});refCtl=slider(g2,'refocusing phase Φref',-180,180,1,S.refPhi,v=>v+'°',v=>{S.refPhi=v;build();});note(g2,'CPMG: excitation and refocusing axes perpendicular. Carr–Purcell: axes parallel.');
  let g3=ctlGroup('Relaxation');slider(g3,'T1',20,3000,10,3000,v=>v>=3000?'∞':v+' ms',v=>{S.T1=v>=3000?1e9:v;build();});slider(g3,'T2',10,1500,5,1500,v=>v>=1500?'∞':v+' ms',v=>{S.T2=v>=1500?1e9:v;build();});
  let g4=ctlGroup('Selected sequence event');stepCtl=slider(g4,'event step',0,18,1,S.step,v=>v,v=>{S.step=Math.round(v);draw();});playToggle(g4,'play synchronized views',()=>{S.step=(S.step+1)%hist.length;stepCtl.set(S.step);draw();},3.2);buttonRow(g4,[{t:'previous',f:()=>{S.step=Math.max(0,S.step-1);stepCtl.set(S.step);draw();}},{t:'next',f:()=>{S.step=Math.min(hist.length-1,S.step+1);stepCtl.set(S.step);draw();}}]);
  let g5=ctlGroup('Gallery and graph');slider(g5,'highest |k| displayed',2,8,1,S.kShow,v=>v,v=>{S.kShow=v;draw();});slider(g5,'number of reconstructed isochromats',8,128,4,S.nIso,v=>v,v=>{S.nIso=v;draw();});checkbox(g5,'show state/field vectors',true,v=>{S.vectors=v;draw();});checkbox(g5,'show faint basis states',true,v=>{S.ghosts=v;draw();});checkbox(g5,'connect total-field endpoints',true,v=>{S.tube=v;draw();});checkbox(g5,'show graph node labels',true,v=>{S.labels=v;draw();});buttonRow(g5,[{t:'default 3-D view',f:()=>{cam.az=-56;cam.el=48;cam.zoom=1;draw();}},{t:'transverse view',f:()=>{cam.az=-90;cam.el=5;draw();}}]);
  function preset(exc,ref,a){S.excPhi=exc;S.refPhi=ref;S.alpha=a;S.step=0;excCtl.set(exc);refCtl.set(ref);alphaCtl.set(a);build();}
  let g6=ctlGroup('Guided comparisons');buttonRow(g6,[{t:'CPMG · 120°',f:()=>preset(90,0,120)},{t:'Carr–Purcell · 120°',f:()=>preset(90,90,120)},{t:'ideal CPMG · 180°',f:()=>preset(90,0,180)}]);note(g6,'Use an imperfect flip angle first. Ideal 180° refocusing largely hides the phase-stability difference.');
  cam.attach(galleryCv,draw);build();
}
