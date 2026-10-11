# GeoSentinel product design refinement

The implemented product has been refined around a quiet geographic workspace and a restrained editorial introduction. No scientific formulas, Python API logic, configuration, or source datasets were changed.

## What the rendered audit showed

The previous landing relied on an abstract terrain mesh unrelated to the study geography, followed by repeated feature rows. A large amount of small uppercase text, boxed map headings, legends, markers, repeated navigation, and always-visible analysis detail created competing visual priorities. Analytics labels were angled and too small; the tablet map was squeezed beside a long analysis panel.

The app was run before changes and inspected in Chromium at desktop, tablet, and mobile sizes. All seven existing browser checks passed on the starting version. The audit also captured the complete landing, analytics, and methodology pages. The in-app browser could not reconnect to localhost in this session; installed Chromium provided the rendered audit and screenshots.

## Design decisions

- A geographic SVG replaces the abstract 3D hero. It uses the existing reserve, roads, water, and six village locations. It depicts no measured elevation or animal detections, and credits OpenStreetMap.
- One main hero action: **Explore the Platform**. Two editorial stories explain geographic context and scenario comparison. The latter shows a static, explicitly hypothetical example exported from the unchanged Python scorer.
- One workspace navigation row. Larger text, neutral charcoal surfaces, sage accents, and semantic category colours replace numerous decorative micro-labels, borders, and containers.
- Date, mode, and presets are primary controls. Environmental adjustments and village membership are collapsed by default. Unknown inputs, cached rainfall, overrides, and baseline actions retain their behavior.
- Analysis now prioritises village identity, score/category, baseline difference, and geographic measurements. Contributions, explanation, and provenance expand independently. The simulated advisory remains clearly labelled.
- Horizontal plots expose complete village names and exact score labels. Charts and tables share a restrained visual language; category and baseline encodings are explicit.
- Tablet geography spans the available width, with a compact two-column analysis below. Mobile retains the map, stacked analysis, and accessible scenario drawer.
- CSS tokens centralise surfaces, text colours, spacing, type sizes, radius, and easing. The landing uses brief entrances and one-time reveals. Dashboard controls respond immediately, and reduced motion remains supported.

## Required refinement passes

**Initial implementation:** replaced the landing, navigation, stylesheet, control hierarchy, and analysis hierarchy. Screenshots were reviewed across desktop/mobile/tablet and all major pages.

**Pass one:** corrected hero/map proximity, replaced a generic workflow graphic with actual Python comparison outputs, enlarged the geographic detail crop, prevented small-map label collisions, and updated the drawer focus loop to exclude inputs inside closed disclosures.

**Pass two:** rebuilt scores and geofence plots as horizontal charts; added exact scores and category/baseline keys; widened the tablet map and reorganised tablet analysis; softened geographic line weights; hid absent baseline keys; corrected north-arrow rotation. Final responsive review caught and fixed the analytics grid at narrow widths.

Curated before and final screenshots are retained in `frontend/qa/refinement/before` and `pass-two`. Intermediate captures and the original local source checkpoint are excluded from Git. The original extracted source and its checkpoints remain intact outside this integration checkout.

## Before / after

| View | Before | Final |
| --- | --- | --- |
| Landing | [Before](frontend/qa/refinement/before/landing.png) | [After](frontend/qa/refinement/pass-two/landing.png) |
| Geographic explorer | [Before](frontend/qa/refinement/before/workspace.png) | [After](frontend/qa/refinement/pass-two/workspace.png) |
| Analytics | [Before](frontend/qa/refinement/before/analytics.png) | [After](frontend/qa/refinement/pass-two/analytics.png) |
| Methodology | [Before](frontend/qa/refinement/before/methodology.png) | [After](frontend/qa/refinement/pass-two/methodology.png) |
| Tablet explorer | [Before](frontend/qa/refinement/before/workspace-tablet.png) | [After](frontend/qa/refinement/pass-two/workspace-tablet.png) |
| Mobile explorer | [Before](frontend/qa/refinement/before/workspace-mobile.png) | [After](frontend/qa/refinement/pass-two/workspace-mobile.png) |

## Validation and practical limits

Python/API/configuration were compared against the checkpoint and match byte for byte. All six source cache files also match the original backup. **21 Python tests and seven browser tests passed**, together with TypeScript checks, lint, and the production build. Browser checks cover actual API responses, baseline comparisons, unknown inputs, observed rainfall and overrides, six village selection, layers, advisory preview, empty/error/retry states, mobile/tablet overflow, reduced motion, and drawer keyboard focus. An added focus-loop check exposed closed-details descendants retaining layout rectangles; the loop now explicitly excludes them, and the check passed after repair.

The build no longer contains the Three.js terrain chunk. The landing SVG needs no GPU or external tiles; MapLibre and charts load when their views are opened. MapLibre remains a large lazy-loaded chunk and requires WebGL. Scores and geofences retain their research limitations. The static landing comparison is not a live readout; the workspace remains Python-backed.

## Exact PowerShell run commands

Terminal 1:

```powershell
# Start at the cloned repository root
.\.venv-windows\Scripts\python.exe -m uvicorn geosentinel.api:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2:

```powershell
Set-Location frontend
npm.cmd run dev
```

Open http://127.0.0.1:5173/. Install dependencies in the fresh clone using README.md before running these commands. Full setup and production commands are in README.md.

Validation:

```powershell
# Start at the cloned repository root
.\.venv-windows\Scripts\python.exe -m pytest tests -q
Set-Location frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

The browser suite needs both servers running. To reproduce screenshots, run `node scripts/design-audit.mjs pass-two` from `frontend`. Optional artwork regeneration uses `node scripts/build-study-visual.mjs` (local files) and `node scripts/build-scenario-example.mjs` (requires the local Python API). Neither modifies source data or scoring logic.
