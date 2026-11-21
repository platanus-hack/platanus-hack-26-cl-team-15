# Página de Caudal (prototipo "Tiempo")

Prototipo de la app: el valle de La Ligua a lo largo del tiempo, con ranking de predios,
ficha, expediente y ruta de inspección. Es estático, sin build ni backend.

## Verla

```bash
cd web/site
python3 -m http.server 8000
# http://localhost:8000
```

Necesita servirse por HTTP (usa módulos ES y `fetch`); abrir `index.html` directo no funciona.

## Qué es real y qué es de ejemplo

- **Medido:** series NDVI/NDMI de Sentinel-2 L2A (34 escenas mensuales, ene 2023 a oct 2025),
  lluvia y ET0 diarias de Open-Meteo, y el consumo estimado con FAO-56 a partir de ellas.
- **De ejemplo:** los polígonos de los 10 predios y sus derechos de agua. La página lo indica.
  Todavía no usa los predios ni los derechos de `data/` del repo; conectarlos es el paso siguiente.

## Regenerar los datos

`site/data/valle.json` sale de `tools/`, que lee Sentinel-2 desde el STAC público de Element84
(sin credenciales):

```bash
cd web/tools
uv run --with pystac-client --with rasterio --with numpy --with pillow python series.py   # data/series.json
uv run --with numpy python compute.py                                                     # site/data/valle.json
```

`rgb.py` y `layers.py` generan las imágenes de `site/img/`.
