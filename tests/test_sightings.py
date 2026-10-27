"""Simulated sightings, seasonal factor and alert checks. Run: pytest tests -q"""
from datetime import date

import pytest
from fastapi.testclient import TestClient
from shapely.geometry import Point, shape

from geosentinel import geo, sightings as sim
from geosentinel.api import app
from geosentinel.engine import RuleBasedScorer, ScenarioInputs, VillageContext, load_config

CFG = load_config()
CLIENT = TestClient(app)
BASE = {"date": "2026-10-01", "mode": "what-if", "rain_override": False, "rainfall_30d_mm": 120,
        "vegetation_stress": .4, "forest_water_availability": .6, "crop_attractiveness": .4}


@pytest.fixture(scope="module")
def villages():
    return geo.load_villages(CFG)


def test_season_does_not_double_count_measured_conditions():
    s, ctx = RuleBasedScorer(CFG), VillageContext("X", 1000.0)
    april = s.score(ScenarioInputs(4, 120, .4, .6, .4), ctx)
    july = s.score(ScenarioInputs(7, 120, .4, .6, .4), ctx)
    assert april.score == july.score
    assert "seasonal_pressure" not in april.contributions


def test_more_crops_less_water_and_vegetation_raise_score():
    s, ctx = RuleBasedScorer(CFG), VillageContext("X", 1000.0)
    base = s.score(ScenarioInputs(10, 120, .4, .6, .4), ctx).score
    assert s.score(ScenarioInputs(10, 120, .4, .6, .9), ctx).score > base
    assert s.score(ScenarioInputs(10, 120, .4, .1, .4), ctx).score > base
    assert s.score(ScenarioInputs(10, 120, .9, .6, .4), ctx).score > base


def test_season_can_be_disabled():
    cfg = load_config()
    cfg["score"]["season"]["enabled"] = False
    r = RuleBasedScorer(cfg).score(ScenarioInputs(4, 120, .4, .6, .4), VillageContext("X", 1000.0))
    assert "seasonal_pressure" not in r.contributions and "seasonal_pressure" not in r.missing


def test_expected_rate_monotonic_and_bounded():
    rates = [sim.expected_per_week(s, CFG) for s in range(0, 101, 10)]
    assert rates == sorted(rates)
    assert rates[0] == CFG["sightings"]["base_per_week"] and rates[-1] == CFG["sightings"]["max_per_week"]


def test_alert_levels():
    assert sim.alert_level(10, CFG) is None
    assert sim.alert_level(64.99, CFG) is None
    assert sim.alert_level(65, CFG) == "watch"
    assert sim.alert_level(79.99, CFG) == "watch"
    assert sim.alert_level(80, CFG) == "alert"
    assert sim.alert_level(90, CFG) == "urgent"


def test_sightings_deterministic_and_inside_geofence(villages):
    scores = {n: 85.0 for n in villages.name}
    a = sim.simulate(villages, scores, date(2026, 4, 30), CFG, seed=3)
    b = sim.simulate(villages, scores, date(2026, 4, 30), CFG, seed=3)
    assert a == b
    assert sim.simulate(villages, scores, date(2026, 4, 30), CFG, seed=4) != a
    fences = geo.geofences(villages, scores, CFG).set_index("name")
    assert a[1], "high scores should produce some simulated sightings"
    for f in a[1]:
        assert fences.loc[f["properties"]["name"], "geometry"].contains(shape(f["geometry"]))
        assert f["properties"]["simulated"] is True


def test_higher_scores_produce_more_sightings_on_average(villages):
    low = sum(len(sim.simulate(villages, {n: 20.0 for n in villages.name}, date(2026, 4, 30), CFG, k)[1]) for k in range(20))
    high = sum(len(sim.simulate(villages, {n: 90.0 for n in villages.name}, date(2026, 4, 30), CFG, k)[1]) for k in range(20))
    assert high > 3 * low


def test_api_returns_sightings_and_alerts():
    dry = {**BASE, "date": "2026-04-30", "rainfall_30d_mm": 5, "vegetation_stress": .9,
           "forest_water_availability": .1, "crop_attractiveness": .95}
    data = CLIENT.post("/api/scenario", json={"current": dry}).json()
    assert data["sightings"]["type"] == "FeatureCollection"
    assert data["alert_threshold"] == CFG["alerts"]["threshold"]
    assert data["alerts"], "extreme dry/crop scenario should raise at least one simulated alert"
    for alert in data["alerts"]:
        assert alert["simulated"] and alert["score"] >= CFG["alerts"]["threshold"]
    row = data["villages"][0]
    assert row["expected_sightings_week"] > 0 and row["simulated_sightings"] >= 0
    again = CLIENT.post("/api/scenario", json={"current": dry}).json()
    assert again["sightings"] == data["sightings"]
    rerolled = CLIENT.post("/api/scenario", json={"current": {**dry, "seed": 7}}).json()
    assert rerolled["villages"][0]["score"] == row["score"]
