import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type {
  Bootstrap,
  Scenario,
  SavedScenario,
  ScenarioResult,
} from "../lib/types";

const storageKey = "geosentinel-baseline-v1";
function readBaseline(): SavedScenario | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (
      !parsed ||
      typeof parsed.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ||
      !["what-if", "environmental"].includes(parsed.mode) ||
      typeof parsed.rain_override !== "boolean"
    )
      return null;
    for (const [key, max] of Object.entries({
      rainfall_30d_mm: 500,
      vegetation_stress: 1,
      forest_water_availability: 1,
      crop_attractiveness: 1,
    })) {
      if (
        parsed[key] !== null &&
        (typeof parsed[key] !== "number" ||
          parsed[key] < 0 ||
          parsed[key] > max)
      )
        return null;
    }
    if (
      parsed.snapshot_captured !== true ||
      (parsed.rainfall_snapshot !== null &&
        (typeof parsed.rainfall_snapshot !== "number" ||
          !Number.isFinite(parsed.rainfall_snapshot) ||
          parsed.rainfall_snapshot < 0))
    )
      return null;
    return parsed as SavedScenario;
  } catch {
    return null;
  }
}

export function useSimulation(boot: Bootstrap) {
  const [scenario, setScenario] = useState<Scenario>(() => ({
    date:
      boot.date_range.max ??
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    mode: "what-if",
    rain_override: false,
    ...boot.presets["Baseline conditions"],
  }));
  const [baseline, setBaseline] = useState<SavedScenario | null>(readBaseline);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const sequence = useRef(0);
  const inputsMatch =
    !!result &&
    Object.entries(scenario).every(
      ([key, value]) =>
        result.current.scenario[key as keyof Scenario] === value,
    );
  const pending = loading || (!error && !inputsMatch);
  useEffect(() => {
    const controller = new AbortController();
    const id = ++sequence.current;
    setLoading(true);
    setError("");
    const timeout = window.setTimeout(() => {
      api
        .scenario(scenario, baseline, controller.signal)
        .then((data) => {
          if (sequence.current === id) {
            setResult(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!controller.signal.aborted && sequence.current === id) {
            setError(err.message);
            setLoading(false);
          }
        });
    }, 220);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [scenario, baseline, retry]);
  const saveBaseline = () => {
    if (!result || pending || error || !inputsMatch) return;
    const stored: SavedScenario = {
      ...scenario,
      snapshot_captured: true,
      rainfall_snapshot: result.current.inputs.rainfall_30d_mm,
      observation_snapshot: result.current.observation,
    };
    setBaseline(stored);
    try {
      localStorage.setItem(storageKey, JSON.stringify(stored));
    } catch {
      /* Session still works when storage is unavailable. */
    }
  };
  const clearBaseline = () => {
    setBaseline(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* Session state is authoritative. */
    }
  };
  return {
    scenario,
    setScenario,
    baseline,
    result,
    loading: pending,
    error,
    saveBaseline,
    clearBaseline,
    retry: () => setRetry((x) => x + 1),
  };
}
