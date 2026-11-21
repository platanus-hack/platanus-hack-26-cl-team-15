"""Turn the measured series and climate into the demo's data file: dry windows, irrigation signal,
FAO-56 consumption range, band and confidence per parcel and season. Everything is precomputed;
the page only reads it (spec v2: "todo lo satelital se precalcula")."""
import json
from datetime import date, timedelta

BBOX = [-71.26, -32.49, -71.17, -32.425]
W, H = 846, 719
PX_M2 = 100  # each pixel of the 10 m grid
DRY_DAYS = 10        # N: consecutive days below 1 mm make a dry window (spec starts at 10)
RAIN_MM = 1.0
NDVI_GAP, NDMI_GAP = 0.15, 0.05  # anomaly over the dry reference that counts as irrigated
UNCERTAINTY = 0.25   # +/- on the consumption estimate (Kc relation and parcel area)
SEASONS = {'2023-24': ('2023-10', '2024-09'), '2024-25': ('2024-10', '2025-09')}

parcels = json.load(open('../data/parcels.json'))
series = json.load(open('../data/series.json'))
raw = json.load(open('../data/climate_raw.json'))['daily']

def lonlat(x, y):
    return (round(BBOX[0] + x / W * (BBOX[2] - BBOX[0]), 5), round(BBOX[3] - y / H * (BBOX[3] - BBOX[1]), 5))

# --- climate: daily rain and ET0, dry windows, monthly sums
days = [{'d': d, 'p': p or 0.0, 'et0': e or 0.0} for d, p, e in zip(raw['time'], raw['precipitation_sum'], raw['et0_fao_evapotranspiration'])]
run = []
for i, day in enumerate(days):
    day['dry'] = False
    if day['p'] < RAIN_MM:
        run.append(i)
    else:
        run = []
    if len(run) >= DRY_DAYS:
        for j in run:
            days[j]['dry'] = True
windows = []
for day in days:
    if day['dry'] and (not windows or windows[-1]['end'] != (date.fromisoformat(day['d']) - timedelta(days=1)).isoformat()):
        windows.append({'start': day['d'], 'end': day['d']})
    elif day['dry']:
        windows[-1]['end'] = day['d']
dry_day = {d['d']: d['dry'] for d in days}
monthly = {}
for d in days:
    m = monthly.setdefault(d['d'][:7], {'month': d['d'][:7], 'rain': 0.0, 'et0': 0.0, 'dry_days': 0, 'days': 0})
    m['rain'] += d['p']; m['et0'] += d['et0']; m['dry_days'] += d['dry']; m['days'] += 1
for m in monthly.values():
    m['rain'] = round(m['rain'], 1); m['et0'] = round(m['et0'], 1)

def effective_rain(p):
    """FAO (AGLW) monthly effective rainfall."""
    return max(0.0, 0.6 * p - 10) if p <= 70 else 0.8 * p - 24

def kc(ndvi):
    """Linear Kc-NDVI relation (Kamble et al., 2013), clipped to field crops."""
    return min(1.2, max(0.15, 1.457 * ndvi - 0.1725))

def months_between(a, b):
    y, m = map(int, a.split('-')); out = []
    while f'{y:04d}-{m:02d}' <= b:
        out.append(f'{y:04d}-{m:02d}'); m += 1
        if m > 12: y, m = y + 1, 1
    return out

by_month = {r['month']: r for r in series}
refs = [p['id'] for p in parcels if p['kind'] == 'ref']

def ref_value(row, key):
    vals = [row['parcels'][r][key] for r in refs if row['parcels'].get(r)]
    return sum(vals) / len(vals) if vals else None

def interp(values):
    """Fill missing months linearly between measured neighbours; returns values and how many were filled."""
    out = list(values); filled = 0
    for i, v in enumerate(out):
        if v is None:
            lo = next((j for j in range(i - 1, -1, -1) if values[j] is not None), None)
            hi = next((j for j in range(i + 1, len(values)) if values[j] is not None), None)
            if lo is not None and hi is not None:
                out[i] = values[lo] + (values[hi] - values[lo]) * (i - lo) / (hi - lo); filled += 1
            elif lo is not None or hi is not None:
                out[i] = values[lo if lo is not None else hi]; filled += 1
    return out, filled

def season_result(p, season):
    ms = months_between(*SEASONS[season])
    area = (p['px'][2] - p['px'][0]) * (p['px'][3] - p['px'][1]) * PX_M2
    ndvi_raw = [(by_month.get(m) or {}).get('parcels', {}).get(p['id'], None) for m in ms]
    ndvi_vals, filled = interp([v['ndvi'] if v else None for v in ndvi_raw])
    vol_months = []
    for m, n in zip(ms, ndvi_vals):
        c = monthly.get(m)
        if c is None or n is None:
            vol_months.append(None); continue
        need = max(0.0, kc(n) * c['et0'] - effective_rain(c['rain']))
        vol_months.append({'month': m, 'kc': round(kc(n), 2), 'et0': c['et0'], 'pef': round(effective_rain(c['rain']), 1), 'm3': round(need / 1000 * area)})
    v_mid = sum(v['m3'] for v in vol_months if v)
    # irrigation signal: scenes taken inside a dry window, parcel well above the dry reference
    dry_scenes = []
    for m in ms:
        row = by_month.get(m)
        if not row or not dry_day.get(row['date']):
            continue
        val = row['parcels'].get(p['id']); rn, rm = ref_value(row, 'ndvi'), ref_value(row, 'ndmi')
        if not val or rn is None:
            continue
        dn, dm = val['ndvi'] - rn, val['ndmi'] - rm
        dry_scenes.append({'date': row['date'], 'dndvi': round(dn, 3), 'dndmi': round(dm, 3), 'positive': dn >= NDVI_GAP and dm >= NDMI_GAP})
    positives = sum(s['positive'] for s in dry_scenes)
    signal = len(dry_scenes) >= 3 and positives / len(dry_scenes) >= 0.5
    # confidence: falls with few pixels, few valid dry scenes, gaps filled, missing reference
    n_px = area / PX_M2
    reasons = []
    conf = 1.0
    if n_px < 500: conf -= 0.15; reasons.append(f'predio chico ({int(n_px)} píxeles)')
    if len(dry_scenes) < 6: conf -= 0.2; reasons.append(f'pocas escenas válidas en ventana seca ({len(dry_scenes)})')
    if filled: conf -= 0.05 * filled; reasons.append(f'{filled} mes(es) sin escena válida, interpolados')
    cloudy = [r['cloud'] for m in ms if (r := by_month.get(m))]
    if cloudy and sum(cloudy) / len(cloudy) > 10: conf -= 0.1; reasons.append('nubosidad media sobre 10 %')
    conf = round(max(0.0, conf), 2)
    right = p['right_m3']
    lo, hi = round(v_mid * (1 - UNCERTAINTY)), round(v_mid * (1 + UNCERTAINTY))
    if not signal: band = 'sin'
    elif lo > right: band = 'alta'
    elif hi > right: band = 'media'
    else: band = 'baja'
    index = round(max(0.0, (v_mid - right) / right) * conf, 3)
    return {'area_ha': round(area / 10000, 2), 'm3_mid': round(v_mid), 'm3_low': lo, 'm3_high': hi, 'right_m3': right,
            'signal': signal, 'dry_scenes': dry_scenes, 'positives': positives, 'band': band, 'index': index,
            'confidence': conf, 'confidence_label': 'alta' if conf >= 0.75 else 'media' if conf >= 0.5 else 'baja',
            'confidence_reasons': reasons, 'months': vol_months}

out_parcels = []
for p in parcels:
    x0, y0, x1, y1 = p['px']
    entry = {'id': p['id'], 'name': p['name'], 'kind': p['kind'], 'px': p['px'],
             'center': lonlat((x0 + x1) / 2, (y0 + y1) / 2),
             'ring': [lonlat(x0, y0), lonlat(x1, y0), lonlat(x1, y1), lonlat(x0, y1), lonlat(x0, y0)],
             'series': [{'month': r['month'], 'date': r['date'], **(r['parcels'].get(p['id']) or {})} for r in series]}
    if p['kind'] == 'predio':
        entry['right_m3'] = p['right_m3']
        entry['seasons'] = {s: season_result(p, s) for s in SEASONS}
    out_parcels.append(entry)

data = {
    'area': {'name': 'Valle de La Ligua', 'comuna': 'La Ligua', 'provincia': 'Petorca', 'region': 'Valparaíso', 'bbox': BBOX, 'grid': [W, H], 'px_m': 10},
    'params': {'dry_days': DRY_DAYS, 'rain_mm': RAIN_MM, 'ndvi_gap': NDVI_GAP, 'ndmi_gap': NDMI_GAP, 'uncertainty': UNCERTAINTY},
    'seasons': {k: {'from': a, 'to': b} for k, (a, b) in SEASONS.items()},
    'scenes': [{'month': r['month'], 'date': r['date'], 'id': r['scene'], 'cloud': r['cloud'], 'dry': bool(dry_day.get(r['date']))} for r in series],
    'climate': {'source': 'Open-Meteo, archivo histórico (ERA5), celda -32.455, -71.215', 'monthly': list(monthly.values()), 'dry_windows': windows},
    'parcels': out_parcels,
}
json.dump(data, open('../site/data/valle.json', 'w'), separators=(',', ':'), ensure_ascii=False)
for p in out_parcels:
    if p['kind'] == 'predio':
        for s, r in p['seasons'].items():
            print(p['id'], s, r['band'], r['m3_low'], r['m3_high'], 'der', r['right_m3'], 'sig', r['signal'], f"{r['positives']}/{len(r['dry_scenes'])}", r['confidence'])
