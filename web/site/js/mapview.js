// The valley from above. Four natural colour dates sit stacked and crossfade to the nearest one;
// on top, every parcel and both dry references are filled with their measured greenness at the cursor.
// A parcel the detector flags in the scene under the cursor gets a pulsing ring.
import { IMAGES, dateLabel, esc, fmt } from './data.js';
import { colorOf, glowOf, RAMP_ENDS } from './ramp.js';

const HIT_PAD = 9; // grid pixels added around a parcel so a finger can hit it

export function mapHtml(model, data) {
  const [w, h] = data.area.grid;
  const box = (tr) => { const [x0, y0, x1, y1] = tr.p.px; return { x0, y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, r: Math.max(x1 - x0, y1 - y0) * 1.15 }; };
  const grads = model.tracks.map((tr) => `<radialGradient id="glow-${tr.id}"><stop offset="0" stop-opacity=".7"/><stop offset="1" stop-opacity="0"/></radialGradient>`).join('');
  const shapes = model.tracks.map((tr) => {
    const b = box(tr);
    return `<g class="pc${tr.isRef ? ' is-ref' : ''}" data-pc="${tr.id}">
      <circle class="pc-halo" cx="${b.cx}" cy="${b.cy}" r="${b.r.toFixed(1)}" fill="url(#glow-${tr.id})"/>
      <circle class="pc-ring" cx="${b.cx}" cy="${b.cy}" r="${(b.r * 0.85).toFixed(1)}"/>
      <rect class="pc-box" x="${b.x0}" y="${b.y0}" width="${b.w}" height="${b.h}" rx="2"/>
      ${tr.isRef ? `<title>${esc(tr.p.name)}</title>` : `<rect class="pc-hit" data-open="${tr.id}" tabindex="0" role="link" aria-label="Abrir ${esc(tr.p.name)}" x="${b.x0 - HIT_PAD}" y="${b.y0 - HIT_PAD}" width="${b.w + HIT_PAD * 2}" height="${b.h + HIT_PAD * 2}"><title>${esc(tr.p.name)}</title></rect>`}
    </g>`;
  }).join('');
  const labels = model.tracks.map((tr) => {
    const b = box(tr);
    return `<span class="map-lbl${tr.isRef ? ' is-ref' : ''}" data-lbl="${tr.id}" style="left:${(b.cx / w * 100).toFixed(2)}%;top:${(b.y0 / h * 100).toFixed(2)}%">${tr.isRef ? 'secano' : tr.id.slice(1)}</span>`;
  }).join('');
  return `<div class="map" data-map>
    ${IMAGES.map((im) => `<img class="map-img" data-img="${im.key}" src="${im.file}" alt="" width="${w}" height="${h}">`).join('')}
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="group" aria-label="Predios y secanos de referencia sobre el valle de La Ligua"><defs>${grads}</defs>${shapes}</svg>
    <div class="map-lbls" aria-hidden="true">${labels}</div>
    <p class="map-key"><i class="key-ramp"></i>Verdor medido, NDVI ${fmt(RAMP_ENDS[0], 1)} a ${fmt(RAMP_ENDS[1], 1)}<span><i class="key-ring"></i>riego probable</span></p>
    <p class="map-note" data-img-note></p>
  </div>`;
}

export function createMapView(root, model) {
  const el = root.querySelector('[data-map]');
  const images = IMAGES.map((im) => ({ ...im, scene: model.scenes.find((s) => s.month === im.key), el: el.querySelector(`[data-img="${im.key}"]`) })).filter((im) => im.scene && im.el);
  const note = el.querySelector('[data-img-note]');
  const nodes = new Map(model.tracks.map((tr) => {
    const g = el.querySelector(`[data-pc="${tr.id}"]`);
    return [tr.id, { g, box: g.querySelector('.pc-box'), halo: g.querySelector('.pc-halo'), stops: [...el.querySelectorAll(`#glow-${tr.id} stop`)], color: '', glow: -1, state: '' }];
  }));
  let shown = null; let selected = null;

  const showImage = (t) => {
    const near = images.reduce((best, im) => (Math.abs(im.scene.t - t) < Math.abs(best.scene.t - t) ? im : best), images[0]);
    if (near.key === shown) return;
    shown = near.key;
    images.forEach((im) => im.el.classList.toggle('is-on', im.key === shown));
    note.textContent = `Fondo: color natural Sentinel-2 del ${dateLabel(near.scene.date)}, la más cercana de ${images.length} fechas`;
  };

  return {
    update(frame) {
      showImage(frame.t);
      frame.cells.forEach((c) => {
        const n = nodes.get(c.id);
        const color = colorOf(c.green);
        if (color !== n.color) { n.color = color; n.box.style.fill = color; n.stops.forEach((s) => s.setAttribute('stop-color', color)); }
        const glow = Math.round(glowOf(c.green) * 50) / 50;
        if (glow !== n.glow) { n.glow = glow; n.halo.style.opacity = glow; }
        const state = `${c.hit ? 'hit' : ''}${c.read.ndvi == null ? 'void' : ''}`;
        if (state !== n.state) { n.state = state; n.g.classList.toggle('is-hit', c.hit); n.g.classList.toggle('is-void', c.read.ndvi == null); }
      });
    },
    select(id) {
      if (id === selected) return;
      selected = id;
      nodes.forEach((n, key) => n.g.classList.toggle('is-sel', key === id));
      el.querySelectorAll('[data-lbl]').forEach((l) => l.classList.toggle('is-sel', l.dataset.lbl === id));
    },
  };
}
