// The cover: the satellite intro ending over Chile with La Ligua marked, one sentence on what Caudal
// does, and the way in. Below, how to read the valley and what in this demo is measured.
import { dateLabel } from './data.js';

const INTRO_END = 6;
const LOAD_LIMIT_MS = 15000;
const ZOOM_MS = 950;
const VALLEY = { name: 'La Ligua', lat: -32.45, lon: -71.22 };
const OV = { lat: -36.5, lon: -71.2, ppr: 2600, w: 760, h: 2050 }; // img/chile.jpg: orthographic, centred on lat/lon

function pinPx({ lat, lon }) {
  const r = Math.PI / 180; const p0 = OV.lat * r; const dl = (lon - OV.lon) * r; const p = lat * r;
  const x = OV.ppr * Math.cos(p) * Math.sin(dl);
  const y = OV.ppr * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(dl));
  return [OV.w / 2 + x, OV.h / 2 - y];
}

function hero(months) {
  const [x, y] = pinPx(VALLEY);
  return `<section class="hero" data-hero>
  <div class="hero-stage">
    <canvas class="hero-canvas" aria-hidden="true"></canvas>
    <div class="ov hero-ov"><img src="img/chile.jpg" alt="Chile continental, mosaico Sentinel-2">
      <button type="button" class="pin" data-enter style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px"><i></i><span>${VALLEY.name}<em>${months} meses medidos</em></span></button></div>
    <span class="lbl" data-label="sat"><i></i><b>SENTINEL-2</b><em>786 km · 7,5 km/s</em></span>
  </div>
  <div class="hero-veil"></div>
  <div class="hero-copy" hidden>
    <p class="hero-kicker">Fiscalización de aguas · valle de La Ligua</p>
    <h1>Verde mientras no llueve.</h1>
    <p class="hero-lead">Caudal recorre ${months} meses de imágenes satelitales y lluvia medida. Mueve el tiempo y mira qué predios siguen verdes cuando el secano se apaga. Al final queda la ruta del inspector.</p>
    <div class="hero-cta"><a class="btn btn-primary" href="#valle">Recorrer el valle en el tiempo →</a><a class="btn btn-ghost" href="#ruta">Ir a la ruta</a></div>
  </div>
  <button type="button" class="hero-skip">Saltar intro</button>
  <button type="button" class="hero-replay" hidden aria-label="Ver la intro de nuevo">↺</button>
</section>`;
}

function body(data) {
  const sc = data.scenes;
  return `<section class="lsec"><div class="lwrap">
    <ol class="lsteps">
      <li><b>1</b><span><strong>Mueve el tiempo</strong>La línea de abajo trae la lluvia de cada mes y las ventanas secas medidas.</span></li>
      <li><b>2</b><span><strong>Mira quién sigue verde</strong>En ventana seca, un predio verde y húmedo sobre el secano es riego probable.</span></li>
      <li><b>3</b><span><strong>Sal a terreno</strong>Al cerrar la temporada aparece el ranking por bandas y, con él, la ruta de inspección.</span></li></ol>
    <details class="more"><summary>Qué es medido y qué es de ejemplo</summary><div class="table-wrap"><table><thead><tr><th>Dato</th><th>Origen</th><th>Estado</th></tr></thead><tbody>
      <tr><td>NDVI y NDMI por predio</td><td>Sentinel-2 L2A, ${sc.length} escenas mensuales (${dateLabel(sc[0].date)} a ${dateLabel(sc[sc.length - 1].date)})</td><td><span class="tag tag-real">medido</span></td></tr>
      <tr><td>Lluvia, ET0 y ventanas secas</td><td>Open-Meteo, archivo diario; ventanas de ${data.params.dry_days} días o más sin lluvia</td><td><span class="tag tag-real">medido</span></td></tr>
      <tr><td>Consumo en m³</td><td>FAO-56 simplificado con Kc desde NDVI, en rango</td><td><span class="tag tag-real">calculado</span></td></tr>
      <tr><td>Polígonos de predios</td><td>Trazados sobre campos visibles en la imagen</td><td><span class="tag">ejemplo</span></td></tr>
      <tr><td>Derechos de agua</td><td>Registro DGA, cruce pendiente</td><td><span class="tag">ilustrativo</span></td></tr></tbody></table></div></details>
    <p class="note">Caudal prioriza, no acusa: entrega bandas y rangos para ordenar visitas. Imágenes: Copernicus Sentinel-2 (ESA), servidas por Element84 Earth Search. Clima: Open-Meteo. Intro: mosaico Sentinel-2 sin nubes de EOX.</p>
  </div></section>`;
}

export function landing(app, data) {
  app.innerHTML = `<div class="landing">${hero(data.scenes.length)}${body(data)}</div>`;
  const $ = (q) => app.querySelector(q);
  const heroEl = $('[data-hero]'); const copy = $('.hero-copy'); const skip = $('.hero-skip'); const replay = $('.hero-replay');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers = []; let scene = null; let settled = false;
  const reveal = () => { copy.hidden = false; skip.hidden = true; replay.hidden = !scene; heroEl.classList.add('is-done'); };
  const play = () => {
    timers.forEach(clearTimeout); timers.length = 0;
    copy.hidden = true; skip.hidden = false; replay.hidden = true; heroEl.classList.remove('is-done');
    scene.play(); timers.push(setTimeout(reveal, INTRO_END * 1000));
  };
  const finish = () => { settled = true; timers.forEach(clearTimeout); scene?.still(INTRO_END); reveal(); };
  const noScene = (why, err) => { console.error('Caudal: la intro 3D no cargó,', why, err || ''); heroEl.classList.add('no-3d'); reveal(); };
  timers.push(setTimeout(() => { if (!settled) { settled = true; noScene('tardó demasiado'); } }, LOAD_LIMIT_MS));
  import('./intro/engine.js')
    .then(({ createScene }) => { scene = createScene(heroEl, 'doc'); return scene.ready; })
    .then(() => {
      if (settled) return;
      settled = true; timers.forEach(clearTimeout); timers.length = 0;
      if (reduced) finish(); else play();
    })
    .catch((err) => { if (!settled) { settled = true; scene = null; noScene('error al cargar', err); } });
  const enter = () => {
    const pin = $('.pin i').getBoundingClientRect(); const box = heroEl.getBoundingClientRect();
    heroEl.style.setProperty('--zx', `${pin.left + pin.width / 2 - box.left}px`); heroEl.style.setProperty('--zy', `${pin.top + pin.height / 2 - box.top}px`);
    heroEl.classList.add('is-zooming');
    timers.push(setTimeout(() => { location.hash = 'valle'; }, reduced ? 0 : ZOOM_MS));
  };
  const onClick = (e) => {
    if (e.target.closest('[data-enter]')) enter();
    else if (e.target.closest('.hero-skip')) finish();
    else if (e.target.closest('.hero-replay') && scene) play();
  };
  app.addEventListener('click', onClick);
  return () => { timers.forEach(clearTimeout); app.removeEventListener('click', onClick); };
}
