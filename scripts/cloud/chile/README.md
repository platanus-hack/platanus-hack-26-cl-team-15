# Corrida nacional (código de los Cloud Run Jobs)

Código de la extensión a todo Chile de [docs/spec-chile.md](../../../docs/spec-chile.md). La infraestructura (bucket,
jobs, cuenta de servicio, secreto) la crea Terraform en [infra/](../../../infra/README.md); aquí está lo que corre
dentro de los jobs. Los jobs usan la imagen del repositorio, con `/app` = este repo recortado y `ENTRYPOINT`
`python /app/scripts/cloud/chile/entrada.py`; el bucket `ph-26-caudal-chile` va montado en `/datos`.

| Archivo | Qué hace |
| --- | --- |
| `regiones.py` | Genera `data/regiones.json` (14 regiones: comunas y bbox desde CIREN, capas de CIREN, CONAF, frutícola y DGA, aplicabilidad y prioridad). Se commitea; la imagen lo lee de `/app/data/regiones.json` |
| `entrada.py` | Punto de entrada. Despacha `ETAPA` y la tarea (`CLOUD_RUN_TASK_INDEX`), arma la carpeta de trabajo desde `/datos`, salta lo ya hecho y copia el log a `logs/` |
| `plan.py` | Etapa `plan`: búsqueda STAC por tile, celdas ocupadas, reparto en N partes |
| `prediccion.py` | Etapas `region` (serie por región, M1 a M5, exportación web) y `nacional` (ranking, resumen, comprobación de regresión, `web/ACTUAL`) |
| `ejecutar.sh ETAPA [TAREAS]` | Lanza una etapa con `gcloud run jobs execute` (`satelite` en las 3 regiones de Cloud Run) |
| `progreso.sh` | Escenas del plan contra escenas en caché, regiones terminadas, últimas ejecuciones y último log |

Fuera de esta carpeta: `scripts/comun/rutas.py` (`CAUDAL_DATA` y `CAUDAL_ZONAS`), `scripts/comun/arcgis.py` (consultas
con reintentos y paginación), `scripts/comun/celdas.py` (celdas de 512 píxeles), `scripts/extract/d2_clima_era5land.py`,
`scripts/extract/serie_sentinel2.py --parte` y `frontend-demo/scripts/build_m5_web.py --region`.

## Orden de las etapas

```bash
scripts/cloud/chile/ejecutar.sh base        # 14 tareas, una por región (caudal-chile-datos)
scripts/cloud/chile/ejecutar.sh plan        # 1 tarea: escenas, polígonos por tile y N = 40 partes
scripts/cloud/chile/ejecutar.sh satelite    # 10 tareas en cada una de 3 regiones (partes 0 a 29, caudal-chile-satelite)
# partes 30 a 39: una segunda ejecución en la primera región libre (ver docs/spec-chile.md, etapa satelite)
CORRIDA=chile-2025-26 scripts/cloud/chile/ejecutar.sh region     # 14 tareas (caudal-chile-prediccion)
CORRIDA=chile-2025-26 scripts/cloud/chile/ejecutar.sh nacional   # 1 tarea
scripts/cloud/chile/progreso.sh
```

`REGIONES=R05,R13 scripts/cloud/chile/ejecutar.sh base 2` limita a algunas regiones (las tareas se numeran dentro de la
lista, así que `TAREAS` debe ser su largo). `PARTES` cambia N (el mismo valor en `plan` y en el total de tareas
satelitales). Cada etapa es idempotente: relanzarla retoma lo que falta.

`plan` no se repite si `plan/escenas.parquet` ya existe: `REHACER_PLAN=1 scripts/cloud/chile/ejecutar.sh plan` lo rehace
(nunca con tareas `satelite` corriendo, porque reescribe `plan/partes/`). Las regiones con `periodo_satelite` en
`data/regiones.json` (hoy solo R05, de abril de 2025 a hoy) traen la serie del año completo; el resto, solo la temporada
seca. Ver [Año completo en Valparaíso](../../../docs/spec-chile.md#año-completo-en-valparaíso).

## Qué deja cada etapa en el bucket

- `base`: `base/<tabla>/region=RXX.parquet` (`predio`, `referencia_secano`, `cultivo`, `derecho`, `derecho_titulares`,
  `canal`, `derecho_predio`, `predio_derecho`, `cauce`, `predio_cauce`, `restriccion`, `predio_restriccion`,
  `fiscalizacion`, `clima`, `predio_clima`), `base/raw/RXX/` (respuestas crudas) y `base/_estado/base-RXX.json`
  al terminar la región. Cada paso se guarda apenas termina: si el clima falla, lo demás queda.
- `plan`: `plan/escenas.parquet`, `plan/poligonos_tile/<tile>.parquet`, `plan/partes/<k>.jsonl`,
  `plan/regiones_tiles.json`.
- `satelite`: `s2/cache/<tile>/<escena_id>_chile_v2.parquet`, uno por escena (vacío si no hubo píxeles válidos).
- `region`: `modelo/<corrida>/region=RXX/*.parquet` (en R05 también `serie_anual.parquet` y `serie_referencia_anual.parquet`; los modelos usan solo la temporada) y `web/<corrida>/RXX/{scores.lite.json,predios.geojson,series/,conteo.json}`.
- `nacional`: `modelo/<corrida>/puntaje_chile.parquet`, `web/<corrida>/{index,resumen,regresion}.json` y
  `web/ACTUAL`, solo si la comprobación de regresión pasa (90 % de coincidencia de banda con `puntaje.parquet` de
  Z1 y Z2 y los 10 casos de validación en la misma banda).

## Clave de ERA5-Land

El paso de clima de `base` necesita `CDS_API_KEY` (cuenta gratuita del CDS con la licencia de ERA5-Land aceptada; la
clave es el token solo, sin `uid:`). Mientras el secreto valga `PENDIENTE`, ese paso falla con un mensaje claro y el
resto de `base` queda guardado:

```bash
printf '%s' "<token>" | gcloud secrets versions add CDS_API_KEY --data-file=- --project ph-26-caudal
scripts/cloud/chile/ejecutar.sh base     # salta los pasos hechos y corre el clima
```

## Verificación local, sin clave ni bucket

```bash
uv run scripts/extract/d2_clima_era5land.py --probar        # ET0 FAO-56 contra el ejemplo 18 y paso a diario
uv run scripts/extract/d2_clima_era5land.py --contrastar    # con la ET0 de Open-Meteo, cuando haya un clima.parquet de ERA5
uv run scripts/cloud/chile/regiones.py --salida /tmp/regiones.json
```

Una etapa completa se prueba apuntando `CAUDAL_DATA` a una carpeta con la estructura del bucket (por ejemplo
`ETAPA=base REGIONES=R11 CAUDAL_DATA=/tmp/datos TRABAJO=/tmp/trabajo python scripts/cloud/chile/entrada.py`).

## Diferencias con el spec

- `satelite` es un job propio (`caudal-chile-satelite`), no una etapa de `caudal-chile-datos`.
- `fiscalizacion` sale por región (`base/fiscalizacion/region=RXX.parquet`), no como un archivo nacional: la zona y el
  vecindario de cada expediente se calculan con los predios de la región.
- Los `mslink` de CIREN no son únicos entre las capas: 98 de 893.011 están en dos regiones vecinas (el mismo predio
  con el mismo rol y comuna). `base` no falla; `plan` y `nacional` dejan uno, el de la primera región.
- Los parquet de escena solo traen polígonos con píxeles válidos; una escena sin ninguno queda vacía.
- Aysén no tiene capa CONAF: `base/referencia_secano/region=R11.parquet` queda vacío y M2 marca `sin_referencia`.
