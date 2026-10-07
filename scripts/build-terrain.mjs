// Builds data/terrain/<lon>_<lat>.json: height bands (land) and depth bands (sea) for the route
// map's Elevation style, as small vector polygons in 30° × 30° tiles, so a map only fetches the
// tiles around its route. Run by hand (needs network, a few minutes); the output is committed and
// copied into public/geo/terrain by copy-assets.mjs:
//   node scripts/build-terrain.mjs
// Elevation: AWS Terrain Tiles (Terrarium encoding, open data; sources include SRTM, GMTED2010 and
// ETOPO1). The method and levels follow ofp-planner's scripts/build-terrain.mjs, made worldwide.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { contours } from "d3-contour";
import { geoIdentity, geoPath } from "d3-geo";
import { PNG } from "pngjs";

const BOX = { w: -180, e: 180, s: -80, n: 84 };
const STEP = 0.1; // grid spacing in degrees (~11 km)
const TILE = 30; // output tile size in degrees
const LAND_LEVELS = [200, 500, 1000, 1500, 2000, 3000];
const SEA_LEVELS = [200, 1000, 2000, 4000]; // depths
const Z = 5;
const N = 1 << Z;
const Q = 100; // coordinates stored in hundredths of a degree
const OUT = "data/terrain";

/* ---------- elevation from Terrarium tiles ---------- */

const tx = (lon) => ((lon + 180) / 360) * N;
const ty = (lat) => ((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2) * N;
const y0 = Math.floor(ty(BOX.n));
const y1 = Math.floor(ty(BOX.s + 1e-9));
const MW = N * 256;
const MH = (y1 - y0 + 1) * 256;
const mosaic = new Float32Array(MW * MH);

async function tile(x, y) {
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const png = PNG.sync.read(Buffer.from(await r.arrayBuffer()));
      for (let j = 0; j < 256; j++)
        for (let i = 0; i < 256; i++) {
          const k = (j * 256 + i) * 4;
          mosaic[((y - y0) * 256 + j) * MW + x * 256 + i] = png.data[k] * 256 + png.data[k + 1] + png.data[k + 2] / 256 - 32768;
        }
      return;
    } catch (e) {
      if (attempt === 3) throw new Error(`${url}: ${e.message}`);
      await new Promise((ok) => setTimeout(ok, 1000 * (attempt + 1)));
    }
  }
}

const jobs = [];
for (let x = 0; x < N; x++) for (let y = y0; y <= y1; y++) jobs.push([x, y]);
console.log(`fetching ${jobs.length} elevation tiles (z${Z})…`);
for (let i = 0; i < jobs.length; i += 8) {
  await Promise.all(jobs.slice(i, i + 8).map(([x, y]) => tile(x, y)));
  if (i % 128 === 0) console.log(`  ${i}/${jobs.length}`);
}

function elev(lon, lat) {
  const fx = Math.min(tx(lon) * 256, MW - 1.001);
  const fy = (ty(lat) - y0) * 256;
  const ix = Math.max(0, Math.min(MW - 2, Math.floor(fx)));
  const iy = Math.max(0, Math.min(MH - 2, Math.floor(fy)));
  const ax = fx - ix;
  const ay = fy - iy;
  const i = iy * MW + ix;
  return (mosaic[i] * (1 - ax) + mosaic[i + 1] * ax) * (1 - ay) + (mosaic[i + MW] * (1 - ax) + mosaic[i + MW + 1] * ax) * ay;
}

/* ---------- regular lon/lat grid → contour bands ---------- */

const GW = Math.round((BOX.e - BOX.w) / STEP) + 1;
const GH = Math.round((BOX.n - BOX.s) / STEP) + 1;
const grid = new Float64Array(GW * GH);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) grid[j * GW + i] = elev(BOX.w + i * STEP, BOX.n - j * STEP);
console.log(`grid ${GW}×${GH}`);

// light smoothing so 0.1° steps don't show as stair-steps in the contours
function smooth(a) {
  const out = new Float64Array(a.length);
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      let s = 0;
      let n = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const jj = j + dj;
          const ii = i + di;
          if (jj >= 0 && jj < GH && ii >= 0 && ii < GW) {
            s += a[jj * GW + ii];
            n++;
          }
        }
      out[j * GW + i] = s / n;
    }
  return out;
}

const toLonLat = ([i, j]) => [BOX.w + i * STEP, BOX.n - j * STEP];

// Douglas–Peucker on a ring (degrees)
function simplify(pts, tol) {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0;
    let idx = -1;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    for (let k = a + 1; k < b; k++) {
      const d = len < 1e-9 ? Math.hypot(pts[k][0] - ax, pts[k][1] - ay) : Math.abs(dy * pts[k][0] - dx * pts[k][1] + bx * ay - by * ax) / len;
      if (d > max) {
        max = d;
        idx = k;
      }
    }
    if (max > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

/** Each contour ring (lon/lat), simplified; every ring is drawn on its own with the even-odd rule. */
const bandRings = (values, levels) =>
  contours()
    .size([GW, GH])
    .thresholds(levels)(Array.from(values))
    .map((c) => ({ v: c.value, rings: c.coordinates.flatMap((poly) => poly.map((ring) => simplify(ring.map(toLonLat), 0.04)).filter((r) => r.length >= 4)) }));

console.log("contouring…");
const heights = bandRings(smooth(grid), LAND_LEVELS);
const depths = bandRings(smooth(grid.map((v) => -v)), SEA_LEVELS);

/* ---------- cut into tiles ---------- */

/** A ring clipped to a box (planar, on lon/lat), as delta-encoded rings in hundredths of a degree. */
function clipRing(ring, w, s, e, n) {
  let xa = Infinity;
  let xb = -Infinity;
  let ya = Infinity;
  let yb = -Infinity;
  for (const [x, y] of ring) {
    if (x < xa) xa = x;
    if (x > xb) xb = x;
    if (y < ya) ya = y;
    if (y > yb) yb = y;
  }
  if (xb < w || xa > e || yb < s || ya > n) return [];
  const inside = xa >= w && xb <= e && ya >= s && yb <= n;
  let parts = [ring];
  if (!inside) {
    parts = [];
    let cur = null;
    const ctx = {
      moveTo(x, y) {
        cur = [[x, -y]];
      },
      lineTo(x, y) {
        cur.push([x, -y]);
      },
      closePath() {
        if (cur && cur.length > 3) parts.push(cur);
        cur = null;
      },
      arc() {},
      rect() {},
    };
    const ident = geoIdentity()
      .reflectY(true)
      .clipExtent([
        [w, -n],
        [e, -s],
      ]);
    geoPath(ident, ctx)({ type: "Polygon", coordinates: [ring] });
  }
  return parts.map((p) => {
    const flat = [];
    let px = 0;
    let py = 0;
    for (const [lon, lat] of p) {
      const x = Math.round(lon * Q);
      const y = Math.round(lat * Q);
      if (flat.length && x === px && y === py) continue;
      flat.push(x - px, y - py);
      px = x;
      py = y;
    }
    return flat;
  });
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let total = 0;
let files = 0;
for (let w = -180; w < 180; w += TILE)
  for (let s = -90; s < 90; s += TILE) {
    const cut = (bands) => bands.map((b) => ({ v: b.v, p: b.rings.flatMap((r) => clipRing(r, w, s, w + TILE, s + TILE)).filter((f) => f.length >= 6) }));
    const h = cut(heights);
    const d = cut(depths);
    if (!h.some((b) => b.p.length) && !d.some((b) => b.p.length)) continue;
    const json = JSON.stringify({ q: Q, h, d });
    writeFileSync(`${OUT}/${w}_${s}.json`, json);
    total += json.length;
    files++;
  }
writeFileSync(`${OUT}/index.json`, JSON.stringify({ tile: TILE, landLevels: LAND_LEVELS, seaLevels: SEA_LEVELS }));
console.log(`${OUT}: ${files} tiles, ${(total / 1024 / 1024).toFixed(1)} MB in all`);
