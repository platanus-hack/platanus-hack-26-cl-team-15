# Despliegue del frontend en Cloud Run (proyecto `ph-26-caudal`)

Guía para quien usa GCP por primera vez. El proyecto y la facturación ya existen: no crees un proyecto ni pongas una tarjeta.

Cloud Run funciona parecido a Vercel: un comando sube el código, GCP lo construye y te da una URL pública `https://caudal-web-....run.app`. Cada despliegue crea una revisión nueva, y puedes volver a la anterior.

Datos fijos:

| | |
|---|---|
| Proyecto | `ph-26-caudal` |
| Región | `us-central1` para `caudal-web`: ahí está el domain mapping de `caudales.dev` (Cloud Run no admite domain mappings en Santiago). `caudal-api` sigue en `southamerica-west1` (Santiago) |
| Servicio | `caudal-web` |
| Carpeta del frontend | `frontend/` (cámbiala si el frontend está en otra parte) |

## 1. Cuenta (una vez)

1. Si no tienes cuenta de Google, créala en <https://accounts.google.com/signup>. Sirve un Gmail.
2. Mándale tu correo a Gabi. Gabi te da acceso al proyecto.
3. Abre <https://console.cloud.google.com/run?project=ph-26-caudal> con esa cuenta y acepta los términos si te los pide. Si ves la página de Cloud Run, ya tienes acceso.

No actives la prueba gratuita ni crees una cuenta de facturación.

## 2. Herramientas (una vez)

1. Instala `gcloud`: <https://cloud.google.com/sdk/docs/install> (en WSL o Linux, usa las instrucciones de Debian/Ubuntu).
2. Inicia sesión y fija el proyecto:

   ```bash
   gcloud auth login
   gcloud config set project ph-26-caudal
   gcloud config set run/region us-central1
   ```

## 3. Qué necesita el frontend

Cloud Run construye el código con buildpacks, así que no hace falta un Dockerfile si `frontend/package.json` cumple con esto:

- Un script `build`. Cloud Run lo corre solo al construir.
- Un script `start` que sirve la app en el puerto de la variable `PORT` (Cloud Run usa 8080).
  - Next.js: `"start": "next start -p ${PORT:-8080}"`
  - Vite o cualquier sitio estático: `"start": "serve -s dist -l ${PORT:-8080}"` (con `serve` en `dependencies`)
- El `package-lock.json` (o el lock de tu gestor) commiteado.

Prueba antes en local: `npm run build && PORT=8080 npm start` y abre <http://localhost:8080>.

## 4. Desplegar

Desde la raíz del repo:

```bash
gcloud run deploy caudal-web --source frontend --allow-unauthenticated
```

La primera vez pregunta si quieres crear un repositorio de Artifact Registry: responde `Y`. Tarda de 2 a 5 minutos y al final imprime la URL.

Para desplegar cambios, corre el mismo comando otra vez.

### Variables de entorno

- Las que se leen en el servidor (en tiempo de ejecución): `--set-env-vars API_URL=https://...`
- Las que se incrustan al construir (`VITE_*`, `NEXT_PUBLIC_*`): `--set-build-env-vars VITE_API_URL=https://...`

No pongas secretos en variables `VITE_*` ni `NEXT_PUBLIC_*`, porque terminan en el JavaScript que baja el navegador.

### Ver qué pasa

```bash
gcloud run services describe caudal-web --format='value(status.url)'   # URL
gcloud run services logs read caudal-web --limit 50                     # logs
gcloud run revisions list --service caudal-web                          # revisiones
gcloud run services update-traffic caudal-web --to-revisions=REVISION=100  # volver a una revisión anterior
```

En la consola: <https://console.cloud.google.com/run/detail/us-central1/caudal-web?project=ph-26-caudal>

## La API (`caudal-api`)

La API no se despliega con `--source`: su imagen lleva los datos de `data/processed/` y `predio.parquet`, que no está en git. Lo hace un script, con Docker corriendo:

```bash
scripts/cloud/api/desplegar.sh
EXPEDIENTE=1 scripts/cloud/api/probar.sh https://caudal-api-....run.app
```

Detalles en [api/README.md](../api/README.md#desplegar-gabi). Primero se despliega `caudal-api` y después `caudal-web`.

## Problemas comunes

| Mensaje | Causa y solución |
|---|---|
| `PERMISSION_DENIED` o `does not have permission` | Gabi todavía no te dio los roles, o `gcloud` usa otra cuenta. Revisa con `gcloud auth list`. |
| `Container failed to start and listen on the port` | El script `start` no escucha en `PORT`. Revisa el paso 3 y los logs. |
| Error en el build | Abre el enlace a los logs de Cloud Build que imprime el comando. Casi siempre falta el lock o falla `npm run build`. |
| La página responde 403 | Faltó `--allow-unauthenticated`: corre el despliegue otra vez con esa opción. |

Despliegue automático en cada push (como Vercel): Cloud Run puede conectarse a GitHub, pero solo con repos tuyos. Tendrías que usar un espejo personal del repo, como explica el [README](../README.md#️-deploying--integrations-vercel-render-etc). Para la hackatón alcanza con el comando del paso 4.
