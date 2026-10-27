# Assumed environmental reward and geofence

These parameters are an explicit, editable heuristic, not a trained model, probability, or validated warning system. They cannot predict the hour or day of an elephant incursion without movement records.

## Reward / risk score

With complete inputs, `R = 100 × (0.30D + 0.20W + 0.15C + 0.20P + 0.15I)`.

- `D = 0.5 × rainfall_dryness + 0.5 × vegetation_stress`.
- `rainfall_dryness = clip((250 − rainfall_30d_mm) / 240)`.
- Satellite `vegetation_stress = clip((0.75 − median_forest_NDVI) / 0.55)`; NDVI is `(NIR − red)/(NIR + red)` after applying each band's reflectance scale and offset.
- `W = 1 − forest_water_availability`. The satellite proxy maps visible water fraction to availability with `clip(water_fraction / 0.02)`.
- `C`: crop attractiveness from 0 (no attractive crop) to 1 (highly attractive mature crop), supplied by dated village field records or a visibly assumed slider. Greenness alone is not crop species, maturity or yield.
- `P = clip(1 − distance_to_reserve_m / 8000)`. Inside the reserve, distance is zero.
- `I = C × (0.6D + 0.4W)`: the interaction between forest resource pressure and village food attraction.

All clip operations bound values to [0, 1]. If one dryness sub-input is missing, the available sub-input supplies D. Missing factors are omitted and remaining weights re-normalised. **Any missing rainfall, vegetation, water or crop input suppresses alert previews**, even when the partial score is high. Per-village API results include eligibility and suppression reasons.

Why these weights: resource pressure contributes 50%, settlement crop attraction 15%, geographic exposure 20%, and their compound push/pull effect 15%. This expresses the proposed mechanism without letting mature crops alone trigger an alert. Rainfall and vegetation share a dryness factor. The independent seasonal factor is disabled to avoid applying a fixed month penalty on top of measured environmental conditions. The interaction intentionally adds extra weight to simultaneous scarcity and attraction; it is not independent evidence.

The 10/250 mm rainfall endpoints, NDVI 0.20/0.75 endpoints, 2% visible-water reference, 8 km proximity scale, weights and thresholds are all **assumptions**. They were not fitted or shown to improve accuracy. Rainfall thresholds should eventually use a local seasonal climatology; visible-water sampling can miss small streams or canopy-covered sources and does not measure accessible drinking water. The reserve mask approximates forest habitat and is not a map of edible forage. Temperature is displayed as context and receives no separate weight to avoid another correlated stress factor.

## Thresholds

- Watch: 65 ≤ R < 80.
- Alert preview: R ≥ 80 (raised from 65).
- Urgent preview: R ≥ 90.
- Display categories remain Low <35, Moderate 35–54.99, Elevated 55–74.99, High ≥75. Category High is separate from the stricter alert trigger.

Alerts are simulated dashboard/phone previews. Nothing is sent to real communities. A higher threshold is intended to reduce nuisance alerts; sensitivity and false alarm rates remain unknown without labels.

## Geofence

`buffer_m = 300 + 2200 × R/100`. The buffer is added outside a 250 m approximate settlement footprint, in EPSG:32643, and then reprojected to WGS84. These are village-node circles, not official city boundaries. Polygons remain separate when overlapping.

| R | Buffer outside footprint | Total radius | Approximate area |
|---|---|---|---|
| 40 | 1180 m | 1430 m | 6.42 km² |
| 65 | 1730 m | 1980 m | 12.32 km² |
| 80 | 2060 m | 2310 m | 16.77 km² |
| 90 | 2280 m | 2530 m | 20.11 km² |

Geofences expand continuously as R rises; crossing 80 activates eligible alert previews. They are advisory geometry, not elephant travel distances, detection perimeters or arrival forecasts.

## Data and validation

Use **Fetch weather & Sentinel-2**, then **Use API evidence in score**. Public API calls require network access. Weather uses a complete 30-day archive window; choose a date at least five days ago if reanalysis is delayed. Satellite discovery searches the preceding 30 days, selects the least cloudy returned scene with tile cloud ≤40%, and displays its actual date and full-tile preview. Pixel sampling applies the scene classification mask, reserve boundary and a minimum 50% clear coverage / 30 samples. A scene may be older than the scenario date. No clear scene or a failed source stays missing. API responses cache for one hour; village field crop records reload on each request. Saved comparisons capture environmental snapshots.

Fill `data/crop_observations.csv` with `village,date,attractiveness,crop,source`. Village names must match dashboard names. Use ISO dates and attractiveness 0–1. The latest record within the preceding 30 days overrides the crop assumption for that village when API evidence is active. The checked-in CSV contains headers only. Example syntax (hypothetical, not a real observation): `Masinagudi,2026-10-01,0.85,maize,field survey`. Keep the crop slider marked unknown when no defensible assumption or field record exists. No crop observation API or crop classification model is claimed.

To calibrate: obtain independent dated incursions and non-event windows, field water/crop records and movement trajectories; use spatial and temporal holdouts, measure precision/recall and false alerts, calibrate thresholds with Forest Department experts, and compare against a simpler baseline. Simulated sightings must never be training labels or validation evidence.

Dashboard evidence loads automatically when the selected date changes. Image/scene metadata and weather appear first; NDVI/water analysis follows in a separate request so the image is visible while pixels are processed. Select **Use API evidence in score** to apply the displayed evidence. Scene footprints must cover at least 80% of the study-area reserve. Pixel sampling uses the 8× COG overview and a 128×128 target grid; small streams and ponds may be missed. Full Sentinel-2 tile previews are explicitly labelled and are not village-sized imagery.
