// Builds public/geo/outlines-<res>.json: coastlines and country borders from Natural
// Earth (public domain, via world-atlas) for the route map. Each line is a flat list
// of delta-encoded [lon, lat] in hundredths of a degree, so the client decodes it with
// a running sum and no topology library.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { feature, mesh, neighbors } from "topojson-client";

const require = createRequire(import.meta.url);
const Q = 100;

function encode(lines) {
  return lines.map((line) => {
    const out = [];
    let px = 0;
    let py = 0;
    for (const [lon, lat] of line) {
      const x = Math.round(lon * Q);
      const y = Math.round(lat * Q);
      if (out.length && x === px && y === py) continue;
      out.push(x - px, y - py);
      px = x;
      py = y;
    }
    return out;
  }).filter((l) => l.length >= 4);
}

export function buildGeo(res = "50m") {
  const topo = JSON.parse(readFileSync(require.resolve(`world-atlas/countries-${res}.json`), "utf8"));
  const obj = topo.objects.countries;
  const coast = mesh(topo, obj, (a, b) => a === b).coordinates;
  const borders = mesh(topo, obj, (a, b) => a !== b).coordinates;
  mkdirSync("public/geo", { recursive: true });
  const file = `public/geo/outlines-${res}.json`;
  writeFileSync(file, JSON.stringify({ q: Q, coast: encode(coast), borders: encode(borders) }));
  return file;
}

/**
 * Builds public/geo/countries-<res>.json: each country's polygons (outer rings, delta-encoded
 * like the outlines), a fill tone 0-3 that differs from its neighbours' (greedy colouring, used
 * by the map's "no contours" style), its bounds, and a label point with the area of its largest
 * part (the label goes there, and small countries go unnamed until zoomed in).
 */
export function buildCountries(res = "50m") {
  const topo = JSON.parse(readFileSync(require.resolve(`world-atlas/countries-${res}.json`), "utf8"));
  const geoms = topo.objects.countries.geometries;
  const nb = neighbors(geoms);
  // DSatur: colour next the country whose neighbours already use the most tones, so four suffice
  const tone = geoms.map(() => null);
  for (let k = 0; k < geoms.length; k++) {
    let pick = -1;
    let best = [-1, -1];
    geoms.forEach((_, i) => {
      if (tone[i] != null) return;
      const sat = new Set(nb[i].map((j) => tone[j]).filter((t) => t != null)).size;
      if (sat > best[0] || (sat === best[0] && nb[i].length > best[1])) [pick, best] = [i, [sat, nb[i].length]];
    });
    const used = new Set(nb[pick].map((j) => tone[j]));
    let t = 0;
    while (used.has(t) && t < 3) t++;
    tone[pick] = t;
  }
  const out = feature(topo, topo.objects.countries).features.map((f, i) => {
    const polys = f.geometry ? (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) : [];
    const rings = polys.map((p) => p[0]);
    let best = null;
    let b = [180, 90, -180, -90];
    for (const r of rings) {
      let a = 0;
      let cx = 0;
      let cy = 0;
      for (let k = 0; k < r.length - 1; k++) {
        const [x1, y1] = r[k];
        const [x2, y2] = r[k + 1];
        const c = x1 * y2 - x2 * y1;
        a += c;
        cx += (x1 + x2) * c;
        cy += (y1 + y2) * c;
        b = [Math.min(b[0], x1), Math.min(b[1], y1), Math.max(b[2], x1), Math.max(b[3], y1)];
      }
      a /= 2;
      if (a && (!best || Math.abs(a) > best.a)) best = { a: Math.abs(a), pt: [cx / (6 * a), cy / (6 * a)] };
    }
    const r2 = (v) => Math.round(v * 100) / 100;
    return { n: f.properties.name, t: tone[i], b: b.map(r2), l: best ? best.pt.map(r2) : null, a: best ? r2(best.a) : 0, r: encode(rings) };
  }).filter((c) => c.r.length);
  const file = `public/geo/countries-${res}.json`;
  writeFileSync(file, JSON.stringify({ q: Q, countries: out }));
  return file;
}
