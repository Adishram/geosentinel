import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as LibreMap, Marker } from "maplibre-gl";
import { Crosshair, Layers3, Minus, Plus, X } from "lucide-react";
import type { FeatureCollection } from "geojson";
import {
  colors,
  emptyCollection,
  type Bootstrap,
  type ScenarioResult,
} from "../lib/types";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

maplibregl.setWorkerUrl(workerUrl);
maplibregl.setWorkerCount(2);

type Props = {
  boot: Bootstrap;
  result: ScenarioResult | null;
  selected: string[];
  focus: string;
  onFocus: (name: string) => void;
  loading: boolean;
};
const layerNames = {
  reserve: "Reserve boundary",
  forest: "OSM forest cover",
  roads: "Roads",
  water: "Water features",
  current: "Current geofences",
  baseline: "Saved baseline",
  footprints: "Approx. footprints",
};
const categoryColor: maplibregl.ExpressionSpecification = [
  "match",
  ["get", "category"],
  "Low",
  colors.Low,
  "Moderate",
  colors.Moderate,
  "Elevated",
  colors.Elevated,
  "High",
  colors.High,
  colors.Moderate,
];
export default function GeoMap(p: Props) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<LibreMap | null>(null);
  const markers = useRef<Record<string, Marker>>({});
  const latestResult = useRef(p.result);
  const popup = useRef<maplibregl.Popup | null>(null);
  latestResult.current = p.result;
  const callback = useRef(p.onFocus);
  const previousFocus = useRef(p.focus);
  callback.current = p.onFocus;
  const [ready, setReady] = useState(false),
    [failure, setFailure] = useState("");
  const [layerMenu, setLayerMenu] = useState(false),
    [style, setStyle] = useState("cached");
  const [layers, setLayers] = useState<Record<string, boolean>>({
    reserve: true,
    forest: true,
    roads: true,
    water: true,
    current: true,
    baseline: true,
    footprints: true,
  });
  const [tileError, setTileError] = useState(false);
  const [bearing, setBearing] = useState(0);
  useEffect(() => {
    if (!host.current) return;
    const [w, s, e, n] = p.boot.config.study_area.bbox;
    let instance: LibreMap;
    try {
      instance = new maplibregl.Map({
        container: host.current,
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#101d18" },
            },
          ],
        },
        bounds: [
          [w, s],
          [e, n],
        ],
        fitBoundsOptions: { padding: 45 },
        attributionControl: false,
        minZoom: 9,
        maxZoom: 18,
      });
    } catch {
      setFailure(
        "WebGL is unavailable. Village analysis and charts remain accessible; enable hardware acceleration to use the map.",
      );
      return;
    }
    map.current = instance;
    instance.on("rotate", () => setBearing(instance.getBearing()));
    instance.addControl(
      new maplibregl.AttributionControl({
        customAttribution:
          'Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · ODbL',
        compact: false,
      }),
    );
    instance.addControl(
      new maplibregl.ScaleControl({ unit: "metric", maxWidth: 90 }),
      "bottom-left",
    );
    instance.on("error", (event) => {
      if (event.error.message.includes("Worker"))
        setFailure(
          "Geographic renderer could not load its worker. Reload the page or rebuild the frontend.",
        );
      else if (
        event.error.message.includes("tile") ||
        event.error.message.includes("Failed to fetch")
      )
        setTileError(true);
    });
    instance.on("idle", () => {
      if (
        host.current &&
        instance.getSource("current") &&
        instance.isSourceLoaded("reserve") &&
        instance.isSourceLoaded("current")
      )
        host.current.dataset.geographyReady = "true";
    });
    instance.on("movestart", () => {
      if (host.current) host.current.dataset.cameraMoving = "true";
    });
    instance.on("moveend", () => {
      if (host.current) host.current.dataset.cameraMoving = "false";
    });
    instance.on("load", () => {
      instance.addSource("osm", {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors",
      });
      instance.addLayer({
        id: "osm",
        type: "raster",
        source: "osm",
        layout: { visibility: "none" },
      });
      const addSource = (id: string, data: FeatureCollection | null) =>
        instance.addSource(id, {
          type: "geojson",
          data: data ?? emptyCollection,
        });
      for (const id of ["reserve", "forest", "roads", "water"])
        addSource(id, p.boot.layers[id]);
      instance.addLayer({
        id: "reserve-fill",
        type: "fill",
        source: "reserve",
        paint: { "fill-color": "#284a36", "fill-opacity": 0.48 },
      });
      instance.addLayer({
        id: "forest",
        type: "fill",
        source: "forest",
        filter: [
          "in",
          ["geometry-type"],
          ["literal", ["Polygon", "MultiPolygon"]],
        ],
        paint: { "fill-color": "#3b6745", "fill-opacity": 0.28 },
      });
      instance.addLayer({
        id: "roads",
        type: "line",
        source: "roads",
        paint: {
          "line-color": "#a6a18e",
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 15, 2],
          "line-opacity": 0.3,
        },
      });
      instance.addLayer({
        id: "water-fill",
        type: "fill",
        source: "water",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#77b9ca", "fill-opacity": 0.25 },
      });
      instance.addLayer({
        id: "water",
        type: "line",
        source: "water",
        paint: {
          "line-color": "#77b9ca",
          "line-width": 1.2,
          "line-opacity": 0.55,
        },
      });
      instance.addLayer({
        id: "reserve",
        type: "line",
        source: "reserve",
        paint: {
          "line-color": "#6fa47d",
          "line-width": 1.4,
          "line-dasharray": [4, 3],
        },
      });
      addSource("footprints", p.boot.footprints);
      instance.addLayer({
        id: "footprints",
        type: "fill",
        source: "footprints",
        paint: { "fill-color": "#e6e6d8", "fill-opacity": 0.22 },
      });
      addSource("current", emptyCollection);
      addSource("baseline", emptyCollection);
      instance.addLayer({
        id: "current-fill",
        type: "fill",
        source: "current",
        paint: {
          "fill-color": categoryColor,
          "fill-opacity": 0.1,
          "fill-opacity-transition": { duration: 450 },
        },
      });
      instance.addLayer({
        id: "current",
        type: "line",
        source: "current",
        paint: {
          "line-color": categoryColor,
          "line-width": 2,
          "line-opacity-transition": { duration: 450 },
        },
      });
      instance.addLayer({
        id: "baseline",
        type: "line",
        source: "baseline",
        paint: {
          "line-color": "#d9e1dd",
          "line-width": 1.5,
          "line-dasharray": [3, 3],
          "line-opacity": 0.65,
        },
      });
      for (const feature of p.boot.villages.features) {
        const element = document.createElement("button");
        element.className = "village-marker";
        element.setAttribute(
          "aria-label",
          `Analyze ${feature.properties.name}`,
        );
        element.addEventListener("click", () =>
          callback.current(feature.properties.name),
        );
        const dot = document.createElement("span");
        dot.className = "marker-dot";
        const label = document.createElement("span");
        label.className = "marker-label";
        label.textContent = feature.properties.name;
        element.append(dot, label);
        const showPopup = () => {
          const village = latestResult.current?.villages.find(
            (v) => v.name === feature.properties.name,
          );
          if (!village) return;
          popup.current?.remove();
          const content = document.createElement("div");
          content.className = "village-popover";
          const title = document.createElement("strong");
          title.textContent = village.name;
          const score = document.createElement("p");
          score.textContent = `${village.score.toFixed(1)} / 100 · ${village.category}`;
          const geography = document.createElement("small");
          geography.textContent = `${Math.round(village.buffer_m).toLocaleString()} m buffer · ${village.area_km2.toFixed(2)} km²`;
          const note = document.createElement("small");
          note.textContent = "Research simulation · click to analyze";
          content.append(title, score, geography, note);
          popup.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 14,
            maxWidth: "250px",
          })
            .setLngLat(village.coordinates)
            .setDOMContent(content)
            .addTo(instance);
        };
        element.addEventListener("pointerenter", (event) => {
          if (event.pointerType !== "touch") showPopup();
        });
        element.addEventListener("pointerleave", () => popup.current?.remove());
        element.addEventListener("focus", showPopup);
        element.addEventListener("blur", () => popup.current?.remove());
        markers.current[feature.properties.name] = new maplibregl.Marker({
          element,
          anchor: "left",
        })
          .setLngLat(feature.geometry.coordinates as [number, number])
          .addTo(instance);
      }
      setReady(true);
    });
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      popup.current?.remove();
      Object.values(markers.current).forEach((marker) => marker.remove());
      markers.current = {};
      instance.remove();
      map.current = null;
    };
  }, [p.boot]);
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const filter = (data: FeatureCollection | null): FeatureCollection => ({
      type: "FeatureCollection",
      features: (data?.features ?? []).filter((feature) =>
        p.selected.includes(feature.properties?.name),
      ),
    });
    if (host.current) host.current.dataset.geographyReady = "false";
    (instance.getSource("current") as GeoJSONSource).setData(
      filter(p.result?.geofences ?? null),
    );
    (instance.getSource("baseline") as GeoJSONSource).setData(
      filter(p.result?.baseline_geofences ?? null),
    );
    (instance.getSource("footprints") as GeoJSONSource).setData(
      filter(p.boot.footprints),
    );
    for (const [name, marker] of Object.entries(markers.current)) {
      const element = marker.getElement();
      const village = p.result?.villages.find((v) => v.name === name);
      element.style.display = p.selected.includes(name) ? "" : "none";
      element.style.setProperty(
        "--marker-color",
        village ? colors[village.category] : colors.Low,
      );
      element.classList.toggle("focused", name === p.focus);
      element.title = village
        ? `${name}: ${village.score.toFixed(1)} / 100 · ${village.category} · ${village.buffer_m.toFixed(0)} m buffer`
        : name;
      element.setAttribute("aria-pressed", String(name === p.focus));
    }
  }, [ready, p.result, p.selected, p.focus, p.boot]);
  useEffect(() => {
    if (!ready || previousFocus.current === p.focus) return;
    previousFocus.current = p.focus;
    const feature = p.boot.villages.features.find(
      (f) => f.properties.name === p.focus,
    );
    if (ready && feature && map.current)
      map.current.flyTo({
        center: feature.geometry.coordinates as [number, number],
        zoom: 12.7,
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 1100,
        padding: { top: 45, bottom: 75, left: 45, right: 45 },
      });
  }, [ready, p.focus, p.boot]);
  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setLayoutProperty(
      "osm",
      "visibility",
      style === "osm" ? "visible" : "none",
    );
    for (const [id, visible] of Object.entries(layers)) {
      map.current.setLayoutProperty(
        id,
        "visibility",
        visible ? "visible" : "none",
      );
      if (id === "reserve" || id === "current" || id === "water")
        map.current.setLayoutProperty(
          `${id}-fill`,
          "visibility",
          visible ? "visible" : "none",
        );
    }
    map.current.setPaintProperty(
      "reserve-fill",
      "fill-opacity",
      style === "osm" ? 0.12 : 0.48,
    );
  }, [ready, layers, style]);
  const resetView = () => {
    const [w, s, e, n] = p.boot.config.study_area.bbox;
    map.current?.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      {
        padding: 45,
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 900,
      },
    );
  };
  return (
    <section
      className="map-workspace"
      aria-label="Interactive Mudumalai village map"
    >
      <div ref={host} className="map-canvas" />
      <div className="map-heading">
        <strong>Mudumalai landscape</strong>
        <span>Cached geography</span>
      </div>
      <div className="map-tools">
        <button
          className="map-tool"
          aria-label="Toggle geographic layers"
          aria-expanded={layerMenu}
          onClick={() => setLayerMenu(!layerMenu)}
        >
          <Layers3 size={17} />
        </button>
        <button
          className="map-tool"
          aria-label="Show entire study area"
          onClick={resetView}
        >
          <Crosshair size={17} />
        </button>
        <div className="zoom-tools">
          <button
            className="map-tool"
            aria-label="Zoom in"
            onClick={() => map.current?.zoomIn()}
          >
            <Plus size={18} />
          </button>
          <button
            className="map-tool"
            aria-label="Zoom out"
            onClick={() => map.current?.zoomOut()}
          >
            <Minus size={18} />
          </button>
        </div>
      </div>
      {layerMenu && (
        <div className="layer-menu">
          <div className="panel-title">
            <span>Geographic layers</span>
            <button
              className="icon-button"
              aria-label="Close layers"
              onClick={() => setLayerMenu(false)}
            >
              <X size={15} />
            </button>
          </div>
          {Object.entries(layerNames).map(([id, name]) => (
            <label className="village-checkbox" key={id}>
              <input
                type="checkbox"
                checked={layers[id]}
                disabled={
                  id === "baseline"
                    ? !p.result?.baseline_geofences
                    : id in p.boot.layers && !p.boot.layers[id]
                }
                onChange={(event) =>
                  setLayers({ ...layers, [id]: event.target.checked })
                }
              />
              <span>
                {name}
                {id in p.boot.layers && !p.boot.layers[id]
                  ? " (unavailable)"
                  : ""}
              </span>
            </label>
          ))}
          <label className="control-label" htmlFor="map-style">
            Base map
          </label>
          <select
            id="map-style"
            value={style}
            onChange={(e) => {
              setTileError(false);
              setStyle(e.target.value);
            }}
          >
            <option value="cached">Cached geography · offline</option>
            <option value="osm">OpenStreetMap · online tiles</option>
          </select>
          <p className="control-hint">
            Cached layers use OSM coordinates. Forest coverage is incomplete;
            footprints are approximate.
          </p>
        </div>
      )}
      <div className="map-legend">
        <span className="legend-title">Illustrative score</span>
        <div>
          {Object.entries(colors).map(([name, color]) => (
            <span key={name}>
              <i style={{ background: color }} />
              {name}
            </span>
          ))}
        </div>
        <p>
          <span className="line-key" /> Current{" "}
          {p.result?.baseline_geofences && (
            <>
              <span className="line-key dashed" /> Baseline
            </>
          )}
        </p>
      </div>
      {p.loading && (
        <div className="map-status" role="status">
          <span className="status-dot" />
          Updating Python calculations…
        </div>
      )}
      {!p.selected.length && (
        <div className="map-message">
          No villages selected. Choose villages in scenario controls.
        </div>
      )}
      {tileError && (
        <div className="map-message">
          Online tiles unavailable. Cached geographic layers remain usable.
          <button onClick={() => setStyle("cached")}>Use cached map</button>
        </div>
      )}
      {failure && (
        <div className="map-message" role="alert">
          {failure}
        </div>
      )}
      <span className="map-north" aria-hidden="true">
        N<span style={{ transform: `rotate(${-bearing}deg)` }}>↑</span>
      </span>
    </section>
  );
}
