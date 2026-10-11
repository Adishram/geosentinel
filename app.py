"""GeoSentinel — Mudumalai Village Risk Simulator (research simulation).

Run:  .venv/bin/streamlit run app.py
"""
from __future__ import annotations

from datetime import date, timedelta

import folium
import pandas as pd
import streamlit as st
from streamlit_folium import st_folium

from geosentinel import environment as env
from geosentinel import geo
from geosentinel.engine import (LABELS, RuleBasedScorer, ScenarioInputs, VillageContext,
                                buffer_distance_m, explain, load_config)

st.set_page_config(page_title="GeoSentinel — Mudumalai Village Risk Simulator", layout="wide")
st.markdown("""<style>
.banner{background:linear-gradient(90deg,#7c2d12,#b45309);color:#fff;padding:.5rem 1rem;border-radius:8px;
font-weight:600;position:sticky;top:2.8rem;z-index:999}
.obs{color:#0369a1;font-weight:600}.hyp{color:#b45309;font-weight:600}
</style>""", unsafe_allow_html=True)
st.markdown('<div class="banner">⚠️ Research simulation — not an operational warning. '
            'Scores are illustrative outputs of an assumed rule, not elephant-incursion probabilities.</div>',
            unsafe_allow_html=True)
st.title("GeoSentinel — Mudumalai Village Risk Simulator")

CFG = load_config()
SCORER = RuleBasedScorer(CFG)  # swap for a trained model implementing engine.Scorer later


@st.cache_data
def cached_layers():
    out = {n: geo.load_layer(n) for n in ["reserve", "forest", "roads", "water"]}
    return out


@st.cache_data
def cached_villages():
    return geo.load_villages(CFG)


try:
    VILLAGES = cached_villages()
except Exception as e:  # noqa: BLE001
    st.error(f"Geography cache unavailable: {e}")
    st.stop()
LAYERS = cached_layers()

# ---------------- presets (hypothetical) ----------------
PRESETS = {
    "Baseline conditions": dict(rain=120.0, veg=0.4, water=0.6, crop=0.4),
    "Dry conditions with reduced forest water": dict(rain=15.0, veg=0.8, water=0.2, crop=0.4),
    "Wetter conditions": dict(rain=300.0, veg=0.15, water=0.9, crop=0.4),
    "Mature crops near a forest-edge village": dict(rain=120.0, veg=0.4, water=0.6, crop=0.95),
}
DEFAULTS = dict(rain=120.0, veg=0.4, water=0.6, crop=0.4, veg_unknown=False, water_unknown=False,
                crop_unknown=False, rain_override=False)
for k, v in DEFAULTS.items():
    st.session_state.setdefault(k, v)


def apply_preset():
    p = PRESETS[st.session_state.preset]
    for k, v in p.items():
        st.session_state[k] = v
    st.session_state.rain_override = True  # preset rainfall is hypothetical


def reset_observed():
    st.session_state.rain_override = False
    for k in ("veg_unknown", "water_unknown", "crop_unknown"):
        st.session_state[k] = False


# ---------------- sidebar ----------------
sb = st.sidebar
sb.header("Scenario controls")
mode = sb.radio("Input mode", ["What-if simulation", "Environmental-data baseline"],
                help="Baseline mode fills rainfall from cached Open-Meteo reanalysis; other inputs remain assumptions.")
rng = env.data_range()
max_d = rng[1] if rng else date.today()
min_d = rng[0] + timedelta(days=30) if rng else date(1991, 2, 1)
sel_date = sb.date_input("Scenario date (end of 30-day window)", value=max_d, min_value=min_d, max_value=max_d)
obs = env.observe(sel_date) if mode == "Environmental-data baseline" else None

sb.selectbox("Hypothetical scenario preset", list(PRESETS), key="preset", on_change=apply_preset)
sb.caption("Presets are **hypothetical scenarios**, not observations.")

sb.subheader("Recent rainfall (30-day total, mm)")
use_obs_rain = mode == "Environmental-data baseline" and obs is not None and obs.ok and not st.session_state.rain_override
if mode == "Environmental-data baseline":
    if obs.ok:
        sb.markdown(f'<span class="obs">Observed (reanalysis): {obs.rainfall_30d_mm} mm</span>', unsafe_allow_html=True)
    else:
        sb.error(f"Rainfall data unavailable: {obs.message}")
    sb.checkbox("Override observed rainfall with a what-if value", key="rain_override")
    use_obs_rain = obs.ok and not st.session_state.rain_override
sb.slider("What-if rainfall (mm / 30 days)", 0.0, 500.0, step=5.0, key="rain", disabled=use_obs_rain,
          help="Low totals = user-defined dryness scenario (no drought index is computed here).")

sb.subheader("Forest vegetation condition")
sb.slider("Vegetation stress (0 = green, 1 = very dry)", 0.0, 1.0, step=0.05, key="veg",
          disabled=st.session_state.veg_unknown)
sb.checkbox("Unknown (exclude, do not treat as zero)", key="veg_unknown")
sb.caption("User assumption. Sentinel-2 NDVI integration is **pending** (needs Earth Engine credentials).")

sb.subheader("Forest water availability")
sb.slider("Water availability (0 = none, 1 = plentiful)", 0.0, 1.0, step=0.05, key="water",
          disabled=st.session_state.water_unknown)
sb.checkbox("Unknown ", key="water_unknown")
sb.caption("User assumption, not a measurement.")

sb.subheader("Nearby crop attractiveness / maturity")
sb.slider("Crop attractiveness (0 = none/young, 1 = mature)", 0.0, 1.0, step=0.05, key="crop",
          disabled=st.session_state.crop_unknown)
sb.checkbox("Unknown  ", key="crop_unknown")
sb.caption("User assumption, not a satellite observation.")

if mode == "Environmental-data baseline":
    sb.button("Reset to observed baseline", on_click=reset_observed)

ss = st.session_state
rain_val = obs.rainfall_30d_mm if use_obs_rain else (None if (mode == "Environmental-data baseline" and not obs.ok
                                                             and not ss.rain_override) else ss.rain)
inputs = ScenarioInputs(month=sel_date.month, rainfall_30d_mm=rain_val,
                        vegetation_stress=None if ss.veg_unknown else ss.veg,
                        forest_water_availability=None if ss.water_unknown else ss.water,
                        crop_attractiveness=None if ss.crop_unknown else ss.crop)
provenance = {"rainfall": "observed (Open-Meteo reanalysis)" if use_obs_rain else
              ("missing" if rain_val is None else "hypothetical"),
              "vegetation": "missing" if ss.veg_unknown else "hypothetical",
              "water": "missing" if ss.water_unknown else "hypothetical",
              "crop": "missing" if ss.crop_unknown else "hypothetical"}


def score_all(inp: ScenarioInputs):
    return {r.name: SCORER.score(inp, VillageContext(r.name, r.distance_to_forest_m))
            for r in VILLAGES.itertuples()}


results = score_all(inputs)

sb.divider()
if sb.button("💾 Save current as baseline", type="primary"):
    ss.baseline = {"inputs": inputs, "provenance": provenance, "date": sel_date}
if "baseline" not in ss:
    ss.baseline = {"inputs": inputs, "provenance": provenance, "date": sel_date}
if sb.button("Clear saved baseline"):
    ss.baseline = {"inputs": inputs, "provenance": provenance, "date": sel_date}
base_results = score_all(ss.baseline["inputs"])

selected = sb.multiselect("Villages to show", list(VILLAGES.name), default=list(VILLAGES.name))
focus = sb.selectbox("Explain village", selected or list(VILLAGES.name))

# ---------------- geometry ----------------
vsel = VILLAGES[VILLAGES.name.isin(selected)]
cur_gf = geo.geofences(vsel, {n: r.score for n, r in results.items()}, CFG) if len(vsel) else None
base_gf = geo.geofences(vsel, {n: r.score for n, r in base_results.items()}, CFG) if len(vsel) else None
fps = geo.footprints(vsel, CFG) if len(vsel) else None

COLORS = {"Low": "#16a34a", "Moderate": "#ca8a04", "Elevated": "#ea580c", "High": "#dc2626"}

col_map, col_side = st.columns([3, 1.3])
with col_map:
    m = folium.Map(location=[11.565, 76.58], zoom_start=12, tiles=None, control_scale=True)
    folium.TileLayer("OpenStreetMap", name="OSM standard tiles",
                     attr="© OpenStreetMap contributors (ODbL)").add_to(m)
    if LAYERS["forest"] is not None:
        f = LAYERS["forest"][LAYERS["forest"].geom_type.isin(["Polygon", "MultiPolygon"])]
        folium.GeoJson(f[["geometry"]], name="Forest cover (OSM landuse/natural)",
                       style_function=lambda _: {"color": "#166534", "weight": 0, "fillColor": "#22c55e",
                                                 "fillOpacity": 0.18}).add_to(m)
    if LAYERS["water"] is not None:
        folium.GeoJson(LAYERS["water"][["geometry", "name"]] if "name" in LAYERS["water"] else LAYERS["water"][["geometry"]],
                       name="Water features (OSM)",
                       style_function=lambda _: {"color": "#0284c7", "weight": 1.5, "fillColor": "#38bdf8",
                                                 "fillOpacity": 0.5}).add_to(m)
    if LAYERS["roads"] is not None:
        folium.GeoJson(LAYERS["roads"][["geometry"]], name="Roads (OSM)",
                       style_function=lambda _: {"color": "#57534e", "weight": 1.5}).add_to(m)
    if LAYERS["reserve"] is not None:
        folium.GeoJson(LAYERS["reserve"][["geometry", "name"]], name="Mudumalai National Park boundary (OSM)",
                       tooltip=folium.GeoJsonTooltip(["name"]),
                       style_function=lambda _: {"color": "#14532d", "weight": 3, "fill": False}).add_to(m)
    if base_gf is not None:
        g = folium.FeatureGroup("Baseline geofence (dashed)")
        for r in base_gf.itertuples():
            folium.GeoJson(r.geometry, style_function=lambda _: {"color": "#334155", "weight": 2,
                                                                 "dashArray": "6 6", "fill": False},
                           tooltip=f"{r.name} baseline: {r.buffer_m:.0f} m").add_to(g)
        g.add_to(m)
    if cur_gf is not None:
        g = folium.FeatureGroup("Current advisory geofence (solid)")
        for r in cur_gf.itertuples():
            cat = results[r.name].category
            folium.GeoJson(r.geometry, style_function=lambda _, c=COLORS[cat]: {
                "color": c, "weight": 3, "fillColor": c, "fillOpacity": 0.12},
                tooltip=f"{r.name}: score {r.score:.1f} ({cat}), buffer {r.buffer_m:.0f} m, {r.area_km2:.2f} km²").add_to(g)
        g.add_to(m)
        g2 = folium.FeatureGroup("Approx. settlement footprint + marker")
        for r in fps.itertuples():
            folium.GeoJson(r.geometry, style_function=lambda _: {"color": "#111827", "weight": 1,
                                                                 "fillColor": "#111827", "fillOpacity": 0.35},
                           tooltip=f"{r.name}: approximate footprint ({CFG['geofence']['footprint_radius_m']} m "
                                   "radius around OSM place node) — not an official boundary").add_to(g2)
            c = r.geometry.centroid
            folium.Marker([c.y, c.x], tooltip=r.name,
                          icon=folium.DivIcon(html=f'<div style="font-weight:700;font-size:12px;'
                                              f'text-shadow:0 0 3px #fff;white-space:nowrap">{r.name}</div>')).add_to(g2)
        g2.add_to(m)
    folium.LayerControl(collapsed=False).add_to(m)
    legend = "".join(f'<span style="color:{c}">■</span> {k} &nbsp;' for k, c in COLORS.items())
    st_folium(m, height=620, use_container_width=True, returned_objects=[], key="map")
    st.markdown(f"**Legend:** {legend} · solid = current geofence · dashed = saved baseline · "
                "dark disc = approximate settlement footprint · thick green line = reserve boundary",
                unsafe_allow_html=True)

with col_side:
    r = results[focus]
    b = base_results[focus]
    d_m = VILLAGES.set_index("name").loc[focus, "distance_to_forest_m"]
    st.subheader(focus)
    st.metric("Illustrative scenario score", f"{r.score:.1f} / 100", f"{r.score - b.score:+.1f} vs baseline")
    st.markdown(f"**Category:** <span style='color:{COLORS[r.category]}'>{r.category}</span>", unsafe_allow_html=True)
    bm, bbm = buffer_distance_m(r.score, CFG), buffer_distance_m(b.score, CFG)
    if cur_gf is not None and focus in set(cur_gf.name):
        area = cur_gf.set_index("name").loc[focus, "area_km2"]
        st.markdown(f"**Geofence buffer:** {bm:.0f} m ({bm - bbm:+.0f} m) · **area** {area:.2f} km²")
    st.markdown(f"**Distance to reserve boundary:** {'inside reserve (0 m)' if d_m == 0 else f'{d_m:,.0f} m'}")
    st.markdown("**Contributions (points):**")
    st.dataframe(pd.DataFrame({"factor": [LABELS[k] for k in r.contributions],
                               "normalised": [None if r.factors[k] is None else round(r.factors[k], 2) for k in r.contributions],
                               "points": list(r.contributions.values()),
                               "Δ vs base": [round(r.contributions[k] - b.contributions[k], 2) for k in r.contributions]}),
                 hide_index=True, use_container_width=True)
    st.markdown("**Why it changed**")
    for line in explain(r, b):
        st.markdown(f"- {line}")
    st.markdown("**Input provenance**")
    for k, v in provenance.items():
        cls = "obs" if v.startswith("observed") else "hyp"
        st.markdown(f"- {k}: <span class='{cls}'>{v}</span>", unsafe_allow_html=True)

st.subheader("Baseline vs scenario")
rows = []
for n in selected:
    c, bb = results[n], base_results[n]
    rows.append({"Village": n, "Base score": round(bb.score, 1), "Scenario score": round(c.score, 1),
                 "Δ score": round(c.score - bb.score, 1), "Category": c.category,
                 "Base buffer m": round(buffer_distance_m(bb.score, CFG)),
                 "Scenario buffer m": round(buffer_distance_m(c.score, CFG)),
                 "Area km²": round(cur_gf.set_index("name").loc[n, "area_km2"], 2),
                 "Missing inputs": ", ".join(c.missing) or "—"})
st.dataframe(pd.DataFrame(rows), hide_index=True, use_container_width=True)
st.caption(f"Saved baseline date: {ss.baseline['date']} · provenance: {ss.baseline['provenance']}")

tab1, tab2, tab3 = st.tabs(["Environmental data status", "Rule & geofence parameters", "Warning preview (simulated)"])
with tab1:
    st.markdown("**Open-Meteo Historical Weather API** — reanalysis-based (ERA5/ERA5-Land), *not* a direct satellite feed.")
    o = obs or env.observe(sel_date)
    st.write({"status": o.message, "measurement period": o.period, "30-day total (mm)": o.rainfall_30d_mm,
              "missing days": o.missing_days, "grid point (shared by all villages)": o.grid,
              "spatial resolution": "~0.1° ERA5-Land / ~0.25° ERA5 (Open-Meteo best-match)",
              "retrieved (UTC)": o.retrieved,
              "1991–2020 same-window mean (mm)": o.climatology_mm, "anomaly %": o.anomaly_pct,
              "reference years with data": o.ref_years_used})
    if o.anomaly_pct is None:
        st.info("Anomaly not computed (insufficient reference data) — low rainfall is treated as a "
                "user-defined dryness scenario only.")
    st.markdown("All villages share one coarse grid cell; no village-level rainfall variation is shown.")
    st.markdown("| Integration | Status |\n|---|---|\n| Open-Meteo rainfall | ✅ working (cached) |\n"
                "| CHIRPS rainfall | ⏳ pending |\n| Sentinel-2 NDVI | ⏳ pending (Earth Engine credentials not assumed) |\n"
                "| Forest water dataset | ⏳ pending — user assumption |")
    for n in ["reserve", "villages", "forest", "roads", "water"]:
        md = geo.layer_meta(n)
        st.caption(f"{n}: OSM via Overpass, retrieved {md.get('retrieved_utc', 'n/a')} — {md.get('licence', '')}")
with tab2:
    st.markdown("Buffer rule: `buffer_m = min_m + (max_m − min_m) × (score/100)^exponent`, applied outward from the "
                "approximate settlement footprint in UTM 43N metres. **Illustrative simulation rule — not a validated "
                "elephant travel distance or established warning radius.** Edit `config/scenario.yaml`.")
    st.json(CFG)
with tab3:
    st.caption("Preview only — no message is sent.")
    st.code(f"[SIMULATED ADVISORY — RESEARCH DEMO, NOT REAL]\nVillage: {focus}\n"
            f"Scenario category: {r.category} (score {r.score:.0f}/100)\n"
            f"Advisory zone: {bm:.0f} m around settlement\nDate: {sel_date}\n"
            "This is a hypothetical simulation output. Follow official Forest Department guidance.")
st.caption("Map data © OpenStreetMap contributors (ODbL). Weather data by Open-Meteo.com (CC BY 4.0). "
           "See DATA_SOURCES.md.")
