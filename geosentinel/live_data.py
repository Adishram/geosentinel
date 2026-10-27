"""Public environmental adapters. No elephant detections or fitted parameters.

Requests are explicit (refresh button), bounded, and cached for one hour in memory.
Failed sources stay missing; no random or synthetic measurements are substituted.
"""
import csv
import math
from datetime import date, datetime, timedelta, timezone
from threading import Lock
from time import monotonic

import requests

from . import geo
from .engine import load_config

STAC = 'https://earth-search.aws.element84.com/v1'
_CACHE = {}
_LOCK = Lock()


def crop_observations(end, path=None):
    """Latest field records per village, at most 30 days old. Empty by default."""
    path = path or geo.ROOT / 'data' / 'crop_observations.csv'
    records = {}
    if not path.exists():
        return records
    with path.open(newline='', encoding='utf-8') as source:
        for row in csv.DictReader(source):
            observed = date.fromisoformat(row['date'])
            value = float(row['attractiveness'])
            if not math.isfinite(value) or not 0 <= value <= 1:
                raise ValueError('Crop attractiveness must be a finite number from 0 to 1')
            name = row['village'].strip()
            if end - timedelta(days=29) <= observed <= end and (
                    name not in records or row['date'] >= records[name]['date']):
                records[name] = {'date': row['date'], 'attractiveness': value,
                                 'crop': row.get('crop', ''), 'source': row.get('source', 'field record')}
    return records


def get_json(url, params):
    response = requests.get(url, params=params, timeout=(5, 25))
    response.raise_for_status()
    return response.json()


def weather(end, cfg):
    lat, lon = cfg['study_area']['weather_point']
    start = end - timedelta(days=29)
    # Archive reanalysis is delayed; never silently mix forecasts with observations.
    payload = get_json('https://archive-api.open-meteo.com/v1/archive', {
        'latitude': lat, 'longitude': lon, 'start_date': start.isoformat(),
        'end_date': end.isoformat(), 'daily': 'precipitation_sum,temperature_2m_max', 'timezone': 'Asia/Kolkata',
    })
    daily = payload.get('daily', {})
    days = daily.get('time', [])
    rain = daily.get('precipitation_sum', [])
    expected = [(start + timedelta(days=n)).isoformat() for n in range(30)]
    if days != expected or len(rain) != 30 or any(v is None for v in rain):
        raise ValueError('A complete 30-day rainfall window is not yet available. Choose an earlier date.')
    temps = [t for t in daily.get('temperature_2m_max', []) if t is not None]
    return {'rainfall_30d_mm': round(sum(rain), 1), 'mean_max_temperature_c':
            round(sum(temps) / len(temps), 1) if temps else None,
            'period': f'{start} → {end}', 'source': 'Open-Meteo reanalysis',
            'source_url': 'https://open-meteo.com/en/docs/historical-weather-api'}


def spectral_summary(item, cfg):
    """128² nearest-neighbour samples on a shared grid, inside reserve only.

    SCL masks cloud, shadow, snow, defects and nodata. NDVI is a vegetation
    proxy; SCL water fraction is visible surface water, not potable availability.
    """
    import numpy as np
    import rasterio
    from rasterio.features import geometry_mask
    from rasterio.transform import from_bounds
    from rasterio.vrt import WarpedVRT
    from shapely.geometry import mapping

    bounds = cfg['study_area']['bbox']
    transform = from_bounds(*bounds, 128, 128)
    assets = item['assets']
    bands = {}
    with rasterio.Env(GDAL_HTTP_TIMEOUT=30, GDAL_HTTP_MAX_RETRY=0,
                      GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif'):
        for key in ('red', 'nir', 'scl'):
            asset = assets[key]
            # Only read the fixed provider's public COG bucket.
            if not asset['href'].startswith('https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/'):
                raise ValueError('Unsupported satellite asset host')
            # Use the 8× COG overview for a coarse regional sample instead of
            # pulling full-resolution 10 m imagery into a 128-pixel grid.
            with rasterio.open(asset['href'], overview_level=2) as src:
                with WarpedVRT(src, crs='EPSG:4326', transform=transform, width=128, height=128) as vrt:
                    a = vrt.read(1, masked=True).astype('float64').filled(np.nan)
            if key != 'scl':
                meta = asset.get('raster:bands', [{}])[0]
                if 'scale' not in meta or 'offset' not in meta:
                    raise ValueError('Reflectance scale/offset missing')
                a = a * meta['scale'] + meta['offset']
            bands[key] = a
    reserve = geo.reserve_geometry()
    if reserve is None:
        raise ValueError('Reserve boundary missing')
    forest = geometry_mask([mapping(reserve)], out_shape=(128, 128), transform=transform, invert=True)
    clear = forest & np.isin(bands['scl'], [4, 5, 6])
    count = int(clear.sum())
    coverage = count / max(1, int(forest.sum()))
    if count < 30 or coverage < .5:
        raise ValueError(f'Only {coverage:.0%} clear reserve coverage; need at least 50% and 30 samples')
    denom = bands['nir'] + bands['red']
    valid = clear & np.isin(bands['scl'], [4, 5]) & (denom > 0) & np.isfinite(denom)
    if int(valid.sum()) < 30:
        raise ValueError('Too few valid vegetation samples')
    ndvi = float(np.median((bands['nir'][valid] - bands['red'][valid]) / denom[valid]))
    water_fraction = float((clear & (bands['scl'] == 6)).sum() / count)
    return {'forest_ndvi': round(ndvi, 3), 'vegetation_stress': round(max(0, min(1, (.75 - ndvi) / .55)), 3),
            'visible_water_fraction': round(water_fraction, 4),
            'forest_water_availability': round(min(1, water_fraction / .02), 3),
            'clear_coverage': round(coverage, 3), 'sample_count': count}


def satellite(end, cfg):
    from shapely.geometry import box, shape
    payload = get_json(STAC + '/search', {
        'collections': 'sentinel-2-c1-l2a', 'bbox': ','.join(map(str, cfg['study_area']['bbox'])),
        'datetime': f'{end - timedelta(days=29)}T00:00:00Z/{end}T23:59:59Z',
        'limit': 100, 'sortby': '-properties.datetime',
    })
    candidates = [f for f in payload.get('features', []) if f['properties'].get('eo:cloud_cover', 100) <= 40]
    if not candidates:
        raise ValueError('No Sentinel-2 scenes with ≤40% tile cloud cover in this 30-day window')
    # A neighbouring tile may touch the bbox while covering almost none of the
    # reserve. Filter by actual footprint overlap before comparing cloud cover.
    reserve = geo.reserve_geometry()
    target = (reserve.intersection(box(*cfg['study_area']['bbox'])) if reserve is not None
              else box(*cfg['study_area']['bbox']))
    candidates = [f for f in candidates if shape(f['geometry']).intersection(target).area / target.area >= .8]
    if not candidates:
        raise ValueError('No low-cloud scene covers at least 80% of the study-area reserve in this window')
    item = min(candidates, key=lambda f: f['properties']['eo:cloud_cover'])
    result = {'id': item['id'], 'acquired': item['properties']['datetime'],
              'cloud_cover_pct': item['properties']['eo:cloud_cover'],
              'thumbnail': item['assets'].get('thumbnail', {}).get('href'),
              'source_url': f"{STAC}/collections/{item['collection']}/items/{item['id']}"}
    return result


def fetch(end: date):
    with _LOCK:
        cached = _CACHE.get(end)
        if cached and monotonic() - cached[0] < 3600:
            result = dict(cached[1])
            result['errors'] = dict(result['errors'])
            return with_crops(result, end)
    cfg = load_config()
    result = {'date': end.isoformat(), 'retrieved': datetime.now(timezone.utc).isoformat(),
              'weather': None, 'satellite': None, 'errors': {},
              'scope': 'Shared forest measurements; village proximity and supplied crop records vary by village.'}
    for key, adapter in [('weather', weather), ('satellite', satellite)]:
        try:
            result[key] = adapter(end, cfg)
        except Exception as exc:
            result['errors'][key] = str(exc)
    with _LOCK:
        # Bound memory even when many different dates are requested.
        if len(_CACHE) >= 64:
            _CACHE.pop(next(iter(_CACHE)))
        _CACHE[end] = (monotonic(), result)
    return with_crops(dict(result), end)


def with_crops(result, end):
    result['errors'] = dict(result['errors'])
    try:
        result['crop_observations'] = crop_observations(end)
    except (ValueError, KeyError, OSError) as exc:
        result['crop_observations'] = {}
        result['errors']['crops'] = str(exc)
    return result


def analyse(end):
    """Load imagery metadata first; compute the slower indices separately."""
    result = fetch(end)
    scene = result.get('satellite')
    if not scene or 'indices' in scene:
        return result
    scene = dict(scene)
    scene.pop('indices_error', None)
    try:
        item = get_json(scene['source_url'], {})
        scene['indices'] = spectral_summary(item, load_config())
    except Exception as exc:
        scene['indices_error'] = str(exc)
    result = {**result, 'satellite': scene}
    with _LOCK:
        _CACHE[end] = (monotonic(), result)
    return result
