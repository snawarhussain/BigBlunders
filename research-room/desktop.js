// Ubuntu-inspired launcher rendered into the portrait monitor's texture.
export function createDesktop(aspect, onChange, apps, openWindow) {
  const canvas = document.createElement('canvas');
  const width = canvas.width = 840;
  const height = canvas.height = Math.round(width / aspect);
  const ctx = canvas.getContext('2d', {alpha:false});
  const shortcuts = [
    {label:'Files', glyph:'▰', color:'#e5a14d'},
    {label:'Snawar CV.pdf', glyph:'PDF', color:'#d85546'},
    {label:'Echo Pathway', glyph:'▤', color:'#dd8b43'},
    {label:'Portfolio', glyph:'◎', color:'#825ada'},
  ];
  let active = 'Desktop';
  let dirty = true;
  let targets = [];
  const dockY = height - 138;
  const frame = {x:30,y:130,w:780,h:dockY-160};

  function fill(color,x,y,w,h) { ctx.fillStyle=color; ctx.fillRect(x,y,w,h); }
  function text(value,x,y,size=26,color='#fff',weight=500) {
    ctx.font = `${weight} ${size}px system-ui`;
    ctx.fillStyle=color;
    ctx.textBaseline='middle';
    ctx.fillText(value,x,y);
  }
  function open(name) {
    if (name === 'Echo Pathway') { openWindow(name, './apps/echo/index.html'); return; }
    if (name === 'Portfolio') { openWindow('Portfolio', '/portfolio/'); return; }
    active = name;
    dirty = true;
    onChange();
  }
  function control(x,y,w,h,action) { targets.push({x,y,w,h,action}); }
  function icon(item,x,y,desktop=false) {
    const w=desktop ? 190 : 150;
    fill(item.color,x+12,y+8,70,65);
    text(item.glyph,x+21,y+41,item.glyph==='PDF' ? 23 : 38,'#fff',750);
    text(item.label,x+9,y+100,23);
    control(x,y,w,115,()=>open(item.label));
  }
  function windowChrome() {
    fill('#201a24',frame.x,frame.y,frame.w,frame.h);
    fill('#342b39',frame.x,frame.y,frame.w,64);
    text(active,frame.x+24,frame.y+32,28,'#fff',650);
    fill('#a9485c',frame.x+frame.w-66,frame.y+12,48,40);
    text('×',frame.x+frame.w-52,frame.y+32,30);
    control(frame.x+frame.w-66,frame.y+12,48,40,()=>open('Desktop'));
  }
  function draw(time) {
    const app = apps[active];
    const updated = app?.draw(time);
    if (!dirty && !updated) return false;
    dirty=false;
    targets=[];
    const bg=ctx.createLinearGradient(0,0,width,height);
    bg.addColorStop(0,'#1d142e');
    bg.addColorStop(.53,'#562441');
    bg.addColorStop(1,'#b84b50');
    fill(bg,0,0,width,height);
    const light=ctx.createRadialGradient(660,height*.62,5,660,height*.62,690);
    light.addColorStop(0,'#d27b5d');
    light.addColorStop(1,'#65244500');
    fill(light,0,0,width,height);
    fill('#211925',0,0,width,60);
    text('Activities',25,30,26,'#fff',650);
    control(0,0,175,60,()=>open('Desktop'));
    text('Research Desk',321,30,23);
    text('◉  ▴',736,30,23);
    if (active==='Desktop') {
      shortcuts.forEach((item,i)=>icon(item,50+(i%2)*225,185+Math.floor(i/2)*165,true));
    } else {
      windowChrome();
      if (app) ctx.drawImage(app.canvas,frame.x,frame.y+64,frame.w,frame.h-64);
      if (active==='Files') {
        text('Home / Research',frame.x+26,frame.y+105,26,'#e6c9e0');
        shortcuts.slice(1).forEach((item,i)=>icon(item,frame.x+28,frame.y+153+i*150,true));
      }
    }
    fill('#211925',48,dockY,width-96,124);
    shortcuts.forEach((item,i)=>icon(item,91+i*170,dockY+3));
    return true;
  }
  function resolve(u,v) {
    const x=u*width,y=v*height;
    const target=targets.find(t=>x>=t.x && x<=t.x+t.w && y>=t.y && y<=t.y+t.h);
    if (target) return target;
    const app=apps[active];
    if (app && x>=frame.x && x<=frame.x+frame.w && y>=frame.y+64 && y<=frame.y+frame.h) {
      const a=(x-frame.x)/frame.w,b=(y-frame.y-64)/(frame.h-64);
      if (app.hit(a,b)) return {action:()=>app.click(a,b)};
    }
  }
  return {
    canvas, draw, isDocument:()=>active==='Snawar CV.pdf', title:'Ubuntu-style desktop', hit:resolve,
    click(u,v) { resolve(u,v)?.action(); },
    wheel(delta) { apps[active]?.wheel(delta); },
    keydown(event) {
      if (['1','2','3','4'].includes(event.key)) {
        open(shortcuts[Number(event.key)-1].label);
        event.preventDefault();
      } else apps[active]?.keydown(event);
    },
    scrollable:true,
  };
}
