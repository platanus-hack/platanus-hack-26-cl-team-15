// The valley panel. While time moves it is the detector, live: each parcel's measured greenness, how far
// it sits above the dry reference, and a running count of dry scenes with probable irrigation.
// The ranking by bands is not here to begin with: it appears when a season closes on the timeline.
import { BANDS, ranking, bandPill, range, esc, fmt, signed, dateLabel, href } from './data.js';
import { setState } from './state.js';
import { colorOf } from './ramp.js';

const MOBILE = '(max-width: 899px)';
let lastTab = 'live'; // kept while the stage is left for a parcel and back

function headline(frame) {
  const preds = frame.cells.filter((c) => !c.isRef);
  if (preds.every((c) => c.read.ndvi == null)) return 'Sin escena válida este mes: no se concluye nada.';
  if (!frame.win) return 'Llovió hace poco: el verdor no distingue riego.';
  if (!frame.scene.dry) return 'Ventana seca, pero la escena más cercana no cae en ella.';
  const hits = preds.filter((c) => c.hit).length;
  if (hits === 0) return 'No llueve y ningún predio supera al secano.';
  return hits === 1 ? 'No llueve y 1 predio sigue verde.' : `No llueve y ${hits} de ${preds.length} predios siguen verdes.`;
}

const row = (tr) => `<li><a class="lv" href="${href('predio', tr.id)}" data-row="${tr.id}" aria-label="${esc(tr.p.name)}">
  <i class="sw" data-sw></i><b>${tr.id}</b><span class="num" data-v></span><span class="num lv-d" data-d></span>
  <span class="lv-n"><i class="lv-bar"><i data-bar></i></i><span class="num" data-n></span></span></a></li>`;

function resultHtml(data, key) {
  const rows = ranking(data, key);
  const groups = Object.keys(BANDS).map((band) => ({ band, rows: rows.filter((r) => r.s.band === band) })).filter((g) => g.rows.length);
  const first = groups[0];
  return `<p class="note">Temporada ${key} cerrada. Este es el orden para fiscalizar: prioriza, no acusa.</p>
    ${groups.map((g) => `<section class="rk"><h2>${bandPill(g.band)}<small>${BANDS[g.band].why}</small></h2>
      <ul>${g.rows.map(({ p, s }) => `<li><a href="${href('predio', p.id)}"><b>${p.id}</b><span>${s.positives} de ${s.dry_scenes.length} escenas secas con riego probable<em class="num">${range(s)}</em></span><i aria-hidden="true">›</i></a></li>`).join('')}</ul></section>`).join('')}
    ${first.band === 'sin' ? '' : `<button type="button" class="btn btn-primary" data-route="${first.rows.map((r) => r.p.id).join(',')}">Armar la ruta con prioridad ${BANDS[first.band].short.toLowerCase()} →</button>`}
    <p class="note">Los m³ son un rango estimado (FAO-56) para ordenar visitas, no una prueba. El derecho de cada predio es ilustrativo.</p>`;
}

export function mountValle(el, { data, model }) {
  const preds = model.tracks.filter((t) => !t.isRef);
  el.innerHTML = `<div class="pv">
    <p class="eyebrow">${esc(data.area.name)} · <span data-scene></span></p>
    <h1 class="headline" data-headline></h1>
    <div class="seg" role="group" aria-label="Qué muestra el panel"><button type="button" data-tab="live" aria-pressed="true">En vivo</button><button type="button" data-tab="result" aria-pressed="false" disabled>Resultado</button></div>
    <div data-pane="live">
      <div class="lv lv-head" aria-hidden="true"><i></i><b>Predio</b><span>NDVI</span><span>Δ secano</span><span class="lv-n">Riego prob.</span></div>
      <ol class="live">${preds.map(row).join('')}
        <li><div class="lv lv-ref"><i class="sw" data-ref-sw></i><b>Secano</b><span class="num" data-ref-v></span><span></span><span class="lv-n note">referencia</span></div></li></ol>
      <p class="note" data-stretch></p>
      <p class="note" data-wait></p>
    </div>
    <div data-pane="result" hidden></div>
  </div>`;
  const $ = (q) => el.querySelector(q);
  const rows = new Map(preds.map((tr) => { const a = el.querySelector(`[data-row="${tr.id}"]`); return [tr.id, { a, sw: a.querySelector('[data-sw]'), v: a.querySelector('[data-v]'), d: a.querySelector('[data-d]'), bar: a.querySelector('[data-bar]'), n: a.querySelector('[data-n]') }]; }));
  const maxSeen = Math.max(...preds.flatMap((tr) => tr.tally.map((c) => c.seen)), 1);
  const seen = { key: '', closed: undefined, playing: false };
  let tab = lastTab;

  const showTab = (next) => {
    tab = next; lastTab = next;
    el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    el.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== tab; });
  };
  const onClick = (e) => {
    const t = e.target.closest('[data-tab]');
    if (t && !t.disabled) { showTab(t.dataset.tab); return; }
    const r = e.target.closest('[data-route]');
    if (r) { setState({ route: r.dataset.route.split(',') }); location.hash = 'ruta'; }
  };
  el.addEventListener('click', onClick);

  return {
    update(frame) {
      const closed = frame.closed?.key || null;
      if (closed !== seen.closed) {
        seen.closed = closed;
        const btn = $('[data-tab="result"]');
        btn.disabled = !closed; btn.textContent = closed ? `Resultado ${closed}` : 'Resultado';
        $('[data-pane="result"]').innerHTML = closed ? resultHtml(data, closed) : '';
        showTab(closed ? tab : 'live');
      }
      if (frame.event && closed) { showTab('result'); if (matchMedia(MOBILE).matches) el.scrollIntoView({ block: 'start' }); }
      else if (frame.playing && !seen.playing && tab === 'result') showTab('live');
      seen.playing = frame.playing;

      frame.cells.forEach((c) => { if (!c.isRef) rows.get(c.id).sw.style.background = colorOf(c.green); });
      const refGreen = frame.cells.filter((c) => c.isRef && c.green != null);
      $('[data-ref-sw]').style.background = colorOf(refGreen.length ? refGreen.reduce((a, c) => a + c.green, 0) / refGreen.length : null);

      const key = `${frame.scene.i}|${frame.stretch.key}|${Boolean(frame.win)}`;
      if (key === seen.key) return;
      seen.key = key;
      $('[data-scene]').textContent = `escena del ${dateLabel(frame.scene.date)}`;
      $('[data-headline]').textContent = headline(frame);
      const ref = model.ref[frame.scene.i];
      $('[data-ref-v]').textContent = ref.ndvi == null ? 'sin escena' : fmt(ref.ndvi, 2);
      frame.cells.forEach((c) => {
        if (c.isRef) return;
        const r = rows.get(c.id);
        r.v.textContent = c.read.ndvi == null ? 'sin escena válida' : fmt(c.read.ndvi, 2);
        r.d.textContent = c.read.dndvi == null ? '' : signed(c.read.dndvi, 2);
        r.n.textContent = `${c.count.hits}`;
        r.bar.style.width = `${(c.count.hits / maxSeen) * 100}%`;
        r.a.classList.toggle('is-hit', c.hit); r.a.classList.toggle('is-void', c.read.ndvi == null);
      });
      $('[data-stretch]').textContent = `${frame.stretch.label}: escenas en ventana seca con riego probable, sumadas hasta este mes. Riego probable = NDVI ${signed(model.params.ndvi_gap, 2)} y NDMI ${signed(model.params.ndmi_gap, 2)} sobre el secano.`;
      const nextEnd = model.seasons.find((s) => s.t1 > frame.t);
      $('[data-wait]').textContent = nextEnd ? `El ranking de la temporada ${nextEnd.key} aparece cuando la línea de tiempo llega a su cierre.` : '';
    },
    destroy() { el.removeEventListener('click', onClick); },
  };
}
