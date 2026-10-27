"""Adapter parity, geography, environmental provenance and HTTP validation."""
from datetime import date

import pytest
from fastapi.testclient import TestClient
from shapely.geometry import shape

from geosentinel import environment as env, geo
from geosentinel.api import app, resources
from geosentinel.engine import RuleBasedScorer, ScenarioInputs, VillageContext, load_config

CLIENT = TestClient(app)
BASE = {"date": "2026-10-01", "mode": "what-if", "rain_override": False,
        "rainfall_30d_mm": 120, "vegetation_stress": .4,
        "forest_water_availability": .6, "crop_attractiveness": .4}


def calculate(current=None, baseline=None):
    response = CLIENT.post("/api/scenario", json={"current": current or BASE, "baseline": baseline})
    assert response.status_code == 200, response.text
    return response.json()


def test_bootstrap_all_villages_and_cached_layers():
    data = CLIENT.get("/api/bootstrap").json()
    assert len(data["villages"]["features"]) == 6
    assert set(data["layers"]) == {"reserve", "forest", "roads", "water"}
    assert data["date_range"]["max"] == env.data_range()[1].isoformat()
    assert "not incursion probabilities" in data["disclaimer"]
    assert "ASSUMPTIONS" in data["documents"]


def test_exact_engine_and_geofence_parity():
    data = calculate()
    cfg = load_config()
    villages = geo.load_villages(cfg)
    scorer = RuleBasedScorer(cfg)
    inputs = ScenarioInputs(10, 120, .4, .6, .4)
    results = {v.name: scorer.score(inputs, VillageContext(v.name, v.distance_to_forest_m)) for v in villages.itertuples()}
    expected = geo.geofences(villages, {name: result.score for name, result in results.items()}, cfg)
    for row, fence, village, feature in zip(data["villages"], expected.itertuples(), villages.itertuples(), data["geofences"]["features"]):
        assert row["score"] == results[row["name"]].score
        assert row["contributions"] == results[row["name"]].contributions
        assert row["coordinates"] == [village.geometry.x, village.geometry.y]
        assert row["buffer_m"] == fence.buffer_m
        assert row["area_km2"] == fence.area_km2
        assert shape(feature["geometry"]).equals_exact(fence.geometry, tolerance=1e-10)
        assert shape(feature["geometry"]).contains(village.geometry)
        assert row["baseline_score"] is None


def test_dry_preset_changes_outputs_and_baseline():
    dry = {**BASE, "rainfall_30d_mm": 15, "vegetation_stress": .8, "forest_water_availability": .2}
    data = calculate(dry, BASE)
    assert len(data["baseline_geofences"]["features"]) == 6
    for row in data["villages"]:
        assert row["score"] > row["baseline_score"]
        assert row["buffer_m"] > row["baseline_buffer_m"]
        assert row["delta"] == pytest.approx(row["score"] - row["baseline_score"])
        assert any("rose" in line for line in row["explanation"])
        assert "SIMULATED ADVISORY" in row["advisory"] and "No message is sent" in row["advisory"]
    assert calculate(dry)["baseline_geofences"] is None


def test_environmental_mode_uses_cached_rainfall_and_override_is_hypothetical():
    observed = calculate({**BASE, "mode": "environmental"})
    assert observed["current"]["inputs"]["rainfall_30d_mm"] == env.observe(date(2026, 10, 1)).rainfall_30d_mm
    assert observed["current"]["provenance"]["rainfall"].startswith("observed")
    override = calculate({**BASE, "mode": "environmental", "rain_override": True})
    assert override["current"]["inputs"]["rainfall_30d_mm"] == 120
    assert override["current"]["provenance"]["rainfall"] == "hypothetical"


def test_missing_sub_inputs_and_insufficient_weather():
    partial = calculate({**BASE, "vegetation_stress": None})
    assert "vegetation" in partial["current"]["missing_inputs"]
    assert partial["villages"][0]["factors"]["dryness"] is not None
    missing = calculate({**BASE, "rainfall_30d_mm": None, "vegetation_stress": None,
                         "forest_water_availability": None, "crop_attractiveness": None})
    assert missing["villages"][0]["score"] > 0
    assert set(missing["villages"][0]["missing"]) == {"dryness", "forest_water_scarcity", "crop_attractiveness", "resource_pull"}
    unavailable = calculate({**BASE, "date": "1900-01-01", "mode": "environmental"})
    assert unavailable["current"]["inputs"]["rainfall_30d_mm"] is None
    assert unavailable["current"]["provenance"]["rainfall"] == "missing"
    assert not unavailable["current"]["observation"]["ok"]


def test_saved_observed_snapshot_is_stable(monkeypatch):
    baseline = {**BASE, "mode": "environmental", "snapshot_captured": True, "rainfall_snapshot": 73.2}
    data = calculate(BASE, baseline)
    assert data["baseline"]["inputs"]["rainfall_30d_mm"] == 73.2
    assert data["baseline"]["provenance"]["rainfall"].startswith("observed")
    monkeypatch.setattr(env, "observe", lambda end: env.RainfallObservation(True, "OK", 999.0))
    assert calculate(BASE, baseline)["baseline"]["inputs"]["rainfall_30d_mm"] == 73.2


@pytest.mark.parametrize("patch", [{"vegetation_stress": 2}, {"rainfall_30d_mm": -1}, {"mode": "live"}, {"date": "bad"}, {"secret": "invalid"}])
def test_invalid_requests_rejected(patch):
    response = CLIENT.post("/api/scenario", json={"current": {**BASE, **patch}})
    assert response.status_code == 422


def test_layer_route_is_bounded():
    assert CLIENT.get("/api/layers/roads").status_code == 200
    assert CLIENT.get("/api/layers/unknown").status_code == 422


def test_missing_reserve_fails_honestly(monkeypatch):
    resources.cache_clear()
    villages = geo.load_villages(load_config())
    villages["distance_to_forest_m"] = float("nan")
    monkeypatch.setattr(geo, "load_villages", lambda cfg: villages)
    response = CLIENT.get("/api/health")
    assert response.status_code == 503
    resources.cache_clear()
