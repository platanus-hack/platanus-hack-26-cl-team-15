# Caudal — Spec de frontend y backend para la demo

Nov 21, 2026 · @Tomas

Este documento dice qué debe mostrar la plataforma para sostener el guion de [pitch-demo.md](pitch-demo.md), qué datos necesita cada pantalla y qué falta decidir. No repite el spec del producto ([spec-v2.md](spec-v2.md)) ni el de los flujos por polígono ([spec-flujos-poligono.md](spec-flujos-poligono.md)).

La presentación es el domingo 22 en la mañana. Solo es obligatorio lo marcado P0.

**Qué decide este documento.** Define el contenido de cada pantalla, el contrato de datos (qué campos, con qué significado) y cómo llegan los datos al frontend: una API de lectura con DuckDB sobre los Parquet, con respaldo estático (ver [Almacenamiento y transporte](#almacenamiento-y-transporte)).

## Qué debe poder mostrar la demo

Cinco pantallas, en este orden, todas en producción y con datos reales:

| Paso | Pantalla | Dato que la alimenta | Estado hoy |
| --- | --- | --- | --- |
| 1 | Zona Z2 con los predios por banda | `puntaje.parquet` (M5) | El frontend muestra 50 predios por zona con una banda provisional propia |
| 2 | Caso FO-0504-95: serie, banda por temporada y antes/después | `puntaje_validacion.parquet`, `anomalias_predio_validacion.parquet` | Existe la ficha del caso; falta la banda por temporada y el adelanto |
| 3 | Candidato `5301984`: por qué está en alerta | `puntaje.parquet`, `anomalias_predio_elegibles_2025-26.parquet`, `poi.parquet` | La ficha existe con datos provisionales y sin explicación |
| 4 | Expediente PDF generado en vivo | `scripts/models/expediente.py` (M13) | El frontend baja un `.txt` armado en el navegador; el PDF solo se genera por línea de comandos |
| 5 | Ruta del día y panel de impacto | `ruta_z2.json` (M8), `impacto.json` (M9) | La ruta del frontend es provisional; el panel de impacto no existe |

## Principios

- **Nada simulado ni escrito a mano.** Cada cifra en pantalla sale de un archivo de `data/processed/` que genera un script del repo. El jurado tendrá un agente leyendo el repo: un número pegado en el código del frontend se nota.
- **Transparente, sin abrumar.** Cada alerta dice por qué existe, con su fuente y con lo que no sabemos. Como máximo 4 razones y 2 límites por predio; el detalle queda a un clic.
- **Honesto sobre lo que es en vivo.** Las series satelitales se precalculan; la interfaz muestra la fecha de cálculo. El expediente se genera de verdad.
- **Una API de lectura sobre los Parquet.** El frontend pide los datos a `caudal-api`, que consulta con DuckDB los Parquet incluidos en su imagen. No hay base de datos.
- **Respaldo estático.** Las mismas respuestas de la API se guardan como JSON en `frontend-demo/data/respaldo/`. Si el backend no responde, la página usa esos archivos: la demo funciona sin backend, salvo la generación del expediente en vivo.
- **La demo no depende de terceros.** No se llama en vivo a OSRM, CIREN ni la DGA.
- **Caudal prioriza, no acusa.** Sin nombres de dueños. En modo demo tampoco se muestra el rol. Siempre rangos de m³. Solo los casos con multa se llaman "sancionados".

## Por qué este predio está en alerta (P0)

Es la pieza central de la ficha. Responde tres preguntas, en este orden, y nada más.

**1. Qué vimos** (hasta 4 razones). Cada una es una frase con su número, su fuente y un enlace a la referencia:

| Razón | Ejemplo para el predio `5301984` | Campos de origen | Fuente que se muestra |
| --- | --- | --- | --- |
| Riego sin lluvia | "Más verde y más húmedo que el cerro vecino en 20 de 20 imágenes tomadas tras 10 días o más sin lluvia" | `frac_senal`, `n_fechas_validas`, `ndvi_mediana` y la mediana del secano (`ref_ndvi_mediana`) | Imágenes Sentinel-2 (Copernicus), con la lista de fechas y escenas; lluvia de DMC y Open-Meteo |
| Consumo | "Consume entre 105.000 y 280.000 m³ al año" | `m3_consumo_bruto_min`, `m3_consumo_bruto_max` | Método FAO-56 (FAO, 1998); enlace a la sección del método |
| Derechos | "Derechos de agua inscritos en el predio: 0 m³. De vecinos a 500 m: 0 m³" | `m3_derecho_asignado`, `m3_derecho_ajeno_disponible_500m` | Registro de derechos concedidos de la DGA, con la fecha de descarga |
| Contexto | "Canal más cercano: 1,2 km. Sin fiscalización de la DGA a 500 m desde 2018" | `dist_canal_m`, fiscalizaciones a 500 m | Canales CNR/CIREN 2020; planilla de fiscalización de la DGA |

Los valores del ejemplo son los reales del predio `5301984` en la temporada 2025-26 (`puntaje.parquet` y `senal_riego_elegibles_2025-26.parquet`).

**2. Qué tan seguros estamos.** La confianza (alta, media o baja) con su motivo en una frase. Sale de `confianza` y `motivos`:

| `motivos` | Texto en pantalla |
| --- | --- |
| `sin_derechos_propios_ubicados` | "No encontramos derechos ubicados en el predio; podría tener derechos sin coordenada en el registro" |
| `derechos_ajenos_cubren_exceso` | "Hay derechos de vecinos a 500 m que podrían cubrir el consumo" |
| `canal_300m` | "Hay un canal a menos de 300 m: puede regar con acciones de canal, que no están en el registro" |
| `predio_grande` | "Predio de más de 100 ha: la señal se diluye" |
| `pocos_pixeles` | "Predio chico: pocas mediciones por imagen" |
| `cruce_derechos_media`, `cruce_derechos_baja` | "La ubicación del derecho en el registro es incierta" |

**3. Qué no sabemos** (hasta 2 límites). Fijo para todo predio: "Caudal ve que se riega, no de dónde sale el agua. La infracción la constata un inspector".

Reglas:

- Nada de índices con nombre técnico en la primera vista (NDVI, z, percentiles). Van en "ver método", que enlaza a `data/README.md` y a [validacion.md](validacion.md).
- Las frases se generan a partir de los datos, con una sola función que usan la ficha y el expediente (`explicacion()` en `scripts/models/explicacion.py`). Así el PDF y la pantalla dicen lo mismo. Los m³ van a 2 cifras significativas, como en el PDF.
- El caso sancionado usa el mismo bloque, calculado con los datos previos a la inspección.

Contrato de la explicación (lo que entrega la función por predio y temporada):

```json
{
  "predio_id": 5301984, "temporada": "2025-26", "banda": "alta", "confianza": "media",
  "razones": [
    {"id": "riego_sin_lluvia", "texto": "…", "valor": {"fechas_con_senal": 20, "fechas_validas": 20},
     "fuente": "Sentinel-2 (Copernicus) · DMC · Open-Meteo", "referencia": "…", "dato_al": "2026-03-28"}
  ],
  "confianza_motivos": ["…"],
  "limites": ["…"],
  "escenas": [{"fecha": "2026-01-12", "escena_id": "S2B_19HBD_20260112_0_L2A"}],
  "calculado": "2026-11-21T14:02:00-03:00", "version_modelo": "<commit>"
}
```

## Contrato de datos

Lo que cada pantalla necesita, sin importar cómo se guarde o se transporte. Los nombres de la derecha son las columnas de `data/processed/` (documentadas en `data/README.md`).

| Recurso | Para qué pantalla | Campos | Origen |
| --- | --- | --- | --- |
| Resumen de zona | Portada y zona | Total de predios, conteo por banda | `puntaje.parquet` |
| Ranking de zona | Zona | `predio_id`, `rank_zona`, `banda`, `puntaje`, `confianza`, comuna, `area_ha`, especie; filtros por canal y por fiscalización | `puntaje.parquet`, `predio_cultivo.parquet` |
| Geometría de predios | Mapa | Polígono por `predio_id` | `predio.parquet` (no está en git: capa de CIREN) |
| Ficha del predio | Ficha | La explicación de arriba, más rangos de consumo y exceso | `puntaje.parquet`, `explicacion.py` |
| Serie del predio | Gráfico de la ficha | Por fecha: `ndvi`, `ndmi`, mediana del secano, si está en ventana seca, si hay señal, `escena_id` | `anomalias_predio_*.parquet` |
| Puntos a revisar | Ficha y ruta | Hasta 8 por predio: tipo, coordenada, razón, confianza | `poi.parquet` |
| Historial del caso | Ficha del caso | Por temporada: banda, puntaje, exceso; fecha de inspección, multa, primera alerta y años de adelanto | `puntaje_validacion.parquet`, `fiscalizacion.parquet`, `impacto.py` |
| Imágenes del predio | Ficha y caso | Recortes satelitales por fecha, con escena y fecha | Hoy: `frontend-demo/assets/casos/` y las figuras de `expediente.py` |
| Ruta | Pestaña Ruta | Paradas con horas, km, punto de acceso, enlace de navegación; GPX | `ruta_z1.json`, `ruta_z2.json` |
| Impacto | Panel de impacto | Candidatos, lift, escenarios, capacidad, equivalencias con su fuente | `impacto.json` |
| Expediente | Botón de la ficha | PDF e identificador | `expediente.py` |

## Almacenamiento y transporte

Decidido: **API de lectura con DuckDB sobre los Parquet, con respaldo estático.** No hay base de datos.

```
Navegador ──► caudal-web (Cloud Run, nginx, estático)
   │             └─ data/respaldo/*.json   ◄── build_m5_web.py ─┐
   │                (solo si la API no responde)                 │ mismas funciones
   │                                                             │ (api/datos.py)
   └────────► caudal-api (Cloud Run, FastAPI + DuckDB) ◄─────────┘
                 ├─ GET  /api/zonas/..., /api/predios/..., /api/casos/..., /api/impacto
                 ├─ POST /api/expediente  ──► expediente.py ──► PDF
                 └─ /app/data/*.parquet  (copiados al construir la imagen)
```

- Un solo módulo, `api/datos.py`, arma cada recurso del [contrato de datos](#contrato-de-datos) a partir de `data/processed/` y llama a `explicacion.py` para la ficha. La API lo usa en cada solicitud, y `api/respaldo.py` pide cada ruta a la misma aplicación y escribe el respaldo en `frontend-demo/data/respaldo/` (una ruta por endpoint: `/api/zonas/Z2/ranking` → `respaldo/zonas/Z2/ranking.json`). Así la API y el respaldo no se pueden desalinear. Rutas, formas de respuesta y la función `api(ruta)` de ejemplo: [api/README.md](../api/README.md).
- El frontend pide todo con una sola función, `api(ruta)` en `js/config.js` (la URL del backend va en `API_BASE`). Si la API no responde en 15 segundos o da error, lee el archivo equivalente del respaldo y muestra un aviso discreto: "datos del {fecha}".
- Para actualizar los datos se vuelve a desplegar `caudal-api`. Cada versión de datos queda en su propia revisión de Cloud Run, y para volver atrás basta con mover el tráfico a la revisión anterior.

Cómo queda cada decisión:

| Decisión | Elegido | Por qué |
| --- | --- | --- |
| Datos tabulares (puntajes, series, POI) | Parquet dentro de la imagen de `caudal-api`, leídos con DuckDB | `data/processed/` pesa 58 MB y el sitio nunca escribe en él. DuckDB lee los Parquet que ya generan los scripts, con filtros, joins y orden, y responde en milisegundos sin infraestructura nueva |
| Geometrías | `GET /api/zonas/{zona}/predios`: GeoJSON solo de las bandas alta y media (unos 800 por zona), simplificado a 5 m | Queda bajo los 5.000 polígonos con los que ya se probó el frontend. PMTiles con los 20.050 queda fuera de alcance |
| Imágenes por predio y fecha | Para la demo, las de hoy: `assets/casos/` y las figuras de `expediente.py`. T13 (P1): recortes de los predios en alerta en un bucket privado | Un job por pasada para 7.911 predios no cabe esta noche |
| Expedientes PDF | Pregenerados dentro de la imagen; los nuevos en `/tmp` del contenedor | Los de la demo no se pierden al reiniciar; los nuevos solo tienen que durar la sesión |
| Transporte al frontend | API para todo, con respaldo estático | Ningún dato queda pegado en el código del frontend, y la demo sobrevive a una caída del backend |

Los requisitos de antes se cumplen así:

- **Fuente de verdad:** `data/processed/`. El "script de carga" es el despliegue: copia los Parquet a la imagen y escribe `/app/data/VERSION` (fecha y commit).
- **Fechas del dato:** cada respuesta lleva `dato_al` y `calculado`. La versión de los datos va en `/api/health` y como `ETag`.
- **Respaldo:** el recorrido completo funciona con `data/respaldo/` y el PDF de respaldo.
- **Sin arranque en frío:** una instancia mínima durante la final.

### Por qué no Cloud SQL, Firestore ni BigQuery

- **Cloud SQL (PostGIS):** las cargas incrementales cada 5 días serían útiles en el producto, pero hoy la cadena se corre a mano y redesplegar basta. Pide crear la instancia, configurar la conexión desde Cloud Run, un esquema y un script de carga, y cobra aunque no se use. No cabe antes del domingo. Se reconsidera cuando la cadena corra sola en cada pasada.
- **Firestore:** no guarda arreglos dentro de arreglos, que es como GeoJSON guarda las coordenadas de los polígonos, y limita cada documento a 1 MB.
- **BigQuery:** responde en segundos; es lento para abrir una ficha.

## Frontend

Base: `frontend-demo/` (three.js y MapLibre). No se cambia la estructura de modos ni la precarga.

### F1. Datos reales de M5 (P0)

- La página deja de usar los puntajes provisionales de `build_zonas_scores.py` y usa los de M5, pedidos con `api(ruta)` (ver [Almacenamiento y transporte](#almacenamiento-y-transporte)).
- Se quita todo texto "provisional" de bandas, índice y consumo.
- La portada muestra 7.911 predios analizados y el conteo por banda de cada zona.
- El ranking se ordena por `rank_zona`.

### F2. Ficha del predio (P0)

Bloques, de arriba hacia abajo:

1. Encabezado: "Predio candidato", comuna, hectáreas y especie. Sin rol en modo demo.
2. Banda y bloque **Por qué está en alerta** (sección anterior): razones, confianza, límites.
3. Serie de la temporada con la línea del cerro seco de referencia y las ventanas sin lluvia sombreadas. Leyenda: "predio" y "cerro seco vecino". Al pasar por un punto: fecha e identificador de la escena.
4. Agua: barra con el rango de consumo y una marca en el derecho inscrito.
5. Puntos a revisar: lista y marcadores en el mapa.
6. Botón **Generar expediente**.
7. Pie: "Calculado el {fecha} · datos al {fecha} · ver método".

### F3. Expediente en vivo (P0)

- El botón pide el expediente al backend.
- Mientras espera, muestra los pasos reales que informa el backend. Sin barras de progreso falsas.
- Al terminar, abre el PDF en un visor dentro del panel y ofrece descargarlo.
- Si el backend no responde en 20 segundos o falla, abre el PDF de respaldo y muestra "generado el {fecha}".
- Se elimina la descarga del `.txt` de `js/expediente.js`.

### F4. Ficha del caso sancionado (P0)

- Línea de tiempo por temporada con la banda de Caudal y una línea vertical en la fecha de inspección.
- Frase destacada con datos del historial: "Caudal: alerta alta desde {primera alerta} · Inspección DGA: {fecha} · al menos {años} años antes".
- Multa en UTM y en pesos; imágenes antes y después.
- El mismo bloque **Por qué está en alerta**, con los datos previos a la inspección.

### F5. Ruta (P0)

- Usa la ruta de M8: paradas con hora de llegada, minutos y km desde la anterior.
- Botones: abrir en Google Maps y bajar GPX.
- Encabezado con los totales de la ruta (predios, horas, km, punto de salida), leídos del dato.
- Al tocar una parada se abre la ficha del predio.

### F6. Panel de impacto (P0)

Pantalla nueva, con enlace directo `#impacto`. Queda en pantalla 45 segundos del pitch: pocas cifras, grandes, en el orden en que se dicen. Todas se leen de `impacto.json`; ninguna va escrita en el código.

| Orden | Cifra en pantalla | Campo de `impacto.json` |
| --- | --- | --- |
| 1 | 2,6× más infractores que al azar | `lift_alta_sin_calibrar.valor`, con `ic_bajo` e `ic_alto` en letra chica. No usar `lift_alta` (3,7): se midió con los mismos casos que calibraron los umbrales |
| 2 | 1 predio = el agua de 3.000 personas al año = 220 millones de latas | Exceso mínimo del predio abierto ÷ `equivalencias.m3_persona_ano.valor` y ÷ `equivalencias.lata_monster_ml.valor` |
| 3 | 501 predios en alerta alta sin fiscalizar | `candidatos` |
| 4 | Entre 5 y 20 Torres Costanera de agua al año | `torres_costanera_ano.conservador` y `.central` |
| 5 | 14 años para revisarlos uno por uno | `capacidad.anos` |

Las cifras 2 y 4 llevan un dibujo simple (personas, latas, torres). Cada equivalencia muestra su fuente al pasar el cursor (`equivalencias.*.fuente` y `.nota`); la de la torre dice que es una estimación.

### F7. Modo demo (P1)

- Enlaces directos al caso, al candidato, a la ruta y al impacto.
- Teclas 1 a 5 para saltar entre los pasos del guion.
- `?demo=1` oculta el rol en todas las fichas.
- Los identificadores del caso y del candidato de la demo van en un archivo de configuración (`data/demo.json`), no en el código.

### F8. Filtros del ranking (P2)

Dos filtros: "sin canal a 300 m" y "nunca fiscalizado". Corresponden al escenario conservador de M9.

## Backend

Un solo servicio, `caudal-api`, sirve el expediente y los recursos de lectura del contrato de datos.

### Expediente (P0)

Servicio `caudal-api` (FastAPI). Importa las funciones de `scripts/models/expediente.py`; no las reescribe.

| Método y ruta | Qué hace |
| --- | --- |
| `GET /api/health` | Estado del servicio, versión de los datos (commit y fecha) y número de predios |
| `POST /api/expediente` | Genera el expediente de un predio, o lo devuelve si ya existe con los mismos insumos |
| `GET /api/expediente/eventos?predio_id=` | Lo mismo, como eventos (`paso`, `listo`, `falla`): son los pasos reales de la generación, para F3 |
| `GET /api/expediente/{id}/expediente.pdf` | Entrega el PDF |

Entrada de `POST /api/expediente`:

```json
{"predio_id": 5301984, "temporada": "2025-26"}
```

Salida (200):

```json
{
  "id": "CAU-5301984-202611220915",
  "predio_id": 5301984,
  "temporada": "2025-26",
  "banda": "alta",
  "confianza": "media",
  "reutilizado": true,
  "segundos": 0.4,
  "con_imagenes": true,
  "url_pdf": "/api/expediente/CAU-5301984-202611220915/expediente.pdf",
  "creado": "2026-11-22T09:15:03-03:00"
}
```

Reglas:

- Dos solicitudes con los mismos insumos devuelven el mismo expediente. La clave es el `hash_insumos` que ya calcula `expediente.py`. La respuesta lo dice (`reutilizado`), y la interfaz muestra la fecha de creación: no se presenta como recién generado algo que no lo es.
- Si Earth Search o Esri no responden en 15 segundos, se genera sin imágenes (`con_imagenes: false`) en vez de fallar.
- Tope de 180 segundos por solicitud (`CAUDAL_TOPE_S`). Una generación a la vez por predio. Los plazos se subieron el 22-11 (antes 5, 60 y 120 segundos) porque con los datos de todo Chile las consultas y la generación pueden tardar más.
- Errores: 404 si el predio no tiene puntaje; 422 si la temporada no tiene datos; 503 con detalle si la generación falla.
- El PDF usa el mismo texto de `explicacion.py` y mantiene las reglas de lenguaje del flujo B: "indicios", rangos, sin nombres.

Opcional en la entrada: `"temporada"` (por defecto, la del ranking) y `"regenerar": true` (fuerza uno nuevo).

Para la demo, el expediente del candidato y el del caso (`data/demo.json`) se generan al construir la imagen, con los mismos datos que usa la API. En el escenario se dice lo que es: "el expediente se arma en el servidor"; si el jurado pide otro predio, se genera delante de ellos.

### Recursos de lectura (P0)

Cada ruta llama a una función de `api/datos.py` y devuelve los campos del contrato de datos:

| Método y ruta | Prioridad |
| --- | --- |
| `GET /api/zonas/{zona}/resumen` | P0 |
| `GET /api/zonas/{zona}/ranking?banda=&sin_canal=&sin_fiscalizar=&limite=` | P0 (los filtros son P2) |
| `GET /api/zonas/{zona}/predios` (GeoJSON de las bandas alta y media) | P0 |
| `GET /api/predios/{id}` (ficha con explicación, POI y contexto de M12) | P0 |
| `GET /api/predios/{id}/serie?temporada=` | P0 |
| `GET /api/casos/{expediente}` | P0 |
| `GET /api/zonas/{zona}/ruta`, `/ruta.gpx` y `/ruta.geojson` | P0 |
| `GET /api/impacto` | P0 |
| `GET /api/zonas` (portada: total y resumen de cada zona) | P0 |
| `GET /api/casos` (los 10 casos resueltos) | P0 |
| `GET /api/demo` (zona, caso y candidato del guion: `data/demo.json`) | P1 |
| `GET /api/chile`, `/api/chile/{zona}/ranking`, `/api/chile/predios/{id}` (corrida nacional exploratoria, leída del bucket montado en `/datos`; 503 si no está montado) | P2 |
| `POST /api/ruta` (otra jornada u otro filtro; solo con matrices de OSRM guardadas) | P2 |

Reglas:

- Una base DuckDB en memoria por proceso, abierta al arrancar. Los Parquet se registran como vistas, así que las consultas no copian los datos en memoria. Tres tablas chicas se calculan una vez al arrancar, con las funciones de los modelos: las imágenes marcadas por el detector de riego, los predios con fiscalización a 500 m y el centro de cada predio.
- Responden con `Cache-Control: public, max-age=300` y un `ETag` igual a la versión de los datos.
- 404 si el predio, la zona o el caso no existen.
- Nunca devuelven nombres de titulares. El rol solo sale con `?rol=1`, y el frontend no lo pide en modo demo.
- `GET /api/predios/{id}` responde para los 7.911 predios elegibles. El respaldo estático solo incluye los de bandas alta y media, los de los casos y las paradas de la ruta.

## Despliegue en Cloud Run

| Parámetro | `caudal-web` | `caudal-api` |
| --- | --- | --- |
| Origen | `frontend-demo/` (Dockerfile con nginx, ya existe) | Dockerfile con Python 3.12 y las bibliotecas de WeasyPrint (pango, cairo, gdk-pixbuf) |
| Región | `us-central1` (domain mapping de `caudales.dev`) | `southamerica-west1` |
| CPU y memoria | 1 vCPU, 512 MiB | 2 vCPU, 2 GiB |
| Concurrencia | 80 | 20 (los `GET` tardan milisegundos; el expediente se limita aparte, una generación por predio) |
| Tiempo máximo | 60 s | 300 s |
| Instancias | mínimo 1, máximo 3 | mínimo 1, máximo 2 |
| Acceso | Público | Público, CORS solo desde la URL de `caudal-web` |

Cosas a saber:

- **Cuota:** Cloud Run tiene 20 vCPU y 40 GiB por región. Los trabajos de Gabi corren en `us-west1`, así que no compiten con estos servicios.
- **Cloud Build:** ya funciona (el `PERMISSION_DENIED` del trabajo de POI no volvió). `desplegar.sh` construye con Docker en local si está corriendo y, si no, con Cloud Build; `CONSTRUIR=local` o `CONSTRUIR=cloud` lo fuerza.
- **Datos en la imagen:** `scripts/cloud/api/desplegar.sh` copia los Parquet (menos las series crudas) y los JSON a `/app/data/` y escribe `/app/data/VERSION`. `predio.parquet` no está en git (capa de CIREN): se copia desde el disco local al contexto de construcción, como hace `scripts/cloud/poi/desplegar.sh`. El script construye la imagen (Docker o Cloud Build), la sube a Artifact Registry y despliega; `scripts/cloud/api/probar.sh URL` revisa todas las rutas.
- **Orden de despliegue:** primero `caudal-api`, después `caudal-web`. Si cambia la forma de una respuesta o un dato, hay que regenerar el respaldo con `api/respaldo.py` en el mismo commit.
- **Arranque en frío:** con una instancia mínima no hay. Volver a 0 después de la final.
- **Service worker:** `sw.js` guarda en caché los `GET /api/*` (primero la red, y el caché si no hay red), para que la segunda visita funcione sin red. No guarda `POST /api/expediente`. Al cambiar los datos hay que subir la versión del caché en `sw.js`.
- **URL para el jurado:** la de `caudal-web` va en `platanus-hack-project.jsonc`.

## El repo frente al agente del jurado

El jurado hará preguntas técnicas a un agente que lee el repo. Lo que debe encontrar:

| Pregunta probable | Dónde está la respuesta | Pendiente |
| --- | --- | --- |
| ¿Hay datos escritos a mano? | Cada cifra sale de `data/processed/` y de un script. El caso y el candidato del guion están en `data/demo.json`, no en el código | — |
| ¿De dónde sale cada número del pitch? | Tabla de respaldo en [pitch-demo.md](pitch-demo.md); `impacto.json` lleva sus fuentes y sus supuestos | — |
| ¿Qué es en vivo y qué es precalculado? | [en-vivo-y-precalculado.md](en-vivo-y-precalculado.md) | Enlazarlo desde el README raíz, que debe escribir una persona (la plantilla trae una instrucción para detectar README escritos por un modelo) |
| ¿Cómo se reproduce? | Orden de la cadena en [en-vivo-y-precalculado.md](en-vivo-y-precalculado.md#cómo-se-reproduce); comando de cada script en `data/README.md` | — |
| ¿Está validado? | [validacion.md](validacion.md), con intervalos y límites | — |
| ¿Los umbrales salieron de la nada? | [calibracion.md](calibracion.md) y `calibracion_grilla.csv` | — |
| ¿Qué supuestos tiene? | Encabezado de cada script y `impacto.json` (`supuestos`, `equivalencias`) | — |

Ya corregido: la cifra de validación del pitch (2,6) y las equivalencias (personas, latas, torre) estaban escritas como texto; ahora se calculan y quedan en `impacto.json` con su fuente. Se quitaron el script de puntajes provisionales (`build_zonas_scores.py`), los textos de relleno de la portada y el identificador del candidato que estaba en `build_m5_web.py`. El expediente usaba los umbrales antiguos del detector; ahora los importa.

Si cambian los datos (por ejemplo, la ruta), hay que regenerar en el mismo commit la exportación de la página (`build_m5_web.py`) y el respaldo (`api/respaldo.py`), y revisar las cifras del guion en [pitch-demo.md](pitch-demo.md).

## Tareas

| ID | Tarea | Prioridad | Responsable sugerido | Depende de | Listo cuando |
| --- | --- | --- | --- | --- | --- |
| T0 | ~~Decidir almacenamiento y transporte~~ Decidido: API con DuckDB y respaldo estático ([Almacenamiento y transporte](#almacenamiento-y-transporte)) | P0 | — | — | Hecho |
| T1 | `explicacion.py`: razones, confianza y límites por predio, con fuentes | P0 | Tomás ✅ | — | Devuelve el contrato de la explicación para `5301984` y para el caso FO-0504-95 |
| T2 | `api/datos.py` (funciones de lectura con DuckDB), `api/respaldo.py` (escribe `data/respaldo/`) y la función `api(ruta)` de la página (`js/config.js`). En git está el respaldo del recorrido de la demo (`--predios demo`); el completo pesa 26 MB y no se subió | P0 | Tomás y Felipe ✅ | T1 | La portada lee `/api/health`, `/api/impacto` y `/api/zonas`, con respaldo |
| T2b | Rutas `GET` de lectura en `caudal-api`, llamando a `api/datos.py` | P0 | Tomás ✅ | T2, T6 | `GET /api/predios/5301984` responde en local lo mismo que su archivo del respaldo |
| T3 | F1 y F2: página con datos de M5 y ficha con "Por qué está en alerta" (`js/explicacion.js`, también en la ficha del caso) | P0 | Felipe y Tomás ✅ | T1, T2 | El predio `5301984` muestra sus razones con fuente |
| T4 | F4: línea de tiempo y adelanto en la ficha del caso | P0 | Felipe ✅ | T2 | FO-0504-95 muestra su primera alerta y los años de adelanto |
| T5 | F5 y F6: ruta de M8 y panel de impacto leídos del dato | P0 | Felipe y Nico ✅ (F5). F6: el panel se retiró de la página; las cifras quedan en `impacto.json`, en la portada y en el guion | T2 | La pestaña Ruta muestra las paradas de `ruta_z*.json` |
| T6 | `caudal-api`: `health` y `expediente` | P0 | Tomás ✅ (imagen probada en local con Docker) | — | `POST /api/expediente` devuelve un PDF en local |
| T7 | Desplegar `caudal-api`: `scripts/cloud/api/desplegar.sh` y luego `EXPEDIENTE=1 scripts/cloud/api/probar.sh URL` (el expediente del candidato se genera al construir) | P0 | Gabi ✅ (revisión `caudal-api-00002-9vc`: `probar.sh` completo, rutas en menos de 0,6 s y expediente en 1,4 s) | T2b | `/api/predios/5301984` y el expediente responden en producción en menos de 2 s |
| T8 | F3: botón que llama al backend, visor de PDF y respaldo | P0 | Nico ✅ | T6 | El clic abre el PDF en producción; con el backend apagado abre el respaldo |
| T9 | Desplegar `caudal-web` y llenar `platanus-hack-project.jsonc` | P0 | Nico ✅ | T3 a T8 | El recorrido completo funciona en la URL pública, también con `caudal-api` apagado |
| T10 | Limpieza para el agente del jurado: quitar lo provisional, `data/demo.json`, documento "en vivo y precalculado". Falta que una persona escriba el README raíz y lo enlace | P0 | Tomás ✅ | T3 | La tabla de la sección anterior no tiene pendientes |
| T12 | F7: modo demo (enlaces, teclas, `?demo=1`) | P1 | Nico y Tomás ✅ | T3 | Las teclas 1 a 5 recorren el guion |
| T13 | Recortes de los predios en alerta en un bucket privado | P1 | Felipe | T7 | La ficha del candidato muestra recortes con fecha y escena |
| T14 | Filtros del ranking y ruta del escenario conservador | P2 | Tomás | T2 | — |

Estado al 22-11: T1 a T10 están listos y `caudal-api` y `caudal-web` están en producción (`PROD_API` de `js/config.js`, con CORS solo para `caudal-web`). Falta volver a desplegar los dos servicios con el bloque de razones y la regla del rol (ver abajo), las teclas del modo demo (T12), los recortes (T13) y la ruta conservadora (T14).

**Regla del rol (22-11).** El rol se muestra solo en los predios con un caso sancionado por la DGA, que es un dato público. Para el resto, la página, los archivos que carga y el expediente PDF identifican el predio por su polígono de CIREN. La API entrega el rol si se pide (`?rol=1` en las rutas de lectura, `"rol": true` en el expediente), porque quien presenta la denuncia lo necesita. Con `?demo=1` la página no muestra ningún rol, tampoco el de los casos.

### Nota para Tomás: serie del año completo en Valparaíso (22-11)

La corrida nacional extrae Sentinel-2 del **año completo solo en Valparaíso** (R05, de abril de 2025 a hoy). El resto de las regiones sigue con diciembre a marzo. El ranking no cambia: M1–M5 siguen usando solo la temporada. Quedan dos archivos nuevos en `gs://ph-26-caudal-chile/modelo/chile-2025-26/region=R05/`: `serie_anual.parquet` y `serie_referencia_anual.parquet`. Tienen el mismo esquema que `serie_predio_elegibles_2025-26.parquet`. Detalle en [spec-chile.md](spec-chile.md#año-completo-en-valparaíso).

Usos que quedan abiertos (ninguno está hecho):

1. **Consumo anual (M4)** con el Kc de cada mes observado, en vez de extrapolar el del verano. Necesita clima de R05 hasta noviembre de 2026.
2. **Ficha:** serie hasta noviembre de 2026 y la última escena limpia (13-11-2026 sobre Z1 y Z2). Se rotula aparte de `dato_al`, que es la última imagen de la temporada analizada (28-03-2026), no la última que existe.
3. **Experimento:** pesar las fechas de M3 por déficit hídrico. Solo si mejora el AUC de validación; no para la demo.

## Criterios de aceptación de la demo

- [ ] El recorrido del guion se completa en producción en menos de 1:40, sin recargar. Sin cronometrar: el recorrido se probó el 22-11 con las teclas 1 a 5, en la página de desarrollo contra la API de producción.
- [x] Ninguna pantalla dice "provisional" ni muestra una cifra que no esté en `data/processed/`.
- [x] La ficha del candidato muestra como máximo 4 razones y 2 límites, cada razón con su fuente.
- [x] El texto de la ficha y el del PDF coinciden (los dos salen de `explicacion.py`).
- [x] El expediente del candidato se abre en menos de 3 segundos y es un PDF con las 7 secciones de la guía de la DGA (0,5 s desde la página).
- [x] Con el backend apagado, el recorrido completo funciona con el respaldo estático y el botón abre el PDF de respaldo.
- [x] En modo demo no aparece ningún rol ni nombre (portada, zona, caso, candidato, expediente y ruta).
- [x] Buscar en `frontend-demo/js/` los números del pitch (501, 2,6, 5301984) no da resultados.

## Fuera de alcance

- Usuarios, sesiones y permisos.
- Envío de la denuncia a la DGA (requiere Clave Única; el expediente queda listo para que la persona lo presente).
- Recalcular series satelitales en vivo.
- Plan de vuelo de dron (M14) y retorno de campo (M15).
- Base de datos (Cloud SQL, Firestore, BigQuery): ver [Por qué no](#por-qué-no-cloud-sql-firestore-ni-bigquery).
