// Presentation-only SVG from existing OSM cache. No scoring or geographic computations are changed.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const load = async name => JSON.parse(await readFile(`../data/cache/${name}.geojson`, 'utf8'));
const project = ([lon, lat]) => [(lon - 76.43) * 2800, (11.685 - lat) * 2857];
const line = coordinates => coordinates.map((point, i) => `${i ? 'L' : 'M'}${project(point).map(x => x.toFixed(1)).join(',')}`).join('');
const path = geometry => {
  if (geometry.type === 'Polygon') return geometry.coordinates.map(r => line(r) + 'Z').join('');
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map(p => p.map(r => line(r) + 'Z').join('')).join('');
  if (geometry.type === 'LineString') return line(geometry.coordinates);
  if (geometry.type === 'MultiLineString') return geometry.coordinates.map(line).join('');
  return '';
};
const paths = (collection, filter = () => true) => collection.features.filter(filter).map(f => `<path d="${path(f.geometry)}"/>`).join('');
const reserve = await load('reserve'), roads = await load('roads'), water = await load('water'), villages = await load('villages');
const offsets = { Masinagudi: [14, 4], Thepakkadu: [12, -15], Kargudi: [-14, 20], Thorapalli: [-14, 24], Mavanalla: [12, -8], Vazhaithottam: [12, 24] };
const seen = new Set();
const points = villages.features.filter(f => {
  const name = f.properties.name;
  if (!(name in offsets) || seen.has(name)) return false;
  seen.add(name); return true;
}).map(f => {
  const [x,y] = project(f.geometry.coordinates), [dx,dy] = offsets[f.properties.name];
  return `<g><circle cx="${x}" cy="${y}" r="4" fill="#d1dbbc"/><circle cx="${x}" cy="${y}" r="9" fill="none" stroke="#d1dbbc" stroke-opacity=".25"/><text x="${x+dx}" y="${y+dy}" text-anchor="${dx < 0 ? 'end' : 'start'}">${f.properties.name}</text></g>`;
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600"><title>Mudumalai study geography</title><desc>Cached OpenStreetMap reserve boundary, roads, water and six configured village locations. No elevation or animal detections.</desc><defs><clipPath id="frame"><rect width="900" height="600"/></clipPath></defs><g clip-path="url(#frame)"><g fill="none" stroke="#25332e" stroke-width=".7">${[100,300,500].map(y=>`<path d="M0 ${y}H900"/>`).join('')}${[100,300,500,700].map(x=>`<path d="M${x} 0V600"/>`).join('')}</g><g fill="#20382d" fill-rule="evenodd" stroke="#88a080" stroke-opacity=".6" stroke-width="1.4">${paths(reserve)}</g><g fill="none" stroke="#7b8570" stroke-opacity=".36" stroke-width=".7">${paths(roads, f => ['primary','secondary','tertiary','trunk'].includes(f.properties.highway))}</g><g fill="none" stroke="#6d9c9a" stroke-opacity=".6" stroke-width="1">${paths(water)}</g><g font-family="Inter,Arial,sans-serif" font-size="14" fill="#d7ddd0">${points}</g><text x="205" y="165" font-family="Inter,Arial,sans-serif" font-size="17" letter-spacing="3" fill="#829c82">MUDUMALAI</text><text x="205" y="188" font-family="Inter,Arial,sans-serif" font-size="11" letter-spacing="2" fill="#829c82">RESERVE BOUNDARY · OSM</text></g></svg>`;
await mkdir('public', { recursive: true });
await writeFile('public/mudumalai-study.svg', svg);
console.log(`Wrote cached geographic illustration (${Math.round(svg.length/1024)} kB).`);
