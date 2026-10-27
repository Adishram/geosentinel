import { useRef } from "react";
import { Check, RotateCcw, Save, X } from "lucide-react";
import type {
  Bootstrap,
  InputKey,
  Scenario,
  ScenarioResult,
} from "../lib/types";

interface Props {
  boot: Bootstrap;
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  result: ScenarioResult | null;
  baseline: Scenario | null;
  loading: boolean;
  saveBaseline: () => void;
  clearBaseline: () => void;
  selected: string[];
  setSelected: (names: string[]) => void;
  close: () => void;
}
const fields: {
  key: InputKey;
  name: string;
  description: string;
  max: number;
  step: number;
  unit: string;
}[] = [
  {
    key: "rainfall_30d_mm",
    name: "Recent rainfall",
    description: "30-day total",
    max: 500,
    step: 5,
    unit: "mm",
  },
  {
    key: "vegetation_stress",
    name: "Vegetation stress",
    description: "Green → very dry · manual assumption",
    max: 1,
    step: 0.05,
    unit: "",
  },
  {
    key: "forest_water_availability",
    name: "Forest water availability",
    description: "None → plentiful · user assumption",
    max: 1,
    step: 0.05,
    unit: "",
  },
  {
    key: "crop_attractiveness",
    name: "Crop attractiveness",
    description: "Young → mature · user assumption",
    max: 1,
    step: 0.05,
    unit: "",
  },
];
export default function Controls(p: Props) {
  const known = useRef<Record<InputKey, number>>({
    rainfall_30d_mm: 120,
    vegetation_stress: 0.4,
    forest_water_availability: 0.6,
    crop_attractiveness: 0.4,
  });
  const update = (patch: Partial<Scenario>) =>
    p.setScenario({ ...p.scenario, ...patch, use_live_data: false });
  const observed =
    p.scenario.mode === "environmental" &&
    !p.scenario.rain_override &&
    !p.scenario.use_live_data;
  return (
    <aside className="controls-panel" aria-label="Scenario controls">
      <div className="panel-title">
        <span>Scenario controls</span>
        <button
          className="icon-button"
          onClick={p.close}
          aria-label="Close scenario controls"
        >
          <X size={17} />
        </button>
      </div>
      <div className="control-scroll">
        <div className="control-group">
          <label htmlFor="scenario-date" className="control-label">
            Scenario date
          </label>
          <input
            id="scenario-date"
            type="date"
            value={p.scenario.date}
            min="2017-01-01"
            onChange={(e) => {
              if (e.target.value) update({ date: e.target.value });
            }}
          />
          <span className="control-hint">
            End of the 30-day rainfall window
          </span>
        </div>
        <div className="control-group">
          <span className="control-label" id="mode-label">
            Input mode
          </span>
          <div className="segmented" role="group" aria-labelledby="mode-label">
            <button
              aria-pressed={p.scenario.mode === "what-if"}
              className={p.scenario.mode === "what-if" ? "selected" : ""}
              onClick={() => update({ mode: "what-if" })}
            >
              What-if
            </button>
            <button
              aria-pressed={p.scenario.mode === "environmental"}
              className={p.scenario.mode === "environmental" ? "selected" : ""}
              onClick={() =>
                update({ mode: "environmental", rain_override: false })
              }
            >
              Environmental
            </button>
          </div>
          <p className="control-hint">
            {p.scenario.use_live_data
              ? "API weather and satellite evidence active. Adjusting a control switches to manual assumptions."
              : observed
                ? "Rainfall from cached reanalysis. Other inputs remain hypothetical."
                : "User-defined assumptions. No measured environmental change."}
          </p>
          {observed &&
            !p.loading &&
            p.result &&
            !p.result.current.observation.ok && (
              <p className="control-hint unavailable-note" role="status">
                Cached rainfall unavailable:{" "}
                {p.result.current.observation.message} Rainfall is excluded from
                scoring.
              </p>
            )}
        </div>
        <div className="control-group">
          <label className="control-label" htmlFor="preset">
            Hypothetical preset
          </label>
          <select
            id="preset"
            value=""
            onChange={(e) =>
              update({ ...p.boot.presets[e.target.value], rain_override: true })
            }
          >
            <option value="" disabled>
              Choose a scenario
            </option>
            {Object.keys(p.boot.presets).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>
        <details className="control-disclosure">
          <summary>Adjust environmental inputs</summary>
          <p className="control-hint">
            Unknown inputs are excluded; available weights are re-normalised.
          </p>
          <div className="slider-list">
            {fields.map((field) => {
              const isObserved = field.key === "rainfall_30d_mm" && observed;
              const value = isObserved
                ? (p.result?.current.observation.rainfall_30d_mm ?? null)
                : p.scenario[field.key];
              const stale = isObserved && p.loading;
              return (
                <div className="slider-control" key={field.key}>
                  <div className="slider-heading">
                    <label htmlFor={field.key}>{field.name}</label>
                    <output htmlFor={field.key}>
                      {stale
                        ? "…"
                        : value === null
                          ? "—"
                          : field.max === 1
                            ? value.toFixed(2)
                            : Math.round(value)}
                      <small>{field.unit}</small>
                    </output>
                  </div>
                  <span
                    className={`input-provenance ${isObserved ? "observed" : ""}`}
                  >
                    {value === null
                      ? "Missing input"
                      : isObserved
                        ? "Cached reanalysis"
                        : "Hypothetical"}
                  </span>
                  <input
                    type="range"
                    id={field.key}
                    min={0}
                    max={
                      isObserved ? Math.max(field.max, value ?? 0) : field.max
                    }
                    step={field.step}
                    value={value ?? known.current[field.key]}
                    disabled={isObserved || value === null}
                    style={
                      {
                        "--range-progress": `${Math.min(100, (100 * (value ?? 0)) / field.max)}%`,
                      } as React.CSSProperties
                    }
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      known.current[field.key] = v;
                      update({ [field.key]: v });
                    }}
                  />
                  <div className="slider-footer">
                    <span>{field.description}</span>
                    {!isObserved && (
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={p.scenario[field.key] === null}
                          onChange={(e) => {
                            if (p.scenario[field.key] !== null)
                              known.current[field.key] = p.scenario[field.key]!;
                            update({
                              [field.key]: e.target.checked
                                ? null
                                : known.current[field.key],
                            });
                          }}
                        />
                        Unknown
                      </label>
                    )}
                  </div>
                  {field.key === "rainfall_30d_mm" &&
                    p.scenario.mode === "environmental" && (
                      <label className="check-label override">
                        <input
                          type="checkbox"
                          checked={p.scenario.rain_override}
                          onChange={(e) =>
                            update({ rain_override: e.target.checked })
                          }
                        />
                        Override rainfall with a what-if value
                      </label>
                    )}
                </div>
              );
            })}
          </div>
          {p.scenario.mode === "environmental" && (
            <button
              className="text-link reset-button"
              onClick={() =>
                update({
                  rain_override: false,
                  vegetation_stress: 0.4,
                  forest_water_availability: 0.6,
                  crop_attractiveness: 0.4,
                })
              }
            >
              <RotateCcw size={13} />
              Reset to observed baseline
            </button>
          )}
        </details>
        <div className="baseline-actions">
          <button
            className="button primary compact"
            disabled={p.loading || !p.result}
            onClick={p.saveBaseline}
          >
            <Save size={14} />
            {p.baseline ? "Replace saved baseline" : "Save current baseline"}
          </button>
          {p.baseline && (
            <div className="saved-baseline">
              <span>
                <Check size={12} />
                Saved · {p.baseline.date}
              </span>
              <button onClick={p.clearBaseline}>Clear</button>
            </div>
          )}
        </div>
        <details className="control-disclosure village-disclosure">
          <summary>
            Villages in view <span>{p.selected.length} of 6</span>
          </summary>
          <fieldset className="village-selector">
            <legend className="control-label">
              Villages in view <span>{p.selected.length}/6</span>
            </legend>
            {p.boot.villages.features.map((feature) => (
              <label className="village-checkbox" key={feature.properties.name}>
                <input
                  type="checkbox"
                  checked={p.selected.includes(feature.properties.name)}
                  onChange={(e) =>
                    p.setSelected(
                      e.target.checked
                        ? [...p.selected, feature.properties.name]
                        : p.selected.filter(
                            (n) => n !== feature.properties.name,
                          ),
                    )
                  }
                />
                <span>{feature.properties.name}</span>
              </label>
            ))}
          </fieldset>
        </details>
      </div>
    </aside>
  );
}
