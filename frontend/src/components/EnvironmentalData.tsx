import { useEffect, useState } from "react";
import type { LiveEnvironment, Scenario, VillageResult } from "../lib/types";

export default function EnvironmentalData({
  scenario,
  setScenario,
  threshold,
  village,
}: {
  scenario: Scenario;
  setScenario: (scenario: Scenario) => void;
  threshold: number;
  village?: VillageResult;
}) {
  const [data, setData] = useState<LiveEnvironment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [analysing, setAnalysing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const requestedDate = scenario.date;
    setData(null);
    setBusy(true);
    setError("");
    setImageError(false);
    setAnalysing(false);
    const load = async () => {
      try {
        const response = await fetch(`/api/live-environment/${requestedDate}`, {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            "Environmental request failed; choose a date at least 5 days ago.",
          );
        const evidence: LiveEnvironment = await response.json();
        setData(evidence);
        setBusy(false);
        if (evidence.satellite && !evidence.satellite.indices) {
          setAnalysing(true);
          const analysis = await fetch(
            `/api/satellite-analysis/${requestedDate}`,
            { signal: controller.signal },
          );
          if (!analysis.ok)
            throw new Error(
              "Satellite analysis unavailable; scene preview and weather remain available.",
            );
          setData(await analysis.json());
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        if (!controller.signal.aborted) {
          setBusy(false);
          setAnalysing(false);
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [scenario.date, revision]);
  const current = data?.date === scenario.date ? data : null;
  const indices = current?.satellite?.indices;
  return (
    <section
      className="environment-data"
      aria-label="Environmental data connections"
    >
      <div>
        <h2>Environmental evidence</h2>
        <p>
          Alert ≥ {threshold}/100 · Urgent ≥ 90 · shared forest measurements,
          village-specific proximity
        </p>
      </div>
      <div className="environment-actions">
        <button
          onClick={() => setRevision((x) => x + 1)}
          disabled={busy || analysing}
        >
          {busy
            ? "Reading weather & satellite…"
            : analysing
              ? "Analysing satellite pixels…"
              : "Reload environmental evidence"}
        </button>
        <button
          disabled={
            !current || (!current.weather && !indices) || busy || analysing
          }
          onClick={() =>
            setScenario({
              ...scenario,
              use_live_data: true,
              mode: "environmental",
              rain_override: false,
            })
          }
        >
          Use API evidence in score
        </button>
        {scenario.use_live_data && (
          <button
            onClick={() => setScenario({ ...scenario, use_live_data: false })}
          >
            Use manual assumptions
          </button>
        )}
      </div>
      <p role="status">
        {error ||
          (scenario.use_live_data
            ? "API evidence active. Crops use supplied village field records, with your slider as an assumed fallback; unavailable API inputs stay missing."
            : "Evidence loads automatically for the selected date. Apply it to update scores, geofences and alert previews.")}
      </p>
      {village && (
        <div className="evidence-score-strip">
          <div>
            <small>Selected village</small>
            <strong>{village.name}</strong>
          </div>
          <div>
            <small>Current score</small>
            <strong>{village.score.toFixed(1)} / 100</strong>
          </div>
          <div>
            <small>Advisory buffer</small>
            <strong>{(village.buffer_m / 1000).toFixed(2)} km</strong>
          </div>
          <div>
            <small>Geofence area</small>
            <strong>{village.area_km2.toFixed(2)} km²</strong>
          </div>
          <div>
            <small>Alert state</small>
            <strong>
              {!village.alert_eligible
                ? "Incomplete inputs"
                : village.score >= threshold
                  ? "Alert preview"
                  : "Below threshold"}
            </strong>
          </div>
        </div>
      )}
      {current && (
        <div className="environment-grid">
          <div>
            <strong>Weather / 30 days</strong>
            <p>
              {current.weather
                ? `${current.weather.rainfall_30d_mm} mm rainfall · ${current.weather.mean_max_temperature_c ?? "—"} °C mean daily high`
                : current.errors.weather}
            </p>
            <small>{current.weather?.period} · Open-Meteo reanalysis</small>
          </div>
          <div>
            <strong>Forest vegetation & water</strong>
            <p>
              {indices
                ? `NDVI ${indices.forest_ndvi} · visible water ${(indices.visible_water_fraction * 100).toFixed(2)}% · clear coverage ${(indices.clear_coverage * 100).toFixed(0)}%`
                : analysing
                  ? "Computing cloud-masked vegetation and water samples…"
                  : current.satellite?.indices_error ||
                    current.errors.satellite}
            </p>
            <small>
              NDVI estimates greenness; visible water does not establish
              accessible drinking water.
            </small>
          </div>
          <div>
            <strong>Village crop records</strong>
            <p>
              {Object.keys(current.crop_observations ?? {}).length} recent
              village records supplied.
            </p>
            <small>
              Recent field records override the crop assumption for each
              village. Records expire after 30 days.
            </small>
            {current.errors.crops && <p>{current.errors.crops}</p>}
          </div>
          <div className="satellite-preview">
            <strong>Sentinel-2 scene</strong>
            {current.satellite && (
              <>
                <p>
                  {current.satellite.acquired.slice(0, 10)} · tile cloud{" "}
                  {current.satellite.cloud_cover_pct.toFixed(1)}%
                </p>
                {current.satellite.thumbnail && !imageError && (
                  <img
                    src={current.satellite.thumbnail}
                    onError={() => setImageError(true)}
                    alt="Sentinel-2 scene overview; full satellite tile, not a village boundary"
                  />
                )}
                {imageError && <p>Scene preview unavailable.</p>}
                <a
                  href={current.satellite.source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open scene metadata
                </a>
              </>
            )}
          </div>
        </div>
      )}
      {village && (
        <div className="evidence-factors">
          {Object.entries(village.factors).map(([key, value]) => (
            <div key={key}>
              <span>
                {(
                  {
                    dryness: "Forest dryness",
                    forest_water_scarcity: "Water scarcity",
                    crop_attractiveness: "Crop attraction",
                    forest_proximity: "Forest proximity",
                    resource_pull: "Scarcity × crops",
                  } as Record<string, string>
                )[key] ?? key}
              </span>
              <strong>
                {value == null ? "Unknown" : `${(value * 100).toFixed(0)}%`}
              </strong>
              <meter min={0} max={1} value={value ?? 0} aria-label={key} />
              <small>
                {village.contributions[key]?.toFixed(1) ?? "—"} score points
              </small>
            </div>
          ))}
        </div>
      )}
      {current && (
        <p className="evidence-time">
          Retrieved {new Date(current.retrieved).toLocaleString()} ·{" "}
          {scenario.use_live_data
            ? "Evidence applied to current score"
            : "Displayed evidence has not been applied to current score"}{" "}
          ·{" "}
          <a
            href="https://open-meteo.com/en/docs/historical-weather-api"
            target="_blank"
            rel="noreferrer"
          >
            Weather source
          </a>
        </p>
      )}
      <details>
        <summary>Assumed reward function & geofence</summary>
        <p>
          R = 100 × (0.30D + 0.20W + 0.15C + 0.20P + 0.15I), where I = C × (0.6D
          + 0.4W).
        </p>
        <p>
          D blends rainfall deficit and forest vegetation stress; W is water
          scarcity; C is crop attractiveness; P is proximity to the reserve.
          Weights are re-normalised when factors are missing. The interaction
          represents resource pressure plus crop attraction. It is a heuristic
          reward, not a trained prediction or probability.
        </p>
        <p>
          Rain dryness = clip((250 − rain_mm)/240). Satellite vegetation stress
          = clip((0.75 − NDVI)/0.55). Visible-water availability =
          clip(water_fraction/0.02); W = 1 − availability. P = clip(1 −
          distance_m/8000). All clip to 0–1.
        </p>
        <p>
          Buffer = 300 + 2200 × R/100 metres, added outside a 250 m approximate
          settlement footprint. At R = 80, the buffer is 2060 m and the total
          radius is 2310 m. Geometry expresses an advisory area, not elephant
          speed, direction or arrival time.
        </p>
      </details>
    </section>
  );
}
