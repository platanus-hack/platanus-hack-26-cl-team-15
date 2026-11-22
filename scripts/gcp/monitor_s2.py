# /// script
# requires-python = ">=3.11"
# dependencies = ["pystac-client", "pandas", "pyarrow", "google-cloud-storage"]
# ///
"""Monitor de escenas Sentinel-2 nuevas sobre Z1 y Z2: las detecta y extiende la serie por predio.

Corre a diario en el Cloud Run Job `caudal-monitor-s2` (lo lanza Cloud Scheduler; ver monitor-s2-deploy.sh).

Qué hace:
1. Lee el estado (DESTINO/estado.json): hasta qué `created` de Earth Search ya revisó y qué escenas procesó.
2. Busca en Earth Search las escenas L2A de cada zona con `created` posterior y menos de --nubes-max % de nubes.
   Se usa `created` (cuándo se publicó) y no `datetime` (cuándo se tomó): así también entran las escenas viejas
   que ESA reprocesa. La pasada sobre Z1 y Z2 es a las 14:52 UTC y se publica entre 5 y 9 horas después.
3. Por cada fecha nueva y cada modo (--modos), corre serie_sentinel2.py con --inicio = --fin = esa fecha.
4. Agrega las filas a DESTINO/serie_<modo>_reciente.parquet (una fila por polígono y fecha; si una fecha se repite,
   queda la de más píxeles válidos, igual que serie_sentinel2.py) y registra las escenas en el estado.

Si una fecha falla, sus escenas no se marcan y el watermark no avanza: la corrida siguiente las reintenta. Termina
con código 1 en ese caso, para que Cloud Run marque la ejecución como fallida.

Sin escenas nuevas no corre nada: solo anota la hora de la revisión. No recalcula los modelos (M2 a M5) ni
redespliega la API; eso sigue siendo a mano (docs/en-vivo-y-precalculado.md).

DESTINO es gs://bucket/prefijo o una carpeta local (para probar).

Uso:
  uv run scripts/gcp/monitor_s2.py --destino /tmp/monitor --modos muestra --desde 2026-11-10   # prueba local
  uv run scripts/gcp/monitor_s2.py --destino gs://ph-26-caudal-sentinel2/monitor --solo-revisar  # qué hay nuevo
  python scripts/gcp/monitor_s2.py --destino gs://ph-26-caudal-sentinel2/monitor                 # lo que corre el job
"""

import argparse
import io
import json
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
from pystac_client import Client

RAIZ = Path(__file__).resolve().parents[2]
SERIE = RAIZ / "scripts/extract/serie_sentinel2.py"
STAC = "https://earth-search.aws.element84.com/v1"  # el mismo catálogo y colección que serie_sentinel2.py
COLECCION = "sentinel-2-l2a"
# modo -> argumento de serie_sentinel2.py y nombre de la serie acumulada
MODOS = {
    "elegibles": (["--elegibles"], "serie_predio_reciente.parquet"),
    "referencia": (["--referencia"], "serie_referencia_reciente.parquet"),
    "muestra": ([], "serie_muestra_reciente.parquet"),  # 100 predios en git: para probar
}


class Destino:
    """Lectura y escritura en gs://bucket/prefijo o en una carpeta local."""

    def __init__(self, url: str):
        self.url = url.rstrip("/")
        if self.url.startswith("gs://"):
            from google.cloud import storage

            nombre, _, self.prefijo = self.url[5:].partition("/")
            self.bucket = storage.Client().bucket(nombre)
        else:
            self.bucket = None
            Path(self.url).mkdir(parents=True, exist_ok=True)

    def leer(self, rel: str) -> bytes | None:
        if self.bucket is None:
            f = Path(self.url) / rel
            return f.read_bytes() if f.exists() else None
        b = self.bucket.blob(f"{self.prefijo}/{rel}".lstrip("/"))
        return b.download_as_bytes() if b.exists() else None

    def escribir(self, rel: str, datos: bytes) -> None:
        if self.bucket is None:
            (Path(self.url) / rel).write_bytes(datos)
        else:
            self.bucket.blob(f"{self.prefijo}/{rel}".lstrip("/")).upload_from_string(datos)


def ahora() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def buscar_nuevas(zonas: dict, desde: str, nubes_max: float, procesadas: set[str]) -> list[dict]:
    # Un día de margen por si Earth Search publica fuera de orden; lo ya procesado se descarta por id
    desde = (pd.Timestamp(desde) - pd.Timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    cat = Client.open(STAC)
    vistas: dict[str, dict] = {}
    for zid, z in zonas["zonas"].items():
        busq = cat.search(collections=[COLECCION], bbox=z["bbox"], max_items=2000,
                          query={"created": {"gt": desde}, "eo:cloud_cover": {"lt": nubes_max}})
        for it in busq.items():
            if it.id in procesadas:
                continue
            e = vistas.setdefault(it.id, {
                "id": it.id, "fecha": it.datetime.strftime("%Y-%m-%d"), "created": it.properties["created"],
                "nubes_pct": round(it.properties.get("eo:cloud_cover", float("nan")), 1), "zonas": []})
            e["zonas"].append(zid)
    return sorted(vistas.values(), key=lambda e: (e["fecha"], e["id"]))


def correr_serie(modo: str, fecha: str, nubes_max: float, salida: Path) -> bool:
    """True si la serie de esa fecha quedó completa (también si no hubo polígonos con datos)."""
    # En el job las dependencias están instaladas en el mismo Python; en local, uv las trae del encabezado del script
    base = ["uv", "run", "-q", str(SERIE)] if shutil.which("uv") else [sys.executable, str(SERIE)]
    cmd = [*base, *MODOS[modo][0], "--inicio", fecha, "--fin", fecha,
           "--nubes-max", str(nubes_max), "--salida", str(salida)]
    print(f"[{ahora()}] {modo} {fecha}: {' '.join(cmd[len(base) - 1:])}", flush=True)
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=RAIZ)
    cola = []
    for linea in p.stdout:
        print("  " + linea, end="", flush=True)
        cola = (cola + [linea])[-5:]
    rc = p.wait()
    if rc == 0:
        return True
    if not salida.exists() and any("Sin resultados" in x for x in cola):
        print(f"  {modo} {fecha}: ningún polígono cae en estas escenas", flush=True)
        return True
    print(f"  {modo} {fecha}: falló (rc={rc}); se reintenta en la próxima corrida", flush=True)
    return False


def acumular(destino: Destino, archivo: str, nuevas: list[pd.DataFrame]) -> int:
    previa = destino.leer(archivo)
    partes = ([pd.read_parquet(io.BytesIO(previa))] if previa else []) + nuevas
    s = pd.concat(partes, ignore_index=True)
    s = s.sort_values(["predio_id", "fecha", "n_pix_validos"], ascending=[True, True, False])
    s = s.drop_duplicates(["predio_id", "fecha"]).sort_values(["predio_id", "fecha"]).reset_index(drop=True)
    buf = io.BytesIO()
    s.to_parquet(buf, index=False)
    destino.escribir(archivo, buf.getvalue())
    return len(s)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--destino", required=True, help="gs://bucket/prefijo o carpeta local: estado y series acumuladas")
    ap.add_argument("--modos", default="elegibles,referencia", help=f"separados por coma, de {sorted(MODOS)}")
    ap.add_argument("--nubes-max", type=float, default=40, help="como las series en git (data/README.md)")
    ap.add_argument("--desde", help="solo la primera vez (sin estado): revisar desde esta fecha de publicación. "
                                    "Por defecto, 15 días atrás")
    ap.add_argument("--solo-revisar", action="store_true", help="listar las escenas nuevas sin procesarlas")
    args = ap.parse_args()
    modos = [m.strip() for m in args.modos.split(",") if m.strip()]
    if bad := [m for m in modos if m not in MODOS]:
        sys.exit(f"modos desconocidos: {bad}")

    destino = Destino(args.destino)
    crudo = destino.leer("estado.json")
    estado = json.loads(crudo) if crudo else {
        "created_hasta": args.desde or (datetime.now(timezone.utc) - timedelta(days=15)).strftime("%Y-%m-%dT00:00:00Z"),
        "procesadas": {}}
    if args.desde and crudo:
        print(f"aviso: ya hay estado; se ignora --desde y se sigue desde {estado['created_hasta']}", flush=True)
    zonas = json.loads((RAIZ / "data/zonas.json").read_text())

    nuevas = buscar_nuevas(zonas, estado["created_hasta"], args.nubes_max, set(estado["procesadas"]))
    print(f"[{ahora()}] publicadas después de {estado['created_hasta']} con menos de {args.nubes_max:g} % de nubes: "
          f"{len(nuevas)} escenas nuevas", flush=True)
    for e in nuevas:
        print(f"  {e['id']}  tomada {e['fecha']}  publicada {e['created']}  nubes {e['nubes_pct']} %  {','.join(e['zonas'])}")
    if args.solo_revisar:
        return
    estado["ultima_revision"] = ahora()
    if not nuevas:
        destino.escribir("estado.json", json.dumps(estado, indent=1).encode())
        return

    fechas = sorted({e["fecha"] for e in nuevas})
    malas: set[str] = set()
    with tempfile.TemporaryDirectory() as tmp:
        for modo in modos:
            partes = []
            for f in fechas:
                salida = Path(tmp) / f"{modo}_{f}.parquet"
                if not correr_serie(modo, f, args.nubes_max, salida):
                    malas.add(f)
                elif salida.exists():
                    partes.append(pd.read_parquet(salida))
            if partes:
                archivo = MODOS[modo][1]
                n = acumular(destino, archivo, partes)
                print(f"[{ahora()}] {modo}: +{sum(len(p) for p in partes)} filas -> {destino.url}/{archivo} ({n} en total)",
                      flush=True)

    hechas = [e for e in nuevas if e["fecha"] not in malas]
    for e in hechas:
        estado["procesadas"][e["id"]] = {k: e[k] for k in ("fecha", "created", "nubes_pct")} | {"procesada": ahora()}
    if not malas:  # con fallas no avanza: las escenas que faltan tienen created anterior a las que sí se hicieron
        estado["created_hasta"] = max(estado["created_hasta"], *(e["created"] for e in nuevas))
    estado["ultima_escena"] = max([estado.get("ultima_escena", "")] + [e["fecha"] for e in hechas])
    destino.escribir("estado.json", json.dumps(estado, indent=1).encode())
    print(f"[{ahora()}] listo: {len(hechas)} escenas procesadas, última escena {estado['ultima_escena']}"
          + (f"; fallaron las fechas {sorted(malas)}" if malas else ""), flush=True)
    if malas:
        sys.exit(1)


if __name__ == "__main__":
    main()
