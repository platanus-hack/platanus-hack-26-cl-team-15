// A Sentinel-2-like satellite built from simple solids: foil-wrapped bus, one three-panel solar wing,
// star trackers, an X-band dish and the imager looking down (-Y). Sized ~0.2 Earth radii across.

function canvasTexture(THREE, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Crumpled-foil relief: many small overlapping facets of random grey. */
function foilBump(THREE) {
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const t = canvasTexture(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i += 1) {
      const x = rnd() * w; const y = rnd() * h; const r = 4 + rnd() * 14;
      ctx.fillStyle = `rgba(${rnd() < 0.5 ? 255 : 0},${rnd() < 0.5 ? 255 : 0},${rnd() < 0.5 ? 255 : 0},0.08)`;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 4; k += 1) ctx.lineTo(x + (rnd() - 0.5) * r * 2, y + (rnd() - 0.5) * r * 2);
      ctx.fill();
    }
  });
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function cellsTexture(THREE) {
  return canvasTexture(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0A1736'; ctx.fillRect(0, 0, w, h);
    const cw = w / 8; const ch = h / 10;
    for (let i = 0; i < 8; i += 1) {
      for (let j = 0; j < 10; j += 1) {
        const g = ctx.createLinearGradient(i * cw, j * ch, (i + 1) * cw, (j + 1) * ch);
        g.addColorStop(0, '#1B3A80'); g.addColorStop(1, '#10275A');
        ctx.fillStyle = g; ctx.fillRect(i * cw + 2, j * ch + 2, cw - 4, ch - 4);
      }
    }
  });
}

function materials(THREE, style) {
  if (style === 'flat') {
    const m = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
    return { foil: m('#E3A93F'), silver: m('#E8ECF1'), cells: m('#2F55B4'), dark: m('#26313F'), lens: m('#0E1A26') };
  }
  return {
    foil: new THREE.MeshStandardMaterial({ color: '#E2B24E', metalness: 0.65, roughness: 0.38, bumpMap: foilBump(THREE), bumpScale: 2.2, envMapIntensity: 2.2 }),
    silver: new THREE.MeshStandardMaterial({ color: '#D5DCE4', metalness: 0.7, roughness: 0.3, envMapIntensity: 1.8 }),
    cells: new THREE.MeshStandardMaterial({ map: cellsTexture(THREE), metalness: 0.5, roughness: 0.2, envMapIntensity: 2.5 }),
    dark: new THREE.MeshStandardMaterial({ color: '#1C232C', metalness: 0.4, roughness: 0.6 }),
    lens: new THREE.MeshStandardMaterial({ color: '#06121C', metalness: 0.8, roughness: 0.08 }),
  };
}

export function buildSatellite(THREE, style) {
  const mats = materials(THREE, style);
  const g = new THREE.Group();
  const add = (geo, mat, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos); m.rotation.set(...rot);
    g.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(0.034, 0.03, 0.042), mats.foil);
  add(new THREE.BoxGeometry(0.036, 0.0025, 0.044), mats.silver, [0, 0.0165, 0]);
  add(new THREE.CylinderGeometry(0.0011, 0.0011, 0.028, 8), mats.silver, [-0.031, 0.002, 0], [0, 0, Math.PI / 2]);
  const wing = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.0014, 0.052), mats.cells);
    p.position.x = -0.07 - i * 0.048;
    wing.add(p);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.0016, 0.002, 0.053), mats.silver);
    frame.position.x = -0.07 - i * 0.048 + 0.024;
    wing.add(frame);
  }
  wing.position.y = 0.002; wing.rotation.x = 0.4;
  g.add(wing);
  add(new THREE.BoxGeometry(0.018, 0.012, 0.022), mats.dark, [0.004, -0.021, 0.004]);
  add(new THREE.CylinderGeometry(0.006, 0.0065, 0.004, 28), mats.lens, [0.004, -0.0285, 0.004]);
  add(new THREE.CylinderGeometry(0.0018, 0.0018, 0.006, 14), mats.silver, [0.011, 0.02, -0.015], [0.4, 0, 0.3]);
  add(new THREE.CylinderGeometry(0.0016, 0.0016, 0.005, 14), mats.silver, [0.005, 0.02, -0.017], [0.5, 0, -0.2]);
  add(new THREE.SphereGeometry(0.008, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), mats.silver, [0.02, -0.014, -0.02], [Math.PI * 0.85, 0, 0.3]);
  add(new THREE.CylinderGeometry(0.0007, 0.0007, 0.008, 6), mats.silver, [0.018, -0.011, -0.018], [0.4, 0, 0.3]);
  return g;
}

/** The same satellite as glowing outlines, for the blueprint style. */
export function satelliteOutline(THREE, color) {
  const solid = buildSatellite(THREE, 'flat');
  const g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
  solid.updateMatrixWorld(true);
  solid.traverse((o) => {
    if (!o.isMesh) return;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 20), mat);
    lines.applyMatrix4(o.matrixWorld);
    g.add(lines);
  });
  return g;
}
