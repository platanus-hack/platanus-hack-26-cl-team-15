import sys, numpy as np
from PIL import Image
from s2 import search, read
bbox = [float(x) for x in sys.argv[1].split(',')]
dt, out = sys.argv[2], sys.argv[3]
W = int(sys.argv[4]) if len(sys.argv) > 4 else 1000
items = search(bbox, dt, 10)
it = min(items, key=lambda i: i.properties['eo:cloud_cover'])
print(it.id, it.properties['eo:cloud_cover'])
import math
lat = (bbox[1] + bbox[3]) / 2
w_m = (bbox[2]-bbox[0]) * 111320 * math.cos(math.radians(lat)); h_m = (bbox[3]-bbox[1]) * 110540
H = round(W * h_m / w_m)
bands = [read(it.assets[k].href, bbox, (H, W)) for k in ('red', 'green', 'blue')]
rgb = np.dstack(bands)
rgb = np.clip((rgb / 2600) ** 0.8 * 255, 0, 255).astype('uint8')
Image.fromarray(rgb).save(out, quality=88)
print(W, H)
