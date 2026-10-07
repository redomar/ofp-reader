"use client";

/*
 * Weather cards for METAR / SPECI / ATIS and TAF reports (lib/wx/reports), shared by
 * the reader's Airport weather section and the /weather page.
 */

import { Replay } from "./replay";
import { Badge, Tip, cx } from "./ui";
import { WindArrow } from "./WindArrow";
import { CATEGORY_TIP, decodeToken, type Category } from "@/lib/ofp/metar";
import {
  ageMinutes,
  headline,
  hoursFrom,
  skyOf,
  wxWords,
  type CloudLayer,
  type Conditions,
  type DayTime,
  type Report,
  type Sky,
  type TafGroup,
} from "@/lib/wx/reports";

const CAT_TONE: Record<Category, "green" | "blue" | "red" | "mag"> = {
  VFR: "green",
  MVFR: "blue",
  IFR: "red",
  LIFR: "mag",
};
const CAT_VAR: Record<Category, string> = {
  VFR: "var(--green)",
  MVFR: "var(--blue)",
  IFR: "var(--red)",
  LIFR: "var(--magenta)",
};

/* ---------- small visuals ---------- */

export function SkyIcon({ sky, size = 56 }: { sky: Sky; size?: number }) {
  const sun = (cx: number, cy: number, r: number) => (
    <g className="sky-sun a-sun">
      <circle cx={cx} cy={cy} r={r} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1={cx + Math.cos(a) * (r + 3)} y1={cy + Math.sin(a) * (r + 3)} x2={cx + Math.cos(a) * (r + 7)} y2={cy + Math.sin(a) * (r + 7)} />;
      })}
    </g>
  );
  // Wrapped in <g> so the drift animation's transform doesn't replace the path's own.
  const cloud = (x: number, y: number, s: number, cls = "sky-cloud") => (
    <g className="a-drift">
      <path className={cls} transform={`translate(${x} ${y}) scale(${s})`} d="M6 22 a8 8 0 0 1 1-16 a10 10 0 0 1 19 2 a7 7 0 0 1 2 14 Z" />
    </g>
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
          {sky === "rain" &&
            [14, 22, 30].map((x, i) => (
              <g key={i} className="a-fall" style={{ ["--i" as string]: i }}>
                <line className="sky-rain" x1={x} y1={33} x2={x - 3} y2={42} />
              </g>
            ))}
          {sky === "snow" &&
            [14, 23, 32].map((x, i) => (
              <g key={i} className="a-fall" style={{ ["--i" as string]: i }}>
                <circle className="sky-snow" cx={x} cy={37 + (i % 2) * 4} r={1.8} />
              </g>
            ))}
          {sky === "thunder" && (
            <g className="a-flash">
              <path className="sky-bolt" d="M24 30 L19 39 L24 39 L21 47 L30 36 L25 36 L28 30 Z" />
            </g>
          )}
        </>
      )}
      {sky === "fog" &&
        [14, 22, 30, 38].map((y, i) => (
          <g key={i} className="a-spread" style={{ ["--i" as string]: i }}>
            <line className="sky-fog" x1={6 + (i % 2) * 4} y1={y} x2={42 - (i % 2) * 4} y2={y} />
          </g>
        ))}
      {sky === "unknown" && (
        <text x="24" y="30" textAnchor="middle" className="sky-q">
          ?
        </text>
      )}
    </svg>
  );
}

const OKTAS = { FEW: 0.25, SCT: 0.5, BKN: 0.8, OVC: 1, VV: 1 } as const;

/** Cloud layers drawn at their heights, width by coverage. */
function CloudColumn({ c }: { c: Conditions }) {
  const top = Math.max(5000, ...c.clouds.map((l) => (l.baseFt ?? 0) + 1000));
  const H = 96;
  // Leave room above the highest layer for its label.
  const y = (ft: number) => H - 10 - (ft / top) * (H - 30);
  // Each layer sits at its height with its label just above; layers closer than a bar
  // plus a label are spaced apart (the label still gives the exact height).
  const GAP = 19;
  const layers = [...c.clouds]
    .sort((a, b) => (a.baseFt ?? 0) - (b.baseFt ?? 0))
    .reduce<{ l: CloudLayer; yy: number; ly: number }[]>((acc, l) => {
      const prev = acc.at(-1)?.yy ?? Infinity;
      const yy = Math.max(17, Math.min(y(l.baseFt ?? 0), prev - GAP));
      return [...acc, { l, yy, ly: yy - 9 }];
    }, []);
  return (
    <svg
      viewBox={`0 0 120 ${H}`}
      className="cloud-col"
      role="img"
      aria-label={
        c.clouds.length
          ? `Cloud: ${c.clouds.map((l) => `${l.cover} ${l.baseFt ?? "?"} ft${l.type ? ` ${l.type}` : ""}`).join(", ")}`
          : c.cavok
            ? "No cloud below 5000 ft (CAVOK)"
            : "No cloud reported"
      }
    >
      <line x1="30" x2="118" y1={H - 10} y2={H - 10} className="cc-ground" />
      {[0, top / 2, top].map((ft) => (
        <text key={ft} x="26" y={y(ft) + 3} textAnchor="end" className="cc-axis">
          {ft >= 1000 ? `${Math.round(ft / 100) / 10}k` : ft}
        </text>
      ))}
      {layers.map(({ l, yy, ly }, i) => {
        const w = 84 * OKTAS[l.cover];
        return (
          <g key={i}>
            <rect
              x={32}
              y={yy - 7}
              width={w}
              height={7}
              rx={3.5}
              style={{ ["--i" as string]: i + 2 }}
              className={cx(
                "cc-layer a-grow-x a-svg",
                l.type === "CB" && "cb",
                l.type === "TCU" && "tcu",
                (l.cover === "BKN" || l.cover === "OVC" || l.cover === "VV") && "ceil",
              )}
            />
            <text x={34} y={ly} className="cc-label a-fade" style={{ ["--i" as string]: i + 4 }}>
              {l.cover}
              {l.baseFt != null ? ` ${l.baseFt.toLocaleString("en-GB")}` : ""}
              {l.type ? ` ${l.type}` : ""}
            </text>
          </g>
        );
      })}
      {!c.clouds.length && (
        <text x="74" y={H / 2} textAnchor="middle" className="cc-none">
          {c.cavok ? "CAVOK" : (c.noCloud ?? "no cloud")}
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
      {visM != null && <span className="vb-mark a-slide" style={{ left: `${pct(visM)}%` }} />}
    </div>
  );
}

export function Tokens({ text, taf }: { text: string; taf?: boolean }) {
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
const fmtAge = (min: number) =>
  min < 0
    ? "in the future?"
    : min < 60
      ? `${min} min ago`
      : min < 48 * 60
        ? `${Math.floor(min / 60)} h ${min % 60} min ago`
        : `${Math.round(min / 1440)} days ago`;

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
      <div className="wxc-fact a-rise" style={{ ["--i" as string]: 4 }}>
        <span className="field-label">Wind</span>
        <span className="wxc-big">
          {w && w.dir != null && !w.calm && (
            <span className="a-spin a-inline" style={{ ["--i" as string]: 12 }}>
              <WindArrow
                kind={kind === "PWIND" ? "PWIND" : "METAR"}
                dir={w.dir}
                spd={w.spd}
                gust={w.gust}
                sector={w.sector}
                size={22}
                label={`Wind from ${w.dir} degrees at ${w.spd} knots${w.gust ? `, gusting ${w.gust}` : ""}`}
              />
            </span>
          )}
          {windText({ ...c, wind: w ? { ...w, sector: null } : null })}
        </span>
        {w?.sector && (
          <span className="small muted">
            varying {String(w.sector[0]).padStart(3, "0")}–{String(w.sector[1]).padStart(3, "0")}°
          </span>
        )}
      </div>
      <div className="wxc-fact a-rise" style={{ ["--i" as string]: 5 }}>
        <span className="field-label">Visibility</span>
        <span className="wxc-big">
          {c.visM == null ? "—" : c.visM >= 10000 ? "≥ 10 km" : c.visM >= 5000 ? `${(c.visM / 1000).toFixed(0)} km` : `${c.visM.toLocaleString("en-GB")} m`}
        </span>
        <VisBar visM={c.visM} />
      </div>
      <div className="wxc-fact a-rise" style={{ ["--i" as string]: 6 }}>
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
      <div className="wxc-fact a-rise" style={{ ["--i" as string]: 7 }}>
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

export function ObsCard({ r }: { r: Report }) {
  const c = r.cond;
  const age = r.time ? ageMinutes(r.time) : null;
  const a = r.atis;
  return (
    <Replay className="wxc-replay">
      <article className={cx("wxc a-rise", `wxc-${r.kind.toLowerCase()}`)} style={c.category ? { ["--catc" as string]: CAT_VAR[c.category] } : undefined}>
        <header className="wxc-head">
          <Badge
            tone={r.kind === "ATIS" ? "mag" : r.kind === "SPECI" ? "amber" : "ink"}
            tip={
              r.kind === "ATIS"
                ? "Automatic Terminal Information Service"
                : r.kind === "SPECI"
                  ? "Special observation, issued when conditions change significantly"
                  : "Routine aerodrome observation"
            }
          >
            {r.kind}
            {a?.kind ? ` ${a.kind}` : ""}
          </Badge>
          {a?.letter && (
            <span className="atis-letter a-flip" title={`Information ${a.letter}`}>
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
            <p className="wxc-headline a-fade" style={{ ["--i" as string]: 1 }}>
              {headline(c)}
            </p>
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
                {rw.use === "landing" ? "LDG " : rw.use === "take-off" ? "T/O " : ""}
                RWY {rw.rwy}
              </span>
            ))}
            {a.approach && <Badge tone="blue">{a.approach} approach</Badge>}
            {a.transitionLevel && (
              <Badge tone="ink" tip="Transition level">
                TL FL{a.transitionLevel.padStart(3, "0")}
              </Badge>
            )}
            {a.plain && <span className="small muted">read from plain-language ATIS</span>}
          </div>
        )}
        {a && a.notes.length > 0 && (
          <ul className="atis-notes">
            {a.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
        <Facts c={c} kind="METAR" />
        <details className="wxc-raw" open={r.kind !== "ATIS" || !a?.plain}>
          <summary>Raw {r.kind}</summary>
          {r.kind === "ATIS" && a?.plain ? <p className="pre small">{r.raw}</p> : <Tokens text={r.raw} />}
        </details>
      </article>
    </Replay>
  );
}

const GROUP_TIP: Record<TafGroup["type"], string> = {
  BASE: "Prevailing conditions at the start of the forecast",
  FM: "From this time, conditions change completely to",
  BECMG: "Becoming: a permanent change during the period",
  TEMPO: "Temporary fluctuations, each under an hour, in total under half the period",
  PROB: "Probability of these conditions during the period",
};

export function TafCard({ r }: { r: Report }) {
  const t = r.taf!;
  const valid = t.valid;
  const span = valid ? Math.max(1, hoursFrom(valid.from, valid.to)) : 24;
  const x = (d: DayTime | null, fallback: number) => (valid && d ? Math.min(100, Math.max(0, (hoursFrom(valid.from, d) / span) * 100)) : fallback);

  // Prevailing bands: BASE / FM replace, BECMG applies from the start of its period.
  const prevailing = t.groups.filter((g) => g.type === "BASE" || g.type === "FM" || g.type === "BECMG");
  const bands = prevailing.flatMap((g, k) => {
    const next = prevailing[k + 1];
    const from = x(g.type === "BASE" ? (valid?.from ?? null) : g.from, 0);
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
    <Replay className="wxc-replay">
      <article className="wxc wxc-taf a-rise">
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
                · valid {String(valid.from.day).padStart(2, "0")} {String(valid.from.hour).padStart(2, "0")}Z → {String(valid.to.day).padStart(2, "0")}{" "}
                {String(valid.to.hour).padStart(2, "0")}Z
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
                  className={cx("taf-band a-wipe", changing && "becmg")}
                  style={{
                    left: `${from}%`,
                    width: `${Math.max(0.5, to - from)}%`,
                    background: g.cond.category ? CAT_VAR[g.cond.category] : "var(--rule)",
                    ["--i" as string]: k,
                  }}
                  data-tip={`${g.type === "BASE" ? "Prevailing" : g.type}: ${headline(g.cond)} · ${windText(g.cond)}${g.cond.category ? ` · ${g.cond.category}` : ""}`}
                  data-tip-title={g.text}
                />
              ))}
            </div>
            {overlays.map((g, k) => (
              <div className="taf-row taf-over" key={k}>
                <span
                  className={cx("taf-band", "over", "a-wipe", g.type === "PROB" && !g.tempo && "prob")}
                  style={{
                    left: `${x(g.from, 0)}%`,
                    width: `${Math.max(1, x(g.to, 100) - x(g.from, 0))}%`,
                    ["--bandc" as string]: g.cond.category ? CAT_VAR[g.cond.category] : "var(--ink-3)",
                    ["--i" as string]: k + 8,
                  }}
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
            <li key={k} className={cx("a-rise", g.type !== "BASE" && "change")} style={{ ["--i" as string]: k + 6 }}>
              <span className="tg-type">
                <Tip tip={GROUP_TIP[g.type]}>{g.type === "PROB" ? `PROB${g.prob}${g.tempo ? " TEMPO" : ""}` : g.type === "BASE" ? "Initially" : g.type}</Tip>
              </span>
              <span className="tg-when mono small">
                {g.from
                  ? `${String(g.from.day).padStart(2, "0")} ${String(g.from.hour).padStart(2, "0")}${g.type === "FM" ? String(g.from.min).padStart(2, "0") : ""}Z`
                  : ""}
                {g.to && g.type !== "BASE"
                  ? `–${g.from && g.to.day !== g.from.day ? `${String(g.to.day).padStart(2, "0")} ` : ""}${String(g.to.hour).padStart(2, "0")}Z`
                  : ""}
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
    </Replay>
  );
}
