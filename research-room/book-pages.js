const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ease = t => t*t*(3-2*t);
const pageCount = 10;
const sources = Object.fromEntries(['paper','notes'].map(folder => [folder,
  Array.from({length:pageCount}, (_,i) => {
    const img = new Image();
    img.src = new URL(`./assets/${folder}/page-${String(i+1).padStart(2,'0')}.jpg`,import.meta.url);
    return img;
  })]));
export function createBookPages(onChange) {
  const canvas = document.getElementById('paper-pages');
  const ctx = canvas.getContext('2d');
  const previous = document.getElementById('paper-prev');
  const next = document.getElementById('paper-next');
  const count = document.getElementById('paper-count');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let spread = 0, turn, pages = sources.paper;
  function updateControls() {
    previous.disabled = spread === 0;
    next.disabled = spread >= pageCount-2;
    count.textContent = `${spread+1}–${spread+2} / ${pageCount}`;
  }
  function reset(folder = 'paper') {
    pages = sources[folder];
    spread=0;
    turn=null;
    updateControls();
  }
  function step(direction) {
    if (turn) return;
    const target=clamp(spread+direction*2,0,pageCount-2);
    if (target===spread) return;
    if (!reduced.matches) turn={from:spread,direction,start:performance.now()};
    spread=target;
    updateControls();
    onChange();
  }
  previous.onclick=()=>step(-1);
  next.onclick=()=>step(1);
  function click(u) { step(u<.5 ? -1 : 1); }
  function draw(quad, size, time) {
    canvas.hidden=!quad;
    if (!quad) return;
    const dpr=Math.min(devicePixelRatio,2);
    const width=Math.round(size.width*dpr),height=Math.round(size.height*dpr);
    if(canvas.width!==width || canvas.height!==height){canvas.width=width;canvas.height=height;}
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,size.width,size.height);
    const [a,b,c,d]=quad;
    const progress=turn ? ease(clamp((time-turn.start)/630,0,1)) : 1;
    if(progress>=1) turn=null;
    function point(x,y,z=0) {
      return [a[0]+(b[0]-a[0])*x+(d[0]-a[0])*y+(a[0]-b[0]+c[0]-d[0])*x*y,
        a[1]+(b[1]-a[1])*x+(d[1]-a[1])*y+(a[1]-b[1]+c[1]-d[1])*x*y-z];
    }
    function leaf(index, left, flipped) {
      const image=pages[index];
      if (!image?.complete || !image.naturalWidth) return;
      const strips=flipped ? 20 : 12;
      function edge(u,y) {
        if(!flipped) return point((left?0:.5)+u*.5,y);
        const direction=turn.direction;
        const rad=Math.PI*progress;
        const distance=direction>0 ? u : 1-u;
        const x=.5+direction*distance*.5*Math.cos(rad);
        const arc=Math.sin(rad)*distance*Math.hypot(b[0]-a[0],b[1]-a[1])*.16;
        return point(x,y,arc);
      }
      const reverse=flipped && progress>.5;
      for(let i=0;i<strips;i++){
        const u=i/strips,v=(i+1)/strips;
        const p=edge(u,0),q=edge(v,0),r=edge(v,1),s=edge(u,1);
        ctx.save();
        ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.lineTo(...r);ctx.lineTo(...s);ctx.closePath();ctx.clip();
        ctx.transform(q[0]-p[0],q[1]-p[1],s[0]-p[0],s[1]-p[1],p[0],p[1]);
        const source=(reverse ? strips-1-i : i)*image.naturalWidth/strips;
        ctx.drawImage(image,source,0,image.naturalWidth/strips,image.naturalHeight,-.025,0,1.05,1);
        ctx.fillStyle=`rgba(92,64,38,${flipped ? .05+Math.sin(Math.PI*progress)*(.06+.09*u) : .075})`;
        ctx.fillRect(0,0,1,1);
        ctx.restore();
      }
    }
    if (turn) {
      const forward=turn.direction>0;
      leaf(forward?turn.from:spread,true,false);
      leaf(forward?spread+1:turn.from+1,false,false);
      const turning=forward ? (progress<.5?turn.from+1:spread) : (progress<.5?turn.from:spread+1);
      leaf(turning,!forward,true);
    } else if (spread!==0) {
      leaf(spread,true,false);
      leaf(spread+1,false,false);
    }
  }
  return {reset,step,click,draw};
}
