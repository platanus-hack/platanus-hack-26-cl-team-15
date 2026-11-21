// Greenness to light: the dry reference goes dark, an irrigated field stays lit.
// The stops are the --v0…--v4 tokens of the stylesheet, read once.
const STOPS = [0.12, 0.28, 0.42, 0.58, 0.8];
const GLOW = [0.32, 0.7]; // NDVI where the halo starts and where it is full
let rgb = null;

function parse(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [128, 128, 128];
}
function stops() {
  if (!rgb) { const cs = getComputedStyle(document.documentElement); rgb = STOPS.map((_, i) => parse(cs.getPropertyValue(`--v${i}`))); }
  return rgb;
}

export function colorOf(ndvi) {
  const c = stops();
  if (ndvi == null) return `rgb(${c[0].join(' ')})`;
  const v = Math.max(STOPS[0], Math.min(STOPS[STOPS.length - 1], ndvi));
  const j = Math.max(1, STOPS.findIndex((s) => s >= v));
  const k = (v - STOPS[j - 1]) / (STOPS[j] - STOPS[j - 1]);
  return `rgb(${c[j - 1].map((a, i) => Math.round(a + (c[j][i] - a) * k)).join(' ')})`;
}
export const glowOf = (ndvi) => (ndvi == null ? 0 : Math.max(0, Math.min(1, (ndvi - GLOW[0]) / (GLOW[1] - GLOW[0]))));
export const RAMP_ENDS = [STOPS[0], STOPS[STOPS.length - 1]];
