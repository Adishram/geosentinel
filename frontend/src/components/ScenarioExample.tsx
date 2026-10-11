import example from "../lib/scenarioExample.json";

export default function ScenarioExample() {
  const { baseline, current } = example;
  return (
    <figure className="scenario-example">
      <div className="example-heading">
        <span>Masinagudi</span>
        <span>What-if comparison</span>
      </div>
      <div className="example-scores">
        <div>
          <span>Reference scenario</span>
          <strong>{baseline.score.toFixed(1)}</strong>
          <small>{baseline.category}</small>
        </div>
        <div>
          <span>Dry conditions</span>
          <strong>{current.score.toFixed(1)}</strong>
          <small>{current.category}</small>
        </div>
      </div>
      <div className="example-difference">
        <span>Change in illustrative score</span>
        <strong>
          +{(current.score - baseline.score).toFixed(1)} <small>points</small>
        </strong>
      </div>
      <div className="example-contributions">
        {Object.entries(current.contributions).map(([key, value]) => (
          <div key={key}>
            <span>
              {key === "dryness"
                ? "Dryness"
                : key === "forest_water_scarcity"
                  ? "Water scarcity"
                  : key === "crop_attractiveness"
                    ? "Crops"
                    : "Proximity"}
            </span>
            <div>
              <i
                style={{
                  width: `${baseline.contributions[key as keyof typeof baseline.contributions] * 2.5}%`,
                }}
              />
              <b style={{ width: `${value * 2.5}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="example-key">
        <span>
          <i /> Reference
        </span>
        <span>
          <b /> Dry conditions
        </span>
      </div>
      <figcaption>
        Static Python example · {example.date}. Hypothetical conditions; not a
        forecast. Scores out of 100.
      </figcaption>
    </figure>
  );
}
