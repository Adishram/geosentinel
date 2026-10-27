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
  seed?: number;
  use_live_data?: boolean;
}

export interface SavedScenario extends Scenario {
  snapshot_captured: boolean;
  rainfall_snapshot: number | null;
  observation_snapshot?: Observation;
  live_data_snapshot?: LiveEnvironment | null;
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
  live_data?: LiveEnvironment | null;
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
  expected_sightings_week: number;
  simulated_sightings: number;
  alert_level: "watch" | "alert" | "urgent" | null;
  advisory: string;
  alert_eligible: boolean;
  alert_suppression_reason: string | null;
  crop_source: string;
}

export interface SimulatedAlert {
  village: string;
  level: "watch" | "alert" | "urgent";
  score: number;
  title: string;
  body: string;
  issued: string;
  simulated: boolean;
}

export interface ScenarioResult {
  current: ResolvedScenario;
  baseline: ResolvedScenario | null;
  villages: VillageResult[];
  geofences: FeatureCollection;
  baseline_geofences: FeatureCollection | null;
  sightings: FeatureCollection<
    Point,
    {
      name: string;
      id: string;
      when: string;
      distance_m: number;
      simulated: boolean;
    }
  >;
  alerts: SimulatedAlert[];
  alert_threshold: number;
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
      season?: { enabled: boolean; profile: Record<string, number> };
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
  alerts?: {
    threshold: number;
    levels: Record<string, number>;
  };
  sightings?: {
    base_per_week: number;
    max_per_week: number;
    exponent: number;
    window_days: number;
    night_share: number;
  };
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

export interface LiveEnvironment {
  date: string;
  retrieved: string;
  errors: Record<string, string>;
  crop_observations?: Record<
    string,
    { date: string; attractiveness: number; crop: string; source: string }
  >;
  weather: null | {
    rainfall_30d_mm: number;
    mean_max_temperature_c: number | null;
    period: string;
  };
  satellite: null | {
    acquired: string;
    cloud_cover_pct: number;
    thumbnail: string | null;
    source_url: string;
    indices_error?: string;
    indices?: {
      forest_ndvi: number;
      visible_water_fraction: number;
      clear_coverage: number;
    };
  };
}
