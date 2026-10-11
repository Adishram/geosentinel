import type { FeatureCollection, Point } from "geojson";

export type Mode = "what-if" | "environmental";
export type InputKey =
  | "rainfall_30d_mm"
  | "vegetation_stress"
  | "forest_water_availability"
  | "crop_attractiveness";
export interface Scenario {
  date: string;
  mode: Mode;
  rain_override: boolean;
  rainfall_30d_mm: number | null;
  vegetation_stress: number | null;
  forest_water_availability: number | null;
  crop_attractiveness: number | null;
}
export interface SavedScenario extends Scenario {
  snapshot_captured: boolean;
  rainfall_snapshot: number | null;
  observation_snapshot?: Observation;
}
export interface Observation {
  ok: boolean;
  message: string;
  rainfall_30d_mm: number | null;
  period: string;
  missing_days: number;
  climatology_mm: number | null;
  anomaly_pct: number | null;
  ref_years_used: number;
  grid: string;
  retrieved: string;
  source_url: string;
}
export interface ResolvedScenario {
  scenario: Scenario;
  inputs: { month: number } & Pick<Scenario, InputKey>;
  provenance: Record<string, string>;
  missing_inputs: string[];
  observation: Observation;
}
export type Category = "Low" | "Moderate" | "Elevated" | "High";
export interface VillageResult {
  name: string;
  osm_id: string;
  coordinates: [number, number];
  inside_reserve: boolean;
  distance_to_forest_m: number;
  score: number;
  category: Category;
  contributions: Record<string, number>;
  factors: Record<string, number | null>;
  missing: string[];
  buffer_m: number;
  area_km2: number;
  baseline_score: number | null;
  baseline_buffer_m: number | null;
  delta: number | null;
  contribution_deltas: Record<string, number> | null;
  explanation: string[];
  advisory: string;
}
export interface ScenarioResult {
  current: ResolvedScenario;
  baseline: ResolvedScenario | null;
  villages: VillageResult[];
  geofences: FeatureCollection;
  baseline_geofences: FeatureCollection | null;
  disclaimer: string;
}
export interface Bootstrap {
  config: {
    geofence: {
      min_m: number;
      max_m: number;
      exponent: number;
      footprint_radius_m: number;
      projected_crs: string;
    };
    score: {
      weights: Record<string, number>;
      rainfall: { wet_mm: number; dry_mm: number };
      proximity: { near_m: number; far_m: number };
      dryness_blend: Record<string, number>;
      month_crop_adjust: { enabled: boolean };
    };
    categories: Record<Category, number>;
    study_area: {
      bbox: [number, number, number, number];
      weather_point: [number, number];
    };
  };
  labels: Record<string, string>;
  presets: Record<string, Pick<Scenario, InputKey>>;
  date_range: { min: string | null; max: string | null };
  villages: FeatureCollection<
    Point,
    {
      name: string;
      osm_id: string;
      inside_reserve: boolean;
      distance_to_forest_m: number;
    }
  >;
  footprints: FeatureCollection;
  layers: Record<string, FeatureCollection | null>;
  sources: Record<
    string,
    { retrieved_utc?: string; licence?: string; source?: string }
  >;
  documents: Record<string, string>;
  disclaimer: string;
}
export const colors: Record<Category, string> = {
  Low: "#48cfa2",
  Moderate: "#e2c36d",
  Elevated: "#f49758",
  High: "#ef7777",
};
export const emptyCollection: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
