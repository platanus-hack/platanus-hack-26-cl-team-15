// One scene, several looks. The Earth (radius 1) carries the real Sentinel-2 mosaic; the satellite
// rides its orbit at +Z; the Earth turns until Chile is under it; its swath lights up; the camera
// pulls back from the satellite until all of Chile is in frame, where the sharp Sentinel-2 view takes over.
import * as THREE from '../vendor/three.module.min.js'; // bundled: the artifact viewer did not load it from the CDN
import { buildSatellite, satelliteOutline } from './sat3d.js';

const EARTH_TEXTURE = 'img/earth.jpg';
const TARGET = { lat: -36.5, lon: -71.2 }; // middle of continental Chile, the centre of img/chile.jpg
const ORBIT_R = 1.16;
const SAT_SCALE = 0.55; // the hand-built satellite stays small in frame, seen from afar
const FOV = 35;
const OV_PPR = 2600; // pixels per radian of img/chile.jpg, an orthographic view centred on the target
const EARTH_KM = 6371;
const FRAME_SHIFT = -0.3; // camera offset that moves the target right on wide screens
const SURFACE = new THREE.Vector3(0, 0, 1); // the target, once the Earth has turned it under the satellite
const rad = THREE.MathUtils.degToRad;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const span = (t, a, b) => clamp01((t - a) / (b - a));

function envMap(renderer) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#0a0d12'); g.addColorStop(0.45, '#1a2230'); g.addColorStop(0.62, '#3d6a9c'); g.addColorStop(1, '#8fb9de');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128);
  const s = ctx.createRadialGradient(60, 38, 0, 60, 38, 22);
  s.addColorStop(0, '#fff'); s.addColorStop(0.3, '#fff3d6'); s.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = s; ctx.fillRect(0, 0, 256, 128);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromEquirectangular(t).texture;
  pm.dispose();
  return env;
}

function atmosphere(color, power) {
  return new THREE.Mesh(new THREE.SphereGeometry(1.07, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    uniforms: { c: { value: new THREE.Color(color) }, p: { value: power } },
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 c; uniform float p; varying vec3 vN; void main(){ float i = pow(clamp(0.78 - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), p); gl_FragColor = vec4(c * i * 1.6, 1.0); }',
  }));
}

function stars(count, radius, size, color) {
  const pos = new Float32Array(count * 3);
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < count; i += 1) {
    const u = rnd() * 2 - 1; const a = rnd() * Math.PI * 2; const r = Math.sqrt(1 - u * u);
    pos.set([r * Math.cos(a) * radius, u * radius, r * Math.sin(a) * radius], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity: 0.85 }));
}

/** Direction of (lat, lon) on a SphereGeometry textured with an equirectangular map. */
const dirOf = (lat, lon) => new THREE.Vector3(Math.cos(rad(lon)) * Math.cos(rad(lat)), Math.sin(rad(lat)), -Math.sin(rad(lon)) * Math.cos(rad(lat)));

function landDots(image, color) {
  const c = document.createElement('canvas');
  const W = 720; const H = 360;
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(image, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const pts = [];
  for (let y = 2; y < H; y += 3) {
    for (let x = 0; x < W; x += 3) {
      const i = (y * W + x) * 4;
      const ocean = d[i + 2] > d[i] + 12 && d[i + 2] > d[i + 1] - 4;
      if (ocean) continue;
      const v = dirOf(90 - (y / H) * 180, (x / W) * 360 - 180).multiplyScalar(1.003);
      pts.push(v.x, v.y, v.z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.0065, transparent: true, opacity: 0.95 }));
}

function graticule(color) {
  const pts = [];
  for (let lat = -75; lat <= 75; lat += 15) for (let lon = -180; lon < 180; lon += 3) pts.push(dirOf(lat, lon), dirOf(lat, lon + 3));
  for (let lon = -180; lon < 180; lon += 15) for (let lat = -87; lat < 87; lat += 3) pts.push(dirOf(lat, lon), dirOf(lat + 3, lon));
  const geo = new THREE.BufferGeometry().setFromPoints(pts.map((p) => p.multiplyScalar(1.002)));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.22 }));
}

function posterize(image) {
  const c = document.createElement('canvas');
  c.width = image.width; c.height = image.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const ocean = d[i + 2] > d[i] + 12;
    if (ocean) { d[i] = 32; d[i + 1] = 62; d[i + 2] = 104; continue; }
    for (let k = 0; k < 3; k += 1) d[i + k] = Math.min(255, Math.round((d[i + k] * 1.25) / 48) * 48 + 20);
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Each path: camera keyframes (time, position, look-at) and when each event runs, in seconds.
const TIMELINES = {
  wide: {
    dur: 6, startLat: TARGET.lat + 12, earth: [0, 2.2], beam: [1.6, 2.2, 3.6, 4.4], swath: [1.8, 2.6, 4.6, 5.6], exit: [2.8, 5.4], fade: [4.5, 5.9],
    keys: [0, 1.9, 3.5, 6],
    // ends square over Chile, far enough back to hold the whole country from Arica to Magallanes
    pos: [[0.72, 0.6, 2.6], [0.45, 0.4, 2.15], [0.12, 0.12, 1.95], [0, 0, 2.36]],
    tgt: [[0, 0.06, 1.08], [0, 0.02, 1.05], [0, 0, 1], [0, 0, 1]],
    labels: { sat: [0, 2.9], chile: [2.2, 5], swath: [2.6, 4.6] },
  },
};

const STYLES = {
  real: { stars: true, atmosphere: '#5aa8ff', satellite: 'pbr', earth: 'photo', path: 'wide', labels: false, overlayFilter: '' },
  doc: { stars: true, atmosphere: '#5aa8ff', satellite: 'pbr', earth: 'photo', path: 'wide', labels: true, orbitLine: true, swath: false, overlayFilter: '' },
  blueprint: { stars: false, atmosphere: '#2dd4bf', satellite: 'outline', earth: 'dots', path: 'wide', labels: true, orbitLine: true, overlayFilter: 'grayscale(1) sepia(1) hue-rotate(130deg) saturate(2.2) brightness(.85)' },
  flat: { stars: false, atmosphere: null, satellite: 'flat', earth: 'poster', path: 'wide', labels: true, overlayFilter: 'saturate(1.3) contrast(1.15)' },
};

export function createScene(stage, styleName) {
  const style = STYLES[styleName];
  const canvas = stage.querySelector('canvas');
  const overlay = stage.querySelector('.ov');
  const labels = { sat: stage.querySelector('[data-label="sat"]'), chile: stage.querySelector('[data-label="chile"]'), swath: stage.querySelector('[data-label="swath"]') };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = style.earth === 'photo' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.001, 200);
  if (style.satellite === 'pbr') scene.environment = envMap(renderer);

  const sun = new THREE.DirectionalLight('#fff6e8', style.earth === 'poster' ? 2.2 : 3.2);
  sun.position.set(-2.2, 1.4, 2.4);
  scene.add(sun, new THREE.AmbientLight('#9fb7d6', style.earth === 'photo' ? 0.08 : 0.55));
  if (style.stars) scene.add(stars(1600, 60, 1.4, '#ffffff'));

  const earth = new THREE.Group();
  earth.rotation.order = 'XYZ';
  scene.add(earth);
  const sphere = new THREE.SphereGeometry(1, 128, 64);
  const loader = new THREE.TextureLoader();
  const ready = new Promise((resolve) => {
    loader.load(EARTH_TEXTURE, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      if (style.earth === 'photo') earth.add(new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0, envMapIntensity: 0 })));
      else if (style.earth === 'poster') earth.add(new THREE.Mesh(sphere, new THREE.MeshLambertMaterial({ map: posterize(tex.image) })));
      else {
        earth.add(new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: '#06202a' })));
        earth.add(landDots(tex.image, '#5eead4'), graticule('#5eead4'));
      }
      resolve();
    }, undefined, () => resolve());
  });
  if (style.atmosphere) scene.add(atmosphere(style.atmosphere, style.earth === 'photo' ? 3.2 : 4));

  const tl = TIMELINES[style.path];
  const sat = new THREE.Group();
  sat.add(style.satellite === 'outline' ? satelliteOutline(THREE, '#99f6e4') : buildSatellite(THREE, style.satellite === 'flat' ? 'flat' : 'pbr'));
  sat.scale.setScalar(SAT_SCALE);
  scene.add(sat);
  const BASE_TILT = Math.PI / 2; // the imager is drawn on -Y; this turns it to face the Earth
  if (style.earth === 'photo') {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,250,235,1)'); g.addColorStop(0.15, 'rgba(255,240,210,.55)'); g.addColorStop(1, 'rgba(255,230,200,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glint.scale.setScalar(0.05);
    glint.position.set(-0.04, 0.01, 0); // on the solar wing, which catches the sun
    sat.add(glint);
  }

  const beamMat = new THREE.MeshBasicMaterial({ color: style.earth === 'dots' ? '#5eead4' : '#9bd8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.023, ORBIT_R - 1, 48, 1, true), beamMat);
  beam.rotation.x = Math.PI / 2; // apex at the satellite
  beam.position.z = 1 + (ORBIT_R - 1) / 2;
  scene.add(beam);
  const swathMat = new THREE.MeshBasicMaterial({ color: style.earth === 'dots' ? '#5eead4' : '#7dd3fc', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const swath = new THREE.Mesh(new THREE.PlaneGeometry(0.0455, 0.3), swathMat); // 290 km wide
  swath.position.z = 1.004;
  if (style.swath !== false) scene.add(swath); // the landing leaves the lit swath out

  if (style.orbitLine) {
    const curve = new THREE.EllipseCurve(0, 0, ORBIT_R, ORBIT_R, 0, Math.PI * 2);
    const pts = curve.getPoints(256).map((p) => new THREE.Vector3(0, p.x, p.y));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: style.earth === 'dots' ? '#5eead4' : '#cfe8ff', dashSize: 0.02, gapSize: 0.015, transparent: true, opacity: 0.55 }));
    line.computeLineDistances();
    scene.add(line);
  }

  const posCurve = new THREE.CatmullRomCurve3(tl.pos.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const TARGETS = tl.tgt.map((p) => new THREE.Vector3(...p)); // blended linearly per leg
  const KEYS = tl.keys;
  const DURATION = tl.dur;

  const camAt = (time) => {
    const t = Math.max(0, Math.min(DURATION, time));
    let i = KEYS.findIndex((k, j) => t >= k && t <= KEYS[j + 1]);
    if (i < 0) i = KEYS.length - 2;
    let s = clamp01((t - KEYS[i]) / (KEYS[i + 1] - KEYS[i]));
    s = i === KEYS.length - 2 ? easeOut(s) : ease(s); // the last leg only slows down: no dive
    const u = (i + s) / (KEYS.length - 1);
    return { pos: posCurve.getPoint(u), tgt: TARGETS[i].clone().lerp(TARGETS[i + 1], s) };
  };

  const v = new THREE.Vector3();
  const place = (el, world, show) => {
    if (!el) return;
    v.copy(world).project(camera);
    const visible = show && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    el.style.opacity = visible ? 1 : 0;
    el.style.transform = `translate(${((v.x + 1) / 2) * 100}cqw, ${((1 - v.y) / 2) * 100}cqh)`;
  };

  const frame = (t) => {
    const w = stage.clientWidth; const h = stage.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const lat = tl.startLat + (TARGET.lat - tl.startLat) * ease(span(t, ...tl.earth));
    earth.rotation.set(rad(lat), rad(-90 - TARGET.lon), 0);
    const exit = rad(-42) * ease(span(t, ...tl.exit)); // the satellite carries on south, out of frame
    sat.position.set(0, Math.sin(exit) * ORBIT_R, Math.cos(exit) * ORBIT_R);
    sat.rotation.set(BASE_TILT - exit, 0, Math.sin(t * 0.6) * 0.04);
    beam.position.set(0, Math.sin(exit) * (1 + (ORBIT_R - 1) / 2), Math.cos(exit) * (1 + (ORBIT_R - 1) / 2));
    beam.rotation.x = Math.PI / 2 - exit;
    beamMat.opacity = 0.32 * span(t, tl.beam[0], tl.beam[1]) * (1 - span(t, tl.beam[2], tl.beam[3]));
    swathMat.opacity = 0.38 * span(t, tl.swath[0], tl.swath[1]) * (1 - span(t, tl.swath[2], tl.swath[3]) * 0.6);
    const { pos, tgt } = camAt(t);
    const ox = camera.aspect > 1.2 ? FRAME_SHIFT * ease(span(t, 3.2, 6)) : 0; // wide screens: Chile settles right of the copy
    pos.x += ox; tgt.x += ox;
    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(tgt);
    renderer.render(scene, camera);
    if (style.labels) {
      const on = ([a, b]) => t > a && t < b;
      place(labels.sat, sat.position, on(tl.labels.sat));
      place(labels.chile, new THREE.Vector3(0.07, -0.1, 1.0), on(tl.labels.chile));
      place(labels.swath, new THREE.Vector3(0.03, 0.12, 1.01), on(tl.labels.swath));
    }
    // Hand over to the sharp crop: match its scale to what the camera sees around the target.
    const fade = span(t, ...tl.fade);
    overlay.style.opacity = fade;
    if (fade > 0) {
      const dist = SURFACE.clone().sub(camera.position).dot(camera.getWorldDirection(v)); // depth along the view, not slant range
      const viewKm = 2 * dist * Math.tan(rad(FOV / 2)) * EARTH_KM;
      const s = (h / viewKm) / (OV_PPR / EARTH_KM);
      v.copy(SURFACE).project(camera);
      overlay.style.setProperty('--s', s.toFixed(4));
      overlay.style.transform = `translate(${((v.x + 1) / 2) * 100}cqw, ${((1 - v.y) / 2) * 100}cqh) translate(-50%, -50%) scale(${s})`;
    }
  };

  let raf = 0; let t0 = 0;
  const loop = (now) => {
    const t = Math.max(0, Math.min(DURATION, (now - t0) / 1000)); // a frame's timestamp can precede t0
    frame(t);
    if (t < DURATION) raf = requestAnimationFrame(loop);
  };
  return {
    ready,
    play() { cancelAnimationFrame(raf); t0 = performance.now(); raf = requestAnimationFrame(loop); },
    still(t) { cancelAnimationFrame(raf); frame(t); },
    filter: style.overlayFilter,
  };
}
