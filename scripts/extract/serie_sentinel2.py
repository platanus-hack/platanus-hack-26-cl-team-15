# /// script
# requires-python = ">=3.11"
# dependencies = ["geopandas>=1.0", "pyarrow", "shapely>=2.0", "rasterio", "pystac-client", "numpy", "pandas"]
# ///
"""Series NDVI, NDWI y NDMI por predio y escena Sentinel-2 L2A (tarea D1).

Para cada escena que cruza una zona, lee las bandas recortadas a los predios (a 20 m),
enmascara nubes con SCL y promedia los índices dentro de cada predio.

Corrida nacional (--parte K): lee `plan/partes/K.jsonl` y `plan/poligonos_tile/<tile>.parquet` (los escribe
scripts/cloud/chile/plan.py) y procesa los tiles de la parte escena por escena, en celdas de 512 píxeles. Ver
"Modo --parte" más abajo.

Entradas: data/zonas.json y, según el modo, data/processed/predio_muestra.geojson, predio.parquet,
fiscalizacion.parquet o referencia_secano.parquet.
Caché: data/raw/s2/<zona>/<escena>_<modo>_v2.parquet, una por escena y modo (se puede cortar y reanudar; no va a git).
Salida: data/processed/serie_predio.parquet (o --salida), una fila por (predio_id, escena_id).

Modos (qué polígonos se procesan; por defecto, la muestra):
- --elegibles: los 7.911 predios elegibles (rol válido y 1 ha o más), universo del ranking.
- --validacion: predios elegibles de los vecindarios del set de validación (D18: set_validacion != "fuera").
- --referencia: polígonos de referencia de secano (D11). La columna predio_id lleva el ref_id.
- --predios ARCHIVO: lista de predio_id (una por línea, o CSV/Parquet con columna predio_id).
- --todos: todos los polígonos con rol válido y 0,5 ha o más (20.050 en la capa; lento).

Reflectancia = DN * 1e-4, sin offset (D15). Los COG de Earth Search ya traen el -0.1 aplicado en todos los baselines,
aunque raster:bands declare offset -0.1 y aunque earthsearch:boa_offset_applied diga False: el mar frente a La Ligua
y Quintero da DN roja 50-290 (con offset estaría sobre 1000) y la superposición 19HBD/19HCD coincide en ±20 DN.
No leer el offset de los metadatos.

Índices:
- NDVI = (B08 - B04) / (B08 + B04)
- NDWI = (B03 - B08) / (B03 + B08)   (McFeeters: agua abierta, tranques)
- NDMI = (B8A - B11) / (B8A + B11)   (humedad de la vegetación)
Píxel válido: SCL en {4 vegetación, 5 suelo desnudo, 6 agua, 7 sin clasificar} y reflectancias > 0.

Modo --parte (corrida nacional, etapa satelite):
- Cada tile se divide en celdas de 512 x 512 píxeles a 20 m alineadas a su origen; solo se leen las celdas ocupadas
  (que tocan algún polígono) y que además cruzan la huella con datos del ítem (`item.geometry`). Las celdas de una
  fila se leen en tramos horizontales contiguos, con los datasets abiertos durante toda la escena.
- SCL primero: si una celda no tiene píxeles con SCL en {4, 5, 6, 7} bajo los polígonos, no se leen las otras bandas.
- Sin banda verde: `ndwi` queda en NaN (no entra a M2 a M5; poi_predio.py lee su propia banda verde).
- Dos máscaras, predios y secano, con acumuladores por tile (n_dato, n_val, Σndvi, Σndvi², Σndmi): un polígono que
  cruza celdas suma con np.bincount y el resultado es el mismo que con el tile entero.
- Solo se calcula sobre los píxeles de polígono (uint16 -> float64 después de elegirlos).
- GDAL: MERGE_CONSECUTIVE_RANGES, MAX_RETRY=5, RETRY_DELAY=2, CACHEMAX=256.
- Salida: s2/cache/<tile>/<escena_id>_chile_v2.parquet, una por escena y escrita primero en /tmp: poligono_id, tipo,
  tile, escena_id, fecha, ndvi, ndwi, ndmi, ndvi_std, nubosidad_pct, n_pix_validos, n_pix_total, nubes_escena_pct.
  Un polígono sin píxeles válidos esa fecha no tiene fila; una escena sin ninguno deja un parquet vacío (así
  "falta" significa siempre "no se procesó"). Una escena interrumpida se rehace completa.
- Cada 2 minutos el log da escenas hechas, MB/s leídos, segundos por escena y memoria.

Uso:
  uv run scripts/extract/serie_sentinel2.py --parte 0 [--hilos 10]   # corrida nacional, con CAUDAL_DATA=/datos
  uv run scripts/extract/serie_sentinel2.py                      # muestra, periodo prioritario de cada zona
  uv run scripts/extract/serie_sentinel2.py --zona Z2 --periodo completo
  uv run scripts/extract/serie_sentinel2.py --inicio 2025-12-01 --fin 2026-03-31   # temporada seca 2025-26
  uv run scripts/extract/serie_sentinel2.py --todos              # los 20.050 predios (lento)
  uv run scripts/extract/serie_sentinel2.py --validacion --temporadas 2019-20:2024-25 \
      --salida data/processed/serie_predio_validacion.parquet       # diciembre a marzo de cada temporada
"""

import argparse
import json
import os
import resource
import shutil
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from pystac import Item
from pystac_client import Client
from shapely import STRtree
from shapely.geometry import box, shape
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.transform import Affine
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from comun.celdas import CELDA_PX, celdas_ocupadas, grilla_de_item, tramos  # noqa: E402
from comun.rutas import DATA, ZONAS  # noqa: E402

STAC = "https://earth-search.aws.element84.com/v1"
RES = 20  # metros; B11 y SCL son nativas de 20 m
SCL_VALIDO = [4, 5, 6, 7]
BANDAS = ["green", "red", "nir", "nir08", "swir16", "scl"]
AREA_MIN_HA = 0.5
HILOS = int(os.environ.get("HILOS_ESCENAS", 6))  # escenas en paralelo fuera de --parte (~4 GB cada una con --elegibles)
ESPERA_BASE = 15  # s; reintento k espera ESPERA_BASE * 2**k
PAUSA_FINAL = 120  # s antes de la pasada final de escenas fallidas


def nd(a, b):
    with np.errstate(invalid="ignore", divide="ignore"):
        return (a - b) / (a + b)


def leer_ids(ruta: str) -> set[int]:
    f = Path(ruta)
    if f.suffix == ".parquet":
        return set(pd.read_parquet(f, columns=["predio_id"])["predio_id"].astype(int))
    if f.suffix == ".csv":
        return set(pd.read_csv(f)["predio_id"].astype(int))
    return {int(x) for x in f.read_text().split() if x.strip()}


def ids_validacion() -> set[int]:
    """Predios de los vecindarios del set de validación (D18), solo los elegibles."""
    f = gpd.read_parquet(DATA / "processed/fiscalizacion.parquet")
    f = f[f["set_validacion"] != "fuera"]
    return {int(i) for v in f["vecindario"] for i in v} | set(f["predio_id"].dropna().astype(int))


def modo(args) -> str:
    return ("referencia" if args.referencia else "validacion" if args.validacion else
            "elegibles" if args.elegibles else "todos" if args.todos else
            f"predios-{Path(args.predios).stem}" if args.predios else "muestra")


def cargar_predios(zona: str, args) -> gpd.GeoDataFrame:
    m = modo(args)
    if m == "referencia":
        g = gpd.read_parquet(DATA / "processed/referencia_secano.parquet").rename(columns={"ref_id": "predio_id"})
    elif m == "muestra":
        g = gpd.read_file(DATA / "processed/predio_muestra.geojson")
    else:
        g = gpd.read_parquet(DATA / "processed/predio.parquet")
        if m == "todos":
            g = g[g.rol_valido & (g.area_ha >= AREA_MIN_HA)]
        elif m == "elegibles":
            g = g[g.elegible]
        else:
            ids = ids_validacion() if m == "validacion" else leer_ids(args.predios)
            g = g[g.elegible & g.predio_id.isin(ids)]
    g = g[g.zona == zona][["predio_id", "zona", "geometry"]]
    return g.reset_index(drop=True)


def periodos_temporadas(rango: str) -> list[dict]:
    """'2019-20:2024-25' -> diciembre a marzo de cada temporada seca del rango."""
    a, _, b = rango.partition(":")
    ini, fin = int(a[:4]), int((b or a)[:4])
    return [{"inicio": f"{y}-12-01", "fin": f"{y + 1}-03-31"} for y in range(ini, fin + 1)]


class Tile:
    """Grilla de 20 m y máscara de predios de un tile; se calcula una vez y sirve a todas sus escenas."""

    def __init__(self, item, predios: gpd.GeoDataFrame):
        self.crs = rasterio.crs.CRS.from_string(item.properties.get("proj:code") or f"EPSG:{item.properties['proj:epsg']}")
        pg = predios.to_crs(self.crs)
        x0t, y0t = item.assets["red"].extra_fields["proj:transform"][2], item.assets["red"].extra_fields["proj:transform"][5]
        shp = item.assets["red"].extra_fields["proj:shape"]
        ext = (x0t, y0t - shp[0] * 10, x0t + shp[1] * 10, y0t)  # xmin, ymin, xmax, ymax del tile
        pg = pg[pg.intersects(box(*ext))]
        self.vacio = pg.empty
        if self.vacio:
            return
        xmin, ymin, xmax, ymax = pg.total_bounds
        xmin, ymin = max(xmin, ext[0]), max(ymin, ext[1])
        xmax, ymax = min(xmax, ext[2]), min(ymax, ext[3])
        # Alinea a la grilla de 20 m del tile
        xmin = ext[0] + np.floor((xmin - ext[0]) / RES) * RES
        ymax = ext[3] - np.floor((ext[3] - ymax) / RES) * RES
        w = int(np.ceil((xmax - xmin) / RES))
        h = int(np.ceil((ymax - ymin) / RES))
        self.bounds = (xmin, ymax - h * RES, xmin + w * RES, ymax)
        self.transform = Affine(RES, 0, xmin, 0, -RES, ymax)
        self.shape = (h, w)
        self.ids = pg.predio_id.to_numpy()
        formas = ((g, i + 1) for i, g in enumerate(pg.geometry))
        self.mascara = rasterize(formas, out_shape=self.shape, transform=self.transform, fill=0, dtype="int32")
        self.n = len(self.ids)


def leer(item, banda, tile: Tile):
    a = item.assets[banda]
    metodo = Resampling.nearest if banda == "scl" else Resampling.average
    with rasterio.Env(AWS_NO_SIGN_REQUEST="YES", GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"):
        with rasterio.open(a.href) as ds:
            win = from_bounds(*tile.bounds, transform=ds.transform)
            x = ds.read(1, window=win, out_shape=tile.shape, resampling=metodo, boundless=True, fill_value=0)
    return x.astype("float32")


def procesar_escena(item, tile: Tile) -> pd.DataFrame:
    datos = {}
    for b in BANDAS:
        x = leer(item, b, tile)
        datos[b] = x if b == "scl" else np.where(x > 0, np.clip(x * 1e-4, 0, 1.5), 0)
    scl = datos["scl"]
    refl = [datos[b] for b in ("green", "red", "nir", "nir08", "swir16")]
    # "dato" = píxel con información (el borde del tile viene en cero); "valido" = además sin nubes
    dato = scl > 0
    valido = np.isin(scl, SCL_VALIDO) & np.all([r > 0 for r in refl], axis=0)
    ndvi = nd(datos["nir"], datos["red"])
    ndwi = nd(datos["green"], datos["nir"])
    ndmi = nd(datos["nir08"], datos["swir16"])
    lab = tile.mascara.ravel()
    n = tile.n + 1

    def cuenta(m):
        return np.bincount(lab, weights=m.ravel().astype("float64"), minlength=n)[1:]

    n_dato = cuenta(dato)
    n_val = cuenta(valido)
    out = {"predio_id": tile.ids, "n_pix_total": n_dato.astype(int), "n_pix_validos": n_val.astype(int)}
    with np.errstate(invalid="ignore", divide="ignore"):
        for nombre, v in (("ndvi", ndvi), ("ndwi", ndwi), ("ndmi", ndmi)):
            vv = np.where(valido & np.isfinite(v), v, 0)
            out[nombre] = np.bincount(lab, weights=vv.ravel(), minlength=n)[1:] / n_val
        vv = np.where(valido & np.isfinite(ndvi), ndvi, 0)
        m2 = np.bincount(lab, weights=(vv**2).ravel(), minlength=n)[1:] / n_val
        out["ndvi_std"] = np.sqrt(np.maximum(m2 - out["ndvi"] ** 2, 0))
        out["nubosidad_pct"] = 100 * (1 - n_val / np.where(n_dato > 0, n_dato, np.nan))
    df = pd.DataFrame(out)
    df = df[df.n_pix_total > 0]
    df["escena_id"] = item.id
    df["fecha"] = pd.Timestamp(item.datetime).tz_localize(None).normalize()
    df["nubes_escena_pct"] = item.properties.get("eo:cloud_cover")
    return df


def buscar(z: dict, inicio: str, fin: str, nubes_max: float):
    cat = Client.open(STAC)
    busq = cat.search(
        collections=["sentinel-2-l2a"],
        bbox=z["bbox"],
        datetime=f"{inicio}/{fin}",
        query={"eo:cloud_cover": {"lt": nubes_max}},
        max_items=5000,
    )
    return sorted(busq.items(), key=lambda i: i.datetime)


def periodos(zonas: dict, z: dict, modo: str) -> list[dict]:
    """Periodos a descargar. 'ultima_escena_limpia' se resuelve a hoy: la búsqueda STAC solo trae lo que existe."""
    hoy = pd.Timestamp.today().strftime("%Y-%m-%d")
    ps = [zonas["periodo"]] if modo == "completo" else z["periodos_prioritarios"]
    return [{"inicio": p["inicio"], "fin": hoy if p["fin"] == "ultima_escena_limpia" else p["fin"]} for p in ps]


# --- Modo --parte (corrida nacional) -------------------------------------------------------------------------------

GDAL_PARTE = {
    "AWS_NO_SIGN_REQUEST": "YES",
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
    "GDAL_HTTP_MAX_RETRY": "5",
    "GDAL_HTTP_RETRY_DELAY": "2",
    "GDAL_CACHEMAX": 256,  # MB; rasterio exige un entero
}
TIPOS = ("predio", "secano")
COLUMNAS_ESCENA = ["poligono_id", "tipo", "tile", "escena_id", "fecha", "ndvi", "ndwi", "ndmi", "ndvi_std",
                   "nubosidad_pct", "n_pix_validos", "n_pix_total", "nubes_escena_pct"]
INTERVALO_LOG = 120  # s


class Progreso:
    """Contadores compartidos entre hilos para el log periódico de la tarea."""

    def __init__(self, total: int):
        self.total, self.hechas, self.bytes = total, 0, 0
        self.t0 = self.ultimo = time.time()
        self.lock = threading.Lock()

    def sumar(self, n_bytes: int, escenas: int = 0):
        with self.lock:
            self.bytes += n_bytes
            self.hechas += escenas
            ahora = time.time()
            if ahora - self.ultimo >= INTERVALO_LOG:
                self.ultimo = ahora
                dt = ahora - self.t0
                mem = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
                print(f"  {self.hechas}/{self.total} escenas, {self.bytes / 1e6 / dt:.1f} MB/s leídos, "
                      f"{dt / max(self.hechas, 1):.0f} s por escena, memoria máx. {mem:.0f} MB", flush=True)


class TileParte:
    """Polígonos de un tile (predios y secano), sus celdas ocupadas y las máscaras de etiquetas por celda.

    Las etiquetas son globales del tile (posición del polígono + 1 en su tipo), así un predio que cruza celdas suma en
    los mismos acumuladores. Se calcula una vez por tile y lo comparten los hilos (solo lectura).
    """

    def __init__(self, tile: str, item, poligonos: gpd.GeoDataFrame):
        self.tile = tile
        self.crs = rasterio.crs.CRS.from_string(item.properties.get("proj:code") or f"EPSG:{item.properties['proj:epsg']}")
        self.grilla = grilla_de_item(item)
        pg = poligonos.to_crs(self.crs)
        self.ids = {t: pg.loc[pg["tipo"] == t, "poligono_id"].to_numpy() for t in TIPOS}
        geoms = {t: pg.loc[pg["tipo"] == t, "geometry"].to_numpy() for t in TIPOS}
        self.celdas = celdas_ocupadas(pg.geometry, self.grilla)
        self.mascaras = {}
        arboles = {t: STRtree(g) if len(g) else None for t, g in geoms.items()}
        for f, c in self.celdas:
            caja = box(*self.grilla.limites(f, c))
            tr = self.grilla.transformada(f, c)
            labs = []
            for t in TIPOS:
                cerca = arboles[t].query(caja, predicate="intersects") if arboles[t] is not None else []
                if len(cerca):
                    formas = ((geoms[t][i], int(i) + 1) for i in cerca)
                    labs.append(rasterize(formas, out_shape=(CELDA_PX, CELDA_PX), transform=tr, fill=0, dtype="int32"))
                else:
                    labs.append(None)
            self.mascaras[(f, c)] = tuple(labs)

    def etiquetas(self, fila: int, col0: int, col1: int) -> list[np.ndarray | None]:
        """Etiquetas de cada tipo para un tramo de celdas, como un arreglo de 512 x (512 * celdas)."""
        salida = []
        for k in range(len(TIPOS)):
            partes = [self.mascaras[(fila, c)][k] for c in range(col0, col1 + 1)]
            if all(p is None for p in partes):
                salida.append(None)
            else:
                salida.append(np.hstack([np.zeros((CELDA_PX, CELDA_PX), "int32") if p is None else p for p in partes]))
        return salida


class Acumuladores:
    """Sumas por polígono de un tipo: píxeles con dato, válidos, Σndvi, Σndvi² y Σndmi."""

    def __init__(self, n: int):
        self.n = n + 1
        self.n_dato = np.zeros(self.n)
        self.n_val = np.zeros(self.n)
        self.s_ndvi = np.zeros(self.n)
        self.s_ndvi2 = np.zeros(self.n)
        self.s_ndmi = np.zeros(self.n)

    def sumar_dato(self, lab: np.ndarray):
        self.n_dato += np.bincount(lab, minlength=self.n)

    def sumar_validos(self, lab, ndvi, ndmi):
        self.n_val += np.bincount(lab, minlength=self.n)
        self.s_ndvi += np.bincount(lab, weights=ndvi, minlength=self.n)
        self.s_ndvi2 += np.bincount(lab, weights=ndvi**2, minlength=self.n)
        self.s_ndmi += np.bincount(lab, weights=ndmi, minlength=self.n)


def leer_tramo(ds, limites, forma, banda: str):
    """Lee la ventana de un tramo de celdas: SCL con vecino más cercano, el resto promediado (overview de 20 m)."""
    metodo = Resampling.nearest if banda == "scl" else Resampling.average
    win = from_bounds(*limites, transform=ds.transform)
    return ds.read(1, window=win, out_shape=forma, resampling=metodo, boundless=True, fill_value=0)


def procesar_escena_parte(item, tile: TileParte, progreso: Progreso) -> pd.DataFrame:
    """Índices por polígono de una escena, leyendo solo las celdas ocupadas con datos y con SCL válido."""
    huella = gpd.GeoSeries([shape(item.geometry)], crs="EPSG:4326").to_crs(tile.crs).iloc[0]
    sobre_huella = [c for c in tile.celdas if huella.intersects(box(*tile.grilla.limites(*c)))]
    acum = {t: Acumuladores(len(tile.ids[t])) for t in TIPOS}
    with rasterio.Env(**GDAL_PARTE), ExitStack() as pila:
        abiertos = {}

        def banda(nombre):
            if nombre not in abiertos:
                abiertos[nombre] = pila.enter_context(rasterio.open(item.assets[nombre].href))
            return abiertos[nombre]

        for fila, c0, c1 in tramos(sobre_huella):
            forma = (CELDA_PX, CELDA_PX * (c1 - c0 + 1))
            scl = leer_tramo(banda("scl"), tile.grilla.limites(fila, c0, c1), forma, "scl")
            progreso.sumar(scl.nbytes)
            etiquetas = tile.etiquetas(fila, c0, c1)
            hay_poligono = np.zeros(forma, dtype=bool)
            for k, t in enumerate(TIPOS):
                if etiquetas[k] is not None:
                    idx = np.flatnonzero(etiquetas[k])
                    acum[t].sumar_dato(etiquetas[k].ravel()[idx][scl.ravel()[idx] > 0])
                    hay_poligono |= etiquetas[k] > 0
            # SCL primero: solo las celdas con píxeles de polígono en SCL válido leen las otras bandas
            util = (np.isin(scl, SCL_VALIDO) & hay_poligono).reshape(CELDA_PX, c1 - c0 + 1, CELDA_PX).any(axis=(0, 2))
            for _, a, b in tramos([(0, c0 + j) for j in np.flatnonzero(util)]):
                sub = slice((a - c0) * CELDA_PX, (b - c0 + 1) * CELDA_PX)
                forma_sub = (CELDA_PX, CELDA_PX * (b - a + 1))
                lims_sub = tile.grilla.limites(fila, a, b)
                dn = {n: leer_tramo(banda(n), lims_sub, forma_sub, n) for n in ("red", "nir", "nir08", "swir16")}
                progreso.sumar(sum(x.nbytes for x in dn.values()))
                for k, t in enumerate(TIPOS):
                    if etiquetas[k] is None:
                        continue
                    lab = etiquetas[k][:, sub].ravel()
                    idx = np.flatnonzero(lab)
                    if idx.size == 0:
                        continue
                    valores = {n: x.ravel()[idx] for n, x in dn.items()}  # uint16: solo píxeles de polígono
                    valido = np.isin(scl[:, sub].ravel()[idx], SCL_VALIDO) & np.all([v > 0 for v in valores.values()], axis=0)
                    r = {n: np.minimum(v[valido].astype("float64") * 1e-4, 1.5) for n, v in valores.items()}
                    acum[t].sumar_validos(lab[idx][valido], nd(r["nir"], r["red"]), nd(r["nir08"], r["swir16"]))

    fecha = pd.Timestamp(item.datetime).tz_localize(None).normalize()
    filas = []
    for t in TIPOS:
        a = acum[t]
        n_val = a.n_val[1:]
        with np.errstate(invalid="ignore", divide="ignore"):
            ndvi = a.s_ndvi[1:] / n_val
            ndmi = a.s_ndmi[1:] / n_val
            std = np.sqrt(np.maximum(a.s_ndvi2[1:] / n_val - ndvi**2, 0))
            nub = 100 * (1 - n_val / np.where(a.n_dato[1:] > 0, a.n_dato[1:], np.nan))
        filas.append(pd.DataFrame({
            "poligono_id": tile.ids[t], "tipo": t, "ndvi": ndvi, "ndwi": np.nan, "ndmi": ndmi, "ndvi_std": std,
            "nubosidad_pct": nub, "n_pix_validos": n_val.astype(int), "n_pix_total": a.n_dato[1:].astype(int),
        }))
    df = pd.concat(filas, ignore_index=True)
    df = df[df["n_pix_validos"] > 0].copy()
    df["poligono_id"] = df["poligono_id"].astype("int64")
    df["tile"], df["escena_id"], df["fecha"] = tile.tile, item.id, fecha
    df["nubes_escena_pct"] = item.properties.get("eo:cloud_cover")
    return df[COLUMNAS_ESCENA].reset_index(drop=True)


def escribir_escena(df: pd.DataFrame, destino: Path) -> None:
    """Escribe en /tmp y copia al destino (GCS FUSE: un archivo propio por escena, sin append ni renombres)."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        local = Path(tmp) / destino.name
        df.to_parquet(local, index=False)
        shutil.copyfile(local, destino)


def correr_parte(k: int, hilos: int, limite: int | None, reintentos: int) -> int:
    plan = DATA / "plan"
    ruta = plan / "partes" / f"{k}.jsonl"
    if not ruta.exists():
        sys.exit(f"Falta {ruta}: corre antes la etapa plan (scripts/cloud/chile/plan.py)")
    items = [Item.from_dict(json.loads(linea)) for linea in ruta.read_text().splitlines() if linea.strip()]
    if limite:
        items = items[:limite]
    por_tile: dict[str, list] = {}
    for it in items:
        por_tile.setdefault(it.id.split("_")[1], []).append(it)  # S2B_19HCD_20260117_0_L2A -> 19HCD
    cache = DATA / "s2" / "cache"
    pendientes = {tk: [it for it in lista if not (cache / tk / f"{it.id}_chile_v2.parquet").exists()]
                  for tk, lista in por_tile.items()}
    total = sum(len(v) for v in pendientes.values())
    print(f"parte {k}: {len(items)} escenas en {len(por_tile)} tiles, {total} por procesar, {hilos} hilos", flush=True)
    progreso = Progreso(total)
    fallidas = []

    def trabajo(args):
        it, tile = args
        for intento in range(reintentos + 1):
            try:
                df = procesar_escena_parte(it, tile, progreso)
                break
            except Exception as e:  # una escena rota no debe tumbar la tarea; la red falla a ratos
                if intento == reintentos:
                    print(f"  ERROR {it.id} (sin más reintentos): {type(e).__name__}: {e}", file=sys.stderr, flush=True)
                    return it.id
                espera = ESPERA_BASE * 2**intento
                print(f"  reintento {intento + 1}/{reintentos} de {it.id} en {espera} s: {e}", file=sys.stderr, flush=True)
                time.sleep(espera)
        escribir_escena(df, cache / tile.tile / f"{it.id}_chile_v2.parquet")
        progreso.sumar(0, escenas=1)
        return None

    for tk, lista in pendientes.items():
        if not lista:
            continue
        poligonos = gpd.read_parquet(plan / "poligonos_tile" / f"{tk}.parquet")
        tile = TileParte(tk, lista[0], poligonos)  # se libera al pasar al siguiente tile
        print(f"tile {tk}: {len(poligonos)} polígonos, {len(tile.celdas)} de {tile.grilla.nfilas * tile.grilla.ncols} "
              f"celdas ocupadas, {len(lista)} escenas", flush=True)
        with ThreadPoolExecutor(hilos) as ex:
            fallidas += [f for f in ex.map(trabajo, [(it, tile) for it in lista]) if f]
        del tile
    if fallidas:
        print(f"INCOMPLETO: {len(fallidas)} escenas fallaron; relanzar la etapa satelite con las mismas partes:\n  "
              + "\n  ".join(fallidas), file=sys.stderr, flush=True)
        return 1
    print(f"parte {k}: listo ({progreso.hechas} escenas nuevas)", flush=True)
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zona", choices=["Z1", "Z2"], action="append")
    ap.add_argument("--periodo", choices=["prioritario", "completo"], default="prioritario")
    ap.add_argument("--inicio", help="YYYY-MM-DD; con --fin reemplaza el periodo (misma ventana para todas las zonas)")
    ap.add_argument("--fin", help="YYYY-MM-DD")
    ap.add_argument("--nubes-max", type=float, default=70, help="porcentaje de nubes de la escena; el SCL filtra por píxel")
    sel = ap.add_mutually_exclusive_group()
    sel.add_argument("--todos", action="store_true", help="todos los polígonos con rol válido y 0,5 ha o más")
    sel.add_argument("--elegibles", action="store_true", help="los predios elegibles (rol válido y 1 ha o más)")
    sel.add_argument("--validacion", action="store_true", help="predios de los vecindarios del set de validación (D18)")
    sel.add_argument("--referencia", action="store_true", help="polígonos de referencia de secano (D11)")
    sel.add_argument("--predios", help="archivo con predio_id (una por línea, o CSV/Parquet con columna predio_id)")
    ap.add_argument("--temporadas", help="rango de temporadas secas, p. ej. 2019-20:2024-25 (diciembre a marzo de cada una)")
    ap.add_argument("--limite", type=int, help="procesar solo las primeras N escenas por zona (pruebas)")
    ap.add_argument("--reintentos", type=int, default=3, help="reintentos por escena ante errores de lectura (espera 15, 30, 60 s...)")
    ap.add_argument("--salida", default=str(DATA / "processed/serie_predio.parquet"))
    ap.add_argument("--parte", type=int, help="corrida nacional: número de parte del plan (plan/partes/<k>.jsonl)")
    ap.add_argument("--hilos", type=int, default=int(os.environ.get("HILOS", 10)), help="escenas en paralelo con --parte")
    args = ap.parse_args()
    if args.parte is not None:
        sys.exit(correr_parte(args.parte, args.hilos, args.limite, args.reintentos))

    zonas = json.loads(ZONAS.read_text())
    resultados, fallidas = [], []
    for zid in args.zona or ["Z1", "Z2"]:
        z = zonas["zonas"][zid]
        if args.temporadas:
            ps = periodos_temporadas(args.temporadas)
        elif args.inicio and args.fin:
            ps = [{"inicio": args.inicio, "fin": args.fin}]
        else:
            ps = periodos(zonas, z, args.periodo)
        predios = cargar_predios(zid, args)
        if predios.empty:
            print(f"{zid}: sin polígonos en este modo", flush=True)
            continue
        print(f"{zid}: {len(predios)} predios, periodos {[(p['inicio'], p['fin']) for p in ps]}", flush=True)
        vistos = {}
        for p in ps:
            for it in buscar(z, p["inicio"], p["fin"], args.nubes_max):
                vistos[it.id] = it
        items = sorted(vistos.values(), key=lambda i: i.datetime)
        if args.limite:
            items = items[: args.limite]
        print(f"{zid}: {len(items)} escenas", flush=True)
        cache = DATA / "raw/s2" / zid
        cache.mkdir(parents=True, exist_ok=True)
        tiles: dict[str, Tile] = {}
        pend = []
        for it in items:
            # _v2: sin offset (D15); los parquet sin sufijo se calcularon restando -0.1 y no deben reutilizarse
            f = cache / f"{it.id}_{modo(args)}_v2.parquet"
            if f.exists():
                resultados.append(pd.read_parquet(f).assign(zona=zid))
                continue
            tk = it.id.split("_")[1]
            if tk not in tiles:
                tiles[tk] = Tile(it, predios)
            if not tiles[tk].vacio:
                pend.append((it, tiles[tk], f))

        def trabajo(a):
            it, tile, f = a
            for intento in range(args.reintentos + 1):
                try:
                    df = procesar_escena(it, tile)
                    break
                except Exception as e:  # una escena rota no debe tumbar la corrida; la red falla a ratos
                    if intento == args.reintentos:
                        print(f"  ERROR {it.id} (sin más reintentos): {e}", file=sys.stderr, flush=True)
                        return a, None
                    espera = ESPERA_BASE * 2**intento
                    print(f"  reintento {intento + 1}/{args.reintentos} de {it.id} en {espera} s: {e}", file=sys.stderr, flush=True)
                    time.sleep(espera)
            df.to_parquet(f, index=False)
            return a, df.assign(zona=zid)

        def pasada(lista):
            malas = []
            with ThreadPoolExecutor(HILOS) as ex:
                for i, (a, df) in enumerate(ex.map(trabajo, lista), 1):
                    if df is None:
                        malas.append(a)
                    else:
                        resultados.append(df)
                    if i % 10 == 0 or i == len(lista):
                        print(f"  {zid}: {i}/{len(lista)} escenas", flush=True)
            return malas

        malas = pasada(pend)
        if malas:
            # un corte de red largo agota los reintentos por escena: una pasada más al final, después de una pausa
            print(f"  {zid}: {len(malas)} escenas fallidas; pasada final en {PAUSA_FINAL} s", file=sys.stderr, flush=True)
            time.sleep(PAUSA_FINAL)
            malas = pasada(malas)
        fallidas += [it.id for it, _, _ in malas]

    if not resultados:
        sys.exit("Sin resultados")
    s = pd.concat(resultados, ignore_index=True)
    cols = ["predio_id", "zona", "fecha", "ndvi", "ndwi", "ndmi", "ndvi_std", "nubosidad_pct",
            "n_pix_validos", "n_pix_total", "nubes_escena_pct", "escena_id"]
    # Earth Search a veces publica la misma pasada dos veces (sufijos _0 y _1): se queda la de más píxeles válidos
    s = s.sort_values(["predio_id", "fecha", "n_pix_validos"], ascending=[True, True, False])
    s = s.drop_duplicates(["predio_id", "fecha"])
    s = s[cols].sort_values(["predio_id", "fecha"]).reset_index(drop=True)
    Path(args.salida).parent.mkdir(parents=True, exist_ok=True)
    s.to_parquet(args.salida, index=False)
    ok = s.n_pix_validos > 0
    print(f"{len(s)} filas, {s.predio_id.nunique()} predios, {s.escena_id.nunique()} escenas; "
          f"{ok.mean():.0%} con píxeles válidos -> {args.salida}")
    if fallidas:
        # la salida queda escrita, pero incompleta: volver a correr el mismo comando lee el caché y pide solo estas
        print(f"INCOMPLETO: {len(fallidas)} escenas fallaron después de los reintentos; vuelve a correr el mismo comando:\n  "
              + "\n  ".join(fallidas), file=sys.stderr, flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
