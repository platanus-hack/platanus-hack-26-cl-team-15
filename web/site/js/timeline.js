// The app's main control: the 34 measured months as one draggable line. Monthly rain rises from the
// bottom, the measured dry windows run along the top, and each Sentinel-2 scene is a tick, so it is
// plain at a glance when it did not rain. Seasons sit under the line; a ranking appears when one closes.
import { DAY } from './model.js';
import { dateLabel, monthLabel, monthLong, fmt } from './data.js';

const VB = { w: 1000, h: 100 };
const DRY_H = 12; const RAIN_MAX_H = 62; const TICK_Y = 18; const TICK_H = 9;
const ICON = {
  play: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 3l10 6-10 6z" fill="currentColor"/></svg>',
  pause: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 3h3.5v12H4zM10.5 3H14v12h-3.5z" fill="currentColor"/></svg>',
};
const speedLabel = (s) => (s === 0.5 ? '½×' : `${s}×`);

export function timelineHtml(model) {
  const span = model.t1 - model.t0;
  const x = (t) => ((t - model.t0) / span) * VB.w;
  const pct = (t) => `${(((t - model.t0) / span) * 100).toFixed(3)}%`;
  const rainMax = Math.max(...model.months.map((m) => m.rain), 1);
  const dry = model.windows.map((w) => {
    const x0 = x(Math.max(w.t0, model.t0)); const wd = Math.max(0.6, x(Math.min(w.t1, model.t1)) - x0);
    return `<rect class="tl-dry-tint" x="${x0.toFixed(2)}" y="0" width="${wd.toFixed(2)}" height="${VB.h}"/><rect class="tl-dry" x="${x0.toFixed(2)}" y="0" width="${wd.toFixed(2)}" height="${DRY_H}"><title>Ventana seca: ${dateLabel(w.start)} a ${dateLabel(w.end)}</title></rect>`;
  }).join('');
  const rain = model.months.map((m) => {
    const mw = x(m.t1) - x(m.t0); const hh = Math.max(m.rain > 0 ? 1.2 : 0, (m.rain / rainMax) * RAIN_MAX_H);
    return `<rect class="tl-rain-bar" x="${(x(m.t0) + mw * 0.16).toFixed(2)}" y="${(VB.h - hh).toFixed(2)}" width="${(mw * 0.68).toFixed(2)}" height="${hh.toFixed(2)}"><title>${monthLabel(m.month)}: ${fmt(m.rain, 1)} mm de lluvia</title></rect>`;
  }).join('');
  const ticks = model.scenes.map((s) => {
    const empty = model.tracks.every((tr) => tr.reads[s.i].ndvi == null);
    return `<rect class="tl-scene${empty ? ' is-void' : ''}" x="${(x(s.t) - 0.9).toFixed(2)}" y="${TICK_Y}" width="1.8" height="${TICK_H}"><title>Escena del ${dateLabel(s.date)}${empty ? ', sin dato válido' : ''}</title></rect>`;
  }).join('');
  const years = model.months.filter((m, i) => i === 0 || m.month.endsWith('-01')).map((m) => `<span class="tl-year" style="left:${pct(m.t0)}">${m.month.slice(0, 4)}</span>`).join('');
  const seasons = model.seasons.map((s) => `<span class="tl-season" data-season="${s.key}" style="left:${pct(s.t0)};width:${(((Math.min(s.t1, model.t1) - s.t0) / span) * 100).toFixed(3)}%"><b>Temporada ${s.key}</b></span>`).join('');
  return `<section class="tl" data-tl aria-label="Línea de tiempo de los ${model.months.length} meses medidos">
    <div class="tl-head">
      <button type="button" class="tl-play" data-play aria-label="Reproducir">${ICON.play}</button>
      <div class="tl-now"><b data-now></b><span class="chip" data-status></span></div>
      <span class="tl-rain" data-rain></span>
      <div class="tl-tools"><button type="button" class="tl-btn" data-speed aria-label="Velocidad de reproducción">1×</button>
        <button type="button" class="tl-btn" data-jump>Saltar al cierre de temporada</button></div>
    </div>
    <div class="tl-track" data-track role="slider" tabindex="0" aria-label="Fecha en la línea de tiempo" aria-valuemin="0" aria-valuemax="${model.scenes.length - 1}" aria-valuenow="0">
      <svg class="tl-plot" viewBox="0 0 ${VB.w} ${VB.h}" preserveAspectRatio="none" aria-hidden="true">${dry}${rain}${ticks}</svg>
      <div class="tl-cursor" data-cursor></div>
    </div>
    <div class="tl-axis" aria-hidden="true">${years}${seasons}</div>
    <p class="tl-legend"><span><i class="k k-dry"></i>Ventana seca: ${model.params.dry_days} días o más sin lluvia</span><span><i class="k k-rain"></i>Lluvia del mes (máx. ${fmt(rainMax, 0)} mm)</span><span><i class="k k-scene"></i>Escena Sentinel-2</span></p>
  </section>`;
}

export function createTimeline(root, model, clock) {
  const el = root.querySelector('[data-tl]');
  const $ = (q) => el.querySelector(q);
  const track = $('[data-track]'); const cursor = $('[data-cursor]'); const play = $('[data-play]'); const speedBtn = $('[data-speed]');
  const seasonEls = [...el.querySelectorAll('[data-season]')];
  const span = model.t1 - model.t0;
  const seen = { month: '', status: '', scene: -1, playing: null, speed: 0, closed: '' };
  let dragging = false; let now = model.t0;

  const seekTo = (e) => { const r = track.getBoundingClientRect(); clock.seek(model.t0 + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * span); };
  const onDown = (e) => { if (e.button > 0) return; dragging = true; track.setPointerCapture?.(e.pointerId); track.classList.add('is-drag'); seekTo(e); };
  const onMove = (e) => { if (dragging) seekTo(e); };
  const onUp = () => { dragging = false; track.classList.remove('is-drag'); };
  const stepScene = (dir) => {
    const i = model.scenes.reduce((best, s) => (Math.abs(s.t - now) < Math.abs(model.scenes[best].t - now) ? s.i : best), 0);
    const at = model.scenes[i].t;
    const target = dir > 0 && at > now ? i : dir < 0 && at < now ? i : Math.max(0, Math.min(model.scenes.length - 1, i + dir));
    clock.seek(model.scenes[target].t);
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') stepScene(1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') stepScene(-1);
    else if (e.key === 'Home') clock.seek(model.t0);
    else if (e.key === 'End') clock.seek(model.t1, 'end');
    else if (e.key === ' ' || e.key === 'Enter') clock.toggle();
    else return;
    e.preventDefault();
  };
  const onClick = (e) => {
    if (e.target.closest('[data-play]')) clock.toggle();
    else if (e.target.closest('[data-speed]')) clock.cycleSpeed();
    else if (e.target.closest('[data-jump]')) { const next = model.stops.find((s) => s > now); clock.seek(next ?? model.t1, next ? 'season-end' : 'end'); }
  };
  track.addEventListener('pointerdown', onDown); track.addEventListener('pointermove', onMove);
  track.addEventListener('pointerup', onUp); track.addEventListener('pointercancel', onUp);
  track.addEventListener('keydown', onKey); el.addEventListener('click', onClick);

  return {
    update(frame) {
      now = frame.t;
      cursor.style.left = `${(((frame.t - model.t0) / span) * 100).toFixed(3)}%`;
      if (frame.month.month !== seen.month) {
        seen.month = frame.month.month;
        $('[data-now]').textContent = monthLong(frame.month.month);
        $('[data-rain]').textContent = `Lluvia del mes: ${fmt(frame.month.rain, 1)} mm`;
      }
      const day = frame.win ? Math.floor((frame.t - frame.win.t0) / DAY) + 1 : 0;
      const status = frame.win ? `Ventana seca · día ${day} sin lluvia` : 'Fuera de ventana seca';
      if (status !== seen.status) { seen.status = status; const chip = $('[data-status]'); chip.textContent = status; chip.classList.toggle('is-dry', Boolean(frame.win)); }
      if (frame.scene.i !== seen.scene) {
        seen.scene = frame.scene.i;
        track.setAttribute('aria-valuenow', frame.scene.i);
        track.setAttribute('aria-valuetext', `${monthLong(frame.scene.month)}, ${frame.win ? 'ventana seca' : 'fuera de ventana seca'}`);
      }
      if (frame.playing !== seen.playing) { seen.playing = frame.playing; play.innerHTML = frame.playing ? ICON.pause : ICON.play; play.setAttribute('aria-label', frame.playing ? 'Pausar' : 'Reproducir'); el.classList.toggle('is-playing', frame.playing); }
      if (frame.speed !== seen.speed) { seen.speed = frame.speed; speedBtn.textContent = speedLabel(frame.speed); }
      const closed = model.seasons.filter((s) => frame.t >= s.t1).map((s) => s.key).join(',');
      if (closed !== seen.closed || frame.stretch.key !== seen.stretch) {
        seen.closed = closed; seen.stretch = frame.stretch.key;
        seasonEls.forEach((s) => { s.classList.toggle('is-closed', closed.split(',').includes(s.dataset.season)); s.classList.toggle('is-now', s.dataset.season === frame.stretch.key); });
        $('[data-jump]').textContent = model.stops.some((s) => s > frame.t) ? 'Saltar al cierre de temporada' : 'Ir al final';
      }
    },
    destroy() {
      track.removeEventListener('pointerdown', onDown); track.removeEventListener('pointermove', onMove);
      track.removeEventListener('pointerup', onUp); track.removeEventListener('pointercancel', onUp);
      track.removeEventListener('keydown', onKey); el.removeEventListener('click', onClick);
    },
  };
}
