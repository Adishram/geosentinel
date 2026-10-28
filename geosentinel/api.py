"""Local HTTP adapter. Scientific calculations remain in engine/geo/environment/sightings."""
from __future__ import annotations

import json
import math
from dataclasses import asdict, replace
from datetime import date, timedelta
from functools import lru_cache
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

from . import environment as env, geo, sightings as sim
from .engine import LABELS, RuleBasedScorer, ScenarioInputs, VillageContext, explain, load_config
from . import live_data

DISCLAIMER = "Research simulation — not an operational warning. Scores are illustrative rule outputs, not incursion probabilities."
PRESETS = {
    "Baseline conditions": dict(rainfall_30d_mm=120.0, vegetation_stress=0.4, forest_water_availability=0.6, crop_attractiveness=0.4),
    "Dry conditions with reduced forest water": dict(rainfall_30d_mm=15.0, vegetation_stress=0.8, forest_water_availability=0.2, crop_attractiveness=0.4),
    "Wetter conditions": dict(rainfall_30d_mm=300.0, vegetation_stress=0.15, forest_water_availability=0.9, crop_attractiveness=0.4),
    "Mature crops near a forest-edge village": dict(rainfall_30d_mm=120.0, vegetation_stress=0.4, forest_water_availability=0.6, crop_attractiveness=0.95),
}


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    date: date
    mode: Literal["what-if", "environmental"] = "what-if"
    rain_override: bool = False
    rainfall_30d_mm: float | None = Field(default=120, ge=0, le=500)
    vegetation_stress: float | None = Field(default=0.4, ge=0, le=1)
    forest_water_availability: float | None = Field(default=0.6, ge=0, le=1)
    crop_attractiveness: float | None = Field(default=0.4, ge=0, le=1)
    seed: int = Field(default=0)
    use_live_data: bool = False


class SavedScenario(Scenario):
    """Rainfall snapshot keeps saved comparisons stable if the cache is refreshed."""
    snapshot_captured: bool = False
    rainfall_snapshot: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    observation_snapshot: env.RainfallObservation | None = None
    live_data_snapshot: dict[str, Any] | None = None


class ScenarioRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current: Scenario
    baseline: SavedScenario | None = None


class VillageResult(BaseModel):
    name: str
    osm_id: str
    coordinates: list[float]
    inside_reserve: bool
    distance_to_forest_m: float
    score: float
    category: str
    contributions: dict[str, float]
    factors: dict[str, float | None]
    missing: list[str]
    buffer_m: float
    area_km2: float
    baseline_score: float | None
    baseline_buffer_m: float | None
    delta: float | None
    contribution_deltas: dict[str, float] | None
    explanation: list[str]
    expected_sightings_week: float = 0.0
    simulated_sightings: int = 0
    alert_level: str | None = None
    advisory: str
    alert_eligible: bool = False
    alert_suppression_reason: str | None = None
    crop_source: str = "hypothetical"


class ScenarioResponse(BaseModel):
    current: dict[str, Any]
    baseline: dict[str, Any] | None
    villages: list[VillageResult]
    geofences: dict[str, Any]
    baseline_geofences: dict[str, Any] | None
    sightings: dict[str, Any]
    alerts: list[dict[str, Any]]
    alert_threshold: float
    disclaimer: str


app = FastAPI(title="GeoSentinel research API", version="1.0.0", description=DISCLAIMER)


@lru_cache(maxsize=1)
def resources():
    cfg = load_config()
    try:
        villages = geo.load_villages(cfg)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(503, f"Geographic cache unavailable: {exc}") from exc
    if not all(math.isfinite(float(d)) for d in villages.distance_to_forest_m):
        raise HTTPException(503, "Reserve geometry unavailable; proximity cannot be scored honestly.")
    return cfg, villages, RuleBasedScorer(cfg)


def collection(frame):
    return json.loads(frame.to_json(drop_id=True))


def resolve(scenario: Scenario):
    observation = (scenario.observation_snapshot if isinstance(scenario, SavedScenario)
                   and scenario.snapshot_captured and scenario.observation_snapshot is not None else env.observe(scenario.date))
    observed = scenario.mode == "environmental" and not scenario.rain_override
    rain = (scenario.rainfall_snapshot if isinstance(scenario, SavedScenario) and scenario.snapshot_captured
            else observation.rainfall_30d_mm) if observed else scenario.rainfall_30d_mm
    inputs = ScenarioInputs(scenario.date.month, rain, scenario.vegetation_stress,
                            scenario.forest_water_availability, scenario.crop_attractiveness)
    provenance = {
        "rainfall": "missing" if rain is None else "observed (Open-Meteo reanalysis)" if observed else "hypothetical",
        "vegetation": "missing" if inputs.vegetation_stress is None else "hypothetical",
        "water": "missing" if inputs.forest_water_availability is None else "hypothetical",
        "crop": "missing" if inputs.crop_attractiveness is None else "hypothetical",
    }
    live = None
    if scenario.use_live_data:
        live = (scenario.live_data_snapshot if isinstance(scenario, SavedScenario)
                and scenario.snapshot_captured else live_data.fetch(scenario.date))
        live = live or {}
        weather = live.get("weather") or {}
        indices = (live.get("satellite") or {}).get("indices") or {}
        rain = weather.get("rainfall_30d_mm")
        inputs = ScenarioInputs(scenario.date.month, rain, indices.get("vegetation_stress"),
                                indices.get("forest_water_availability"), scenario.crop_attractiveness)
        provenance.update(rainfall="Open-Meteo reanalysis" if rain is not None else "missing",
                          vegetation="Sentinel-2 NDVI proxy" if inputs.vegetation_stress is not None else "missing",
                          water="Sentinel-2 visible-water proxy" if inputs.forest_water_availability is not None else "missing")
        observation = env.RainfallObservation(rain is not None, weather.get("period", "Live rainfall unavailable"),
                                             rain, period=weather.get("period", ""),
                                             source_url=weather.get("source_url", ""), retrieved=live.get("retrieved", ""))
    return inputs, {"scenario": scenario.model_dump(mode="json"), "inputs": asdict(inputs),
                    "provenance": provenance, "missing_inputs": [k for k, v in provenance.items() if v == "missing"],
                    "observation": asdict(observation), "live_data": live}


@app.get("/api/health")
def health():
    resources()
    return {"status": "ok", "disclaimer": DISCLAIMER}


@app.get("/api/bootstrap")
def bootstrap():
    cfg, villages, _ = resources()
    rng = env.data_range()
    documents = {name: (geo.ROOT / f"{name}.md").read_text(encoding="utf-8")
                 for name in ("ASSUMPTIONS", "DATA_SOURCES", "HANDOFF")}
    return {"config": cfg, "labels": LABELS, "presets": PRESETS,
            "date_range": {"min": (rng[0] + timedelta(days=29)).isoformat() if rng else None,
                           "max": rng[1].isoformat() if rng else None},
            "villages": collection(villages), "footprints": collection(geo.footprints(villages, cfg)),
            "layers": {name: layer(name) for name in ("reserve", "forest", "roads", "water")},
            "sources": {name: geo.layer_meta(name) for name in ("reserve", "villages", "forest", "roads", "water")},
            "documents": documents,
            "alerts": cfg.get("alerts", {}),
            "sightings": cfg.get("sightings", {}),
            "disclaimer": DISCLAIMER}


@app.get("/api/villages")
def villages():
    return collection(resources()[1])


@app.get("/api/layers/{name}")
def layer(name: Literal["reserve", "forest", "roads", "water"]):
    file = geo.layer_path(name)
    return json.loads(file.read_text(encoding="utf-8")) if file.exists() else None


@app.get("/api/environment/{end}")
def observation(end: date):
    return asdict(env.observe(end))


@app.get("/api/live-environment/{end}")
def live_environment(end: date):
    if end > date.today() or end < date(2017, 1, 1):
        raise HTTPException(422, "Choose a date from 2017 through today; recent reanalysis may be incomplete.")
    return live_data.fetch(end)


@app.get("/api/satellite-analysis/{end}")
def satellite_analysis(end: date):
    if end > date.today() or end < date(2017, 1, 1):
        raise HTTPException(422, "Choose a date from 2017 through today.")
    return live_data.analyse(end)


@app.post("/api/scenario", response_model=ScenarioResponse)
def scenario(request: ScenarioRequest):
    cfg, village_frame, scorer = resources()
    inputs, current = resolve(request.current)
    base_inputs, baseline = resolve(request.baseline) if request.baseline else (None, None)
    def village_inputs(shared, resolved, name):
        record = ((resolved.get("live_data") or {}).get("crop_observations") or {}).get(name)
        return replace(shared, crop_attractiveness=record["attractiveness"]) if record else shared

    scores = {r.name: scorer.score(village_inputs(inputs, current, r.name), VillageContext(r.name, r.distance_to_forest_m))
              for r in village_frame.itertuples()}
    base_scores = {r.name: scorer.score(village_inputs(base_inputs, baseline, r.name), VillageContext(r.name, r.distance_to_forest_m))
                   for r in village_frame.itertuples()} if base_inputs else {}
    fences = geo.geofences(village_frame, {k: v.score for k, v in scores.items()}, cfg)
    base_fences = geo.geofences(village_frame, {k: v.score for k, v in base_scores.items()}, cfg) if base_inputs else None

    # Simulate sightings & alerts
    sim_summary, sim_features = sim.simulate(
        village_frame,
        {k: v.score for k, v in scores.items()},
        request.current.date,
        cfg,
        seed=request.current.seed,
    )
    alert_threshold = float(cfg.get("alerts", {}).get("threshold", 65.0))
    alerts = []

    rows = []
    for village, fence in zip(village_frame.itertuples(), fences.itertuples()):
        result, base = scores[village.name], base_scores.get(village.name)
        base_buffer = float(base_fences.loc[base_fences.name == village.name, "buffer_m"].iloc[0]) if base is not None else None
        v_sim = sim_summary.get(village.name, {})

        actual_inputs = village_inputs(inputs, current, village.name)
        complete = all(value is not None for value in (actual_inputs.rainfall_30d_mm, actual_inputs.vegetation_stress,
                       actual_inputs.forest_water_availability, actual_inputs.crop_attractiveness))
        if complete and result.score >= alert_threshold:
            alert_msg = sim.alert_message(
                village.name,
                result.score,
                v_sim.get("alert_level") or "alert",
                v_sim.get("simulated_sightings", 0),
                float(fence.buffer_m),
                request.current.date,
            )
            if alert_msg:
                alerts.append(alert_msg)

        rows.append({
            "name": village.name, "osm_id": village.osm_id,
            "coordinates": [village.geometry.x, village.geometry.y],
            "inside_reserve": bool(village.inside_reserve), "distance_to_forest_m": float(village.distance_to_forest_m),
            **asdict(result), "buffer_m": float(fence.buffer_m), "area_km2": float(fence.area_km2),
            "baseline_score": base.score if base else None, "baseline_buffer_m": base_buffer,
            "delta": round(result.score - base.score, 4) if base else None,
            "contribution_deltas": {k: round(v - base.contributions[k], 2) for k, v in result.contributions.items()} if base else None,
            "explanation": explain(result, base),
            "expected_sightings_week": v_sim.get("expected_sightings_week", 0.0),
            "simulated_sightings": v_sim.get("simulated_sightings", 0),
            "alert_level": v_sim.get("alert_level") if complete else None,
            "alert_eligible": complete,
            "alert_suppression_reason": None if complete else "Environmental inputs incomplete; score is partial and alerts are suppressed.",
            "crop_source": ("dated village field record" if village.name in ((current.get("live_data") or {}).get("crop_observations") or {})
                            else "missing" if actual_inputs.crop_attractiveness is None else "hypothetical slider assumption"),
            "advisory": f"[SIMULATED ADVISORY — RESEARCH DEMO, NOT REAL]\nVillage: {village.name}\n"
                        f"Scenario category: {result.category} (score {result.score:.0f}/100)\n"
                        f"Advisory zone: {fence.buffer_m:.0f} m around approximate settlement\nDate: {request.current.date}\n"
                        "Hypothetical simulation output. Follow official Forest Department guidance. No message is sent."
        })
    gj = collection(fences)
    for feature in gj["features"]:
        feature["properties"]["category"] = scores[feature["properties"]["name"]].category

    return {
        "current": current, "baseline": baseline, "villages": rows, "geofences": gj,
        "baseline_geofences": collection(base_fences) if base_fences is not None else None,
        "sightings": {"type": "FeatureCollection", "features": sim_features},
        "alerts": alerts,
        "alert_threshold": alert_threshold,
        "disclaimer": DISCLAIMER,
    }


@app.post("/api/video-detection")
async def video_detection(request: Request, village: str):
    import tempfile
    from pathlib import Path
    from starlette.concurrency import run_in_threadpool
    from .video import detect
    if village not in set(resources()[1].name):
        raise HTTPException(422, "Select a known village.")
    path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as upload:
            path = Path(upload.name)
            size = 0
            async for chunk in request.stream():
                size += len(chunk)
                if size > 100 * 1024 * 1024:
                    raise HTTPException(413, "Maximum upload size is 100 MB.")
                upload.write(chunk)
        if not size:
            raise HTTPException(422, "Upload a video first.")
        result = await run_in_threadpool(detect, path)
        return {**result, "village": village, "simulation": True}
    except ImportError as exc:
        raise HTTPException(503, "Install video detection dependencies: .venv/bin/python -m pip install -r requirements-api.txt") from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, "Video detector unavailable. On first use, internet access is needed to download the pretrained model.") from exc
    finally:
        if path:
            path.unlink(missing_ok=True)


# Same-origin production frontend; API routes above take precedence.
FRONTEND_DIST = geo.ROOT / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
