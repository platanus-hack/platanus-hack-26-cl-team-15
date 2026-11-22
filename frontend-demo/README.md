# Caudal · frontend demo

Mockup navegable del frontend de Caudal (Platanus Hack 26, track Physical World), alineado con el spec v2: priorizar qué predios inspeccionar en una zona combinando Sentinel-2 y clima, y entregar una ruta de inspección. Usa los datos reales del equipo para las dos zonas del spec (Z1 Petorca, Z2 Aconcagua bajo) y los 10 casos de validación. El sistema prioriza, no acusa.

## Cómo correrlo

```bash
cd frontend-demo
python3 -m http.server 8000
# abrir http://localhost:8000                    mapa de Chile
#       http://localhost:8000/#z1                directo a Z1 · Petorca (#petorca es alias)
#       http://localhost:8000/#z2                directo a Z2 · Aconcagua bajo
#       http://localhost:8000/#caso-FD-0501-181  directo a un caso sancionado por la DGA
#       http://localhost:8000/#aculeo            gancho: laguna de Aculeo en 3D
```

Hace falta un servidor local (módulos ES y `fetch` no funcionan con `file://`). Sin build: three.js y MapLibre se cargan desde CDN con versiones fijas. Necesita internet para las librerías, las fuentes y el detalle satelital sobre zoom 9.

## Despliegue (Cloud Run)

Desplegado en **https://caudales.dev** (servicio `caudal-web` en `us-central1`, la región del domain mapping de `caudales.dev` y `www.caudales.dev`). La API que llama está en `southamerica-west1` ([js/config.js](js/config.js)).

La carpeta trae su `Dockerfile`: nginx sirviendo los archivos tal cual, sin build. No hace falta
`package.json` ni scripts `build`/`start`.

```bash
# desde la raíz del repo (proyecto ph-26-caudal)
gcloud run deploy caudal-web --source frontend-demo --region us-central1 --allow-unauthenticated
```

Para el despliegue automático desde el repo espejo, el disparador debe usar `frontend-demo/Dockerfile`.

- `nginx.conf.template` — escucha en `PORT` (8080 en Cloud Run), comprime JSON/JS/CSS, `tiles/` y
  `assets/` con caché de 24 h, y el resto (`sw.js`, código, datos) siempre revalida, para que un
  despliegue se vea al recargar.
- `.dockerignore` / `.gcloudignore` — dejan fuera `scripts/` y el README.
- Probar en local: `docker build -t caudal-web frontend-demo && docker run --rm -p 8080:8080 caudal-web`.
- Probado en la URL real: recorrido completo, service worker y segunda visita sin red.
- El despliegue es manual (comando de arriba) hasta que se conecte el repo espejo al proyecto.

## Rendimiento

La página carga solo lo que se ve y la vista de zona aguanta miles de predios. Medido con `scripts/perf/measure.cjs` en Chrome, GPU integrada Intel UHD 630, ventana 1280×760, servidor local (antes = commit `f685071`):

| | Antes | Después |
|---|---|---|
| Carga inicial | 10,9 MB · 93 requests | 4,1 MB · 73 requests |
| Bloqueos del hilo principal en la carga (5 y 3 corridas) | 2,3–4,0 s | 1,2–1,9 s |
| Intro | 30–37 fps | 50 fps |
| Trabajo de GPU en reposo (4 s) | 181 ms | 7 ms |
| Datos para entrar a una zona, 50 / 5.000 predios | 2,5 MB / 201 MB | 0,4 MB / 14 MB |
| Enlace directo a una zona con 5.000 predios | 10,4 s | 5,7 s |
| Volver al ranking, 5.000 predios | 838 ms | 31 ms |
| Redimensionar, 50 / 5.000 predios | 386 ms / 1.268 ms | 102 ms / 85 ms |
| Hover sobre el terreno, 5.000 predios | 49 fps | 60 fps |

Los 1.000 y 5.000 predios son los 50 reales clonados por el script de medición (`--mults 1,20,100`), no datos reales.

Qué se hizo:

- **Marcadores**: MapLibre leía la profundidad del relieve (un `readPixels` síncrono) por cada marcador; se desactiva y queda solo el chequeo del globo (`skipTerrainOcclusion` en `js/map.js`). Un marcador detrás de un cerro ya no se atenúa.
- **Grano**: la capa de grano es estática; su animación en loop obligaba a recomponer toda la portada sobre los canvas WebGL.
- **Aculeo** se crea al primer uso (o al pasar el puntero por sus accesos), no en el arranque.
- **Portada** usa `data/zonas/resumen.json`; ya no baja los datos completos de las dos zonas.
- **Series por bloque**: NDVI/NDMI de ~50 predios por archivo (`data/zonas/{z}/series/`), pedidos al abrir una ficha o un caso. `scores.lite.json` no trae `historico`.
- **Ranking** monta filas por tandas al hacer scroll y se conserva al abrir una ficha.
- **Capa de predios**: al seleccionar se repintan solo los rectángulos del predio anterior y del nuevo. Los demás predios ya no se atenúan un 20% mientras hay uno seleccionado.
- **Tiles**: el recorte al borde de Chile corre en un worker (`js/tile-clip-worker.js`).

Si cambian los datos de una zona hay que regenerar los archivos livianos (sin red, verifica contra los completos):

```bash
python3 scripts/build_zonas_web.py --check
```

Los archivos los escribe `scripts/build_m5_web.py` desde `data/processed/` (ver [data/zonas/README.md](data/zonas/README.md)).

Para medir (usa el Chrome instalado; `playwright-core` puede vivir en cualquier carpeta):

```bash
npm i playwright-core
NODE_PATH=$PWD/node_modules node scripts/perf/measure.cjs --label prueba --out prueba.json
```

Pendiente: con miles de predios lo que queda por bajar al entrar a una zona son las geometrías (`predios.geojson`, 13 MB con 5.000 predios).

## Precarga y caché (para la demo)

Mientras la portada está en pantalla, la página deja listo todo lo que la demo puede abrir, para que
navegar por dentro no espere red, decodificación ni GPU.

**Qué hace**

- `js/preload.js` — durante la intro baja solo bytes (imágenes de las escenas 3D y tiles satelitales
  de los vuelos). Al terminar la intro carga código, datos, series e imágenes de casos, y construye
  la escena 3D de cada zona y la de Aculeo (con todos sus años ya subidos a la GPU). Se pausa durante
  cualquier vuelo.
- Una escena 3D por zona, cada una en su canvas (`MAX_VALLES = 3` en `js/main.js`): cambiar de zona
  ya no reconstruye nada. Con más de 3 zonas, la más antigua se reutiliza como antes.
- `sw.js` — service worker con caché persistente. Desde la segunda visita todo sale del disco y el
  recorrido completo funciona **sin red** (probado).
- `js/map.js → skipGpuWaits` — salta dos esperas síncronas de GPU dentro de MapLibre que botaban
  cuadros en cada vuelo.

**Cuándo está listo**: `document.documentElement.dataset.warm === 'done'` (y `data-warm-failures` con
los pasos que fallaron). No hay indicador visual; se puede agregar.

**Antes de presentar**: abrir la página una vez con red y esperar a `warm = done` (primera visita:
~30 s en local, más en wifi lento porque son ~15 MB; siguientes: ~2 s después de la intro).

**Medido** (`scripts/perf/measure.cjs --only demo`, Intel UHD 630, 1280×760, red simulada 80 ms / 10 Mbps;
"tareas largas" = tiempo de hilo principal bloqueado durante el paso):

| Paso | Antes: peor cuadro · tareas largas | Ahora (1ª visita) | Ahora (2ª visita) |
|---|---|---|---|
| Entrar a Z1 | 483 ms · 787 ms | 83 ms · 58 ms | 100 ms · 59 ms |
| Volver a Chile | 100 ms · 303 ms | 50 ms · 54 ms | 50 ms · 50 ms |
| Entrar a Z2 | 267 ms · 411 ms | 50 ms · 0 ms | 67 ms · 0 ms |
| Entrar a Aculeo | 267 ms · 330 ms (7,0 s) | 50 ms · 0 ms (4,9 s) | 67 ms · 0 ms (4,9 s) |
| Abrir ficha | 219 ms | 96 ms | 97 ms |
| Abrir caso con imágenes | esperaba descarga | 96 ms | 95 ms |

Descarga durante el recorrido: de 2,4–5,4 MB por paso a 0. La duración de cada entrada (~4,8 s) es
la animación (vuelo 2,4 s + descenso 2,2 s), no carga. Costo: la portada trabaja más justo después
de la intro (tareas largas de la carga 1,2–1,9 s → 2,3–2,7 s; intro 50 → 49 fps).

**Animaciones** (perfil por animación, mismo equipo; "bloqueos" = tareas largas del hilo principal):

| Tramo | Antes | Ahora |
|---|---|---|
| Intro | 52 fps · 355 ms de bloqueos | 57 fps · 55 ms |
| Construcción de escenas tras la intro | 18 fps · 1,1 s de bloqueos, en 1,5 s | ~51 fps · ~0,4 s, repartidos en ~4 s |
| Intro en pantalla retina (densidad 2) | 40 fps | ~48 fps (medición intermedia, no la final) |
| Vuelos, descensos, hover, ruta, Aculeo | 56–59 fps | 56–59 fps |

Qué se hizo: texturas decodificadas fuera del hilo principal (`ImageBitmap`), shaders compilados con
`compileAsync`, subidas a GPU y construcción de escenas espaciadas; en la intro, la vista final se
dibuja una vez detrás del velo de carga (shaders y tiles listos antes del vuelo), el mapa vuela a
densidad 1 y vuelve a densidad completa al aterrizar, y la capa del satélite se limita a densidad 1,5.

**Supuestos y cosas a saber**

- La primera visita descarga ~15 MB en segundo plano aunque no se abra nada.
- `sw.js`: `tiles/` y `assets/` se sirven de la caché y se revalidan en segundo plano (una imagen
  regenerada aparece a la segunda recarga); html/js/css/json van siempre al servidor primero. La
  caché no tiene tope. **`?sw=0` lo apaga y borra la caché** (vuelve a registrarse al abrir sin el
  parámetro). Queda registrado para `localhost:8000`: si se sirve otro proyecto en ese puerto,
  abrir antes con `?sw=0`.
- `skipGpuWaits` usa API privada de MapLibre 5.24 y hace que `gl.checkFramebufferStatus` responda
  "completo" sin consultar a la GPU. `?gpucheck=1` restaura la llamada real. Probar en el equipo de
  la demo.
- Cada escena precargada es un contexto WebGL más (mapa + 2 zonas + Aculeo = 4).
- Cambios visibles de la ronda de animaciones: en pantallas retina el mapa se ve a menor densidad
  durante el vuelo de la intro, y el satélite 3D un poco menos nítido (densidad 1,5 en vez de 2).
- En una corrida de prueba la intro no terminó (no se pudo reproducir, ni en local ni desplegado).
  Si pasa: "Saltar intro" o abrir con `#z1`. Sospechoso: `warmLandingView` en `js/intro.js`.
- Sin probar: Safari, Firefox, móvil.

## Recorrido

1. Mapa de Chile: satélite y relieve sobre Chile, resto del mundo oscuro. Marcadores de las dos zonas (Z1, Z2), los 10 casos sancionados por la DGA y Aculeo; con zoom ≥ 8 aparecen los puntos de fiscalización DGA (rojo = con infracción, gris = sin infracción).
2. Aculeo (gancho): terreno 3D con imágenes reales 2018–2024; el usuario mueve el año y ve cómo cambia el agua.
3. Zona (Z1 o Z2): terreno 3D con los predios por banda y los casos destacados. Panel con tres pestañas:
   - Predios: ranking por banda → ficha (derecho del rol en la DGA, banda del índice de sospecha M5, serie NDVI/NDMI con ventanas secas, línea de inspección si es un caso) → expediente PDF con los campos de la guía de denuncias de la DGA, generado por `caudal-api`.
   - Casos: los casos de la zona → ficha del caso (expediente, comuna, fecha de inspección, decisión, multa en UTM, cómo se veía la señal antes de la inspección, imágenes antes/después).
   - Ruta: ruta de inspección del día (Google Maps / GPX).

Dentro de una zona:

- Elegir un predio de cualquier forma (fila del ranking, su polígono o su punto en el terreno) abre su
  ficha y acerca la cámara al predio. Un clic en terreno vacío lo suelta y vuelve a la zona completa.
- Mientras la cámara está acercada a un predio o a un caso, el botón de volver dice **Ver toda la zona**
  y retrocede un paso (a la lista y a la vista completa); recién desde ahí dice **Volver a Chile**.
  La tecla Escape hace lo mismo.

Nada se reproduce solo en las vistas 3D: la ruta se recorre solo al tocar el botón.

## Estructura

```
index.html, css/          página y estilos (css/panels.css: paneles de la zona)
js/main.js                orquesta modos: mapa · laguna · zona, rutas #z1 #z2 #caso-… #aculeo
js/map.js                 mapa nacional (MapLibre, tiles locales + remotos), zonas, casos, fiscalizaciones
js/hero.js                Aculeo 3D (three.js)
js/valle.js               escena 3D de una zona (three.js): predios por banda, casos, ruta
js/zona-data.js           carga de datos por zona (series por bloque bajo demanda) + formatos compartidos
js/tile-clip.js, tile-clip-worker.js   recorte de tiles al borde de Chile, fuera del hilo principal
js/preload.js                         precarga en segundo plano (datos, imágenes, tiles, escenas 3D)
sw.js                                 service worker: caché persistente (?sw=0 lo apaga)
js/ficha.js, caso.js, expediente.js, ruta-panel.js, chart.js   paneles
data/zonas/               datos de las zonas (ver abajo)
assets/zonas/, assets/casos/, assets/aculeo/   imágenes, DEM y recortes Sentinel-2 de los casos
tiles/                    caché local de tiles satelitales y de relieve de Chile (z3–z9)
scripts/                  scripts que descargan y procesan todo lo anterior
scripts/build_zonas_web.py   archivos livianos que carga la página (resumen, scores.lite, series por bloque)
scripts/perf/measure.cjs  medición de rendimiento
```

## Datos

Todo sale de `data/processed/` del repo (ver [data/README.md](../data/README.md)). `scripts/build_m5_web.py` lo convierte a los JSON que carga la página; la tabla de archivos y sus campos está en [data/zonas/README.md](data/zonas/README.md).

- Predios: catastro CIREN. La página lleva los polígonos de las bandas alta y media, los casos y las paradas de la ruta; el resto va como conteo.
- Banda, puntaje, confianza y rangos de consumo y exceso: índice de sospecha M5 (`puntaje.parquet`).
- Series NDVI y NDMI con el secano de referencia: Sentinel-2 L2A (Element84 Earth Search), anomalías de M2.
- Derechos de agua por rol: registro de la DGA, con la confianza del cruce.
- Casos y fiscalizaciones: expedientes públicos de la DGA. Los 10 casos están resueltos con multa y se muestran como "caso sancionado por la DGA".
- Clima y ventanas secas: estaciones DMC y Open-Meteo corregido.
- Ruta: orden con OR-Tools y trazado con OSRM, guardados; la página no llama a OSRM.
- Expediente PDF: lo genera `caudal-api` al pedirlo ([api/README.md](../api/README.md)). Si no responde, se abre el de `data/respaldo/expedientes/`, con su fecha.
- Imágenes: Sentinel-2 cloudless (EOX). Relieve: AWS Terrain Tiles.

Qué se calcula al momento y qué viene calculado: [docs/en-vivo-y-precalculado.md](../docs/en-vivo-y-precalculado.md).

Principio: el sistema prioriza, no acusa. Solo IDs y rol, nunca nombres de dueños; siempre rangos de m³, nunca una cifra única; ningún predio sin resolver se llama "infractor".

## Atribución

Sentinel-2 cloudless by EOX IT Services GmbH (Contains modified Copernicus Sentinel data) · AWS Terrain Tiles · © OpenStreetMap contributors · Natural Earth · Open-Meteo · DMC · CIREN · DGA · CONAF.
