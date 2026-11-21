// One parcel's measured greenness over the 34 months against the dry reference, on the same time
// axis as the timeline. The cursor is the timeline's; dragging on the chart moves it too.
import { dateLabel, fmt } from './data.js';

const W = 600; const H = 232; const PAD = { l: 36, r: 8, t: 10, b: 26 };
const Y = { min: 0, max: 0.9 };

export function chartHtml(model, track) {
  const span = model.t1 - model.t0;
  const x = (t) => PAD.l + ((t - model.t0) / span) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - Y.min) / (Y.max - Y.min)) * (H - PAD.t - PAD.b);
  const path = (vals) => vals.reduce((d, v, i) => (v == null ? d : `${d}${i > 0 && vals[i - 1] != null ? 'L' : 'M'}${x(model.scenes[i].t).toFixed(1)},${y(v).toFixed(1)}`), '');
  const dry = model.windows.map((w) => { const x0 = x(Math.max(w.t0, model.t0)); return `<rect class="ch-dry" x="${x0.toFixed(1)}" y="${PAD.t}" width="${Math.max(0.8, x(Math.min(w.t1, model.t1)) - x0).toFixed(1)}" height="${H - PAD.t - PAD.b}"/>`; }).join('');
  const grid = [0.2, 0.4, 0.6, 0.8].map((v) => `<line class="ch-grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="ch-tick" x="${PAD.l - 6}" y="${(y(v) + 5).toFixed(1)}" text-anchor="end">${fmt(v, 1)}</text>`).join('');
  const years = model.months.filter((m, i) => i === 0 || m.month.endsWith('-01')).map((m) => `<text class="ch-tick" x="${x(m.t0).toFixed(1)}" y="${H - 7}">${m.month.slice(0, 4)}</text>`).join('');
  const dots = model.scenes.filter((s) => track.reads[s.i].ndvi != null).map((s) => {
    const r = track.reads[s.i];
    return `<circle class="${r.hit ? 'ch-hit' : 'ch-dot'}" cx="${x(s.t).toFixed(1)}" cy="${y(r.ndvi).toFixed(1)}" r="${r.hit ? 4.6 : 2.6}"><title>${dateLabel(s.date)}: NDVI ${fmt(r.ndvi, 2)}${r.hit ? ', riego probable en ventana seca' : ''}</title></circle>`;
  }).join('');
  return `<svg class="chart" data-chart viewBox="0 0 ${W} ${H}" role="img" aria-label="Verdor mensual de ${track.p.name} frente al secano de referencia, con las ventanas secas">
    ${dry}${grid}
    <path class="ch-ref" d="${path(model.ref.map((r) => r.ndvi))}"/><path class="ch-line" d="${path(track.reads.map((r) => r.ndvi))}"/>${dots}${years}
    <line class="ch-cursor" data-chart-cursor x1="0" x2="0" y1="${PAD.t - 4}" y2="${H - PAD.b + 4}"/></svg>`;
}

export function createChart(root, model, clock) {
  const svg = root.querySelector('[data-chart]'); const cursor = svg.querySelector('[data-chart-cursor]');
  const span = model.t1 - model.t0; const plotW = W - PAD.l - PAD.r;
  let dragging = false;
  const seekTo = (e) => {
    const r = svg.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    clock.seek(model.t0 + Math.max(0, Math.min(1, (vx - PAD.l) / plotW)) * span);
  };
  const onDown = (e) => { if (e.button > 0) return; dragging = true; svg.setPointerCapture?.(e.pointerId); seekTo(e); };
  const onMove = (e) => { if (dragging) seekTo(e); };
  const onUp = () => { dragging = false; };
  svg.addEventListener('pointerdown', onDown); svg.addEventListener('pointermove', onMove); svg.addEventListener('pointerup', onUp); svg.addEventListener('pointercancel', onUp);
  return {
    update(frame) { cursor.setAttribute('transform', `translate(${(PAD.l + ((frame.t - model.t0) / span) * plotW).toFixed(2)} 0)`); },
    destroy() { svg.removeEventListener('pointerdown', onDown); svg.removeEventListener('pointermove', onMove); svg.removeEventListener('pointerup', onUp); svg.removeEventListener('pointercancel', onUp); },
  };
}
