# Assumptions: scoring & geofence rules

All parameters live in `config/scenario.yaml`. **They are illustrative assumptions, not validated ecology.**

## Factors (each normalised to 0–1)
| Factor | Definition | Source |
|---|---|---|
| dryness | 0.5·rainfall_dryness + 0.5·vegetation_stress, where rainfall_dryness = clip((250 − R30)/(250 − 10)) | R30: observed (Open-Meteo) or what-if; vegetation: user assumption |
| forest_water_scarcity | 1 − water availability | user assumption |
| crop_attractiveness | slider value (optional month adjustment, **disabled by default, all zeros**) | user assumption |
| forest_proximity | clip((8000 − d)/8000), with d = metres from the village node to the OSM reserve boundary (0 if inside) | real geography |

**No double counting:** rainfall deficit and vegetation stress are related, so they are blended into one `dryness` factor with one weight. There is no drought index and no independent "summer multiplier". A month effect exists only as the visible, editable, default-off `month_crop_adjust`.

## Score
`score = 100 · Σ wᵢ·fᵢ / Σ wᵢ`, summed over the **available** factors. Weights: dryness 0.25, water 0.20, crop 0.25, proximity 0.30.
Missing inputs are excluded and the remaining weights are re-normalised. A missing input is never treated as zero risk, and the UI lists missing factors.
Categories (score lower bounds): Low 0, Moderate 35, Elevated 55, High 75.

## Geofence rule
`buffer_m = 300 + (2500 − 300) · (score/100)^1.0`
geofence = (250 m approximate footprint disc) buffered outward by `buffer_m`. This is computed in EPSG:32643 (UTM 43N, metres) and reprojected to WGS84. Each village keeps its own polygon; overlaps are not dissolved.
**The distance is an illustrative simulation rule. It is not an elephant travel distance or a scientifically established warning radius.**

## Rainfall anomaly
The anomaly is computed only when ≥ 25 of the 1991–2020 reference years have a complete same 30-day window. Otherwise low rainfall is treated as a "user-defined dryness scenario".
