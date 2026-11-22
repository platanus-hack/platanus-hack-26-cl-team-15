#!/usr/bin/env bash
# Crea o actualiza el monitor diario de escenas Sentinel-2 nuevas: un Cloud Run Job que corre scripts/gcp/monitor_s2.py
# y un Cloud Scheduler que lo lanza todos los días.
#
# Antes, una vez: scripts/gcp/bootstrap.sh (bucket y permiso de la cuenta de servicio de Compute sobre él).
#
# Qué hace (repetirlo no rompe nada; sirve también para subir código o predios nuevos):
#   1. Habilita las APIs de Cloud Run y Cloud Scheduler.
#   2. Empaqueta el código y las entradas (serie_sentinel2.py, scripts/comun, zonas.json, predio.parquet,
#      referencia_secano.parquet, predio_muestra.geojson, fiscalizacion.parquet) en gs://<bucket>/monitor/codigo/app.tgz.
#      predio.parquet no está en git: se sube desde tu copia local.
#   3. Crea o actualiza el job caudal-monitor-s2. Arranca con una imagen pública de Python, instala las dependencias,
#      baja el paquete y corre monitor_s2.py con --destino gs://<bucket>/monitor. Corre con la cuenta de servicio de
#      Compute, que ya escribe en el bucket.
#   4. Crea la cuenta de servicio caudal-monitor-invocador con permiso para lanzar solo ese job.
#   5. Crea o actualiza el Cloud Scheduler caudal-monitor-s2 (HORARIO, en UTC) que llama a la API de Cloud Run.
#
# Uso (desde la raíz del repo, con `gcloud auth login` hecho):
#   scripts/gcp/monitor-s2-deploy.sh                 despliega; la primera corrida será la del horario
#   EJECUTAR=1 scripts/gcp/monitor-s2-deploy.sh      despliega y lo lanza ahora
#   DESDE=2026-11-01 scripts/gcp/monitor-s2-deploy.sh   primera corrida: escenas publicadas desde esa fecha
#       (solo cuenta si todavía no hay gs://<bucket>/monitor/estado.json; por defecto, 15 días atrás)
#   MODOS=elegibles scripts/gcp/monitor-s2-deploy.sh    sin la serie del secano de referencia
#
# Lo que deja en gs://<bucket>/monitor/: estado.json (watermark y escenas procesadas), serie_predio_reciente.parquet
# (7.911 elegibles) y serie_referencia_reciente.parquet (secano), con las columnas de serie_predio_*.parquet.
set -euo pipefail
# shellcheck source=scripts/gcp/config.sh
source "$(dirname "$0")/config.sh"

JOB=${JOB:-caudal-monitor-s2}
# La pasada sobre Z1 y Z2 es a las 14:52 UTC y Earth Search la publica entre 5 y 9 horas después
HORARIO=${HORARIO:-0 3 * * *}
MODOS=${MODOS:-elegibles,referencia}
NUBES_MAX=${NUBES_MAX:-40}
# Cuota de Cloud Run en la región: 20 vCPU y 40 GiB en total (ver scripts/cloud/poi/ejecutar.sh).
# Con --elegibles cada escena en paralelo usa ~4 GB.
CPU_JOB=${CPU_JOB:-4}; MEMORIA_JOB=${MEMORIA_JOB:-16Gi}; HILOS_ESCENAS=${HILOS_ESCENAS:-3}
IMAGEN=${IMAGEN:-mirror.gcr.io/library/python:3.12-slim}
INVOCADOR=caudal-monitor-invocador
SA_INV="$INVOCADOR@$PROJECT.iam.gserviceaccount.com"
DEST="$BUCKET/monitor"
g() { gcloud --project="$PROJECT" "$@"; }

command -v gcloud >/dev/null || falla "falta gcloud (https://cloud.google.com/sdk/docs/install)"
[ -n "$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null)" ] || falla "no hay sesión: corre gcloud auth login"
RAIZ=$(git rev-parse --show-toplevel 2>/dev/null) || falla "corre el script dentro del repo"
cd "$RAIZ"
g storage buckets describe "$BUCKET" >/dev/null 2>&1 || falla "no existe el bucket $BUCKET: corre primero scripts/gcp/bootstrap.sh"

echo "== 1. APIs"
g services enable run.googleapis.com cloudscheduler.googleapis.com iam.googleapis.com

echo "== 2. Código y entradas -> $DEST/codigo/app.tgz"
ENTRADAS=(scripts/gcp/monitor_s2.py scripts/extract/serie_sentinel2.py scripts/comun/rutas.py scripts/comun/celdas.py
          data/zonas.json data/processed/referencia_secano.parquet data/processed/predio_muestra.geojson
          data/processed/fiscalizacion.parquet data/processed/predio.parquet)
for f in "${ENTRADAS[@]}"; do [ -f "$f" ] || falla "falta $f"; done
uv run -q --with pyarrow python -c "
import pyarrow.parquet as pq, sys
sys.exit(0 if 'elegible' in pq.read_schema('data/processed/predio.parquet').names else 1)" \
  || falla "predio.parquet no tiene la columna elegible: regenéralo con scripts/extract/predios_ciren.py"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
tar czf "$TMP/app.tgz" "${ENTRADAS[@]}"
g storage cp "$TMP/app.tgz" "$DEST/codigo/app.tgz"

echo "== 3. Cloud Run Job $JOB ($REGION)"
SA_JOB=$(cuenta_servicio)  # bootstrap.sh le dio roles/storage.objectAdmin en el bucket
EXTRA=""; [ -n "${DESDE:-}" ] && EXTRA=" --desde ${DESDE}T00:00:00Z"
ARRANQUE="apt-get update -qq && apt-get install -y -qq --no-install-recommends libexpat1 >/dev/null \
&& pip install -q --no-cache-dir --root-user-action=ignore 'geopandas>=1.0' pyarrow 'shapely>=2.0' rasterio pystac-client numpy pandas google-cloud-storage \
&& python -c \"from google.cloud import storage; storage.Client().bucket('${BUCKET#gs://}').blob('monitor/codigo/app.tgz').download_to_filename('/tmp/app.tgz')\" \
&& mkdir -p /app && tar xzf /tmp/app.tgz -C /app && cd /app \
&& exec python scripts/gcp/monitor_s2.py --destino $DEST --modos $MODOS --nubes-max $NUBES_MAX$EXTRA"
COMUN=(--region="$REGION" --image="$IMAGEN" --service-account="$SA_JOB" --cpu="$CPU_JOB" --memory="$MEMORIA_JOB"
       --tasks=1 --max-retries=1 --task-timeout=2h --set-env-vars="HILOS_ESCENAS=$HILOS_ESCENAS,PYTHONUNBUFFERED=1"
       --command=bash --args="^|^-c|$ARRANQUE")
if g run jobs describe "$JOB" --region="$REGION" >/dev/null 2>&1; then g run jobs update "$JOB" "${COMUN[@]}"
else g run jobs create "$JOB" "${COMUN[@]}"; fi

echo "== 4. Cuenta de servicio $SA_INV"
g iam service-accounts describe "$SA_INV" >/dev/null 2>&1 \
  || g iam service-accounts create "$INVOCADOR" --display-name="Lanza el job $JOB desde Cloud Scheduler"
for i in 1 2 3 4 5 6; do  # una cuenta recién creada tarda unos segundos en poder recibir permisos
  g run jobs add-iam-policy-binding "$JOB" --region="$REGION" --member="serviceAccount:$SA_INV" \
    --role=roles/run.invoker >/dev/null 2>&1 && break
  [ "$i" -eq 6 ] && falla "no pude dar roles/run.invoker sobre $JOB a $SA_INV"
  sleep 10
done
echo "$SA_INV: roles/run.invoker sobre $JOB"

echo "== 5. Cloud Scheduler $JOB: '$HORARIO' (UTC)"
URI="https://run.googleapis.com/v2/projects/$PROJECT/locations/$REGION/jobs/$JOB:run"
PROG=(--location="$REGION" --schedule="$HORARIO" --time-zone=Etc/UTC --uri="$URI" --http-method=POST
      --oauth-service-account-email="$SA_INV" --attempt-deadline=180s)
if g scheduler jobs describe "$JOB" --location="$REGION" >/dev/null 2>&1; then g scheduler jobs update http "$JOB" "${PROG[@]}"
else g scheduler jobs create http "$JOB" "${PROG[@]}"; fi

if [ "${EJECUTAR:-0}" = 1 ]; then
  echo "== Lanzando $JOB ahora"
  g run jobs execute "$JOB" --region="$REGION" --async
fi

cat <<EOF

Listo. El monitor corre todos los días a las '$HORARIO' (UTC).

Lanzarlo a mano:      gcloud run jobs execute $JOB --region $REGION --project $PROJECT
Últimas ejecuciones:  gcloud run jobs executions list --job $JOB --region $REGION --project $PROJECT --limit 5
Log de la última:     gcloud logging read 'resource.type="cloud_run_job" AND resource.labels.job_name="$JOB"' \\
                        --project $PROJECT --freshness 1d --limit 100 --format 'value(textPayload)' | tac
Estado:               gcloud storage cat $DEST/estado.json | head -20
Bajar las series:     gcloud storage cp $DEST/serie_*_reciente.parquet data/processed/
Pausar el horario:    gcloud scheduler jobs pause $JOB --location $REGION --project $PROJECT
EOF
