import { useReducedMotion } from "motion/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight } from "lucide-react";
import { colors, type Bootstrap, type ScenarioResult } from "../lib/types";

const tooltip = {
  backgroundColor: "var(--surface)",
  border: "1px solid var(--strong-line)",
  borderRadius: 5,
  color: "var(--text)",
  fontSize: 12,
};
const axis = { fill: "var(--muted)", fontSize: 11 };
export default function Analytics({
  result,
  boot,
  selected,
  focus,
  onFocus,
  loading,
}: {
  result: ScenarioResult | null;
  boot: Bootstrap;
  selected: string[];
  focus: string;
  onFocus: (name: string) => void;
  loading: boolean;
}) {
  const reduced = useReducedMotion();
  if (!result)
    return (
      <div className="empty-state">
        {loading
          ? "Calculating village scenarios in Python…"
          : "No scenario results available."}
      </div>
    );
  const villages = result.villages.filter((v) => selected.includes(v.name));
  if (!villages.length)
    return (
      <div className="empty-state">
        Choose villages in scenario controls to compare their computed outputs.
      </div>
    );
  const village = villages.find((v) => v.name === focus) ?? villages[0];
  const contributions = Object.entries(village.contributions).map(
    ([key, points]) => ({
      factor:
        key === "dryness"
          ? "Dryness"
          : key === "forest_water_scarcity"
            ? "Water scarcity"
            : key === "crop_attractiveness"
              ? "Crops"
              : "Proximity",
      current: points,
      baseline: result.baseline
        ? points - (village.contribution_deltas?.[key] ?? 0)
        : undefined,
    }),
  );
  const baseline = !!result.baseline;
  return (
    <div
      className={`analytics-content ${loading ? "stale" : ""}`}
      aria-busy={loading}
    >
      <div className="analytics-summary">
        <div>
          <span className="micro-label">SELECTED VILLAGES</span>
          <strong>{villages.length.toString().padStart(2, "0")}</strong>
        </div>
        <div>
          <span className="micro-label">MEAN ILLUSTRATIVE SCORE</span>
          <strong>
            {(
              villages.reduce((sum, v) => sum + v.score, 0) / villages.length
            ).toFixed(1)}
            <small>/ 100</small>
          </strong>
        </div>
        <div>
          <span className="micro-label">SAVED COMPARISON</span>
          <strong className="summary-date">
            {result.baseline?.scenario.date ?? "No baseline"}
          </strong>
        </div>
      </div>
      <div className="chart-header">
        <div>
          <span className="section-kicker">01 / ACROSS THE LANDSCAPE</span>
          <h2>Village scenario scores</h2>
          <p>
            Computed rule outputs, with saved baseline comparison when
            available.
          </p>
        </div>
        <span className="chart-unit">SCORE / 100</span>
      </div>
      <div
        className="chart-container"
        role="img"
        aria-label="Current and baseline illustrative scores by village. Exact values appear in the comparison table below."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={villages}
            layout="vertical"
            margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke="var(--line)" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={axis}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={axis}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={tooltip}
              cursor={{ fill: "#ffffff06" }}
              formatter={(value, name) => [
                `${Number(value).toFixed(1)} / 100`,
                name,
              ]}
            />
            {baseline && (
              <Bar
                dataKey="baseline_score"
                name="Saved baseline"
                fill="#51685d"
                radius={[0, 2, 2, 0]}
                maxBarSize={10}
                isAnimationActive={!reduced}
              />
            )}
            <Bar
              dataKey="score"
              name="Current scenario"
              fill="#b6d5aa"
              radius={[0, 2, 2, 0]}
              maxBarSize={12}
              isAnimationActive={!reduced}
              animationDuration={600}
            >
              {villages.map((v) => (
                <Cell key={v.name} fill={colors[v.category]} />
              ))}
              <LabelList
                dataKey="score"
                position="right"
                formatter={(value) => Number(value).toFixed(1)}
                fill="var(--muted)"
                fontSize={11}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-key">
        <span>Current · category colour</span>
        {Object.entries(colors).map(([name, color]) => (
          <span key={name}>
            <i style={{ background: color }} />
            {name}
          </span>
        ))}
        {baseline && (
          <span>
            <i className="baseline-key" />
            Saved baseline
          </span>
        )}
      </div>
      <div className="analytics-two">
        <section>
          <div className="chart-header">
            <div>
              <span className="section-kicker">02 / THE EXPLANATION</span>
              <h2>Factor contributions</h2>
            </div>
            <select
              aria-label="Village for contribution analysis"
              value={village.name}
              onChange={(e) => onFocus(e.target.value)}
            >
              {villages.map((v) => (
                <option key={v.name}>{v.name}</option>
              ))}
            </select>
          </div>
          <div
            className="small-chart"
            role="img"
            aria-label={`Factor contributions in points for ${village.name}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={contributions}
                layout="vertical"
                margin={{ left: 5, right: 15 }}
              >
                <CartesianGrid stroke="var(--line)" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, "auto"]}
                  tick={axis}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="factor"
                  type="category"
                  width={80}
                  tick={axis}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltip}
                  cursor={{ fill: "#ffffff06" }}
                  formatter={(value, name) => [
                    `${Number(value).toFixed(2)} points`,
                    name,
                  ]}
                />
                {baseline && (
                  <Bar
                    dataKey="baseline"
                    name="Saved baseline"
                    fill="#51685d"
                    barSize={8}
                    radius={[0, 3, 3, 0]}
                    isAnimationActive={!reduced}
                  />
                )}
                <Bar
                  dataKey="current"
                  name="Current contribution"
                  fill="var(--accent)"
                  barSize={8}
                  radius={[0, 3, 3, 0]}
                  isAnimationActive={!reduced}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="metric-note">
            Points sum to the score, subject to rounding. Missing factors are
            excluded; available weights are re-normalised.
          </p>
        </section>
        <section>
          <div className="chart-header">
            <div>
              <span className="section-kicker">03 / GEOGRAPHIC EXPOSURE</span>
              <h2>Geofence buffers</h2>
            </div>
            <span className="chart-unit">METRES</span>
          </div>
          <div
            className="small-chart"
            role="img"
            aria-label="Current and baseline buffer distances in metres by village"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={villages}
                layout="vertical"
                margin={{ left: 0, right: 10 }}
              >
                <CartesianGrid stroke="var(--line)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={axis}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={95}
                  tick={axis}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltip}
                  cursor={{ fill: "#ffffff06" }}
                  formatter={(value, name) => [
                    `${Math.round(Number(value)).toLocaleString()} m`,
                    name,
                  ]}
                />
                {baseline && (
                  <Bar
                    dataKey="baseline_buffer_m"
                    name="Baseline buffer"
                    fill="#51685d"
                    isAnimationActive={!reduced}
                    radius={[0, 2, 2, 0]}
                    maxBarSize={8}
                  />
                )}
                <Bar
                  dataKey="buffer_m"
                  name="Current buffer"
                  fill="var(--accent)"
                  isAnimationActive={!reduced}
                  radius={[0, 2, 2, 0]}
                  maxBarSize={10}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="metric-note">
            Outward buffer from the approximate settlement footprint. An
            illustrative rule, not a measured animal travel distance.
          </p>
        </section>
      </div>
      <div className="chart-header">
        <div>
          <span className="section-kicker">04 / THE EXACT OUTPUTS</span>
          <h2>Scenario comparison</h2>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">
            Exact Python scenario results for the selected villages
          </caption>
          <thead>
            <tr>
              <th>Village</th>
              <th>Baseline</th>
              <th>Current</th>
              <th>Δ points</th>
              <th>Category</th>
              <th>Buffer</th>
              <th>Area</th>
              <th>Missing factors</th>
            </tr>
          </thead>
          <tbody>
            {villages.map((v) => (
              <tr
                key={v.name}
                className={focus === v.name ? "selected-row" : ""}
              >
                <th>
                  <button onClick={() => onFocus(v.name)}>
                    {v.name}
                    <ArrowUpRight size={12} />
                  </button>
                </th>
                <td>{v.baseline_score?.toFixed(1) ?? "—"}</td>
                <td>{v.score.toFixed(1)}</td>
                <td>
                  {v.delta === null
                    ? "—"
                    : `${v.delta > 0 ? "+" : ""}${v.delta.toFixed(1)}`}
                </td>
                <td style={{ color: colors[v.category] }}>{v.category}</td>
                <td>{Math.round(v.buffer_m)} m</td>
                <td>{v.area_km2.toFixed(2)} km²</td>
                <td>
                  {v.missing.map((key) => boot.labels[key]).join(", ") ||
                    "None"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="analytics-disclaimer">
        These are comparisons across current assumptions, not historical risk
        trends. Rainfall, vegetation, water, and crops are shared scenario
        inputs; geography differs by village.
      </p>
    </div>
  );
}
