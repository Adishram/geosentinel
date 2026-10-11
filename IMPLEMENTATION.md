# Frontend redesign audit and implementation

The later product-design refinement is documented in [REFINEMENT.md](REFINEMENT.md), including the rendered audit, checkpoint, two review passes, and before/after screenshots. The sections below record the first implementation.

## Audit — 11 October 2026

Inspected all application modules, six cached datasets, both YAML files, tests, README, handoff, assumptions, and provenance. The original project is Streamlit/Folium with deterministic scientific modules separated from the interface. It is an extracted directory without Git; `.venv` has Unix `bin/` rather than Windows `Scripts/`.

Source, docs, configuration, tests, and cached datasets were backed up to `backups/original-2026-10-11/`. Created `.venv-windows` safely. The original eight tests passed with pinned dependencies. Hash checks confirmed that `app.py`, engine, geography, environment, fetcher, both config files, and `requirements.txt` stayed unchanged.

Original working features: six OSM villages, independent geofences, what-if presets, missing-input reweighting, contribution explanations, baseline comparison, cached rainfall/climatology, layers, and simulated advisory text. Pending: CHIRPS, Sentinel-2/NDVI, water measurements, official footprints, trained predictions. No real alerts or detections existed.

## Architecture and design

The React/TypeScript frontend uses Vite/Tailwind, self-hosted Inter/DM Mono, Motion, GSAP, Three.js, MapLibre, Recharts, and Lucide. The abstract terrain sculpture is explicitly labeled; no remote stock assets or fabricated telemetry are used. The landing story explains geography, scenario inputs, explainability, and research transparency.

The workstation has collapsible controls, a dominant map, and contextual analysis. Mobile uses a fixed control drawer with focus containment, Escape dismissal, and focus restoration; analysis stacks beneath the map. Native keyboard-accessible sliders/date/select controls retain their behavior.

FastAPI adapts the existing modules. Each request calls the original scorer, explanation function, environmental module, and geofence generator. Requests are debounced for 220 ms and stale requests are cancelled. Scientific formulas, weights, coordinates, parameters, and cached records were not changed.

MapLibre uses cached geography by default. Optional standard OSM tiles have visible attribution and require no key. MapLibre 6.13 uses an explicitly bundled Vite worker. Deck.gl was unnecessary for six villages; direct Three.js was sufficient for the hero without React Three Fiber.

Analytics compare actual scores, saved/current baselines, contributions, and buffer distances, with exact numeric tables and missing factors. There is no invented risk timeline. Methodology exposes measurement periods, climatology/anomaly availability, grid details, source timestamps/licences, configuration, pending integrations, and original project documents.

Browser baselines save scenario inputs and resolved rainfall/observation snapshots. Python still calculates every comparison. No shared server persistence, authentication, or publication was added. Request schemas validate modes, dates, nullable bounded inputs, and extra fields. Unavailable reserve geometry returns 503; missing weather is explicitly excluded rather than invented. FastAPI serves a built frontend at its root for single-origin local use.

## Refinement and verification

The visual/interaction pass found and fixed asynchronous map CSS overriding container height and a worker-loading issue after the MapLibre upgrade. Browser checks verify canvas dimensions and source readiness, since DOM marker counts alone do not prove a rendered map. Also refined mobile keyboard access, persistent disclaimer, rainfall snapshots, map popovers, water polygons, font assets, chart legends, and loading/error states.

Validation results are recorded in `HANDOFF.md`; browser screenshots are retained in `frontend/qa/`. Full source stays in the workspace, with no push or deployment.

## Remaining limits

Scientific limitations remain unchanged. Measured terrain, satellite imagery, live sensors, detections, operational warnings, trained predictions, and historical risk series are absent. Animation behavior was tested in headless Chromium with software WebGL; hardware 60 FPS across devices was not benchmarked. Map WebGL failure leaves analysis accessible.

MapLibre is a substantial deferred bundle and produces Vite's large-chunk advisory. Map, charts, and Three.js load on demand. Python tests report one upstream Starlette/AnyIO deprecation warning. Neither is a failing check.
