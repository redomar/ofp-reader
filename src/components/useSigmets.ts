"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useField, useFieldGroup, useOfp } from "./context";
import { hhmmToMin } from "@/lib/ofp/format";
import { parseSigmets, routeImpact, type Impact, type RoutePoint, type Sigmet } from "@/lib/wx/sigmet";

export interface SigmetOnRoute {
  s: Sigmet;
  impact: Impact;
}

/**
 * The plan's SIGMETs and AIRMETs with their impact on the route: where the route is
 * inside each area, at what levels, and whether the flight is there while it's valid.
 * Take-off time: the nav log's Actual OFF, else Times & weights' Actual OFF, else planned.
 */
export function useSigmets(): { list: SigmetOnRoute[]; offLabel: string | null } {
  const { ofp } = useOfp();
  const [logOff] = useField("log.off", "Flight log", "Actual take-off (OFF, UTC)");
  const times = useFieldGroup("times.actual", "Times & weights");
  const tOff = times.get("OFF");
  return useMemo(() => {
    if (!ofp) return { list: [], offLabel: null };
    const off = /^\d{4}$/.test(logOff) ? logOff : /^\d{4}$/.test(tOff) ? tOff : ofp.header.offTime;
    const day = Number(ofp.header.flightDate?.slice(0, 2)) || new Date().getUTCDate();
    const offAbs = off ? hhmmToMin(off) : null;
    // Route: positions with level, minutes after take-off and distance; FIR crossings carry the FIR name.
    let cum = 0;
    let lastAlt = 0;
    let fir: string | null = null;
    const route: RoutePoint[] = [];
    ofp.log.forEach((p, i) => {
      cum += Number(p.dis ?? 0) || 0;
      if (p.kind === "fir") fir = p.firName ?? p.position ?? null;
      const alt = i === 0 || i === ofp.log.length - 1 ? 0 : p.fl ? Number(p.fl) * 100 : lastAlt;
      lastAlt = alt;
      if (p.latDeg == null || p.lonDeg == null) return;
      route.push({ name: p.ident ?? p.position ?? "—", lat: p.latDeg, lon: p.lonDeg, alt, ttlt: hhmmToMin(p.ttlt) ?? 0, cum, fir: p.kind === "fir" ? fir : undefined });
    });
    const list = ofp.wx.advisories
      .filter((a) => /SIGMET|AIRMET/i.test(a.title))
      .flatMap((a) => parseSigmets(a.lines))
      .map((s) => ({ s, impact: routeImpact(s, route, offAbs, day) }));
    return { list, offLabel: off ? `${off.slice(0, 2)}:${off.slice(2)}Z` : null };
  }, [ofp, logOff, tOff]);
}

/* ---------- which SIGMET is highlighted (card ↔ map ↔ profile) ---------- */

let highlighted: string | null = null;
const subs = new Set<() => void>();
export function setHighlightedSigmet(id: string | null) {
  if (highlighted === id) return;
  highlighted = id;
  subs.forEach((f) => f());
}
export function useHighlightedSigmet() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => highlighted,
    () => null,
  );
}
