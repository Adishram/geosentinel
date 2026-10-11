import { ArrowUpRight, Database, FlaskConical, MapPinned } from "lucide-react";
import type { Bootstrap, ScenarioResult } from "../lib/types";

export default function Methodology({
  boot,
  result,
}: {
  boot: Bootstrap;
  result: ScenarioResult | null;
}) {
  const rule = boot.config.geofence,
    score = boot.config.score,
    observation = result?.current.observation;
  return (
    <div className="methodology-content">
      <section className="methodology-intro">
        <span className="eyebrow">
          <FlaskConical size={15} /> OPEN ASSUMPTIONS. TRACEABLE OUTPUTS.
        </span>
        <h2>
          Understanding begins
          <br />
          with <em>transparency.</em>
        </h2>
        <p>
          GeoSentinel is an exploration tool for geographic exposure and
          hypothetical environmental scenarios. Every score comes from an
          editable, deterministic rule. No trained animal-movement model, live
          tracking, or operational warning system is connected.
        </p>
      </section>
      <div className="methodology-columns">
        <section>
          <MapPinned className="method-icon" size={27} strokeWidth={1.2} />
          <span className="section-kicker">01 / GEOGRAPHY</span>
          <h3>
            Real coordinates.
            <br />
            Illustrative zones.
          </h3>
          <p>
            All six villages are selected by OSM ID. Reserve, roads, water, and
            forest features come from the existing Overpass cache. OSM forest
            coverage is incomplete; the reserve polygon may differ from gazetted
            boundaries.
          </p>
          <p>
            Each settlement footprint is a {rule.footprint_radius_m} m disc
            around a place node, not an administrative boundary. Buffers are
            computed in {rule.projected_crs} metres and reprojected to WGS84,
            preserving independent village polygons.
          </p>
          <code>
            buffer = {rule.min_m} + ({rule.max_m} − {rule.min_m}) × (score /
            100)^{rule.exponent}
          </code>
          <p className="metric-note">
            An assumed simulation radius; not a validated warning distance.
          </p>
        </section>
        <section>
          <FlaskConical className="method-icon" size={27} strokeWidth={1.2} />
          <span className="section-kicker">02 / SCORING</span>
          <h3>
            Explainable rules.
            <br />
            Unvalidated associations.
          </h3>
          <p>
            Normalised factors are weighted and summed. Missing factors are
            excluded and the remaining weights re-normalised. Rainfall and
            vegetation share a blended dryness factor to avoid double counting.
          </p>
          <code>score = 100 × Σ(weight × factor) / Σ(available weight)</code>
          <dl className="method-weights">
            {Object.entries(score.weights).map(([key, weight]) => (
              <div key={key}>
                <dt>{boot.labels[key]}</dt>
                <dd>{(weight * 100).toFixed(0)}%</dd>
              </div>
            ))}
          </dl>
          <p className="metric-note">
            Month adjustment is{" "}
            {score.month_crop_adjust.enabled
              ? "enabled in configuration"
              : "disabled"}
            . Category thresholds:{" "}
            {Object.entries(boot.config.categories)
              .map(([name, bound]) => `${name} ≥ ${bound}`)
              .join(" · ")}
            .
          </p>
        </section>
        <section>
          <Database className="method-icon" size={27} strokeWidth={1.2} />
          <span className="section-kicker">03 / ENVIRONMENT</span>
          <h3>
            Cached reanalysis.
            <br />
            Explicit assumptions.
          </h3>
          <p>
            Open-Meteo supplies ERA5 / ERA5-Land daily precipitation, not a
            direct satellite feed. All villages share one coarse grid cell; no
            village-level rainfall variation is fabricated.
          </p>
          <p>
            The 30-day window tolerates up to three missing days under the
            existing rule. Same-window climatology is calculated from 1991–2020
            only with at least 25 usable reference years.
          </p>
          <p>
            Vegetation stress, forest water availability, and crop
            attractiveness remain hypothetical user inputs. CHIRPS and
            Sentinel-2 integrations are pending.
          </p>
          <a
            className="text-link"
            href="https://open-meteo.com/en/docs/historical-weather-api"
            target="_blank"
            rel="noreferrer"
          >
            Open-Meteo documentation
            <ArrowUpRight size={15} />
          </a>
        </section>
      </div>
      <section className="environment-report">
        <div className="chart-header">
          <div>
            <span className="section-kicker">
              04 / THE ENVIRONMENTAL RECORD
            </span>
            <h2>Rainfall, with its context.</h2>
          </div>
          <span className="category-badge">
            {observation?.ok ? "Cached reanalysis available" : "Unavailable"}
          </span>
        </div>
        {observation ? (
          <>
            <p>
              {observation.ok
                ? `Measurement period: ${observation.period}`
                : observation.message}
            </p>
            <dl className="observation-grid">
              <div>
                <dt>30-day precipitation</dt>
                <dd>
                  {observation.rainfall_30d_mm === null
                    ? "Unavailable"
                    : `${observation.rainfall_30d_mm} mm`}
                </dd>
              </div>
              <div>
                <dt>1991–2020 window mean</dt>
                <dd>
                  {observation.climatology_mm === null
                    ? "Insufficient reference data"
                    : `${observation.climatology_mm} mm`}
                </dd>
              </div>
              <div>
                <dt>Rainfall anomaly</dt>
                <dd>
                  {observation.anomaly_pct === null
                    ? "Not computed"
                    : `${observation.anomaly_pct > 0 ? "+" : ""}${observation.anomaly_pct}%`}
                </dd>
              </div>
              <div>
                <dt>Missing days / reference years</dt>
                <dd>
                  {observation.missing_days} / {observation.ref_years_used}
                </dd>
              </div>
              <div>
                <dt>Shared grid point</dt>
                <dd>{observation.grid || "Unavailable"}</dd>
              </div>
              <div>
                <dt>Retrieved (UTC)</dt>
                <dd>{observation.retrieved || "Unavailable"}</dd>
              </div>
            </dl>
            <p className="metric-note">
              Approximate spatial resolution: 0.1° ERA5-Land / 0.25° ERA5,
              depending on Open-Meteo best-match. Low rainfall alone is not a
              computed drought index.
            </p>
          </>
        ) : (
          <p>
            Scenario data is unavailable. The cached data and methodology remain
            accessible.
          </p>
        )}
      </section>
      <section className="source-register">
        <div className="chart-header">
          <div>
            <span className="section-kicker">05 / THE SOURCE REGISTER</span>
            <h2>A clear chain of provenance.</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Dataset / integration</th>
                <th>Status</th>
                <th>Provenance & licence</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(boot.sources).map(([name, source]) => (
                <tr key={name}>
                  <th className="capitalize">{name}</th>
                  <td>
                    {Object.keys(source).length ? "Cached" : "Unavailable"}
                  </td>
                  <td>
                    {source.licence ?? "No cached metadata"}
                    <small className="source-time">
                      Retrieved: {source.retrieved_utc ?? "Unknown"}
                    </small>
                  </td>
                </tr>
              ))}
              <tr>
                <th>Open-Meteo rainfall</th>
                <td>{boot.date_range.max ? "Cached" : "Unavailable"}</td>
                <td>CC BY 4.0 · ERA5 / ERA5-Land · Copernicus / ECMWF</td>
              </tr>
              <tr>
                <th>CHIRPS rainfall</th>
                <td className="pending">Pending</td>
                <td>No integration connected</td>
              </tr>
              <tr>
                <th>Sentinel-2 NDVI</th>
                <td className="pending">Pending</td>
                <td>
                  Requires Earth Engine credentials; vegetation is a user
                  assumption
                </td>
              </tr>
              <tr>
                <th>Forest water / crop condition</th>
                <td className="pending">Unavailable</td>
                <td>No measured dataset; user assumptions only</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="metric-note">
          The default map uses cached geography without external tiles. Optional
          OpenStreetMap tiles are for light interactive development use, with
          visible attribution and no prefetching.
        </p>
        <a
          className="text-link"
          href="https://operations.osmfoundation.org/policies/tiles/"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap tile usage policy
          <ArrowUpRight size={15} />
        </a>
      </section>
      <section className="source-documents">
        <span className="section-kicker">06 / PROJECT DOCUMENTATION</span>
        {Object.entries(boot.documents).map(([name, content]) => (
          <details key={name}>
            <summary>
              {name.replaceAll("_", " ")}
              <span>Read original project notes</span>
            </summary>
            <pre>{content}</pre>
          </details>
        ))}
      </section>
    </div>
  );
}
