"""One-off, bounded downloader. Run once:  python -m geosentinel.fetch_data
Caches OSM features (Overpass API, ODbL) and Open-Meteo daily precipitation
into data/cache/. The Streamlit app only reads the cache (plus an explicit
"refresh weather" button), so sliders never hit external services.
"""
from __future__ import annotations

import json
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests
from shapely.geometry import LineString, Point, Polygon, mapping
from shapely.ops import linemerge, polygonize, unary_union

from .engine import load_config

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "cache"
UA = {"User-Agent": "GeoSentinel-college-research/0.1 (non-commercial study)"}
OVERPASS = "https://overpass-api.de/api/interpreter"


def overpass(q: str) -> dict:
    for attempt in range(3):
        r = requests.post(OVERPASS, data={"data": q}, headers=UA, timeout=180)
        if r.status_code == 200:
            return r.json()
        time.sleep(10 * (attempt + 1))
    r.raise_for_status()


def _way_line(w):
    return LineString([(p["lon"], p["lat"]) for p in w["geometry"]])


def _elem_to_geom(e):
    if e["type"] == "node":
        return Point(e["lon"], e["lat"])
    if e["type"] == "way":
        coords = [(p["lon"], p["lat"]) for p in e["geometry"]]
        if len(coords) >= 4 and coords[0] == coords[-1]:
            return Polygon(coords)
        return LineString(coords)
    if e["type"] == "relation":
        outers = [_way_line(m) for m in e.get("members", [])
                  if m["type"] == "way" and m.get("role", "outer") in ("outer", "") and "geometry" in m]
        inners = [_way_line(m) for m in e.get("members", [])
                  if m["type"] == "way" and m.get("role") == "inner" and "geometry" in m]
        if not outers:
            return None
        outer = unary_union(list(polygonize(linemerge(outers))))
        if inners:
            outer = outer.difference(unary_union(list(polygonize(linemerge(inners)))))
        return None if outer.is_empty else outer
    return None


def to_geojson(data: dict, keep_tags=("name", "name:ta", "place", "highway", "waterway",
                                       "natural", "landuse", "boundary", "protect_class",
                                       "leisure", "wikidata", "operator")) -> dict:
    feats = []
    for e in data.get("elements", []):
        g = _elem_to_geom(e)
        if g is None or g.is_empty:
            continue
        tags = e.get("tags", {})
        props = {k: tags[k] for k in keep_tags if k in tags}
        props["osm_id"] = f"{e['type']}/{e['id']}"
        feats.append({"type": "Feature", "geometry": mapping(g), "properties": props})
    return {"type": "FeatureCollection", "features": feats}


def save(name, gj, source, query):
    CACHE.mkdir(parents=True, exist_ok=True)
    gj["metadata"] = {"source": source, "query": query,
                      "retrieved_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                      "licence": "ODbL 1.0 — © OpenStreetMap contributors"}
    (CACHE / f"{name}.geojson").write_text(json.dumps(gj))
    print(f"saved {name}: {len(gj['features'])} features")


def fetch_osm(cfg):
    w, s, e, n = cfg["study_area"]["bbox"]
    bb = f"({s},{w},{n},{e})"
    queries = {
        "reserve": f'[out:json][timeout:120];(relation["boundary"~"protected_area|national_park"]["name"~"Mudumalai"]{bb};'
                   f'relation["leisure"="nature_reserve"]["name"~"Mudumalai"]{bb};'
                   f'way["boundary"~"protected_area|national_park"]["name"~"Mudumalai"]{bb};);out geom;',
        "villages": f'[out:json][timeout:60];node["place"~"village|hamlet|town|suburb"]{bb};out;',
        "roads": f'[out:json][timeout:120];way["highway"~"^(trunk|primary|secondary|tertiary|unclassified)$"]{bb};out geom;',
        "water": f'[out:json][timeout:120];(way["waterway"~"river|stream"]{bb};way["natural"="water"]{bb};relation["natural"="water"]{bb};);out geom;',
        "forest": f'[out:json][timeout:180];(way["landuse"="forest"]{bb};way["natural"="wood"]{bb};relation["landuse"="forest"]{bb};relation["natural"="wood"]{bb};);out geom;',
    }
    for name, q in queries.items():
        print("fetching", name, "...")
        save(name, to_geojson(overpass(q)), OVERPASS, q)
        time.sleep(5)  # be polite to the public Overpass instance


def fetch_weather(cfg, start="1991-01-01"):
    lat, lon = cfg["study_area"]["weather_point"]
    end = (date.today() - timedelta(days=7)).isoformat()  # archive lags a few days
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {"latitude": lat, "longitude": lon, "start_date": start, "end_date": end,
              "daily": "precipitation_sum", "timezone": "Asia/Kolkata"}
    r = requests.get(url, params=params, headers=UA, timeout=120)
    r.raise_for_status()
    d = r.json()
    d["_meta"] = {"url": r.url, "retrieved_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                  "licence": "CC BY 4.0 — Weather data by Open-Meteo.com (ERA5/ERA5-Land reanalysis, Copernicus)"}
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / "openmeteo_daily.json").write_text(json.dumps(d))
    print("saved weather:", len(d["daily"]["time"]), "days", start, "->", end,
          "grid point", d.get("latitude"), d.get("longitude"))
    return d


if __name__ == "__main__":
    cfg = load_config()
    what = sys.argv[1:] or ["osm", "weather"]
    if "osm" in what:
        fetch_osm(cfg)
    if "weather" in what:
        fetch_weather(cfg)
