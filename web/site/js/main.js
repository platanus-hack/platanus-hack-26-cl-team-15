import { loadData } from './data.js';
import { getState } from './state.js';
import { landing } from './landing.js';
import { createStage } from './stage.js';
import { expediente } from './expediente.js';
import { ruta } from './ruta.js';

// Plain hash names only: the artifact viewer passes nothing else.
// #valle and #predio-pXX share one mounted stage (map, panel, timeline); the rest are pages.
const ROUTES = [
  { match: /^(inicio)?$/, page: landing, nav: '' },
  { match: /^valle$/, stage: 'valle', nav: 'valle' },
  { match: /^predio(?:-(p\d{2}))?$/, stage: 'predio', nav: 'valle' },
  { match: /^expediente(?:-(p\d{2}))?$/, page: expediente, nav: 'valle' },
  { match: /^ruta$/, page: ruta, nav: 'ruta' },
];

const app = document.getElementById('app');
let cleanup = null;
let stage = null;

function routeCount() {
  const n = (getState().route || []).length;
  const el = document.querySelector('[data-route-count]');
  el.textContent = n; el.hidden = n === 0;
}

function leave() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  if (stage) { stage.destroy(); stage = null; }
}

async function render() {
  const hash = decodeURIComponent(location.hash.slice(1)).toLowerCase();
  const route = ROUTES.find((r) => r.match.test(hash)) || ROUTES[0];
  const param = (hash.match(route.match) || [])[1]?.toUpperCase() || null;
  document.querySelectorAll('[data-nav]').forEach((a) => (a.dataset.nav === route.nav ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  document.documentElement.classList.toggle('is-landing', route.nav === '');
  try {
    const data = await loadData();
    if (route.stage) {
      if (typeof cleanup === 'function') cleanup();
      cleanup = null;
      if (!stage) { stage = createStage(app, data); window.scrollTo({ top: 0 }); }
      const id = route.stage === 'predio' ? param || getState().current : null;
      stage.show(id ? 'predio' : 'valle', id);
    } else {
      leave();
      cleanup = route.page(app, data, param) || null;
      window.scrollTo({ top: 0 });
    }
  } catch (err) {
    console.error('Caudal: no se pudo mostrar la vista', hash, err);
    leave();
    app.innerHTML = `<section class="page"><div class="empty"><b>No se pudo cargar esta vista.</b><p>Los datos del valle no llegaron. Recarga la página para intentarlo de nuevo.</p><a class="btn" href="#inicio">Volver al inicio</a></div></section>`;
  }
  routeCount();
}

window.addEventListener('hashchange', render);
document.addEventListener('caudal:state', routeCount);
render();
