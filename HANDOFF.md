# Handoff notes (for Codex or the next developer)
## GitHub integration

The latest React source and FastAPI adapter have been integrated on `feature/geosentinel-premium-frontend` from remote `main` at `1420f33af1939fa7416fb5ea05227690ec252183`. Original Streamlit/scientific modules, YAML, pinned requirements, tests, provenance documents, and all six cached datasets are preserved from that commit. The earlier local milestones below are historical records; their backup directories and virtual environments are intentionally not committed. README.md now documents fresh-clone installation and local development/production serving. See GITHUB_INTEGRATION.md for the integration validation record and REFINEMENT.md for curated screenshots.

## Product design refinement — 2026-10-11

- Replaced the abstract terrain hero with an SVG drawn from existing cached OSM geography. Added a static hypothetical comparison exported from the unchanged Python scorer; no landing API calls or live-data claims.
- Rebuilt the shared design tokens and presentation. Simplified navigation and map overlays, collapsed advanced controls and analysis details, improved chart labels, and widened tablet geography. Scientific categories retain their existing semantics.
- Preserved the API, scientific modules, config and all six cached datasets byte for byte. Scoring, geofences, rainfall modes, nullable inputs, presets and snapshots retain their existing behavior.
- Rendered audit and two substantial refinement passes are recorded in `REFINEMENT.md` and `frontend/qa/refinement/`. Source checkpoint: `backups/pre-refinement-2026-10-11`.
- Added regression coverage for collapsed sections and keyboard focus around the mobile scenario drawer. Closed-details descendants are explicitly excluded from its focus loop.
- See README.md for exact PowerShell setup, run and test commands. Use `pytest tests -q` so preserved test copies in backups are not collected.

The earlier frontend notes below record the initial implementation.

## Premium frontend — 2026-10-11

- Added React/TypeScript/Vite frontend, cinematic abstract Three.js landing, GSAP/Motion transitions, MapLibre map, scenario controls, village analysis, Recharts analytics, and methodology/source register.
- Added `geosentinel/api.py`: validated FastAPI adapter over the original scientific modules, exact GeoJSON geofences, provenance/explanations/advisories, nullable inputs, and saved rainfall/observation snapshots. Built frontend is served by FastAPI at `/` when `frontend/dist` exists at startup.
- Preserved `app.py`, core scientific modules, configuration, pinned original requirements, and cached data. Original files are backed up under `backups/original-2026-10-11/`; this extracted directory had no Git repository. A Windows environment was created at `.venv-windows`, leaving `.venv` intact.
- Verified: original 8 tests + 13 API tests = 21 passing. TypeScript, ESLint, and production build pass. Seven Chromium browser tests cover scenario/baseline/unknown/observed inputs, map geometry source loading, all villages, selection/layers, simulated advisories, analytics, backend retries, 1920 desktop, 1366 laptop, 768 tablet, 390 mobile, and reduced-motion layouts. Two additional production-bundle interaction checks verify direct FastAPI serving and its bundled map worker.
- Runtime dependency audit: zero vulnerabilities. MapLibre upgraded to 6.13.0 and configured with Vite's bundled worker. Warnings: Vite flags the deferred MapLibre chunk size; Python tests report an upstream Starlette/AnyIO deprecation.
- Screenshots: `frontend/qa/`. Setup/run/test/build commands: `README.md`. Audit, architecture, and refinement decisions: `IMPLEMENTATION.md`.
- Scientific limits remain unchanged. Hero terrain is abstract, not measured elevation. CHIRPS, Sentinel-2, forest water/crop measurements, live detections, and real alerts remain unavailable/pending. Baselines are browser-local. Hardware 60 FPS was not benchmarked. Nothing was pushed or deployed.

The older notes below describe the original Streamlit implementation.

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
