// The precomputed valley: Sentinel-2 series, Open-Meteo climate and the score of every parcel per season.
let cache = null;

export async function loadData() {
  if (cache) return cache;
  const res = await fetch('data/valle.json');
  if (!res.ok) throw new Error(`No se pudo leer el valle (${res.status})`);
  cache = await res.json();
  return cache;
}

export const BANDS = {
  alta: { short: 'Alta', rank: 0, why: 'Riego probable y todo el rango estimado sobre el derecho.' },
  media: { short: 'Media', rank: 1, why: 'Riego probable; el derecho cae dentro del rango estimado.' },
  baja: { short: 'Baja', rank: 2, why: 'Riego probable, con el consumo estimado dentro del derecho.' },
  sin: { short: 'Sin alerta', rank: 3, why: 'Sin señal de riego en ventana seca.' },
};

// Natural colour views of the valley; `key` is the month of the Sentinel-2 scene each one comes from.
export const IMAGES = [
  { key: '2023-01', file: 'img/study_2023-01.jpg' },
  { key: '2024-01', file: 'img/study_2024-01.jpg' },
  { key: '2024-07', file: 'img/study_2024-07.jpg' },
  { key: '2025-01', file: 'img/study_2025-01.jpg' },
];

export const predios = (data) => data.parcels.filter((p) => p.kind === 'predio');
export const refs = (data) => data.parcels.filter((p) => p.kind === 'ref');
export const parcelById = (data, id) => predios(data).find((p) => p.id === id) || null;

export function ranking(data, season) {
  return predios(data)
    .map((p) => ({ p, s: p.seasons[season] }))
    .sort((a, b) => BANDS[a.s.band].rank - BANDS[b.s.band].rank || b.s.index - a.s.index || b.s.m3_mid - a.s.m3_mid);
}

const nf = new Intl.NumberFormat('es-CL');
export const fmt = (n, d = 0) => (n == null || Number.isNaN(n) ? 'n/d' : new Intl.NumberFormat('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n));
export const signed = (n, d = 2) => (n == null ? 'n/d' : `${n < 0 ? '−' : '+'}${fmt(Math.abs(n), d)}`);
export const m3 = (n) => `${nf.format(Math.round(n))} m³`;
export const range = (s) => `${nf.format(s.m3_low)} a ${nf.format(s.m3_high)} m³`;
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export const monthLong = (ym) => `${MONTHS_LONG[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export const dateLabel = (d) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
export const bandPill = (band) => `<span class="band band-${band}">${BANDS[band].short}</span>`;
export const fmtCoord = ([lon, lat]) => `${Math.abs(lat).toFixed(4)}° S, ${Math.abs(lon).toFixed(4)}° O`;
export const href = (kind, id) => `#${kind}-${id.toLowerCase()}`;
