// The system's main output: the order in which an inspector visits the chosen parcels.
// Solved exactly in the browser (every order is tried, up to 8 stops); the product uses OR-Tools.
import { IMAGES, ranking, parcelById, bandPill, esc, fmt, fmtCoord, monthLabel, href } from './data.js';
import { getState, setState, toggleStop } from './state.js';
import { pixelOf } from './crop.js';

const PLAZA = { name: 'Plaza de La Ligua', px: [252, 282] };
const MAX_STOPS = 8;
const ROAD_FACTOR = 1.3;  // straight line to road distance, a rule of thumb until real roads are routed
const SPEED_KMH = 35;
const VISIT_MIN = 25;

const centerPx = (p) => [(p.px[0] + p.px[2]) / 2, (p.px[1] + p.px[3]) / 2];
const distKm = (a, b, pxM) => Math.hypot(a[0] - b[0], a[1] - b[1]) * pxM / 1000;

function permutations(xs) {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
}

function solve(start, stops, pxM) {
  let best = null;
  for (const order of permutations(stops)) {
    let d = 0; let at = start;
    for (const s of order) { d += distKm(at, s.at, pxM); at = s.at; }
    d += distKm(at, start, pxM);
    if (!best || d < best.km) best = { order, km: d };
  }
  return best;
}

function lonlatOf(data, [x, y]) {
  const [w, h] = data.area.grid; const [lo0, la0, lo1, la1] = data.area.bbox;
  return [lo0 + x / w * (lo1 - lo0), la1 - y / h * (la1 - la0)];
}
const clock = (start, minutes) => {
  const [h, m] = start.split(':').map(Number); const t = h * 60 + m + Math.round(minutes);
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

function gpx(data, startLL, legs) {
  const pt = ([lo, la], name) => `  <rtept lat="${la.toFixed(5)}" lon="${lo.toFixed(5)}"><name>${esc(name)}</name></rtept>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Caudal" xmlns="http://www.topografix.com/GPX/1/1">\n <rte><name>Ruta de inspección ${esc(data.area.name)}</name>\n${[pt(startLL, 'Partida'), ...legs.map((l, i) => pt(l.ll, `${i + 1}. ${l.p.name}`)), pt(startLL, 'Regreso')].join('\n')}\n </rte>\n</gpx>`;
}

export function ruta(app, data) {
  const pxM = data.area.px_m;
  const [gw, gh] = data.area.grid;
  const backdrop = IMAGES[IMAGES.length - 1];
  const at = ([x, y]) => `left:${(x / gw * 100).toFixed(2)}%;top:${(y / gh * 100).toFixed(2)}%`;
  let lastGpx = '';
  const draw = () => {
    const st = getState();
    const season = st.season;
    const rows = ranking(data, season);
    const chosen = (st.route || []).map((id) => parcelById(data, id)).filter(Boolean).slice(0, MAX_STOPS);
    const start = st.start || PLAZA.px;
    const startName = st.start ? 'Punto elegido en el mapa' : PLAZA.name;
    const best = chosen.length ? solve(start, chosen.map((p) => ({ p, at: centerPx(p) })), pxM) : null;
    const legs = best ? best.order.reduce((acc, s) => {
      const prev = acc[acc.length - 1];
      const km = distKm(prev ? prev.at : start, s.at, pxM) * ROAD_FACTOR;
      const arrive = (prev ? prev.arrive + VISIT_MIN : 0) + km / SPEED_KMH * 60;
      return [...acc, { ...s, km, arrive, ll: lonlatOf(data, s.at) }];
    }, []) : [];
    const lastLeg = legs[legs.length - 1];
    const backKm = best ? distKm(lastLeg.at, start, pxM) * ROAD_FACTOR : 0;
    const end = best ? lastLeg.arrive + VISIT_MIN + backKm / SPEED_KMH * 60 : 0;
    const d = best ? [start, ...legs.map((l) => l.at), start].map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('') : '';
    const startLL = lonlatOf(data, start);
    lastGpx = best ? gpx(data, startLL, legs) : '';
    const nav = best ? `https://www.google.com/maps/dir/${[startLL, ...legs.map((l) => l.ll), startLL].map(([lo, la]) => `${la.toFixed(5)},${lo.toFixed(5)}`).join('/')}` : '';
    const topBand = rows[0].s.band;
    const suggested = topBand === 'sin' ? [] : rows.filter((r) => r.s.band === topBand).map((r) => r.p.id);
    app.innerHTML = `<section class="page">
      <div class="page-head"><div><p class="eyebrow">Ruta de inspección · temporada ${season}</p>
        <h1>${best ? `${legs.length} ${legs.length === 1 ? 'predio' : 'predios'}, ${fmt(best.km * ROAD_FACTOR, 1)} km, de vuelta a las ${clock(st.startTime, end)}.` : 'Todavía no hay paradas.'}</h1>
        <p>Qué predios visitar y en qué orden, para recorrer lo menos posible. Es la salida principal de Caudal: una decisión que hoy se toma a ojo.</p></div>
        <div class="controls"><label class="inline" for="f-start">Hora de inicio<input id="f-start" type="time" value="${esc(st.startTime)}"></label></div></div>
      <div class="split">
        <div><div class="map map-route" data-map><img class="map-img is-on" src="${backdrop.file}" alt="Valle de La Ligua en color natural, ${monthLabel(backdrop.key)}" width="${gw}" height="${gh}">
            <svg viewBox="0 0 ${gw} ${gh}" preserveAspectRatio="none" aria-hidden="true">${best ? `<path class="route" d="${d}"/>` : ''}${chosen.map((p) => `<rect class="route-box" x="${p.px[0]}" y="${p.px[1]}" width="${p.px[2] - p.px[0]}" height="${p.px[3] - p.px[1]}"/>`).join('')}</svg>
            <div class="map-lbls" aria-hidden="true">${legs.map((l, i) => `<span class="map-stop" style="${at(l.at)}">${i + 1}</span>`).join('')}<span class="map-stop is-start" style="${at(start)}">P</span></div></div>
          <p class="note map-foot">Toca el mapa para mover la partida. ${st.start ? '<button type="button" class="link" data-plaza>Volver a la plaza</button>' : `Partida: ${PLAZA.name}.`}</p></div>
        <div class="stack">
          ${best ? `<ol class="stops"><li><span class="stop-n is-start">P</span><span>${esc(startName)}<br><span class="note num">${fmtCoord(startLL)}</span></span><span class="num">${esc(st.startTime)}</span></li>
              ${legs.map((l, i) => `<li><span class="stop-n">${i + 1}</span><span><a href="${href('predio', l.p.id)}">${esc(l.p.name)}</a> ${bandPill(l.p.seasons[season].band)}<br><span class="note">${fmt(l.km, 1)} km · visita de ${VISIT_MIN} min</span></span><span class="num">${clock(st.startTime, l.arrive)}</span></li>`).join('')}
              <li><span class="stop-n is-start">P</span><span>Regreso<br><span class="note">${fmt(backKm, 1)} km · jornada de ${fmt(end / 60, 1)} h</span></span><span class="num">${clock(st.startTime, end)}</span></li></ol>
              <div class="controls"><a class="btn btn-primary" href="${nav}" target="_blank" rel="noopener">Abrir en Google Maps ↗</a><button type="button" class="btn" data-copy-gpx>Copiar GPX</button></div>`
            : `<div class="empty"><b>Elige al menos un predio.</b><p>Recorre el valle en el tiempo hasta el cierre de una temporada, o parte por los primeros del ranking.</p>
                <div class="controls">${suggested.length ? `<button type="button" class="btn btn-primary" data-fill="${suggested.join(',')}">Usar prioridad ${esc(topBand)} (${suggested.length})</button>` : ''}<a class="btn" href="#valle">Ir al valle</a></div></div>`}
          <details class="more"><summary>Editar paradas (${chosen.length})</summary><div><div class="pick">${rows.map(({ p, s }) => `<label><input type="checkbox" data-pick="${p.id}" ${chosen.some((c) => c.id === p.id) ? 'checked' : ''} ${s.band === 'sin' ? 'disabled' : ''}> ${esc(p.name)} ${bandPill(s.band)}</label>`).join('')}</div>
            <p class="note">Hasta ${MAX_STOPS} paradas. Los predios sin alerta no entran a la ruta.</p></div></details>
          <p class="note">Distancias en línea recta × ${String(ROAD_FACTOR).replace('.', ',')} a ${SPEED_KMH} km/h. El orden se resuelve probando todas las secuencias; con caminos reales, el producto usa OR-Tools.</p>
        </div></div>
    </section>`;
  };
  draw();
  const onClick = async (e) => {
    if (e.target.closest('[data-pick]')) return; // handled on change
    const fill = e.target.closest('[data-fill]');
    if (fill) { setState({ route: fill.dataset.fill.split(',') }); draw(); return; }
    if (e.target.closest('[data-plaza]')) { setState({ start: null }); draw(); return; }
    const copy = e.target.closest('[data-copy-gpx]');
    if (copy) {
      try { await navigator.clipboard.writeText(lastGpx); copy.textContent = 'GPX copiado'; } catch { copy.textContent = 'No se pudo copiar'; }
      setTimeout(() => { copy.textContent = 'Copiar GPX'; }, 2000);
      return;
    }
    const map = e.target.closest('[data-map]');
    if (map) { setState({ start: pixelOf(map, e, data) }); draw(); }
  };
  const onChange = (e) => {
    if (e.target.dataset.pick) { toggleStop(e.target.dataset.pick); draw(); return; }
    if (e.target.id === 'f-start' && e.target.value) { setState({ startTime: e.target.value }); draw(); }
  };
  app.addEventListener('click', onClick); app.addEventListener('change', onChange);
  return () => { app.removeEventListener('click', onClick); app.removeEventListener('change', onChange); };
}
