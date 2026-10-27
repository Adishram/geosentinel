"""SIMULATED elephant sightings and village phone alerts.

Nothing here is an observation or a real alert. Sightings are seeded Poisson
draws whose rate is a documented function of the illustrative scenario score.
Identical inputs (village, date, score, seed) always give identical events.
"""
from __future__ import annotations

import hashlib
import math
from datetime import date, datetime, time, timedelta
from typing import Optional

import geopandas as gpd
import numpy as np
from shapely.geometry import Point
from shapely.ops import nearest_points

from . import geo
from .engine import buffer_distance_m

NIGHT_HOURS = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5]
HEADLINES = {"watch": "Elephant watch", "alert": "Elephant alert", "urgent": "URGENT elephant alert"}


def expected_per_week(score: float, cfg: dict) -> float:
    s = cfg["sightings"]
    t = max(0.0, min(1.0, score / 100.0)) ** s["exponent"]
    return s["base_per_week"] + (s["max_per_week"] - s["base_per_week"]) * t


def alert_level(score: float, cfg: dict) -> Optional[str]:
    level = None
    for name, lower in sorted(cfg["alerts"]["levels"].items(), key=lambda kv: kv[1]):
        if score >= lower:
            level = name
    return level


def _rng(*parts) -> np.random.Generator:
    digest = hashlib.sha256("|".join(str(p) for p in parts).encode()).digest()
    return np.random.default_rng(int.from_bytes(digest[:8], "big"))


def _reserve_projected(crs: str):
    res = geo.reserve_geometry()
    return None if res is None else gpd.GeoSeries([res], crs=geo.WGS84).to_crs(crs).iloc[0]


def simulate(villages: gpd.GeoDataFrame, scores: dict, end: date, cfg: dict, seed: int = 0):
    """Return ({village: summary}, [GeoJSON features]) for the window ending on `end`."""
    s, g = cfg["sightings"], cfg["geofence"]
    crs = g["projected_crs"]
    projected = villages.to_crs(crs)
    reserve = _reserve_projected(crs)
    summary, xy, props = {}, [], []
    for row, pt in zip(villages.itertuples(), projected.geometry):
        score = float(scores[row.name])
        rate_week = expected_per_week(score, cfg)
        rng = _rng(seed, row.name, end.isoformat(), round(score, 3))
        count = int(rng.poisson(rate_week * s["window_days"] / 7))
        buffer_m = buffer_distance_m(score, cfg)
        toward = None  # direction (radians) to nearest reserve edge for villages outside it
        if reserve is not None and not row.inside_reserve and s["forest_bias_kappa"] > 0:
            edge = nearest_points(pt, reserve)[1]
            toward = math.atan2(edge.y - pt.y, edge.x - pt.x)
        for i in range(count):
            theta = (rng.vonmises(toward, s["forest_bias_kappa"]) if toward is not None
                     else rng.uniform(-math.pi, math.pi))
            radius = g["footprint_radius_m"] + buffer_m * math.sqrt(rng.uniform(0.02, 0.97))
            hour = int(rng.choice(NIGHT_HOURS)) if rng.uniform() < s["night_share"] else int(rng.integers(6, 18))
            when = datetime.combine(end - timedelta(days=int(rng.integers(0, s["window_days"]))),
                                    time(hour, int(rng.integers(0, 60))))
            xy.append(Point(pt.x + radius * math.cos(theta), pt.y + radius * math.sin(theta)))
            props.append({"name": row.name, "id": f"{row.name}-{i + 1}", "when": when.isoformat(timespec="minutes"),
                          "distance_m": round(radius), "simulated": True})
        summary[row.name] = {"expected_sightings_week": round(rate_week, 2), "simulated_sightings": count,
                             "alert_level": alert_level(score, cfg)}
    features = []
    if xy:
        lonlat = gpd.GeoSeries(xy, crs=crs).to_crs(geo.WGS84)
        for p, q in zip(lonlat, props):
            features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [p.x, p.y]},
                             "properties": q})
    features.sort(key=lambda f: f["properties"]["when"], reverse=True)
    return summary, features


def alert_message(name: str, score: float, level: Optional[str], count: int, buffer_m: float, end: date):
    if level is None:
        return None
    return {"village": name, "level": level, "score": round(score, 1),
            "title": f"{HEADLINES[level]}: {name}",
            "body": (f"SIMULATION · Scenario score {score:.0f}/100. {count} simulated sighting"
                     f"{'' if count == 1 else 's'} within {buffer_m / 1000:.1f} km in the last 7 days. "
                     "Avoid forest-edge paths after dusk. Follow Forest Department guidance."),
            "issued": f"{end.isoformat()}T18:00", "simulated": True}
