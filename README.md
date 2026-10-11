# GeoSentinel — Intelligence for the Wild

> **Research simulation, not an operational warning system.** Scores are illustrative outputs of an editable assumed rule, not elephant-incursion probabilities. Geofences are not validated warning radii.

React/TypeScript research workspace for six villages around Mudumalai: geographic landing, MapLibre explorer, Python-backed scenarios, explainable village analysis, saved baseline comparisons, analytics, and methodology. The original Streamlit application remains available.

## Requirements and clone

Verified on Windows with **Python 3.11.9, Node 22.14.0, and npm 10.9.2**. Use Python 3.11 and Node 22.14 or newer supported LTS. Initial dependency installation requires internet access. Git, Python, and Node must be on PATH. No paid map API key, credentials, environment variables, or cache download is required for the default view.

```text
git clone https://github.com/Adishram/geosentinel.git
cd geosentinel
```

Before this PR is merged, select its branch with `git switch feature/geosentinel-premium-frontend`. After merge, use the default branch.

## Windows setup (PowerShell)

Run from the newly cloned repository root. A fresh clone contains no virtual environment or installed Node packages. Explicit interpreter paths avoid activation and execution-policy changes.

```powershell
python -m venv .venv-windows
.\.venv-windows\Scripts\python.exe -m pip install -r requirements-api.txt
Set-Location frontend
npm.cmd ci
Set-Location ..
```

Development uses two terminals, both initially at the repository root:

```powershell
# Terminal 1: Python API
.\.venv-windows\Scripts\python.exe -m uvicorn geosentinel.api:app --reload --host 127.0.0.1 --port 8000
```

```powershell
# Terminal 2: frontend
Set-Location frontend
npm.cmd run dev
```

Open [development frontend](http://127.0.0.1:5173/) and [API documentation](http://127.0.0.1:8000/docs). Vite proxies `/api` to port 8000. Stop servers with Ctrl+C. Free those ports before starting another copy of the app.

## macOS / Linux setup

Run from the cloned repository root with Python 3.11 installed:

```bash
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements-api.txt
cd frontend
npm ci
cd ..
```

Development terminal 1: `.venv/bin/python -m uvicorn geosentinel.api:app --reload --host 127.0.0.1 --port 8000`.

Development terminal 2, from `frontend`: `npm run dev`.

These commands are provided for portability; the integration was executed and verified on Windows.

## Build and serve at one URL

`frontend/dist` is deliberately **not committed**. Recreate it from the committed source and package lock:

```powershell
# From repository root
Set-Location frontend
npm.cmd run build
Set-Location ..
.\.venv-windows\Scripts\python.exe -m uvicorn geosentinel.api:app --host 127.0.0.1 --port 8000
```

On macOS/Linux: `cd frontend && npm run build && cd ..`, then `.venv/bin/python -m uvicorn geosentinel.api:app --host 127.0.0.1 --port 8000`.

Open [built frontend and API](http://127.0.0.1:8000/). **Build before starting Python, or restart Python after building**: the static frontend is mounted only when `frontend/dist` exists at application startup. Hash routes support workspace, analytics, and methodology navigation. This is local serving; public hosting has not been configured.

## Validation

```powershell
# From repository root
.\.venv-windows\Scripts\python.exe -m pytest tests -q
Set-Location frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npx.cmd playwright install chromium
# With the API and Vite development servers running:
npm.cmd run test:e2e
```

The Python suite covers the original scientific core and API parity, schema validation, missing inputs, and baseline snapshots. The seven browser checks cover map readiness, all villages, scenario changes, baseline actions, observed rainfall and overrides, unknown inputs, layer selection, analytics, methodology, API outage/retry, responsive layout, reduced motion, and drawer keyboard access. Browser tests use software WebGL in headless Chromium. Generated test screenshots and traces are ignored; curated before/after screenshots are retained under `frontend/qa/refinement`.

On macOS/Linux use `.venv/bin/python -m pytest tests -q`, `npm` and `npx` in place of the Windows executables. Playwright on Linux may need `npx playwright install --with-deps chromium`.

To test the built application with Vite stopped and FastAPI running, set `$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:8000'` before `npm.cmd run test:e2e`; afterwards use `Remove-Item Env:PLAYWRIGHT_BASE_URL`. Bash equivalent: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8000 npm run test:e2e`.

## Original Streamlit application

From repository root on Windows: `.\.venv-windows\Scripts\python.exe -m streamlit run app.py`.

On macOS/Linux: `.venv/bin/python -m streamlit run app.py`.

Open the URL printed by Streamlit (normally port 8501). `requirements-api.txt` includes the original pinned `requirements.txt`; the same environment supports both interfaces.

## Architecture and cached data

- `frontend/src/`: landing, explorer, analytics, methodology, typed API client, debounced requests, and browser-local baseline state.
- `geosentinel/api.py`: thin FastAPI adapter over the existing scorer, geography, and environmental modules; Python returns exact GeoJSON geofences.
- `geosentinel/engine.py`, `geo.py`, `environment.py`, `fetch_data.py`: original scientific modules, preserved from remote `main`.
- `app.py`, `config/`, `requirements.txt`, `tests/test_core.py`: original Streamlit implementation, settings, pinned dependencies, and checks.
- `data/cache/`: all six existing OSM/Open-Meteo datasets are tracked and available in a fresh clone. The app makes no external data requests during scenario changes.
- `tests/test_api.py` and `frontend/e2e/`: API parity/validation and browser checks.

The default map uses cached OSM geometry. Optional standard OpenStreetMap tiles load only when selected and require network access; copyright/ODbL attribution stays visible. Observe the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/) for light interactive use. Production-scale traffic needs an appropriate tile service.

Explicit cache refresh is optional: `.\.venv-windows\Scripts\python.exe -m geosentinel.fetch_data` (Windows), or `.venv/bin/python -m geosentinel.fetch_data` (macOS/Linux). It uses external services and can change results. Restart the API after refreshing cache files or editing YAML.

Baseline comparisons retain scenario inputs and resolved rainfall/observation snapshots in this browser. Python computes all scores and comparisons; baselines are not shared server records. Backend outages show errors/retry or explicitly stale results, never substitute mock scores.

The lightweight landing SVG is generated from cached OSM geography. Its static scenario example contains actual Python outputs, explicitly labelled hypothetical. Regenerate from `frontend` with `node scripts/build-study-visual.mjs` and, with the API running, `node scripts/build-scenario-example.mjs`. Neither changes source data or scoring logic. The old Three.js hero source is retained but is not imported into the application.

## Research limits and implementation record

Environmental mode uses cached Open-Meteo ERA5/ERA5-Land precipitation from one coarse grid cell shared by all villages. Other environmental inputs remain assumptions; missing inputs are explicitly identified. Settlement footprints are approximate 250 m discs, and reserve/forest geometry is OSM-derived rather than official survey data. CHIRPS, Sentinel-2 NDVI, measured forest water/crops, validated wildlife models, and live detections/alerts remain pending. No historical wildlife-risk trends are fabricated.

MapLibre requires WebGL and remains a substantial deferred bundle; analysis and charts remain available without a working map. Hardware animation performance has not been benchmarked. Browser-local storage may be cleared or unavailable.

See [GITHUB_INTEGRATION.md](GITHUB_INTEGRATION.md) for integration and validation, [REFINEMENT.md](REFINEMENT.md) for before/after design review, [IMPLEMENTATION.md](IMPLEMENTATION.md) for the historical implementation audit, and [ASSUMPTIONS.md](ASSUMPTIONS.md), [DATA_SOURCES.md](DATA_SOURCES.md), [HANDOFF.md](HANDOFF.md) for scientific provenance and follow-up work.
