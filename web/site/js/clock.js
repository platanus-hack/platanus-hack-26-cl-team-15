// The app's one clock: an instant between the first and the last measured month. It plays on
// requestAnimationFrame, stops at the end of each season, and every seek is coalesced into the next frame.
const MS_PER_MONTH = 850; // real time one measured month takes at 1×
const MONTH = 30.44 * 86400000;
const SPEEDS = [1, 2, 0.5];
const STEP_MS = 700; // with reduced motion, playing jumps from scene to scene instead of gliding

export function createClock({ t0, t1, stops, steps, start }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const subs = new Set();
  const clamp = (t) => Math.max(t0, Math.min(t1, t));
  let t = clamp(start ?? t0); let playing = false; let speed = 1; let raf = 0; let lastNow = 0; let held = 0; let event = null;

  const emit = () => { const frame = { t, playing, speed, event }; event = null; subs.forEach((fn) => fn(frame)); };
  const advance = (dt) => {
    if (!reduced.matches) return t + (dt / MS_PER_MONTH) * MONTH * speed;
    held += dt * speed;
    if (held < STEP_MS) return t;
    held = 0;
    return steps.find((s) => s > t) ?? t1;
  };
  const tick = (now) => {
    raf = 0;
    if (playing) {
      const next = advance(Math.min(now - lastNow, 100)); lastNow = now;
      const stop = stops.find((s) => t < s && next >= s);
      if (stop != null) { t = stop; playing = false; event = 'season-end'; }
      else if (next >= t1) { t = t1; playing = false; event = 'end'; }
      else t = next;
    }
    emit();
    if (playing) raf = requestAnimationFrame(tick);
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(tick); };

  return {
    get t() { return t; },
    subscribe(fn) { subs.add(fn); fn({ t, playing, speed, event: null }); return () => subs.delete(fn); },
    seek(next, why = null) { playing = false; t = clamp(next); event = why; schedule(); },
    toggle() {
      playing = !playing;
      if (playing) { if (t >= t1) t = t0; lastNow = performance.now(); held = 0; }
      schedule();
    },
    cycleSpeed() { speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; schedule(); },
    destroy() { cancelAnimationFrame(raf); raf = 0; playing = false; subs.clear(); },
  };
}
