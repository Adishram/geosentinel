from datetime import date

import pytest
from fastapi.testclient import TestClient

from geosentinel import live_data
from geosentinel.api import app
from geosentinel.engine import RuleBasedScorer, ScenarioInputs, VillageContext, load_config

CLIENT = TestClient(app)


def test_weather_rejects_incomplete_window(monkeypatch):
    monkeypatch.setattr(live_data, 'get_json', lambda *args: {'daily': {'time': ['2026-10-01'], 'precipitation_sum': [1]}})
    with pytest.raises(ValueError, match='complete 30-day'):
        live_data.weather(date(2026, 10, 1), load_config())


def test_source_failures_stay_missing(monkeypatch):
    live_data._CACHE.clear()
    def fail(*args):
        raise ValueError('offline')
    monkeypatch.setattr(live_data, 'get_json', fail)
    result = live_data.fetch(date(2026, 9, 1))
    assert result['weather'] is None and result['satellite'] is None
    assert set(result['errors']) == {'weather', 'satellite'}
    live_data._CACHE.clear()


def test_crop_records_use_latest_valid_date_and_expire(tmp_path):
    path = tmp_path / 'crops.csv'
    path.write_text('village,date,attractiveness,crop,source\nX,2026-09-01,0.2,rice,field\nX,2026-10-01,0.9,rice,field\nX,2026-10-05,0.1,rice,field\n')
    assert live_data.crop_observations(date(2026, 10, 2), path)['X']['attractiveness'] == .9
    assert live_data.crop_observations(date(2026, 12, 1), path) == {}


def test_compound_stress_strengthens_crop_effect():
    s = RuleBasedScorer()
    ctx = VillageContext('X', 1000)
    def crop_effect(rain, veg, water):
        return (s.score(ScenarioInputs(10, rain, veg, water, .9), ctx).score -
                s.score(ScenarioInputs(10, rain, veg, water, .1), ctx).score)
    assert crop_effect(10, .9, .1) > crop_effect(250, .1, .9)


def test_live_evidence_and_missing_input_alert_suppression(monkeypatch):
    bundle = {'weather': {'rainfall_30d_mm': 5}, 'satellite': {'indices': {'vegetation_stress': .95,
              'forest_water_availability': .05}}, 'crop_observations': {}, 'retrieved': '2026-10-01'}
    monkeypatch.setattr(live_data, 'fetch', lambda end: bundle)
    body = {'date': '2026-10-01', 'use_live_data': True, 'crop_attractiveness': .95}
    data = CLIENT.post('/api/scenario', json={'current': body}).json()
    assert data['current']['inputs']['rainfall_30d_mm'] == 5
    assert data['alerts'] and data['alert_threshold'] == 80
    bundle['satellite'] = None
    partial = CLIENT.post('/api/scenario', json={'current': body}).json()
    assert partial['alerts'] == []
    assert all(not row['alert_eligible'] for row in partial['villages'])
    assert partial['current']['inputs']['vegetation_stress'] is None


def test_live_baseline_snapshot_does_not_refetch(monkeypatch):
    def fail(end):
        raise AssertionError('baseline must not refresh')
    monkeypatch.setattr(live_data, 'fetch', fail)
    baseline = {'date': '2026-10-01', 'use_live_data': True, 'snapshot_captured': True,
                'live_data_snapshot': {'weather': {'rainfall_30d_mm': 42}, 'satellite': None}}
    response = CLIENT.post('/api/scenario', json={'current': {'date': '2026-10-01'}, 'baseline': baseline})
    assert response.status_code == 200
    assert response.json()['baseline']['inputs']['rainfall_30d_mm'] == 42


def test_scene_discovery_rejects_neighbour_tile_even_if_clearer(monkeypatch):
    from shapely.geometry import box, mapping
    cfg = load_config()
    target = box(*cfg['study_area']['bbox'])
    monkeypatch.setattr(live_data.geo, 'reserve_geometry', lambda: target)
    def item(name, geom, cloud):
        return {'id': name, 'collection': 'sentinel-2-c1-l2a', 'geometry': mapping(geom),
                'properties': {'datetime': '2026-10-01T00:00:00Z', 'eo:cloud_cover': cloud}, 'assets': {}}
    monkeypatch.setattr(live_data, 'get_json', lambda *args: {'features': [
        item('neighbour', box(76.74, 11.48, 76.8, 11.68), 0), item('reserve', target, 15)]})
    assert live_data.satellite(date(2026, 10, 1), cfg)['id'] == 'reserve'


def test_spectral_indices_apply_reflectance_offsets_and_cloud_mask(monkeypatch, tmp_path):
    import numpy as np
    import rasterio
    from rasterio.transform import from_bounds
    from shapely.geometry import box
    cfg = load_config()
    bounds = cfg['study_area']['bbox']
    monkeypatch.setattr(live_data.geo, 'reserve_geometry', lambda: box(*bounds))
    assets = {}
    original_open = rasterio.open
    for key, value in [('red', 2000), ('nir', 6000), ('scl', 4)]:
        path = tmp_path / f'{key}.tif'
        array = np.full((128, 128), value, dtype='uint16')
        if key == 'scl':
            array[:32] = 8  # cloudy quarter must be excluded
            array[32:40] = 6  # water contributes to water area, not NDVI
        with original_open(path, 'w', driver='GTiff', width=128, height=128, count=1,
                           dtype='uint16', crs='EPSG:4326', transform=from_bounds(*bounds, 128, 128), nodata=0) as dst:
            dst.write(array, 1)
        assets[key] = {'href': f'https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/{key}.tif',
                       'raster:bands': [{'scale': .0001, 'offset': -.1}]}
    monkeypatch.setattr(rasterio, 'open', lambda href, **kwargs: original_open(tmp_path / href.rsplit('/', 1)[1]))
    result = live_data.spectral_summary({'assets': assets}, cfg)
    assert result['forest_ndvi'] == pytest.approx(.667, abs=.001)
    assert result['clear_coverage'] == .75
    assert result['visible_water_fraction'] == pytest.approx(8 / 96, abs=.0001)
