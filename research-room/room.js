import {createDeskProps} from './desk-props.js';
import {
  Scene, PerspectiveCamera, WebGLRenderer, GLTFLoader, Vector3, Quaternion,
  DirectionalLight, AmbientLight, Mesh, PlaneGeometry, MeshBasicMaterial, Texture, MeshPhysicalMaterial, SRGBColorSpace, ToneMapping,
} from './room-runtime.js';
import {createScreenPicker} from './screen-picker.js';
import {createSplitScreen} from './screen-content.js';
import geometry, {screenPanels} from './screen-geometry.js';
import {inspect, openBook} from './inspect-geometry.js';
import {stops, steamOrigin} from './desk-layout.js';
import {createBookPages} from './book-pages.js';
import {mountMonitorWindows, gammaURL} from './monitor-windows.js';
import {drawSteam} from './steam.js';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const tour = $('tour');
const room = viewport.parentElement;
const back = $('back');
const focusControls = $('focus-controls');
const paperLink = $('paper-link');
const paperTurn = $('paper-turn');
const bookPages = createBookPages(() => { redraw = true; });
const windows = mountMonitorWindows(() => back.click());
const orbit = $('orbit');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 730px)');
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const ease = (t) => t * t * (3 - 2 * t);
const stopKeys = ['Plane_Screen.001_0', 'Plane_Screen.002_0', 'Plane_Screen.001_0'];
const chapters = [
  ['Workspace', 'The research desk', 'I’m Snawar. Explore my MRI research from the screens on my desk.', 'Open desktop'],
  ['Simulation', 'MRI simulation', 'Watch the FLASH sequence alongside GammaSTAR.', 'Open ultrawide'],
  ['Projects', 'Research projects', 'Open the Echo Pathway site or browse my portfolio from the desktop.', 'Open desktop'],
];
const lastStop = chapters.length - 1;
const deskProps = createDeskProps();
deskProps.update();
const point = (p) => new Vector3().fromArray(p);
const labels = {Thesis:'thesis book', Notebook:'research notebook', ClockLCD:'clock', CalendarPaper:'calendar', PhotoFrame:'Bremen photo frame'};
const spots = Object.entries({...geometry, ...inspect}).map(([key, coords]) => {
  const corners = coords.map(point);
  const [a,b,c,d] = corners;
  const across = b.clone().sub(a);
  const down = d.clone().sub(a);
  const center = a.clone().add(b).add(c).add(d).multiplyScalar(.25);
  const normal = down.clone().cross(across).normalize();
  const screen = geometry[key] ? createSplitScreen(key, across.length() / down.length(), () => { redraw = true; }, windows.open) : null;
  const title = screen?.title ?? labels[key];
  const marker = document.createElement('button');
  marker.className = 'marker';
  marker.hidden = true;
  marker.title = title;
  marker.setAttribute('aria-label', (key === 'Thesis' ? 'Open ' : 'Inspect ') + title);
  marker.onclick = () => openScreen(key);
  $('markers').append(marker);
  return {key, corners, across, down, center, normal, screen, marker, title};
});
const byKey = new Map(spots.map((spot) => [spot.key, spot]));

let redraw = true;
let view;
let active = null;
let previousFocus;
let scrolling = 0;
let renderedScroll = 0;
let chapter = -1;
let free = false;
let yaw = 0, pitch = 0;
let lookYaw = 0, lookPitch = 0;
let focusYaw = 0, focusPitch = 0, lookFocusYaw = 0, lookFocusPitch = 0;
let focusZoom = 1, lookFocusZoom = 1;
let wideOpened = false;
let zoom = 1, lookZoom = 1;
let returning = false;
let previousFrameTime;
let ready = false;
let size = {width: 1, height: 1};

chapters.forEach(([label], i) => {
  const section = document.createElement('section');
  section.setAttribute('aria-label', label);
  tour.append(section);
  const button = document.createElement('button');
  button.textContent = label;
  button.onclick = () => {
    if (free) toggleOrbit();
    tour.scrollTo({top: i * tour.clientHeight, behavior: motion.matches ? 'instant' : 'smooth'});
  };
  $('navigation').append(button);
});

function describeChapter(index) {
  if (chapter === index) return;
  chapter = index;
  const [label, title, description, action] = chapters[index];
  $('counter').textContent = label;
  $('heading').textContent = title;
  $('description').textContent = description;
  $('detail').textContent = action;
  $('detail').onclick = () => openScreen(stopKeys[index]);
  [...$('navigation').children].forEach((button, i) => button.setAttribute('aria-current', String(i === index)));
}

tour.addEventListener('scroll', () => {
  scrolling = clamp(tour.scrollTop / Math.max(1, tour.clientHeight), 0, lastStop);
}, {passive: true});
describeChapter(0);

function toggleOrbit() {
  if (!view?.live || active) return;
  free = !free;
  if (!free) {
    yaw = pitch = 0;
    zoom = 1;
  }
  room.classList.toggle('orbit', free);
  orbit.setAttribute('aria-pressed', String(free));
  orbit.textContent = free ? 'Return to tour' : 'Free orbit';
  $('hint').textContent = free ? 'Drag to look around · Scroll to zoom' : 'Scroll to move · Drag to look around';
  redraw = true;
}
orbit.onclick = toggleOrbit;

const overlays = [tour, $('markers'), document.querySelector('.story'), $('navigation'), orbit];
function openScreen(key) {
  if (!ready || active || returning || !byKey.has(key)) return;
  previousFocus = document.activeElement;
  active = byKey.get(key);

  room.classList.add('screen-focus');
  overlays.forEach((node) => { node.inert = true; });
  focusControls.hidden = false;
  paperLink.hidden = key !== 'Thesis';
  paperTurn.hidden = key !== 'Thesis' && key !== 'Notebook';
  if (!paperTurn.hidden) bookPages.reset(key === 'Notebook' ? 'notes' : 'paper');
  if (key === 'Plane_Screen.002_0' && !wideOpened) {
    windows.open('GammaSTAR', gammaURL, 'right');
    wideOpened = true;
  }
  focusZoom = lookFocusZoom = 1;
  focusYaw = focusPitch = lookFocusYaw = lookFocusPitch = 0;
  viewport.tabIndex = 0;
  viewport.setAttribute('aria-label', active.title + '. Drag to look around. Click outside or press Escape to return.');
  view.focus(active);
  viewport.focus({preventScroll: true});
  redraw = true;
}

function closeScreen() {
  if (!active) return;
  active = null;
  returning = true;
  focusControls.hidden = true;
  windows.close();
  viewport.tabIndex = -1;
  viewport.setAttribute('aria-label', 'Interactive research room');
  view.focus(null);
  redraw = true;
}

function finishedReturning() {
  if (!returning) return;
  returning = false;
  room.classList.remove('screen-focus');
  overlays.forEach((node) => { node.inert = false; });
  previousFocus?.focus({preventScroll: true});
}

back.onclick = closeScreen;
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && active) back.click();
  else if (['Thesis','Notebook'].includes(active?.key) && ['ArrowLeft','ArrowRight'].includes(event.key)) {
    event.preventDefault();
    bookPages.step(event.key === 'ArrowRight' ? 1 : -1);
  } else if (active && event.target === viewport) active.screen?.keydown(event);
});

function onResize() {
  size = {width: viewport.clientWidth, height: viewport.clientHeight};
  view?.resize();
  redraw = true;
}
new ResizeObserver(onResize).observe(viewport);
onResize();

function updateMarker(spot, x, y, visible) {
  const story = document.querySelector('.story');
  const base = room.getBoundingClientRect();
  const box = story.getBoundingClientRect();
  const covered = !free && x + base.left > box.left && x + base.left < box.right &&
    y + base.top > box.top && y + base.top < box.bottom;
  spot.marker.hidden = !!active || returning || covered || !visible ||
    x < 13 || x > size.width - 13 || y < 13 || y > size.height - 48;
  spot.marker.style.left = x + 'px';
  spot.marker.style.top = y + 'px';
}

function hitFromEvent(event) {
  const rect = viewport.getBoundingClientRect();
  return view?.pick(event.clientX - rect.left, event.clientY - rect.top);
}

let drag;
for (const surface of [tour, viewport]) {
  surface.addEventListener('pointerdown', (event) => {
    if (!ready || returning || event.button !== 0 || event.target === back) return;
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false};
    surface.setPointerCapture(event.pointerId);
  });
  surface.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) {
      if (ready && !returning) {
        const hit = hitFromEvent(event);
        surface.style.cursor = active ? (hit?.spot === active && active.screen?.hit(hit.u, hit.v) ? 'pointer' : 'grab') : (hit ? 'pointer' : 'grab');
      }
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.moved && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 6) return;
    drag.moved = true;
    if (active) {
      focusYaw = clamp(focusYaw - dx * .0014, -.085, .085);
      focusPitch = clamp(focusPitch - dy * .0014, -.065, .065);
      redraw = true;
    } else {
      const gain = free ? .004 : .0028;
      yaw = clamp(yaw - dx * gain, free ? -1.4 : -.48, free ? 1.4 : .48);
      pitch = clamp(pitch - dy * gain, free ? -.66 : -.28, free ? .76 : .28);
      redraw = true;
    }
  });
  surface.addEventListener('pointerup', (event) => {
    if (drag?.id !== event.pointerId) return;
    const clicked = !drag.moved;
    drag = null;
    if (!clicked || returning) return;
    const hit = hitFromEvent(event);
    if (active) {
      if (hit?.spot === active) {
        if (['Thesis','Notebook'].includes(active.key)) bookPages.click(hit.u);
        else active.screen?.click(hit.u, hit.v);
      }
      else if (view.canDismiss?.(event.clientX, event.clientY) !== false) back.click();
    } else if (hit) openScreen(hit.spot.key);
  });
  surface.addEventListener('pointercancel', () => { drag = null; });
}
viewport.addEventListener('dblclick', () => { if (active) back.click(); });
let wheelLast = -Infinity, wheelDirection = 0;
room.addEventListener('wheel', (event) => {
  if (!ready || event.ctrlKey) return;
  const delta = event.deltaY * ([1, 16, size.height][event.deltaMode] ?? 1);
  if (!delta || event.target.closest('.monitor-window')) return;
  event.preventDefault();
  if (active) {
    if (active.screen && !event.ctrlKey && active.screen.isDocument?.()) active.screen.wheel(delta * 1.45);
    else {
      focusZoom = clamp(focusZoom * Math.exp(delta * .0011), .80, 1.29);
      redraw = true;
    }
  }
  else if (free) {
    zoom = clamp(zoom * Math.exp(delta * .0017), .20, 4.3);
    redraw = true;
  } else if (!returning) {
    const now = performance.now();
    const direction = Math.sign(delta);
    const newGesture = now - wheelLast > (event.deltaMode === 0 ? 190 : 115) || direction !== wheelDirection;
    wheelLast = now;
    wheelDirection = direction;
    if (!newGesture) return;
    const target = clamp(Math.round(scrolling) + direction, 0, lastStop);
    scrolling = target;
    tour.scrollTop = target * tour.clientHeight;
  }
}, {passive: false});

function reflectionMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#161921';
  ctx.fillRect(0, 0, 512, 256);
  for (const [x,y,w,h] of [[36,62,118,24],[307,89,54,74]]) {
    const gradient = ctx.createRadialGradient(x+w/2,y+h/2,0,x+w/2,y+h/2,Math.max(w,h)*.65);
    gradient.addColorStop(0, '#bfc9db');
    gradient.addColorStop(.55, '#4f5968');
    gradient.addColorStop(1, '#171b24');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 22, y - 23, w + 44, h + 46);
  }
  const texture = new Texture(canvas);
  texture.mapping = 303;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

async function createLiveView() {
  const scene = new Scene();
  const camera = new PerspectiveCamera(28, 1, .065, 1000);
  const renderer = new WebGLRenderer({antialias: true, alpha: true, powerPreference: 'high-performance'});
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ToneMapping;
  renderer.toneMappingExposure = .81;
  scene.background = null;
  const sun = new DirectionalLight(0xffead4, 2.18);
  sun.position.set(-1.9, 4, 3.8);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-3.1,right:3.1,top:3.1,bottom:-3.1,far:12});
  sun.shadow.normalBias = .012;
  sun.shadow.bias = -.00035;
  sun.shadow.radius = 5;
  sun.shadow.intensity = .46;
  const fill = new DirectionalLight(0xf6f8ff, .74);
  fill.position.set(4, 3, -3);
  scene.add(sun, fill, new AmbientLight(0xffffff, .52));
  const {scene: model} = await new GLTFLoader().loadAsync(new URL('./assets/workstation.glb', import.meta.url).href);
  scene.add(model);
  model.updateMatrixWorld(true);
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 12);
  model.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = !object.name.startsWith('Studio');
      object.receiveShadow = true;
      if (object.name === 'Studio side wall') object.material.side = 2;
    }
    if (object.isMesh && object.material.map) {
      object.material.map.anisotropy = anisotropy;
      object.material.map.needsUpdate = true;
    }
  });
  const envMap = reflectionMap();
  scene.environment = envMap;
  const propTextures = Object.entries(deskProps.canvases).map(([name,canvas]) => {
    const surface = model.getObjectByName(name);
    const texture = new Texture(canvas);
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
    const lcd = name === 'ClockLCD';
    surface.material = new MeshPhysicalMaterial({
      map:texture, roughness:lcd ? .29 : .87, clearcoat:lcd ? .65 : 0,
      clearcoatRoughness:.30, envMapIntensity:lcd ? .3 : .07,
    });
    return [name,texture];
  });
  const refreshProps = () => {
    const changed = deskProps.update();
    for (const [name,texture] of propTextures) {
      if (changed.includes(name)) texture.needsUpdate=true;
    }
    return changed.length > 0;
  };
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 128;
  const shadowCtx = shadowCanvas.getContext('2d');
  const contacts = [[128,48,121,39,.09],[54,98,45,24,.10],[221,63,38,22,.09]];
  for (const [x,y,w,h,alpha] of contacts) {
    shadowCtx.save();
    shadowCtx.translate(x,y);
    shadowCtx.scale(w,h);
    const shadow = shadowCtx.createRadialGradient(0,0,0,0,0,1);
    shadow.addColorStop(0, `rgba(79,62,49,${alpha})`);
    shadow.addColorStop(1, 'rgba(79,62,49,0)');
    shadowCtx.fillStyle = shadow;
    shadowCtx.fillRect(-1,-1,2,2);
    shadowCtx.restore();
  }
  const shadowTexture = new Texture(shadowCanvas);
  shadowTexture.colorSpace = SRGBColorSpace;
  shadowTexture.needsUpdate = true;
  const shadowPlane = new Mesh(new PlaneGeometry(2.77,1.74), new MeshBasicMaterial({
    map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false,
  }));
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.set(0,.001,.25);
  scene.add(shadowPlane);

  const steamCanvas = document.createElement('canvas');
  steamCanvas.width = 176;
  steamCanvas.height = 256;
  const steamCtx = steamCanvas.getContext('2d');
  const steamTexture = new Texture(steamCanvas);
  steamTexture.colorSpace = SRGBColorSpace;
  const steam = new Mesh(new PlaneGeometry(.158,.23),new MeshBasicMaterial({
    map: steamTexture, transparent: true, depthWrite: false, toneMapped: false,
  }));
  steam.position.fromArray(steamOrigin);
  steam.position.y += .113;
  scene.add(steam);
  let steamTime = -Infinity;

  for (const spot of spots.filter(({screen}) => screen)) {
    // GLTFLoader strips periods from node names when making animation-safe names.
    const mesh = model.getObjectByName(spot.key.replace('.', ''));
    if (!mesh?.isMesh) throw new Error('Missing monitor surface ' + spot.key);
    spot.mesh = mesh;
    const position = mesh.geometry.getAttribute('position');
    const uv = mesh.geometry.getAttribute('uv');
    const uAxis = spot.across;
    const vAxis = spot.down;
    const uu = uAxis.lengthSq(), vv = vAxis.lengthSq(), uvDot = uAxis.dot(vAxis);
    const determinant = uu * vv - uvDot * uvDot;
    const relative = new Vector3();
    for (let i = 0; i < uv.count; i++) {
      mesh.localToWorld(relative.fromBufferAttribute(position, i)).sub(spot.corners[0]);
      const u = relative.dot(uAxis), v = relative.dot(vAxis);
      uv.setXY(i, (u * vv - v * uvDot) / determinant, (v * uu - u * uvDot) / determinant);
    }
    uv.needsUpdate = true;
    const texture = new Texture(spot.screen.canvas);
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = anisotropy;
    // The renderer refreshes dynamic, non-power-of-two canvas maps.
    texture.needsUpdate = true;
    spot.texture = texture;
    mesh.material = new MeshPhysicalMaterial({
      color: 0x14181d, map: texture, emissive: 0xffffff, emissiveMap: texture,
      emissiveIntensity: .88, roughness: .38, metalness: .12, clearcoat: .83,
      clearcoatRoughness: .19, envMap, envMapIntensity: .40, side: mesh.material.side,
    });
  }

  viewport.replaceChildren(renderer.domElement);
  const panelPoints = Object.fromEntries(Object.entries(screenPanels).map(([key,panels]) => [key,panels.map(panel => panel.map(point))]));
  const cast = createScreenPicker(model, spots.filter(spot => spot.mesh).map(spot => spot.mesh));
  const hinge = model.getObjectByName('ThesisHinge');
  const spread = openBook.map(point);
  let opening = 0;
  let bookStarted = 0;
  let bookFrom = 0;
  let bookTo = 0;
  const markerProjection = new Vector3();
  const sample = new PerspectiveCamera();
  const poses = stops.map(([position,quaternion]) => ({
    position: point(position), quaternion: new Quaternion().fromArray(quaternion),
  }));
  const worldUp = new Vector3(0, 1, 0);
  const localRight = new Vector3(1, 0, 0);
  const right = new Vector3();
  const cameraDirection = new Vector3();
  const pivot = new Vector3();
  const roomCenter = new Vector3(-.25,.78,0);
  const rotation = new Quaternion();
  const pitchRotation = new Quaternion();
  const basePos = new Vector3();
  const baseQuat = new Quaternion();
  const offset = new Vector3();
  let approach;
  let lastVisibility = 0;
  let updateOcclusion = true;

  function resize() {
    const {width, height} = size;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2.5, Math.sqrt(5600000 / (width * height))));
    renderer.setSize(width, height, false);
  }

  function tourPose(progress) {
    const i = Math.min(lastStop - 1, Math.floor(progress));
    const t = ease(progress - i);
    basePos.lerpVectors(poses[i].position, poses[i+1].position, t);
    baseQuat.slerpQuaternions(poses[i].quaternion, poses[i+1].quaternion, t);
    cameraDirection.set(0, 0, -1).applyQuaternion(baseQuat);
    pivot.copy(basePos).addScaledVector(cameraDirection, basePos.distanceTo(roomCenter));
    rotation.setFromAxisAngle(worldUp, lookYaw);
    right.copy(localRight).applyQuaternion(baseQuat).applyQuaternion(rotation);
    pitchRotation.setFromAxisAngle(right, lookPitch);
    rotation.premultiply(pitchRotation);
    offset.copy(basePos).sub(pivot).applyQuaternion(rotation).multiplyScalar(lookZoom);
    basePos.copy(pivot).add(offset);
    baseQuat.premultiply(rotation);
  }

  function monitorPose(spot, position, quaternion) {
    const across = spot.key === 'Thesis' ? spread[1].clone().sub(spread[0]) : spot.across;
    const center = spot.key === 'Thesis' ? spread[0].clone().lerp(spread[2], .5) : spot.center;
    const normal = spot.normal.clone();
    if (normal.dot(camera.position.clone().sub(center)) < 0) normal.negate();
    const fov = narrow.matches ? 47 : 28;
    const fit = Math.max(spot.down.length() / (spot.screen ? .77 : .62), across.length() / (camera.aspect * (spot.screen ? .87 : .74)));
    const distance = Math.max(.10, fit / (2 * Math.tan(fov * Math.PI / 360)));
    sample.up.copy(spot.down).normalize().negate();
    normal.applyAxisAngle(sample.up, lookFocusYaw).applyAxisAngle(across.clone().normalize(), lookFocusPitch);
    sample.position.copy(center).addScaledVector(normal, distance * lookFocusZoom);
    sample.lookAt(center);
    position.copy(sample.position);
    quaternion.copy(sample.quaternion);
  }

  function focus(spot) {
    updateOcclusion = true;
    bookFrom = opening;
    bookTo = Number(spot?.key === 'Thesis');
    bookStarted = performance.now();
    approach = {
      start: performance.now(), from: camera.position.clone(), rotation: camera.quaternion.clone(),
      fromShift: camera.view?.offsetY ?? 0, to: new Vector3(), target: new Quaternion(), spot,
    };
  }

  function pick(x, y) {
    if (returning || approach && !approach.done) return;
    for (const spot of active?.screen ? [] : active ? [active] : spots.filter(spot => !spot.screen && spot.visible)) {
      const points = (active && spot.key === 'Thesis' ? spread : spot.corners)
        .map(corner => corner.clone().project(camera));
      if (points.some(p => Math.abs(p.z) >= 1)) continue;
      const px = x * 2 / size.width - 1, py = 1 - y * 2 / size.height;
      const crosses = points.map((p,i) => {
        const q = points[(i + 1) % points.length];
        return (q.x-p.x)*(py-p.y) - (q.y-p.y)*(px-p.x);
      });
      if (crosses.every(c => c >= 0) || crosses.every(c => c <= 0)) {
        const left = (points[0].x + points[3].x) / 2;
        const right = (points[1].x + points[2].x) / 2;
        return {spot, u: (px-left)/(right-left)};
      }
    }
    const hit = cast(2 * x / size.width - 1, 1 - 2 * y / size.height, camera);
    const spot = spots.find((item) => item.mesh === hit?.object);
    if (spot && hit.uv) return {spot, u: hit.uv.x, v: hit.uv.y};
  }

  function draw(time, changedScreens, cameraMoving) {
    const animateSteam = !motion.matches && time - steamTime > 42;
    const propsChanged = refreshProps();
    const bookMoving = opening !== bookTo;
    if (bookMoving) {
      const t = motion.matches ? 1 : clamp((time - bookStarted - (bookTo ? 280 : 0)) / 750, 0, 1);
      opening = bookFrom + (bookTo - bookFrom) * ease(t);
      hinge.rotation.z = Math.PI * opening;
      renderer.shadowMap.needsUpdate = true;
    }
    if (!propsChanged && !bookMoving && !redraw && !changedScreens && !cameraMoving && !animateSteam && (!approach || approach.done)) return;
    const {width, height} = size;
    if (!width || !height) return;
    tourPose(renderedScroll);
    camera.fov = narrow.matches ? 47 : 28;
    camera.aspect = width / height;
    const tourShift = narrow.matches ? height * .10 : 0;
    let shift = tourShift;
    if (approach) {
      const t = motion.matches ? 1 : clamp((time - approach.start) / 850, 0, 1);
      const fraction = ease(t);
      if (approach.spot) monitorPose(approach.spot, approach.to, approach.target);
      else { approach.to.copy(basePos); approach.target.copy(baseQuat); }
      camera.position.lerpVectors(approach.from, approach.to, fraction);
      camera.quaternion.slerpQuaternions(approach.rotation, approach.target, fraction);
      shift = approach.fromShift + ((approach.spot ? 0 : tourShift) - approach.fromShift) * fraction;
      if (t === 1) {
        approach.done = true;
        if (!approach.spot) {
          approach = null;
          finishedReturning();
        }
      }
    } else {
      camera.position.copy(basePos);
      camera.quaternion.copy(baseQuat);
    }
    camera.setViewOffset(width, height, 0, shift, width, height);
    camera.updateMatrixWorld();
    for (const spot of changedScreens || []) spot.texture.needsUpdate = true;
    if (animateSteam || steamTime === -Infinity) {
      steamCtx.clearRect(0,0,176,256);
      drawSteam(steamCtx,88,252,255,motion.matches ? 0 : time);
      steamTexture.needsUpdate = true;
      steamTime = time;
    }
    steam.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);

    if (!active && !returning && (cameraMoving || redraw || updateOcclusion || time - lastVisibility > 180)) {
      const recast = updateOcclusion || time - lastVisibility > 66;
      for (const spot of spots) {
        markerProjection.copy(spot.center).project(camera);
        const {x, y, z} = markerProjection;
        const inside = Math.abs(x) < 1 && Math.abs(y) < 1 && Math.abs(z) < 1;
        // Test occlusion at the current camera pose before moving the marker.
        if (recast) spot.visible = inside && (!spot.screen || cast(x, y, camera)?.object === spot.mesh);
        updateMarker(spot, (x + 1) * width / 2, (1 - y) * height / 2, inside && spot.visible);
      }
      if (recast) lastVisibility = time;
      updateOcclusion = false;
    }
  }

  function projectFocus() {
    if (!active || !approach?.done || active.key === 'Thesis' && opening < .999) return;
    const corners = active.key === 'Thesis' ? spread : active.corners;
    return (panelPoints[active.key] ?? [corners]).map(panel => panel.map(corner => {
      const p = corner.clone().project(camera);
      return [(p.x+1)*size.width/2,(1-p.y)*size.height/2];
    }));
  }
  return {live: true, resize, draw, pick, focus, projectFocus, canDismiss: () => !approach || approach.done};
}

async function initialize() {
  try {
    view = await createLiveView();
  } catch (error) {
    console.info('Using rendered room views', error.message);
    const {createRenderedView} = await import('./rendered-view.js');
    view = await createRenderedView({viewport, spots, byKey, deskProps, size: () => size,
      state: () => ({progress: renderedScroll, yaw: lookYaw, pitch: lookPitch, focusYaw: lookFocusYaw, focusPitch: lookFocusPitch, focusZoom: lookFocusZoom, active, returning}),
      redraw: () => { redraw = true; }, mark: updateMarker, returned: finishedReturning, motion});
  }
  view.resize();
  ready = true;
  $('load').hidden = view.live;
  $('load').textContent = 'Rendered tour';
  $('load').title = 'Live 3D is unavailable in this browser. You can still inspect the desk and use the screens.';
  orbit.hidden = !view.live;
  orbit.disabled = !view.live;
  $('hint').textContent = view.live ? 'Scroll to move · Drag to look around' : 'Scroll to move · Click a desk item';
  requestAnimationFrame(tick);
}

function tick(time) {
  const dt = Math.min(75, time - (previousFrameTime ?? time - 16));
  previousFrameTime = time;
  const a = motion.matches ? 1 : 1 - Math.exp(-dt / 115);
  const old = [renderedScroll, lookYaw, lookPitch, lookZoom, lookFocusYaw, lookFocusPitch, lookFocusZoom];
  function follow(value, goal) {
    return Math.abs(goal - value) < .0004 ? goal : value + (goal - value) * a;
  }
  renderedScroll = follow(renderedScroll, scrolling);
  lookYaw = follow(lookYaw, yaw);
  lookPitch = follow(lookPitch, pitch);
  lookZoom = follow(lookZoom, zoom);
  lookFocusYaw = follow(lookFocusYaw, focusYaw);
  lookFocusPitch = follow(lookFocusPitch, focusPitch);
  lookFocusZoom = follow(lookFocusZoom, focusZoom);
  const moving = old.some((value, i) => value !== [renderedScroll, lookYaw, lookPitch, lookZoom, lookFocusYaw, lookFocusPitch, lookFocusZoom][i]);
  describeChapter(clamp(Math.round(renderedScroll), 0, lastStop));
  const changed = spots.filter(({screen}) => screen?.draw(time));
  view.draw(time, changed.length ? changed : null, moving);
  const panels = view.projectFocus();
  windows.align(panels, !!active?.screen);
  const quad = panels?.[0];
  bookPages.draw(['Thesis','Notebook'].includes(active?.key) ? quad : null, size, time);
  redraw = false;
  requestAnimationFrame(tick);
}

initialize().catch((error) => {
  console.error(error);
  $('load').textContent = 'The room could not load. Reload to try again.';
});
