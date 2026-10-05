"use client";

import { useEffect, useState } from "react";
import { hhmmToMin } from "./format";
import type { FuelRow, LogPoint, OFP, WxAirport } from "./types";

/**
 * Fuel en-route alternate (fuel ERA): an airport along the route that the plan nominates for its
 * contingency fuel. LIDO plans list it in the Airport WX List as "Fuel Enroute Airport", in the
 * NOTAMs as "FUEL ENROUTE AIRPORT - DETAILED INFO", and against the CONT line of the fuel table
 * (e.g. "CONT 15 MIN  OST  522").
 */
export interface FuelEra {
  icao: string;
  iata: string | null;
  name: string;
  wx: WxAirport;
  /** The contingency fuel line that names this airport, if any. */
  cont: FuelRow | null;
}

export function fuelEra(ofp: OFP | null | undefined): FuelEra | null {
  const wx = ofp?.wx.airports.find((a) => /en\s*-?\s*route/i.test(a.role));
  if (!ofp || !wx) return null;
  const cont = ofp.fuel.rows.find((r) => /^CONT/.test(r.label) && !!r.arpt && (r.arpt === wx.iata || r.arpt === wx.icao)) ?? null;
  return { icao: wx.icao, iata: wx.iata, name: wx.name, wx, cont };
}

/** Is this Airport WX List role the fuel en-route alternate? */
export const isEraRole = (role: string) => /en\s*-?\s*route/i.test(role);

/* ---------- airport coordinates (OurAirports, large and medium airports; loaded only when needed) ---------- */

let table: Promise<Record<string, [number, number]>> | null = null;

export function airportCoord(icao: string): Promise<[number, number] | null> {
  table ??= fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/geo/airports.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return table.then((m) => m[icao] ?? null);
}

/** The airport's [lat, lon], or null until loaded (or if it isn't in the table). */
export function useAirportCoord(icao: string | null | undefined): [number, number] | null {
  const [got, setGot] = useState<{ icao: string; c: [number, number] | null } | null>(null);
  useEffect(() => {
    if (!icao) return;
    let live = true;
    void airportCoord(icao).then((c) => live && setGot({ icao, c }));
    return () => {
      live = false;
    };
  }, [icao]);
  return got && got.icao === icao ? got.c : null;
}

/* ---------- where the route passes closest ---------- */

export interface Abeam {
  /** Shortest distance from the route to the airport, NM. */
  nm: number;
  /** The route fix nearest that closest point. */
  fix: string;
  /** Minutes after take-off at the closest point (interpolated from the nav log's TTLT). */
  min: number | null;
  /** The closest point on the route, [lat, lon]. */
  point: [number, number];
}

const fixName = (p: LogPoint) => p.ident ?? p.position ?? "?";

/** Closest approach of the route (nav-log fixes with coordinates) to `c`. */
export function abeamOf(log: LogPoint[], c: [number, number]): Abeam | null {
  const pts = log.filter((p) => p.kind === "wpt" && p.latDeg != null && p.lonDeg != null);
  if (pts.length < 2) return null;
  const [lat0, lon0] = c;
  const k = Math.cos((lat0 * Math.PI) / 180);
  // local flat projection around the airport, in NM (fine over a few hundred NM)
  const xy = (p: LogPoint) => [(p.lonDeg! - lon0) * k * 60, (p.latDeg! - lat0) * 60] as const;
  let best: Abeam | null = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = xy(pts[i]);
    const [bx, by] = xy(pts[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const nm = Math.hypot(ax + t * dx, ay + t * dy);
    if (best && nm >= best.nm) continue;
    const ma = hhmmToMin(pts[i].ttlt);
    const mb = hhmmToMin(pts[i + 1].ttlt);
    best = {
      nm,
      fix: fixName(t < 0.5 ? pts[i] : pts[i + 1]),
      min: ma != null && mb != null ? Math.round(ma + t * (mb - ma)) : null,
      point: [pts[i].latDeg! + t * (pts[i + 1].latDeg! - pts[i].latDeg!), pts[i].lonDeg! + t * (pts[i + 1].lonDeg! - pts[i].lonDeg!)],
    };
  }
  return best;
}

/** The clock time (and TAF day/time) `min` minutes after the planned take-off. */
export function afterOff(ofp: OFP, min: number | null): { clock: string; at: { day: number; hour: number; min: number } } | null {
  const off = hhmmToMin(ofp.header.offTime);
  const day = Number(ofp.header.flightDate?.slice(0, 2)) || null;
  if (off == null || min == null || !day) return null;
  const t = off + min;
  const m = t % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return { clock: `${hh}${mm}Z`, at: { day: day + (t >= 1440 ? 1 : 0), hour: Math.floor(m / 60), min: m % 60 } };
}

/** Plain-English explanation used wherever the fuel ERA appears. */
export const ERA_TIP =
  "Fuel en-route alternate (fuel ERA): an airport along the route that the plan nominates for its contingency fuel. Some contingency-fuel policies (such as a reduced percentage of trip fuel) are only allowed when one is available; it's also a place you could divert to en route.";
