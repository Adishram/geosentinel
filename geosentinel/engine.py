"""Deterministic, documented scenario-scoring engine.

Independent of the UI. To swap in a trained model later, implement the
`Scorer` protocol (a `score(inputs, context) -> ScoreResult` method) and pass it
to the app instead of `RuleBasedScorer`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Protocol

import yaml

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "scenario.yaml"


def load_config(path: Path = CONFIG_PATH) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


@dataclass(frozen=True)
class ScenarioInputs:
    """Environmental assumptions. None = missing/unknown (never treated as 0 risk)."""
    month: int
    rainfall_30d_mm: Optional[float]      # recent 30-day rainfall total
    vegetation_stress: Optional[float]    # 0 = lush/green, 1 = very dry/stressed
    forest_water_availability: Optional[float]  # 0 = none, 1 = plentiful (user assumption)
    crop_attractiveness: Optional[float]  # 0 = none/young, 1 = mature attractive crops (user assumption)


@dataclass(frozen=True)
class VillageContext:
    name: str
    distance_to_forest_m: float


@dataclass
class ScoreResult:
    score: float                     # 0-100 illustrative scenario score
    category: str
    contributions: dict = field(default_factory=dict)  # factor -> points (sum = score)
    factors: dict = field(default_factory=dict)        # factor -> normalised value or None
    missing: list = field(default_factory=list)


class Scorer(Protocol):
    def score(self, inputs: ScenarioInputs, ctx: VillageContext) -> ScoreResult: ...


def _clip01(x: float) -> float:
    return max(0.0, min(1.0, x))


def categorise(score: float, cfg: dict) -> str:
    cat = "Low"
    for name, lb in sorted(cfg["categories"].items(), key=lambda kv: kv[1]):
        if score >= lb:
            cat = name
    return cat


def seasonal_pressure(month: int, cfg: dict) -> Optional[float]:
    """Hypothetical month profile from config (None when disabled)."""
    season = cfg["score"].get("season", {})
    if not season.get("enabled", False):
        return None
    return _clip01(float(season["profile"][int(month)]))


class RuleBasedScorer:
    def __init__(self, cfg: Optional[dict] = None):
        self.cfg = cfg or load_config()

    def factors(self, i: ScenarioInputs, ctx: VillageContext) -> dict:
        s = self.cfg["score"]
        r = s["rainfall"]
        rain_dry = None
        if i.rainfall_30d_mm is not None:
            rain_dry = _clip01((r["wet_mm"] - i.rainfall_30d_mm) / (r["wet_mm"] - r["dry_mm"]))
        # dryness: blend available parts (rainfall, vegetation) -> single factor
        parts = {"rainfall": rain_dry, "vegetation": i.vegetation_stress}
        avail = {k: v for k, v in parts.items() if v is not None}
        dryness = None
        if avail:
            wsum = sum(s["dryness_blend"][k] for k in avail)
            dryness = sum(s["dryness_blend"][k] * v for k, v in avail.items()) / wsum
        water = None if i.forest_water_availability is None else _clip01(1 - i.forest_water_availability)
        crop = i.crop_attractiveness
        mc = s.get("month_crop_adjust", {})
        if crop is not None and mc.get("enabled"):
            crop = _clip01(crop + float(mc["values"].get(i.month, 0.0)))
        p = s["proximity"]
        prox = _clip01((p["far_m"] - ctx.distance_to_forest_m) / (p["far_m"] - p["near_m"]))
        out = {"dryness": dryness, "forest_water_scarcity": water,
               "crop_attractiveness": crop, "forest_proximity": prox}
        # Push/pull interaction: crops become a stronger draw when forest
        # resources are scarce. Require both scarcity measures; do not impute.
        if s.get("resource_pull", {}).get("enabled", False):
            out["resource_pull"] = (None if dryness is None or water is None or crop is None
                                    else crop * (0.6 * dryness + 0.4 * water))
        season = seasonal_pressure(i.month, self.cfg)
        if season is not None:  # disabled season factor is omitted, not "missing"
            out["seasonal_pressure"] = season
        return out

    def score(self, inputs: ScenarioInputs, ctx: VillageContext) -> ScoreResult:
        w = self.cfg["score"]["weights"]
        f = self.factors(inputs, ctx)
        missing = [k for k, v in f.items() if v is None]
        avail_w = sum(w.get(k, 0.0) for k in f if f[k] is not None)
        contrib = {}
        for k, v in f.items():
            contrib[k] = 0.0 if v is None or avail_w == 0 else 100.0 * w.get(k, 0.0) * v / avail_w
        total = round(sum(contrib.values()), 4)
        return ScoreResult(score=total, category=categorise(total, self.cfg),
                           contributions={k: round(v, 2) for k, v in contrib.items()},
                           factors=f, missing=missing)


def buffer_distance_m(score: float, cfg: dict) -> float:
    g = cfg["geofence"]
    t = _clip01(score / 100.0) ** g["exponent"]
    return g["min_m"] + (g["max_m"] - g["min_m"]) * t


LABELS = {
    "dryness": "Dryness (rainfall + vegetation)",
    "forest_water_scarcity": "Forest water scarcity",
    "crop_attractiveness": "Crop attractiveness",
    "forest_proximity": "Proximity to reserve",
    "seasonal_pressure": "Seasonal pressure (assumed month profile)",
    "resource_pull": "Resource scarcity × village crop attraction",
}


def explain(cur: ScoreResult, base: Optional[ScoreResult]) -> list[str]:
    """Plain-language explanation derived only from the actual contributions."""
    out = []
    if cur.missing:
        out.append("Missing inputs (" + ", ".join(LABELS[m] for m in cur.missing) +
                   ") were excluded and remaining weights re-normalised; they were NOT treated as zero.")
    if base is None:
        top = sorted(cur.contributions.items(), key=lambda kv: -kv[1])[:2]
        out.append("Largest contributions: " + "; ".join(f"{LABELS[k]} {v:.1f} pts" for k, v in top) + ".")
        return out
    d = cur.score - base.score
    if abs(d) < 0.05:
        out.append("Score unchanged from saved baseline.")
    else:
        out.append(f"Score {'rose' if d > 0 else 'fell'} by {abs(d):.1f} points versus the saved baseline.")
    deltas = {k: cur.contributions[k] - base.contributions.get(k, 0) for k in cur.contributions}
    for k, v in sorted(deltas.items(), key=lambda kv: -abs(kv[1])):
        if abs(v) >= 0.5:
            out.append(f"{LABELS[k]}: {'+' if v > 0 else ''}{v:.1f} pts under the assumed rule "
                       f"(an assumed association, not demonstrated causation).")
    return out
