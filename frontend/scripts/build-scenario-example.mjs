// Export a clearly labelled static product example from the unchanged local Python API.
import { writeFile } from 'node:fs/promises';
const boot = await (await fetch('http://127.0.0.1:8000/api/bootstrap')).json();
const scenario = { date: boot.date_range.max, mode: 'what-if', rain_override: true, rainfall_30d_mm: 120, vegetation_stress: .4, forest_water_availability: .6, crop_attractiveness: .4 };
const calculate = async current => {
  const response = await fetch('http://127.0.0.1:8000/api/scenario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({current, baseline: null}) });
  if (!response.ok) throw new Error(`Python example failed: ${response.status}`);
  return (await response.json()).villages.find(v => v.name === 'Masinagudi');
};
const preset = 'Dry conditions with reduced forest water';
const baseline = await calculate(scenario), current = await calculate({...scenario, ...boot.presets[preset]});
await writeFile('src/lib/scenarioExample.json', JSON.stringify({ date: scenario.date, preset, baseline, current }, null, 2));
console.log(`Python example: ${baseline.score.toFixed(1)} → ${current.score.toFixed(1)}`);
