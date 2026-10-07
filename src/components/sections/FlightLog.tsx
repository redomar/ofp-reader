"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useField, useFieldGroup, useOfp } from "../context";
import { useEra } from "../EraLine";
import { Replay } from "../replay";
import { Act, ActQuick, Badge, ClockIcon, Section, Sub, Tip, V, cx, useUtcNow } from "../ui";
import { G } from "@/lib/ofp/glossary";
import { clockDiff, fmtHhmm, hhmmToMin, pageOf, parseTemp, signed } from "@/lib/ofp/format";
import type { LogPoint } from "@/lib/ofp/types";
import { picExtraModel, type PicExtraModel } from "@/lib/ofp/picExtra";
import { outlinePath, ringsPath, useOutlines } from "@/lib/outlines";
import { useFirMode, useMapStyle } from "@/lib/mapPref";
import { setHighlightedSigmet, useHighlightedSigmet, useSigmets, type SigmetOnRoute } from "../useSigmets";
import type { Area } from "@/lib/wx/sigmet";

interface P extends LogPoint {
  i: number;
  cum: number;
  alt: number; // FL (hundreds of ft)
  name: string;
}

const W = 1000;

function prep(log: LogPoint[]): P[] {
  let cum = 0;
  const pts: P[] = log.map((p, i) => {
    cum += Number(p.dis ?? 0) || 0;
    const name = p.kind === "fir" ? (p.position ?? "FIR") : (p.ident ?? p.position?.replace(/\s/g, "") ?? "—");
    return { ...p, i, cum, alt: p.fl ? Number(p.fl) : NaN, name };
  });
  // Departure & destination sit on the ground; FIR crossings take the neighbour level.
  if (pts.length) {
    pts[0].alt = 0;
    pts[pts.length - 1].alt = 0;
  }
  for (const p of pts) {
    if (Number.isNaN(p.alt)) {
      const prev = [...pts.slice(0, p.i)].reverse().find((q) => !Number.isNaN(q.alt));
      p.alt = prev?.alt ?? 0;
    }
  }
  return pts;
}

function Profile({
  pts,
  active,
  setActive,
  minFuel,
  onKey,
  pic,
  sigs = [],
}: {
  pts: P[];
  active: number | null;
  setActive: (i: number | null) => void;
  minFuel: number | null;
  onKey: (e: KeyboardEvent) => void;
  pic: PicExtraModel | null;
  /** SIGMETs the route passes through, drawn as level bands over that stretch. */
  sigs?: SigmetOnRoute[];
}) {
  const hlSig = useHighlightedSigmet();
  const H = 280;
  const m = { l: 46, r: 46, t: 16, b: 30 };
  const total = pts.at(-1)?.cum || 1;
  const maxAlt = Math.max(100, ...pts.map((p) => p.alt), ...pts.map((p) => Number(p.mora ?? 0)));
  const yMax = Math.ceil((maxAlt + 30) / 50) * 50;
  const fuels = pts.flatMap((p) => [Number(p.efob), pic?.tfob(p.efob, p.pbrn) ?? NaN]).filter((n) => !Number.isNaN(n));
  const fMax = Math.ceil(Math.max(1, ...fuels));
  const x = (d: number) => m.l + (d / total) * (W - m.l - m.r);
  const y = (fl: number) => H - m.b - (fl / yMax) * (H - m.t - m.b);
  const yf = (t: number) => H - m.b - (t / fMax) * (H - m.t - m.b);
  const wpts = pts.filter((p) => p.kind === "wpt");
  const line = wpts.map((p, k) => `${k ? "L" : "M"}${x(p.cum).toFixed(1)} ${y(p.alt).toFixed(1)}`).join(" ");
  // Terrain: MORA applies to the leg ending at each point.
  let terr = `M${x(0)} ${y(0)}`;
  wpts.forEach((p, k) => {
    if (!k) return;
    const mora = Number(p.mora ?? 0);
    terr += ` L${x(wpts[k - 1].cum)} ${y(mora)} L${x(p.cum)} ${y(mora)}`;
  });
  terr += ` L${x(total)} ${y(0)} Z`;
  const fuelLine = wpts
    .filter((p) => p.efob)
    .map((p, k) => `${k ? "L" : "M"}${x(p.cum).toFixed(1)} ${yf(Number(p.efob)).toFixed(1)}`)
    .join(" ");
  const picLine = pic
    ? wpts
        .filter((p) => p.efob)
        .map((p, k) => `${k ? "L" : "M"}${x(p.cum).toFixed(1)} ${yf(pic.tfob(p.efob, p.pbrn)!).toFixed(1)}`)
        .join(" ")
    : null;
  const ticks = Array.from({ length: yMax / 50 + 1 }, (_, k) => k * 50);
  const a = active != null ? pts[active] : null;
  const boxW = pic ? 250 : 206;

  const move = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    let bd = Infinity;
    pts.forEach((p, k) => {
      const d = Math.abs(x(p.cum) - px);
      if (d < bd && p.kind === "wpt") {
        bd = d;
        best = k;
      }
    });
    setActive(best);
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="chart"
      onPointerMove={move}
      onPointerLeave={() => setActive(null)}
      tabIndex={0}
      role="group"
      aria-label="Vertical profile: flight level and terrain (MORA) against distance, with fuel on board. Use left and right arrow keys to step through waypoints."
      onKeyDown={onKey}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="gridline" />
          <text x={m.l - 6} y={y(t) + 4} textAnchor="end">
            {t === 0 ? "GND" : `FL${t}`}
          </text>
        </g>
      ))}
      {Array.from({ length: fMax + 1 }, (_, t) => (
        <text key={t} x={W - m.r + 6} y={yf(t) + 4} style={{ fill: "var(--blue)" }}>
          {t}t
        </text>
      ))}
      {sigs
        .filter((x) => x.impact.lateral && x.impact.from && x.impact.to && x.s.levels)
        .map(({ s, impact }) => {
          const x0 = x(impact.from!.cum);
          const x1 = Math.max(x0 + 4, x(impact.to!.cum));
          const top = Math.min(yMax, (s.levels!.top ?? yMax * 100) / 100);
          const base = s.levels!.base / 100;
          return (
            <g
              key={s.id}
              className={cx("sig-band", s.phenomenon?.severity === "mod" || s.kind === "AIRMET" ? "mod" : "sev", hlSig === s.id && "hl")}
              onPointerEnter={() => setHighlightedSigmet(s.id)}
              onPointerLeave={() => setHighlightedSigmet(null)}
              data-tip={`${s.phenomenon?.text ?? "Hazard"} · ${s.levels!.text} · valid ${s.validFrom ? `${String(s.validFrom.hour).padStart(2, "0")}${String(s.validFrom.min).padStart(2, "0")}` : "?"}–${s.validTo ? `${String(s.validTo.hour).padStart(2, "0")}${String(s.validTo.min).padStart(2, "0")}` : "?"}Z`}
              data-tip-title={`${s.kind} ${s.seq} · ${s.fir ?? ""}`}
            >
              <rect x={x0} y={y(top)} width={x1 - x0} height={Math.max(2, y(base) - y(top))} />
              <text x={x0 + 4} y={y(top) + 12}>
                {s.kind} {s.seq}
              </text>
            </g>
          );
        })}
      <path d={terr} className="terrain a-grow-y" />
      {minFuel != null && (
        <g>
          <line x1={m.l} x2={W - m.r} y1={yf(minFuel)} y2={yf(minFuel)} stroke="var(--red)" strokeDasharray="6 4" />
          <text x={W - m.r - 4} y={yf(minFuel) - 5} textAnchor="end" style={{ fill: "var(--red)" }}>
            ALTN+FINRES {minFuel.toFixed(1)}t
          </text>
        </g>
      )}
      {pts
        .filter((p) => p.kind === "fir")
        .map((p) => (
          <g key={"f" + p.i}>
            <line x1={x(p.cum)} x2={x(p.cum)} y1={m.t} y2={H - m.b} className="fir-line" />
            <text x={x(p.cum) + 3} y={m.t + 10} style={{ fontSize: 10 }}>
              {p.name}
            </text>
          </g>
        ))}
      <path d={fuelLine} className="fuel a-draw" pathLength={1} />
      {picLine && <path d={picLine} className="fuel-pic a-fade" />}
      <path d={line} className="route a-draw" pathLength={1} />
      {wpts.map((p, wi) => {
        const isTc = /T O [CD]/.test(p.position ?? "");
        return (
          <g key={p.i} className="a-fade" style={{ ["--i" as string]: wi }}>
            <circle cx={x(p.cum)} cy={y(p.alt)} r={active === p.i ? 6 : isTc ? 4.5 : 3} className={cx("wpt", active === p.i && "active")} />
            {isTc && (
              <text x={x(p.cum)} y={y(p.alt) - 10} textAnchor="middle" className="label-mag">
                {p.position?.replace(/\s/g, "")}
              </text>
            )}
          </g>
        );
      })}
      <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} className="axis" />
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <text key={f} x={x(total * f)} y={H - m.b + 16} textAnchor="middle">
          {Math.round(total * f)} NM
        </text>
      ))}
      {a && (
        <g pointerEvents="none">
          <line x1={x(a.cum)} x2={x(a.cum)} y1={m.t} y2={H - m.b} className="cursor" />
          <rect x={Math.min(x(a.cum) + 8, W - m.r - boxW - 8)} y={m.t + 18} width={boxW} height={52} rx={2} fill="var(--ink)" />
          <text x={Math.min(x(a.cum) + 16, W - m.r - boxW)} y={m.t + 36} style={{ fill: "var(--sheet)", fontWeight: 600, fontSize: 13 }}>
            {a.name}
          </text>
          <text x={Math.min(x(a.cum) + 16, W - m.r - boxW)} y={m.t + 54} style={{ fill: "var(--sheet)" }}>
            {a.alt ? `FL${a.alt}` : "GND"} · {a.cum} NM · {a.efob ?? "—"}t{pic && a.efob ? ` (${pic.tfob(a.efob, a.pbrn)!.toFixed(1)})` : ""}
          </text>
        </g>
      )}
    </svg>
  );
}

/** The fuel en-route alternate to plot: its position and where the route passes closest. */
type MapEra = { icao: string; name: string; coord: [number, number]; abeam: { point: [number, number]; nm: number; fix: string } | null; when: string | null };

/** Zoom levels, as multiples of the whole-route view. */
const MAP_LEVELS = [
  ["Route", 1],
  ["Region", 2.5],
  ["Close", 6],
] as const;
const MAP_MAX_ZOOM = 12;

/** A polyline (screen px) moved `d` px sideways, to the left of the screen (away from the waypoint names). */
function offsetLine(pts: [number, number][], d: number): [number, number][] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    let nx = -dy;
    let ny = dx;
    if (nx > 0) {
      nx = -nx;
      ny = -ny;
    }
    return [p[0] + nx * d, p[1] + ny * d];
  });
}

/** The point halfway along a polyline, with the angle there (kept upright) and the total length. */
function midOf(poly: [number, number][]) {
  const seg = poly.slice(1).map((p, i) => Math.hypot(p[0] - poly[i][0], p[1] - poly[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  let h = total / 2;
  for (let i = 1; i < poly.length; i++) {
    if (h <= seg[i - 1] || i === poly.length - 1) {
      const t = seg[i - 1] ? Math.min(1, h / seg[i - 1]) : 0;
      let ang = (Math.atan2(poly[i][1] - poly[i - 1][1], poly[i][0] - poly[i - 1][0]) * 180) / Math.PI;
      if (ang > 90) ang -= 180;
      if (ang < -90) ang += 180;
      return { x: poly[i - 1][0] + t * (poly[i][0] - poly[i - 1][0]), y: poly[i - 1][1] + t * (poly[i][1] - poly[i - 1][1]), ang, total };
    }
    h -= seg[i - 1];
  }
  return { x: poly[0][0], y: poly[0][1], ang: 0, total };
}

const polyD = (pts: [number, number][]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

/** The route map, when the log has coordinates to draw. */
function RouteMap(props: Parameters<typeof RouteMapView>[0]) {
  return props.pts.some((p) => p.latDeg != null && p.lonDeg != null) ? <RouteMapView {...props} /> : null;
}

function RouteMapView({
  pts,
  active,
  setActive,
  onKey,
  sigs = [],
  era,
  depFir,
}: {
  pts: P[];
  active: number | null;
  setActive: (i: number | null) => void;
  onKey: (e: KeyboardEvent) => void;
  sigs?: SigmetOnRoute[];
  era?: MapEra | null;
  /** The FIR the route starts in (the log only marks crossings). */
  depFir?: string | null;
}) {
  const outlines = useOutlines();
  const hlSig = useHighlightedSigmet();
  const [style] = useMapStyle();
  const [firMode] = useFirMode();
  // Zoom (1 = whole route) and the centre, [lat, lon] (null = the route's centre).
  const [zoom, setZoom] = useState(1);
  const [centre, setCentre] = useState<[number, number] | null>(null);
  const drag = useRef<{ x: number; y: number; c: [number, number]; moved: boolean } | null>(null);
  // Touch points on the map (for pinch), the pinch in progress, and the last tap (for double-tap).
  const touches = useRef(new Map<number, [number, number]>());
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const lastTouch = useRef(-Infinity);
  // Wheel zoom needs a listener that can cancel the page scroll, so it's added by hand and calls
  // the latest render's zoomAt through this ref.
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const live = useRef<((f: number, x: number, y: number) => boolean) | null>(null);
  useEffect(() => {
    if (!svgEl) return;
    const onWheel = (e: WheelEvent) => {
      // a trackpad pinch arrives as ctrl + wheel with small steps; a mouse notch is about 100
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
      if (live.current?.(f, e.clientX, e.clientY)) e.preventDefault();
    };
    svgEl.addEventListener("wheel", onWheel, { passive: false });
    return () => svgEl.removeEventListener("wheel", onWheel);
  }, [svgEl]);
  // The frame's width, so the drawing area matches its shape instead of letterboxing.
  const [frameW, setFrameW] = useState<number | null>(null);
  const ro = useRef<ResizeObserver | null>(null);
  const svgRef = useCallback((el: SVGSVGElement | null) => {
    ro.current?.disconnect();
    ro.current = null;
    setSvgEl(el);
    if (!el) return;
    ro.current = new ResizeObserver(([e]) => setFrameW(Math.round(e.contentRect.width)));
    ro.current.observe(el);
  }, []);
  const geo = pts.filter((p) => p.latDeg != null && p.lonDeg != null);

  // Frame the route, plus any SIGMET area the route passes through and the fuel en-route alternate.
  const sigPts = sigs.flatMap((x) => (x.impact.lateral && x.s.area.kind === "polygon" ? x.s.area.points : []));
  const eraPts = era ? [era.coord] : [];
  const lats = [...geo.map((p) => p.latDeg!), ...sigPts.map((q) => q[0]), ...eraPts.map((q) => q[0])];
  const lons = [...geo.map((p) => p.lonDeg!), ...sigPts.map((q) => q[1]), ...eraPts.map((q) => q[1])];
  const la0 = Math.min(...lats);
  const la1 = Math.max(...lats);
  const lo0 = Math.min(...lons);
  const lo1 = Math.max(...lons);
  const k = Math.cos((((la0 + la1) / 2) * Math.PI) / 180);
  const pad = 0.6;
  const spanX = (lo1 - lo0 + pad * 2) * k;
  const spanY = la1 - la0 + pad * 2;
  const H = 520;
  // Shown height: 80% of the width, between 300 and 560 px. The width of the drawing
  // follows from it, so the whole frame is map.
  const shownH = frameW ? Math.min(560, Math.max(300, frameW * 0.8)) : null;
  const MW = frameW && shownH ? Math.round((H * frameW) / shownH) : Math.round(Math.max(560, Math.min(1300, (H * spanX) / spanY)));
  const s = Math.min(MW / spanX, H / spanY) * zoom;
  const [cLat, cLon] = centre ?? [(la0 + la1) / 2, (lo0 + lo1) / 2];
  const px = (lon: number) => MW / 2 + (lon - cLon) * k * s;
  const py = (lat: number) => H / 2 - (lat - cLat) * s;
  // Everything the map shows, in degrees.
  const view = { lon0: cLon - MW / 2 / (k * s), lon1: cLon + MW / 2 / (k * s), lat0: cLat - H / 2 / s, lat1: cLat + H / 2 / s };
  const spanDeg = Math.max(view.lon1 - view.lon0, view.lat1 - view.lat0);
  const step = spanDeg > 30 ? 5 : spanDeg > 14 ? 2 : spanDeg > 5 ? 1 : 0.5;
  const gLon: number[] = [];
  for (let v = Math.ceil(view.lon0 / step) * step; v <= view.lon1; v += step) gLon.push(Math.round(v * 10) / 10);
  const gLat: number[] = [];
  for (let v = Math.ceil(view.lat0 / step) * step; v <= view.lat1; v += step) gLat.push(Math.round(v * 10) / 10);
  const wpts = geo.filter((p) => p.kind === "wpt");
  const xy = (p: { lonDeg: number | null; latDeg: number | null }): [number, number] => [px(p.lonDeg!), py(p.latDeg!)];
  const path = polyD(wpts.map(xy));
  // Declutter waypoint names (zooming in makes room for more)
  const labelled = new Set<number>();
  let last: [number, number] | null = null;
  for (const p of wpts) {
    const q = xy(p);
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 46) {
      labelled.add(p.i);
      last = q;
    }
  }
  labelled.add(wpts[0].i);
  labelled.add(wpts.at(-1)!.i);
  const first = wpts[0];
  const end = wpts.at(-1)!;
  // A margin so outlines run off the edge instead of stopping short of it.
  const clip = { lon0: view.lon0 - 0.5, lon1: view.lon1 + 0.5, lat0: view.lat0 - 0.5, lat1: view.lat1 + 0.5 };
  // SIGMET / AIRMET areas: polygons as given; lat/long bounds as the part of the view they cover.
  const areaPath = (a: Area) => {
    if (a.kind === "polygon") return a.points.map(([la, lo], j) => `${j ? "L" : "M"}${px(lo).toFixed(1)} ${py(la).toFixed(1)}`).join(" ") + " Z";
    if (a.kind === "bounds") {
      let [b0, b1, b2, b3] = [clip.lat0, clip.lat1, clip.lon0, clip.lon1];
      for (const p of a.planes) {
        if (p.axis === "lat" && p.op === "gt") b0 = Math.max(b0, p.value);
        else if (p.axis === "lat") b1 = Math.min(b1, p.value);
        else if (p.op === "gt") b2 = Math.max(b2, p.value);
        else b3 = Math.min(b3, p.value);
      }
      if (b0 >= b1 || b2 >= b3) return null;
      return `M${px(b2)} ${py(b0)} L${px(b3)} ${py(b0)} L${px(b3)} ${py(b1)} L${px(b2)} ${py(b1)} Z`;
    }
    return null;
  };
  const sigAreas = sigs.map((x) => ({ ...x, d: areaPath(x.s.area), end: x.s.endArea ? areaPath(x.s.endArea) : null })).filter((x) => x.d);
  const lines = style !== "plain";
  const coast = outlines && lines ? outlinePath(outlines.coast, clip, px, py) : "";
  const borders = outlines && lines ? outlinePath(outlines.borders, clip, px, py) : "";
  // Countries in view: land fill (one tone, or neighbours in different tones without contours), and names.
  const inView = (outlines?.countries ?? []).filter(
    (c) => c.bounds[2] >= clip.lon0 && c.bounds[0] <= clip.lon1 && c.bounds[3] >= clip.lat0 && c.bounds[1] <= clip.lat1,
  );
  const land = inView.map((c) => ({ c, d: ringsPath(c.rings, px, py) }));
  // Anything a name shouldn't sit on: the route's points and the fuel ERA.
  // (the route is sampled every few px, so names keep off the line between waypoints too)
  const busy: [number, number][] = [...(era ? [[px(era.coord[1]), py(era.coord[0])] as [number, number]] : [])];
  geo.forEach((p, j) => {
    const [x1, y1] = xy(p);
    const [x0, y0] = j ? xy(geo[j - 1]) : [x1, y1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8));
    for (let t = 0; t <= n; t++) busy.push([x0 + ((x1 - x0) * t) / n, y0 + ((y1 - y0) * t) / n]);
  });
  const clear = (x: number, y: number, halfW: number) => busy.every(([bx, by]) => Math.abs(bx - x) > halfW + 8 || Math.abs(by - y) > 16);
  const names = inView.flatMap((c) => {
    if (!c.label) return [];
    const [x, y0] = [px(c.label[0]), py(c.label[1])];
    // only where there's room: on screen, and the country's part big enough on screen
    if (x < 40 || x > MW - 40 || c.area * k * s * s < 2600) return [];
    const halfW = c.name.length * 6.5;
    // nudge it up or down off the route if it would sit on it
    const y = [y0, y0 + 22, y0 - 22, y0 + 44].find((v) => v > 64 && v < H - 18 && clear(x, v, halfW)); // below the zoom controls
    return y == null ? [] : [{ c, x, y }];
  });
  // FIR / UIR stretches: from each crossing to the next, as a dashed line beside the route.
  type Stretch = { name: string; pts: [number, number][]; at: [number, number] | null; dir: [number, number] | null };
  const firs: Stretch[] = [];
  let cur: Stretch = { name: depFir ?? "", pts: [], at: null, dir: null };
  geo.forEach((p, k) => {
    if (p.kind === "fir") {
      cur.pts.push(xy(p));
      firs.push(cur);
      // the route's direction through the crossing, from the fixes either side
      const [a, b] = [xy(geo[Math.max(0, k - 1)]), xy(geo[Math.min(geo.length - 1, k + 1)])];
      cur = { name: p.firName ?? p.name, pts: [xy(p)], at: xy(p), dir: [b[0] - a[0], b[1] - a[1]] };
    } else cur.pts.push(xy(p));
  });
  firs.push(cur);
  const firDrawn = firs
    .filter((f) => f.pts.length > 1)
    .map((f) => {
      const line = offsetLine(f.pts, 9);
      const mid = midOf(offsetLine(f.pts, 17));
      // a name only where the stretch is long enough on screen for it, and not over a waypoint name
      const nearLabel = wpts.some((p) => labelled.has(p.i) && Math.abs(xy(p)[0] + 30 - mid.x) < 50 && Math.abs(xy(p)[1] - mid.y) < 18);
      // boundary mark: across the route and the dashed line, square to the route where it crosses in
      let tick: string | null = null;
      if (f.at && f.dir) {
        const a = f.at;
        const l = Math.hypot(...f.dir) || 1;
        let [nx, ny] = [-f.dir[1] / l, f.dir[0] / l];
        if (nx > 0) [nx, ny] = [-nx, -ny]; // the side offsetLine draws on
        tick = polyD([
          [a[0] - nx * 6, a[1] - ny * 6],
          [a[0] + nx * 15, a[1] + ny * 15],
        ]);
      }
      return { ...f, d: polyD(line), mid, tick, named: !!f.name && mid.total > f.name.length * 6.5 + 24 && !nearLabel };
    });
  const firShown = firMode === "off" ? [] : firDrawn;

  const zoomTo = (z: number, c?: [number, number] | null) => {
    const nz = Math.max(1, Math.min(MAP_MAX_ZOOM, z));
    setZoom(nz);
    if (nz === 1) setCentre(null);
    else if (c) setCentre(c);
  };
  /**
   * Zoom by `f` keeping the place under the screen point (clientX, clientY) where it is.
   * Returns false when already at the limit that way, so a wheel can scroll the page instead.
   */
  const zoomAt = (f: number, x: number, y: number) => {
    const nz = Math.max(1, Math.min(MAP_MAX_ZOOM, zoom * f));
    if (nz === zoom || !svgEl) return false;
    const r = svgEl.getBoundingClientRect();
    const ux = ((x - r.left) * MW) / r.width - MW / 2;
    const uy = ((y - r.top) * H) / r.height - H / 2;
    const lon = cLon + ux / (k * s);
    const lat = cLat - uy / s;
    const ns = (s * nz) / zoom;
    setZoom(nz);
    setCentre(nz === 1 ? null : [lat + uy / ns, lon - ux / (k * ns)]);
    return true;
  };
  useLayoutEffect(() => {
    live.current = zoomAt;
  });
  // zoom on the selected waypoint if there is one, else where the map is centred now
  const focus = (): [number, number] => {
    const a = active != null ? geo.find((p) => p.i === active) : null;
    return a ? [a.latDeg!, a.lonDeg!] : [cLat, cLon];
  };
  const levelOn = MAP_LEVELS.reduce((best, l) => (Math.abs(Math.log(l[1] / zoom)) < Math.abs(Math.log(best[1] / zoom)) ? l : best), MAP_LEVELS[0])[0];

  return (
    <div className={cx("map-wrap", `map-${style}`, zoom > 1 && "zoomed")}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MW} ${H}`}
        className="chart route-map"
        style={{ height: shownH ?? undefined, maxHeight: 560 }}
        role="group"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "+" || e.key === "=") zoomTo(zoom * 1.6, focus());
          else if (e.key === "-") zoomTo(zoom / 1.6, focus());
          else onKey(e);
        }}
        aria-label="Route map with waypoints and FIR boundaries. Arrow keys step through waypoints; + and − zoom (or scroll, pinch, double-click); drag to move when zoomed in."
        onPointerLeave={() => setActive(null)}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") {
            touches.current.set(e.pointerId, [e.clientX, e.clientY]);
            if (touches.current.size === 2) {
              const [a, b] = [...touches.current.values()];
              pinch.current = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: zoom };
              drag.current = null;
              (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
              return;
            }
          }
          if (zoom <= 1 || e.button !== 0) return;
          drag.current = { x: e.clientX, y: e.clientY, c: [cLat, cLon], moved: false };
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, [e.clientX, e.clientY]);
          const pn = pinch.current;
          if (pn && touches.current.size === 2) {
            const [a, b] = [...touches.current.values()];
            const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
            zoomAt((pn.z * d) / pn.d / zoom, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
            return;
          }
          const d = drag.current;
          if (!d) return;
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const f = MW / r.width; // screen px → drawing units
          const dx = (e.clientX - d.x) * f;
          const dy = (e.clientY - d.y) * f;
          if (Math.hypot(dx, dy) > 3) d.moved = true;
          setCentre([d.c[0] + dy / s, d.c[1] - dx / (k * s)]);
        }}
        onPointerUp={(e) => {
          const wasPinch = !!pinch.current;
          const moved = drag.current?.moved;
          touches.current.delete(e.pointerId);
          if (touches.current.size < 2) pinch.current = null;
          drag.current = null;
          // double-tap to zoom in (a mouse uses double-click, below)
          if (e.pointerType !== "touch") return;
          lastTouch.current = e.timeStamp;
          if (wasPinch || moved) return;
          const t = lastTap.current;
          if (t && e.timeStamp - t.t < 320 && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 30) {
            zoomAt(2, e.clientX, e.clientY);
            lastTap.current = null;
          } else lastTap.current = { t: e.timeStamp, x: e.clientX, y: e.clientY };
        }}
        onPointerCancel={(e) => {
          touches.current.delete(e.pointerId);
          pinch.current = null;
          drag.current = null;
        }}
        onDoubleClick={(e) => {
          if (e.timeStamp - lastTouch.current < 700) return; // a double-tap, already handled
          zoomAt(e.shiftKey ? 0.5 : 2, e.clientX, e.clientY);
        }}
      >
        <rect x={0} y={0} width={MW} height={H} className="map-sea" />
        <defs>
          <clipPath id="map-land-clip">
            {land.map(({ c, d }) => (
              <path key={c.name} d={d} />
            ))}
          </clipPath>
          <pattern id="sig-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" className="sig-hatch-line" />
          </pattern>
          {sigAreas.map((x) => (
            <clipPath key={x.s.id} id={`sigclip-${x.s.id}`}>
              <path d={x.d!} />
            </clipPath>
          ))}
        </defs>
        {land.map(({ c, d }) => (
          <path key={c.name} d={d} className={`map-land t${style === "plain" ? c.tone : 0}`} />
        ))}
        {style === "relief" && (
          // equirectangular raster: lon and lat map linearly to x and y, like this projection
          <image
            href="/geo/relief.jpg"
            x={px(-180)}
            y={py(90)}
            width={px(180) - px(-180)}
            height={py(-90) - py(90)}
            preserveAspectRatio="none"
            clipPath="url(#map-land-clip)"
            className="map-relief"
          />
        )}
        {borders && <path d={borders} className="map-border" />}
        {coast && <path d={coast} className="map-coast" />}
        {gLon.map((v) => (
          <g key={"lo" + v}>
            <line x1={px(v)} x2={px(v)} y1={0} y2={H} className="gridline map-grid" />
            <text x={px(v) + 3} y={H - 4} className="map-grid-label">
              {v >= 0 ? `E${String(v).padStart(3, "0")}` : `W${String(-v).padStart(3, "0")}`}
            </text>
          </g>
        ))}
        {gLat.map((v) => (
          <g key={"la" + v}>
            <line x1={0} x2={MW} y1={py(v)} y2={py(v)} className="gridline map-grid" />
            <text x={4} y={py(v) - 3} className="map-grid-label">
              {v >= 0 ? `N${v}` : `S${-v}`}
            </text>
          </g>
        ))}
        {names.map(({ c, x, y }) => (
          <text key={"n" + c.name} x={x} y={y} textAnchor="middle" className="map-country">
            {c.name}
          </text>
        ))}
        {sigAreas.map(({ s: sg, d, end: e2, impact }) => {
          const pts2 = sg.area.kind === "polygon" ? sg.area.points : null;
          const c = pts2 ? [pts2.reduce((a, p) => a + p[0], 0) / pts2.length, pts2.reduce((a, p) => a + p[1], 0) / pts2.length] : null;
          return (
            <g
              key={sg.id}
              className={cx(
                "sig-area",
                sg.phenomenon?.severity === "mod" || sg.kind === "AIRMET" ? "mod" : "sev",
                hlSig === sg.id && "hl",
                impact.verdict === "affects" && "on-route",
              )}
              onPointerEnter={() => setHighlightedSigmet(sg.id)}
              onPointerLeave={() => setHighlightedSigmet(null)}
              data-tip={`${sg.phenomenon?.text ?? "Hazard"}${sg.levels ? ` · ${sg.levels.text}` : ""} · valid ${sg.validFrom ? `${String(sg.validFrom.hour).padStart(2, "0")}${String(sg.validFrom.min).padStart(2, "0")}` : "?"}–${sg.validTo ? `${String(sg.validTo.hour).padStart(2, "0")}${String(sg.validTo.min).padStart(2, "0")}` : "?"}Z`}
              data-tip-title={`${sg.kind} ${sg.seq} · ${sg.firName ?? sg.fir ?? ""}`}
            >
              <path d={d!} className="sig-fill" />
              <path d={d!} className="sig-edge" />
              {e2 && <path d={e2} className="sig-end" />}
              {c && (
                <text x={px(c[1])} y={py(c[0])} textAnchor="middle" className="sig-label">
                  {sg.kind} {sg.seq} · {sg.phenomenon?.code ?? ""}
                </text>
              )}
            </g>
          );
        })}
        {firShown.map((f, i) => (
          <path key={"fl" + i} d={f.d} className="map-fir" />
        ))}
        <path d={path} className="route-halo" />
        <path d={path} className="route" />
        {/* the stretch of route inside each area */}
        {sigAreas.map(({ s: sg }) => (
          <path key={"r" + sg.id} d={path} className="route-in-sig" clipPath={`url(#sigclip-${sg.id})`} />
        ))}
        {firShown.map((f, i) => (
          <g
            key={"fn" + i}
            data-tip={
              f.name
                ? `The route is in ${f.name} along this dashed line${f.at ? `, from the ${firMode === "marks" ? "boundary mark" : "circle"} where it crosses in` : ""}.`
                : undefined
            }
            data-tip-title={f.name || undefined}
          >
            {f.tick && firMode === "marks" && <path d={f.tick} className="map-fir-bound" />}
            {f.at && firMode === "line" && <circle cx={f.at[0]} cy={f.at[1]} r={3} className="map-fir-cross" />}
            {f.named && (
              <text
                transform={`translate(${f.mid.x.toFixed(1)} ${f.mid.y.toFixed(1)}) rotate(${f.mid.ang.toFixed(1)})`}
                textAnchor="middle"
                dominantBaseline="middle"
                className="map-fir-label"
              >
                {f.name}
              </text>
            )}
          </g>
        ))}
        {era && (
          <g
            className="map-era"
            data-tip={`${era.name}: the fuel en-route alternate.${era.abeam ? ` The route passes ${Math.round(era.abeam.nm)} NM away, abeam ${era.abeam.fix}${era.when ? ` at ${era.when}` : ""}.` : ""}`}
            data-tip-title={`${era.icao} · fuel ERA`}
          >
            {era.abeam && <line x1={px(era.abeam.point[1])} y1={py(era.abeam.point[0])} x2={px(era.coord[1])} y2={py(era.coord[0])} className="map-era-line" />}
            {era.abeam && <circle cx={px(era.abeam.point[1])} cy={py(era.abeam.point[0])} r={3} className="map-era-abeam" />}
            <path d={`M${px(era.coord[1])} ${py(era.coord[0]) - 8} l8 8 l-8 8 l-8 -8 Z`} className="map-era-mark" />
            {/* below the marker: an ERA is usually close to the route, where the waypoint names are */}
            <text x={px(era.coord[1])} y={py(era.coord[0]) + 26} textAnchor="middle" className="map-era-label">
              {era.icao} · ERA
            </text>
          </g>
        )}
        {wpts.map((p) => {
          const [cx0, cy0] = xy(p);
          if (cx0 < -40 || cx0 > MW + 40 || cy0 < -40 || cy0 > H + 40) return null;
          const ends = p === first || p === end;
          const on = active === p.i;
          return (
            <g key={p.i} onPointerEnter={() => !drag.current && setActive(p.i)}>
              {ends ? (
                <circle cx={cx0} cy={cy0} r={on ? 9 : 7} fill={p === end ? "var(--ink)" : "var(--sheet)"} stroke="var(--ink)" strokeWidth={2} />
              ) : (
                <path
                  d={`M${cx0} ${cy0 - 5} L${cx0 + 4.5} ${cy0 + 3.5} L${cx0 - 4.5} ${cy0 + 3.5} Z`}
                  className={cx("wpt", on && "active")}
                  transform={on ? `translate(${cx0} ${cy0}) scale(1.6) translate(${-cx0} ${-cy0})` : undefined}
                />
              )}
              {(labelled.has(p.i) || on) && (
                <text
                  x={cx0 + 9}
                  y={cy0 + 4}
                  className={cx("map-wpt-label", ends && "label-strong", on && !ends && "label-mag")}
                  style={ends ? { fontSize: 14 } : undefined}
                >
                  {p.name}
                </text>
              )}
              <circle cx={cx0} cy={cy0} r={14} className="hit" />
            </g>
          );
        })}
      </svg>
      <div className="map-levels" role="group" aria-label="Zoom level">
        {MAP_LEVELS.map(([label, z]) => (
          <button key={label} type="button" aria-pressed={levelOn === label} onClick={() => zoomTo(z, z === 1 ? null : focus())}>
            {label}
          </button>
        ))}
      </div>
      <div className="map-zoom" role="group" aria-label="Zoom">
        <button type="button" aria-label="Zoom in" title="Zoom in (+)" disabled={zoom >= MAP_MAX_ZOOM} onClick={() => zoomTo(zoom * 1.6, focus())}>
          +
        </button>
        <button type="button" aria-label="Zoom out" title="Zoom out (−)" disabled={zoom <= 1} onClick={() => zoomTo(zoom / 1.6, focus())}>
          −
        </button>
        <button type="button" aria-label="Fit the whole route" title="Fit the whole route" disabled={zoom === 1} onClick={() => zoomTo(1)}>
          ⤢
        </button>
      </div>
      <span className="map-hint">{zoom > 1 ? "Drag to move · scroll or pinch to zoom" : "Scroll, pinch or double-click to zoom"}</span>
    </div>
  );
}

const COLS: { k: keyof LogPoint | "latlon"; label: string; num?: boolean }[] = [
  { k: "awy", label: "AWY" },
  { k: "fl", label: "FL", num: true },
  { k: "mora", label: "MORA", num: true },
  { k: "wind", label: "WIND" },
  { k: "comp", label: "COMP", num: true },
  { k: "oat", label: "OAT", num: true },
  { k: "tdv", label: "TDV", num: true },
  { k: "imt", label: "IMT", num: true },
  { k: "itt", label: "ITT", num: true },
  { k: "mn", label: "MN", num: true },
  { k: "tas", label: "TAS", num: true },
  { k: "gs", label: "GS", num: true },
  { k: "dis", label: "DIS", num: true },
  { k: "rdis", label: "RDIS", num: true },
  { k: "eet", label: "EET", num: true },
  { k: "ttlt", label: "TTLT", num: true },
];

const TAIL: { k: keyof LogPoint | "latlon"; label: string; num?: boolean }[] = [
  { k: "pbrn", label: "PBRN", num: true },
  { k: "shr", label: "SHR", num: true },
  { k: "trp", label: "TRP", num: true },
  { k: "freq", label: "FREQ" },
  { k: "latlon", label: "LAT / LONG" },
];

export function FlightLogSection({ no }: { no: number }) {
  const { ofp } = useOfp();
  const eraInfo = useEra();
  // The route starts in the FIR listed around the departure in the NOTAMs (the log only marks crossings).
  const depFir = ofp?.notams.groups.find((g) => /AROUND DEPARTURE/i.test(g.section) && /\b(FIR|UIR)\b/.test(g.locationName ?? ""))?.locationName ?? null;
  const [active, setActive] = useState<number | null>(null);
  // nav log row under the pointer / holding focus (for quick fill)
  const [rowHover, setRowHover] = useState<number | null>(null);
  const [rowFocus, setRowFocus] = useState<number | null>(null);
  const [off, setOff] = useField("log.off", "Flight log", "Actual take-off (OFF, UTC)");
  const lg = useFieldGroup("log", "Flight log");
  const [picExtraRaw] = useField("fuel.picExtra", "Planned fuel", "PIC extra fuel");
  const [picOn, setPicOn] = useField("log.includePic", "Flight log", "Include PIC extra in nav log");
  // RETO: ETOs worked from the Actual OFF typed in Times & weights, so it needn't be typed twice.
  const timesActual = useFieldGroup("times.actual", "Times & weights");
  const timesOff = /^\d{4}$/.test(timesActual.get("OFF")) ? timesActual.get("OFF") : null;
  const [retoOn, setRetoOn] = useField("log.useTimesOff", "Flight log", "Use Times & weights OFF in nav log");
  const logOffSet = /^\d{4}$/.test(off);
  // Both OFF boxes filled is ambiguous, so the switch is off then; it also needs a Times & weights OFF.
  const retoBlocked = !timesOff
    ? "Fill in Actual OFF in Times & weights to enable"
    : logOffSet
      ? "Both Actual OFF boxes are filled; clear one to use this"
      : null;
  const reto = retoOn === "on" && !retoBlocked;
  const wkey = (p: P) => String(p.i).padStart(3, "0");
  const pts = useMemo(() => (ofp ? prep(ofp.log) : []), [ofp]);
  const finAlt = ofp?.fuel.fmc.find((f) => f.label === "FINRES+ALTN")?.value;
  const minFuel = finAlt != null ? finAlt / 1000 : null;
  const plannedOff = ofp?.header.offTime ?? null;
  const offTime = /^\d{4}$/.test(off) ? off : plannedOff;
  const a = active != null ? pts[active] : null;
  const picKg = Number(picExtraRaw) || 0;
  const pic = useMemo(() => (ofp && picKg > 0 && picOn === "on" ? picExtraModel(ofp, picKg) : null), [ofp, picKg, picOn]);
  const unitShort = ofp?.header.unit === "LBS" ? "lb" : "kg";

  const sigmets = useSigmets();
  const [sigHidden, setSigHidden] = useField("log.hideSigmets", "Flight log", "Hide SIGMET areas on the route map");
  const drawable = sigmets.list.filter((x) => x.s.area.kind === "polygon" || x.s.area.kind === "bounds");
  const sigsShown = sigHidden === "on" ? [] : sigmets.list;
  const crit = ofp?.criticalMora?.match(/MORA\s+(\d+)\s+FEET AT\s+(\S+?)\/\/\/MXSHR\s+(\d+)\s+AT\s+(\S+)/);

  const step = (e: KeyboardEvent) => {
    if (!pts.length) return;
    const w = pts.filter((p) => p.kind === "wpt").map((p) => p.i);
    const cur = active == null ? -1 : w.indexOf(active);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setActive(w[Math.min(w.length - 1, cur + 1)]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive(w[Math.max(0, cur - 1)]);
    } else if (e.key === "Home") setActive(w[0]);
    else if (e.key === "End") setActive(w.at(-1)!);
    else if (e.key === "Escape") setActive(null);
  };

  const eto = (p: P, from: string | null = offTime) => {
    const m = hhmmToMin(from);
    const t = hhmmToMin(p.ttlt);
    if (m == null || t == null) return null;
    const v = (m + t) % 1440;
    return `${String(Math.floor(v / 60)).padStart(2, "0")}${String(v % 60).padStart(2, "0")}`;
  };

  const rows: (P | null)[] = pts.length ? pts : Array.from({ length: 8 }, () => null);

  // Quick fill: the fix after the last one filled in, and the row under the pointer (or with focus),
  // offer the time now (UTC) for ATO and, for AFOB, the planned fuel (TFOB with PIC extra) shifted
  // by the fuel Δ of the nearest filled-in fix above. The latest AFOB gets ▲▼ to adjust by 0.1 t.
  const nowZ = useUtcNow();
  const fixes = pts.filter((p) => p.kind !== "fir");
  const lastFilled = (k: string) => fixes.findLastIndex((p) => !!lg.get(`${wkey(p)}.${k}`));
  const fuelRef = (p: P) => pic?.tfob(p.efob, p.pbrn) ?? (p.efob ? Number(p.efob) : null);
  const atoNext = fixes[lastFilled("ato") + 1]?.i ?? null;
  const afLatest = fixes[lastFilled("afob")] ?? null;
  const afNext = fixes[lastFilled("afob") + 1]?.i ?? null;
  const predictFob = (p: P) => {
    const ref = fuelRef(p);
    if (ref == null) return null;
    const above = fixes.findLast((q) => q.i < p.i && !!lg.get(`${wkey(q)}.afob`));
    const aboveRef = above ? fuelRef(above) : null;
    const d = above && aboveRef != null ? Number(lg.get(`${wkey(above)}.afob`)) - aboveRef : 0;
    return Number.isNaN(d) ? null : Math.max(0, ref + d).toFixed(1);
  };
  const offering = (i: number, next: number | null) => i === next || i === rowHover || i === rowFocus;
  const toc = pts.find((p) => /T O C/.test(p.position ?? ""));
  const tod = pts.find((p) => /T O D/.test(p.position ?? ""));
  const maxFl = Math.max(0, ...pts.map((p) => p.alt));
  const firs = pts.filter((p) => p.kind === "fir");

  return (
    <Section id="log" no={no} title="Flight log" meta={<span>PDF p.{pageOf(ofp?.pages, /^\s+FLIGHT LOG\s*$/) ?? 4}–</span>}>
      <div className="row" style={{ marginBottom: 12, gap: 8 }}>
        <Tip tip={G["MOST CRITICAL MORA"]} title="MOST CRITICAL MORA">
          <span className="field-label" style={{ margin: 0 }}>
            Most critical MORA
          </span>
        </Tip>
        {crit ? (
          <>
            <Badge tone="amber">
              {Number(crit[1]).toLocaleString("en-GB")} ft at {crit[2]}
            </Badge>
            <Tip tip={G.SHR} title="MXSHR">
              <span className="field-label" style={{ margin: 0 }}>
                Max shear
              </span>
            </Tip>
            <Badge tone="blue">
              {Number(crit[3])} at {crit[4]}
            </Badge>
          </>
        ) : (
          <V v={ofp?.criticalMora} w={30} />
        )}
        <span className="row" style={{ marginLeft: "auto", gap: 8 }}>
          <Badge tone="ink" tip={G.TOC}>
            TOC {toc ? `${toc.cum} NM · ${fmtHhmm(toc.ttlt)}` : "—"}
          </Badge>
          <Badge tone="ink" tip={G.TOD}>
            TOD {tod ? `${tod.cum} NM · ${fmtHhmm(tod.ttlt)}` : "—"}
          </Badge>
          <Badge tone="mag" tip="Highest planned cruise level">
            Max FL{maxFl || "—"}
          </Badge>
        </span>
      </div>

      <Sub>Vertical profile</Sub>
      <Replay className="chart-frame" mode="once" sectionId="log">
        {pts.length ? (
          <Profile pts={pts} active={active} setActive={setActive} minFuel={minFuel} onKey={step} pic={pic} sigs={sigsShown} />
        ) : (
          <EmptyChart label="Profile" />
        )}
      </Replay>
      <div className="legend small" aria-hidden="true">
        <span>
          <i style={{ background: "var(--magenta)" }} />
          Planned level
        </span>
        <span>
          <i style={{ background: "var(--terrain)" }} />
          MORA (terrain)
        </span>
        <span>
          <i style={{ background: "var(--blue)" }} />
          EFOB, tonnes (right axis)
        </span>
        {pic && (
          <span>
            <i style={{ background: "var(--green)" }} />
            TFOB · with PIC extra
          </span>
        )}
        <span>
          <i style={{ background: "var(--red)" }} />
          Minimum landing fuel
        </span>
      </div>

      <div className="cols" style={{ ["--min" as string]: "340px", marginTop: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
        <div style={{ gridColumn: "span 2" }} className="map-col">
          <Sub>Route map</Sub>
          {drawable.length > 0 && (
            <label className="row small sig-toggle">
              <input type="checkbox" checked={sigHidden !== "on"} onChange={(e) => setSigHidden(e.target.checked ? "" : "on")} />
              Show SIGMET / AIRMET areas ({drawable.length}) on the map and profile
            </label>
          )}
          <div className="chart-frame" style={{ padding: 0 }}>
            {pts.length ? (
              <RouteMap
                pts={pts}
                active={active}
                setActive={setActive}
                onKey={step}
                sigs={sigsShown}
                era={
                  eraInfo.era && eraInfo.coord
                    ? { icao: eraInfo.era.icao, name: eraInfo.era.name, coord: eraInfo.coord, abeam: eraInfo.abeam, when: eraInfo.when?.clock ?? null }
                    : null
                }
                depFir={depFir}
              />
            ) : (
              <EmptyChart label="Map" />
            )}
          </div>
        </div>
        <div>
          <Sub>Waypoint</Sub>
          <div className="wp-card">
            <div className="wp-name" aria-live="polite">
              {a ? a.name : <span className="wp-hint">{pts.length ? "No waypoint selected" : "Not loaded"}</span>}
              <span>{a?.position && a.position !== a.name ? a.position : "\u00a0"}</span>
            </div>
            <dl className="dl">
              {wpRows(a, pic).map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="wp-foot small muted">
              {pts.length
                ? "Hover the profile, map or a table row — or focus a chart and use the arrow keys."
                : "Waypoint details appear here once a plan is loaded."}
            </p>
          </div>
        </div>
      </div>
      {firs.length > 0 && (
        <p className="small muted" style={{ margin: "8px 0 0" }}>
          FIR boundaries: {firs.map((f) => `${f.firName ?? f.name} at +${fmtHhmm(f.ttlt)}`).join(" · ")}
        </p>
      )}

      <Sub>Navigation log</Sub>
      <div className="row small" style={{ marginBottom: 8 }}>
        <label className="row" style={{ gap: 6 }}>
          <Tip tip="ETO = OFF + TTLT. Enter the actual take-off time to recompute every ETO; defaults to the planned OFF time.">
            <span className="field-label" style={{ margin: 0 }}>
              Actual OFF
            </span>
          </Tip>
          <Act
            label="Actual take-off time UTC"
            value={off}
            onChange={(v) => setOff(v.replace(/\D/g, "").slice(0, 4))}
            w={4}
            placeholder={plannedOff ?? "HHMM"}
          />
        </label>
        <span
          className="switch-wrap"
          data-tip={
            retoBlocked ?? `Adds a RETO column: ETOs worked from the Actual OFF in Times & weights (${fmtHhmm(timesOff)}Z); ATO is then compared with RETO`
          }
          data-tip-title="Times & weights OFF"
        >
          <button
            type="button"
            role="switch"
            aria-checked={reto}
            disabled={!!retoBlocked}
            className="switch"
            onClick={() => setRetoOn(retoOn === "on" ? "" : "on")}
            aria-describedby="navlog-reto-note"
          >
            <span className="switch-main">
              <span className="switch-track" aria-hidden="true">
                <span className="switch-thumb" />
              </span>
              Times &amp; weights OFF
            </span>
            {timesOff && <span className="switch-value">{fmtHhmm(timesOff)}Z</span>}
          </button>
        </span>
        <span
          className="switch-wrap next"
          data-tip={!picKg ? "Add PIC extra in Planned fuel to enable" : "Adds a TFOB column: EFOB plus the PIC extra still on board"}
          data-tip-title="Include PIC extra"
        >
          <button
            type="button"
            role="switch"
            aria-checked={picOn === "on" && picKg > 0}
            disabled={!picKg}
            className="switch"
            onClick={() => setPicOn(picOn === "on" ? "" : "on")}
            aria-describedby="navlog-tfob-note"
          >
            <span className="switch-main">
              <span className="switch-track" aria-hidden="true">
                <span className="switch-thumb" />
              </span>
              Include PIC extra
            </span>
            {picKg > 0 && (
              <span className="switch-value">
                +{picKg.toLocaleString("en-GB")} {unitShort}
              </span>
            )}
          </button>
        </span>
      </div>
      <div className="tbl-wrap" style={{ maxHeight: 620 }}>
        <table className="tbl">
          <caption className="sr-only">Navigation log, one row per waypoint</caption>
          <thead>
            <tr>
              <th scope="col" style={{ position: "sticky", left: 0, zIndex: 2 }}>
                <Tip tip={`${G.IDENT}. ${G.POSITION}`} title="IDENT / POSITION">
                  Ident
                </Tip>
              </th>
              {COLS.map((c) => (
                <th key={c.label} scope="col" className={c.num ? "num" : undefined}>
                  <Tip tip={G[c.label]} title={c.label}>
                    {c.label}
                  </Tip>
                </th>
              ))}
              <th scope="col" className="num">
                <Tip tip={G.ETO} title="ETO">
                  ETO
                </Tip>
              </th>
              {reto && (
                <th scope="col" className="num">
                  <Tip tip={G.RETO} title="RETO">
                    RETO
                  </Tip>
                </th>
              )}
              <th scope="col" className="num">
                <Tip tip={G.ATO} title="ATO">
                  ATO
                </Tip>
              </th>
              <th scope="col" className="num delta">
                <Tip tip={`ATO minus ${reto ? "RETO" : "ETO"}, in minutes (+ late, − early)`} title="Δ time">
                  Δ
                </Tip>
              </th>
              <th scope="col" className="num">
                <Tip tip={G.EFOB} title="EFOB">
                  EFOB
                </Tip>
              </th>
              {pic && (
                <th scope="col" className="num">
                  <Tip tip={G.TFOB} title="TFOB">
                    TFOB
                  </Tip>
                </th>
              )}
              <th scope="col" className="num">
                <Tip tip={G.AFOB} title="AFOB">
                  AFOB
                </Tip>
              </th>
              <th scope="col" className="num delta">
                <Tip tip={`AFOB minus ${pic ? "TFOB" : "EFOB"}, in tonnes (− below plan, + above)`} title="Δ fuel">
                  Δ
                </Tip>
              </th>
              {TAIL.map((c) => (
                <th key={c.label} scope="col" className={c.num ? "num" : undefined}>
                  <Tip tip={G[c.label.split(" ")[0]] ?? `${G.LAT} / ${G.LONG}`} title={c.label}>
                    {c.label}
                  </Tip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, r) => {
              if (!p)
                return (
                  <tr key={r}>
                    {Array.from({ length: COLS.length + TAIL.length + 7 + (pic ? 1 : 0) + (reto ? 1 : 0) }, (_, c) => (
                      <td key={c}>
                        <V v={null} w={c === 0 ? 6 : 3} />
                      </td>
                    ))}
                  </tr>
                );
              const e = eto(p);
              const re = reto ? eto(p, timesOff) : null;
              const atoV = lg.get(`${wkey(p)}.ato`);
              const dAto = atoV && /^\d{4}$/.test(atoV) && (re ?? e) ? signedMin((re ?? e)!, atoV) : null;
              const af = lg.get(`${wkey(p)}.afob`);
              const tf = pic ? pic.tfob(p.efob, p.pbrn) : null;
              const ref = tf ?? (p.efob ? Number(p.efob) : null);
              const dF = af && ref != null ? Number(af) - ref : null;
              const isFir = p.kind === "fir";
              return (
                <tr
                  key={p.i}
                  className={cx(isFir && "fir", active === p.i && "active")}
                  onPointerEnter={() => {
                    setActive(p.i);
                    setRowHover(p.i);
                  }}
                  onPointerLeave={() => {
                    setActive(null);
                    setRowHover(null);
                  }}
                  onFocus={(e) => setRowFocus(e.target instanceof HTMLInputElement ? p.i : null)}
                  onBlur={() => setRowFocus(null)}
                >
                  <th scope="row" style={{ position: "sticky", left: 0, background: "var(--sheet)", zIndex: 1 }}>
                    <span style={{ display: "block" }}>
                      {isFir ? `▸ ${p.name}` : p.name}
                      {/* SIGMET / AIRMET areas this waypoint is in */}
                      {sigmets.list
                        .filter((x) => x.impact.lateral && x.impact.names.includes(p.ident ?? p.position ?? ""))
                        .map((x) => (
                          <span
                            key={x.s.id}
                            className={cx("sig-mark", x.impact.verdict === "affects" ? "on" : "clear")}
                            data-tip={`${x.s.phenomenon?.text ?? "Hazard"} · ${x.s.levels?.text ?? ""}${x.impact.verdict === "affects" ? " · at your level while valid" : x.impact.verdict === "clear-time" ? " · not valid when you're here" : x.impact.verdict === "clear-level" ? " · you're clear of its levels" : ""}`}
                            data-tip-title={`${x.s.kind} ${x.s.seq} · ${x.s.fir ?? ""}`}
                            onPointerEnter={() => setHighlightedSigmet(x.s.id)}
                            onPointerLeave={() => setHighlightedSigmet(null)}
                          >
                            {x.s.kind === "AIRMET" ? "AIR" : "SIG"} {x.s.seq}
                          </span>
                        ))}
                    </span>
                    {(isFir ? p.firName : p.position !== p.name ? p.position : null) && (
                      <span className="small muted" style={{ fontFamily: "var(--font-sans)", fontWeight: 400 }}>
                        {isFir ? p.firName : p.position}
                      </span>
                    )}
                  </th>
                  {COLS.map((c) => {
                    const v = p[c.k as keyof LogPoint] as string | null;
                    let out: string | null = v;
                    if (c.k === "eet" || c.k === "ttlt") out = fmtHhmm(v);
                    if (c.k === "fl" && v) out = String(Number(v));
                    const color = c.k === "comp" && v ? ((signed(v) ?? 0) < 0 ? "var(--red)" : (signed(v) ?? 0) > 0 ? "var(--green)" : undefined) : undefined;
                    return (
                      <td key={c.label} className={c.num ? "num" : undefined} style={{ color }}>
                        {out ?? ""}
                      </td>
                    );
                  })}
                  <td className="num muted">{isFir ? "" : fmtHhmm(e)}</td>
                  {reto && (
                    <td
                      className="num tfob"
                      data-tip={!isFir && re ? `Actual OFF ${fmtHhmm(timesOff)}Z (Times & weights) + TTLT ${fmtHhmm(p.ttlt)}` : undefined}
                      data-tip-title={!isFir && re ? `RETO ${fmtHhmm(re)}Z` : undefined}
                    >
                      {isFir ? "" : fmtHhmm(re)}
                    </td>
                  )}
                  <td className="num">
                    {!isFir && (
                      <ActQuick
                        label={`Actual time over ${p.name}`}
                        value={atoV ?? ""}
                        onChange={(v) => lg.put(`${wkey(p)}.ato`, `ATO ${p.name}`, v.replace(/\D/g, "").slice(0, 4))}
                        w={4}
                        offer={offering(p.i, atoNext) ? nowZ : null}
                        offerIcon={<ClockIcon />}
                        offerLabel="Time now (UTC)"
                      />
                    )}
                  </td>
                  <td className="num delta" style={{ color: dAto ? (dAto > 0 ? "var(--red)" : "var(--green)") : undefined }}>
                    {dAto != null ? `${dAto > 0 ? "+" : dAto < 0 ? "−" : "±"}${Math.abs(dAto)}′` : ""}
                  </td>
                  <td className="num">{p.efob ?? ""}</td>
                  {pic && (
                    <td
                      className="num tfob"
                      data-tip={
                        tf != null
                          ? `EFOB ${p.efob} t + ${Math.round(pic.extraAt(p.pbrn))} ${unitShort} PIC extra still on board (${picKg} loaded − ${Math.round(picKg - pic.extraAt(p.pbrn))} burnt carrying it)`
                          : undefined
                      }
                      data-tip-title={tf != null ? `TFOB ${tf.toFixed(2)} t` : undefined}
                    >
                      {tf != null ? tf.toFixed(1) : ""}
                    </td>
                  )}
                  <td className="num">
                    {!isFir && (
                      <ActQuick
                        label={`Actual fuel on board at ${p.name}, tonnes`}
                        value={af ?? ""}
                        onChange={(v) => lg.put(`${wkey(p)}.afob`, `AFOB ${p.name} (t)`, v.replace(/[^\d.]/g, ""))}
                        w={4}
                        inputMode="decimal"
                        offer={offering(p.i, afNext) ? predictFob(p) : null}
                        offerLabel="Predicted fuel"
                        nudge={p.i === afLatest?.i ? 0.1 : undefined}
                      />
                    )}
                  </td>
                  <td
                    className="num delta"
                    style={{ color: dF != null && !Number.isNaN(dF) && Math.abs(dF) >= 0.05 ? (dF < 0 ? "var(--red)" : "var(--green)") : undefined }}
                  >
                    {dF != null && !Number.isNaN(dF) ? `${dF >= 0.05 ? "+" : dF <= -0.05 ? "−" : "±"}${Math.abs(dF).toFixed(1)}` : ""}
                  </td>
                  {TAIL.map((c) => {
                    if (c.k === "latlon")
                      return (
                        <td key={c.label} className="small">
                          {p.lat} {p.long}
                        </td>
                      );
                    const v = p[c.k as keyof LogPoint] as string | null;
                    return (
                      <td key={c.label} className={c.num ? "num" : undefined}>
                        {v ?? ""}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <dl className="navlog-notes small" aria-label="How these columns are worked out">
        <dt>ETO</dt>
        <dd>Actual OFF{plannedOff ? ` (or planned ${fmtHhmm(plannedOff)}Z)` : ""} + TTLT. Type ATO and AFOB as you fly; differences from plan are coloured.</dd>
        <dt>RETO</dt>
        <dd id="navlog-reto-note">
          {retoBlocked
            ? `Revised ETO from the Actual OFF in Times & weights. ${retoBlocked}.`
            : reto
              ? `Actual OFF ${fmtHhmm(timesOff)}Z from Times & weights + TTLT; ATO is compared with RETO.`
              : `Switch on Times & weights OFF to add a RETO column from ${fmtHhmm(timesOff)}Z.`}
        </dd>
        <dt>TFOB</dt>
        <dd id="navlog-tfob-note">
          {!picKg
            ? "Add PIC extra in Planned fuel, then switch on Include PIC extra to see fuel on board with it."
            : !pic
              ? "Switch on Include PIC extra to add a TFOB column; AFOB is then compared with TFOB."
              : pic.burnPer1000
                ? `EFOB + PIC extra, less ${pic.burnPer1000} ${unitShort} per tonne carried (from Operational impacts), taken off in proportion to fuel burnt. Lands with +${Math.round(pic.extraAt(pts.at(-1)?.pbrn ?? null))} ${unitShort}; AFOB is compared with TFOB.`
                : "EFOB + PIC extra; AFOB is compared with TFOB."}
        </dd>
      </dl>
      {pts.length > 0 && (
        <p className="note">
          Legs: {pts.filter((p) => p.kind === "wpt").length - 1} · FIR crossings: {firs.length} · planned air time {fmtHhmm(pts.at(-1)?.ttlt)} ·{" "}
          {plannedOff && ofp?.header.onTime
            ? `OFF ${fmtHhmm(plannedOff)}Z → ON ${fmtHhmm(ofp.header.onTime)}Z (${clockDiff(plannedOff, ofp.header.onTime)} min)`
            : ""}
        </p>
      )}
    </Section>
  );
}

/** Always the same rows (dash when absent) so the card never changes height. */
function wpRows(a: P | null, pic: PicExtraModel | null): [string, string][] {
  const d = "—";
  const comp = a?.comp ? signed(a.comp) : null;
  return [
    ["Airway", a?.awy ?? d],
    ["Level", a ? (a.alt ? `FL${a.alt}` : "Ground") : d],
    ["Wind", a?.wind ? `${a.wind}${comp != null ? ` · ${comp < 0 ? `${-comp} kt head` : `${comp} kt tail`}` : ""}` : d],
    ["OAT / ISA", a?.oat ? `${parseTemp(a.oat)} °C · ISA ${a.tdv ?? d}` : d],
    ["Speeds", [a?.mn && `Mach ${a.mn}`, a?.tas && `TAS ${a.tas}`, a?.gs && `GS ${a.gs}`].filter(Boolean).join(" · ") || d],
    ["Distance", a ? `${a.cum} NM flown${a.rdis ? ` · ${a.rdis} to go` : ""}` : d],
    ["Time", a?.ttlt ? `+${fmtHhmm(a.ttlt)} after take-off` : d],
    ["Fuel", a?.efob ? `${a.efob} t on board${pic ? ` (${pic.tfob(a.efob, a.pbrn)!.toFixed(1)} with PIC)` : ""} · ${a.pbrn ?? d} t burnt` : d],
    ["MORA", a?.mora ? `${(Number(a.mora) * 100).toLocaleString("en-GB")} ft` : d],
    ["Position", a?.lat ? `${a.lat} ${a.long ?? ""}` : d],
    ["Freq", a?.freq ?? d],
  ];
}

function signedMin(e: string, a: string) {
  const d = clockDiff(e, a)!;
  return d > 720 ? d - 1440 : d;
}

function EmptyChart({ label }: { label: string }) {
  return (
    <svg viewBox={`0 0 ${W} 280`} className="chart" role="img" aria-label={`${label} — not loaded`}>
      {Array.from({ length: 6 }, (_, k) => (
        <line key={k} x1={40} x2={W - 40} y1={30 + k * 44} y2={30 + k * 44} className="gridline" />
      ))}
      <text x={W / 2} y={150} textAnchor="middle" style={{ fontSize: 14 }}>
        {label} draws here once a plan is loaded
      </text>
    </svg>
  );
}
