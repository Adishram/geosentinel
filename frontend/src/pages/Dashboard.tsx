import VideoAlert from "../components/VideoAlert";
import { lazy, Suspense, useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from "lucide-react";
import { api } from "../lib/api";
import type { Bootstrap } from "../lib/types";
import { useSimulation } from "../hooks/useSimulation";
import { ErrorState, Loading } from "../components/ui";
import Controls from "../components/Controls";
import Analysis from "../components/Analysis";
import Methodology from "./Methodology";
import EnvironmentalData from "../components/EnvironmentalData";

const GeoMap = lazy(() => import("../components/GeoMap"));
const Analytics = lazy(() => import("./Analytics"));
type View = "workspace" | "analytics" | "methodology";
export default function Dashboard({
  view,
  setView,
}: {
  view: View;
  setView: (view: View) => void;
}) {
  const [boot, setBoot] = useState<Bootstrap | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api
      .bootstrap(controller.signal)
      .then(setBoot)
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err.message ||
              "Cannot connect to the Python API. Start the API on port 8000 and retry.",
          );
      });
    return () => controller.abort();
  }, [retry]);
  if (error)
    return <ErrorState message={error} retry={() => setRetry((x) => x + 1)} />;
  if (!boot) return <Loading />;
  return <IntelligenceWorkspace boot={boot} view={view} setView={setView} />;
}
function IntelligenceWorkspace({
  boot,
  view,
  setView,
}: {
  boot: Bootstrap;
  view: View;
  setView: (view: View) => void;
}) {
  const simulation = useSimulation(boot);
  const [videoVillage, setVideoVillage] = useState<string | null>(null);
  const names = boot.villages.features.map((f) => f.properties.name);
  const [selected, setSelected] = useState(names),
    [focus, setFocus] = useState(names[0]);
  const [controls, setControls] = useState(
    () => !matchMedia("(max-width: 900px)").matches,
  );
  useEffect(() => {
    if (!controls || !matchMedia("(max-width: 900px)").matches) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = document.getElementById("scenario-panel");
    const elements = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), summary",
        ) ?? [],
      ).filter((element) => {
        if (!element.getClientRects().length) return false;
        // Closed details can retain layout rectangles for their descendants.
        // Only their summary participates in the drawer's keyboard focus loop.
        return Array.from(
          panel?.querySelectorAll("details:not([open])") ?? [],
        ).every(
          (details) =>
            !details.contains(element) ||
            details.querySelector(":scope > summary") === element,
        );
      });
    elements()?.[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setControls(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = elements();
      if (!focusable?.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const freeze = matchMedia("(max-width: 640px)").matches;
    const overflow = document.body.style.overflow;
    if (freeze) document.body.style.overflow = "hidden";
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      if (freeze) document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [controls]);
  const changeSelected = (next: string[]) => {
    setSelected(next);
    if (next.length && !next.includes(focus)) setFocus(next[0]);
  };
  const village = simulation.result?.villages.find((v) => v.name === focus);
  return (
    <div className="dashboard">
      {videoVillage && (
        <VideoAlert
          key={videoVillage}
          village={videoVillage}
          close={() => setVideoVillage(null)}
        />
      )}
      <section className="environment-data">
        <h2>Elephant alert simulation</h2>
        <p>
          Start the risk event, then click a village on the map to upload its
          simulated CCTV video.
        </p>
        <div className="environment-actions">
          <button
            onClick={() =>
              simulation.setScenario({
                ...simulation.scenario,
                mode: "what-if",
                use_live_data: false,
                rain_override: true,
                rainfall_30d_mm: 5,
                vegetation_stress: 1,
                forest_water_availability: 0,
                crop_attractiveness: 1,
              })
            }
          >
            Simulate threshold-crossing event
          </button>
          <button onClick={() => setVideoVillage(focus)}>
            Upload video for {focus}
          </button>
        </div>
        {!simulation.loading &&
          simulation.result?.alerts.map((alert) => (
            <p role="alert" key={alert.village}>
              <strong>⚠ {alert.village}: risk of elephants</strong> · Score{" "}
              {alert.score.toFixed(1)} exceeds the{" "}
              {simulation.result?.alert_threshold} threshold.{" "}
              <button onClick={() => setVideoVillage(alert.village)}>
                Check village video
              </button>
            </p>
          ))}
      </section>
      <div className="workspace-title">
        <div>
          <h1>
            {view === "workspace"
              ? "Geographic explorer"
              : view === "analytics"
                ? "Scenario analytics"
                : "Methodology & sources"}
          </h1>
        </div>
        <div className="workspace-meta">
          <span className="status-dot" />
          {simulation.scenario.use_live_data
            ? "API evidence"
            : "Cached geography"}
          <span className="date-label">{simulation.scenario.date}</span>
        </div>
      </div>
      <div className="workspace-toolbar">
        <div
          className="workspace-tabs"
          role="group"
          aria-label="Workspace view"
        >
          {(["workspace", "analytics", "methodology"] as const).map((tab) => (
            <button
              key={tab}
              className={view === tab ? "selected" : ""}
              aria-pressed={view === tab}
              onClick={() => setView(tab)}
            >
              {tab === "workspace"
                ? "Geographic explorer"
                : tab === "analytics"
                  ? "Scenario analytics"
                  : "Methodology & sources"}
            </button>
          ))}
        </div>
        {view !== "methodology" && (
          <button
            className="controls-toggle"
            onClick={() => setControls(!controls)}
            aria-expanded={controls}
            aria-controls="scenario-panel"
          >
            {controls ? (
              <PanelLeftClose size={16} />
            ) : (
              <PanelLeftOpen size={16} />
            )}
            <span>Scenario controls</span>
            <SlidersHorizontal size={15} />
          </button>
        )}
      </div>
      {view === "methodology" ? (
        <Methodology boot={boot} result={simulation.result} />
      ) : (
        <>
          <EnvironmentalData
            scenario={simulation.scenario}
            setScenario={simulation.setScenario}
            threshold={boot.alerts?.threshold ?? 80}
            village={village}
          />
          {simulation.error && (
            <div className="scenario-error" role="alert">
              <span>
                {simulation.error} Previous results are shown; they do not
                represent the edited inputs.
              </span>
              <button onClick={simulation.retry}>Retry calculation</button>
            </div>
          )}
          <div
            className={`workstation ${controls ? "controls-open" : ""} ${view === "analytics" ? "analytics-layout" : ""}`}
          >
            <div
              id="scenario-panel"
              className="controls-container"
              inert={!controls}
            >
              {controls && (
                <Controls
                  boot={boot}
                  {...simulation}
                  loading={simulation.loading || !!simulation.error}
                  selected={selected}
                  setSelected={changeSelected}
                  close={() => setControls(false)}
                />
              )}
            </div>
            {controls && (
              <button
                className="drawer-scrim"
                aria-label="Close scenario drawer"
                onClick={() => setControls(false)}
              />
            )}
            <div className="primary-workspace">
              {view === "workspace" ? (
                <Suspense
                  fallback={<Loading label="Loading geographic renderer…" />}
                >
                  <GeoMap
                    boot={boot}
                    result={simulation.result}
                    selected={selected}
                    focus={focus}
                    onFocus={(name) => {
                      setFocus(name);
                      setVideoVillage(name);
                    }}
                    loading={simulation.loading}
                  />
                </Suspense>
              ) : (
                <Suspense
                  fallback={<Loading label="Loading scenario analytics…" />}
                >
                  <Analytics
                    result={simulation.result}
                    boot={boot}
                    selected={selected}
                    focus={focus}
                    onFocus={setFocus}
                    loading={simulation.loading || !!simulation.error}
                  />
                </Suspense>
              )}
            </div>
            {view === "workspace" && (
              <Analysis
                village={village}
                result={simulation.result}
                boot={boot}
                selected={selected}
                focus={focus}
                onFocus={setFocus}
                stale={simulation.loading || !!simulation.error}
              />
            )}
          </div>
          <div className="workspace-footnote">
            <span>
              {simulation.scenario.mode === "environmental"
                ? "ENVIRONMENTAL BASELINE"
                : "HYPOTHETICAL SCENARIO"}{" "}
              · {selected.length} villages selected
            </span>
            <p>
              Geofences computed in UTM 43N by Python. Scores are illustrative;
              no animal tracking or live alerts.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
