/* Shared editable echo experiment for Figures 2 and 11.
   Uses the established canvas, EPG, pathway, gallery and control components. */
(function(){
  const PRESETS={
    ge:{name:'gradient echo',nRF:0,a2:180,p2:0,a3:90,p3:0,g1:1,g2:-1,g3:0,tau:10,mix:10,
        why:'Opposite gradient moments return the transverse helix to k = 0; no refocusing RF pulse is used.'},
    se:{name:'spin echo',nRF:1,a2:180,p2:0,a3:90,p3:0,g1:1,g2:1,g3:0,tau:10,mix:10,
        why:'The 180° pulse reverses phase order, so the same signed dephasing moment produces the spin echo.'},
    ste:{name:'stimulated echo',nRF:2,a2:90,p2:0,a3:90,p3:0,g1:1,g2:3,g3:1,tau:10,mix:16,
         why:'RF2 stores the spatial phase in Z while a mixing-period crusher moves transverse branches away; RF3 recalls the stored state and the final gradient forms a separated STE.'},
    both:{name:'spin + stimulated echoes',nRF:2,a2:90,p2:0,a3:90,p3:0,g1:1,g2:1,g3:1,tau:10,mix:10,
          why:'RF2 creates a refocused transverse branch and a stored Z branch; RF3 lets later SE and STE pathways coexist.'}
  };

  function state(key){
    return Object.assign({preset:key,event:0,nIso:120,tube:true,vectors:true,kShow:5,
      galleryVectors:true,galleryTube:true,merge:false,showZ:true,pop:false,
      color:'type',phasors:'echoes',offRes:true,dfHz:40,T1:800,T2:120},PRESETS[key]);
  }
  function applyPreset(S,key){Object.assign(S,PRESETS[key]);S.preset=key;S.event=0;}
  function sequence(S){
    const free=function(dt,gdk){const odk=S.offRes?2*S.dfHz*dt/1000:0;return {dt:dt,gdk:gdk,odk:odk,dk:gdk+odk};};
    const seq=[{rf:{alpha:90,phi:90,label:'#1 90° excitation'}}];
    seq.push(free(S.tau,S.g1));
    if(S.nRF>=1)seq.push({rf:{alpha:S.a2,phi:S.p2,label:'#2 '+S.a2+'° @ '+S.p2+'°'}});
    seq.push(free(S.nRF>=2?S.mix:S.tau,S.g2));
    if(S.nRF>=2)seq.push({rf:{alpha:S.a3,phi:S.p3,label:'#3 '+S.a3+'° @ '+S.p3+'°'}});
    seq.push(free(S.tau,S.g3));
    return seq;
  }
  function echoName(e,S){return S.nRF===0?'GE':echoLabel(e.tag);}
  function blochEvents(seq,nIso,S){
    const pos=Array.from({length:nIso},function(_,i){return nIso===1?0:i/(nIso-1)-.5;});
    const M=pos.map(function(){return [0,0,1];});
    const out=[{t:0,label:'equilibrium before excitation',kind:'initial',M:M.map(function(v){return v.slice();})}];
    let t=0,rfNo=0,freeNo=0;
    for(const step of seq){
      if(step.rf){
        rfNo++;
        for(let i=0;i<M.length;i++)M[i]=rotAxis(M[i],step.rf.alpha,step.rf.phi);
        out.push({t:t,label:'after RF #'+rfNo+': '+step.rf.label,kind:'rf',M:M.map(function(v){return v.slice();})});
      }else{
        freeNo++;
        const E1=S.T1>0?Math.exp(-step.dt/S.T1):1,E2=S.T2>0?Math.exp(-step.dt/S.T2):1;
        for(let i=0;i<M.length;i++){
          const th=TAU*step.dk*pos[i],c=Math.cos(th),s=Math.sin(th),x=M[i][0],y=M[i][1];
          M[i][0]=(x*c-y*s)*E2;M[i][1]=(x*s+y*c)*E2;M[i][2]=M[i][2]*E1+(1-E1);
        }
        t+=step.dt;
        out.push({t:t,label:'after evolution block #'+freeNo+': ΔkG='+(step.gdk>0?'+':'')+step.gdk+', Δkω='+(step.odk>0?'+':'')+step.odk.toFixed(2),kind:'grad',M:M.map(function(v){return v.slice();})});
      }
    }
    return {pos:pos,out:out};
  }
  function signal(seq,nIso,S){
    const bseq=seq.map(function(step){
      return step.rf?{type:'rf',alpha:step.rf.alpha,phi:step.rf.phi}:
        {type:'free',dt:step.dt,dk:step.dk,sub:Math.max(24,Math.round(48*step.dt))};
    });
    const sim=blochEnsemble(nIso,bseq,{T1:S.T1||1e9,T2:S.T2||1e9});
    return sim.frames.map(function(f){
      let re=0,im=0;for(const m of f.M){re+=m[0];im+=m[1];}
      return [f.t,Math.hypot(re,im)/nIso];
    });
  }
  function presetButtons(parent,onPreset){
    buttonRow(parent,[{t:'gradient echo',f:function(){onPreset('ge');}},{t:'spin echo',f:function(){onPreset('se');}}]);
    buttonRow(parent,[{t:'stimulated echo',f:function(){onPreset('ste');}},{t:'SE + STE',f:function(){onPreset('both');}}]);
  }
  function editorControls(S,rebuild){
    const refs={},gp=ctlGroup('Echo presets');
    function setPreset(key){
      applyPreset(S,key);
      for(const name of Object.keys(refs))if(refs[name]&&Number.isFinite(S[name]))refs[name].set(S[name]);
      rebuild();
    }
    presetButtons(gp,setPreset);
    note(gp,'The first 90° excitation is fixed. Presets configure only the RF and gradient events that follow it.');
    const gr=ctlGroup('RF events after excitation');
    refs.nRF=slider(gr,'active RF pulses after excitation',0,2,1,S.nRF,function(v){return v===0?'none':v;},function(v){S.nRF=Math.round(v);S.preset='custom';rebuild();});
    refs.a2=slider(gr,'RF2 flip angle α₂',0,180,1,S.a2,function(v){return v+'°';},function(v){S.a2=v;S.preset='custom';rebuild();});
    refs.p2=slider(gr,'RF2 phase Φ₂',-180,180,1,S.p2,function(v){return v+'°';},function(v){S.p2=v;S.preset='custom';rebuild();});
    refs.a3=slider(gr,'RF3 flip angle α₃',0,180,1,S.a3,function(v){return v+'°';},function(v){S.a3=v;S.preset='custom';rebuild();});
    refs.p3=slider(gr,'RF3 phase Φ₃',-180,180,1,S.p3,function(v){return v+'°';},function(v){S.p3=v;S.preset='custom';rebuild();});
    note(gr,'RF3 is ignored unless two post-excitation pulses are active.');
    const gg=ctlGroup('Gradient moments & timing');
    const sf=function(v){return (v>0?'+':'')+v;};
    refs.g1=slider(gg,'gradient block 1 · Δk₁',-3,3,1,S.g1,sf,function(v){S.g1=Math.round(v);S.preset='custom';rebuild();});
    refs.g2=slider(gg,'gradient block 2 · Δk₂',-3,3,1,S.g2,sf,function(v){S.g2=Math.round(v);S.preset='custom';rebuild();});
    refs.g3=slider(gg,'gradient block 3 · Δk₃',-3,3,1,S.g3,sf,function(v){S.g3=Math.round(v);S.preset='custom';rebuild();});
    refs.tau=slider(gg,'outer interval τ',4,30,1,S.tau,function(v){return v.toFixed(0)+' ms';},function(v){S.tau=v;S.preset='custom';rebuild();});
    refs.mix=slider(gg,'RF2→RF3 mixing interval Tₘ',4,40,1,S.mix,function(v){return v.toFixed(0)+' ms';},function(v){S.mix=v;S.preset='custom';rebuild();});
    note(gg,'Signed Δk is the integrated gradient moment of each block. Δk = 0 gives storage without imposed gradient winding.');
    const gs=ctlGroup('Static off-resonance & relaxation');
    checkbox(gs,'enable static intravoxel Δω(z)',S.offRes,function(v){S.offRes=v;rebuild();});
    refs.dfHz=slider(gs,'B0 offset at voxel edge',-100,100,1,S.dfHz,function(v){return (v>0?'+':'')+v.toFixed(0)+' Hz';},function(v){S.dfHz=v;rebuild();});
    refs.T1=slider(gs,'T1 relaxation',100,3000,25,S.T1||3000,function(v){return v>=3000?'∞':v.toFixed(0)+' ms';},function(v){S.T1=v>=3000?0:v;rebuild();});
    refs.T2=slider(gs,'T2 relaxation',20,1000,10,S.T2||1000,function(v){return v>=1000?'∞':v.toFixed(0)+' ms';},function(v){S.T2=v>=1000?0:v;rebuild();});
    note(gs,'The teaching field is ΔfB0(z)=2·Δfedge·z/L. It is static in time, so a 180° pulse can refocus it; a gradient echo cannot. Negative frequency reverses the winding direction.');
    return refs;
  }
  function coeffPlot(cv,m,kShow){
    clear(cv);
    const keys=[...m.keys()].filter(function(k){return Math.abs(k)<=kShow+1e-8;}).sort(function(a,b){return a-b;});
    const lim=Math.max(1,kShow),P=new Plot(cv,{l:48,r:14,t:22,b:34}).dom(-lim-.65,lim+.65,0,1.02);
    P.frame('signed configuration order k','coefficient magnitude',{nx:Math.min(2*lim,10),ny:4,xfmt:function(v){return Math.round(v);}});
    P.clip(function(){
      for(const k of keys){const q=m.get(k);P.bar(k-.20,cabs(q.Fp),.18,C.Fp);P.bar(k,cabs(q.Fm),.18,C.Fm);P.bar(k+.20,cabs(q.Z),.18,C.Z);}
      P.line([[-lim-.65,0],[lim+.65,0]],C.line,1);
    });
    legend(cv.parentElement,[{c:C.Fp,t:'|F⁺[k]|'},{c:C.Fm,t:'|F⁻[k]|'},{c:C.Z,t:'|Z[k]|'}]);
  }
  function nearest(trace,t){return trace.reduce(function(a,b){return Math.abs(b[0]-t)<Math.abs(a[0]-t)?b:a;},trace[0]);}
  function programTitle(S){return S.preset==='custom'?'custom event program':S.name;}
  function programWhy(S){return S.preset==='custom'?'The RF and gradient controls below define this experiment.':S.why;}

  window.buildEchoComposerBloch=function(stage,ctrl){
    const S=state('both'),cam=new Cam(-38,16,1.05);
    lessonBlock('lesson-hero','<div><div class="lesson-kicker">Guided foundation · editable echo experiment</div>'+
      '<h3>Build gradient, spin and stimulated echoes from the same event grammar</h3>'+
      '<p>Keep the first 90° excitation fixed. Add up to two later RF pulses, set their flip angle and phase, and choose the signed moment of each gradient block.</p></div>'+
      '<div class="lesson-progress"><b>02</b> / one experiment, several echo mechanisms</div>');
    lessonBlock('term-grid','<div class="term"><b>Gradient echo</b>Opposite gradient area returns transverse phase to k = 0.</div>'+
      '<div class="term"><b>Spin echo</b>An RF refocuser reverses phase order; the following evolution completes rephasing.</div>'+
      '<div class="term"><b>Stimulated echo</b>RF2 stores a spatial phase pattern in Z; RF3 recalls it.</div>'+
      '<div class="term"><b>SE + STE</b>An imperfect refocuser leaves transverse and longitudinal pathway branches.</div>');
    explain('<b>Figure 2 is now an echo composer.</b> The sequence strip, explicit isochromats, coherent signal and Fourier/EPG coefficients come from one editable event list. Load the four presets first; then change one RF or gradient parameter and predict which echo survives.');
    const guide=lessonBlock('guided-strip','<h3>Choose a canonical experiment</h3><div class="step-buttons">'+
      '<button data-preset="ge">gradient echo</button><button data-preset="se">spin echo</button>'+
      '<button data-preset="ste">stimulated echo</button><button data-preset="both">SE + STE</button></div><div class="step-status"></div>');
    lessonBlock('assumption','<b>Model assumption.</b> RF pulses are ideal, instantaneous and spatially uniform. Gradient moments and the static linear intravoxel B0 field contribute separately to phase winding; T1 and T2 act during every free-evolution interval. Figure 21 later replaces the hard-pulse approximation with a waveform-resolved slice-selective solve.');
    const seqStrip=makeSequenceStrip('editable sequence — gradient and static off-resonance are separate physical lanes',148);
    const row=stageRow();row.classList.add('compact-grid');
    const isoCv=mkCanvas(row,350,330,'position space — explicit isochromats');
    const sigCv=mkCanvas(row,350,330,'coherent transverse signal');
    const stCv=mkCanvas(row,350,330,'same state — signed Fourier / EPG coefficients');
    const ro=readout();let R,history,bh,pos,trace,eventCtl,refs={};
    function setEvent(i){S.event=Math.max(0,Math.min(history.length-1,Math.round(i)));if(eventCtl)eventCtl.set(S.event);draw();}
    function rebuild(){
      const seq=sequence(S);R=runPathways(seq,{merge:true,T1:S.T1,T2:S.T2});history=pathwayEventHistory(seq,{merge:true,T1:S.T1,T2:S.T2});
      const b=blochEvents(seq,S.nIso,S);bh=b.out;pos=b.pos;trace=signal(seq,S.nIso,S);
      S.event=Math.min(S.event,history.length-1);
      if(eventCtl){eventCtl.el.max=history.length-1;eventCtl.set(S.event);}
      draw();
    }
    function selectPreset(key){
      applyPreset(S,key);
      for(const name of Object.keys(refs))if(refs[name]&&Number.isFinite(S[name]))refs[name].set(S[name]);
      rebuild();
    }
    function draw(){
      const h=history[S.event],b=bh[S.event],ss=sequenceStripSpec(sequence(S)),m=stateFromPathways(h.R.live);
      seqStrip.draw({tMax:ss.tMax,rf:ss.rf,grad:ss.grad,current:h.t,hideADC:true,showOffRes:true,offResOn:S.offRes,offResHz:S.dfHz,
        caption:programTitle(S)+' · event '+(S.event+1)+'/'+history.length+': '+h.label+'.'});
      drawEnsemble(isoCv,cam,b.M,pos,{tube:S.tube,vectors:S.vectors,net:true,
        alpha:Math.max(.1,Math.min(.72,42/S.nIso)),caption:b.label+' · '+S.nIso+' isochromats'});
      clear(sigCv);
      const tMax=Math.max(.1,R.tEnd),P=new Plot(sigCv,{l:48,r:14,t:22,b:34}).dom(0,tMax,0,1.04);
      P.frame('time','|M⊥| / M₀',{nx:6,ny:4});
      P.clip(function(){
        P.line(trace,C.acc,1.8);P.line([[h.t,0],[h.t,1.04]],C.echo,1.2,[4,3]);
        for(const e of R.echoes){const q=nearest(trace,e.t);P.dot(e.t,q[1],C.echo,4);}
      });
      const sg=sigCv.getContext('2d');sg.font='9px ui-monospace,monospace';sg.fillStyle=C.echo;sg.textAlign='center';
      for(const e of R.echoes){const q=nearest(trace,e.t);sg.fillText(echoName(e,S),P.X(e.t),P.Y(q[1])-7);}
      coeffPlot(stCv,m,S.kShow);
      const zero=m.get(0)||{Fp:cx(),Z:cx()},es=R.echoes.map(function(e){return echoName(e,S)+' @ '+e.t.toFixed(2);});
      ro.innerHTML='program: <span class="hl">'+programTitle(S)+'</span>   ·   selected event '+(S.event+1)+'/'+history.length+': '+h.label+'\n'+
        'RF after excitation: '+S.nRF+'   ·   gradient moments ['+S.g1+', '+S.g2+', '+S.g3+']   ·   static edge Δf '+(S.offRes?(S.dfHz>0?'+':'')+S.dfHz+' Hz':'off')+'\n'+
        'T1 / T2: '+(S.T1?S.T1+' ms':'∞')+' / '+(S.T2?S.T2+' ms':'∞')+'   ·   |√2F⁺[0]| = <span class="hl">'+(Math.SQRT2*cabs(zero.Fp)).toFixed(4)+'</span>\n'+
        'detected refocusing events: '+(es.length?es.join('   ·   '):'none in the current event program');
      guide.querySelector('.step-status').innerHTML='<b>'+programTitle(S)+'.</b> '+programWhy(S);
      guide.querySelectorAll('[data-preset]').forEach(function(btn){btn.classList.toggle('on',btn.dataset.preset===S.preset);});
    }
    guide.querySelectorAll('[data-preset]').forEach(function(btn){btn.addEventListener('click',function(){selectPreset(btn.dataset.preset);});});
    refs=editorControls(S,rebuild);
    const gt=ctlGroup('Synchronized event');
    eventCtl=slider(gt,'event step',0,6,1,S.event,function(v){return v;},function(v){setEvent(v);});
    playToggle(gt,'play sequence',function(){setEvent((S.event+1)%history.length);},2.2);
    buttonRow(gt,[{t:'← previous',f:function(){setEvent(S.event-1);}},{t:'next →',f:function(){setEvent(S.event+1);}}]);
    const gv=ctlGroup('Ensemble & view');
    refs.nIso=slider(gv,'isochromats drawn',12,320,4,S.nIso,function(v){return v;},function(v){S.nIso=Math.round(v);rebuild();});
    refs.kShow=slider(gv,'highest |k| displayed',2,10,1,S.kShow,function(v){return v;},function(v){S.kShow=Math.round(v);draw();});
    checkbox(gv,'draw isochromat vectors',true,function(v){S.vectors=v;draw();});
    checkbox(gv,'connect endpoints',true,function(v){S.tube=v;draw();});
    buttonRow(gv,[{t:'top x–y',f:function(){cam.el=88;draw();}},{t:'isometric',f:function(){cam.az=-38;cam.el=16;cam.zoom=1.05;draw();}}]);
    cam.attach(isoCv,draw);rebuild();
  };

  window.buildEchoComposerEPG=function(stage,ctrl){
    const S=state('both');
    lessonBlock('lesson-hero','<div><div class="lesson-kicker">EPG echo laboratory · same editable experiment</div>'+
      '<h3>Read the composer as configuration states and echo pathways</h3>'+
      '<p>The event program is the same as Figure 2. Here the standard EPG diagram and the signed/compact galleries reveal which transverse and stored longitudinal pathways form each echo.</p></div>'+
      '<div class="lesson-progress"><b>11</b> / sequence → states → pathways → echo</div>');
    explain('<b>Figure 11.</b> Gradients translate transverse states; ideal RF pulses mix F⁺, F⁻ and Z at fixed order; and an observable echo occurs when a transverse pathway reaches k = 0. A path occupying Z between RF pulses is labelled STE, a transverse-only RF-refocused path is labelled SE, and opposite gradient moments without a later RF pulse form a GE.');
    const guide=lessonBlock('guided-strip','<h3>Load the same four canonical programs</h3><div class="step-buttons">'+
      '<button data-preset="ge">gradient echo</button><button data-preset="se">spin echo</button>'+
      '<button data-preset="ste">stimulated echo</button><button data-preset="both">SE + STE</button></div><div class="step-status"></div>');
    const seqStrip=makeSequenceStrip('editable sequence — synchronized with pathway cursor and state galleries',148);
    const workspace=makeEPGStateWorkspace(stage,'standard EPG echo-pathway diagram',430),cv=workspace.cv;
    const galleries=makeDualConventionGallery(workspace.grid,S,draw,'configuration-state gallery — explicit signed orders and compact EPG');
    const ro=readout();let eventCtl,refs={},history=[];
    function setEvent(i){S.event=Math.max(0,Math.min(history.length-1,Math.round(i)));if(eventCtl)eventCtl.set(S.event);draw();}
    function rebuild(){draw();}
    function selectPreset(key){
      applyPreset(S,key);
      for(const name of Object.keys(refs))if(refs[name]&&Number.isFinite(S[name]))refs[name].set(S[name]);
      draw();
    }
    function draw(){
      const seq=sequence(S),R=runPathways(seq,{merge:S.merge,T1:S.T1,T2:S.T2}),ss=sequenceStripSpec(seq);
      history=pathwayEventHistory(seq,{merge:true,T1:S.T1,T2:S.T2});S.event=Math.min(S.event,history.length-1);
      const h=history[S.event];
      if(eventCtl){eventCtl.el.max=history.length-1;eventCtl.set(S.event);}
      seqStrip.draw({tMax:ss.tMax,rf:ss.rf,grad:ss.grad,current:h.t,hideADC:true,showOffRes:true,offResOn:S.offRes,offResHz:S.dfHz,
        caption:programTitle(S)+' · event '+(S.event+1)+'/'+history.length+': '+h.label+'.'});
      const info=drawEPG(cv,R,{hideZ:!S.showZ,labelEchoes:true,labelAmp:true,labelPop:S.pop,thr:2e-3,
        color:S.color,phasors:S.phasors,popPhase:S.color==='phase',showFresh:S.T1>0,echoThr:.006,
        echoLabel:function(e){return echoName(e,S);}});
      drawEPGEventCursor(cv,info,h.t,h.label);galleries.draw(h.R,h.label);
      const es=R.echoes.filter(function(e){return e.amp>.006;}).sort(function(a,b){return a.t-b.t;});
      const ge=es.filter(function(){return S.nRF===0;});
      const se=es.filter(function(e){return S.nRF>0&&!e.tag.hadZ;});
      const ste=es.filter(function(e){return S.nRF>0&&e.tag.hadZ;});
      const fmt=function(list,label){return list.map(function(e){return label(e)+' @ '+e.t.toFixed(2)+' · A='+e.amp.toFixed(3);}).join('   ')||'—';};
      ro.innerHTML='program: <span class="hl">'+programTitle(S)+'</span>   ·   selected event '+(S.event+1)+'/'+history.length+': '+h.label+'\n'+
        'system: static edge Δf '+(S.offRes?(S.dfHz>0?'+':'')+S.dfHz+' Hz':'off')+' · T1/T2 '+(S.T1?S.T1+' ms':'∞')+'/'+(S.T2?S.T2+' ms':'∞')+'\n'+
        'gradient echoes ('+ge.length+'): '+fmt(ge,function(){return 'GE';})+'\n'+
        'spin echoes ('+se.length+'): '+fmt(se,function(e){return echoName(e,S);})+'\n'+
        'stimulated echoes ('+ste.length+'): '+fmt(ste,function(e){return echoName(e,S);});
      guide.querySelector('.step-status').innerHTML='<b>'+programTitle(S)+'.</b> '+programWhy(S);
      guide.querySelectorAll('[data-preset]').forEach(function(btn){btn.classList.toggle('on',btn.dataset.preset===S.preset);});
    }
    guide.querySelectorAll('[data-preset]').forEach(function(btn){btn.addEventListener('click',function(){selectPreset(btn.dataset.preset);});});
    refs=editorControls(S,rebuild);
    const gs=ctlGroup('Synchronized event');
    eventCtl=slider(gs,'event step',0,6,1,S.event,function(v){return v;},function(v){setEvent(v);});
    playToggle(gs,'play sequence and state views',function(){setEvent((S.event+1)%history.length);},2.2);
    buttonRow(gs,[{t:'← previous',f:function(){setEvent(S.event-1);}},{t:'next →',f:function(){setEvent(S.event+1);}}]);
    const gg=ctlGroup('Configuration-state gallery');
    refs.kShow=slider(gg,'highest |k| displayed',1,10,1,S.kShow,function(v){return v;},function(v){S.kShow=Math.round(v);draw();});
    refs.nIso=slider(gg,'reconstructed isochromats',8,128,4,S.nIso,function(v){return v;},function(v){S.nIso=Math.round(v);draw();});
    checkbox(gg,'show state/field vectors',true,function(v){S.galleryVectors=v;draw();});
    checkbox(gg,'connect total-field endpoints',true,function(v){S.galleryTube=v;draw();});
    buttonRow(gg,[{t:'default 3-D',f:function(){galleries.cam.az=-55;galleries.cam.el=44;galleries.cam.zoom=1;draw();}},
      {t:'transverse',f:function(){galleries.cam.az=-90;galleries.cam.el=5;draw();}}]);
    const gd=ctlGroup('Pathway display');
    checkbox(gd,'show longitudinal Z pathways',true,function(v){S.showZ=v;draw();});
    checkbox(gd,'merge equal destinations',false,function(v){S.merge=v;draw();});
    checkbox(gd,'annotate populations',false,function(v){S.pop=v;draw();});
    diagramDisplayControls(gd,S,draw);draw();
  };
  window.__echoComposerTest={presets:PRESETS,state:state,sequence:sequence,echoName:echoName};
})();
