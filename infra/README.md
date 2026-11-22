# Infraestructura (Terraform)

Infraestructura de la corrida nacional de [spec-chile.md](../docs/spec-chile.md) en el proyecto `ph-26-caudal`. Terraform crea solo recursos **nuevos**; no toca el bucket `ph-26-caudal-sentinel2`, el job `caudal-poi` ni el servicio `caudal-web`.

## Estructura

```
infra/
├── bootstrap/
│   └── estado.sh            bucket del estado remoto (ph-26-caudal-tfstate); se corre una vez
├── imagen/                  imagen Docker de los jobs
│   ├── Dockerfile           Python 3.12, dependencias fijadas y el código en /app
│   ├── requirements.in      dependencias directas; requirements.txt es la versión fijada
│   ├── cloudbuild.yaml      build y prueba de humo en Cloud Build
│   └── construir.sh         construye con la etiqueta del commit actual
├── entornos/
│   └── prod/                raíz de Terraform: aquí se corre init, plan y apply
│       ├── main.tf          compone los módulos
│       ├── variables.tf     parámetros del entorno (proyecto, regiones, corrida, cuota)
│       ├── outputs.tf       bucket, cuenta de servicio, jobs y comandos de ejecución
│       ├── providers.tf     proveedor google
│       ├── versions.tf      versión de Terraform y del proveedor, backend GCS
│       └── moved.tf         migración del estado desde la versión sin módulos
└── modulos/                 un módulo por responsabilidad (main, variables, outputs, versions)
    ├── apis/                APIs del proyecto (disable_on_destroy = false: nunca se deshabilitan)
    ├── identidad/           cuenta de servicio caudal-jobs
    ├── almacenamiento/      bucket ph-26-caudal-chile y sus permisos (jobs escriben, caudal-web lee)
    ├── secretos/            secreto CDS_API_KEY (valor provisorio PENDIENTE) y acceso de caudal-jobs
    ├── artefactos/          repositorio caudal-jobs de Artifact Registry y sus permisos
    ├── jobs/                Cloud Run Jobs de datos, satélite (3 regiones) y predicción
    └── cuota/               solicitud de cuota de Cloud Run en us-west1 (opcional)
```

## Qué crea

- Bucket `ph-26-caudal-chile` (us-west1, acceso uniforme, acceso público prohibido, sin versionado).
- Cuenta `caudal-jobs` con `objectAdmin` sobre el bucket y `secretAccessor` sobre el secreto. La cuenta con la que corre `caudal-web` recibe `objectViewer` del bucket.
- Secreto `CDS_API_KEY` con una versión provisoria `PENDIENTE`.
- Los jobs de la tabla y, si se pasa `correo_contacto`, la solicitud de 200 vCPU y 400 GiB de Cloud Run en us-west1.

| Job | Región | Recursos | Timeout | Reintentos | `ETAPA` |
| --- | --- | --- | --- | --- | --- |
| `caudal-chile-datos` | us-west1 | 4 vCPU, 8 GiB | 6 h | 2 | `base` (también `plan`) |
| `caudal-chile-satelite` | us-west1, us-west2, us-west4 | 2 vCPU, 4 GiB | 6 h | 2 | `satelite` (`HILOS=10`, `PARTE_BASE` = 0, 10, 20; las partes 30 a 39 van en una segunda ejecución) |
| `caudal-chile-prediccion` | us-west1 | 8 vCPU, 32 GiB | 3 h | 1 | `region` |

Todos usan la imagen `us-west1-docker.pkg.dev/ph-26-caudal/caudal-jobs/pipeline:<version>` (ver [Imagen de los jobs](#imagen-de-los-jobs)), corren como `caudal-jobs` en gen2 y montan el bucket en `/datos` (caché de metadatos de 600 s). Variables de entorno: `CAUDAL_DATA=/datos`, `CORRIDA`, `ETAPA`, `HILOS` y `PARTE_BASE` (solo satélite), más `CDS_API_KEY` desde Secret Manager.

## Uso

Requisitos: `terraform` >= 1.6 y `gcloud` con acceso al proyecto.

```bash
# 1. Una sola vez: bucket del estado (no está en git)
infra/bootstrap/estado.sh

# 2. Credenciales (ADC, o un token de la cuenta del equipo)
gcloud auth application-default login
# alternativa: export GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token --account <cuenta>)

# 3. Aplicar (siempre con el correo de contacto: sin él, el plan borra la solicitud de cuota)
cd infra/entornos/prod
export TF_VAR_correo_contacto=<correo>
terraform init
terraform plan
terraform apply
```

La primera vez, la API de Resource Manager debe estar habilitada para que el proveedor lea el estado de las demás. Si `apply` falla por eso, corre `terraform apply -target='module.apis.google_project_service.apis["cloudresourcemanager.googleapis.com"]'` y después `terraform apply` completo.

El estado remoto vive en `gs://ph-26-caudal-tfstate` (prefijo `chile`, versionado). No se commitean estados, `.terraform/` ni `*.tfvars`; el único secreto, la clave de CDS, no pasa por Terraform. El `.terraform.lock.hcl` sí se commitea para fijar la versión del proveedor.

### Variables

Ver `entornos/prod/variables.tf`; todas tienen valor por defecto salvo que se indique. Las útiles:

| Variable | Para qué |
| --- | --- |
| `corrida` | Valor de `CORRIDA` (por defecto `chile-2025-26`) |
| `regiones_satelite` | Regiones de la etapa satelital y su `PARTE_BASE` |
| `correo_contacto` | Correo que Google exige para pedir cuota. Sin él no se pide. Se pasa con `TF_VAR_correo_contacto=...` para no guardarlo en git |

## Imagen de los jobs

El código y las dependencias van dentro de la imagen: un cambio de código es una imagen nueva y un `apply`.

```bash
# 1. Construir (desde develop, con el árbol limpio): etiqueta = commit corto
infra/imagen/construir.sh

# 2. Apuntar los jobs a esa versión
cd infra/entornos/prod
terraform apply -var version_imagen=<commit>
```

- `construir.sh` corre `gcloud builds submit` con `cloudbuild.yaml`. El build tiene una prueba de humo: importa las bibliotecas con partes nativas (rasterio, shapely, pyproj) y comprueba que `entrada.py` esté en `/app`.
- `.gcloudignore`, en la raíz del repo, sube a Cloud Build solo lo que copia el Dockerfile (unos 40 archivos), no los datos ni el frontend.
- Para cambiar dependencias se edita `requirements.in` y se regenera el archivo fijado: `uv pip compile infra/imagen/requirements.in --python-version 3.12 --python-platform x86_64-manylinux_2_28 -o infra/imagen/requirements.txt`.
- El repositorio guarda las 10 imágenes más recientes y borra las de más de 7 días.

## Pendientes manuales

**Clave de CDS.** Terraform deja `PENDIENTE` como valor inicial y no vuelve a tocar el secreto. Para cargar la clave real:

```bash
printf '%s' "<token>" | gcloud secrets versions add CDS_API_KEY --data-file=- --project ph-26-caudal
```

Los jobs leen la versión `latest`, así que no hay que redesplegar.

**Cuota.** Con `correo_contacto`, Terraform registra dos preferencias (`CpuAllocPerProjectRegion` = 200000 milli-vCPU y `MemAllocPerProjectRegion` = 429496729600 bytes en us-west1). Es solo una solicitud: Google la aprueba de forma asíncrona, o no. Estado:

```bash
gcloud beta quotas preferences list --project ph-26-caudal
```

Mientras no se apruebe, rige el límite por defecto de 20 vCPU y 40 GiB por región, que es lo que asume el reparto en 3 regiones.

**Montar el bucket en `caudal-web` (decisión pendiente).** Terraform no modifica el servicio. Los permisos de lectura ya están dados. Para montarlo (esto crea una revisión nueva):

```bash
gcloud run services update caudal-web --region us-central1 --project ph-26-caudal \
  --add-volume name=chile,type=cloud-storage,bucket=ph-26-caudal-chile,readonly=true,mount-options=metadata-cache-ttl-secs=600 \
  --add-volume-mount volume=chile,mount-path=/usr/share/nginx/html/data/chile
```

Montar GCS requiere el entorno gen2 (`--execution-environment gen2`). Además, el `Dockerfile` y la configuración de nginx de `frontend-demo/` tendrán que servir `data/chile/` (por ejemplo, la redirección de `data/chile/actual/*` a `data/chile/web/<corrida>/*` que describe la spec) y no copiar una carpeta `data/chile` propia sobre el punto de montaje. Para revertir: `--remove-volume-mount chile --remove-volume chile`.

## Ejecutar cada etapa

`terraform output comandos_ejecucion` imprime estos comandos. `execute` no cambia los recursos del job, y cada etapa tiene su propio job, así que basta con `--tasks` y `--update-env-vars`.

```bash
P="--project ph-26-caudal"

# Plan y base (job de datos, us-west1)
gcloud run jobs execute caudal-chile-datos --region us-west1 $P --tasks 1  --update-env-vars ETAPA=plan
gcloud run jobs execute caudal-chile-datos --region us-west1 $P --tasks 14 --update-env-vars ETAPA=base

# Satélite: N = 40 partes. 10 tareas en cada una de las 3 regiones (partes 0 a 29); las 30 a 39, después, con
# --update-env-vars "^;^ETAPA=satelite;PARTE_BASE=30" en la primera región que se libere
for r in us-west1 us-west2 us-west4; do
  gcloud run jobs execute caudal-chile-satelite --region $r $P --tasks 10 --update-env-vars ETAPA=satelite
done

# Predicción por región (14 regiones)
gcloud run jobs execute caudal-chile-prediccion --region us-west1 $P --tasks 14 --update-env-vars ETAPA=region
```

Con la cuota ampliada se pueden lanzar más tareas, por ejemplo `--tasks 100 --parallelism 100` en `us-west1` (el plan se rehace con el nuevo `N`).

## Destruir

`terraform destroy` borra solo lo creado aquí (el bucket falla si tiene objetos; vaciarlo antes es una decisión explícita). Las APIs quedan habilitadas.
