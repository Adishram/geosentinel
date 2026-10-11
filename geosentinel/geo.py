"""Geographic operations: cached layers, village footprints, metre-based geofences."""
from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import yaml
from shapely.ops import unary_union

from .engine import buffer_distance_m

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "cache"
WGS84 = "EPSG:4326"


def layer_path(name: str) -> Path:
    return CACHE / f"{name}.geojson"


def load_layer(name: str) -> gpd.GeoDataFrame | None:
    p = layer_path(name)
    if not p.exists():
        return None
    gdf = gpd.read_file(p)
    return gdf.set_crs(WGS84, allow_override=True)


def layer_meta(name: str) -> dict:
    p = layer_path(name)
    if not p.exists():
        return {}
    return json.loads(p.read_text()).get("metadata", {})


def reserve_geometry():
    r = load_layer("reserve")
    if r is None or r.empty:
        return None
    polys = r[r.geom_type.isin(["Polygon", "MultiPolygon"])]
    return unary_union(polys.geometry.values) if not polys.empty else None


def load_villages(cfg: dict) -> gpd.GeoDataFrame:
    """Selected villages from cached OSM nodes + distance to reserve (metres)."""
    sel = yaml.safe_load((ROOT / "config" / "villages.yaml").read_text())["villages"]
    allv = load_layer("villages")
    if allv is None:
        raise FileNotFoundError("data/cache/villages.geojson missing — run: python -m geosentinel.fetch_data osm")
    ids = [v["osm_id"] for v in sel]
    v = allv[allv["osm_id"].isin(ids)].drop_duplicates("osm_id").copy()
    missing = set(ids) - set(v["osm_id"])
    if missing:
        raise ValueError(f"Villages not found in cache: {missing}")
    v["order"] = v["osm_id"].map({k: i for i, k in enumerate(ids)})
    v = v.sort_values("order").reset_index(drop=True)
    crs = cfg["geofence"]["projected_crs"]
    vp = v.to_crs(crs)
    res = reserve_geometry()
    if res is not None:
        res_p = gpd.GeoSeries([res], crs=WGS84).to_crs(crs).iloc[0]
        v["inside_reserve"] = [res_p.contains(pt) for pt in vp.geometry]
        v["distance_to_forest_m"] = [0.0 if inside else pt.distance(res_p.boundary)
                                     for pt, inside in zip(vp.geometry, v["inside_reserve"])]
    else:
        v["inside_reserve"] = False
        v["distance_to_forest_m"] = float("nan")
    return v[["osm_id", "name", "geometry", "inside_reserve", "distance_to_forest_m"]]


def footprints(villages: gpd.GeoDataFrame, cfg: dict) -> gpd.GeoDataFrame:
    """Approximate settlement footprint = point buffer (clearly NOT an official boundary)."""
    crs = cfg["geofence"]["projected_crs"]
    p = villages.to_crs(crs).copy()
    p["geometry"] = p.geometry.buffer(cfg["geofence"]["footprint_radius_m"], resolution=32)
    return p.to_crs(WGS84)


def geofences(villages: gpd.GeoDataFrame, scores: dict, cfg: dict) -> gpd.GeoDataFrame:
    """One advisory geofence per village (rows kept separate, never dissolved).

    geofence = approximate footprint buffered outward by buffer_distance_m(score),
    computed in a metre-based UTM CRS, then reprojected to WGS84.
    """
    crs = cfg["geofence"]["projected_crs"]
    fp = footprints(villages, cfg).to_crs(crs)
    dists = [buffer_distance_m(scores[n], cfg) for n in fp["name"]]
    fp["buffer_m"] = dists
    fp["score"] = [scores[n] for n in fp["name"]]
    fp["geometry"] = [g.buffer(d, resolution=32) for g, d in zip(fp.geometry, dists)]
    fp["area_km2"] = fp.geometry.area / 1e6
    return fp.to_crs(WGS84)
