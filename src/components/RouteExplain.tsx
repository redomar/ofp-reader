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
    return { leg, m: { dist, t0, t1, flMin: fls.length ? Math.min(...fls) : null, flMax: fls.length ? Math.max(...fls) : null, between, firs } };
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
      <div className={cx("rx-node", end && "end")}>
        <span className="rx-dot" aria-hidden="true" />
        <b className="mono">{name}</b>
        {end && <span className="small muted">{end === "dep" ? (ofp.header.dep === name ? "departure" : "") : "destination"}</span>}
        {nav && (
          <Badge tone="blue" tip={`${nav.position ?? name}: ${k?.kind === "VOR" ? "VOR (usually with DME)" : k?.kind === "NDB" ? "non-directional beacon" : "radio navaid"} on ${nav.freq} ${k?.unit}`}>
            {k?.kind} {nav.freq}
          </Badge>
        )}
        {nav?.position && nav.position !== name && <span className="small muted">{nav.position}</span>}
        {t != null && off != null && <span className="small mono muted rx-time">{clock(off + t)}</span>}
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
        {node(dep, "dep")}
        {rows.map(({ leg, m }, k) => (
          <div key={k}>
            <div className="rx-leg">
              <span className="rx-line" aria-hidden="true" />
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
                    <span className="small mono">
                      {Math.round(m.dist)} NM · {plus(m.t1 - m.t0)}
                      {m.flMin != null && ` · ${m.flMin === m.flMax ? `FL${String(m.flMin).padStart(3, "0")}` : `FL${String(m.flMin).padStart(3, "0")}–${String(m.flMax).padStart(3, "0")}`}`}
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
    </div>
  );
}
