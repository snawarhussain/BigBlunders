import {gammaURL, portfolioURL} from './monitor-windows.js';
import {createDesktop} from './desktop.js';
const assets = new URL('./assets/', import.meta.url);
const TAU = 2 * Math.PI;
const names = {
  'Plane_Screen.001_0': 'CV · Document viewer',
  'Plane_Screen.002_0': 'MRtini · Signal explorer',
  'Plane_Screen.003_0': 'Terminal · Aquarium',
  'Plane_Screen.004_0': 'Slides · MRI trajectories',
  'Plane_Screen.006_0': 'Lab notebook · HandyMRI',
  'Plane_Screen.007_0': 'Snawar’s phone',
  'Plane_Screen_0': 'Terminal · Research profile',
};

const deck = [
  ['Sampling k-space', 'Gradients encode spatial frequency. A trajectory sets where and when the scanner samples.', 'Cartesian'],
  ['Beyond a grid', 'Radial readouts pass through the center of k-space on each spoke.', 'Radial'],
  ['Taking it to the scanner', 'Gradient timing and hardware limits determine how closely the measured path follows the design.', 'Spiral'],
];
const notes = [
  ['01 / B₀ drift', 'Track resonance over time', 'Log the center frequency before and after an echo train. Compare the measured phase trend with the frequency drift.'],
  ['02 / Gradient timing', 'Compare readout polarities', 'Acquire a reference in both directions. Compare the location of the echo and the resulting trajectory.'],
  ['03 / Echo train', 'Inspect each echo', 'Plot complex echo centers and check magnitude and phase along the train before comparing reconstructed images.'],
];
const commands = {
  help: 'about   projects   research   clear',
  about: 'Snawar Hussain\nMRI physics and computational modeling.',
  projects: 'MRtini   Phase-distribution graph simulation\nHandyMRI Ultra-low-field MRI at RWTH Aachen',
  research: 'RF slice profiles, coherence pathways,\nsequence development and forward modeling.',
};

export function createScreen(key, aspect, onChange) {
  const canvas = document.createElement('canvas');
  const w = 800;
  const h = Math.round(w / Math.max(.42, Math.min(2.4, aspect)));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', {alpha: false});
  const title = names[key];
  const id = key === 'Plane_Screen_0' ? 'terminal' : key.slice(13, 16);
  const state = {page: 0, scroll: 0, zoom: 1.24, t2: 80, spacing: 8, running: !matchMedia('(prefers-reduced-motion: reduce)').matches, progress: 0, input: '', log: ['snawar@research-room ~', 'Type help for available commands.']};
  const buttons = [];
  let contentImage;
  let secondPage;
  let dirty = true;
  let lastDraw = -Infinity;
  let epoch = performance.now();

  function invalidate() {
    dirty = true;
    onChange();
  }
  if (id === '001' || id === '007') {
    contentImage = new Image();
    contentImage.onload = invalidate;
    contentImage.src = new URL(id === '001' ? 'cv-page.png' : 'room-photo.webp', assets);
    if (id === '001') {
      secondPage = new Image();
      secondPage.onload = invalidate;
      secondPage.src = new URL('cv-2.png', assets);
    }
  }

  function fill(color, x, y, width, height) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }
  function text(value, x, y, size = 23, color = '#dbe5ef', font = 'system-ui', weight = 400) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(value, x, y);
  }
  function lines(value, x, y, width, size = 27, color = '#b9c7d5', line = 1.48) {
    ctx.font = `400 ${size}px system-ui`;
    let buffer = '';
    for (const word of value.split(' ')) {
      const candidate = buffer ? buffer + ' ' + word : word;
      if (buffer && ctx.measureText(candidate).width > width) {
        text(buffer, x, y, size, color);
        y += size * line;
        buffer = word;
      } else buffer = candidate;
    }
    if (buffer) text(buffer, x, y, size, color);
  }
  function button(label, x, y, width, click, active = false) {
    fill(active ? '#354f68' : '#263443', x, y, width, 54);
    text(label, x + 15, y + 27, 21, '#e4edf7', 'system-ui', 600);
    buttons.push({x, y, width, height: 54, click});
  }
  function chrome(subtitle) {
    fill('#111a24', 0, 0, w, h);
    fill('#253444', 0, 0, w, 64);
    ['#e67871', '#e7ba74', '#79bf96'].forEach((color, i) => {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(22 + 21 * i, 32, 5, 0, TAU);
      ctx.fill();
    });
    text(title, 90, 32, 24, '#ecf1f7', 'system-ui', 650);
    fill('#192532', 0, 64, w, 45);
    text(subtitle, 24, 87, 18, '#aabdd0');
  }
  function status(label) {
    fill('#253444', 0, h - 35, w, 35);
    text(label, 18, h - 17, 16, '#b5c8d9', 'monospace');
  }
  function plot(x, y, width, height, style, progress = 1) {
    fill('#0a141e', x, y, width, height);
    ctx.strokeStyle = '#263a49';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(x + width * i / 8, y);
      ctx.lineTo(x + width * i / 8, y + height);
      ctx.moveTo(x, y + height * i / 8);
      ctx.lineTo(x + width, y + height * i / 8);
      ctx.stroke();
    }
    ctx.strokeStyle = '#6fdbc2';
    ctx.lineWidth = 3;
    if (style === 'Radial' || style === 'Cartesian') {
      for (let i = 0; i < 13 * progress; i++) {
        const a = Math.PI * i / 13;
        ctx.beginPath();
        if (style === 'Radial') {
          ctx.moveTo(x + width * (.5 - .42 * Math.cos(a)), y + height * (.5 - .42 * Math.sin(a)));
          ctx.lineTo(x + width * (.5 + .42 * Math.cos(a)), y + height * (.5 + .42 * Math.sin(a)));
        } else {
          ctx.moveTo(x + width * .10, y + height * (i + 1) / 14);
          ctx.lineTo(x + width * .90, y + height * (i + 1) / 14);
        }
        ctx.stroke();
      }
      return;
    }
    if (style === 'Signal') {
      const center = height * .86;
      const count = Math.floor(progress * 12);
      ctx.fillStyle = '#83e3cb';
      ctx.strokeStyle = '#4fb7ac';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let n = 1; n <= count; n++) {
        const xx = x + width * n / 13;
        const yy = y + center - Math.exp(-n * state.spacing / state.t2) * height * .74;
        ctx.moveTo(xx, y + center);
        ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      for (let n = 1; n <= count; n++) {
        ctx.beginPath();
        ctx.arc(x + width * n / 13, y + center - Math.exp(-n * state.spacing / state.t2) * height * .74, 5, 0, TAU);
        ctx.fill();
      }
      text('0', x + 14, y + height - 17, 17, '#a6bed2', 'monospace');
      text((12 * state.spacing) + ' ms', x + width - 91, y + height - 17, 17, '#a6bed2', 'monospace');
      return;
    }
    ctx.beginPath();
    for (let i = 0; i <= 480; i++) {
      const t = i / 480;
      ctx.lineTo(x + (.5 + .45 * t * Math.cos(5 * TAU * t)) * width, y + (.5 + .45 * t * Math.sin(5 * TAU * t)) * height);
    }
    ctx.stroke();
  }
  function documentView() {
    chrome('Snawar CV.pdf');
    const top = 176;
    const visibleHeight = h - top - 35;
    const pageW = (w - 110) * state.zoom;
    const pageH = contentImage?.naturalWidth ? pageW * contentImage.naturalHeight / contentImage.naturalWidth : 0;
    const maxScroll = Math.max(0, 2 * pageH + 44 - visibleHeight);
    state.scroll = Math.max(0, Math.min(state.scroll, maxScroll));
    button('−', 25, 116, 55, () => { state.zoom = Math.max(.8, state.zoom - .15); });
    button('+', 88, 116, 55, () => { state.zoom = Math.min(2, state.zoom + .15); });
    text(Math.round(state.zoom * 100) + '%', 158, 144, 21);
    button('↓', w - 239, 116, 55, () => { state.scroll += 230; });
    button('↑', w - 176, 116, 55, () => { state.scroll -= 230; });
    button('PDF', w - 112, 116, 88, () => window.open(new URL('cv-preview.pdf', assets).href, '_blank', 'noopener'));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, w, visibleHeight);
    ctx.clip();
    fill('#303a44', 0, top, w, visibleHeight);
    if (pageH) ctx.drawImage(contentImage, (w - pageW) / 2, top + 13 - state.scroll, pageW, pageH);
    if (secondPage?.naturalWidth) ctx.drawImage(secondPage, (w-pageW)/2, top+31+pageH-state.scroll, pageW, pageH);
    if (maxScroll) {
      const thumb = Math.max(32, visibleHeight ** 2 / (2 * pageH));
      fill('#a7b4c1', w - 11, top + state.scroll / maxScroll * (visibleHeight - thumb), 6, thumb);
    }
    ctx.restore();
    status(`Page ${state.scroll > pageH-120 ? 2 : 1} / 2   •   Scroll to read`);
  }
  function simulator(time) {
    chrome('MRtini / echo-train explorer');
    text('Analytic CPMG preview', 26, 153, 36, '#e4edf7', 'system-ui', 650);
    text('Ideal echo centers  •  M(TE) = exp(−TE/T₂)', 27, 199, 23, '#a6bed2');
    const progress = state.running ? Math.min(1, .08 + (time - epoch) / 2700) : 1;
    state.progress = progress;
    plot(30, 232, w - 60, Math.max(85, h - 410), 'Signal', progress);
    const run = () => { epoch = performance.now(); state.running = true; state.progress = 0; };
    button('T₂ ' + state.t2 + ' ms', 30, h - 144, 161, () => { state.t2 = state.t2 === 80 ? 35 : 80; run(); });
    button('ESP ' + state.spacing + ' ms', 200, h - 144, 163, () => { state.spacing = state.spacing === 8 ? 12 : 8; run(); });
    button('Run', 375, h - 144, 94, run);
    button('Paper', w - 143, h - 144, 113, () => window.open('https://arxiv.org/abs/2606.09233', '_blank', 'noopener'));
    status(progress < 1 ? 'Sampling echo centers…' : '12 echoes   •   normalized amplitude');
  }
  function presentation() {
    chrome('K-space trajectories / slideshow');
    const [heading, copy, style] = deck[state.page];
    text(heading, 35, 160, 36, '#e4edf7', 'system-ui', 650);
    lines(copy, 36, 208, w - 72, 24);
    plot(36, 272, w - 72, Math.max(80, h - 398), style);
    button('‹ Prev', 35, h - 101, 110, () => { state.page = Math.max(0, state.page - 1); });
    button('Next ›', w - 145, h - 101, 110, () => { state.page = Math.min(deck.length - 1, state.page + 1); });
    status('Slide ' + (state.page + 1) + ' / ' + deck.length + '    ' + style);
  }
  function notebook() {
    chrome('handymri / scanner_notes.md');
    const [topic, heading, copy] = notes[state.page];
    text(topic, 36, 175, 25, '#77d5bc', 'monospace');
    lines(heading, 36, 240, w - 72, 49, '#e6edf7', 1.08);
    lines(copy, 36, 378, w - 72, 31, '#bbcad6');
    button('‹ Prev', 35, h - 110, 110, () => { state.page = Math.max(0, state.page - 1); });
    button('Next ›', w - 145, h - 110, 110, () => { state.page = Math.min(notes.length - 1, state.page + 1); });
    status('Lab notebook   •   Entry ' + (state.page + 1) + ' / ' + notes.length);
  }
  function aquarium(time) {
    chrome('fish · asciiquarium');
    fill('#102d3d', 15, 120, w - 30, h - 225);
    const dt = state.running ? (time - epoch) / 1000 : state.progress;
    state.progress = dt;
    for (let i = 0; i < 6; i++) {
      const x = 25 + ((dt * (35 + i * 9) + 101 * i) % 610 + 610) % 610;
      const y = 153 + (h - 280) * i / 6 + 10 * Math.sin(dt + i);
      text(i % 2 ? '<°)))><' : '><(((°>', i % 2 ? w - x - 145 : x, y, 29, ['#93dfd1','#f4c591','#b3c9ef'][i % 3], 'monospace');
    }
    button(state.running ? 'Pause' : 'Resume', 20, h - 94, 120, () => {
      if (!state.running) epoch = performance.now() - state.progress * 1000;
      state.running = !state.running;
    });
    status('ASCII Aquarium');
  }
  function terminal() {
    chrome('zsh · research-room');
    fill('#101916', 0, 109, w, h - 109);
    let y = 142;
    const count = Math.max(4, Math.floor((h - 267) / 30));
    for (const line of state.log.join('\n').split('\n').slice(-count)) {
      text(line, 24, y, 24, '#b6e6b1', 'monospace');
      y += 30;
    }
    const inputY = h - 125;
    fill('#172820', 18, inputY - 31, w - 36, 48);
    text('$ ' + state.input + '▌', 27, inputY - 6, 24, '#bcf3b8', 'monospace');
    ['about', 'projects', 'research', 'clear'].forEach((cmd, i) => {
      button(cmd, 20 + i * 148, h - 90, 136, () => run(cmd));
    });
    status('Type a command or select a shortcut');
  }
  function phone() {
    fill('#331e42', 0, 0, w, h);
    if (contentImage?.naturalWidth) ctx.drawImage(contentImage, 0, 0, w, h);
    if (state.page) {
      fill('#352940', 50, h * .35, w - 100, 240);
      lines('Hi, I’m Snawar. Thanks for stopping by!', 90, h * .35 + 65, w - 180, 46, '#fff');
    }
    button(state.page ? 'Lock' : 'Say hi', w / 2 - 68, h - 137, 136, () => { state.page = 1 - state.page; });
  }
  function run(value) {
    const cmd = value.trim().toLowerCase();
    if (!cmd) return;
    state.log = cmd === 'clear' ? [] : [...state.log.slice(-40), '$ ' + cmd, Object.hasOwn(commands, cmd) ? commands[cmd] : 'Command not found. Try help.'];
    state.input = '';
  }
  function draw(time) {
    const moving = id === '003' && state.running || id === '002' && state.progress !== 1;
    if (!dirty && (!moving || time - lastDraw < 1000 / 24)) return false;
    dirty = false;
    lastDraw = time;
    buttons.length = 0;
    if (id === '001') documentView();
    if (id === '002') simulator(time);
    if (id === '003') aquarium(time);
    if (id === '004') presentation();
    if (id === '006') notebook();
    if (id === '007') phone();
    if (id === 'terminal') terminal();
    return true;
  }
  function hit(u, v) {
    const x = u * w, y = v * h;
    return buttons.find(b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height);
  }
  function click(u, v) {
    const control = hit(u, v);
    if (control) { control.click(); invalidate(); }
  }
  function wheel(delta) {
    if (id !== '001') return;
    state.scroll += delta;
    invalidate();
  }
  function keydown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (id === '001' && ['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      wheel((event.key.endsWith('Up') ? -1 : 1) * (event.key.startsWith('Page') ? 275 : 85));
    } else if (['004', '006'].includes(id) && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      state.page = Math.max(0, Math.min(2, state.page + (event.key === 'ArrowLeft' ? -1 : 1)));
    } else if (id === 'terminal') {
      if (event.key === 'Enter') run(state.input);
      else if (event.key === 'Backspace') state.input = state.input.slice(0, -1);
      else if (event.key.length === 1 && state.input.length < 60) state.input += event.key;
      else return;
    } else return;
    event.preventDefault();
    invalidate();
  }
  draw(epoch);
  return {canvas, title, draw, click, wheel, keydown, hit, scrollable: id === '001'};
}

// Composite the existing interactive applications into each physical display.
export function createSplitScreen(key, aspect, onChange, openWindow) {
  if (key === 'Plane_Screen.001_0') {
    const appAspect = 780 / (840 / aspect - 362);
    return createDesktop(aspect,onChange,{
      'Snawar CV.pdf': createScreen(key,appAspect,onChange),
    },openWindow);
  }
  const canvas = document.createElement('canvas');
  const width = canvas.width = 1800;
  const height = canvas.height = Math.round(width / aspect);
  const ctx = canvas.getContext('2d', {alpha:false});
  const video = document.createElement('video');
  video.src = new URL('flash.mp4',assets);
  video.loop = video.muted = video.playsInline = true;
  video.preload = 'metadata';
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) video.play().catch(()=>{});
  const poster = new Image();
  poster.src = new URL('flash-poster.jpg',assets);
  const half = width/2;
  const apps = [
    ['GammaSTAR', 'γ', '#4479a4', gammaURL],
    ['Portfolio', '◎', '#8d63ae', portfolioURL],
    ['Echo Pathway', '∿', '#af6d45', './apps/echo/index.html'],
    ['FLASH', '▶', '#ad5257', null],
  ];
  let flash = true;
  let flashSlot = 0;
  let last = -Infinity;
  function text(value,x,y,size=24) {
    ctx.font=`600 ${size}px system-ui`;
    ctx.fillStyle='#f5eff7';
    ctx.fillText(value,x,y);
  }
  function desktop(x) {
    const wallpaper=ctx.createLinearGradient(x,0,x+half,height);
    wallpaper.addColorStop(0,'#221832');
    wallpaper.addColorStop(.64,'#58283f');
    wallpaper.addColorStop(1,'#a85152');
    ctx.fillStyle=wallpaper;ctx.fillRect(x,0,half,height);
    ctx.fillStyle='#261c2a';ctx.fillRect(x,0,half,44);
    text('Activities',x+24,30,19);
    text('Research Desk',x+half*.41,30,19);
    apps.forEach(([name,glyph,color],i)=>{
      const px=x+42+i*half*.235;
      ctx.fillStyle=color;ctx.fillRect(px,85,65,60);
      text(glyph,px+18,128,33);
      text(name,px,176,22);
    });
  }
  function player(x) {
    ctx.fillStyle='#141821';ctx.fillRect(x,0,half,height);
    ctx.fillStyle='#2c303b';ctx.fillRect(x,0,half,54);
    text('FLASH · Sequence video',x+26,35,26);
    text('×',x+half-50,36,30);
    const image=video.readyState>=2?video:poster;
    const w=image.videoWidth || image.naturalWidth,h=image.videoHeight || image.naturalHeight;
    if(w && h){
      const scale=Math.min((half-12)/w,(height-100)/h);
      ctx.drawImage(image,x+(half-w*scale)/2,54+(height-100-h*scale)/2,w*scale,h*scale);
    }
    text(video.paused?'▶  Play':'Ⅱ  Pause',x+24,height-16,22);
  }
  function draw(time) {
    if (time-last<42) return false;
    last=time;
    for (let slot=0;slot<2;slot++) {
      if(flash && flashSlot===slot) player(slot*half);
      else desktop(slot*half);
    }
    ctx.fillStyle='#080c12';ctx.fillRect(half-2,0,5,height);
    return true;
  }
  function toggle() {
    if (video.paused) video.play().catch(()=>{});
    else video.pause();
  }
  function activate(i,slot) {
    const [name,,,url]=apps[i];
    if (url) openWindow(name,url,slot ? 'right' : 'left');
    else {
      flash=true;
      flashSlot=slot;
      video.play().catch(()=>{});
    }
    onChange();
  }
  return {
    canvas,draw,title:'FLASH and GammaSTAR',hit:()=>true,
    click(u,v) {
      const slot=Number(u>=.5);
      const x=(u*2-slot)*half,y=v*height;
      if(flash && flashSlot===slot) {
        if(y<56 && x>half-72){flash=false;video.pause();}
        else toggle();
      } else if(y>76 && y<185) {
        const index=Math.floor((x-30)/(half*.235));
        if(index>=0 && index<apps.length) activate(index,slot);
      }
      onChange();
    },
    wheel() {},keydown(event) {
      if(event.key===' '){event.preventDefault();if(flash)toggle();}
    },
  };
}
