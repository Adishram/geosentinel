# GeoSentinel — Mudumalai Village Risk Simulator

> **Research simulation — not an operational warning system.** Scores are illustrative outputs of an assumed, editable rule. They are not probabilities of elephant incursion.

This is an interactive 2D map of Mudumalai National Park (OpenStreetMap boundary) and six nearby villages in The Nilgiris district, Tamil Nadu. Each village has its own **advisory geofence**, a metre-based buffer around an approximate settlement footprint. The geofence grows or shrinks with an illustrative scenario score.

## Install & run (macOS / Python 3.13)
```bash
cd ~/Downloads/geosentinel
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m geosentinel.fetch_data      # one-time: caches OSM + Open-Meteo into data/cache/
.venv/bin/streamlit run app.py                   # http://localhost:8501
.venv/bin/python -m pytest -q                    # focused checks
```
The cache is already populated, so you can skip the fetch step. The app never calls external services when you move a slider.

## Layout
- `app.py`: Streamlit interface (map, sidebar, comparison table, explanation panel)
- `geosentinel/engine.py`: deterministic scorer behind the `Scorer` protocol (swap in a model later)
- `geosentinel/geo.py`: cached layers, distance to reserve, UTM 43N buffers
- `geosentinel/environment.py`: Open-Meteo 30-day rainfall + 1991–2020 same-window climatology
- `geosentinel/fetch_data.py`: bounded downloader
- `config/scenario.yaml`: weights, normalisation, categories, geofence rule
- `config/villages.yaml`: village selection by OSM id
- `tests/test_core.py`: determinism, missing data, geofence geometry

See `DATA_SOURCES.md`, `ASSUMPTIONS.md` and `HANDOFF.md`.
