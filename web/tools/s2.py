"""Windowed reads of Sentinel-2 L2A COGs from Element84's public STAC (no credentials)."""
import numpy as np
import rasterio
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from pystac_client import Client

STAC = 'https://earth-search.aws.element84.com/v1'


def search(bbox, dt, max_cloud=30):
    c = Client.open(STAC)
    return sorted(c.search(collections=['sentinel-2-l2a'], bbox=bbox, datetime=dt,
                           query={'eo:cloud_cover': {'lt': max_cloud}}).items(),
                  key=lambda i: i.properties['datetime'])


def read(href, bbox, shape, resampling=Resampling.bilinear):
    """Read the bbox (lon/lat) of one band onto a fixed output grid (rows, cols)."""
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', AWS_NO_SIGN_REQUEST='YES'):
        with rasterio.open(href) as src:
            b = transform_bounds('EPSG:4326', src.crs, *bbox)
            win = from_bounds(*b, transform=src.transform)
            return src.read(1, window=win, out_shape=shape, resampling=resampling, boundless=True, fill_value=0).astype('float32')
