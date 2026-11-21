"""Colour layers of one summer scene over the study box: NDVI (greenness) and NDMI (moisture)."""
import sys
import numpy as np
from PIL import Image
from rasterio.enums import Resampling
from s2 import search, read

BBOX = [-71.26, -32.49, -71.17, -32.425]; SHAPE = (719, 846)
def ramp(v, stops):
    xs = [s[0] for s in stops]; out = np.zeros(v.shape + (3,))
    for ch in range(3):
        out[..., ch] = np.interp(v, xs, [s[1][ch] for s in stops])
    return out.astype(np.uint8)

NDVI = [(0.05, (92, 58, 36)), (0.2, (171, 122, 66)), (0.32, (222, 196, 98)), (0.45, (150, 196, 74)), (0.6, (46, 160, 67)), (0.8, (6, 88, 52))]
NDMI = [(-0.25, (96, 62, 40)), (-0.08, (176, 136, 88)), (0.02, (222, 214, 170)), (0.12, (86, 190, 200)), (0.25, (24, 120, 196)), (0.4, (20, 46, 140))]
if __name__ == '__main__':
    dt, tag = sys.argv[1], sys.argv[2]
    it = min(search(BBOX, dt, 10), key=lambda i: i.properties['eo:cloud_cover'])
    print(it.id, flush=True)
    a = it.assets
    red, nir = read(a['red'].href, BBOX, SHAPE), read(a['nir'].href, BBOX, SHAPE)
    n8a, sw = read(a['nir08'].href, BBOX, SHAPE), read(a['swir16'].href, BBOX, SHAPE)
    ndvi = (nir - red) / np.maximum(nir + red, 1); ndmi = (n8a - sw) / np.maximum(n8a + sw, 1)
    Image.fromarray(ramp(ndvi, NDVI)).save(f'../site/img/ndvi_{tag}.jpg', quality=86)
    Image.fromarray(ramp(ndmi, NDMI)).save(f'../site/img/ndmi_{tag}.jpg', quality=86)
    print('ndvi p5/p95', np.percentile(ndvi, [5, 95]), 'ndmi', np.percentile(ndmi, [5, 95]))
