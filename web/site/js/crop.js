// Small helpers on the 10 m pixel grid the images and the parcels share.
import { IMAGES } from './data.js';

/** Map a pointer event on a map element to the image's pixel grid. */
export function pixelOf(mapEl, event, data) {
  const r = mapEl.getBoundingClientRect();
  const [w, h] = data.area.grid;
  return [Math.round(((event.clientX - r.left) / r.width) * w), Math.round(((event.clientY - r.top) / r.height) * h)];
}

/** Inline style that crops one natural colour image around a parcel and boxes it (--box). */
export function cropStyle(data, p, imgKey, pad = 3) {
  const [w, h] = data.area.grid;
  const [x0, y0, x1, y1] = p.px;
  const size = Math.max(x1 - x0, y1 - y0) * pad;
  const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
  const left = Math.min(Math.max(cx - size / 2, 0), w - size); const top = Math.min(Math.max(cy - size / 2, 0), h - size);
  const scale = 100 / size;
  const img = IMAGES.find((i) => i.key === imgKey);
  const box = `${((y0 - top) * scale).toFixed(1)}% ${((left + size - x1) * scale).toFixed(1)}% ${((top + size - y1) * scale).toFixed(1)}% ${((x0 - left) * scale).toFixed(1)}%`;
  return `background-image:url('${img.file}');background-size:${(w * scale).toFixed(1)}% ${(h * scale).toFixed(1)}%;background-position:${(left / (w - size) * 100).toFixed(2)}% ${(top / (h - size) * 100).toFixed(2)}%;--box:${box}`;
}
