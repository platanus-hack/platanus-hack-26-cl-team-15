"""Monthly NDVI/NDMI per parcel over the La Ligua study box, from Sentinel-2 L2A (least cloudy scene per month, SCL-masked)."""
import json, sys
from collections import defaultdict
import numpy as np
from rasterio.enums import Resampling
from s2 import search, read

BBOX = [-71.26, -32.49, -71.17, -32.425]
SHAPE = (719, 846)  # 10 m grid of the study image
VALID_SCL = {4, 5}  # vegetation, bare soil
PARCELS = json.load(open('../data/parcels.json'))

def mask_of(p):
    m = np.zeros(SHAPE, bool)
    x0, y0, x1, y1 = p['px']
    m[y0:y1, x0:x1] = True
    return m

masks = {p['id']: mask_of(p) for p in PARCELS}
items = search(BBOX, '2023-01-01/2025-10-31', 40)
by_month = defaultdict(list)
for it in items:
    by_month[it.properties['datetime'][:7]].append(it)

out = []
for month in sorted(by_month):
    it = min(by_month[month], key=lambda i: i.properties['eo:cloud_cover'])
    a = it.assets
    scl = read(a['scl'].href, BBOX, SHAPE, Resampling.nearest)
    red, nir = read(a['red'].href, BBOX, SHAPE), read(a['nir'].href, BBOX, SHAPE)
    n8a, sw = read(a['nir08'].href, BBOX, SHAPE), read(a['swir16'].href, BBOX, SHAPE)
    ok = np.isin(scl, list(VALID_SCL))
    ndvi = (nir - red) / np.maximum(nir + red, 1)
    ndmi = (n8a - sw) / np.maximum(n8a + sw, 1)
    row = {'month': month, 'scene': it.id, 'date': it.properties['datetime'][:10], 'cloud': round(it.properties['eo:cloud_cover'], 2), 'parcels': {}}
    for pid, m in masks.items():
        v = m & ok
        frac = v.sum() / m.sum()
        row['parcels'][pid] = None if frac < 0.6 else {'ndvi': round(float(ndvi[v].mean()), 3), 'ndmi': round(float(ndmi[v].mean()), 3), 'valid': round(float(frac), 2)}
    out.append(row)
    print(month, it.id, row['cloud'], flush=True)

json.dump(out, open('../data/series.json', 'w'), indent=1)
