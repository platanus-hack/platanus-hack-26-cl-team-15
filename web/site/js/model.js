// The valley on one time axis. Built once from the measured data: every scene, month, dry window and
// season gets a timestamp, and every parcel gets its reading of each scene against the dry reference.
// The detector is the pipeline's rule: in a dry-window scene, NDVI and NDMI both above the reference
// by their thresholds. Scenes the pipeline already scored keep its flag; the rest apply the same rule.
import { refs } from './data.js';

export const DAY = 86400000;
const ts = (iso) => Date.parse(iso.length === 7 ? `${iso}-01` : iso);
const nextMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return Date.UTC(m === 12 ? y + 1 : y, m % 12, 1); };
const mean = (xs) => { const v = xs.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const last = (xs) => xs[xs.length - 1];

function scoredFlags(parcel) {
  const flags = new Map();
  Object.values(parcel.seasons || {}).forEach((s) => (s.dry_scenes || []).forEach((d) => flags.set(d.date, d.positive)));
  return flags;
}

function readScene(parcel, scene, ref, params, flags) {
  const s = parcel.series.find((x) => x.month === scene.month);
  if (!s || s.ndvi == null) return { ndvi: null, ndmi: null, dndvi: null, dndmi: null, hit: false, counted: false };
  const dndvi = ref.ndvi == null ? null : s.ndvi - ref.ndvi;
  const dndmi = ref.ndmi == null || s.ndmi == null ? null : s.ndmi - ref.ndmi;
  const counted = parcel.kind === 'predio' && scene.dry && dndvi != null && dndmi != null;
  const rule = counted && dndvi >= params.ndvi_gap && dndmi >= params.ndmi_gap;
  return { ndvi: s.ndvi, ndmi: s.ndmi, dndvi, dndmi, counted, hit: counted && (flags.has(scene.date) ? flags.get(scene.date) : rule) };
}

/** Running count of dry scenes seen and of those with probable irrigation, restarting at every stretch. */
function tally(reads, scenes, stretchOf) {
  return reads.reduce((acc, r, i) => {
    const prev = i > 0 && stretchOf(scenes[i].t) === stretchOf(scenes[i - 1].t) ? acc[i - 1] : { hits: 0, seen: 0 };
    return [...acc, { hits: prev.hits + (r.hit ? 1 : 0), seen: prev.seen + (r.counted ? 1 : 0) }];
  }, []);
}

export function buildModel(data) {
  const scenes = data.scenes.map((s, i) => ({ ...s, i, t: ts(s.date) }));
  const months = data.climate.monthly.filter((m) => scenes.some((s) => s.month === m.month)).map((m) => ({ ...m, t0: ts(m.month), t1: nextMonth(m.month) }));
  const t0 = months[0].t0; const t1 = last(months).t1;
  const windows = data.climate.dry_windows.map((w) => ({ ...w, t0: ts(w.start), t1: ts(w.end) + DAY })).filter((w) => w.t1 > t0 && w.t0 < t1);
  const seasons = Object.entries(data.seasons).map(([key, s]) => ({ key, t0: ts(s.from), t1: nextMonth(s.to) })).sort((a, b) => a.t0 - b.t0);
  const stretches = [
    { key: 'pre', label: `Antes de la temporada ${seasons[0].key}`, season: null, t0, t1: seasons[0].t0 },
    ...seasons.map((s) => ({ key: s.key, label: `Temporada ${s.key}`, season: s.key, t0: s.t0, t1: s.t1 })),
    { key: 'post', label: `Después de la temporada ${last(seasons).key}`, season: null, t0: last(seasons).t1, t1 },
  ].filter((x) => x.t1 > x.t0);
  const stretchOf = (t) => (stretches.find((x) => t >= x.t0 && t < x.t1) || last(stretches)).key;
  const refList = refs(data);
  const ref = scenes.map((sc) => {
    const at = refList.map((r) => r.series.find((x) => x.month === sc.month));
    return { ndvi: mean(at.map((x) => x?.ndvi)), ndmi: mean(at.map((x) => x?.ndmi)) };
  });
  const tracks = data.parcels.map((p) => {
    const flags = scoredFlags(p);
    const reads = scenes.map((sc) => readScene(p, sc, ref[sc.i], data.params, flags));
    return { p, id: p.id, isRef: p.kind === 'ref', reads, tally: tally(reads, scenes, stretchOf), pts: scenes.filter((sc) => reads[sc.i].ndvi != null).map((sc) => ({ t: sc.t, v: reads[sc.i].ndvi })) };
  });
  return { t0, t1, scenes, months, windows, seasons, stretches, ref, tracks, params: data.params, stops: seasons.map((s) => s.t1).filter((t) => t < t1) };
}

export function nearestScene(model, t) {
  return model.scenes.reduce((best, s) => (Math.abs(s.t - t) < Math.abs(best.t - t) ? s : best), model.scenes[0]);
}

/** What is true of the valley at instant t: the nearest measured scene, the dry window it falls in, the season that has closed. */
export function snapshot(model, t) {
  const scene = nearestScene(model, t);
  const win = model.windows.find((w) => t >= w.t0 && t < w.t1) || null;
  const month = model.months.find((m) => t >= m.t0 && t < m.t1) || last(model.months);
  const stretch = model.stretches.find((x) => t >= x.t0 && t < x.t1) || last(model.stretches);
  const closed = [...model.seasons].reverse().find((s) => t >= s.t1) || null;
  const sceneInStretch = scene.t >= stretch.t0 && scene.t < stretch.t1;
  return { t, scene, win, month, stretch, closed, sceneInStretch, live: Boolean(win) && scene.dry };
}

/** Greenness between measured scenes, for the colour transition only; any number shown comes from `reads`. */
export function greenAt(track, t) {
  const { pts } = track;
  if (!pts.length) return null;
  if (t <= pts[0].t) return pts[0].v;
  const j = pts.findIndex((p) => p.t >= t);
  if (j < 0) return last(pts).v;
  const a = pts[j - 1]; const b = pts[j];
  return a.v + (b.v - a.v) * ((t - a.t) / (b.t - a.t));
}

/** One parcel at one instant. */
export function cellAt(track, snap) {
  const read = track.reads[snap.scene.i];
  const count = snap.sceneInStretch ? track.tally[snap.scene.i] : { hits: 0, seen: 0 };
  return { id: track.id, isRef: track.isRef, green: greenAt(track, snap.t), read, hit: snap.live && read.hit, count };
}
