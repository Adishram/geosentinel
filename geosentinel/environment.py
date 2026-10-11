"""Environmental baseline from cached Open-Meteo (ERA5 reanalysis) daily precipitation.

Only one grid point is used for all villages (they share a coarse grid cell);
no village-level variation is fabricated.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd

CACHE = Path(__file__).resolve().parent.parent / "data" / "cache" / "openmeteo_daily.json"
REF_YEARS = (1991, 2020)
WINDOW = 30


@dataclass
class RainfallObservation:
    ok: bool
    message: str
    rainfall_30d_mm: Optional[float] = None
    period: str = ""
    missing_days: int = 0
    climatology_mm: Optional[float] = None   # mean of same 30-day window over reference years
    anomaly_pct: Optional[float] = None
    ref_years_used: int = 0
    grid: str = ""
    retrieved: str = ""
    source_url: str = ""


def load_series() -> tuple[Optional[pd.Series], dict]:
    if not CACHE.exists():
        return None, {}
    d = json.loads(CACHE.read_text())
    s = pd.Series(d["daily"]["precipitation_sum"], index=pd.to_datetime(d["daily"]["time"]), dtype="float")
    meta = d.get("_meta", {})
    meta["grid"] = f"{d.get('latitude')}°N, {d.get('longitude')}°E (elev {d.get('elevation')} m)"
    return s, meta


def _window_sum(s: pd.Series, end: date) -> tuple[Optional[float], int]:
    start = end - timedelta(days=WINDOW - 1)
    w = s.loc[pd.Timestamp(start):pd.Timestamp(end)]
    expected = WINDOW
    missing = expected - int(w.notna().sum())
    if len(w) < expected or missing > 3:
        return None, missing if len(w) == expected else expected - int(w.notna().sum())
    return float(w.sum(skipna=True)), missing


def observe(end: date) -> RainfallObservation:
    s, meta = load_series()
    if s is None:
        return RainfallObservation(False, "No cached Open-Meteo data. Run `python -m geosentinel.fetch_data weather`.")
    common = dict(grid=meta.get("grid", ""), retrieved=meta.get("retrieved_utc", ""), source_url=meta.get("url", ""))
    total, missing = _window_sum(s, end)
    period = f"{(end - timedelta(days=WINDOW - 1)).isoformat()} → {end.isoformat()}"
    if total is None:
        return RainfallObservation(False, f"Insufficient data for {period} (cache covers "
                                   f"{s.index.min().date()} → {s.index.max().date()}; {missing} days missing).",
                                   period=period, missing_days=missing, **common)
    refs = []
    for y in range(REF_YEARS[0], REF_YEARS[1] + 1):
        try:
            e = end.replace(year=y)
        except ValueError:  # 29 Feb
            e = end.replace(year=y, day=28)
        v, _ = _window_sum(s, e)
        if v is not None:
            refs.append(v)
    clim = anom = None
    if len(refs) >= 25:  # require most of the 30-year reference period
        clim = sum(refs) / len(refs)
        anom = None if clim < 1 else 100 * (total - clim) / clim
    return RainfallObservation(True, "OK", round(total, 1), period, missing,
                               None if clim is None else round(clim, 1),
                               None if anom is None else round(anom, 1), len(refs), **common)


def data_range() -> Optional[tuple[date, date]]:
    s, _ = load_series()
    if s is None:
        return None
    return s.index.min().date(), s.index.max().date()
