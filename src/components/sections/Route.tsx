"use client";

import { useState } from "react";
import { McduSheet } from "../McduSheet";
import { useField, useOfp } from "../context";
import { Replay } from "../replay";
import { Section, Sub, Tip, V } from "../ui";
import { G } from "@/lib/ofp/glossary";
import { fmtDur, fmtHhmm, fmtNum, hhmmToMin, pageOf, signed } from "@/lib/ofp/format";

/** Classifies a route token for colouring and a tooltip. */
export function routeToken(t: string, i: number, all: string[]): { kind: string; tip: string } {
  const apt = t.match(/^([A-Z]{4})\/(\w+)$/);
  if (apt) return { kind: "apt", tip: `${i === 0 ? "Departure" : "Destination"} ${apt[1]}, runway ${apt[2]}` };
  if (t === "DCT") return { kind: "dct", tip: "Direct — fly straight to the next fix" };
  const spd = t.match(/^(\w+)\/([NMK])(\d{3,4})([FAS])(\d{3,4})$/);
  if (spd)
    return {
      kind: "fix",
      tip: `At ${spd[1]} change to ${spd[2] === "N" ? `${Number(spd[3])} kt TAS` : spd[2] === "M" ? `Mach .${spd[3].slice(1)}` : `${Number(spd[3])} km/h`} and ${spd[4] === "F" ? `FL${Number(spd[5])}` : `${Number(spd[5]) * 100} ft`}`,
    };
  const sl = t.match(/^([NMK])(\d{3,4})([FAS])(\d{3,4})$/);
  if (sl) return { kind: "dct", tip: `Initial cruise speed ${sl[1] === "N" ? `${Number(sl[2])} kt TAS` : `Mach .${sl[2].slice(1)}`} at ${sl[3] === "F" ? `FL${Number(sl[4])}` : sl[4]}` };
  if (/^[A-Z]{2,5}\d[A-Z]$/.test(t)) {
    const isSid = i <= 2;
    return { kind: "proc", tip: `${isSid ? "SID (standard instrument departure)" : "STAR (standard arrival)"} ${t}` };
  }
  if (/^[A-Z]{1,2}\d{1,4}$/.test(t) && all[i - 1] !== undefined) return { kind: "awy", tip: `Airway ${t}` };
  if (/^[A-Z]{3}$/.test(t)) return { kind: "fix", tip: `Navaid ${t} (VOR/NDB identifier)` };
  return { kind: "fix", tip: `Waypoint ${t}` };
}

const TOKEN_COLOR: Record<string, string> = {
  apt: "var(--ink)",
  dct: "var(--ink-3)",
  proc: "var(--green)",
  awy: "var(--blue)",
  fix: "var(--magenta)",
};

export function RouteString({ route }: { route: string | null | undefined }) {
  if (!route) return <V v={null} w={60} />;
  const toks = route.split(/\s+/);
  return (
    <p className="fpl" style={{ margin: 0 }}>
      {toks.map((t, i) => {
        const { kind, tip } = routeToken(t, i, toks);
        return (
          <span key={i}>
            <span className="it" data-tip={tip} data-tip-title={t} style={{ color: TOKEN_COLOR[kind], fontWeight: kind === "fix" || kind === "apt" ? 600 : 400 }}>
              {t}
            </span>{" "}
          </span>
        );
      })}
    </p>
  );
}

export function RouteSection({ no }: { no: number }) {
  const { ofp } = useOfp();
  const [clr, setClr] = useField("route.atcClearance", "Alternate & routing", "Departure ATC clearance");
  const [sheet, setSheet] = useState(false);
  const alts = ofp?.alternates.length ? ofp.alternates : [null];
  const impacts = ofp?.opImpacts ?? [];
  const maxTrip = Math.max(1, ...impacts.map((m) => m.trip ?? 0));
  const unit = ofp?.header.unit ?? "KGS";

  return (
    <Section id="route" no={no} title="Alternate, routing & impacts" meta={<span>PDF p.{pageOf(ofp?.pages, /ALTERNATE ROUTE TO/) ?? 2}</span>}>
      <div className="row" style={{ marginBottom: 14 }}>
        <button type="button" className="btn" aria-expanded={sheet} aria-controls="mcdu-sheet" disabled={!ofp?.fpl} onClick={() => setSheet(!sheet)}>
          {sheet ? "▾ Hide MCDU set-up sheet" : "▸ Print MCDU set-up sheet"}
        </button>
        <span className="small muted">INIT A, INIT B fuel, F-PLN, PERF TAKE OFF, RAD NAV and cruise winds in MCDU page order.</span>
      </div>
      {sheet && (
        <div id="mcdu-sheet" className="mcdu-sheet" style={{ marginBottom: 16 }}>
          <McduSheet />
        </div>
      )}
      <Sub>
        Alternate route to{" "}
        <span className="mono" style={{ color: "var(--ink)" }}>
          · <Tip tip={G.FINRES}>FINRES</Tip> <V v={fmtNum(ofp?.finresAltn)} w={4} />
        </span>
      </Sub>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">
                <Tip tip="Alternate airport / planned runway">Apt</Tip>
              </th>
              {(["TRK", "DST"] as const).map((k) => (
                <th key={k} scope="col" className="num">
                  <Tip tip={G[k]} title={k}>
                    {k}
                  </Tip>
                </th>
              ))}
              <th scope="col">
                <Tip tip={G.VIA} title="VIA">
                  Via
                </Tip>
              </th>
              {(["FL", "WC"] as const).map((k) => (
                <th key={k} scope="col" className="num">
                  <Tip tip={G[k]} title={k}>
                    {k}
                  </Tip>
                </th>
              ))}
              <th scope="col" className="num">
                Time
              </th>
              <th scope="col" className="num">
                Fuel
              </th>
            </tr>
          </thead>
          <tbody>
            {alts.map((a, i) => (
              <tr key={i}>
                <th scope="row">
                  <V v={a && `${a.apt}${a.rwy ? `/${a.rwy}` : ""}`} w={8} />
                </th>
                <td className="num">
                  <V v={a?.trk && `${a.trk}°`} w={3} />
                </td>
                <td className="num">
                  <V v={a?.dst} w={3} />
                </td>
                <td style={{ whiteSpace: "normal", minWidth: 220 }}>
                  <V v={a?.via} w={24} />
                </td>
                <td className="num">
                  <V v={a?.fl} w={3} />
                </td>
                <td className="num">
                  <V v={a?.wc && <Tip tip={(signed(a.wc) ?? 0) < 0 ? `${Math.abs(signed(a.wc)!)} kt headwind` : `${signed(a.wc)} kt tailwind`} plain>{a.wc}</Tip>} w={4} />
                </td>
                <td className="num">
                  <V v={a?.time && `${fmtHhmm(a.time)}`} w={5} />
                </td>
                <td className="num">
                  <V v={fmtNum(a?.fuel)} w={4} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cols" style={{ ["--min" as string]: "280px", marginTop: 16 }}>
        <div>
          <Sub>
            <Tip tip={G["MEL/CDL"]} title="MEL/CDL">
              MEL / CDL items
            </Tip>
          </Sub>
          {ofp ? (
            ofp.mel.length ? (
              <ul className="pre">
                {ofp.mel.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            ) : (
              <p className="muted small" style={{ margin: 0 }}>
                None — aircraft dispatched with no deferred items.
              </p>
            )
          ) : (
            <V v={null} w={30} />
          )}
        </div>
        <div>
          <Sub>Departure ATC clearance</Sub>
          <label htmlFor="atc-clr" className="sr-only">
            Departure ATC clearance
          </label>
          <textarea
            id="atc-clr"
            className="act"
            rows={3}
            style={{ width: "100%", height: "auto", padding: 8 }}
            placeholder="Copy the clearance here (CLRD TO … VIA … CLIMB … SQUAWK …)"
            value={clr}
            onChange={(e) => setClr(e.target.value.toUpperCase())}
          />
          {ofp?.atcClearance.length ? <p className="pre small">{ofp.atcClearance.join("\n")}</p> : null}
        </div>
      </div>

      <Sub>
        Routing ·{" "}
        <Tip tip={G["ROUTE ID"]} title="ROUTE ID">
          Route ID
        </Tip>{" "}
        <span className="mono" style={{ color: "var(--ink)" }}>
          <V v={ofp?.routeId} w={6} />
        </span>
      </Sub>
      <RouteString route={ofp?.route} />
      <div className="legend small" aria-hidden="true">
        {Object.entries({ Airport: "apt", Procedure: "proc", Airway: "awy", "Fix / navaid": "fix", Direct: "dct" }).map(([k, v]) => (
          <span key={k}>
            <i style={{ background: TOKEN_COLOR[v] }} />
            {k}
          </span>
        ))}
      </div>

      <Sub>
        <Tip tip={G["OPERATIONAL IMPACTS"]} title="Operational impacts">
          Operational impacts
        </Tip>
      </Sub>
      <Replay>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">If</th>
              <th scope="col">Change</th>
              <th scope="col" className="num">
                Trip Δ {unit}
              </th>
              <th scope="col" style={{ width: "40%" }}>
                <span className="sr-only">Trip change chart</span>
              </th>
              <th scope="col" className="num">
                Time Δ
              </th>
            </tr>
          </thead>
          <tbody>
            {(impacts.length ? impacts : Array.from({ length: 5 }, () => null)).map((m, i) => {
              const d = m ? (m.tripSign === "M" ? -1 : 1) * (m.trip ?? 0) : 0;
              const t = m ? (m.timeSign === "M" ? -1 : 1) * (hhmmToMin(m.time) ?? 0) : 0;
              return (
                <tr key={i}>
                  <th scope="row">
                    <V v={m?.kind} w={12} />
                  </th>
                  <td>
                    <V v={m && impactLabel(m.kind, m.change)} w={10} />
                  </td>
                  <td className="num" style={{ color: d > 0 ? "var(--red)" : d < 0 ? "var(--green)" : undefined }}>
                    <V v={m && `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d)}`} w={4} />
                  </td>
                  <td aria-hidden="true">
                    {m && (
                      <div style={{ position: "relative", height: 12, background: "var(--sunk)" }}>
                        <span style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: "var(--ink-3)" }} />
                        <span
                          className={d >= 0 ? "a-grow-x" : "a-grow-x-r"}
                          style={{
                            ["--i" as string]: i,
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            left: d >= 0 ? "50%" : `${50 - (Math.abs(d) / maxTrip) * 50}%`,
                            width: `${(Math.abs(d) / maxTrip) * 50}%`,
                            background: d > 0 ? "var(--red)" : "var(--green)",
                          }}
                        />
                      </div>
                    )}
                  </td>
                  <td className="num">
                    <V v={m && (t === 0 ? "±0" : `${t > 0 ? "+" : "−"}${fmtDur(Math.abs(t))}`)} w={5} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </Replay>
      <p className="note">Red = more fuel burnt than planned, green = less. Use these to judge a different cruise level, speed or late load change.</p>
    </Section>
  );
}

function impactLabel(kind: string, change: string) {
  const m = change.match(/^(UP|DN)\s+(\S+)$/);
  if (kind.startsWith("WEIGHT") && m) return `${m[1] === "UP" ? "+" : "−"}${m[2]} t`;
  if (kind.startsWith("FL") && m) {
    const n = Number(m[2].replace("FL", ""));
    return `${n} level${n > 1 ? "s" : ""} ${m[1] === "UP" ? "higher" : "lower"}`;
  }
  return change;
}
