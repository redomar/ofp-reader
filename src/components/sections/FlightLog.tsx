"use client";

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useField, useFieldGroup, useOfp } from "../context";
import { Replay } from "../replay";
import { Act, Badge, Section, Sub, Tip, V, cx } from "../ui";
import { G } from "@/lib/ofp/glossary";
import { clockDiff, fmtHhmm, hhmmToMin, pageOf, parseTemp, signed } from "@/lib/ofp/format";
import type { LogPoint } from "@/lib/ofp/types";
import { picExtraModel, type PicExtraModel } from "@/lib/ofp/picExtra";

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
    const name = p.kind === "fir" ? p.position ?? "FIR" : p.ident ?? p.position?.replace(/\s/g, "") ?? "—";
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
}: {
  pts: P[];
  active: number | null;
  setActive: (i: number | null) => void;
  minFuel: number | null;
  onKey: (e: KeyboardEvent) => void;
  pic: PicExtraModel | null;
}) {
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

function RouteMap({ pts, active, setActive, onKey }: { pts: P[]; active: number | null; setActive: (i: number | null) => void; onKey: (e: KeyboardEvent) => void }) {
  const geo = pts.filter((p) => p.latDeg != null && p.lonDeg != null);
  if (!geo.length) return null;
  const lats = geo.map((p) => p.latDeg!);
  const lons = geo.map((p) => p.lonDeg!);
  const la0 = Math.min(...lats);
  const la1 = Math.max(...lats);
  const lo0 = Math.min(...lons);
  const lo1 = Math.max(...lons);
  const k = Math.cos((((la0 + la1) / 2) * Math.PI) / 180);
  const pad = 0.6;
  const spanX = (lo1 - lo0 + pad * 2) * k;
  const spanY = la1 - la0 + pad * 2;
  const H = 520;
  const MW = Math.round(Math.max(560, Math.min(1300, (H * spanX) / spanY)));
  const s = Math.min(MW / spanX, H / spanY);
  const offX = (MW - spanX * s) / 2;
  const offY = (H - spanY * s) / 2;
  const px = (lon: number) => offX + (lon - lo0 + pad) * k * s;
  const py = (lat: number) => offY + (la1 + pad - lat) * s;
  const step = Math.max(lo1 - lo0, la1 - la0) > 8 ? 2 : 1;
  const gLon: number[] = [];
  for (let v = Math.floor(lo0 - pad); v <= Math.ceil(lo1 + pad); v += step) gLon.push(v);
  const gLat: number[] = [];
  for (let v = Math.floor(la0 - pad); v <= Math.ceil(la1 + pad); v += step) gLat.push(v);
  const wpts = geo.filter((p) => p.kind === "wpt");
  const path = wpts.map((p, i) => `${i ? "L" : "M"}${px(p.lonDeg!).toFixed(1)} ${py(p.latDeg!).toFixed(1)}`).join(" ");
  // Declutter labels
  const labelled = new Set<number>();
  let last: [number, number] | null = null;
  for (const p of wpts) {
    const xy: [number, number] = [px(p.lonDeg!), py(p.latDeg!)];
    if (!last || Math.hypot(xy[0] - last[0], xy[1] - last[1]) > 46) {
      labelled.add(p.i);
      last = xy;
    }
  }
  labelled.add(wpts[0].i);
  labelled.add(wpts.at(-1)!.i);
  const first = wpts[0];
  const end = wpts.at(-1)!;

  return (
    <svg viewBox={`0 0 ${MW} ${H}`} className="chart" style={{ maxHeight: 560, margin: "0 auto" }} role="group" tabIndex={0} onKeyDown={onKey} aria-label="Route map with waypoints and FIR boundaries. Use arrow keys to step through waypoints." onPointerLeave={() => setActive(null)}>
      <rect x={0} y={0} width={MW} height={H} fill="var(--field)" />
      {gLon.map((v) => (
        <g key={"lo" + v}>
          <line x1={px(v)} x2={px(v)} y1={0} y2={H} className="gridline" />
          <text x={px(v) + 3} y={H - 4} style={{ fontSize: 10 }}>
            {v >= 0 ? `E${String(v).padStart(3, "0")}` : `MW${String(-v).padStart(3, "0")}`}
          </text>
        </g>
      ))}
      {gLat.map((v) => (
        <g key={"la" + v}>
          <line x1={0} x2={MW} y1={py(v)} y2={py(v)} className="gridline" />
          <text x={4} y={py(v) - 3} style={{ fontSize: 10 }}>
            {v >= 0 ? `N${v}` : `S${-v}`}
          </text>
        </g>
      ))}
      <path d={path} className="route" />
      {geo
        .filter((p) => p.kind === "fir")
        .map((p) => (
          <g key={"f" + p.i}>
            <circle cx={px(p.lonDeg!)} cy={py(p.latDeg!)} r={9} fill="none" stroke="var(--ink-3)" strokeDasharray="3 3" />
            <text x={px(p.lonDeg!) - 12} y={py(p.latDeg!) + 3} textAnchor="end" style={{ fontSize: 10, fontStyle: "italic" }}>
              {p.name}
            </text>
          </g>
        ))}
      {wpts.map((p) => {
        const cx0 = px(p.lonDeg!);
        const cy0 = py(p.latDeg!);
        const ends = p === first || p === end;
        const on = active === p.i;
        return (
          <g key={p.i} onPointerEnter={() => setActive(p.i)}>
            {ends ? (
              <circle cx={cx0} cy={cy0} r={on ? 9 : 7} fill={p === end ? "var(--ink)" : "var(--sheet)"} stroke="var(--ink)" strokeWidth={2} />
            ) : (
              <path d={`M${cx0} ${cy0 - 5} L${cx0 + 4.5} ${cy0 + 3.5} L${cx0 - 4.5} ${cy0 + 3.5} Z`} className={cx("wpt", on && "active")} transform={on ? `translate(${cx0} ${cy0}) scale(1.6) translate(${-cx0} ${-cy0})` : undefined} />
            )}
            {(labelled.has(p.i) || on) && (
              <text x={cx0 + 9} y={cy0 + 4} className={ends ? "label-strong" : on ? "label-mag" : undefined} style={ends ? { fontSize: 14 } : undefined}>
                {p.name}
              </text>
            )}
            <circle cx={cx0} cy={cy0} r={14} className="hit" />
          </g>
        );
      })}
    </svg>
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
  const [active, setActive] = useState<number | null>(null);
  const [off, setOff] = useField("log.off", "Flight log", "Actual take-off (OFF, UTC)");
  const lg = useFieldGroup("log", "Flight log");
  const [picExtraRaw] = useField("fuel.picExtra", "Planned fuel", "PIC extra fuel");
  const [picOn, setPicOn] = useField("log.includePic", "Flight log", "Include PIC extra in nav log");
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

  const eto = (p: P) => {
    const m = hhmmToMin(offTime);
    const t = hhmmToMin(p.ttlt);
    if (m == null || t == null) return null;
    const v = (m + t) % 1440;
    return `${String(Math.floor(v / 60)).padStart(2, "0")}${String(v % 60).padStart(2, "0")}`;
  };

  const rows: (P | null)[] = pts.length ? pts : Array.from({ length: 8 }, () => null);
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
      <Replay className="chart-frame" mode="once" sectionId="log">{pts.length ? <Profile pts={pts} active={active} setActive={setActive} minFuel={minFuel} onKey={step} pic={pic} /> : <EmptyChart label="Profile" />}</Replay>
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
          <div className="chart-frame" style={{ padding: 0 }}>
            {pts.length ? <RouteMap pts={pts} active={active} setActive={setActive} onKey={step} /> : <EmptyChart label="Map" />}
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
              {pts.length ? "Hover the profile, map or a table row — or focus a chart and use the arrow keys." : "Waypoint details appear here once a plan is loaded."}
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
          <Act label="Actual take-off time UTC" value={off} onChange={(v) => setOff(v.replace(/\D/g, "").slice(0, 4))} w={4} placeholder={plannedOff ?? "HHMM"} />
        </label>
        <span
          className="switch-wrap"
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
              {(["ETO", "ATO"] as const).map((k) => (
                <th key={k} scope="col" className="num">
                  <Tip tip={G[k]} title={k}>
                    {k}
                  </Tip>
                </th>
              ))}
              <th scope="col" className="num delta">
                <Tip tip="ATO minus ETO, in minutes (+ late, − early)" title="Δ time">
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
                    {Array.from({ length: COLS.length + TAIL.length + 7 + (pic ? 1 : 0) }, (_, c) => (
                      <td key={c}>
                        <V v={null} w={c === 0 ? 6 : 3} />
                      </td>
                    ))}
                  </tr>
                );
              const e = eto(p);
              const atoV = lg.get(`${wkey(p)}.ato`);
              const dAto = atoV && /^\d{4}$/.test(atoV) && e ? signedMin(e, atoV) : null;
              const af = lg.get(`${wkey(p)}.afob`);
              const tf = pic ? pic.tfob(p.efob, p.pbrn) : null;
              const ref = tf ?? (p.efob ? Number(p.efob) : null);
              const dF = af && ref != null ? Number(af) - ref : null;
              const isFir = p.kind === "fir";
              return (
                <tr key={p.i} className={cx(isFir && "fir", active === p.i && "active")} onPointerEnter={() => setActive(p.i)} onPointerLeave={() => setActive(null)}>
                  <th scope="row" style={{ position: "sticky", left: 0, background: "var(--sheet)", zIndex: 1 }}>
                    <span style={{ display: "block" }}>{isFir ? `▸ ${p.name}` : p.name}</span>
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
                    const color =
                      c.k === "comp" && v ? ((signed(v) ?? 0) < 0 ? "var(--red)" : (signed(v) ?? 0) > 0 ? "var(--green)" : undefined) : undefined;
                    return (
                      <td key={c.label} className={c.num ? "num" : undefined} style={{ color }}>
                        {out ?? ""}
                      </td>
                    );
                  })}
                  <td className="num muted">{isFir ? "" : fmtHhmm(e)}</td>
                  <td className="num">
                    {!isFir && <Act label={`Actual time over ${p.name}`} value={atoV ?? ""} onChange={(v) => lg.put(`${wkey(p)}.ato`, `ATO ${p.name}`, v.replace(/\D/g, "").slice(0, 4))} w={4} />}
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
                    {!isFir && <Act label={`Actual fuel on board at ${p.name}, tonnes`} value={af ?? ""} onChange={(v) => lg.put(`${wkey(p)}.afob`, `AFOB ${p.name} (t)`, v.replace(/[^\d.]/g, ""))} w={4} inputMode="decimal" />}
                  </td>
                  <td className="num delta" style={{ color: dF != null && !Number.isNaN(dF) && Math.abs(dF) >= 0.05 ? (dF < 0 ? "var(--red)" : "var(--green)") : undefined }}>
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
        <dd>
          Actual OFF{plannedOff ? ` (or planned ${fmtHhmm(plannedOff)}Z)` : ""} + TTLT. Type ATO and AFOB as you fly; differences from plan are coloured.
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
          {plannedOff && ofp?.header.onTime ? `OFF ${fmtHhmm(plannedOff)}Z → ON ${fmtHhmm(ofp.header.onTime)}Z (${clockDiff(plannedOff, ofp.header.onTime)} min)` : ""}
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
