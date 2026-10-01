"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useReplay } from "./replay";
import type { OFP } from "@/lib/ofp/types";
import { hhmmToMin } from "@/lib/ofp/format";
import type { StripMode } from "@/lib/stripPref";

/* ---------- data ---------- */

interface Pt {
  id: string;
  cum: number;
  alt: number;
  lat: number | null;
  lon: number | null;
  ttlt: string | null;
}

interface StripData {
  pts: Pt[];
  total: number;
  toc: number;
  tod: number;
  levels: string | null;
  t: { out: string | null; off: string | null; toc: string | null; tod: string | null; on: string | null; in: string | null };
  dep: string;
  arr: string;
}

const clock = (base: string | null, plusMin: number | null): string | null => {
  const b = hhmmToMin(base);
  if (b == null || plusMin == null) return null;
  const v = (((b + plusMin) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};
const hm = (v: string | null) => (v && /^\d{4}$/.test(v) ? `${v.slice(0, 2)}:${v.slice(2)}` : v);

function prep(ofp: OFP): StripData | null {
  const wpts = ofp.log.filter((p) => p.kind === "wpt");
  if (wpts.length < 2) return null;
  let cum = 0;
  const pts: Pt[] = wpts.map((p, i) => {
    cum += Number(p.dis ?? 0) || 0;
    const ground = i === 0 || i === wpts.length - 1;
    return { id: p.ident ?? p.position ?? "", cum, alt: ground ? 0 : Number(p.fl) || 0, lat: p.latDeg, lon: p.lonDeg, ttlt: p.ttlt };
  });
  const toc = wpts.findIndex((p) => /T O C/.test(p.position ?? ""));
  const tod = wpts.findIndex((p) => /T O D/.test(p.position ?? ""));
  const steps = ofp.header.flSteps.map((s) => `FL${Number(s.fl)}`);
  const levels = steps.length ? [...new Set(steps)].join(" → ") : null;
  const h = ofp.header;
  return {
    pts,
    total: cum || 1,
    toc,
    tod,
    levels,
    t: {
      out: hm(h.outTime),
      off: hm(h.offTime),
      toc: toc >= 0 ? clock(h.offTime, hhmmToMin(pts[toc].ttlt)) : null,
      tod: tod >= 0 ? clock(h.offTime, hhmmToMin(pts[tod].ttlt)) : null,
      on: hm(h.onTime),
      in: hm(h.inTime),
    },
    dep: h.dep ?? "DEP",
    arr: h.arr ?? "ARR",
  };
}

/* ---------- label rows (never overlap) ---------- */

interface Label {
  x: number;
  name: string;
  value?: string | null;
  minRow: number;
}

const CHAR = 6.6; // ~ width of an 11px mono glyph

/** Puts each label in the first row (from minRow down) where it doesn't touch another. */
function placeLabels(labels: Label[], w: number) {
  const rows: [number, number][][] = [];
  return labels.map((l) => {
    const text = l.value ? `${l.name} ${l.value}` : l.name;
    const width = text.length * CHAR;
    const anchor: "start" | "middle" | "end" = l.x - width / 2 < 0 ? "start" : l.x + width / 2 > w ? "end" : "middle";
    const from = anchor === "start" ? l.x : anchor === "end" ? l.x - width : l.x - width / 2;
    const span: [number, number] = [from - 5, from + width + 5];
    let row = l.minRow;
    while ((rows[row] ?? []).some(([a, b]) => span[0] < b && span[1] > a)) row++;
    (rows[row] ??= []).push(span);
    return { ...l, row, anchor };
  });
}

function LabelRows({ labels, w, top, rowH = 14 }: { labels: Label[]; w: number; top: number; rowH?: number }) {
  const placed = placeLabels(labels, w);
  return (
    <>
      {placed.map((l, i) => {
        const y = top + 12 + l.row * rowH;
        return (
          <g key={i}>
            <line x1={l.x} x2={l.x} y1={top - 6} y2={y - 9} className="fs-tick" />
            <text x={l.x} y={y} textAnchor={l.anchor} className="fs-text">
              <tspan className="fs-strong">{l.name}</tspan>
              {l.value ? ` ${l.value}` : ""}
            </text>
          </g>
        );
      })}
    </>
  );
}

const rowsNeeded = (labels: Label[], w: number) => Math.max(1, ...placeLabels(labels, w).map((l) => l.row + 1));

/* ---------- shared bits ---------- */

const PAD = 8;
const REVEAL = { dur: "1.6s", spline: "0.3 0 0.2 1" };
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Wipes its children in from left to right (SMIL, so it shares a clock with the arc's plane). */
function Reveal({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  const id = `fs-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [still] = useState(reducedMotion);
  return (
    <>
      <defs>
        <clipPath id={id}>
          <rect x={-20} y={-30} height={h + 60} width={still ? w + 40 : 0}>
            {!still && <animate attributeName="width" from="0" to={w + 40} dur={REVEAL.dur} fill="freeze" calcMode="spline" keyTimes="0;1" keySplines={REVEAL.spline} />}
          </rect>
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>{children}</g>
    </>
  );
}

function Ends({ a, b }: { a: [number, number]; b: [number, number] }) {
  return (
    <>
      <circle cx={a[0]} cy={a[1]} r={4} className="fs-dep" />
      <circle cx={b[0]} cy={b[1]} r={4} className="fs-arr" />
    </>
  );
}

function Marker({ x, y, tip, title }: { x: number; y: number; tip: string; title: string }) {
  return (
    <g data-tip={tip} data-tip-title={title}>
      <circle cx={x} cy={y} r={3} className="fs-mark" />
      <circle cx={x} cy={y} r={10} className="fs-hit" />
    </g>
  );
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* ---------- modes ---------- */

function profileGeom(d: StripData, w: number, top: number, base: number) {
  const maxAlt = Math.max(1, ...d.pts.map((p) => p.alt));
  const x = (cum: number) => PAD + (cum / d.total) * (w - PAD * 2);
  const y = (alt: number) => base - (alt / maxAlt) * (base - top);
  const xy = d.pts.map((p) => [x(p.cum), y(p.alt)] as [number, number]);
  const line = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return { xy, line, area: `${line} L${xy.at(-1)![0]} ${base} L${xy[0][0]} ${base}Z` };
}

function Profile({ d, w, withTimes }: { d: StripData; w: number; withTimes: boolean }) {
  const top = 18;
  const base = withTimes ? 52 : 58;
  const g = profileGeom(d, w, top, base);
  const toc = d.toc >= 0 ? g.xy[d.toc] : null;
  const tod = d.tod >= 0 ? g.xy[d.tod] : null;
  const cruiseY = Math.min(...g.xy.map((p) => p[1]));
  const lvlX = toc && tod ? (toc[0] + tod[0]) / 2 : w / 2;

  // OFF / ON sit closest to the graphic; TOC / TOD drop a row lower.
  const labels: Label[] = withTimes
    ? [
        { x: g.xy[0][0], name: "OFF", value: d.t.off, minRow: 0 },
        { x: g.xy.at(-1)![0], name: "ON", value: d.t.on, minRow: 0 },
        ...(toc ? [{ x: toc[0], name: "TOC", value: d.t.toc, minRow: 1 }] : []),
        ...(tod ? [{ x: tod[0], name: "TOD", value: d.t.tod, minRow: 1 }] : []),
      ]
    : [];
  const height = withTimes ? base + 8 + rowsNeeded(labels, w) * 14 + 4 : base + 6;

  return (
    <svg width={w} height={height} className="fs" role="img" aria-label={`Vertical profile: ${d.levels ?? "cruise"}, ${Math.round(d.total)} NM${withTimes && d.t.off ? `, off ${d.t.off}, on ${d.t.on}` : ""}`}>
      <Reveal w={w} h={height}>
      <line x1={PAD} x2={w - PAD} y1={base} y2={base} className="fs-base" />
      <path d={g.area} className="fs-area" />
      <path d={g.line} className="fs-line" />
      {d.levels && (
        <text x={Math.min(Math.max(lvlX, 60), w - 60)} y={cruiseY - 6} textAnchor="middle" className="fs-level">
          {d.levels}
        </text>
      )}
      {toc && <Marker x={toc[0]} y={toc[1]} title="Top of climb" tip={`${d.t.toc ?? "—"}Z · FL${d.pts[d.toc].alt} · ${Math.round(d.pts[d.toc].cum)} NM from ${d.dep}`} />}
      {tod && <Marker x={tod[0]} y={tod[1]} title="Top of descent" tip={`${d.t.tod ?? "—"}Z · FL${d.pts[d.tod].alt} · ${Math.round(d.total - d.pts[d.tod].cum)} NM to ${d.arr}`} />}
      {!withTimes && toc && (
        <text x={toc[0]} y={toc[1] + 14} textAnchor="middle" className="fs-text">
          TOC
        </text>
      )}
      {!withTimes && tod && (
        <text x={tod[0]} y={tod[1] + 14} textAnchor="middle" className="fs-text">
          TOD
        </text>
      )}
      <Ends a={g.xy[0]} b={g.xy.at(-1)!} />
      {withTimes && <LabelRows labels={labels} w={w} top={base + 6} />}
      </Reveal>
    </svg>
  );
}

function Route({ d, w }: { d: StripData; w: number }) {
  const geo = d.pts.filter((p) => p.lat != null && p.lon != null);
  const H = 60;
  if (geo.length < 2) return <Profile d={d} w={w} withTimes={false} />;
  const k = Math.cos((((geo[0].lat! + geo.at(-1)!.lat!) / 2) * Math.PI) / 180);
  const raw = geo.map((p) => [p.lon! * k, -p.lat!] as [number, number]);
  const [x0, y0] = raw[0];
  const [x1, y1] = raw.at(-1)!;
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const rot = raw.map(([x, y]) => {
    const dx = x - x0;
    const dy = y - y0;
    return [(dx * Math.cos(-ang) - dy * Math.sin(-ang)) / len, (dx * Math.sin(-ang) + dy * Math.cos(-ang)) / len];
  });
  const maxDev = Math.max(0.05, ...rot.map((r) => Math.abs(r[1])));
  const xy = rot.map(([u, v]) => [PAD + u * (w - PAD * 2), H / 2 + (v / maxDev) * (H / 2 - 10)] as [number, number]);
  const line = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={H} className="fs" role="img" aria-label={`Route from ${d.dep} to ${d.arr}, ${Math.round(d.total)} NM`}>
      <Reveal w={w} h={H}>
      <line x1={xy[0][0]} x2={xy.at(-1)![0]} y1={H / 2} y2={H / 2} className="fs-direct" />
      <path d={line} className="fs-line" />
      {geo.length < 45 &&
        xy.slice(1, -1).map((p, i) => (
          <g key={i} data-tip={`+${hm(geo[i + 1].ttlt)} after take-off · ${Math.round(geo[i + 1].cum)} NM`} data-tip-title={geo[i + 1].id}>
            <path d={`M${p[0]} ${p[1] - 3} l2.6 4.5 h-5.2z`} className="fs-wpt" />
            <circle cx={p[0]} cy={p[1]} r={7} className="fs-hit" />
          </g>
        ))}
      <Ends a={xy[0]} b={xy.at(-1)!} />
      </Reveal>
    </svg>
  );
}

function Timeline({ d, w }: { d: StripData; w: number }) {
  const events = (
    [
      ["OUT", d.t.out],
      ["OFF", d.t.off],
      ["TOC", d.t.toc],
      ["TOD", d.t.tod],
      ["ON", d.t.on],
      ["IN", d.t.in],
    ] as const
  ).filter(([, v]) => v) as [string, string][];
  if (events.length < 2) return <Profile d={d} w={w} withTimes={false} />;
  const start = hhmmToMin(events[0][1].replace(":", ""))!;
  const rel = (v: string) => (((hhmmToMin(v.replace(":", ""))! - start) % 1440) + 1440) % 1440;
  const span = Math.max(1, rel(events.at(-1)![1]));
  const x = (v: string) => PAD + (rel(v) / span) * (w - PAD * 2);
  const barY = 12;
  const seg = (a: string, b: string, cls: string, thick = false) => {
    const ea = events.find((e) => e[0] === a);
    const eb = events.find((e) => e[0] === b);
    if (!ea || !eb) return null;
    return <rect x={x(ea[1])} y={thick ? barY - 4 : barY} width={Math.max(1, x(eb[1]) - x(ea[1]) - 1)} height={thick ? 14 : 6} className={cls} />;
  };
  const labels: Label[] = events.map(([n, v]) => ({ x: x(v), name: n, value: v, minRow: 0 }));
  const height = barY + 18 + rowsNeeded(labels, w) * 14 + 4;
  return (
    <svg width={w} height={height} className="fs" role="img" aria-label={`Timeline: ${events.map(([n, v]) => `${n} ${v}`).join(", ")}`}>
      <Reveal w={w} h={height}>
      {seg("OUT", "OFF", "fs-taxi")}
      {seg("OFF", "TOC", "fs-air")}
      {seg("TOC", "TOD", "fs-cruise", true)}
      {seg("TOD", "ON", "fs-air")}
      {seg("ON", "IN", "fs-taxi")}
      <LabelRows labels={labels} w={w} top={barY + 14} />
      </Reveal>
    </svg>
  );
}

/** Airliner seen from above, nose pointing +x, centred on the origin (~22 px long). */
const PLANE =
  "M11 0 C11 -1.2 9.8 -1.6 8.5 -1.6 L3 -1.6 L-2.5 -9 L-5 -9 L-2 -1.6 L-6.5 -1.6 L-8.6 -4.4 L-10.4 -4.4 L-9.2 0 L-10.4 4.4 L-8.6 4.4 L-6.5 1.6 L-2 1.6 L-5 9 L-2.5 9 L3 1.6 L8.5 1.6 C9.8 1.6 11 1.2 11 0 Z";

function Arc({ w, live }: { w: number; live: boolean }) {
  const p0: [number, number] = [PAD, 52];
  const p1: [number, number] = [w / 2, -14];
  const p2: [number, number] = [w - PAD, 52];
  const d = `M${p0[0]} ${p0[1]} Q${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`;
  const [still] = useState(reducedMotion);
  const STOP = 0.9; // the plane parks just short of the arrival dot
  const at = (t: number) => {
    const u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
    const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
    const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    return { x, y, deg: (Math.atan2(dy, dx) * 180) / Math.PI };
  };
  const rest = at(STOP);
  return (
    <svg width={w} height={60} className="fs" role={live ? "img" : undefined} aria-label={live ? "Flight from departure to arrival" : undefined} aria-hidden={live ? undefined : true}>
      <path d={d} className="fs-placeholder" />
      {live && (
        <Reveal w={w} h={60}>
          <path d={d} className="fs-line" />
        </Reveal>
      )}
      <Ends a={p0} b={p2} />
      {live &&
        (still ? (
          <path d={PLANE} className="fs-plane" transform={`translate(${rest.x} ${rest.y}) rotate(${rest.deg})`} />
        ) : (
          <path d={PLANE} className="fs-plane">
            <animateMotion
              path={d}
              dur={REVEAL.dur}
              fill="freeze"
              rotate="auto"
              keyPoints={`0;${STOP}`}
              keyTimes="0;1"
              calcMode="spline"
              keySplines={REVEAL.spline}
            />
          </path>
        ))}
    </svg>
  );
}

/** Dotted stand-in for the blank form, shaped like the chosen mode. */
function Placeholder({ mode, w }: { mode: StripMode; w: number }) {
  const r = w - PAD;
  const shapes: Record<StripMode, ReactNode> = {
    arc: <Arc w={w} live={false} />,
    profile: (
      <svg width={w} height={64} className="fs" aria-hidden="true">
        <path d={`M${PAD} 58 L${w * 0.2} 20 L${w * 0.75} 20 L${r} 58`} className="fs-placeholder" />
        <Ends a={[PAD, 58]} b={[r, 58]} />
      </svg>
    ),
    "profile-times": (
      <svg width={w} height={84} className="fs" aria-hidden="true">
        <path d={`M${PAD} 52 L${w * 0.2} 18 L${w * 0.75} 18 L${r} 52`} className="fs-placeholder" />
        <line x1={PAD} x2={r} y1={70} y2={70} className="fs-placeholder" />
        <Ends a={[PAD, 52]} b={[r, 52]} />
      </svg>
    ),
    route: (
      <svg width={w} height={60} className="fs" aria-hidden="true">
        <line x1={PAD} x2={r} y1={30} y2={30} className="fs-placeholder" />
        <Ends a={[PAD, 30]} b={[r, 30]} />
      </svg>
    ),
    timeline: (
      <svg width={w} height={50} className="fs" aria-hidden="true">
        <line x1={PAD} x2={r} y1={15} y2={15} className="fs-placeholder" />
        <line x1={PAD} x2={r} y1={36} y2={36} className="fs-placeholder" />
      </svg>
    ),
  };
  return shapes[mode];
}

/** The graphic in the middle of the flight-summary strip. */
export function FlightStrip({ ofp, mode }: { ofp: OFP | null; mode: StripMode }) {
  const [ref, w] = useWidth();
  const round = useReplay(); // remount on each scroll-in so the SMIL animation restarts
  const d = useMemo(() => (ofp ? prep(ofp) : null), [ofp]);
  let body: ReactNode = null;
  if (w > 0) {
    if (!d) body = <Placeholder mode={mode} w={w} />;
    else if (mode === "arc") body = <Arc w={w} live />;
    else if (mode === "route") body = <Route d={d} w={w} />;
    else if (mode === "timeline") body = <Timeline d={d} w={w} />;
    else body = <Profile d={d} w={w} withTimes={mode === "profile-times"} />;
  }
  return (
    <div ref={ref} className="fs-wrap" data-mode={mode}>
      <Fragment key={round}>{body}</Fragment>
    </div>
  );
}
