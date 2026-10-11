# Handoff notes (for Codex or the next developer)

## State (2026-10-08)
- Working: OSM map, per-village UTM geofences, what-if controls + hypothetical presets, rule-based scoring with contributions/explanations, save/clear baseline, dashed baseline vs solid current geofence, comparison table, Open-Meteo rainfall baseline with 1991–2020 anomaly, "Reset to observed baseline", missing-input handling, simulated advisory preview (nothing is sent).
- Verified: `pytest` 8/8 passed. A headless Streamlit `AppTest` run raised no exceptions; the dry preset raised the score (+18.5) and buffers; baseline mode and reset work; the server returns HTTP 200. The page has **not** been visually inspected in a browser by the agent.

## Next steps
1. Sentinel-2 NDVI via Earth Engine (needs a user GEE project): add `geosentinel/vegetation.py` returning a cloud-screened composite value + image date; feed it into `ScenarioInputs.vegetation_stress` with provenance "observed".
2. CHIRPS as an alternative rainfall source (0.05°).
3. Show sub-input missingness (e.g. vegetation unknown while rainfall is known still yields a `dryness` value, so the factor is not listed as missing).
4. Trained model: implement the `engine.Scorer` protocol (`score(inputs, ctx) -> ScoreResult`) and replace `SCORER` in `app.py`. Do this only with dated local incursion records.
5. Replace the approximate footprints with OSM `landuse=residential` polygons where they exist.

## Gotchas
- The Overpass API needs a User-Agent header (it returns an empty body otherwise).
- The Open-Meteo archive lags about 5 days; the fetcher requests up to today − 7 days.
