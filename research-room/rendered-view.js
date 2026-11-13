import frames from './room-frames.js';
import {drawSteam} from './steam.js';

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const ease = (t) => t * t * (3 - 2 * t);
const corners = (panels) => [panels[0][0],panels.at(-1)[1],panels.at(-1)[2],panels[0][3]];
const center = (panels) => corners(panels).reduce(([x,y],[a,b]) => [x+a/4,y+b/4], [0,0]);
const span = (panels) => {
  const quad = panels.flat();
  const x = quad.map(point => point[0]), y = quad.map(point => point[1]);
  return [Math.max(...x)-Math.min(...x), Math.max(...y)-Math.min(...y)];
};
const domain = new URL('./assets/frames/', import.meta.url);

function weights([x,y], [ax,ay], [bx,by], [cx,cy]) {
  const det = (by-cy)*(ax-cx) + (cx-bx)*(ay-cy);
  const a = ((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det;
  const b = ((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det;
  return [a,b,1-a-b];
}

function inside(x,y,quad) {
  const a = weights([x,y], quad[0], quad[1], quad[2]);
  if (a.every(n => n >= -.0005)) return [a[1]+a[2], a[2]];
  const b = weights([x,y], quad[0], quad[2], quad[3]);
  if (b.every(n => n >= -.0005)) return [b[1], b[1]+b[2]];
}

function panel(ctx, canvas, quad, start, end, glossy = true) {
  const [a,b,c,d] = quad;
  const w = (end-start)*canvas.width, h = canvas.height;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(...a);
  ctx.lineTo(...b);
  ctx.lineTo(...c);
  ctx.lineTo(...d);
  ctx.closePath();
  ctx.clip();

  // The first affine pass also fills under the second triangle's shared
  // edge so antialiased clipping never reveals the old texture along it.
  ctx.save();
  ctx.transform((b[0]-a[0])/w, (b[1]-a[1])/w, (c[0]-b[0])/h, (c[1]-b[1])/h, a[0], a[1]);
  ctx.drawImage(canvas,start*canvas.width,0,w,h,0,0,w,h);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(...a);
  ctx.lineTo(...c);
  ctx.lineTo(...d);
  ctx.closePath();
  ctx.clip();
  ctx.transform((c[0]-d[0])/w, (c[1]-d[1])/w, (d[0]-a[0])/h, (d[1]-a[1])/h, a[0], a[1]);
  ctx.drawImage(canvas,start*canvas.width,0,w,h,0,0,w,h);
  ctx.restore();

  if (!glossy) { ctx.restore(); return; }
  const gradient = ctx.createLinearGradient(a[0], a[1], c[0], c[1]);
  gradient.addColorStop(0, 'rgba(205,227,255,.14)');
  gradient.addColorStop(.42, 'rgba(205,227,255,.02)');
  gradient.addColorStop(.75, 'rgba(205,227,255,0)');
  gradient.addColorStop(1, 'rgba(205,227,255,.05)');
  ctx.fillStyle = gradient;
  const xs = quad.map(([x]) => x);
  const ys = quad.map(([,y]) => y);
  ctx.fillRect(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  ctx.restore();
}

function paintMonitor(ctx, canvas, panels) {
  panels.forEach((quad,i) => panel(ctx,canvas,quad,i/panels.length,(i+1)/panels.length));
}
const projectPanels = (panels, rect) => panels.map(quad =>
  quad.map(([u,v]) => [rect.x+u*rect.width,rect.y+v*rect.height]));

export async function createRenderedView({viewport, spots, byKey, deskProps, size, state, redraw, mark, returned, motion}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {alpha: false});
  viewport.replaceChildren(canvas);
  const cache = new Map();
  function image(frame) {
    if (cache.has(frame.image)) return cache.get(frame.image);
    const entry = {bitmap: new Image(), loaded: false};
    entry.ready = new Promise((resolve, reject) => {
      entry.bitmap.onload = () => { entry.loaded = true; redraw(); resolve(); };
      entry.bitmap.onerror = () => reject(new Error('Could not load ' + frame.image));
    });
    entry.bitmap.src = new URL(frame.image, domain).href;
    cache.set(frame.image, entry);
    return entry;
  }
  await image(frames.tour[0]).ready;
  for (const index of Array.from({length: frames.tour.length - 1},(_,i) => i+1)) {
    image(frames.tour[index]).ready.catch(() => {});
  }
  for (const frame of [...Object.values(frames.focus), ...frames.bookOpening]) image(frame).ready.catch(() => {});

  let dpr = 1;
  let needsDraw = true;
  let pickQuads = {};
  let transition;
  let focusAmount = 0;
  let focused;
  let steamTime = -Infinity;
  let frameTime = 0;
  let bookStart = 0;
  const rectWidth = 1440, rectHeight = 900;

  function resize() {
    const {width,height} = size();
    if (!width || !height) return;
    dpr = Math.min(devicePixelRatio, 2, Math.sqrt(4500000/(width*height)));
    canvas.width = Math.round(width*dpr);
    canvas.height = Math.round(height*dpr);
    needsDraw = true;
  }

  function baseRect(w, h, drag = false) {
    const fit = Math.min(w/rectWidth, h/rectHeight);
    const {yaw,pitch} = state();
    const width = rectWidth * fit, height = rectHeight * fit;
    return {x: (w-width)/2 + (drag ? -yaw * w * .10 : 0),
      y: (h-height)*(w < 730 ? .25 : .5) + (drag ? -pitch * h * .15 : 0), width, height};
  }

  function project(frame, rect) {
    return Object.fromEntries(Object.entries({...frame.screens, ...frame.targets}).map(([key, points]) =>
      [key, projectPanels(points,rect)]));
  }

  function paintProps(ctx, frame, rect) {
    for (const [name, corners] of Object.entries(frame.props ?? {})) {
      const [quad] = projectPanels([corners],rect);
      panel(ctx,deskProps.canvases[name],quad,0,1,name==='ClockLCD');
    }
  }

  function paint(frame, rect, alpha) {
    if (alpha <= 0) return {};
    const data = image(frame);
    if (!data.loaded) return {};
    const {width,height} = size();
    const quads = project(frame, rect);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (alpha === 1) {
      ctx.fillStyle = '#eae9e7';
      ctx.fillRect(0,0,width,height);
      ctx.drawImage(data.bitmap,rect.x,rect.y,rect.width,rect.height);
      for (const [key,quad] of Object.entries(quads)) {
        const screen = byKey.get(key)?.screen;
        if (screen) paintMonitor(ctx, screen.canvas, quad);
      }
      paintProps(ctx,frame,rect);
      if (frame.steam) drawSteam(ctx,rect.x+frame.steam[0]*rect.width,rect.y+frame.steam[1]*rect.height,rect.height*.112,frameTime);
    } else {
      // Build the second frame at full opacity before compositing, so the old
      // monitor artwork in its room image cannot bleed through the new screen.
      if (layer.width !== canvas.width || layer.height !== canvas.height) {
        layer.width = canvas.width;
        layer.height = canvas.height;
      }
      layerCtx.setTransform(dpr,0,0,dpr,0,0);
      layerCtx.fillStyle = '#eae9e7';
      layerCtx.fillRect(0,0,width,height);
      layerCtx.drawImage(data.bitmap,rect.x,rect.y,rect.width,rect.height);
      for (const [key,quad] of Object.entries(quads)) {
        const screen = byKey.get(key)?.screen;
        if (screen) paintMonitor(layerCtx, screen.canvas, quad);
      }
      paintProps(layerCtx,frame,rect);
      if (frame.steam) drawSteam(layerCtx,rect.x+frame.steam[0]*rect.width,rect.y+frame.steam[1]*rect.height,rect.height*.112,frameTime);
      ctx.drawImage(layer,0,0,width,height);
    }
    ctx.restore();
    return quads;
  }

  const layer = document.createElement('canvas');
  const layerCtx = layer.getContext('2d', {alpha: false});
  const imageFrame = (n) => frames.tour[n];
  function closestLoaded(n) {
    for (let offset=0;offset<frames.tour.length;offset++) {
      for (const i of new Set([n-offset,n+offset])) {
        if (i >= 0 && i < frames.tour.length && image(imageFrame(i)).loaded) return imageFrame(i);
      }
    }
    return imageFrame(0);
  }

  function focus(spot) {
    if (spot) { focused = spot; bookStart = performance.now(); }
    transition = {from: focusAmount, to: spot ? 1 : 0, start: performance.now()};
    needsDraw = true;
  }

  function draw(time, screenChanges, moving) {
    const animateSteam = !motion.matches && time - steamTime > 42;
    const propsChanged = deskProps.update().length > 0;
    const turningPage = focused?.key === 'Thesis' && !motion.matches && time - bookStart < 1370;
    if (!turningPage && !propsChanged && !needsDraw && !screenChanges && !moving && !transition && !animateSteam) return;
    frameTime = motion.matches ? 0 : time;
    if (animateSteam) steamTime = time;
    const {width,height} = size();
    if (!width || !height) return;
    const {progress,active,focusYaw,focusPitch,focusZoom} = state();
    if (transition) {
      const t = motion.matches ? 1 : clamp((time-transition.start)/850,0,1);
      focusAmount = transition.from + (transition.to-transition.from)*ease(t);
      if (t === 1) {
        transition = null;
        if (focusAmount === 0) { focused = null; returned(); }
      }
    }
    needsDraw = false;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const frameNumber = progress*(frames.tour.length - 1)/2;
    const lo = Math.floor(frameNumber), hi = Math.ceil(frameNumber);
    const mix = motion.matches ? Math.round(frameNumber-lo) : frameNumber-lo;
    const first = closestLoaded(lo), second = closestLoaded(hi);
    const dominant = mix < .5 ? first : second;
    const base = baseRect(width,height,true);
    const opening = focused?.key === 'Thesis' && !motion.matches
      ? clamp((time-bookStart-620)/750,0,1) : 1;
    const bookStep = frames.bookOpening[Math.floor(opening * frames.bookOpening.length)];
    const chosen = focused && (opening < 1 && image(bookStep).loaded ? bookStep : frames.focus[focused.key]);
    const target = focused && (dominant.screens[focused.key] ?? dominant.targets[focused.key]);
    const focusTarget = chosen && (chosen.screens[focused.key] ?? chosen.targets[focused.key]);
    const focusFrame = focusTarget && image(chosen).loaded ? chosen : null;
    let rect = base;
    if (target && focusAmount > 0) {
      const quad = projectPanels(target,base);
      const [cx,cy] = center(quad);
      const [sw,sh] = span(quad);
      const zoom = clamp(Math.min(width*.76 / Math.max(1,sw),height*.71 / Math.max(1,sh)),1,38);
      const factor = 1+(zoom-1)*focusAmount;
      rect = {x: (base.x-cx)*factor + cx + (width/2-cx)*focusAmount,
        y: (base.y-cy)*factor + cy + (height/2-cy)*focusAmount,
        width: base.width*factor,height: base.height*factor};
    }
    const mixFocus = focusFrame ? ease(clamp((focusAmount-.69)/.31,0,1)) : 0;
    if (mixFocus < 1) {
      const q1 = paint(first,rect,1);
      const q2 = first === second ? q1 : paint(second,rect,mix);
      pickQuads = mix < .5 ? q1 : q2;
    }
    if (mixFocus > 0) {
      let detail = baseRect(width,height);
      const quad = projectPanels(focusTarget,detail);
      const [cx,cy] = center(quad), [sw,sh] = span(quad);
      const factor = Math.min(width*.85/sw,height*.77/sh)/focusZoom;
      detail = {x:(detail.x-cx)*factor+width/2-focusYaw*width*.18,y:(detail.y-cy)*factor+height/2-focusPitch*height*.25,width:detail.width*factor,height:detail.height*factor};
      const projected = paint(focusFrame,detail,mixFocus);
      if (mixFocus > .5) pickQuads = projected;
    }
    if (!active && !state().returning) {
      for (const spot of spots) {
        const quad = pickQuads[spot.key];
        if (quad) {
          const [x,y] = center(quad);
          mark(spot,x,y,true);
        } else mark(spot,0,0,false);
      }
    }
  }

  function pick(x,y) {
    if (transition) return;
    for (const [key,quad] of Object.entries(pickQuads)) {
      for (const [i,panel] of quad.entries()) {
        const uv = inside(x,y,panel);
        if (uv) return {spot: byKey.get(key),u:(i+uv[0])/quad.length,v:uv[1]};
      }
    }
  }

  function projectFocus() {
    if (!focused || transition || focused.key === 'Thesis' && !motion.matches && frameTime-bookStart<1370) return;
    const panels = pickQuads[focused.key];
    return panels?.length ? panels : null;
  }
  return {live:false,resize,draw,pick,focus,projectFocus,canDismiss: () => !transition};
}
