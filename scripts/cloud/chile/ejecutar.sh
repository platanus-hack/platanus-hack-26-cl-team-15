#!/usr/bin/env bash
# Lanza una etapa de la corrida nacional en su Cloud Run Job (los jobs los crea Terraform, infra/).
# Uso: scripts/cloud/chile/ejecutar.sh ETAPA [TAREAS]
#   base      caudal-chile-datos, 14 tareas (una por región)
#   plan      caudal-chile-datos, 1 tarea
#   satelite  caudal-chile-satelite en us-west1, us-west2 y us-west4, 10 tareas por región (PARTE_BASE ya
#             viene en la definición de cada job: 0, 10 y 20; las partes 30 a 39 se lanzan aparte con
#             PARTE_BASE=30, ver docs/spec-chile.md); TAREAS es por región
#   region    caudal-chile-prediccion, 14 tareas
#   nacional  caudal-chile-prediccion, 1 tarea
# Variables opcionales (se pasan al job con --update-env-vars): CORRIDA (por defecto la fecha), REGIONES, PARTES, HILOS,
# REHACER_PLAN=1 (rehace plan/ aunque exista).
set -euo pipefail
PROYECTO=${PROYECTO:-ph-26-caudal}
CUENTA=${CUENTA:-gacuna.latam.challenge@gmail.com}
ETAPA=${1:?uso: ejecutar.sh base|plan|satelite|region|nacional [TAREAS]}
CORRIDA=${CORRIDA:-$(date +%Y%m%d)}
g() { gcloud --project="$PROYECTO" --account="$CUENTA" "$@"; }

# Separador ";" (sintaxis ^;^ de gcloud): REGIONES lleva comas (R04,R05) y con "," gcloud no la parsea.
ENV="^;^ETAPA=$ETAPA;CORRIDA=$CORRIDA"
for v in REGIONES PARTES HILOS REHACER_PLAN; do
  if [ -n "${!v:-}" ]; then ENV="$ENV;$v=${!v}"; fi
done

ejecutar() {  # job región tareas
  echo "-> $1 en $2: $3 tareas ($ENV)"
  g run jobs execute "$1" --region="$2" --tasks="$3" --update-env-vars="$ENV" --async
}

case "$ETAPA" in
  base)     ejecutar caudal-chile-datos us-west1 "${2:-14}" ;;
  plan)     ejecutar caudal-chile-datos us-west1 "${2:-1}" ;;
  satelite) for r in us-west1 us-west2 us-west4; do ejecutar caudal-chile-satelite "$r" "${2:-10}"; done ;;
  region)   ejecutar caudal-chile-prediccion us-west1 "${2:-14}" ;;
  nacional) ejecutar caudal-chile-prediccion us-west1 "${2:-1}" ;;
  *) echo "etapa desconocida: $ETAPA" >&2; exit 1 ;;
esac
echo "corrida: $CORRIDA (la usan region y nacional); seguimiento: scripts/cloud/chile/progreso.sh"
