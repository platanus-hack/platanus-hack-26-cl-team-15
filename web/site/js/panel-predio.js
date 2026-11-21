// One parcel's file, in the panel beside the map. Its headline is the detector's reading of the scene
// under the cursor; the chart shares the timeline's cursor. The season's band, m³ range and confidence
// sit one click away, then the evidence file and the route.
import { parcelById, bandPill, range, m3, esc, fmt, signed, fmtCoord, dateLabel, href } from './data.js';
import { getState, setState, toggleStop } from './state.js';
import { chartHtml, createChart } from './chart.js';

const METERS = [
  { key: 'ndvi', d: 'dndvi', gap: 'ndvi_gap', label: 'Verdor (NDVI)', min: 0, max: 0.9 },
  { key: 'ndmi', d: 'dndmi', gap: 'ndmi_gap', label: 'Humedad (NDMI)', min: -0.3, max: 0.5 },
];

function verdict(frame, cell) {
  if (cell.read.ndvi == null) return 'Sin escena válida este mes.';
  if (!frame.win) return 'Fuera de ventana seca: no se evalúa riego.';
  if (!frame.scene.dry) return 'La escena más cercana no cae en ventana seca.';
  return cell.hit ? 'Riego probable: verde y húmedo sin lluvia.' : 'En ventana seca, bajo el umbral.';
}

const meterHtml = (m) => `<div class="meter" data-meter="${m.key}"><p><span>${m.label}</span><b class="num" data-val></b></p>
  <div class="meter-track"><i class="m-thr" data-thr></i><i class="m-ref" data-ref></i><i class="m-dot" data-dot></i></div><p class="note" data-txt></p></div>`;

function seasonHtml(p, key) {
  const s = p.seasons[key];
  const top = Math.max(s.m3_high, s.right_m3) * 1.1;
  const pc = (v) => `${((v / top) * 100).toFixed(1)}%`;
  return `<p class="rs-band">${bandPill(s.band)}<span>${s.positives} de ${s.dry_scenes.length} escenas secas con riego probable</span></p>
    <div class="rs-bar" role="img" aria-label="Consumo estimado de ${range(s)} frente a un derecho de ${m3(s.right_m3)}"><i class="rs-range" style="left:${pc(s.m3_low)};width:${pc(s.m3_high - s.m3_low)}"></i><i class="rs-right" style="left:${pc(s.right_m3)}"></i></div>
    <dl class="kv"><dt>Consumo estimado</dt><dd class="num">${range(s)}</dd><dt>Derecho</dt><dd class="num">${m3(s.right_m3)} <span class="tag">ilustrativo</span></dd><dt>Confianza</dt><dd>${esc(s.confidence_label)}${s.confidence_reasons.length ? ` · ${s.confidence_reasons.map(esc).join('; ')}` : ''}</dd></dl>`;
}

export function mountPredio(el, { data, model, clock }, id) {
  const p = parcelById(data, id);
  if (!p) { el.innerHTML = `<div class="pv"><div class="empty"><b>No encontramos ese predio.</b><a class="btn" href="#valle">Volver al valle</a></div></div>`; return { update() {}, destroy() {} }; }
  setState({ current: p.id });
  const track = model.tracks.find((t) => t.id === p.id);
  const seasonKeys = model.seasons.map((s) => s.key);
  const closedNow = [...model.seasons].reverse().find((s) => clock.t >= s.t1);
  let season = seasonKeys.includes(getState().season) ? getState().season : seasonKeys[seasonKeys.length - 1];
  const inRoute = () => (getState().route || []).includes(p.id);
  el.innerHTML = `<div class="pv">
    <a class="back" href="#valle">← Valle</a>
    <p class="eyebrow">${esc(p.name)} · ${fmt(p.seasons[season].area_ha, 1)} ha · <span data-scene></span></p>
    <h1 class="headline" data-headline></h1>
    <div class="meters">${METERS.map(meterHtml).join('')}</div>
    <figure class="fig">${chartHtml(model, track)}
      <figcaption class="note"><span><i class="k k-line"></i>Predio</span><span><i class="k k-ref"></i>Secano</span><span><i class="k k-hit"></i>Riego probable</span><span><i class="k k-dry"></i>Ventana seca</span></figcaption></figure>
    <details class="more" data-result ${closedNow ? 'open' : ''}><summary>Resultado de la temporada</summary>
      <div><div class="seg" role="group" aria-label="Temporada">${seasonKeys.map((k) => `<button type="button" data-season-pick="${k}" aria-pressed="${k === season}">${k}</button>`).join('')}</div>
        <div data-season-body>${seasonHtml(p, season)}</div></div></details>
    <div class="actions"><button type="button" class="btn" data-stop></button><a class="btn" href="${href('expediente', p.id)}">Expediente →</a><a class="btn btn-primary" href="#ruta">Ruta →</a></div>
    <p class="note">Polígono de ejemplo, trazado sobre un campo visible. Centro: <span class="num">${fmtCoord(p.center)}</span>.</p>
  </div>`;
  const $ = (q) => el.querySelector(q);
  const chart = createChart(el, model, clock);
  const stopBtn = $('[data-stop]');
  const paintStop = () => { stopBtn.textContent = inRoute() ? '✓ En la ruta' : '+ Agregar a la ruta'; stopBtn.setAttribute('aria-pressed', String(inRoute())); };
  paintStop();
  const showSeason = (key) => {
    season = key;
    el.querySelectorAll('[data-season-pick]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.seasonPick === season)));
    $('[data-season-body]').innerHTML = seasonHtml(p, season);
  };
  const onClick = (e) => {
    if (e.target.closest('[data-stop]')) { toggleStop(p.id); paintStop(); return; }
    const pick = e.target.closest('[data-season-pick]');
    if (!pick) return;
    setState({ season: pick.dataset.seasonPick }); showSeason(pick.dataset.seasonPick);
  };
  el.addEventListener('click', onClick);
  const place = (node, v, m) => { node.hidden = v == null; if (v != null) node.style.left = `${(Math.max(0, Math.min(1, (v - m.min) / (m.max - m.min))) * 100).toFixed(1)}%`; };
  let seenKey = ''; let seenClosed = closedNow?.key || null;

  return {
    update(frame) {
      chart.update(frame);
      const closed = frame.closed?.key || null;
      if (closed !== seenClosed) { seenClosed = closed; if (closed) { showSeason(closed); $('[data-result]').open = true; } }
      const key = `${frame.scene.i}|${Boolean(frame.win)}`;
      if (key === seenKey) return;
      seenKey = key;
      const cell = frame.cells.find((c) => c.id === p.id);
      const ref = model.ref[frame.scene.i];
      $('[data-scene]').textContent = `escena del ${dateLabel(frame.scene.date)}`;
      const h = $('[data-headline]'); h.textContent = verdict(frame, cell); h.classList.toggle('is-hit', cell.hit);
      METERS.forEach((m) => {
        const box = $(`[data-meter="${m.key}"]`); const v = cell.read[m.key]; const r = ref[m.key]; const gap = model.params[m.gap];
        box.querySelector('[data-val]').textContent = v == null ? 'sin escena válida' : fmt(v, 2);
        place(box.querySelector('[data-dot]'), v, m); place(box.querySelector('[data-ref]'), r, m); place(box.querySelector('[data-thr]'), r == null ? null : r + gap, m);
        box.querySelector('[data-txt]').textContent = v == null || r == null ? 'Sin dato en esta escena.' : `${signed(cell.read[m.d], 2)} sobre el secano (${fmt(r, 2)}). Umbral: ${signed(gap, 2)}.`;
        box.classList.toggle('is-over', v != null && r != null && cell.read[m.d] >= gap);
      });
    },
    destroy() { chart.destroy(); el.removeEventListener('click', onClick); },
  };
}
