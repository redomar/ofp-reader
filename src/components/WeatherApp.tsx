"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Brand, ThemeToggle, Toc } from "./chrome";
import { CollapseAllButton, CollapseProvider } from "./collapse";
import { TooltipLayer } from "./TooltipLayer";
import { Badge, Section, Tip, cx } from "./ui";
import { WindArrow } from "./WindArrow";
import { CATEGORY_TIP, decodeToken, type Category } from "@/lib/ofp/metar";
import { getServerVersion, getVersion, listFlights, subscribe } from "@/lib/storage";
import { getPdf } from "@/lib/pdfCache";
import {
  ageMinutes,
  headline,
  hoursFrom,
  parseAll,
  skyOf,
  wxWords,
  type Conditions,
  type DayTime,
  type Report,
  type Sky,
  type TafGroup,
} from "@/lib/wx/reports";

const INPUT_KEY = "ofp-reader:wx-input";

const CAT_TONE: Record<Category, "green" | "blue" | "red" | "mag"> = { VFR: "green", MVFR: "blue", IFR: "red", LIFR: "mag" };
const CAT_VAR: Record<Category, string> = { VFR: "var(--green)", MVFR: "var(--blue)", IFR: "var(--red)", LIFR: "var(--magenta)" };

/**
 * Illustrative reports for trying the page; not real observations. Times are stamped
 * relative to now so the "minutes ago" readouts make sense.
 */
function buildExample(now = new Date()) {
  const at = (minAgo: number) => {
    const d = new Date(now.getTime() - minAgo * 60000);
    const p = (n: number) => String(n).padStart(2, "0");
    return { dd: p(d.getUTCDate()), hh: p(d.getUTCHours()), mm: p(d.getUTCMinutes()), d };
  };
  const p = (n: number) => String(n).padStart(2, "0");
  const obs = at(20);
  const iss = at(110);
  const from = at(-40); // validity starts at the next hour-ish
  const vFrom = `${from.dd}${from.hh}`;
  const end = new Date(from.d.getTime() + 30 * 3600e3);
  const vTo = `${p(end.getUTCDate())}${p(end.getUTCHours())}`;
  const h = (add: number) => {
    const d = new Date(from.d.getTime() + add * 3600e3);
    return `${p(d.getUTCDate())}${p(d.getUTCHours())}`;
  };
  return `METAR EGLL ${obs.dd}${obs.hh}${obs.mm}Z 24012G24KT 210V280 9999 -SHRA FEW014 BKN032CB 15/09 Q1013 TEMPO 4000 SHRA
TAF EGLL ${iss.dd}${iss.hh}${iss.mm}Z ${vFrom}/${vTo} 24012KT 9999 SCT030
  TEMPO ${h(0)}/${h(6)} 24018G30KT 4000 SHRA BKN014CB
  BECMG ${h(8)}/${h(11)} 27008KT
  PROB30 TEMPO ${h(12)}/${h(18)} 2500 BR BKN006
EGLL ARR ATIS F ${obs.hh}${obs.mm}Z EXP ILS APCH RWY 27L 24012G24KT 9999 -SHRA FEW014 BKN032CB 15/09 Q1013 TL 70

METAR LFPG ${obs.dd}${obs.hh}${obs.mm}Z VRB02KT 0300 FG VV001 08/08 Q1021 NOSIG
TAF LFPG ${iss.dd}${iss.hh}${iss.mm}Z ${vFrom}/${vTo} VRB03KT 0400 FG VV002 BECMG ${h(1)}/${h(3)} 4000 BR BKN005 FM${h(6)}00 21010KT 9999 SCT025

THIS IS SCHIPHOL INFORMATION ROMEO, TIME ${obs.hh}${obs.mm}. LANDING RUNWAY 18 RIGHT, TAKE-OFF RUNWAY 24. TRANSITION LEVEL 60. SURFACE WIND 220 DEGREES 15 KNOTS, GUSTING 27 KNOTS. VISIBILITY 10 KILOMETRES. LIGHT RAIN. SCATTERED 1800 FEET, BROKEN 3500 FEET. TEMPERATURE 13, DEW POINT 10. QNH 1009. ACKNOWLEDGE INFORMATION ROMEO.

METAR KJFK ${obs.dd}${obs.hh}${obs.mm}Z 31022G35KT 10SM FEW050 SCT250 18/02 A2995`;
}

/* ---------- small visuals ---------- */

function SkyIcon({ sky, size = 56 }: { sky: Sky; size?: number }) {
  const sun = (cx: number, cy: number, r: number) => (
    <g className="sky-sun">
      <circle cx={cx} cy={cy} r={r} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1={cx + Math.cos(a) * (r + 3)} y1={cy + Math.sin(a) * (r + 3)} x2={cx + Math.cos(a) * (r + 7)} y2={cy + Math.sin(a) * (r + 7)} />;
      })}
    </g>
  );
  const cloud = (x: number, y: number, s: number, cls = "sky-cloud") => (
    <path className={cls} transform={`translate(${x} ${y}) scale(${s})`} d="M6 22 a8 8 0 0 1 1-16 a10 10 0 0 1 19 2 a7 7 0 0 1 2 14 Z" />
  );
  const label: Record<Sky, string> = {
    thunder: "Thunderstorm",
    snow: "Snow",
    rain: "Rain",
    fog: "Fog or mist",
    overcast: "Overcast",
    cloudy: "Broken cloud",
    partly: "Some cloud",
    clear: "Clear",
    unknown: "No sky information",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={label[sky]} className="sky">
      {sky === "clear" && sun(24, 24, 9)}
      {sky === "partly" && (
        <>
          {sun(17, 17, 7)}
          {cloud(12, 18, 1)}
        </>
      )}
      {sky === "cloudy" && (
        <>
          {cloud(4, 8, 0.8, "sky-cloud back")}
          {cloud(12, 16, 1)}
        </>
      )}
      {sky === "overcast" && (
        <>
          {cloud(2, 6, 0.9, "sky-cloud back")}
          {cloud(14, 8, 0.9, "sky-cloud back")}
          {cloud(8, 16, 1.05)}
        </>
      )}
      {(sky === "rain" || sky === "snow" || sky === "thunder") && (
        <>
          {cloud(6, 2, 1.15, sky === "thunder" ? "sky-cloud dark" : "sky-cloud")}
          {sky === "rain" && [14, 22, 30].map((x, i) => <line key={i} className="sky-rain" x1={x} y1={33} x2={x - 3} y2={42} />)}
          {sky === "snow" && [14, 23, 32].map((x, i) => <circle key={i} className="sky-snow" cx={x} cy={37 + (i % 2) * 4} r={1.8} />)}
          {sky === "thunder" && <path className="sky-bolt" d="M24 30 L19 39 L24 39 L21 47 L30 36 L25 36 L28 30 Z" />}
        </>
      )}
      {sky === "fog" && [14, 22, 30, 38].map((y, i) => <line key={i} className="sky-fog" x1={6 + (i % 2) * 4} y1={y} x2={42 - (i % 2) * 4} y2={y} />)}
      {sky === "unknown" && <text x="24" y="30" textAnchor="middle" className="sky-q">?</text>}
    </svg>
  );
}

const OKTAS = { FEW: 0.25, SCT: 0.5, BKN: 0.8, OVC: 1, VV: 1 } as const;

/** Cloud layers drawn at their heights, width by coverage. */
function CloudColumn({ c }: { c: Conditions }) {
  const top = Math.max(5000, ...c.clouds.map((l) => (l.baseFt ?? 0) + 1000));
  const H = 96;
  const y = (ft: number) => H - 10 - (ft / top) * (H - 18);
  return (
    <svg viewBox={`0 0 120 ${H}`} className="cloud-col" role="img" aria-label={c.clouds.length ? `Cloud: ${c.clouds.map((l) => `${l.cover} ${l.baseFt ?? "?"} ft${l.type ? ` ${l.type}` : ""}`).join(", ")}` : c.cavok ? "No cloud below 5000 ft (CAVOK)" : "No cloud reported"}>
      <line x1="30" x2="118" y1={H - 10} y2={H - 10} className="cc-ground" />
      {[0, top / 2, top].map((ft) => (
        <text key={ft} x="26" y={y(ft) + 3} textAnchor="end" className="cc-axis">
          {ft >= 1000 ? `${Math.round(ft / 100) / 10}k` : ft}
        </text>
      ))}
      {c.clouds.map((l, i) => {
        const w = 84 * OKTAS[l.cover];
        const yy = y(l.baseFt ?? 0);
        return (
          <g key={i}>
            <rect x={32} y={yy - 7} width={w} height={7} rx={3.5} className={cx("cc-layer", l.type === "CB" && "cb", l.type === "TCU" && "tcu", (l.cover === "BKN" || l.cover === "OVC" || l.cover === "VV") && "ceil")} />
            <text x={34} y={yy - 9} className="cc-label">
              {l.cover}
              {l.baseFt != null ? ` ${l.baseFt.toLocaleString("en-GB")}` : ""}
              {l.type ? ` ${l.type}` : ""}
            </text>
          </g>
        );
      })}
      {!c.clouds.length && (
        <text x="74" y={H / 2} textAnchor="middle" className="cc-none">
          {c.cavok ? "CAVOK" : c.noCloud ?? "no cloud"}
        </text>
      )}
    </svg>
  );
}

/** Visibility on a 0–10 km scale with the flight-category bands. */
function VisBar({ visM }: { visM: number | null }) {
  const pct = (m: number) => Math.min(100, (m / 10000) * 100);
  return (
    <div className="vis-bar" role="img" aria-label={visM == null ? "Visibility not reported" : `Visibility ${visM >= 10000 ? "10 km or more" : `${visM} m`}`}>
      <span className="vb-band lifr" style={{ width: `${pct(1600)}%` }} />
      <span className="vb-band ifr" style={{ left: `${pct(1600)}%`, width: `${pct(4800) - pct(1600)}%` }} />
      <span className="vb-band mvfr" style={{ left: `${pct(4800)}%`, width: `${pct(8000) - pct(4800)}%` }} />
      <span className="vb-band vfr" style={{ left: `${pct(8000)}%`, width: `${100 - pct(8000)}%` }} />
      {visM != null && <span className="vb-mark" style={{ left: `${pct(visM)}%` }} />}
    </div>
  );
}

function Tokens({ text, taf }: { text: string; taf?: boolean }) {
  return (
    <span>
      {text
        .split(/\s+/)
        .filter(Boolean)
        .map((t, i) => {
          const d = decodeToken(t, taf);
          return (
            <span key={i}>
              {d.tip ? (
                <span className="tok" data-k={d.kind} data-tip={d.tip} data-tip-title={t}>
                  {t}
                </span>
              ) : (
                <span className="tok">{t}</span>
              )}{" "}
            </span>
          );
        })}
    </span>
  );
}

const fmtTime = (t: DayTime | null) => (t ? `${String(t.hour).padStart(2, "0")}${String(t.min).padStart(2, "0")}Z` : "—");
const fmtAge = (min: number) => (min < 0 ? "in the future?" : min < 60 ? `${min} min ago` : min < 48 * 60 ? `${Math.floor(min / 60)} h ${min % 60} min ago` : `${Math.round(min / 1440)} days ago`);

function windText(c: Conditions) {
  const w = c.wind;
  if (!w) return "—";
  if (w.calm) return "Calm";
  return `${w.dir == null ? "VRB" : `${String(w.dir).padStart(3, "0")}°`} ${w.spd}${w.gust ? `G${w.gust}` : ""} kt${w.sector ? ` (${w.sector[0]}–${w.sector[1]}°)` : ""}`;
}

/** The facts strip shared by METAR, ATIS and TAF groups. */
function Facts({ c, kind }: { c: Conditions; kind: "METAR" | "PWIND" }) {
  const w = c.wind;
  const spread = c.temp != null && c.dew != null ? c.temp - c.dew : null;
  return (
    <div className="wxc-facts">
      <div className="wxc-fact">
        <span className="field-label">Wind</span>
        <span className="wxc-big">
          {w && w.dir != null && !w.calm && <WindArrow kind={kind === "PWIND" ? "PWIND" : "METAR"} dir={w.dir} spd={w.spd} gust={w.gust} sector={w.sector} size={22} label={`Wind from ${w.dir} degrees at ${w.spd} knots${w.gust ? `, gusting ${w.gust}` : ""}`} />}
          {windText({ ...c, wind: w ? { ...w, sector: null } : null })}
        </span>
        {w?.sector && (
          <span className="small muted">
            varying {String(w.sector[0]).padStart(3, "0")}–{String(w.sector[1]).padStart(3, "0")}°
          </span>
        )}
      </div>
      <div className="wxc-fact">
        <span className="field-label">Visibility</span>
        <span className="wxc-big">{c.visM == null ? "—" : c.visM >= 10000 ? "≥ 10 km" : c.visM >= 5000 ? `${(c.visM / 1000).toFixed(0)} km` : `${c.visM.toLocaleString("en-GB")} m`}</span>
        <VisBar visM={c.visM} />
      </div>
      <div className="wxc-fact">
        <span className="field-label">Temp / dew</span>
        <span className="wxc-big">{c.temp != null ? `${c.temp}° / ${c.dew ?? "—"}°` : "—"}</span>
        {spread != null && (
          <span className="small muted">
            spread {spread}°{" "}
            {spread <= 2 && (
              <Badge tone="amber" tip="Temperature/dew-point spread ≤ 2 °C: fog or low cloud possible">
                fog risk
              </Badge>
            )}
          </span>
        )}
      </div>
      <div className="wxc-fact">
        <span className="field-label">QNH</span>
        <span className="wxc-big">{c.qnh != null ? `${c.qnh} hPa` : "—"}</span>
        {c.qnh != null && <span className="small muted">{(c.qnh * 0.02953).toFixed(2)} inHg</span>}
      </div>
    </div>
  );
}

function CatBadge({ cat }: { cat: Category | null }) {
  return cat ? (
    <Badge tone={CAT_TONE[cat]} tip={CATEGORY_TIP[cat]}>
      {cat}
    </Badge>
  ) : null;
}

/* ---------- cards ---------- */

function ObsCard({ r }: { r: Report }) {
  const c = r.cond;
  const age = r.time ? ageMinutes(r.time) : null;
  const a = r.atis;
  return (
    <article className={cx("wxc", `wxc-${r.kind.toLowerCase()}`)} style={c.category ? { ["--catc" as string]: CAT_VAR[c.category] } : undefined}>
      <header className="wxc-head">
        <Badge tone={r.kind === "ATIS" ? "mag" : r.kind === "SPECI" ? "amber" : "ink"} tip={r.kind === "ATIS" ? "Automatic Terminal Information Service" : r.kind === "SPECI" ? "Special observation, issued when conditions change significantly" : "Routine aerodrome observation"}>
          {r.kind}
          {a?.kind ? ` ${a.kind}` : ""}
        </Badge>
        {a?.letter && (
          <span className="atis-letter" title={`Information ${a.letter}`}>
            {a.letter}
          </span>
        )}
        <span className="wxc-time">
          {fmtTime(r.time)}
          {age != null && <span className="muted"> · {fmtAge(age)}</span>}
        </span>
        <span style={{ marginLeft: "auto" }}>
          <CatBadge cat={c.category} />
        </span>
      </header>
      <div className="wxc-hero">
        <SkyIcon sky={skyOf(c)} />
        <div>
          <p className="wxc-headline">{headline(c)}</p>
          {r.trend && (
            <p className="small" style={{ margin: "0 0 6px" }}>
              <span className="field-label" style={{ display: "inline", marginRight: 6 }}>
                Trend
              </span>
              {r.trend === "NOSIG" ? "No significant change in the next 2 h" : <Tokens text={r.trend} taf />}
            </p>
          )}
          {c.wx.length > 0 && (
            <div className="row" style={{ gap: 4 }}>
              {c.wx.map((w) => (
                <Badge key={w} tone={/TS|\+|FZ|GR/.test(w) ? "red" : "amber"}>
                  {wxWords(w)}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <CloudColumn c={c} />
      </div>
      {a && (a.runways.length > 0 || a.approach || a.transitionLevel) && (
        <div className="row atis-ops">
          {a.runways.map((rw) => (
            <span key={rw.rwy + rw.use} className="code" title={rw.use ? `Runway for ${rw.use}` : "Runway in use"}>
              {rw.use === "landing" ? "LDG " : rw.use === "take-off" ? "T/O " : ""}RWY {rw.rwy}
            </span>
          ))}
          {a.approach && <Badge tone="blue">{a.approach} approach</Badge>}
          {a.transitionLevel && <Badge tone="ink" tip="Transition level">TL FL{a.transitionLevel.padStart(3, "0")}</Badge>}
          {a.plain && <span className="small muted">read from plain-language ATIS</span>}
        </div>
      )}
      <Facts c={c} kind="METAR" />
      <details className="wxc-raw" open={r.kind !== "ATIS" || !a?.plain}>
        <summary>Raw {r.kind}</summary>
        {r.kind === "ATIS" && a?.plain ? <p className="pre small">{r.raw}</p> : <Tokens text={r.raw} />}
      </details>
    </article>
  );
}

const GROUP_TIP: Record<TafGroup["type"], string> = {
  BASE: "Prevailing conditions at the start of the forecast",
  FM: "From this time, conditions change completely to",
  BECMG: "Becoming: a permanent change during the period",
  TEMPO: "Temporary fluctuations, each under an hour, in total under half the period",
  PROB: "Probability of these conditions during the period",
};

function TafCard({ r }: { r: Report }) {
  const t = r.taf!;
  const valid = t.valid;
  const span = valid ? Math.max(1, hoursFrom(valid.from, valid.to)) : 24;
  const x = (d: DayTime | null, fallback: number) => (valid && d ? Math.min(100, Math.max(0, (hoursFrom(valid.from, d) / span) * 100)) : fallback);

  // Prevailing bands: BASE / FM replace, BECMG applies from the start of its period.
  const prevailing = t.groups.filter((g) => g.type === "BASE" || g.type === "FM" || g.type === "BECMG");
  const bands = prevailing.flatMap((g, k) => {
    const next = prevailing[k + 1];
    const from = x(g.type === "BASE" ? valid?.from ?? null : g.from, 0);
    const to = next ? x(next.from, 100) : 100;
    if (g.type !== "BECMG" || !g.to) return [{ g, from, to, changing: false }];
    // Hatched while the change happens, solid once it has.
    const done = Math.min(to, x(g.to, to));
    return [
      { g, from, to: done, changing: true },
      { g, from: done, to, changing: false },
    ];
  });
  const overlays = t.groups.filter((g) => g.type === "TEMPO" || g.type === "PROB");
  const worst = t.groups.map((g) => g.cond.category).filter(Boolean) as Category[];
  const order: Category[] = ["VFR", "MVFR", "IFR", "LIFR"];
  const worstCat = worst.sort((a, b) => order.indexOf(b) - order.indexOf(a))[0] ?? null;
  const ticks: number[] = [];
  if (valid) for (let h = 0; h <= span; h += span > 12 ? 3 : 1) ticks.push(h);
  const age = r.time ? ageMinutes(r.time) : null;

  return (
    <article className="wxc wxc-taf">
      <header className="wxc-head">
        <Badge tone="blue" tip="Terminal aerodrome forecast">
          TAF
        </Badge>
        <span className="wxc-time">
          issued {fmtTime(r.time)}
          {age != null && <span className="muted"> · {fmtAge(age)}</span>}
          {valid && (
            <span className="muted">
              {" "}
              · valid {String(valid.from.day).padStart(2, "0")} {String(valid.from.hour).padStart(2, "0")}Z → {String(valid.to.day).padStart(2, "0")} {String(valid.to.hour).padStart(2, "0")}Z
            </span>
          )}
        </span>
        <span style={{ marginLeft: "auto" }} className="row">
          {worstCat && (
            <>
              <span className="small muted">worst</span>
              <CatBadge cat={worstCat} />
            </>
          )}
        </span>
      </header>

      {valid && (
        <div className="taf-tl" role="img" aria-label="Forecast timeline coloured by flight category">
          <div className="taf-row">
            {bands.map(({ g, from, to, changing }, k) => (
              <span
                key={k}
                className={cx("taf-band", changing && "becmg")}
                style={{ left: `${from}%`, width: `${Math.max(0.5, to - from)}%`, background: g.cond.category ? CAT_VAR[g.cond.category] : "var(--rule)" }}
                data-tip={`${g.type === "BASE" ? "Prevailing" : g.type}: ${headline(g.cond)} · ${windText(g.cond)}${g.cond.category ? ` · ${g.cond.category}` : ""}`}
                data-tip-title={g.text}
              />
            ))}
          </div>
          {overlays.map((g, k) => (
            <div className="taf-row taf-over" key={k}>
              <span
                className={cx("taf-band", "over", g.type === "PROB" && !g.tempo && "prob")}
                style={{ left: `${x(g.from, 0)}%`, width: `${Math.max(1, x(g.to, 100) - x(g.from, 0))}%`, ["--bandc" as string]: g.cond.category ? CAT_VAR[g.cond.category] : "var(--ink-3)" }}
                data-tip={`${headline(g.cond)} · ${windText(g.cond)}${g.cond.category ? ` · ${g.cond.category}` : ""}`}
                data-tip-title={g.text}
              >
                {g.prob ? `PROB${g.prob}${g.tempo ? " TEMPO" : ""}` : "TEMPO"}
              </span>
            </div>
          ))}
          <div className="taf-ticks" aria-hidden="true">
            {ticks.map((h) => (
              <span key={h} style={{ left: `${(h / span) * 100}%` }}>
                {String((valid.from.hour + h) % 24).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>
      )}

      <ol className="taf-groups">
        {t.groups.map((g, k) => (
          <li key={k} className={cx(g.type !== "BASE" && "change")}>
            <span className="tg-type">
              <Tip tip={GROUP_TIP[g.type]}>{g.type === "PROB" ? `PROB${g.prob}${g.tempo ? " TEMPO" : ""}` : g.type === "BASE" ? "Initially" : g.type}</Tip>
            </span>
            <span className="tg-when mono small">
              {g.from ? `${String(g.from.day).padStart(2, "0")} ${String(g.from.hour).padStart(2, "0")}${g.type === "FM" ? String(g.from.min).padStart(2, "0") : ""}Z` : ""}
              {g.to && g.type !== "BASE" ? `–${g.from && g.to.day !== g.from.day ? `${String(g.to.day).padStart(2, "0")} ` : ""}${String(g.to.hour).padStart(2, "0")}Z` : ""}
            </span>
            <span className="tg-sky">
              <SkyIcon sky={skyOf(g.cond)} size={26} />
            </span>
            <span className="tg-what">
              <b>{headline(g.cond)}</b>
              <span className="small muted">
                {" "}
                · {windText(g.cond)} · vis {g.cond.visM == null ? "—" : g.cond.visM >= 10000 ? "≥10 km" : `${g.cond.visM} m`}
              </span>
            </span>
            <span className="tg-cat">
              <CatBadge cat={g.cond.category} />
            </span>
          </li>
        ))}
      </ol>
      <details className="wxc-raw">
        <summary>Raw TAF</summary>
        <Tokens text={r.raw} taf />
      </details>
    </article>
  );
}

/* ---------- page ---------- */

function readInput() {
  try {
    return window.localStorage.getItem(INPUT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function WeatherApp() {
  const [text, setText] = useState("");
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    queueMicrotask(() => setText(readInput()));
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(INPUT_KEY, text);
    } catch {
      /* storage unavailable: the page still works */
    }
  }, [text]);

  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion);
  const saved = useMemo(() => (version >= 0 ? listFlights().filter((f) => f.meta.pdfSize) : []), [version]);

  // A report needs an airport or a time (ATIS: a letter or runway) to count; the rest is listed as not recognised.
  const [reports, unknown] = useMemo(() => {
    const all = parseAll(text);
    const ok = (r: Report) => (r.kind === "ATIS" ? !!(r.atis?.letter || r.icao || r.atis?.runways.length) : !!(r.icao || r.time));
    return [all.filter(ok), all.filter((r) => !ok(r))];
  }, [text]);
  const airports = useMemo(() => {
    const by = new Map<string, Report[]>();
    for (const r of reports) {
      const k = r.icao ?? r.atis?.name ?? "Unknown";
      by.set(k, [...(by.get(k) ?? []), r]);
    }
    const rank = { ATIS: 0, METAR: 1, SPECI: 1, TAF: 2 };
    return [...by.entries()].map(([k, list]) => ({ key: k, id: `wx-${k.replace(/\W+/g, "-").toLowerCase()}`, list: list.sort((a, b) => rank[a.kind] - rank[b.kind]) }));
  }, [reports]);

  const loadPlan = async (id: string) => {
    const f = saved.find((s) => s.meta.id === id);
    if (!f) return;
    setBusy(`Reading ${f.meta.flightNo ?? id}…`);
    try {
      const data = await getPdf(id);
      if (!data) throw new Error("The saved PDF is missing.");
      const { readOfp } = await import("@/lib/ofp/pdf");
      const { ofp } = await readOfp(data, f.meta.source);
      // The OFP lists reports under an airport heading, without the ICAO code in the report itself.
      const lines = ofp.wx.airports.flatMap((a) => [a.metar ? `METAR ${a.icao} ${a.metar}` : "", a.taf.length ? `TAF ${a.icao} ${a.taf.join("\n  ")}` : "", ""]).filter((l, i, arr) => l || arr[i - 1]);
      setText(lines.join("\n").trim());
      setLoadedFrom(`${f.meta.flightNo ?? id} ${f.meta.dep ?? ""}→${f.meta.arr ?? ""}`);
      setBusy(null);
    } catch (e) {
      setBusy(e instanceof Error ? e.message : "Couldn't read that plan.");
    }
  };

  const sections = [["reports", "Paste reports"], ...airports.map((a) => [a.id, a.key] as const)] as const;

  return (
    <CollapseProvider>
      <a href="#main" className="skip">
        Skip to weather
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand sub="· Weather" />
          <span style={{ flex: 1 }} />
          <CollapseAllButton ids={sections.map(([id]) => id)} className="btn status-all" />
          <Link href="/" className="btn">
            ← Back to reader
          </Link>
          <ThemeToggle />
        </div>
        <div className="status" role="status">
          <span>
            {reports.length
              ? `${reports.length} ${reports.length === 1 ? "report" : "reports"} · ${airports.length} ${airports.length === 1 ? "airport" : "airports"}${loadedFrom ? ` · from ${loadedFrom}` : ""}`
              : "Paste METARs, TAFs or ATIS to see them as weather cards"}
          </span>
        </div>
      </header>

      <div className="layout">
        <Toc
          sections={sections}
          footer={
            <Link href="/" className="toc-link">
              ← Back to reader
            </Link>
          }
        />
        <main id="main" className="is-filled">
          <Section id="reports" no={1} title="Paste reports" meta={<span>METAR · SPECI · TAF · ATIS</span>}>
            <p className="small muted" style={{ marginTop: 0 }}>
              Paste any mix of reports, one after another. Coded and plain-language ATIS both work. Nothing leaves your browser; the text is kept here for next time.
            </p>
            <textarea
              className="wx-input"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setLoadedFrom(null);
              }}
              spellCheck={false}
              rows={8}
              aria-label="METAR, TAF and ATIS text"
              placeholder={"METAR EGLL 021250Z 24012KT 9999 FEW040 15/09 Q1013\nTAF EGLL 021100Z 0212/0318 24012KT 9999 SCT030 TEMPO 0212/0218 4000 SHRA\nEGLL ARR ATIS F 1250Z EXP ILS APCH RWY 27L …"}
            />
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" className="btn" onClick={() => setText(buildExample())}>
                Load examples
              </button>
              {saved.length > 0 && (
                <label className="row small" style={{ gap: 6 }}>
                  From a saved plan
                  <select className="wx-select" value="" onChange={(e) => e.target.value && void loadPlan(e.target.value)}>
                    <option value="">Choose…</option>
                    {saved.map((f) => (
                      <option key={f.meta.id} value={f.meta.id}>
                        {f.meta.flightNo ?? f.meta.id} · {f.meta.dep}→{f.meta.arr} · {f.meta.date}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="button" className="btn" disabled={!text} onClick={() => setText("")}>
                Clear
              </button>
              {busy && <span className="small muted">{busy}</span>}
            </div>
            {unknown.length > 0 && (
              <div className="note" role="status">
                <b>Not recognised</b> (no airport code or report time):
                <ul className="small mono">
                  {unknown.map((r, i) => (
                    <li key={i}>{r.raw.length > 90 ? `${r.raw.slice(0, 90)}…` : r.raw}</li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {airports.map((a, i) => (
            <Section key={a.id} id={a.id} no={i + 2} title={a.key} meta={<span>{a.list.map((r) => r.kind + (r.atis?.letter ? ` ${r.atis.letter}` : "")).join(" · ")}</span>}>
              <div className="wxc-grid">{a.list.map((r, k) => (r.kind === "TAF" ? <TafCard key={k} r={r} /> : <ObsCard key={k} r={r} />))}</div>
            </Section>
          ))}
        </main>
      </div>
      <TooltipLayer />
    </CollapseProvider>
  );
}
