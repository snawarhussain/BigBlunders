export const gammaURL = 'https://gammastar.mevis.fraunhofer.de/#/dashboard?sequenceId=d9db6da3-5766-49c8-9096-21f2eeda093e';

export const portfolioURL = '/portfolio/';

export function mountMonitorWindows(onReturn) {
  const template = document.getElementById('monitor-window');
  const slots = new Map();
  function close(slot) {
    if (slot) {
      slots.get(slot)?.shell.parentElement.remove();
      slots.delete(slot);
    } else {
      for (const {shell} of slots.values()) shell.parentElement.remove();
      slots.clear();
    }
  }
  function open(name, url, slot = 'portrait') {
    if (slots.get(slot)?.name === name) return;
    close(slot);
    const shell = template.content.firstElementChild.cloneNode(true);
    const bar = shell.querySelector('nav');
    const iframe = shell.querySelector('iframe');
    const external = bar.querySelector('a');
    bar.querySelector('button').onclick = () => close(slot);
    bar.ondblclick = event => { if (!event.target.closest('a,button')) onReturn(); };
    bar.querySelector('span').textContent = name;
    external.href = url;
    iframe.title = name;
    iframe.src = url;
    slots.set(slot, {name,shell});
    const aperture = document.createElement('div');
    aperture.className = 'monitor-aperture';
    aperture.append(shell);
    template.after(aperture);
  }
  function align(points, ready) {
    for (const [slot,{shell}] of slots) position(shell,slot,points,ready);
  }
  function position(shell,slot,points,ready) {
    shell.parentElement.hidden = shell.hidden = !ready || !points;
    if (shell.hidden) return;
    const panels = points;
    function sub(p,q) {
      return p.map((v,i)=>v-q[i]);
    }
    function mix(p,q,t) {
      return p.map((v,i)=>v+(q[i]-v)*t);
    }
    function surface(u,v) {
      const index = Math.min(panels.length-1, Math.floor(u*panels.length));
      const [a,b,c,d] = panels[index];
      const fraction = u*panels.length-index;
      return mix(mix(a,b,fraction),mix(d,c,fraction),v);
    }
    // Clip the live browser to the projected pixels of the display. The
    // intermediate seams matter on the curved ultrawide when the camera moves.
    const [left,right,top,bottom] = slot === 'portrait' ? [.025,.975,.08,.91] :
      slot === 'right' ? [.509,.989,.024,.976] : [.011,.491,.024,.976];
    const breaks = [left,...panels.map((_,i)=>i/panels.length).filter(u=>u>left && u<right),right];
    const edges = [...breaks.map(u=>surface(u,top)),...breaks.slice().reverse().map(u=>surface(u,bottom))];
    // Let the page extend slightly past the curved top and bottom before
    // clipping. A straight chord alone leaves gaps along the curved glass.
    const bleed = panels.length > 1 ? .045 : 0;
    const quad = [surface(left,top-bleed),surface(right,top-bleed),
      surface(right,bottom+bleed),surface(left,bottom+bleed)];
    const [tl,tr,br,bl] = quad;
    const [dx1,dy1] = sub(tr,br), [dx2,dy2] = sub(bl,br);
    const [dx3,dy3] = sub(tl,tr).map((v,i)=>v+br[i]-bl[i]);
    const det = dx1*dy2-dx2*dy1;
    if (Math.abs(det)<.01) {shell.hidden=true;return;}
    const g=(dx3*dy2-dx2*dy3)/det, h=(dx1*dy3-dx3*dy1)/det;
    const width = slot === 'portrait' ? 720 : 850, height = slot === 'portrait' ? 940 : 560;
    shell.parentElement.style.clipPath = `polygon(${edges.map(([x,y])=>`${x}px ${y}px`).join(',')})`;
    shell.style.setProperty('--glass-bleed', Math.ceil(height*bleed)+'px');
    shell.style.width = width+'px';
    shell.style.height = height+'px';
    shell.style.transform = `matrix3d(${(tr[0]-tl[0]+g*tr[0])/width},${(tr[1]-tl[1]+g*tr[1])/width},0,${g/width},${(bl[0]-tl[0]+h*bl[0])/height},${(bl[1]-tl[1]+h*bl[1])/height},0,${h/height},0,0,1,0,${tl[0]},${tl[1]},0,1)`;
  }
  return {open,close,align};
}
