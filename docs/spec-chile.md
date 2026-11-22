# Caudal — Spec de extensión a todo Chile (Cloud Run Jobs)

21-11-2026 · plazo: 12 horas · complementa [spec-v2.md](spec-v2.md) y [spec-demo.md](spec-demo.md)

## Estado de la corrida (22-11, 07:55)

**Corrida completa en las 14 regiones.**

| Etapa | Estado |
| --- | --- |
| `base` | ✅ 14 de 14 regiones |
| `plan` | ✅ 4.413 escenas en 100 tiles. Valparaíso con el año completo; el resto, temporada seca |
| `satelite` | ✅ 40 de 40 partes. Hubo dos relanzamientos: por el reparto (de escenas sueltas a tramos de tile) y por memoria en 3 tiles pesados (con `HILOS=4`) |
| `region` | ✅ 14 de 14 regiones, en 3 ejecuciones en paralelo (us-west1, us-west2 y us-west4) |
| `nacional` | ✅ Regresión aprobada: 97,1 % de coincidencia de banda en los 7.911 predios de Z1 y Z2 y 10 de 10 casos de validación en la misma banda. `web/ACTUAL` → `chile-2025-26` |

- **Capa del mapa:** `frontend-demo/data/chile/`, generada por `build_chile_web.py`. Fuera de Z1 y Z2 hay 31.079 predios en alerta: 23.372 en alta y 7.707 en media. Es exploratoria (ver [Regiones](#regiones-configregionesjson)). En el sur no hay alerta alta, por la regla de `sur_humedo`.
- **API:** `GET /api/chile` y siguientes, desde el bucket montado (ver `api/README.md`). Para Z1 y Z2, la fuente sigue siendo `/api/predios`.
- **Imagen de los jobs:** `caudal-jobs/pipeline:88934d2a6044`.

### Qué datos ya están disponibles

**Datos base de todo Chile (14 regiones):** están en el bucket privado `gs://ph-26-caudal-chile/base/<tabla>/region=RXX.parquet`, unos 3,1 GB. Las regiones son `R15`, `R01`, `R03`, `R04`, `R05`, `R13`, `R06`, `R07`, `R16`, `R08`, `R09`, `R14`, `R10` y `R11`; no hay Antofagasta ni Magallanes.

| Tabla | Contenido |
| --- | --- |
| `predio` | Capa CIREN completa de la región, con `elegible` y `rol_valido` |
| `referencia_secano` | Matorral y pradera de CONAF (referencia de M2) |
| `cultivo` | Especie y superficie frutícola por predio elegible (Catastro Frutícola) |
| `derecho`, `derecho_predio`, `predio_derecho` | Derechos de agua de la DGA y su cruce con predios |
| `canal`, `cauce`, `predio_cauce` | Canales CNR/CIREN, cauces de la DGA y el más cercano a cada predio |
| `restriccion`, `predio_restriccion` | Sectores SHAC de la DGA (prohibición o restricción) por predio |
| `fiscalizacion` | Expedientes de fiscalización de la DGA |
| `clima`, `predio_clima` | ERA5-Land diario (lluvia y ET0 FAO-56) por celda de 0,1°, de marzo de 2025 a marzo de 2026 |
| `derecho_titulares` | **Nombres de titulares: no se exporta ni se muestra** |

**Serie Sentinel-2 y ranking:** por ahora solo de Valparaíso. Las escenas están en `s2/cache/<tile>/`. Cuando termine `region`, los resultados quedan en `modelo/chile-2025-26/region=R05/`: `puntaje.parquet`, `serie_anual.parquet`, etc. La web de la región queda en `web/chile-2025-26/R05/`.

Cómo leerlos (con acceso al proyecto `ph-26-caudal`):

```bash
gcloud storage ls gs://ph-26-caudal-chile/base/predio/
gcloud storage cp gs://ph-26-caudal-chile/base/predio/region=R13.parquet data/processed/
```

Desde Cloud Run, el bucket se monta en `/datos`: ver [`infra/README.md`](../infra/README.md).

`caudal-api` sirve `modelo/chile-2025-26/` en `/api/chile`, `/api/chile/{región}/ranking` y `/api/chile/predios/{id}` (solo lectura, todo exploratorio fuera de Z1 y Z2) una vez desplegada con el montaje: ver [api/README.md](../api/README.md#corrida-nacional-apichile).

Valparaíso fuera de Z1 y Z2 ya se midió con las fiscalizaciones históricas: la banda alta no supera al azar (0,5 veces; IC 95 % 0,2–1,2), así que el rótulo "exploratorio" se mantiene. Ver [validacion-r05.md](validacion-r05.md) (`scripts/models/validacion_region.py`).

- **Imagen de los jobs:** `caudal-jobs/pipeline:e6d5ad0315fe`.
- **API de la demo:** `caudal-api` está en producción (T7 en [spec-demo.md](spec-demo.md)) y sigue con los datos de Z1 y Z2.
- **Ranking:** no cambia con el año completo de Valparaíso. Ver [Año completo en Valparaíso](#año-completo-en-valparaíso).

## Objetivo

Correr el ranking de la temporada seca 2025-26 (M1 a M5) sobre todos los predios elegibles de Chile, no solo los de Z1 y Z2. Lo hacen tres Cloud Run Jobs (el segundo es el mismo job repetido en tres regiones) que dejan todo en un bucket de GCS. Ese bucket se monta como volumen en los jobs y en `caudal-web`.

- **Job 1, `caudal-chile-datos`:** baja las fuentes (`base`) y arma el plan Sentinel-2 (`plan`).
- **Job 1b, `caudal-chile-satelite`:** lee la serie Sentinel-2 de cada predio. Es un job aparte para poder crearlo en tres regiones y sumar su cuota.
- **Job 2, `caudal-chile-prediccion`:** corre M1 a M5 por región y exporta los archivos del frontend.

El gasto no es una restricción; el tiempo sí. Cada decisión de abajo prioriza la duración total y el riesgo de no llegar.

Fuera de alcance: la calibración (M7) y la validación (M6) siguen siendo las de Z1 y Z2. No se recalibran umbrales por región. Tampoco entran temporadas históricas a nivel nacional (solo 2025-26). POI (M10), ruta (M8) y expediente (M13) se corren solo para los candidatos de banda alta (ver [P1](#p1-si-sobra-tiempo)).

## Lo que encontré en el repo y en las fuentes

| Tema | Hallazgo | Consecuencia |
| --- | --- | --- |
| Predios CIREN | El servicio `PROPIEDADES_RURALES` tiene **una capa por región** (14 capas, ids 0 a 13; no hay Antofagasta ni Magallanes). En total son **893.011 polígonos**: Araucanía 191.838, Maule 137.399, Biobío 86.046, Valparaíso 84.955, etc. Devuelve 10.000 por página. | `predios_ciren.py` consulta hoy la capa 4 por comuna. Hay que consultar cada capa y paginar por `objectid`. Elegibles estimados: entre 350 y 450 mil (en Z1 y Z2 es el 40 %). |
| CONAF (secano) | `USO_DE_LA_TIERRA_CUT_CONAF` también tiene una capa por región, con distintos años (2001-2017, 2001-2019, 2001-2021). | El campo de uso cambia por capa (`uso_19` en Valparaíso). Hay que mapear capa → campo. Aysén no tiene capa, así que queda sin referencia. |
| Catastro frutícola | Capas 55 a 68 ("Productores frutícolas"), una por región, con 2.000 registros por página. | `cultivos_ciren.py` usa la 59 (Valparaíso). Se parametriza. |
| Derechos DGA | La página publica `Derechos_Concedidos_<I..XVI>_Region.xls` (16 regiones) y un `DerechosConcedidos.xlsx` nacional. | `derechos_dga.py` usa el Excel de la V y el bbox `REGION` de Valparaíso. Se parametrizan. Las regiones del sur usan huso 18 (`EPSG` ya lo trae). |
| Fiscalizaciones | La planilla ya es nacional; el script filtra Valparaíso. | Se quita el filtro y la zona se asigna por región. |
| Sentinel-2 | Earth Search, temporada 2025-26 (diciembre a marzo), nubes < 40 %: 3.773 escenas entre las latitudes −27 y −44 y 2.380 al norte de −27. El bbox incluye Argentina; dentro de Chile quedan unas **3.000 a 4.000**. | `serie_sentinel2.py` recorre zona por zona y lee la ventana de los predios de cada tile. A nivel nacional eso es casi el tile completo. Hay que dividir el trabajo **por tile**, no por zona. |
| Clima | Open-Meteo en celdas de 0,1°, 5 celdas por llamada. La API gratuita permite 10.000 llamadas al día, y un año de datos cuenta como varias. | Con miles de celdas no alcanza la cuota gratuita. Se cambia a ERA5-Land ARCO geo-chunked de ECMWF, con la misma grilla de 0,1° (ver [Clima](#clima-era5-land-arco-geo-chunked)). |
| Cuota Cloud Run | 20 vCPU y 40 GiB **por región** ([spec-demo.md](spec-demo.md#despliegue-en-cloud-run)). La de Compute Engine es de 12 vCPU global. | La memoria es el límite. Se pide más cuota al inicio y, mientras tanto, la etapa satelital se reparte en 3 regiones de EE. UU. |
| Cloud Build | Falló con `PERMISSION_DENIED` en el job de POI, pero ya funciona: el equipo despliega `caudal-web` con él y la cuenta de Compute tiene `run.builder`. | Imagen propia en Artifact Registry (`caudal-jobs/pipeline`), construida con Cloud Build y versionada por commit. Ver [`infra/README.md`](../infra/README.md#imagen-de-los-jobs). |
| Modelos | M2 a M5 trabajan por predio, por vecindario (referencias a 10 km, derechos a 500 m) o por celda de clima. El percentil del exceso y `rank_zona` son por `zona`. | Escalan bien si se reparten por región, con un buffer en el borde. `zona` pasa a ser el código de región (`R05`). |
| CRS | Todo usa EPSG:32719 (huso 19S). | Al oeste de 72° O (Los Lagos, Aysén) la distorsión de área es menor al 1 %. Se acepta y se anota. |
| Bucles | `d2_clima_openmeteo.enlazar_estacion` compara cada predio con cada estación en Python puro. | Con 400 mil predios tarda horas. Se reemplaza por un `cKDTree`. Hay que revisar si hay otros bucles por predio. |

## Arquitectura

```
 FUENTES             CIREN · CONAF · DGA · DMC          ECMWF ARCO           Earth Search (AWS us-west-2)
                     (ArcGIS, Excel)                    (ERA5-Land Zarr)     STAC sentinel-2-l2a    COG s3://sentinel-cogs
                            │                                 │                     │                      │
                            ▼                                 ▼                     │                      │
 caudal-chile-datos  ┌─ ETAPA=base (14 tareas, una por región) ──────┐             │                      │
 (Cloud Run Job)     │  predios, secano, cultivos, derechos, cauces   │             │                      │
                     │  clima diario + ET0 por celda de 0,1°          │             │                      │
                     └──────────────┬─────────────────────────────────┘             │                      │
                                    │ base/predio, base/referencia_secano            │                      │
                                    ▼                                                ▼                      │
                     ┌─ ETAPA=plan (1 tarea) ─────────────────────────────────────────────┐                 │
                     │  búsqueda STAC por tile · celdas de 512 ocupadas · 40 partes       │                 │
                     └──────────────┬─────────────────────────────────────────────────────┘                 │
                                    │ plan/escenas, plan/poligonos_tile, plan/partes/<k>.jsonl              │
                                    ▼                                                                       ▼
                     ┌─ ETAPA=satelite (40 tareas: 10 × us-west1, us-west2, us-west4) ─────────────────────────┐
                     │  por escena: SCL primero → rojo, NIR, NIR08, SWIR16 en celdas ocupadas                  │
                     │  dos máscaras (predio, secano) → NDVI, NDMI por polígono                                 │
                     └──────────────┬───────────────────────────────────────────────────────────────────────────┘
                                    │ s2/cache/<tile>/<escena_id>_chile_v2.parquet
                                    ▼
             ╔══════════════ gs://ph-26-caudal-chile (us-west1), montado en /datos con GCS FUSE ══════════════╗
             ║  base/  ·  plan/  ·  s2/cache/  ·  modelo/<corrida>/  ·  web/<corrida>/  ·  web/ACTUAL         ║
             ╚════════════════════════════════════════════════════════════════════════════════════════════════╝
                                    │ base/ + s2/cache/ (control de completitud por región)
                                    ▼
 caudal-chile-       ┌─ ETAPA=region (14 tareas, us-west1) ───────────────────────────────┐
 prediccion          │  1. serie + serie_referencia desde s2/cache (zona = región)        │
 (Cloud Run Job)     │  2-6. M1 ventana seca · M2 anomalías · M3 señal · M4 consumo · M5  │
                     │  7. exportación web por región                                     │
                     └──────────────┬─────────────────────────────────────────────────────┘
                                    │ modelo/<corrida>/region=RXX, web/<corrida>/RXX
                                    ▼
                     ┌─ ETAPA=nacional (1 tarea) ─────────────────────────────────────────┐
                     │  ranking nacional · resumen.json · regresión Z1/Z2 → web/ACTUAL    │
                     └──────────────┬─────────────────────────────────────────────────────┘
                                    │ web/ (montaje de solo lectura)
                                    ▼
                     caudal-web (Cloud Run, us-central1, nginx) ──► navegador
```

Sentinel-2 entra en dos momentos. En `plan` se consulta **solo el catálogo STAC**, una vez y por tile. En `satelite` se leen **solo los COG**, directo desde S3 con los ítems guardados en el plan, sin volver a STAC. Todo lo que sale de ahí pasa por el bucket: `prediccion` nunca lee de AWS.

### Un job, varias etapas

Cada job es **una sola definición** que corre con `ETAPA` y `--tasks` distintos en cada ejecución (`gcloud run jobs execute ... --update-env-vars ETAPA=plan --tasks 1`). Los jobs los define Terraform en [`infra/`](../infra/README.md), con la etapa por defecto de cada uno; los valores de `ETAPA`, `CORRIDA`, `HILOS` y `PARTE_BASE` son variables de entorno. Así hay una sola imagen y un solo punto de entrada, `scripts/cloud/chile/entrada.py`, que lee `CLOUD_RUN_TASK_INDEX` y `CLOUD_RUN_TASK_COUNT`.

Cada tarea es **idempotente**: si su archivo de salida ya está en el bucket, lo salta. Un reintento (`--max-retries 2`) o una nueva ejecución retoma donde quedó, igual que hoy el caché `_v2` de `serie_sentinel2.py`.

### Bucket y montaje

- Bucket nuevo `gs://ph-26-caudal-chile` en **us-west1**: acceso uniforme, sin acceso público y versionado desactivado. Va en us-west1 porque los jobs hacen casi toda la E/S y corren ahí, al lado de Earth Search (Oregón). `caudal-web` lo lee desde Santiago. Son archivos chicos precalculados, con unos 150 ms extra la primera vez y la caché de metadatos de FUSE después.
- Cuenta de servicio nueva `caudal-jobs@ph-26-caudal.iam.gserviceaccount.com` con `roles/storage.objectAdmin` sobre el bucket y `secretAccessor` sobre `CDS_API_KEY`. La de `caudal-web` lleva `roles/storage.objectViewer`. Todo esto, el bucket, el secreto y los jobs los crea Terraform; el estado vive en `gs://ph-26-caudal-tfstate`.
- Montaje en los jobs (definido en Terraform, `infra/modulos/jobs/`): volumen GCS del bucket en `/datos`, gen2, con `mount_options = ["metadata-cache-ttl-secs=600"]`. En la web, el montaje queda como decisión pendiente y Terraform no toca el servicio; el comando (`--add-volume ...,readonly=true` y `mount-path=/usr/share/nginx/html/data/chile`) está en [`infra/README.md`](../infra/README.md#pendientes-manuales).
- Reglas para escribir por FUSE: cada tarea escribe **solo archivos propios**, con nombres únicos (región, tile o escena). Se escribe primero en `/tmp` y después se copia al montaje. No se hace append ni se renombra dentro del montaje. Las rutas de datos se leen de la variable `CAUDAL_DATA=/datos`.

### Estructura del bucket

```
gs://ph-26-caudal-chile/
  config/regiones.json                   mismo esquema que data/zonas.json, con zona = región
  base/
    predio/region=R05.parquet            capa CIREN completa de la región (con elegible, rol_valido)
    referencia_secano/region=R05.parquet
    cultivo/region=R05.parquet           cuarteles del Catastro Frutícola
    derecho/region=R05.parquet           y derecho_titulares/ (con nombres, nunca se exporta)
    cauce/, canal/, restriccion/         region=R05.parquet
    fiscalizacion.parquet                nacional
    clima/region=R05.parquet             ERA5-Land diario por celda, con ET0 (+ DMC si alcanza)
    predio_clima/region=R05.parquet
    _estado/base-R05.json                marca de terminado, con conteos
  plan/
    escenas.parquet                      escena_id, tile, fecha, nubes, parte
    poligonos_tile/<tile>.parquet        predios elegibles y secano que tocan el tile
    partes/<k>.jsonl                     ítems STAC serializados de la parte k
  s2/
    cache/<tile>/<escena_id>_chile_v2.parquet    una por escena (vacía si no hubo píxeles válidos): la marca de terminado es que exista
  modelo/<corrida>/
    region=R05/{serie,anomalias,senal_riego,consumo_predio,consumo_predio_temporada,predio_derecho,puntaje}.parquet
    region=R05/serie_anual.parquet, serie_referencia_anual.parquet   solo regiones con periodo_satelite (hoy, R05)
    puntaje_chile.parquet
  web/<corrida>/
    index.json, resumen.json
    R05/{scores.lite.json, predios.geojson, series/}
  web/ACTUAL                             texto con la <corrida> vigente; la web lee esta
  logs/<etapa>/<ejecucion>/tarea-<i>.log
```

### Regiones (`config/regiones.json`)

Lo genera `scripts/cloud/chile/regiones.py`. Las comunas salen de `desccomu` de cada capa CIREN y el bbox de la capa, con 2 km de margen. Cada región trae las capas de cada fuente, la `aplicabilidad` del modelo y el orden de prioridad para la etapa satelital (primero las regiones del centro).

| Zona | Región | CIREN predios | CONAF | Frutícola | DGA | Aplicabilidad | Prioridad |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R15 | Arica y Parinacota | 0 | 1 | 55 | XV | `norte_desertico` | 3 |
| R01 | Tarapacá | 1 | 2 | 56 | I | `norte_desertico` | 3 |
| R03 | Atacama | 2 | 3 | 57 | III | `norte_desertico` | 2 |
| R04 | Coquimbo | 3 | 4 | 58 | IV | `mediterraneo_seco` | 1 |
| R05 | Valparaíso | 4 | 5 | 59 | V | `calibrado` | 1 |
| R13 | Metropolitana | 5 | 6 | 60 | XIII | `mediterraneo_seco` | 1 |
| R06 | O'Higgins | 6 | 7 | 61 | VI | `mediterraneo_seco` | 1 |
| R07 | Maule | 7 | 16 | 62 | VII | `mediterraneo_seco` | 1 |
| R16 | Ñuble | 8 | 21 | 63 | XVI | `sur_humedo` | 2 |
| R08 | Biobío | 9 | 17 | 64 | VIII | `sur_humedo` | 2 |
| R09 | Araucanía | 10 | 18 | 65 | IX | `sur_humedo` | 3 |
| R14 | Los Ríos | 11 | 20 | 66 | XIV | `sur_humedo` | 3 |
| R10 | Los Lagos | 12 | 19 | 67 | X | `sur_humedo` | 3 |
| R11 | Aysén | 13 | — | 68 | XI | `sur_humedo` | 3 |

Antofagasta (II) y Magallanes (XII) no tienen capa de predios CIREN y quedan fuera.

`aplicabilidad` va al puntaje y al frontend:

- `calibrado`: los umbrales de M7 se calibraron aquí.
- `mediterraneo_seco`: el mismo régimen de verano seco. Los umbrales se extrapolan, y el frontend lo dice.
- `norte_desertico`: todo lo verde es riego, pero casi no hay matorral ni pradera de referencia. Muchas fechas quedan `sin_referencia` y M3 baja la confianza solo.
- `sur_humedo`: llueve en verano y el secano está verde. Hay pocas fechas en ventana seca y una referencia más verde. La confianza saldrá baja casi siempre. Se muestra como **exploratorio**, y la banda alta exige además `aplicabilidad != sur_humedo`.

## Job 1: `caudal-chile-datos`

Recursos: 4 vCPU y 8 GiB en `base` y `plan`. La etapa `satelite` tiene su propio job, `caudal-chile-satelite` (2 vCPU y 4 GiB), porque `execute` no cambia recursos y porque así se crea en las 3 regiones. `--task-timeout 6h`, `--max-retries 2`, cuenta `caudal-jobs`, volumen `/datos`. Imagen `us-west1-docker.pkg.dev/ph-26-caudal/caudal-jobs/pipeline:<commit>` (`infra/imagen/`), con el código en `/app`, las dependencias fijadas y `ENTRYPOINT` en `scripts/cloud/chile/entrada.py`. El bucket solo lleva datos.

### Etapa `base` (14 tareas, una por región)

Paralelismo: 14. Cada tarea corre, para su región y en este orden, los extractores actuales con los cambios de la tabla. Todas leen `config/regiones.json` en vez de `data/zonas.json`.

| Paso | Script | Cambio |
| --- | --- | --- |
| 1 | `predios_ciren.py` | Capa de la región y paginación por `orderByFields=objectid` + `resultOffset` (hoy aborta si llega a 10.000). Sin muestra. `zona` = código de región |
| 2 | `referencia_secano_conaf.py` | Capa CONAF y campo de uso de la región; consulta por región, no por comuna. Recorte con la capa frutícola de la región |
| 3 | `cultivos_ciren.py` | Capa frutícola de la región |
| 4 | `derechos_dga.py` | Excel de la región; bbox `REGION` desde `regiones.json` |
| 5 | `cruce_derechos_predios.py`, `canales_ciren.py`, `cauces_dga.py`, `restriccion_dga.py` | Bbox de la región, con paginación (revisar `exceededTransferLimit`) |
| 6 | `d2_clima_era5land.py` (nuevo; reemplaza a `d2_clima_openmeteo.py` en la corrida nacional) | Celdas de 0,1° de los predios elegibles de la región, del 01-03-2025 al 31-03-2026 (marzo de 2025 calienta la racha de días secos de M1). Ver [Clima](#clima-era5-land-arco-geo-chunked). Escribe el mismo esquema de `clima.parquet` y `predio_clima.parquet`; `celda_id` y `fuente` pasan a `era5land`. `enlazar_estacion` con `cKDTree` |
| 7 | `d2_clima_dmc*.py` + `d2_clima_unir.py` | Si llegan a tiempo: corrección de la lluvia con estaciones. Si no, `lluvia_corr_mm = lluvia_mm` con `correccion = "ninguna"` y M1 sube `--umbral-mm` a 2 (la grilla sobreestima la lluvia cerca de 2 veces) |

La tarea 0 además baja `fiscalizacion.parquet` nacional.

### Clima: ERA5-Land ARCO geo-chunked

Fuente: los Zarr de ECMWF divididos por zona geográfica ("geo-chunked"), pensados para series largas en un área limitada. Son los mismos que usa el formulario "ERA5-Land hourly time-series" del CDS. Tienen la misma grilla de 0,1° que las celdas actuales, cubren desde 1950 y llegan hasta unos 5 días antes de hoy. Referencias: [guía del producto ERA5-Land ARCO](https://confluence.ecmwf.int/spaces/CKB/pages/536218894/ERA5-Land+hourly+Analysis+Ready+Cloud+Optimised+ARCO+data+on+single+levels+from+1950+to+present+Product+User+Guide+PUG) y [anuncio en el foro de ECMWF](https://forum.ecmwf.int/t/access-to-our-arco-era5-data-lake-zarr-store/15123).

| Grupo | Variables | Zarr |
| --- | --- | --- |
| Temperatura | `2m_temperature`, `2m_dewpoint_temperature` | `https://arco.datastores.ecmwf.int/cadl-arco-geo-007/arco/reanalysis_era5_land/sfc-2m-temperature/geoChunked.zarr` |
| Lluvia y presión | `total_precipitation`, `surface_pressure` | `https://arco.datastores.ecmwf.int/cadl-arco-geo-009/arco/reanalysis_era5_land/sfc-pressure-precipitation/geoChunked.zarr` |
| Viento | `10m_u_component_of_wind`, `10m_v_component_of_wind` | `https://arco.datastores.ecmwf.int/cadl-arco-geo-008/arco/reanalysis_era5_land/sfc-wind/geoChunked.zarr` |
| Radiación | `surface_solar_radiation_downwards` | `https://arco.datastores.ecmwf.int/cadl-arco-geo-010/arco/reanalysis_era5_land/sfc-radiation-heat/geoChunked.zarr` |

- **Acceso:** clave de la API de CDS (cuenta gratuita, más la aceptación de la licencia de ERA5-Land) como `Authorization: Bearer <clave>` en `storage_options` de `xr.open_zarr`. La clave va en Secret Manager (`CDS_API_KEY`).
- **Lectura:** `xr.open_zarr(url, consolidated=True)` y `.sel` de las celdas con predios (la grilla es de −180 a 180). Las celdas se agrupan por chunk del Zarr (ver `encoding["chunks"]`), para que cada chunk se baje una sola vez, y se leen con `dask` en paralelo. Los nombres de variables y el tamaño de chunk se verifican al abrir el Zarr: la guía no los da exactos.
- **De horario a diario** (día local, `America/Santiago`):
  - lluvia: suma (la guía dice que `total_precipitation` y la radiación ya vienen desacumuladas por hora; hay que confirmarlo en el piloto);
  - temperatura: Tmax, Tmin y media;
  - presión de vapor real: desde el punto de rocío;
  - viento: medio a 10 m, llevado a 2 m con FAO-56 ec. 47;
  - radiación: suma en MJ/m².
- **ET0:** Penman-Monteith diario de FAO-56 (ec. 6, con Rn desde Rs, Rso y Tmax/Tmin, y G = 0), el mismo método que usa Open-Meteo para `et0_fao_evapotranspiration`. Antes de correr la etapa nacional, la función se contrasta con la ET0 de Open-Meteo de las celdas de Z1 y Z2 que ya están en `clima.parquet`. Criterio: error menor al 10 % en la suma mensual.
- **Piloto (H1):** una región y un mes, para medir el tiempo por celda. Si la lectura de las 14 regiones se proyecta sobre 1 hora, se reparte por región como el resto de la etapa `base` (una tarea por región, en paralelo).
- **Si falla** (autenticación, servicio caído; ECMWF dice que el servicio no es operacional y puede atrasarse): plan Professional de Open-Meteo.

Límite de carga sobre los servidores ArcGIS de CIREN: como mucho 4 peticiones a la vez por host y en todo el job. Esto se logra con 14 tareas que reintentan con espera exponencial, sin semáforo distribuido. Cada respuesta cruda se guarda en `base/raw/` y no se vuelve a pedir.

### Etapa `plan` (1 tarea)

1. Lee los predios elegibles y la referencia de secano de las 14 regiones.
2. Busca en STAC **por tile** (`grid:code`), no por bbox de región, las escenas de la temporada 2025-26 con `eo:cloud_cover < 40`. Las búsquedas por bbox con `max_items=5000` se cortan a escala nacional. Se queda con los tiles que tocan algún polígono. Descarta los duplicados `_0`/`_1` de la misma pasada y se queda con el de `s2:generation_time` mayor (3,3 % de los ítems).
3. Escribe `plan/poligonos_tile/<tile>.parquet` con `poligono_id`, `tipo` (`predio` o `secano`), `region` y la geometría de cada polígono que toca el tile.
4. Calcula las **secciones ocupadas** de cada tile (ver la etapa `satelite`). Reparte en `N` partes con un reparto codicioso por costo (escenas × secciones ocupadas) de **trozos de tile**: las escenas de cada tile, en orden de fecha, se cortan en trozos contiguos de a lo más ~0,7 del costo medio por parte (y al menos 5 escenas), y cada parte recibe pocos tiles. No se reparte escena por escena porque cada parte arma la máscara de cada tile que toca (unos 6 min con 58.000 polígonos y 121 celdas): esparcir los tiles por todas las partes rehacía esas máscaras en cada tarea y bajó el rendimiento a ~12 escenas por minuto. Las partes se llenan en orden de prioridad de región, así las primeras escenas que terminan son las del centro.
5. Escribe `plan/partes/<k>.jsonl` con los ítems STAC serializados. Las tareas no vuelven a consultar STAC, que ya respondió 502 en las pruebas.

`N` = total de tareas satelitales de todas las regiones de Cloud Run (ver abajo).

### Etapa `satelite` (N tareas)

Medido en la revisión de optimización con la escena real `S2B_19HCD_20260117_0_L2A` y los predios de Z1 y Z2. Los benchmarks están en el scratchpad de la sesión, fuera del repo. **M** = medido; **E** = estimado. Los tiempos de red no se midieron, porque el enlace local a us-west-2 es lento: se midieron bytes y CPU.

Cambio principal en `serie_sentinel2.py`: nuevo modo `--parte k`. Recorre los tiles de la parte; cada tarea procesa sus tiles en orden y cada hilo, una escena. La salida mantiene el esquema actual más una columna `tipo` (`predio` o `secano`). La reflectancia sigue sin offset (D15).

**Secciones: nunca se lee un tile completo.**

- Cada tile se divide en celdas fijas de **512 × 512 píxeles a 20 m** (10,24 km), alineadas al origen del tile. Ese tamaño coincide con el bloque interno del overview de 10 m, de B8A y de SCL. B11 usa bloques de 1.024, que se reutilizan entre celdas vecinas con `GDAL_CACHEMAX=256`.
- Solo se leen las **celdas ocupadas** (las que tocan algún polígono). En 19HBD se salta el 81 % del tile y en 19HCD el 87 % (M).
- A escala nacional el bbox de los predios llega casi al tile completo, porque hay predios de costa a cordillera. Las celdas siguen saltando mar y cordillera: se estima que se salta entre 40 y 60 % del tile en el valle central y más del 80 % en tiles de costa o cordillera (E).
- Se descartaron los clusters de predios (un bbox por grupo): el COG siempre baja bloques completos, y cada bbox arrastra bloques vacíos. En 19HBD leen el 25 % del tile, contra 19 % de las celdas (M).
- Dentro de una escena, las celdas ocupadas se recorren en **tramos horizontales contiguos**: una lectura por tramo y banda, con los datasets abiertos durante toda la escena. La celda no es la unidad entre hilos, porque multiplicaría unas 100 veces las aperturas de archivo y complicaría el reintento.
- **Predios que cruzan celdas:** las etiquetas son globales del tile. Cada celda suma con `np.bincount(lab_celda, w, minlength=n)` sobre acumuladores del tile: `n_dato`, `n_val`, Σndvi, Σndvi² y Σndmi. Al cerrar la escena se calculan las medias y `ndvi_std`. El resultado es exacto, igual al del tile entero.
- **Dos máscaras, predios y secano**, con dos juegos de acumuladores y una sola lectura de bandas. Una máscara conjunta no sirve: 3.640 de los 3.642 polígonos de secano tocan algún predio, y `rasterize` deja ganar al último polígono que dibuja (M).

**Otras optimizaciones, en orden de impacto:**

| # | Cambio | Ganancia | Esfuerzo |
| --- | --- | --- | --- |
| 1 | Celdas de 512 con salto de celdas vacías (arriba) | 3 a 5 veces menos bytes a escala nacional (E); 1,3 a 1,6 veces frente al bbox en Z1 y Z2 (M) | 45–60 min |
| 2 | **SCL primero:** si la celda no tiene píxeles con SCL en {4, 5, 6, 7} sobre polígonos, no se leen las otras bandas. Antes, se cruza la huella con datos del ítem (`item.geometry`) con las celdas | ~30 %: el 26 % de los ítems tiene más de la mitad sin datos y la nubosidad media es 7 % (M) | 15 min |
| 3 | **Quitar la banda verde** (NDWI de McFeeters). Nunca se conectó a M2–M5 (`anomalias.py` usa solo NDVI y NDMI). Promediado por predio es redundante con el NDVI: correlación de −0,96 en 18.219 observaciones de validación, ninguna observación con NDWI > 0 y ningún aporte al AUC sobre NDVI + NDMI (M, con unos 24 positivos detectables). Los tranques son pocos píxeles y se detectan por píxel en M10: `poi_predio.py` lee su propia banda verde para los candidatos. La columna `ndwi` queda en NaN para no romper el esquema | 20 % de bytes (M) y ~15 % de CPU | 5 min |
| 4 | **Tareas de 2 vCPU y 4 GiB con 10 hilos**, en vez de 4 vCPU: el cálculo en numpy satura con 4 hilos por el GIL (9,4 → 15,2 MPix/s con 4 hilos; baja a 8,7 con 8) (M) | 1,5 a 2 veces más CPU útil (E) | 5 min |
| 5 | **GDAL:** `GDAL_HTTP_MERGE_CONSECUTIVE_RANGES=YES` (15–20 %, M), `GDAL_HTTP_MAX_RETRY=5` y `GDAL_HTTP_RETRY_DELAY=2` (reintenta el bloque, no la escena), `GDAL_CACHEMAX=256`. `MULTIRANGE` ya está en paralelo por defecto; `GDAL_NUM_THREADS`, `VSI_CACHE` y HTTP/2 no aportan (S3 sirve HTTP/1.1) | 15–20 % | 5 min |
| 6 | Descartar los duplicados `_0`/`_1` en `plan` | 3,3 % (M) | 5 min |
| 7 | **Reparto por trozos de tile**, no por escena: cada parte toca 1 a 6 tiles y arma cada máscara una vez | evita rehacer máscaras de tiles pesados en cada tarea (el reparto por escena bajó el rendimiento a ~12 escenas por minuto) | 30 min |
| 7 | **Calcular solo sobre píxeles de polígono:** `sel = np.flatnonzero(lab)` en uint16 antes de pasar a float | ~5 veces menos CPU con 6 a 20 % de cobertura (E); no gana con cobertura total (M) | 15 min |

Se mantiene la lectura de las bandas de 10 m con `out_shape` a 20 m y `Resampling.average`: GDAL usa el overview de 20 m (393 KB por bloque contra 1,41 MB a resolución nativa), y el overview es el promedio 2×2 exacto, con una diferencia máxima de 0,5 DN (M).

Se descartaron:

- **Asignar cada predio a un solo tile en el solape:** ahorra 10 a 17 %, pero pierde fechas cuando el tile asignado viene sin datos. Se mantiene la regla actual: queda la escena con más píxeles válidos.
- **odc-stac y stackstac:** usan el mismo GDAL y leen el bbox completo.
- **Correr en AWS us-west-2:** solo vale si el piloto mide menos de ~30 MB/s por tarea desde GCP.
- **Google Earth Engine:** pide registrar el proyecto y reescribir D15, la máscara SCL y el caché.
- **Sentinel-2 público de GCP:** JP2 en SAFE, no COG; más lento de leer por ventanas.

**Memoria.** Hoy se van unos 4 GB por hilo por dos razones: `tiles` guarda la máscara int32 de cada tile (hasta 120 MB) sin liberarla, y `astype("float64")` sobre 30 Mpx crea temporales de 240 MB por arreglo. Con celdas y tiles procesados en orden, liberando al cambiar de tile, se estima ~50 MB por hilo.

**Salida y registro.** `s2/cache/<tile>/<escena_id>_chile_v2.parquet` al terminar cada escena; una escena interrumpida se rehace completa. La tarea registra en su log, cada 2 minutos, las escenas hechas, los MB/s, los segundos por escena y la memoria.

**Configuración.**

- **Bandas:** rojo, NIR, NIR08, SWIR16 y SCL, a 20 m vía overview.
- **Lectura:** celdas de 512 en tramos, SCL primero y salto por huella STAC.
- **Tareas de Cloud Run:** 2 vCPU y 4 GiB, 10 hilos. Con la cuota de 20 vCPU y 40 GiB son 10 tareas por región.
- **Job:** `caudal-chile-satelite` (`ETAPA=satelite`, `HILOS=10`, 6 h, 2 reintentos), el mismo job en `us-west1`, `us-west2` y `us-west4`, con `PARTE_BASE` 0, 10 y 20. `us-central1` se liberó el 22-11 para desplegar `caudal-web` y `caudal-api`. En `us-west3` el proyecto no tiene cuota de Cloud Run ("Project failed to initialize in this region due to quota exceeded"). Las partes 30 a 39 se corren como una segunda ejecución en la primera región que se libere: `gcloud run jobs execute caudal-chile-satelite --region <r> --tasks 10 --update-env-vars "^;^ETAPA=satelite;CORRIDA=chile-2025-26;PARTE_BASE=30"`.
- **Cuota:** al inicio (H0) se pide subir la de `us-west1` a 200 vCPU y 400 GiB. Si se aprueba, se relanza solo ahí con más tareas: el plan se rehace con el nuevo `N` y el caché evita repetir escenas.

**Estimación (E).** Unos 57 MB y 1,6 s de CPU por escena, contra 228 MB y 6 s del código actual sobre el tile completo (M para los 228 MB). Para 3.500 escenas son ~200 GB y ~1,6 horas de CPU. Contando el arranque, la rasterización y los reintentos, la corrida toma **20 a 40 min en 4 regiones**, o **1 a 1,5 horas solo en us-west1**. El **piloto** (H2: 1 tile, 1 tarea, desde Cloud Run) mide los MB/s y los segundos por escena antes de fijar `N`.

### Recorrido de la data Sentinel-2

De la fuente a los modelos, en orden:

| Paso | Dónde | Qué entra | Qué sale |
| --- | --- | --- | --- |
| 0. Fuente | Earth Search (AWS us-west-2) | Catálogo STAC `sentinel-2-l2a` y COG públicos en `s3://sentinel-cogs` (sin credenciales: `AWS_NO_SIGN_REQUEST=YES`) | — |
| 1. Polígonos | `base` | Predios CIREN y secano CONAF de cada región | `base/predio/region=RXX.parquet`, `base/referencia_secano/region=RXX.parquet` |
| 2. Plan | `plan` | Polígonos de las 14 regiones + búsqueda STAC por tile | `plan/escenas.parquet` (qué escenas existen), `plan/poligonos_tile/<tile>.parquet` (qué polígonos y celdas lee cada tile), `plan/partes/<k>.jsonl` (ítems STAC de cada tarea) |
| 3. Lectura | `satelite` | Una parte: sus tiles, sus escenas y las 5 bandas de las celdas ocupadas | `s2/cache/<tile>/<escena_id>_chile_v2.parquet`: una fila por polígono con píxeles en esa escena |
| 4. Serie por región | `prediccion`, etapa `region`, paso 1 | Los parquet de escena de los tiles que tocan la región (desde `plan/poligonos_tile`) | `modelo/<corrida>/region=RXX/serie.parquet` y `serie_referencia.parquet` |
| 5. Modelos | `prediccion`, pasos 2 a 6 | `serie.parquet` → `anomalias.py --serie` y `consumo_fao56.py --serie`; `serie_referencia.parquet` → `anomalias.py --referencia` y `consumo_fao56.py --serie-referencia` | Anomalías, señal, consumo y puntaje |

**Esquema del parquet de escena (paso 3).** Son las columnas actuales de `serie_predio_elegibles_2025-26.parquet` sin `zona` y con dos columnas nuevas:

- `poligono_id` (int64) y `tipo` (`predio` o `secano`);
- `tile`, `escena_id`, `fecha`, `ndvi`, `ndwi` (NaN), `ndmi`, `ndvi_std`, `nubosidad_pct`, `n_pix_validos`, `n_pix_total`, `nubes_escena_pct`.

La zona no va en el parquet de escena, porque un tile puede cruzar dos regiones. La región se asigna en el paso 4, desde el polígono.

**Ids únicos a nivel nacional.** Hoy el secano usa su `ref_id` en la columna `predio_id`. En Z1 y Z2 los ids de predios y de secano no se repiten (M), pero con 14 capas regionales nada garantiza que no choquen. Reglas:

- `predio_id` sigue siendo el `mslink` de CIREN. En `base` se verifica que sea único entre las 14 capas; si no lo es, la tarea falla.
- `ref_id` nacional = número de región × 10⁸ + `objectid` de CONAF.
- La columna `tipo` separa predios de secano en todo el recorrido.

**Paso 4, la serie por región.**

1. Lee los tiles de la región desde `plan/poligonos_tile` y, de cada uno, sus parquet de escena. Son del orden de 10 a 20 tiles y unos 1.000 archivos por región, que se leen en paralelo con hilos a través del montaje.
2. Filtra los predios de la región y el secano de la región más su buffer de 10 km. El secano de las regiones vecinas ya está en el caché, porque la lectura es por tile y no por región.
3. Renombra `poligono_id` a `predio_id` y agrega `zona = RXX`. Queda el mismo esquema que leen hoy `anomalias.py` y `consumo_fao56.py`, así que los modelos no cambian.
4. Quita duplicados por `(predio_id, fecha)` y deja la escena con más píxeles válidos. Es la regla actual para los predios que caen en dos tiles el mismo día.

**Control de completitud antes del paso 4.** Para cada región se cuentan las escenas de `plan/escenas.parquet` en sus tiles y los parquet que ya están en `s2/cache`.

- Si falta más del 2 %, la tarea de la región espera hasta 30 minutos y luego falla con la lista de escenas faltantes. Para recuperarlas se relanza `satelite` con las mismas partes: el caché salta lo que ya está.
- Las escenas descartadas (sin píxeles válidos sobre polígonos) dejan igual un parquet vacío. Así "falta" significa siempre "no se procesó".

### Año completo en Valparaíso

Decidido el 22-11: **Valparaíso (R05) extrae la serie Sentinel-2 del año completo**, de abril de 2025 a hoy. Las otras 13 regiones siguen solo con la temporada seca (diciembre a marzo). El objetivo es medir el consumo de todo el año y mostrar en la ficha escenas recientes (la última limpia sobre Z1 y Z2 es del 13-11-2026), sin tocar el ranking.

- **Configuración:** `data/regiones.json` le da a R05 `"periodo_satelite": {"inicio": "2025-04-01", "fin": "hoy"}` (lo agrega `regiones.py`, en `PERIODO_SATELITE`). `plan.py` busca, para cada tile que toca una región con `periodo_satelite`, la unión de ese período con la temporada; `"hoy"` se resuelve al planificar. Los tiles de Valparaíso también cubren partes de la Metropolitana y de O'Higgins: esos polígonos quedan con el año completo en el caché, pero no se usan.
- **El ranking no cambia:** la etapa `region` recorta la serie a la temporada (`cfg["temporada"]`) antes de M1–M5, en todas las regiones. Los umbrales de M7 y la validación (lift 2,6×) se calcularon con el verano y siguen valiendo.
- **Salidas nuevas** (solo R05): `modelo/<corrida>/region=R05/serie_anual.parquet` y `serie_referencia_anual.parquet`, con el mismo esquema que `serie.parquet`.
- **Costo:** unas 3 veces más escenas en los tiles de Valparaíso, unos 12 meses contra 4.
- **Pendiente para usar la serie anual** (todavía no lo hace ningún script):
  - **M4, consumo anual con NDVI observado:** hoy de abril a noviembre se extrapola con el Kc del verano. Con la serie anual, cada mes usaría su propio Kc. Hace falta extender el clima de R05 hasta noviembre de 2026; `base` lo baja solo hasta el 31-03-2026 (`periodo` en `regiones.json`).
  - **La ficha:** la serie hasta noviembre de 2026 y la última escena limpia, rotulada aparte de "temporada analizada".
  - **Experimento, no para la demo:** pesar cada fecha de M3 por el déficit hídrico de los 30 días previos (ET0 menos lluvia), en vez de usar solo la temporada. Se adopta solo si mejora el AUC con los 159 predios de validación.
- **Rehacer el plan:** `plan` no se repite si `plan/escenas.parquet` existe. `REHACER_PLAN=1 scripts/cloud/chile/ejecutar.sh plan` lo rehace. No se debe rehacer con tareas `satelite` corriendo, porque reescribe `plan/partes/`.


## Job 2: `caudal-chile-prediccion`

Recursos: 8 vCPU, 32 GiB, `--task-timeout 3h`, `--max-retries 1`, us-west1. Parte cuando termina la etapa satelital, y la cuota ya quedó libre.

### Etapa `region` (14 tareas)

Cada tarea toma una región. Lee los polígonos de su región y, para los vecindarios, los de un **buffer de 10 km** de las regiones vecinas (las referencias de secano de M2 y los derechos ajenos a 500 m de M5). Luego corre los scripts actuales, sin cambiar las reglas, con `CAUDAL_DATA` apuntando a una carpeta de trabajo local armada desde `/datos`:

1. **Serie:** arma `serie` (predios) y `serie_referencia` (secano) desde el caché de escenas. Detalle en [Recorrido de la data Sentinel-2](#recorrido-de-la-data-sentinel-2), paso 4.
2. **M1** `ventana_seca.py` sobre las celdas de la región.
3. **M2** `anomalias.py` con la referencia CONAF real (radio 10 km, k 30, escala mínima 0,05).
4. **M3** `detector_riego.py` con los umbrales de M7 (2,5; 1,5; 0,7).
5. **M4** `consumo_fao56.py` con `--serie-referencia`.
6. **M5** `indice_sospecha.py`. El percentil de intensidad y `rank_zona` son por región. Se agrega la columna `aplicabilidad`, y la banda alta se limita como dice [Regiones](#regiones-configregionesjson).
7. **Exportación web** (`frontend-demo/scripts/build_m5_web.py` generalizado a región): `scores.lite.json` y `predios.geojson` de las bandas alta y media (geometría simplificada a 5 m), y `series/` en bloques. El resto va solo como conteo.

Salidas en `modelo/<corrida>/region=RXX/` y `web/<corrida>/RXX/`.

**Comprobación de regresión (obligatoria antes de publicar):** los predios de Z1 y Z2 calculados en la corrida nacional se comparan con `data/processed/puntaje.parquet`. Diferencias esperadas: el percentil ahora es regional y la serie cambia algo por la nueva elección de escena en los bordes de tile. Criterio: al menos 90 % de coincidencia de banda y los 10 casos de validación con la misma banda. Si no se cumple, no se publica `web/ACTUAL`.

### Etapa `nacional` (1 tarea)

- `puntaje_chile.parquet` con `rank_nacional`, ordenado por banda, aplicabilidad y puntaje.
- `web/<corrida>/resumen.json` por región: predios elegibles, conteo por banda, aplicabilidad y m³ de exceso central de los de banda alta. También `index.json` con el bbox de cada región para el mapa.
- Escribe `web/ACTUAL` al final, solo si pasó la comprobación de regresión. Es el único "despliegue" de datos.

## Frontend

- `caudal-web` monta el bucket en `/usr/share/nginx/html/data/chile` (solo lectura). nginx lee `data/chile/web/ACTUAL` y redirige `data/chile/actual/*` a `data/chile/web/<corrida>/*`. El JS solo conoce `data/chile/actual/`.
- Vista nacional: las regiones coloreadas por candidatos de banda alta. Al hacer clic en una región se carga su `scores.lite.json` con el mismo código de `zona-data.js`, cambiando `ROOT`.
- Las regiones `sur_humedo` llevan la etiqueta "exploratorio: modelo calibrado en clima de verano seco".
- Z1 y Z2 siguen como están en la demo (datos en la imagen). La vista nacional es una capa adicional y no reemplaza el guion de [pitch-demo.md](pitch-demo.md).
- `sw.js`: no guardar en caché `data/chile/actual/` sin revalidar.

## Código a escribir

| Archivo | Qué |
| --- | --- |
| `scripts/comun/rutas.py` | `DATA` desde `CAUDAL_DATA` (por defecto `data/` del repo) y zonas desde `CAUDAL_ZONAS` (por defecto `data/zonas.json`). Reemplaza `DATA = RAIZ / "data"` en todos los scripts. Es un cambio mecánico y en local todo sigue igual |
| `scripts/cloud/chile/regiones.py` | Genera `config/regiones.json` (tabla de arriba + comunas y bbox desde CIREN) |
| `scripts/cloud/chile/entrada.py` | Despacha la `ETAPA` y la tarea a los scripts y arma la carpeta de trabajo desde `/datos` |
| `scripts/cloud/chile/plan.py` | Etapa `plan` |
| `infra/` (Terraform) | Bucket, cuenta de servicio, permisos, secreto `CDS_API_KEY`, solicitud de cuota y los jobs (`datos`, `satelite` en 4 regiones, `prediccion`) con volúmenes. Ver [`infra/README.md`](../infra/README.md) |
| `infra/imagen/` | Dockerfile, dependencias fijadas, `cloudbuild.yaml` y `construir.sh`: la imagen de los jobs en Artifact Registry |
| `scripts/cloud/chile/ejecutar.sh ETAPA [TAREAS]` | Lanza una etapa (en las 4 regiones si es `satelite`) |
| `scripts/cloud/chile/progreso.sh` | Escenas del plan contra escenas en caché, tareas terminadas por etapa, últimas líneas de log |
| Extractores (tabla de la etapa base) | Parametrizar capa, archivo y bbox por región; paginar |
| `serie_sentinel2.py` | Modo `--parte`, celdas de 512 con salto de vacías y nubladas, sin banda verde, dos máscaras (predios y secano) con acumuladores por tile, GDAL afinado |
| `scripts/extract/d2_clima_era5land.py` | Lectura de ERA5-Land ARCO geo-chunked, paso a diario y ET0 FAO-56 |
| `indice_sospecha.py` | Columna `aplicabilidad` y límite de la banda alta |
| `frontend-demo/scripts/build_m5_web.py` | Parámetro de región y salida a `web/<corrida>/` |
| `frontend-demo/js/*`, `nginx.conf.template` | Vista nacional y redirección de `actual/` |

## Plan de 12 horas

H0 es el inicio. Las horas son de reloj y hay tareas en paralelo.

| Hora | Infra (Gabi) | Datos | Modelos y web |
| --- | --- | --- | --- |
| H0–H1 | `terraform apply` (ya incluye la solicitud de cuota), crear la cuenta de CDS y aceptar la licencia de ERA5-Land, piloto de ERA5-Land, montaje probado con un job de prueba | `rutas.py`, `regiones.py`, paginación de `predios_ciren.py` | Revisar M2 a M5 en busca de supuestos de Z1 y Z2 y bucles por predio |
| H1–H2 | `entrada.py`, imagen de los jobs (`infra/imagen/`), `ejecutar.sh` | Resto de los extractores; **lanzar `base`** apenas estén predios, CONAF y derechos | Columna `aplicabilidad` |
| H2–H3 | `plan.py`, `progreso.sh` | Cambios de `serie_sentinel2.py`; **piloto** de 1 tile: segundos por escena y memoria | `build_m5_web.py` por región |
| H3–H5 | **Lanzar `satelite`** en 4 regiones | Revisar el clima de `base` (cobertura de celdas, corrección DMC) | Etapa `region` probada con Valparaíso cuando termine su satélite |
| H5–H7 | — | — | **Lanzar `prediccion` (`region`)**, comprobación de regresión, etapa `nacional` |
| H7–H9 | Montar el bucket en `caudal-web` | — | Vista nacional en el frontend |
| H9–H12 | Holgura | P1 si sobra tiempo | Revisión de candidatos por región, textos de aplicabilidad |

Puntos de corte para no quedar sin nada:

- **H5:** si `satelite` no terminó, la predicción corre con las regiones de prioridad 1 que estén completas (Coquimbo a Maule).
- **H8:** si la vista nacional no está, se muestra `resumen.json` como tabla en el panel de impacto.

## P1 (si sobra tiempo)

- **POI (M10)** para los predios de banda alta, con el job `caudal-poi` actual y una lista `--predios` por región. Con unos 5 s de CPU por predio no se puede correr sobre todos los elegibles.
- **Ruta (M8)** por región para los 40 primeros. El servidor público de OSRM limita la frecuencia de consultas: una región a la vez.
- Escena reciente (octubre y noviembre de 2026) para la ficha. Ojo con las lluvias de octubre ([data/README.md](../data/README.md)).

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Los servidores ArcGIS de CIREN se caen o limitan con 14 tareas a la vez | Reintentos con espera exponencial, caché de respuestas crudas en `base/raw/` y paginación chica (2.000) si hay errores 500 |
| Earth Search devuelve 502 (ya pasó) | El STAC se consulta una sola vez, en `plan`; las lecturas de COG van directo a S3 con reintentos por escena |
| No aprueban la cuota de Cloud Run | 4 regiones con la cuota por defecto alcanzan según la estimación |
| La memoria por hilo sale mayor que la estimada | El piloto la mide antes de lanzar; se bajan `HILOS` o se sube la memoria por tarea |
| El ARCO de ECMWF se atrasa o falla (no es un servicio operacional) | Piloto en H1; si falla, plan Professional de Open-Meteo con el código actual |
| GCS FUSE con escrituras concurrentes | Un archivo por escena, región o tarea; escribir en `/tmp` y copiar; nunca append |
| `task-timeout` por defecto (10 min) | Fijarlo en el despliegue: 6 h en datos y 3 h en predicción |
| Resultados poco confiables en el sur | `aplicabilidad`, la banda alta limitada y la etiqueta "exploratorio" en la web |
| Datos personales | `derecho_titulares` queda solo en `base/` y nunca entra a `web/`. La web exporta solo las bandas alta y media, sin nombres, igual que hoy |
| Licencia CIREN | El bucket es privado; la web publica lo mismo que hoy (polígonos simplificados de candidatos) |

## Decisiones

1. **Sur (Ñuble a Aysén): decidido.** Entra en los datos y en la predicción, y la web lo muestra como "exploratorio".
2. **Fuente de clima: decidido, ERA5-Land ARCO geo-chunked de ECMWF.** Ver [Clima](#clima-era5-land-arco-geo-chunked).
   - **Respaldo:** el plan Professional de Open-Meteo (unos USD 99 al mes; el Standard no incluye la API histórica), con el código actual más `apikey`.
   - **Descartadas:**
     - el ARCO-ERA5 de GCS (`gs://gcp-public-data-arco-era5`): está dividido por hora, así que para series largas obliga a leer el globo entero en cada hora, y además va a 0,25°;
     - CR2MET: publicado solo hasta 2021;
     - Agromet INIA: no tiene API;
     - NASA POWER: 0,5° y un punto por llamada.
   - **Corrección con estaciones DMC:** se mantiene, porque el reanálisis sobreestima la lluvia en Chile central. La lluvia también se puede contrastar con CHIRPS v3 (0,05°, descarga HTTP sin cuenta).
3. **Bucket en us-west1: decidido.** La E/S pesada es de los jobs. Si la latencia de la web molesta, se agrega `proxy_cache` en nginx; no hace falta mover el bucket.
