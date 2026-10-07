"use client";

import { useEffect, useState } from "react";

/**
 * Height bands (land) and depth bands (sea) for the route map's Elevation style, built by
 * scripts/build-terrain.mjs into 30° × 30° tiles (public/geo/terrain/<lon>_<lat>.json). Only the
 * tiles a map's view covers are fetched, once each.
 *
 * Every ring is drawn on its own with the even-odd rule, so holes (valleys inside a band, islands
 * in a depth band) show through without relying on winding.
 */
export interface Band {
  /** Metres above sea level (heights) or below it (depths). */
  v: number;
  /** Each ring as [lon0, lat0, lon1, lat1, …] in degrees. */
  rings: Float32Array[];
}
export interface Terrain {
  heights: Band[];
  depths: Band[];
}

/** The levels the bands start at, for the map key. */
export const LAND_LEVELS = [200, 500, 1000, 1500, 2000, 3000];
export const SEA_LEVELS = [200, 1000, 2000, 4000];

const TILE = 30;
type Raw = { q: number; h: { v: number; p: number[][] }[]; d: { v: number; p: number[][] }[] };
const tiles = new Map<string, Promise<Terrain | null>>();

function decode(p: number[][], q: number): Float32Array[] {
  return p.map((d) => {
    const out = new Float32Array(d.length);
    let x = 0;
    let y = 0;
    for (let i = 0; i < d.length; i += 2) {
      x += d[i];
      y += d[i + 1];
      out[i] = x / q;
      out[i + 1] = y / q;
    }
    return out;
  });
}

function tile(key: string): Promise<Terrain | null> {
  let t = tiles.get(key);
  if (!t) {
    t = fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/geo/terrain/${key}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Raw>) : null))
      .then((j) =>
        j
          ? {
              heights: j.h.map((b) => ({ v: b.v, rings: decode(b.p, j.q) })),
              depths: j.d.map((b) => ({ v: b.v, rings: decode(b.p, j.q) })),
            }
          : null,
      )
      .catch(() => null);
    tiles.set(key, t);
  }
  return t;
}

/** The tile keys covering [lon0, lat0, lon1, lat1]. */
export function tileKeys(lon0: number, lat0: number, lon1: number, lat1: number): string[] {
  const keys: string[] = [];
  const snap = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(v / TILE) * TILE));
  for (let w = snap(lon0, -180, 150); w <= snap(lon1, -180, 150); w += TILE)
    for (let s = snap(lat0, -90, 60); s <= snap(lat1, -90, 60); s += TILE) keys.push(`${w}_${s}`);
  return keys;
}

/** Bands for the given tiles (null while off or loading); keeps the last set while new tiles load. */
export function useTerrain(keys: string[] | null): Terrain | null {
  const id = keys?.join(",") ?? "";
  const [got, setGot] = useState<{ id: string; t: Terrain } | null>(null);
  useEffect(() => {
    if (!id) return;
    let live = true;
    void Promise.all(id.split(",").map(tile)).then((parts) => {
      if (!live) return;
      const merge = (pick: (t: Terrain) => Band[]) => {
        const by = new Map<number, Float32Array[]>();
        for (const p of parts) if (p) for (const b of pick(p)) by.set(b.v, [...(by.get(b.v) ?? []), ...b.rings]);
        return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([v, rings]) => ({ v, rings }));
      };
      setGot({ id, t: { heights: merge((t) => t.heights), depths: merge((t) => t.depths) } });
    });
    return () => {
      live = false;
    };
  }, [id]);
  return id && got ? got.t : null;
}

/** A band's rings as one SVG path in degrees (x = lon, y = −lat), to be placed with a transform. */
export function bandPath(rings: Float32Array[]): string {
  let d = "";
  for (const r of rings) {
    for (let i = 0; i < r.length; i += 2) d += `${i ? "L" : "M"}${r[i].toFixed(2)} ${(-r[i + 1]).toFixed(2)}`;
    d += "Z";
  }
  return d;
}
