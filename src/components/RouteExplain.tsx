"use client";

import { useField, useOfp } from "./context";
import { Badge, Tip, cx } from "./ui";
import { fmtHhmm, hhmmToMin } from "@/lib/ofp/format";
import { airwayKind, navaidKind, routeLegs, type RouteLeg } from "@/lib/ofp/fplRef";
import type { LogPoint } from "@/lib/ofp/types";

const clock = (m: number) => {
  const v = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}Z`;
};
const plus = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
const ident = (p: LogPoint) => p.ident ?? p.position?.replace(/\s/g, "") ?? "";

/** Fixed-width text columns for the printout. */
const col = (v: string | number | null | undefined, w: number, right = false) => {
  const t = v == null ? "" : String(v);
  return (right ? t.padStart(w) : t.padEnd(w)).slice(0, w);
};

type Rows = ReturnType<typeof legMetrics>;

/** The route as a 1980s line-printer listing: header, one line per fix, FIR crossings, totals. */
function listing(ofp: NonNullable<ReturnType<typeof useOfp>["ofp"]>, dep: string, dest: string, rows: Rows, off: number | null, navOf: (n: string) => LogPoint | undefined): string[] {
  const h = ofp.header;
  const hhmm = (m: number | null | undefined) => (m == null || off == null ? "...." : clock(off + m).replace(/[:Z]/g, ""));
  const fl = (m: Rows[number]["m"]) => (!m || m.flMin == null ? "" : m.flMin === m.flMax ? String(m.flMin).padStart(3, "0") : `${String(m.flMin).padStart(3, "0")}-${String(m.flMax).padStart(3, "0")}`);
  const line = "-".repeat(52);
  const out = [
    `${col("OFP READER  ROUTE LISTING", 40)}${col("PAGE 001", 12, true)}`,
    `${col(h.flightNo, 9)}${col(`${dep}-${dest}`, 11)}${col(h.date, 11)}${col(h.acType, 6)}${col(h.reg, 15)}`,
    line,
    `${col("ETO", 6)}${col("FIX", 7)}${col("VIA", 9)}${col("NM", 5, true)}${col("MIN", 5, true)} ${col("FL", 8)}${col("FREQ", 7, true)}`,
    line,
    `${col(hhmm(0), 6)}${col(dep, 7)}${col("", 9)}${col("", 5)}${col("", 5)} ${col("", 8)}${col("", 7)}`,
  ];
  let nm = 0;
  for (const { leg, m } of rows) {
    for (const f of m?.firs ?? []) out.push(`${col("", 6)}  -- ${col(`ENTER ${f.name.toUpperCase()}`, 34)} +${plus(f.t)}`);
    nm += m?.dist ?? 0;
    const via = leg.via === "SID" || leg.via === "STAR" ? leg.proc ?? leg.via : leg.via;
    out.push(`${col(hhmm(m?.t1), 6)}${col(leg.to, 7)}${col(via, 9)}${col(m ? Math.round(m.dist) : "", 5, true)}${col(m ? m.t1 - m.t0 : "", 5, true)} ${col(fl(m), 8)}${col(navOf(leg.to)?.freq, 7, true)}`);
    if (leg.change) out.push(`${col("", 6)}  ** ${leg.change.speed.toUpperCase()} ${leg.change.level} FROM ${leg.from}`);
  }
  const last = rows.at(-1)?.m;
  out.push(line, `${col("TOTAL", 22)}${col(Math.round(nm), 5, true)}${col(last ? plus(last.t1) : "", 6, true)}`, "", `${col("", 12)}*** END OF LISTING ***`);
  return out;
}

/** Continuous-form paper: tractor-feed edges and alternating white / pink line bands. */
function printout(lines: string[]) {
  return (
    <figure className="rx-print" aria-label="Route listing, printed">
      <span className="rx-feed left" aria-hidden="true" />
      <pre className="rx-paper">
        {lines.map((l, i) => (
          <span key={i} className="rx-pline">
            {l || " "}
          </span>
        ))}
      </pre>
      <span className="rx-feed right" aria-hidden="true" />
    </figure>
  );
}

/** Distance, time, levels, waypoints and FIR crossings for each leg, from the nav log. */
function legMetrics(legs: RouteLeg[], log: LogPoint[], dep: string, dest: string) {
  // Walk the log alongside the legs, so repeated names resolve in order.
  let at = 0;
  return legs.map((leg) => {
    const i0 = leg.from === dep ? 0 : log.findIndex((p, k) => k >= at && ident(p) === leg.from);
    const i1 = leg.to === dest ? log.length - 1 : log.findIndex((p, k) => k > Math.max(i0, at - 1) && ident(p) === leg.to);
    if (i0 < 0 || i1 < 0 || i1 < i0) return { leg, m: null };
    at = i1;
    const span = log.slice(i0 + 1, i1 + 1);
    const dist = span.reduce((s, p) => s + (Number(p.dis) || 0), 0);
    const t0 = hhmmToMin(log[i0].ttlt) ?? 0;
    const t1 = hhmmToMin(log[i1].ttlt) ?? 0;
    const fls = span.filter((p) => p.kind === "wpt" && p.fl).map((p) => Number(p.fl));
    const between = log.slice(i0 + 1, i1).filter((p) => p.kind === "wpt").map(ident);
    const firs = log.slice(i0 + 1, i1 + 1).filter((p) => p.kind === "fir").map((p) => ({ name: p.firName ?? p.position ?? "FIR", t: hhmmToMin(p.ttlt) ?? 0 }));
    return { leg, m: { dist, t0, t1, flMin: fls.length ? Math.min(...fls) : null, flMax: fls.length ? Math.max(...fls) : null, trend: fls.length > 1 ? Math.sign(fls[fls.length - 1] - fls[0]) : 0, between, firs } };
  });
}

/**
 * Item 15 explained: each leg from departure to destination (SID, airway or direct, STAR)
 * with its distance, time, levels, the waypoints in between and FIR crossings, taken from
 * the navigation log; then the radio navaids on the route with their frequencies.
 */
export function RouteExplain() {
  const { ofp } = useOfp();
  const [logOff] = useField("log.off", "Flight log", "Actual take-off (OFF, UTC)");
  if (!ofp?.fpl) return null;
  const item = (id: string) => ofp.fpl!.items.find((i) => i.item === id)?.value ?? "";
  const dep = item("13").slice(0, 4) || ofp.header.dep || "DEP";
  const dest = item("16").slice(0, 4) || ofp.header.arr || "DEST";
  const { initial, legs } = routeLegs(item("15"), dep, dest);
  const log = ofp.log;
  const off = hhmmToMin(/^\d{4}$/.test(logOff) ? logOff : ofp.header.offTime);
  const navOf = (name: string) => log.find((p) => ident(p) === name && p.freq);

  const rows = legMetrics(legs, log, dep, dest);

  const navaids = log.filter((p) => p.freq);

  const node = (name: string, end?: "dep" | "dest") => {
    const nav = navOf(name);
    const k = nav?.freq ? navaidKind(nav.freq) : null;
    const t = end === "dep" ? 0 : rows.find((r) => r.leg.to === name)?.m?.t1;
    return (
      <div className={cx("rx-node", end && "end", end)}>
        <span className="rx-time mono">{t != null && off != null ? clock(off + t).replace("Z", "") : ""}</span>
        <span className="rx-rail" aria-hidden="true">
          <span className="rx-dot" />
        </span>
        <span className="rx-fix">
        <b className="mono">{name}</b>
        {end && <span className="small muted">{end === "dep" ? (ofp.header.dep === name ? "departure" : "") : "destination"}</span>}
        {nav && (
          <Badge tone="blue" tip={`${nav.position ?? name}: ${k?.kind === "VOR" ? "VOR (usually with DME)" : k?.kind === "NDB" ? "non-directional beacon" : "radio navaid"} on ${nav.freq} ${k?.unit}`}>
            {k?.kind} {nav.freq}
          </Badge>
        )}
        {nav?.position && nav.position !== name && <span className="small muted">{nav.position}</span>}
        </span>
      </div>
    );
  };

  return (
    <div className="rx">
      <div className="rx-route" aria-label="Route diagram, departure to destination">
        {initial && (
          <p className="small" style={{ margin: "0 0 8px" }}>
            Filed cruise <Badge tone="mag">{initial.speed}</Badge> <Badge tone="mag">{initial.level}</Badge>
          </p>
        )}
        <div className="rx-head" aria-hidden="true">
          <span className="rx-time">ETO Z</span>
        </div>
        {node(dep, "dep")}
        {rows.map(({ leg, m }, k) => (
          <div key={k}>
            <div className="rx-leg">
              <span className="rx-time" aria-hidden="true" />
              <span className="rx-rail" aria-hidden="true" />
              <div className="rx-leg-body">
                <span className="row" style={{ gap: 6 }}>
                  {leg.via === "SID" ? (
                    <Badge tone="green" tip={`Standard instrument departure ${leg.proc} from ${dep} to ${leg.to}`}>
                      SID {leg.proc}
                    </Badge>
                  ) : leg.via === "STAR" ? (
                    <Badge tone="green" tip={`Standard terminal arrival ${leg.proc} from ${leg.from} into ${dest}`}>
                      STAR {leg.proc}
                    </Badge>
                  ) : (
                    <Badge tone={leg.via === "DCT" ? "ink" : "blue"} tip={airwayKind(leg.via)}>
                      {leg.via}
                    </Badge>
                  )}
                  {m && (
                    <span className="rx-stats">
                      <span>
                        <b>{Math.round(m.dist)}</b> NM
                      </span>
                      <span>
                        <b>{m.t1 - m.t0}</b> min
                      </span>
                      {m.flMin != null && (
                        <span>
                          <b>{m.flMin === m.flMax ? `FL${String(m.flMin).padStart(3, "0")}` : `FL${String(m.flMin).padStart(3, "0")}–${String(m.flMax).padStart(3, "0")}`}</b>
                          {m.trend !== 0 && <i>{m.trend > 0 ? " climbing" : " descending"}</i>}
                        </span>
                      )}
                    </span>
                  )}
                  {leg.change && (
                    <Badge tone="mag" tip={`Filed change at ${leg.from}: new cruise speed and level`}>
                      from {leg.from}: {leg.change.speed} · {leg.change.level}
                    </Badge>
                  )}
                </span>
                {m && m.between.length > 0 && (
                  <span className="rx-between">
                    {m.between.map((w, i) => {
                      const nav = navOf(w);
                      return (
                        <Tip key={i} plain tip={nav ? `${nav.position ?? w} · ${navaidKind(nav.freq!).kind} ${nav.freq}` : w === "TOC" ? "Top of climb" : w === "TOD" ? "Top of descent" : `Waypoint ${w}`}>
                          <span className={cx("rx-wpt", nav && "nav", (w === "TOC" || w === "TOD") && "top")}>{w}</span>
                        </Tip>
                      );
                    })}
                  </span>
                )}
                {m?.firs.map((f, i) => (
                  <span key={i} className="small muted rx-fir">
                    ▸ enters {f.name} at +{plus(f.t)}
                  </span>
                ))}
              </div>
            </div>
            {node(leg.to, leg.to === dest ? "dest" : undefined)}
          </div>
        ))}
      </div>

      <span className="rx-vr" aria-hidden="true" />
      <div className="rx-side">
      <div className="rx-navaids">
        <span className="field-label">Radio navaids on the route</span>
        {navaids.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <caption className="sr-only">Radio navaids on the route</caption>
              <thead>
                <tr>
                  <th scope="col">Ident</th>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="num">
                    Freq
                  </th>
                  <th scope="col" className="num">
                    ETO
                  </th>
                </tr>
              </thead>
              <tbody>
                {navaids.map((p, i) => {
                  const k = navaidKind(p.freq!);
                  return (
                    <tr key={i}>
                      <th scope="row" className="mono">
                        <Tip plain tip={`${p.lat} ${p.long}`} title="Position">
                          <span>{ident(p)}</span>
                        </Tip>
                      </th>
                      <td>{p.position}</td>
                      <td>
                        <Badge tone="blue" tip={k.kind === "VOR" ? "VHF omnidirectional range, usually paired with DME" : k.kind === "NDB" ? "Non-directional beacon (tune on the ADF)" : "Radio navaid"}>
                          {k.kind}
                        </Badge>
                      </td>
                      <td className="num mono">
                        {p.freq} <span className="small muted">{k.unit}</span>
                      </td>
                      <td className="num mono">{off != null && p.ttlt ? clock(off + (hhmmToMin(p.ttlt) ?? 0)) : fmtHhmm(p.ttlt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="small muted">No radio navaids with frequencies on this route (it&apos;s flown on RNAV waypoints).</p>
        )}
      </div>
      {printout(listing(ofp, dep, dest, rows, off, navOf))}
      </div>
    </div>
  );
}
