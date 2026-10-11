# Data sources & provenance

Retrieved **2026-10-08** (the exact UTC timestamps are stored in each cache file's `metadata` / `_meta` field).

| Layer | Source | Query / URL | Licence | Status |
|---|---|---|---|---|
| Mudumalai boundary | OpenStreetMap way 159049306 "Mudumalai National Park" (boundary=national_park, protect_class=2, wikidata Q2372700) via Overpass API | https://overpass-api.de/api/interpreter (the query is stored in `data/cache/reserve.geojson`) | ODbL 1.0, © OpenStreetMap contributors | ✅ cached |
| Villages | OSM `place=village/hamlet/town` nodes in bbox 76.40–76.75 E, 11.48–11.68 N; 6 selected by OSM id (`config/villages.yaml`) | Overpass | ODbL | ✅ cached |
| Roads | OSM highway trunk–unclassified | Overpass | ODbL | ✅ 370 features |
| Water | OSM waterway river/stream, natural=water | Overpass | ODbL | ✅ 55 features |
| Forest cover | OSM landuse=forest / natural=wood | Overpass | ODbL | ✅ 10 features (OSM coverage is incomplete) |
| Base map tiles | tile.openstreetmap.org | — | ODbL data; [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) | light interactive use only |
| Rainfall | Open-Meteo Historical Weather API (ERA5 / ERA5-Land **reanalysis**, not a satellite feed), daily precipitation_sum, 1991-01-01 → 2026-10-01, grid point 11.564 N 76.580 E | https://archive-api.open-meteo.com/v1/archive · docs: https://open-meteo.com/en/docs/historical-weather-api | CC BY 4.0 (Open-Meteo); ERA5 © Copernicus/ECMWF | ✅ cached |
| CHIRPS rainfall | https://chc.ucsb.edu/data/chirps3 | — | — | ⏳ pending |
| Sentinel-2 vegetation | https://developers.google.com/earth-engine/datasets/catalog/sentinel-2 | requires an Earth Engine account/project; not assumed | — | ⏳ pending (vegetation is a user assumption) |
| Forest water availability | — | — | — | ⏳ no dataset; user assumption |

## Verification notes
- Village names and positions come from OSM nodes; no coordinate was typed by hand. All six villages (Masinagudi, Mavanalla, Vazhaithottam, Thepakkadu, Kargudi, Thorapalli) are Nilgiris-district settlements in the Mudumalai/Gudalur area. Some other villages in the bbox (e.g. Mangala, Yalachetti) are in Karnataka and were excluded.
- **Village footprints are approximate**: a 250 m disc around each OSM place node. They are not official administrative boundaries.
- In OSM, Masinagudi, Thepakkadu and Kargudi lie *inside* the mapped national-park polygon, so their distance to the reserve is 0 m. The OSM polygon may not match the gazetted core/buffer limits.
- All villages share one Open-Meteo grid cell, so no village-level rainfall variation is shown.
