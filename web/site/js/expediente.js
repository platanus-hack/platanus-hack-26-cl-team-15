// The evidence file, on the fields of the DGA's complaint guide (Código de Aguas, July 2025).
// Caudal fills what the data supports; the person who files it writes who they are and how they are
// affected, and files it with Clave Única. Nothing typed here is stored or sent.
import { IMAGES, ranking, parcelById, range, m3, bandPill, esc, fmtCoord, dateLabel, monthLabel, href } from './data.js';
import { getState, setState } from './state.js';
import { cropStyle } from './crop.js';

const PERSON = [
  ['name', 'Nombre o razón social'], ['rut', 'RUN o RUT'], ['comuna', 'Comuna y región'], ['contacto', 'Correo o teléfono'],
];

function draft(data, p, s, season) {
  const pos = s.dry_scenes.filter((d) => d.positive);
  const first = pos[0]?.date; const lastD = pos[pos.length - 1]?.date;
  return `Entre ${first ? dateLabel(first) : 'n/d'} y ${lastD ? dateLabel(lastD) : 'n/d'}, en ${pos.length} de ${s.dry_scenes.length} imágenes Sentinel-2 tomadas durante periodos de ${data.params.dry_days} o más días sin lluvia, el predio ubicado en ${fmtCoord(p.center)} (comuna de ${data.area.comuna}) mostró verdor y humedad superiores a los del secano cercano, lo que es consistente con riego. El consumo estimado para la temporada ${season} es de ${range(s)}, frente a un derecho de ${m3(s.right_m3)}. Las cifras son una estimación para priorizar la fiscalización y deben confirmarse en terreno.`;
}

function annex(data, p, s, season) {
  return { predio: p.id, centro: p.center, temporada: season, escenas_ventana_seca: s.dry_scenes, consumo_m3: { bajo: s.m3_low, central: s.m3_mid, alto: s.m3_high }, derecho_m3: s.right_m3, meses: s.months.filter(Boolean), fuentes: ['Sentinel-2 L2A (Element84 Earth Search)', data.climate.source] };
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function expediente(app, data, param) {
  const season = getState().season;
  const order = ranking(data, season);
  const p = parcelById(data, param || getState().current || order[0].p.id);
  if (!p) { app.innerHTML = `<section class="page"><div class="empty"><b>No encontramos ese predio.</b><a class="btn" href="#valle">Ver el valle</a></div></section>`; return null; }
  setState({ current: p.id });
  const s = p.seasons[season];
  const annexText = JSON.stringify(annex(data, p, s, season));
  app.innerHTML = `<section class="page">
    <div class="page-head"><div><p class="eyebrow">Expediente · ${esc(p.name)} · temporada ${season}</p><h1>Expediente de evidencia ${bandPill(s.band)}</h1>
      <p>Sigue los campos de la guía de denuncias de la DGA (julio 2025). Caudal no presenta nada: lo presenta una persona con Clave Única en la Oficina Virtual de la DGA, o en persona con el formulario firmado.</p></div>
      <div class="controls"><a class="btn" href="${href('predio', p.id)}">← Ficha</a><button type="button" class="btn" data-copy>Copiar texto</button><a class="btn btn-primary" href="#ruta">Ruta de inspección →</a></div></div>
    <form class="doc" data-doc autocomplete="off">
      <section class="doc-sec"><header><h3>1. Individualización del denunciante</h3><span class="who who-persona">Completa la persona, con Clave Única</span></header>
        <div class="fields">${PERSON.map(([k, l]) => `<label for="f-${k}">${l}<input id="f-${k}" name="${k}"></label>`).join('')}</div>
        <p class="note">Se adjunta copia de la cédula al presentar. Estos datos no se guardan ni salen de esta página.</p></section>
      <section class="doc-sec"><header><h3>2. Representante legal o apoderado</h3><span class="who who-persona">Completa la persona, si corresponde</span></header>
        <div class="fields"><label for="f-rep">Nombre y RUT<input id="f-rep" name="rep" placeholder="Opcional"></label></div></section>
      <section class="doc-sec"><header><h3>3. Ubicación y referencias</h3><span class="who who-caudal">Pre-llena Caudal, la persona revisa</span></header>
        <dl class="kv"><dt>Región</dt><dd>${esc(data.area.region)}</dd><dt>Provincia</dt><dd>${esc(data.area.provincia)}</dd><dt>Comuna</dt><dd>${esc(data.area.comuna)}</dd>
          <dt>Coordenadas</dt><dd class="mono">${fmtCoord(p.center)}</dd>
          <dt>Cauce cercano</dt><dd class="muted">Por verificar</dd></dl>
        <div class="crops"><figure class="crop"><div style="${cropStyle(data, p, '2024-01', 3)}" role="img" aria-label="Croquis sobre imagen de enero 2024"></div><figcaption>croquis, ene 2024</figcaption></figure>
          <figure class="crop"><div style="${cropStyle(data, p, '2025-01', 3)}" role="img" aria-label="Croquis sobre imagen de enero 2025"></div><figcaption>croquis, ene 2025</figcaption></figure></div></section>
      <section class="doc-sec"><header><h3>4. Descripción breve de los hechos y fecha</h3><span class="who who-caudal">Redacta Caudal, la persona edita y firma</span></header>
        <label for="f-hechos">Borrador<textarea id="f-hechos" name="hechos" rows="6">${esc(draft(data, p, s, season))}</textarea></label></section>
      <section class="doc-sec"><header><h3>5. Afectación del denunciante</h3><span class="who who-persona">Solo la persona puede escribirla</span></header>
        <p class="note">La DGA declara admisible la denuncia de un interesado que expone cómo se configura el perjuicio a la fuente o la afectación a sus derechos o a los de terceros. Caudal no puede redactarlo por ella.</p>
        <label for="f-afectacion">Cómo me afecta<textarea id="f-afectacion" name="afectacion" rows="4" placeholder="Por ejemplo: soy titular de derechos aguas abajo y desde el verano mi captación no alcanza…"></textarea></label></section>
      <section class="doc-sec"><header><h3>6. Adjuntos</h3><span class="who who-caudal">Genera Caudal</span></header>
        <div class="table-wrap"><table><thead><tr><th>Adjunto</th><th>Contenido</th></tr></thead><tbody>
          <tr><td>A. Serie satelital</td><td>NDVI y NDMI mensuales, ${data.scenes.length} escenas (${dateLabel(data.scenes[0].date)} a ${dateLabel(data.scenes[data.scenes.length - 1].date)})</td></tr>
          <tr><td>B. Imágenes</td><td>Color natural de ${IMAGES.map((i) => monthLabel(i.key)).join(', ')}</td></tr>
          <tr><td>C. Cálculo de m³</td><td>FAO-56, ${s.months.filter(Boolean).length} meses de ${monthLabel(data.seasons[season].from)} a ${monthLabel(data.seasons[season].to)}: ${range(s)}</td></tr>
          <tr><td>D. Derechos consultados</td><td>${m3(s.right_m3)} por año <span class="tag">ilustrativo</span></td></tr></tbody></table></div>
        <p class="note">Huella SHA-256 de los datos del anexo, calculada en este navegador:</p><p class="hash" data-hash>calculando…</p></section>
      <section class="doc-sec"><header><h3>Estado</h3></header><p data-status class="note"></p></section>
    </form></section>`;
  const form = app.querySelector('[data-doc]');
  const status = () => {
    const f = new FormData(form);
    const missing = [...PERSON.map(([k, l]) => (f.get(k)?.trim() ? null : l)), f.get('afectacion')?.trim() ? null : 'Afectación'].filter(Boolean);
    app.querySelector('[data-status]').innerHTML = missing.length ? `Falta completar: ${missing.map(esc).join(', ')}.` : '<b>Listo para presentar.</b> Revisa el borrador y preséntalo en la Oficina Virtual de la DGA con tu Clave Única.';
  };
  status();
  sha256(annexText).then((h) => { app.querySelector('[data-hash]').textContent = h; }).catch(() => { app.querySelector('[data-hash]').textContent = 'No disponible en este navegador.'; });
  const onInput = () => status();
  const onSubmit = (e) => e.preventDefault();
  const onClick = async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const f = new FormData(form);
    const text = [`EXPEDIENTE ${p.name} · temporada ${season}`, `Ubicación: ${data.area.comuna}, ${data.area.provincia}, ${data.area.region}. ${fmtCoord(p.center)}`, `Hechos: ${f.get('hechos')}`, `Afectación: ${f.get('afectacion') || '(por completar)'}`, `Huella del anexo: ${app.querySelector('[data-hash]').textContent}`].join('\n\n');
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Copiado'; } catch { app.querySelector('#f-hechos').select(); btn.textContent = 'Selecciona y copia'; }
    setTimeout(() => { btn.textContent = 'Copiar texto'; }, 2000);
  };
  form.addEventListener('input', onInput); form.addEventListener('submit', onSubmit); app.addEventListener('click', onClick);
  return () => { form.removeEventListener('input', onInput); form.removeEventListener('submit', onSubmit); app.removeEventListener('click', onClick); };
}
