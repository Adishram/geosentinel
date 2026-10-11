import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  FlaskConical,
} from "lucide-react";
import {
  colors,
  type Bootstrap,
  type ScenarioResult,
  type VillageResult,
} from "../lib/types";

function AnimatedValue({ value }: { value: number }) {
  const element = useRef<HTMLSpanElement>(null),
    previous = useRef(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      if (element.current) element.current.textContent = value.toFixed(1);
      previous.current = value;
      return;
    }
    const animation = animate(previous.current, value, {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (number) => {
        if (element.current) element.current.textContent = number.toFixed(1);
      },
    });
    previous.current = value;
    return () => animation.stop();
  }, [value, reduced]);
  return <span ref={element}>{value.toFixed(1)}</span>;
}
export default function Analysis({
  village,
  result,
  boot,
  selected,
  focus,
  onFocus,
  stale,
}: {
  village: VillageResult | undefined;
  result: ScenarioResult | null;
  boot: Bootstrap;
  selected: string[];
  focus: string;
  onFocus: (name: string) => void;
  stale: boolean;
}) {
  const [advisory, setAdvisory] = useState(false);
  if (!village || !selected.length)
    return (
      <aside className="analysis-panel">
        <div className="panel-title">Village intelligence</div>
        <p className="empty-state">
          Select a village to inspect its score, geography, and assumptions.
        </p>
      </aside>
    );
  return (
    <aside
      className={`analysis-panel ${stale ? "stale" : ""}`}
      aria-label="Selected village intelligence"
      aria-busy={stale}
    >
      <div className="panel-title">
        <span>Village intelligence</span>
      </div>
      <div className="analysis-content">
        <label className="sr-only" htmlFor="focus-village">
          Analyze village
        </label>
        <select
          className="focus-select"
          id="focus-village"
          value={focus}
          onChange={(e) => onFocus(e.target.value)}
        >
          {selected.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <div className="village-coordinates">
          {village.coordinates[1].toFixed(4)}° N &nbsp;{" "}
          {village.coordinates[0].toFixed(4)}° E
        </div>
        <div className="score-block">
          <span className="micro-label">
            Illustrative scenario score {stale && "· Updating"}
          </span>
          <div className="score-value">
            <AnimatedValue value={village.score} />
            <small>/ 100</small>
          </div>
          <div className="score-context">
            <span
              className="category-badge"
              style={{
                color: colors[village.category],
                borderColor: colors[village.category] + "55",
              }}
            >
              <i style={{ background: colors[village.category] }} />
              {village.category}
            </span>
            {village.delta !== null ? (
              <span className="score-delta">
                {village.delta >= 0 ? (
                  <ArrowUpRight size={14} />
                ) : (
                  <ArrowDownRight size={14} />
                )}{" "}
                {village.delta > 0 ? "+" : ""}
                {village.delta.toFixed(1)} vs baseline
              </span>
            ) : (
              <span className="score-delta">No baseline saved</span>
            )}
          </div>
          <div className="score-track">
            <span
              style={{
                width: `${village.score}%`,
                background: colors[village.category],
              }}
            />
          </div>
          {!!result?.current.missing_inputs.length && (
            <p className="score-quality">
              Unknown inputs: {result.current.missing_inputs.join(", ")}. See
              input provenance for details.
            </p>
          )}
        </div>
        <dl className="geographic-metrics">
          <div>
            <dt>Geofence buffer</dt>
            <dd>
              {Math.round(village.buffer_m).toLocaleString()}
              <small> m</small>
            </dd>
          </div>
          <div>
            <dt>Geofence area</dt>
            <dd>
              {village.area_km2.toFixed(2)}
              <small> km²</small>
            </dd>
          </div>
          <div>
            <dt>Distance to reserve</dt>
            <dd>
              {village.inside_reserve
                ? "Inside reserve"
                : `${Math.round(village.distance_to_forest_m).toLocaleString()} m`}
            </dd>
          </div>
        </dl>
        <p className="metric-note">
          Buffer from a {boot.config.geofence.footprint_radius_m} m approximate
          settlement disc. Not an official boundary or validated warning radius.
        </p>
        <details className="contribution-section analysis-disclosure">
          <summary>What shapes this score</summary>
          {Object.entries(village.contributions).map(([key, points]) => (
            <div className="contribution-row" key={key}>
              <div>
                <span>{boot.labels[key]}</span>
                <span>
                  {village.factors[key] === null
                    ? "Excluded"
                    : points.toFixed(1)}
                </span>
              </div>
              <div className="contribution-track">
                <span style={{ width: `${points}%` }} />
              </div>
              {village.contribution_deltas &&
                Math.abs(village.contribution_deltas[key]) >= 0.5 && (
                  <small>
                    {village.contribution_deltas[key] > 0 ? "+" : ""}
                    {village.contribution_deltas[key].toFixed(1)} points vs
                    baseline
                  </small>
                )}
            </div>
          ))}
        </details>
        <details className="explanation-section analysis-disclosure">
          <summary>Why it changed</summary>
          {village.explanation.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </details>
        <details className="provenance-section analysis-disclosure">
          <summary>Input provenance</summary>
          {Object.entries(result?.current.provenance ?? {}).map(
            ([key, source]) => (
              <div key={key}>
                <span>{key}</span>
                <span
                  className={
                    source.startsWith("observed")
                      ? "observed-text"
                      : source === "missing"
                        ? "missing-text"
                        : ""
                  }
                >
                  {source}
                </span>
              </div>
            ),
          )}
          {result?.current.missing_inputs.length ? (
            <p className="metric-note">
              Missing sub-inputs: {result.current.missing_inputs.join(", ")}.
              Dryness can still use its available component.
            </p>
          ) : null}
        </details>
        <div className="advisory-section">
          <button
            className="advisory-toggle"
            aria-expanded={advisory}
            onClick={() => setAdvisory(!advisory)}
          >
            <FlaskConical size={15} />
            Simulated advisory preview
            <ChevronDown size={15} className={advisory ? "rotated" : ""} />
          </button>
          {advisory && (
            <div>
              <p className="metric-note">Preview only. No message is sent.</p>
              <pre>{village.advisory}</pre>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
