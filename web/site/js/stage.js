// The valley in time: the map, one panel and the timeline, mounted once and kept while the route moves
// between #valle and #predio-pXX, so the clock never restarts. Every frame goes clock → snapshot → views.
import { buildModel, snapshot, cellAt } from './model.js';
import { createClock } from './clock.js';
import { mapHtml, createMapView } from './mapview.js';
import { timelineHtml, createTimeline } from './timeline.js';
import { mountValle } from './panel-valle.js';
import { mountPredio } from './panel-predio.js';
import { getState, setState } from './state.js';
import { href } from './data.js';

let savedT = null; // where the cursor was when the stage was last left

export function createStage(app, data) {
  const model = buildModel(data);
  app.innerHTML = `<div class="stage"><div class="stage-map">${mapHtml(model, data)}</div><aside class="stage-panel" data-panel aria-label="Detalle"></aside>${timelineHtml(model)}</div>`;
  const clock = createClock({ t0: model.t0, t1: model.t1, stops: model.stops, steps: model.scenes.map((s) => s.t), start: savedT });
  const map = createMapView(app, model);
  const timeline = createTimeline(app, model, clock);
  const panelEl = app.querySelector('[data-panel]');
  const ctx = { data, model, clock };
  let panel = null; let frame = null; let closedKey = null;

  const frameOf = (c) => { const snap = snapshot(model, c.t); return { ...snap, playing: c.playing, speed: c.speed, event: c.event, cells: model.tracks.map((tr) => cellAt(tr, snap)) }; };
  const unsubscribe = clock.subscribe((c) => {
    frame = frameOf(c);
    map.update(frame); timeline.update(frame); panel?.update(frame);
    const key = frame.closed?.key || null;
    if (key !== closedKey) { closedKey = key; if (key && key !== getState().season) setState({ season: key }); }
  });

  const open = (e) => {
    const hit = e.target.closest('[data-open]');
    if (!hit || (e.type === 'keydown' && e.key !== 'Enter')) return;
    location.hash = href('predio', hit.dataset.open).slice(1);
  };
  const mapEl = app.querySelector('[data-map]');
  mapEl.addEventListener('click', open); mapEl.addEventListener('keydown', open);

  return {
    show(kind, id) {
      panel?.destroy();
      panel = kind === 'predio' ? mountPredio(panelEl, ctx, id) : mountValle(panelEl, ctx);
      map.select(kind === 'predio' ? id : null);
      panelEl.scrollTop = 0;
      if (frame) panel.update({ ...frame, event: null });
      if (kind === 'predio' && matchMedia('(max-width: 899px)').matches) panelEl.scrollIntoView({ block: 'start' });
    },
    destroy() {
      savedT = clock.t;
      unsubscribe(); panel?.destroy(); timeline.destroy(); clock.destroy();
      mapEl.removeEventListener('click', open); mapEl.removeEventListener('keydown', open);
    },
  };
}
