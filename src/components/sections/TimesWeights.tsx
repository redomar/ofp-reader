"use client";

import { useState } from "react";
import { useOfp } from "../context";
import { Act, Badge, Field, Gauge, Section, Sub, Tip, V } from "../ui";
import { G } from "@/lib/ofp/glossary";
import { clockDiff, fmtDur, fmtHhmm, fmtOffset, pageOf, utcOffset } from "@/lib/ofp/format";

const TIME_ROWS = ["OUT", "OFF", "ON", "IN", "BLOCK TIME"];
const WEIGHT_ROWS = ["PAX", "BAG/CARGO", "PAYLOAD", "ZFW", "FUEL", "TOW", "STAB TRIM", "LAW"];

function splitZL(v: string | null | undefined) {
  const m = v?.match(/^(\d{4})Z\/(\d{4})L$/);
  return m ? { z: m[1], l: m[2] } : null;
}

export function TimesWeightsSection({ no }: { no: number }) {
  const { ofp } = useOfp();
  const [atis, setAtis] = useState("");
  const [rvsm, setRvsm] = useState({ left: "", stby: "", right: "" });
  const [actT, setActT] = useState<Record<string, string>>({});
  const [actW, setActW] = useState<Record<string, string>>({});
  const [ldg, setLdg] = useState("");

  const times = ofp?.times;
  const t = (label: string) => times?.find((r) => r.label === label);
  const est = (l: string) => splitZL(t(l)?.est)?.z ?? null;
  const sked = (l: string) => splitZL(t(l)?.sked)?.z ?? null;
  const act = (l: string) => (/^\d{4}$/.test(actT[l] ?? "") ? actT[l] : null);
  const depOff = utcOffset(t("OUT")?.est);
  const arrOff = utcOffset(t("IN")?.est);

  const phases = [
    { k: "Taxi out", a: "OUT", b: "OFF", color: "var(--amber)" },
    { k: "Airborne", a: "OFF", b: "ON", color: "var(--magenta)" },
    { k: "Taxi in", a: "ON", b: "IN", color: "var(--amber)" },
  ];
  const blockEst = clockDiff(est("OUT"), est("IN"));
  const blockAct = clockDiff(act("OUT"), act("IN"));
  const blockSked = clockDiff(sked("OUT"), sked("IN"));

  const alt = [rvsm.left, rvsm.stby, rvsm.right].map((x) => (x ? Number(x) : null));
  const primDiff = alt[0] != null && alt[2] != null ? Math.abs(alt[0] - alt[2]) : null;

  const w = (label: string) => ofp?.weights.find((r) => r.label === label);
  const trip = ofp?.fuel.rows.find((r) => r.label === "TRIP")?.fuel ?? null;
  const towMax = Number(w("TOW")?.max);
  const lawMax = Number(w("LAW")?.max);
  const towLimitedByLaw = trip != null && towMax && lawMax ? Math.abs(lawMax + trip / 1000 - towMax) < 0.15 : false;

  return (
    <Section id="times" no={no} title="ATIS, times & weights" meta={<span>PDF p.{pageOf(ofp?.pages, /^\s+TIMES\s*$/) ?? 3}</span>}>
      <div className="cols" style={{ ["--min" as string]: "300px" }}>
        <div>
          <Sub>
            <Tip tip={G.ATIS} title="ATIS">
              ATIS
            </Tip>
          </Sub>
          <label htmlFor="atis" className="sr-only">
            ATIS notes
          </label>
          <textarea
            id="atis"
            className="act"
            rows={3}
            style={{ width: "100%", height: "auto", padding: 8 }}
            placeholder="INFO … RWY … WIND … VIS … QNH …"
            value={atis}
            onChange={(e) => setAtis(e.target.value.toUpperCase())}
          />
          {ofp?.atis.length ? <p className="pre small">{ofp.atis.join("\n")}</p> : null}
        </div>
        <div>
          <Sub>
            <Tip tip={G.RVSM} title="RVSM">
              RVSM altimeter check
            </Tip>
          </Sub>
          <div className="row">
            {(["left", "stby", "right"] as const).map((k) => (
              <label key={k} className="row" style={{ gap: 6 }}>
                <span className="field-label" style={{ margin: 0 }}>
                  {k === "stby" ? "STBY" : k.toUpperCase()}
                </span>
                <Act label={`${k} altimeter reading in feet`} value={rvsm[k]} onChange={(v) => setRvsm({ ...rvsm, [k]: v.replace(/\D/g, "") })} w={5} />
              </label>
            ))}
          </div>
          <p className="small" style={{ margin: "8px 0 0" }} aria-live="polite">
            {primDiff == null ? (
              <span className="muted">{ofp?.rvsm ?? "Enter left and right readings to compare."}</span>
            ) : primDiff <= 200 ? (
              <Badge tone="green">Primaries within {primDiff} ft — OK (≤ 200 ft)</Badge>
            ) : (
              <Badge tone="red">Primaries differ by {primDiff} ft — exceeds 200 ft</Badge>
            )}
          </p>
        </div>
      </div>

      <Sub>Times</Sub>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col" className="num">
                <Tip tip="Planned by the flight planning system">Estimated Z</Tip>
              </th>
              <th scope="col" className="num">
                <Tip tip="Local time at the airport the event happens">Local</Tip>
              </th>
              <th scope="col" className="num">
                <Tip tip="Airline schedule">Sked Z</Tip>
              </th>
              <th scope="col" className="num">
                <Tip tip="Fill in during the flight (HHMM, UTC)">Actual Z</Tip>
              </th>
              <th scope="col" className="num">
                <Tip tip="Actual minus estimated">Δ</Tip>
              </th>
            </tr>
          </thead>
          <tbody>
            {TIME_ROWS.map((l) => {
              const r = t(l);
              const block = l === "BLOCK TIME";
              const e = block ? r?.est ?? null : est(l);
              const d = !block && act(l) && e ? signedClock(e, act(l)!) : null;
              return (
                <tr key={l} className={block ? "total" : undefined}>
                  <th scope="row">
                    <Tip tip={G[l]} title={l}>
                      {l}
                    </Tip>
                  </th>
                  <td className="num">
                    <V v={fmtHhmm(e)} w={5} />
                  </td>
                  <td className="num">
                    <V v={block ? (r ? "—" : null) : fmtHhmm(splitZL(r?.est)?.l)} w={5} />
                  </td>
                  <td className="num">
                    <V v={fmtHhmm(block ? r?.sked : sked(l))} w={5} />
                  </td>
                  <td className="num">
                    {block ? (
                      <V v={blockAct != null ? fmtDur(blockAct) : null} w={5} />
                    ) : (
                      <Act label={`Actual ${l} time UTC`} value={actT[l] ?? ""} onChange={(v) => setActT({ ...actT, [l]: v.replace(/\D/g, "").slice(0, 4) })} w={4} />
                    )}
                  </td>
                  <td className="num" style={{ color: d != null ? (d > 0 ? "var(--red)" : "var(--green)") : undefined }}>
                    {d != null ? `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d)}′` : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="fields" style={{ marginTop: 10 }}>
        {phases.map((p) => (
          <Field key={p.k} label={p.k} tip={`${p.a} → ${p.b}`}>
            <V v={fmtDur(clockDiff(est(p.a), est(p.b)))} w={5} />
            {act(p.a) && act(p.b) && <span className="field-sub">actual {fmtDur(clockDiff(act(p.a), act(p.b)))}</span>}
          </Field>
        ))}
        <Field label="vs schedule" tip="Estimated block time compared with the airline schedule">
          <V v={blockEst != null && blockSked != null ? (blockEst === blockSked ? "on sked" : `${blockEst < blockSked ? "−" : "+"}${Math.abs(blockEst - blockSked)} min`) : null} w={6} />
        </Field>
        <Field label="Dep local" tip="Departure airport offset from UTC, derived from the Z/L times">
          <V v={fmtOffset(depOff)} w={5} />
        </Field>
        <Field label="Arr local" tip="Arrival airport offset from UTC">
          <V v={fmtOffset(arrOff)} w={5} />
        </Field>
      </div>

      {blockEst ? (
        <div style={{ marginTop: 10 }}>
          <div className="fuelbar" role="img" aria-label={`Timeline: ${phases.map((p) => `${p.k} ${clockDiff(est(p.a), est(p.b))} minutes`).join(", ")}`}>
            {phases.map((p) => {
              const m = clockDiff(est(p.a), est(p.b)) ?? 0;
              return (
                <span
                  key={p.k}
                  style={{ flexGrow: m, flexBasis: 0, background: p.color, color: "var(--sheet)" }}
                  data-tip={`${fmtHhmm(est(p.a))}Z → ${fmtHhmm(est(p.b))}Z · ${fmtDur(m)}`}
                  data-tip-title={p.k}
                >
                  {m / blockEst > 0.15 ? `${p.k} ${fmtDur(m)}` : ""}
                </span>
              );
            })}
          </div>
          <div className="row small mono muted" style={{ justifyContent: "space-between", marginTop: 4 }}>
            <span>OUT {fmtHhmm(est("OUT"))}Z</span>
            <span>IN {fmtHhmm(est("IN"))}Z</span>
          </div>
        </div>
      ) : null}

      <Sub>Weights · tonnes</Sub>
      <div className="cols" style={{ ["--min" as string]: "320px" }}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col" className="num">
                  Est
                </th>
                <th scope="col" className="num">
                  <Tip tip="Operational maximum for this flight — may be lower than structural limits">Max</Tip>
                </th>
                <th scope="col" className="num">
                  Actual
                </th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {WEIGHT_ROWS.map((l) => {
                const r = w(l);
                return (
                  <tr key={l}>
                    <th scope="row">
                      <Tip tip={G[l]} title={l}>
                        {l}
                      </Tip>
                    </th>
                    <td className="num">
                      <V v={r?.est} w={4} />
                    </td>
                    <td className="num">
                      {l === "TOW" && towLimitedByLaw && r?.max ? (
                        <Tip tip={`Take-off weight is limited by the max landing weight: ${lawMax} + trip ${(trip! / 1000).toFixed(1)} t = ${towMax} t`} title="LAW-limited">
                          {r.max}
                        </Tip>
                      ) : (
                        <V v={r?.max} w={4} />
                      )}
                    </td>
                    <td className="num">
                      <Act label={`Actual ${l}`} value={actW[l] ?? ""} onChange={(v) => setActW({ ...actW, [l]: v.replace(/[^\d.]/g, "") })} w={5} inputMode="decimal" />
                    </td>
                    <td className="small">
                      {r?.note === "LDG" ? (
                        <label className="row" style={{ gap: 4 }}>
                          <Tip tip="Landing weight from the final load sheet">LDG</Tip>
                          <Act label="Actual landing weight" value={ldg} onChange={(v) => setLdg(v.replace(/[^\d.]/g, ""))} w={4} inputMode="decimal" />
                        </label>
                      ) : r?.note ? (
                        <Tip tip={G["POSS EXTRA"]} title="POSS EXTRA">
                          {r.note}
                        </Tip>
                      ) : null}
                      {actW[l] && r?.max && Number(actW[l]) > Number(r.max) ? <Badge tone="red">Over max</Badge> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="stack">
          {["ZFW", "FUEL", "TOW", "LAW"].map((l) => {
            const r = w(l);
            const v = actW[l] ? Number(actW[l]) : r?.est ? Number(r.est) : null;
            return (
              <Gauge
                key={l}
                label={l}
                value={v}
                max={r?.max ? Number(r.max) : null}
                tip={`${G[l]}. ${actW[l] ? "Actual" : "Estimated"} against the maximum.`}
                display={<V v={v != null && r?.max ? `${v.toFixed(1)} / ${r.max}` : null} w={9} />}
              />
            );
          })}
          <Field label="Payload share of TOW" tip="Payload as a share of take-off weight">
            <V v={w("PAYLOAD")?.est && w("TOW")?.est ? `${((Number(w("PAYLOAD")!.est) / Number(w("TOW")!.est)) * 100).toFixed(0)}%` : null} w={3} />
          </Field>
          <Field label="Avg pax + bags" tip="Payload per passenger (includes baggage and cargo)" sub="kg">
            <V v={w("PAYLOAD")?.est && w("PAX")?.est ? Math.round((Number(w("PAYLOAD")!.est) * 1000) / Number(w("PAX")!.est)) : null} w={3} />
          </Field>
        </div>
      </div>

      <Sub>Terrain clearance check</Sub>
      {ofp ? (
        <ul className="pre" style={{ paddingLeft: 18 }}>
          {ofp.terrain.map((l, i) => {
            const k = l.split(" - ")[0];
            return (
              <li key={i}>
                <Tip tip={G[k]} title={k}>
                  {k}
                </Tip>
                {l.slice(k.length)}
              </li>
            );
          })}
        </ul>
      ) : (
        <V v={null} w={40} />
      )}
    </Section>
  );
}

/** Signed minute difference actual − estimated, choosing the nearest wrap. */
function signedClock(e: string, a: string) {
  const d = clockDiff(e, a)!;
  return d > 720 ? d - 1440 : d;
}
