"""Focused checks. Run: .venv/bin/python -m pytest -q"""
import geopandas as gpd
import pytest

from geosentinel import environment as env
from geosentinel import geo
from geosentinel.engine import RuleBasedScorer, ScenarioInputs, VillageContext, buffer_distance_m, load_config

CFG = load_config()
S = RuleBasedScorer(CFG)
BASE = ScenarioInputs(month=3, rainfall_30d_mm=120, vegetation_stress=0.4,
                      forest_water_availability=0.6, crop_attractiveness=0.4)
CTX = VillageContext("X", 1000.0)


def test_deterministic():
    assert S.score(BASE, CTX) == S.score(BASE, CTX)


def test_contributions_sum_to_score():
    r = S.score(BASE, CTX)
    assert abs(sum(r.contributions.values()) - r.score) < 0.05


def test_drier_scores_higher_and_buffer_grows():
    dry = ScenarioInputs(3, 10, 0.9, 0.1, 0.4)
    a, b = S.score(BASE, CTX).score, S.score(dry, CTX).score
    assert b > a and buffer_distance_m(b, CFG) > buffer_distance_m(a, CFG)


def test_missing_is_not_zero_risk():
    miss = ScenarioInputs(3, None, None, None, None)
    r = S.score(miss, CTX)
    assert set(r.missing) == {"dryness", "forest_water_scarcity", "crop_attractiveness"}
    assert r.score > 0  # proximity alone, re-normalised


def test_buffer_bounds():
    g = CFG["geofence"]
    assert buffer_distance_m(0, CFG) == g["min_m"] and buffer_distance_m(100, CFG) == g["max_m"]


@pytest.fixture(scope="module")
def villages():
    return geo.load_villages(CFG)


def test_villages_from_osm(villages):
    assert len(villages) == 6 and villages.geometry.notna().all()


def test_geofence_surrounds_village_with_metric_size(villages):
    scores = {n: 50.0 for n in villages.name}
    gf = geo.geofences(villages, scores, CFG)
    assert len(gf) == len(villages)  # one per village, not dissolved
    for pt, poly, d in zip(villages.geometry, gf.geometry, gf.buffer_m):
        assert poly.contains(pt)
    # radius check in metres
    utm = gpd.GeoSeries(gf.geometry, crs=4326).to_crs(CFG["geofence"]["projected_crs"])
    vutm = villages.to_crs(CFG["geofence"]["projected_crs"])
    for p, g, d in zip(vutm.geometry, utm, gf.buffer_m):
        r_expected = d + CFG["geofence"]["footprint_radius_m"]
        r_actual = (g.bounds[2] - g.bounds[0]) / 2
        assert abs(r_actual - r_expected) / r_expected < 0.02
        assert g.centroid.distance(p) < 5


def test_rainfall_missing_reported():
    from datetime import date
    o = env.observe(date(1900, 1, 1))
    assert not o.ok and o.rainfall_30d_mm is None
