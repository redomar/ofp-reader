"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Brand, ThemeToggle, Toc } from "./chrome";
import { CollapseProvider } from "./collapse";
import { FormContext, OfpContext, type FormApi } from "./context";
import { PlanChips, StatusLine } from "./FlightMenu";
import { McduPrint } from "./McduSheet";
import { Field } from "./ui";
import { useSigmets } from "./useSigmets";
import { adoptFlightParam, mirrorFlightParam, useActiveFlight } from "@/lib/active";
import { getPdf } from "@/lib/pdfCache";
import { fmtDur, fmtHhmm, fmtNum, fmtSigned, hhmmToMin, isBlank, signed } from "@/lib/ofp/format";
import { components } from "@/lib/ofp/metar";
import { forecastAt, headline, parseReport, type DayTime } from "@/lib/wx/reports";
import type { KeyedRow, OFP } from "@/lib/ofp/types";

const READING = "Reading the saved plan…";
const CRIT = /\b(CLSD|CLOSED|U\/S|NOT AVBL|SUSPENDED|UNSERVICEABLE|JAMMING|SPOOFING|PROHIBITED)\b/;
const CAT_TONE = { VFR: "green", MVFR: "blue", IFR: "red", LIFR: "mag" } as const;
// The rest of the form never changes here: the page reads what you've entered elsewhere.
const noop = () => {};

/** TLR prints V-speeds ≥ 100 kt with the hundreds digit dropped. */
const vs = (v?: string) => (v ? String(Number(v) < 100 ? Number(v) + 100 : Number(v)) : "—");
const pwind = (v?: string) => {
  const m = v?.match(/^(\d{3})M(\d{2,3})$/);
  return m ? { dir: Number(m[1]), spd: Number(m[2]) } : null;
};
const clock = (min: number | null) =>
  min == null ? "—" : `${String(Math.floor((((min % 1440) + 1440) % 1440) / 60)).padStart(2, "0")}:${String(((min % 60) + 60) % 60).padStart(2, "0")}`;
/** "BIRMINGHAM" → "Birmingham". */
const titleCase = (v: string) => v.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** One labelled figure: a small label over a tabular number. `lead` makes it the card's headline figure. */
function Fig({
  k,
  v,
  unit,
  tone,
  lead,
  swatch,
}: {
  k: string;
  v: ReactNode;
  unit?: string;
  tone?: "red" | "amber" | "green";
  lead?: boolean;
  swatch?: string;
}) {
  return (
    <div className={`s-fig${tone ? ` t-${tone}` : ""}${lead ? " lead" : ""}`}>
      <span className="s-k">
        {swatch && <i className="s-sw" style={{ background: swatch }} aria-hidden="true" />}
        {k}
      </span>
      <span className="s-v">
        {v ?? "—"}
        {unit && v != null && v !== "—" && <small>{unit}</small>}
      </span>
    </div>
  );
}

/** The reader's sheet: numbered header strip, magenta corner marks. `i` is its place on the page. */
function Card({ id, title, aside, wide, i, children }: { id: string; title: string; aside?: ReactNode; wide?: boolean; i: number; children: ReactNode }) {
  return (
    <section id={id} className={`sheet s-card${wide ? " wide" : ""}`} aria-labelledby={`${id}-h`} style={{ "--i": i } as CSSProperties}>
      <h2 className="sheet-heading">
        <span className="sheet-head s-head">
          <span className="sheet-no" aria-hidden="true">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="sheet-title" id={`${id}-h`}>
            {title}
          </span>
          {aside && <span className="sheet-meta">{aside}</span>}
        </span>
      </h2>
      <div className="sheet-body">{children}</div>
    </section>
  );
}

/** A sheet that starts closed: the header's meta says what's inside. */
function Fold({ id, title, summary, i, children }: { id: string; title: string; summary: ReactNode; i: number; children: ReactNode }) {
  return (
    <details id={id} className="sheet s-card s-fold wide" style={{ "--i": i } as CSSProperties}>
      <summary className="sheet-head">
        <span className="sheet-no" aria-hidden="true">
          {String(i + 1).padStart(2, "0")}
        </span>
        <span className="sheet-title">
          {title}
          <svg className="s-chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </span>
        <span className="sheet-meta">{summary}</span>
      </summary>
      <div className="sheet-body">{children}</div>
    </details>
  );
}

/** Head- and crosswind for a runway from a TLR "086M02" wind. */
function WindLine({ rwy, wind }: { rwy?: string; wind?: string }) {
  const w = pwind(wind);
  const hdg = Number(rwy?.match(/^(\d{2})/)?.[1]) * 10;
  if (!w || !hdg) return null;
  const c = components(w.dir, w.spd, hdg);
  return (
    <p className="s-line s-wind">
      <span className="muted">
        Wind {String(w.dir).padStart(3, "0")}°/{w.spd} kt
      </span>
      <span className={`badge b-${c.head < 0 ? "red" : "ink"}`}>{c.head >= 0 ? `${c.head} kt head` : `${-c.head} kt tail`}</span>
      <span className={`badge b-${Math.abs(c.cross) > 20 ? "amber" : "ink"}`}>
        {Math.abs(c.cross)} kt cross{c.cross > 0 ? " R" : c.cross < 0 ? " L" : ""}
      </span>
    </p>
  );
}

/** A runway as its sign: black plate, white number. */
const Plate = ({ rwy }: { rwy?: string }) => (rwy ? <span className="s-plate">{rwy}</span> : null);

function Runway({ title, p, children }: { title: string; p: KeyedRow | null; children?: ReactNode }) {
  if (!p) return null;
  return (
    <div className="s-rwy">
      <p className="s-rwy-h">
        <span>
          {title} <b>{p.APT}</b>
        </span>
        <Plate rwy={p.PRWY} />
      </p>
      {children}
      <WindLine rwy={p.PRWY} wind={p.PWIND} />
    </div>
  );
}

type WxProps = { ofp: OFP; role: string; icao: string; name: string; metar: string | null; taf: string[]; at: number | null };

/** The METAR now and the TAF at `at` (minutes after 00Z on the flight date, may pass midnight). */
function wxAt({ ofp, icao, metar, taf, at }: WxProps) {
  const obs = metar ? parseReport(metar) : null;
  const day = Number(ofp.header.flightDate?.slice(0, 2)) || null;
  const when: DayTime | null = at != null && day ? { day: day + Math.floor(at / 1440), hour: Math.floor((at % 1440) / 60), min: at % 60 } : null;
  const fc = taf.length && when ? forecastAt(parseReport(`TAF ${icao} ${taf.join(" ")}`), when) : null;
  return { obs, fc };
}

type Cat = keyof typeof CAT_TONE;
const CatBadge = ({ c }: { c: Cat | null | undefined }) => (c ? <span className={`badge b-${CAT_TONE[c]}`}>{c}</span> : null);

/** One airport as the reader's folded weather card: role, ICAO, category, the METAR in words, and the forecast at your time there. */
function WxRow(p: WxProps & { forecast: boolean }) {
  const { obs, fc } = wxAt(p);
  const c = obs?.cond;
  const era = /EN-?ROUTE/i.test(p.role);
  const tone = era ? "amber" : /^DEST/i.test(p.role) && !/ALT/i.test(p.role) ? "mag" : /^DEP/i.test(p.role) ? "blue" : "ink";
  const wind = c?.wind
    ? c.wind.calm
      ? "calm"
      : `${c.wind.dir == null ? "VRB" : `${String(c.wind.dir).padStart(3, "0")}°`} ${c.wind.spd}${c.wind.gust ? `G${c.wind.gust}` : ""} kt`
    : null;
  const vis = c?.visM != null ? `vis ${c.visM >= 10000 ? "≥10 km" : `${c.visM} m`}` : null;
  return (
    <article className="wx-card is-folded s-wxrow" aria-label={`${p.role} ${p.icao} weather`}>
      <header>
        <span className={`badge b-${tone}`}>{era ? "Fuel en-route alternate" : p.role}</span>
        <h3>{p.icao}</h3>
        <span className="small muted">{p.name}</span>
        <span className="s-wx-cat">
          <CatBadge c={c?.category} />
        </span>
        <span className="wx-fold-summary">
          {c ? [headline(c), wind, vis, c.qnh != null ? `Q${c.qnh}` : null].filter(Boolean).join(" · ") : "No METAR in the plan"}
        </span>
        {p.forecast && fc && (
          <span className="wx-fold-summary s-wx-fc">
            <b>{clock(p.at)}Z</b> {headline(fc.worst)} <CatBadge c={fc.worst.category} />
            {fc.temporary.length > 0 && <span className="muted"> incl. TEMPO / PROB</span>}
          </span>
        )}
      </header>
    </article>
  );
}

function Body({ ofp, pic }: { ofp: OFP; pic: number }) {
  const h = ofp.header;
  const u = h.unit === "LBS" ? "lb" : "kg";
  const { list: sigmets } = useSigmets();
  const fuel = (label: string) => ofp.fuel.rows.find((r) => r.label.startsWith(label));
  const f = (label: string) => fuel(label)?.fuel ?? null;
  const n = (v: number | null) => fmtNum(v);

  const extra = (f("EXTRA") ?? 0) + pic;
  const block = (f("BLOCK") ?? 0) + pic;
  const landing = block - (f("TAXI") ?? 0) - (f("TRIP") ?? 0);
  const needed = (f("ALTN") ?? 0) + (f("FINRES") ?? 0);
  const margin = landing - needed;
  // Block fuel as one bar, in the order it's burnt or kept
  const parts = [
    ["Taxi", f("TAXI"), "var(--sunk)"],
    ["Trip", f("TRIP"), "var(--magenta)"],
    ["Contingency", f("CONT"), "var(--amber-bg)"],
    ["Alternate", f("ALTN"), "var(--blue)"],
    ["Final reserve", f("FINRES"), "var(--red)"],
    ["Extra", extra, "var(--green)"],
  ] as const;

  const off = hhmmToMin(h.offTime);
  const on = hhmmToMin(h.onTime);
  const onAbs = off != null && on != null ? (on < off ? on + 1440 : on) : on;
  const span = (a: string | null, b: string | null) => {
    const x = hhmmToMin(a);
    const y = hhmmToMin(b);
    return x != null && y != null ? (y - x + 1440) % 1440 : null;
  };
  const crz = h.flSteps[0]?.fl ? `FL${Number(h.flSteps[0].fl)}` : null;
  const steps = h.flSteps.slice(1);
  const aptName = (icao: string | null) => {
    const a = ofp.wx.airports.find((x) => x.icao === icao);
    return a ? titleCase(a.name) : null;
  };
  const wc = signed(h.avgWc);
  const isa = signed(h.avgIsa);
  const rmks = h.dispRmks.filter((r) => !/^NIL$/i.test(r.trim()));
  const none = <span className="s-none">None</span>;

  const weight = (k: string, est: number | null, max: number | null, add = 0) => {
    const e = est != null ? est + add : null;
    const pct = e != null && max ? (e / max) * 100 : null;
    const cls = pct == null ? "" : pct >= 100 ? " bad" : pct >= 95 ? " warn" : "";
    return (
      <div className={`s-wt${cls}`}>
        <p className="s-wt-top">
          <span className="field-label">{k}</span>
          <b>{n(e) ?? "—"}</b>
          <span className="muted">/ {n(max) ?? "—"}</span>
          <span className="s-pct">{pct != null ? `${pct.toFixed(1)}%` : ""}</span>
        </p>
        <div className="gauge-track" role="meter" aria-label={`${k} against maximum`} aria-valuemin={0} aria-valuemax={max ?? 100} aria-valuenow={e ?? 0}>
          <span className={`gauge-fill${cls}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
        </div>
        {e != null && max != null && (
          <p className="s-wt-left">
            {n(Math.abs(max - e))} {max - e >= 0 ? "below max" : "over max"}
          </p>
        )}
      </div>
    );
  };

  const to = ofp.tlr.takeoff.planned;
  const ld = ofp.tlr.landing.planned;

  // Time at each airport: departure at take-off, destination and alternates at landing.
  const atFor = (role: string) => (/DEP|ORIG/i.test(role) ? off : onAbs);

  const allCrit = [ofp.notams, ofp.companyNotams].flatMap((b) =>
    b.groups.flatMap((g) => g.notams.filter((x) => CRIT.test(x.lines.join(" "))).map((x) => ({ loc: g.location ?? "", id: x.id, text: x.lines.join(" ") }))),
  );
  // Only departure and destination here; alternates and FIRs stay in the full reader.
  const ends = [h.dep, h.arr].filter((x): x is string => !!x);
  const crit = allCrit.filter((x) => ends.some((e) => x.loc.startsWith(e)));
  const moreCrit = allCrit.length - crit.length;
  const onRoute = sigmets.filter((x) => x.impact.verdict === "affects");
  const alerts = crit.length + onRoute.length;

  // Departure, destination and the planned alternate in full; other airports as one line each.
  const seen = new Set<string>();
  const airports = ofp.wx.airports.filter((a) => !seen.has(a.icao) && !!seen.add(a.icao));
  const mainWx = airports.filter((a) => [h.dep, h.arr, h.altn].includes(a.icao));
  const otherWx = airports.filter((a) => !mainWx.includes(a));

  const wpts = ofp.log.filter((p) => p.kind === "wpt");
  // Three blocks that read top to bottom (side by side on wide screens, stacked on phones).
  const per = Math.ceil(wpts.length / (wpts.length > 12 ? 3 : 1));
  const blocks = Array.from({ length: Math.ceil(wpts.length / per) }, (_, i) => wpts.slice(i * per, i * per + per));
  const etoOf = (ident: string) => {
    const t = hhmmToMin(wpts.find((p) => (p.ident ?? p.position)?.replace(/\s/g, "") === ident)?.ttlt);
    return off != null && t != null ? clock(off + t) : null;
  };
  const toc = etoOf("TOC");
  const tod = etoOf("TOD");

  return (
    <div className="simple">
      <Card
        id="flight"
        title="Flight"
        wide
        i={0}
        aside={
          <span className="s-mcdu">
            <McduPrint />
          </span>
        }
      >
        <div className="idbar">
          {(
            [
              ["FLT", h.flightNo],
              ["ATC C/S", h.atcCallsign],
              ["Date", h.date],
              ["Reg", h.reg],
              ["Type", h.acType],
              ["OFP", h.ofpNo],
            ] as const
          ).map(([k, v]) =>
            v ? (
              <span key={k}>
                <span className="k">{k}</span>
                {v}
              </span>
            ) : null,
          )}
        </div>
        <div className="fields s-vital">
          <Field label="Route" sub={[aptName(h.dep), aptName(h.arr)].filter(Boolean).join(" → ")}>
            {h.dep} → {h.arr}
          </Field>
          <Field label="Take-off" sub={h.outTime ? `OUT ${fmtHhmm(h.outTime)}Z` : null}>
            {fmtHhmm(h.offTime) ?? "—"}Z
          </Field>
          <Field label="Landing" sub={h.inTime ? `IN ${fmtHhmm(h.inTime)}Z` : null}>
            {fmtHhmm(h.onTime) ?? "—"}Z
          </Field>
          <Field label="Air time" sub={`block ${fmtDur(span(h.outTime, h.inTime)) ?? "—"}`}>
            {fmtDur(span(h.offTime, h.onTime)) ?? "—"}
          </Field>
          <Field label="Cruise" sub={h.costIndex ? `CI ${h.costIndex}` : null}>
            {crz ?? "—"}
          </Field>
          <Field label="Step climb">
            {steps.length ? (
              <span className="row" style={{ gap: 6 }}>
                {steps.map((x, k) => (
                  <span key={k} className="badge b-mag">
                    FL{Number(x.fl)} at {x.fix}
                  </span>
                ))}
              </span>
            ) : (
              none
            )}
          </Field>
          <Field label="Distance" sub={wc != null ? (wc < 0 ? `${Math.abs(wc)} kt headwind` : wc > 0 ? `${wc} kt tailwind` : "calm") : null}>
            {n(h.gndDist) ?? "—"} NM
          </Field>
          <Field label="Avg ISA">{isa != null ? fmtSigned(isa, " °C") : "—"}</Field>
          <Field label="Alternate" sub={aptName(h.altn)}>
            {h.altn ?? none}
          </Field>
          <Field label="Take-off altn">{isBlank(h.tkofAltn) ? none : h.tkofAltn}</Field>
          <Field label="CTOT">{isBlank(h.ctot) ? none : `${fmtHhmm(h.ctot)}Z`}</Field>
          <Field label="MEL items">{ofp.mel.length ? <span className="badge b-amber">{ofp.mel.length}</span> : none}</Field>
          {rmks.length > 0 && (
            <Field label="Dispatcher remarks" className="s-span">
              {rmks.join(" ")}
            </Field>
          )}
        </div>
      </Card>

      <Card id="fuel" title="Fuel" aside={u} i={1}>
        <div className="s-lead-row">
          <Fig k="Block" v={n(block)} unit={u} lead />
          <span className={`s-pill ${margin < 0 ? "t-red" : margin < (f("CONT") ?? 0) ? "t-amber" : "t-green"}`}>
            <b>
              {margin >= 0 ? "+" : "−"}
              {n(Math.abs(margin))}
            </b>{" "}
            above ALTN + FINRES
          </span>
        </div>
        <div className="s-bar" role="img" aria-label="Block fuel make-up">
          {parts.map(([k, v, c]) => (v ? <i key={k} style={{ flexGrow: v, background: c }} title={`${k} ${n(v)}`} /> : null))}
        </div>
        <div className="s-figs">
          {parts.map(([k, v, c]) => (
            <Fig key={k} k={k} v={n(v)} swatch={c} />
          ))}
        </div>
        <div className="s-foot">
          <span>
            Landing fuel <b>{n(landing)}</b>
          </span>
          {pic > 0 && (
            <span>
              incl. PIC extra <b>{n(pic)}</b>
            </span>
          )}
        </div>
      </Card>

      <Card id="weights" title="Weights" aside={`${u} · estimated / max`} i={2}>
        <div className="s-wts">
          {weight("TOW", h.estTow, h.maxTow, pic)}
          {weight("LAW", h.estLaw, h.maxLaw)}
          {weight("ZFW", h.estZfw, h.maxZfw)}
        </div>
      </Card>

      <Card id="runways" title="Runways" i={3}>
        <Runway title="Take-off" p={to}>
          <div className="vspeeds s-vs" role="group" aria-label="Planned V-speeds">
            {(["V1", "VR", "V2"] as const).map((k) => (
              <div className="vspeed" key={k}>
                <span className="k">{k}</span>
                <span className="val">{vs(to?.[k])}</span>
              </div>
            ))}
          </div>
          <div className="s-figs s-tight">
            <Fig k="Flaps" v={to?.FLP} />
            <Fig k="FLEX" v={to?.MT} unit="°C" />
            <Fig k="QNH" v={to?.PQNH} />
          </div>
          {ofp.tlr.takeoff.rmks
            .filter((r) => !/^NONE$/i.test(r))
            .map((r) => (
              <p key={r} className="s-note">
                {r}
              </p>
            ))}
        </Runway>
        <Runway title="Landing" p={ld}>
          <div className="s-figs s-tight">
            <Fig k="Flaps" v={ld?.FLP} />
            <Fig k="QNH" v={ld?.PQNH} />
            <Fig k="Weight" v={n(Number(ld?.PLDW) * 10 || null)} />
          </div>
        </Runway>
        {!to && !ld && <p className="s-line muted">No runway analysis in this plan</p>}
      </Card>

      <Card id="weather" title="Weather" aside="now and at your time there" wide i={4}>
        <div className="s-wxs">
          {[...mainWx, ...otherWx].map((a) => (
            <WxRow
              key={a.icao}
              ofp={ofp}
              role={a.role}
              icao={a.icao}
              name={a.name}
              metar={a.metar}
              taf={a.taf}
              at={atFor(a.role)}
              forecast={mainWx.includes(a)}
            />
          ))}
        </div>
      </Card>

      <Fold
        id="alerts"
        title="Watch out for"
        i={5}
        summary={
          alerts ? (
            <>
              {crit.length > 0 && <span className="badge b-red">{crit.length} NOTAM</span>}
              {onRoute.length > 0 && <span className="badge b-amber">{onRoute.length} SIGMET</span>}
            </>
          ) : (
            <span className="badge b-green">All clear</span>
          )
        }
      >
        {alerts === 0 ? (
          <p className="s-line muted">No critical NOTAMs at {ends.join(" or ")} and no SIGMETs on your route.</p>
        ) : (
          <ul className="s-alerts">
            {onRoute.map(({ s, impact }) => (
              <li key={s.id} className={s.phenomenon?.severity === "sev" ? "sev" : "mod"}>
                <b>{s.kind}</b> {s.phenomenon?.text ?? "Weather"}
                {impact.from && impact.to && (
                  <span className="muted">
                    {" "}
                    · {impact.from.name} → {impact.to.name}
                  </span>
                )}
                {s.firName && <span className="muted"> · {s.firName}</span>}
              </li>
            ))}
            {crit.map((x) => (
              <li key={`${x.loc}-${x.id}`} className="sev">
                <b>{x.loc}</b> {x.text}
              </li>
            ))}
          </ul>
        )}
        {moreCrit > 0 && (
          <p className="s-line muted">
            {moreCrit} more critical NOTAM{moreCrit === 1 ? "" : "s"} at alternates and en route: see NOTAM in the full reader.
          </p>
        )}
      </Fold>

      <Fold
        id="route"
        title="Route"
        i={6}
        summary={
          <>
            {wpts.length} fixes{toc && <> · TOC {toc}</>}
            {tod && <> · TOD {tod}</>}
          </>
        }
      >
        {ofp.route && <p className="s-raw">{ofp.route}</p>}
        <div className="s-logs">
          {blocks.map((b, bi) => (
            <div key={bi} className="s-log" role="table" aria-label={`Waypoints ${bi * per + 1}–${bi * per + b.length}`}>
              <div role="row" className="s-log-h">
                <span role="columnheader">Fix</span>
                <span role="columnheader">Via</span>
                <span role="columnheader">FL</span>
                <span role="columnheader">ETO</span>
                <span role="columnheader">EFOB</span>
              </div>
              {b.map((p, i) => {
                const t = hhmmToMin(p.ttlt);
                const mark = /^T ?O ?[CD]$/.test(p.ident ?? p.position ?? "");
                return (
                  <div role="row" key={i} className={mark ? "mark" : undefined}>
                    <span role="cell">
                      <b>{p.ident ?? p.position}</b>
                    </span>
                    <span role="cell">{p.awy}</span>
                    <span role="cell">{p.fl}</span>
                    <span role="cell">{off != null && t != null ? clock(off + t) : "—"}</span>
                    <span role="cell">{p.efob}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Fold>
    </div>
  );
}

/** A one-page, read-only summary of the active flight: the numbers you need, nothing else. */
export function SimpleApp() {
  const { id: flightId, record, ready } = useActiveFlight();
  const [ofp, setOfp] = useState<OFP | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(adoptFlightParam);
  }, []);
  useEffect(() => {
    if (flightId) mirrorFlightParam(flightId);
  }, [flightId]);

  useEffect(() => {
    if (!flightId) return;
    let live = true;
    (async () => {
      setOfp(null);
      setMsg(READING);
      const data = await getPdf(flightId);
      if (!data) return live && setMsg("This flight has no saved PDF: open it in the reader first.");
      const { readOfp } = await import("@/lib/ofp/pdf");
      const { ofp: o } = await readOfp(data, record?.meta.source ?? "plan.pdf");
      if (live) {
        setOfp(o);
        setMsg(null);
      }
    })().catch(() => live && setMsg("Couldn't read the saved plan."));
    return () => {
      live = false;
    };
    // the PDF only changes with the flight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightId]);

  // What you've entered in the reader (PIC extra, actual runway, OFF time) carries into the MCDU sheet and SIGMET timing.
  const form = useMemo<FormApi>(() => ({ values: record?.fields ?? {}, set: noop }), [record]);
  const ctx = useMemo(() => ({ ofp, doc: null }), [ofp]);
  const pic = Number(record?.fields["fuel.picExtra"]?.value) || 0;
  const planHref = flightId ? `/?flight=${encodeURIComponent(flightId)}` : "/";
  const shown = flightId ? ofp : null;

  return (
    <OfpContext.Provider value={ctx}>
      <FormContext.Provider value={form}>
        <CollapseProvider>
          <a href="#main" className="skip">
            Skip to flight summary
          </a>
          <header className="topbar">
            <div className="topbar-inner">
              <Brand sub="· Simple" />
              <span style={{ flex: 1 }} />
              <Link href={planHref} className="btn">
                Full reader →
              </Link>
              <ThemeToggle />
            </div>
            <StatusLine>
              <PlanChips />
              <span className="examples-sep" aria-hidden="true" />
              <span role="status">
                {flightId ? (msg ?? "Read-only: the essentials of this plan on one page") : "No plan open: pick a flight or open one in the reader"}
              </span>
            </StatusLine>
          </header>
          <div className="layout">
            <Toc
              sections={[]}
              pending
              links={
                flightId
                  ? { plan: planHref, radio: `/radio?flight=${encodeURIComponent(flightId)}`, simple: `/simple?flight=${encodeURIComponent(flightId)}` }
                  : undefined
              }
            />
            <main id="main" aria-busy={!ready || msg === READING}>
              {shown && <Body ofp={shown} pic={pic} />}
            </main>
          </div>
        </CollapseProvider>
      </FormContext.Provider>
    </OfpContext.Provider>
  );
}
