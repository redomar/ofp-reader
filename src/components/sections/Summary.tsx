"use client";

import { useOfp } from "../context";
import { FlightStrip } from "../FlightStrip";
import { FlapBlank, ReplayFlapCode } from "../FlapCode";
import { Replay } from "../replay";
import { useStripMode } from "@/lib/stripPref";
import { countryLabel, icaoCountry } from "@/lib/ofp/icaoCountry";
import { useState } from "react";
import { Badge, Field, Gauge, Section, Sub, Tip, V } from "../ui";
import { G } from "@/lib/ofp/glossary";
import { clockDiff, fmtDate, fmtDur, fmtHhmm, fmtNum, fmtReg, fmtSigned, parseWind, pct, signed } from "@/lib/ofp/format";

export function WindArrow({ dir, size = 16, label }: { dir: number; size?: number; label?: string }) {
  // Arrow points where the wind blows TO (dir is where it comes FROM).
  return (
    <svg width={size} height={size} viewBox="-8 -8 16 16" role="img" aria-label={label ?? `Wind from ${dir}°`} style={{ flex: "none" }}>
      <g transform={`rotate(${dir + 180})`}>
        <path d="M0 -7 L4 1 L1 0 L1 7 L-1 7 L-1 0 L-4 1 Z" fill="var(--blue)" />
      </g>
    </svg>
  );
}

export function SummarySection({ no }: { no: number }) {
  const { ofp } = useOfp();
  const h = ofp?.header;
  const dep = ofp?.wx.airports.find((a) => a.role === "Departure");
  const arr = ofp?.wx.airports.find((a) => a.role === "Destination");
  const [depName, arrName] = (() => {
    if (dep?.name || arr?.name) return [dep?.name ?? null, arr?.name ?? null];
    return [h?.routeName ?? null, null];
  })();
  const [stripMode] = useStripMode();
  const block = clockDiff(h?.outTime, h?.inTime);
  const air = clockDiff(h?.offTime, h?.onTime);
  const wind = parseWind(h?.avgWind);
  const wc = signed(h?.avgWc);
  const isa = signed(h?.avgIsa);
  const eff = pct(h?.gcDist, h?.gndDist);
  const unit = h?.unit ?? "KGS";
  const kg = unit === "KGS" ? "kg" : "lb";

  const wRows = [
    { k: "TOW", est: h?.estTow, max: h?.maxTow },
    { k: "LAW", est: h?.estLaw, max: h?.maxLaw },
    { k: "ZFW", est: h?.estZfw, max: h?.maxZfw },
  ];

  return (
    <Section id="summary" no={no} title="OFP · Flight summary" meta={<span>PDF p.1</span>}>
      <div className="idbar">
        <span>
          <Tip tip="Flight number as scheduled" className="k">
            FLT
          </Tip>
          <V v={h?.flightNo} w={7} />
        </span>
        <span>
          <Tip tip={G["ATC C/S"]} title="ATC C/S" className="k">
            ATC C/S
          </Tip>
          <V v={h?.atcCallsign} w={6} />
        </span>
        <span>
          <span className="k">Date</span>
          <V v={h?.date && `${h.date}`} w={9} />
          {h?.date && <span className="small muted"> {fmtDate(h.date)}</span>}
        </span>
        <span>
          <span className="k">Reg</span>
          <V v={fmtReg(h?.reg)} w={6} />
        </span>
        <span>
          <Tip tip="ICAO aircraft type designator" className="k">
            Type
          </Tip>
          <V v={h?.acType} w={4} />
        </span>
        <span>
          <Tip tip={G.OFP} title="OFP" className="k">
            OFP
          </Tip>
          <V v={h?.ofpNo} w={1} />
        </span>
        <span>
          <Tip tip={G.RELEASE} title="RELEASE" className="k">
            Release
          </Tip>
          <V v={h?.releaseTime && `${h.releaseTime}Z ${h.releaseDate ?? ""}`} w={12} />
        </span>
      </div>

      <Replay className="strip">
        <div className="strip-apt">
          <div className="strip-icao">
            {h?.dep ? <ReplayFlapCode code={h.dep} label={`Departure ${h.dep}`} /> : <FlapBlank />}
            {h?.dep && <IataTag icao={h.dep} iata={h.depIata} side="dep" />}
          </div>
          <div className="strip-name">
            <V v={depName} w={14} />
          </div>
          <div className="strip-time">
            <Tip tip={G.OUT} title="OUT">
              OUT
            </Tip>{" "}
            <V v={fmtHhmm(h?.outTime)} w={5} />Z ·{" "}
            <Tip tip={G.OFF} title="OFF">
              OFF
            </Tip>{" "}
            <V v={fmtHhmm(h?.offTime)} w={5} />Z
          </div>
        </div>
        <div className="strip-mid">
          <FlightStrip ofp={ofp} mode={stripMode} />
          <div className="mid-label">
            <Tip tip="Block time: OUT → IN (gate to gate)">BLOCK</Tip> <V v={fmtDur(block)} w={5} /> ·{" "}
            <Tip tip="Air time: OFF → ON (wheels up to touchdown)">AIR</Tip> <V v={fmtDur(air)} w={5} />
          </div>
          <div className="mid-label">
            <V v={h?.gndDist != null ? `${h.gndDist} NM` : null} w={6} /> ground ·{" "}
            <V v={h?.aircraft} w={14} />
          </div>
        </div>
        <div className="strip-apt arr">
          <div className="strip-icao">
            {h?.arr && <IataTag icao={h.arr} iata={h.arrIata} side="arr" />}
            {h?.arr ? <ReplayFlapCode code={h.arr} label={`Arrival ${h.arr}`} /> : <FlapBlank />}
          </div>
          <div className="strip-name">
            <V v={arrName} w={14} />
          </div>
          <div className="strip-time">
            <Tip tip={G.ON} title="ON">
              ON
            </Tip>{" "}
            <V v={fmtHhmm(h?.onTime)} w={5} />Z ·{" "}
            <Tip tip={G.IN} title="IN">
              IN
            </Tip>{" "}
            <V v={fmtHhmm(h?.inTime)} w={5} />Z
          </div>
        </div>
      </Replay>

      <div className="fields">
        <Field label="CRZ SYS" tip={G["CRZ SYS"]}>
          <V v={h?.crzSys ?? (h?.costIndex ? `CI ${h.costIndex}` : null)} w={5} />
        </Field>
        <Field label="Cost index" tip={G.CI} sub={h?.costIndex ? (Number(h.costIndex) <= 20 ? "economy" : Number(h.costIndex) >= 60 ? "fast" : "balanced") : null}>
          <V v={h?.costIndex} w={3} />
        </Field>
        <Field label="GND DIST" tip={G["GND DIST"]} sub="NM">
          <V v={h?.gndDist} w={4} />
        </Field>
        <Field label="AIR DIST" tip={G["AIR DIST"]} sub={h?.airDist != null && h.gndDist ? `${fmtSigned(h.airDist - h.gndDist)} vs ground` : "NM"}>
          <V v={h?.airDist} w={4} />
        </Field>
        <Field label="G/C DIST" tip={G["G/C DIST"]} sub={eff != null ? `route ${eff.toFixed(0)}% direct` : "NM"}>
          <V v={h?.gcDist} w={4} />
        </Field>
        <Field label="AVG WIND" tip={G["AVG WIND"]}>
          {wind && <WindArrow dir={wind.dir} label={`Average wind from ${wind.dir} degrees at ${wind.spd} knots`} />}
          <V v={h?.avgWind} w={7} />
        </Field>
        <Field
          label="AVG W/C"
          tip={G["AVG W/C"]}
          sub={wc != null ? (wc < 0 ? `${Math.abs(wc)} kt headwind` : wc > 0 ? `${wc} kt tailwind` : "calm") : null}
        >
          <V v={h?.avgWc} w={4} />
        </Field>
        <Field label="AVG ISA" tip={G["AVG ISA"]} sub={isa != null ? `ISA ${fmtSigned(isa, " °C")}` : null}>
          <V v={h?.avgIsa} w={4} />
        </Field>
        <Field label={`AVG FF ${unit}/HR`} tip={G["AVG FF"]}>
          <V v={fmtNum(h?.avgFf)} w={5} />
        </Field>
        <Field label="FUEL BIAS" tip={G["FUEL BIAS"]} sub={h?.fuelBias ? `${fmtSigned(signed(h.fuelBias))}% burn` : null}>
          <V v={h?.fuelBias} w={5} />
        </Field>
        <Field label="STA" tip={G.STA} sub={h?.sta && h.inTime ? onTimeText(h.inTime, h.sta) : null}>
          <V v={h?.sta && `${fmtHhmm(h.sta)}Z`} w={5} />
        </Field>
        <Field label="CTOT" tip={G.CTOT}>
          <V v={h?.ctot} w={5} />
        </Field>
        <Field label="ALTN" tip={G.ALTN} sub={ofp?.wx.airports.find((a) => a.icao === h?.altn)?.name}>
          <V v={h?.altn} w={4} />
        </Field>
        <Field label="TKOF ALTN" tip={G["TKOF ALTN"]}>
          <V v={h?.tkofAltn} w={4} />
        </Field>
      </div>

      <div className="cols" style={{ ["--min" as string]: "300px", marginTop: 16 }}>
        <div>
          <Sub>Weights · {kg}</Sub>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col" />
                  <th scope="col" className="num">
                    <Tip tip={G.MAXIMUM} title="MAXIMUM">
                      Maximum
                    </Tip>
                  </th>
                  <th scope="col" className="num">
                    <Tip tip={G.ESTIMATED} title="ESTIMATED">
                      Estimated
                    </Tip>
                  </th>
                  <th scope="col" className="num">
                    Margin
                  </th>
                </tr>
              </thead>
              <tbody>
                {wRows.map((r) => (
                  <tr key={r.k}>
                    <th scope="row">
                      <Tip tip={G[r.k]} title={r.k}>
                        {r.k}
                      </Tip>
                    </th>
                    <td className="num">
                      <V v={fmtNum(r.max)} w={6} />
                    </td>
                    <td className="num">
                      <V v={fmtNum(r.est)} w={6} />
                    </td>
                    <td className="num">
                      <V v={r.est != null && r.max != null ? fmtNum(r.max - r.est) : null} w={5} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="stack" style={{ marginTop: 10 }}>
            {wRows.map((r) => (
              <Gauge
                key={r.k}
                label={r.k}
                value={r.est ?? null}
                max={r.max ?? null}
                tip={`${G[r.k]}. Bar shows estimated as a share of maximum.`}
                display={<V v={r.est != null && r.max ? `${((r.est / r.max) * 100).toFixed(1)}%` : null} w={5} />}
              />
            ))}
          </div>
        </div>
        <div>
          <Sub>Cruise plan</Sub>
          <div className="fields" style={{ gridTemplateColumns: "1fr" }}>
            <Field label="FL STEPS" tip={G["FL STEPS"]}>
              {h?.flSteps.length ? (
                <span className="row" style={{ gap: 6 }}>
                  {h.flSteps.map((s, i) => (
                    <span key={i} className="row" style={{ gap: 6 }}>
                      {i > 0 && <span aria-hidden="true">→</span>}
                      <Badge tone="mag" tip={`From ${s.fix} cruise at flight level ${Number(s.fl)} (${(Number(s.fl) * 100).toLocaleString("en-GB")} ft)`}>
                        {s.fix} · FL{Number(s.fl)}
                      </Badge>
                    </span>
                  ))}
                </span>
              ) : (
                <V v={null} w={18} />
              )}
            </Field>
            <Field label="DISP RMKS" tip={G["DISP RMKS"]}>
              {h?.dispRmks.length ? (
                <ul className="rmks">
                  {h.dispRmks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <V v={null} w={24} />
              )}
            </Field>
            <Field label="WX PROG / OBS" tip={`${G["WX PROG"]}. ${G.OBS}`}>
              <span className="row" style={{ gap: 4 }}>
                {h?.wxProg.length ? h.wxProg.map((t) => <span key={"p" + t} className="code">{t}</span>) : <V v={null} w={14} />}
                <span className="muted small">obs</span>
                {h?.wxObs.length ? h.wxObs.map((t, i) => <span key={"o" + i} className="code">{t}</span>) : <V v={null} w={14} />}
              </span>
            </Field>
            <Field label="Route name">
              <V v={h?.routeName} w={30} />
            </Field>
          </div>
        </div>
      </div>
    </Section>
  );
}

/** Country flag stacked above the IATA code, beside the split-flap ICAO tiles. */
function IataTag({ icao, iata, side }: { icao: string; iata: string | null; side: "dep" | "arr" }) {
  const iso = icaoCountry(icao);
  const [broken, setBroken] = useState(false);
  const label = iso ? countryLabel(icao, iso) : null;
  return (
    <span className={`iata-stack ${side}`}>
      {iso && !broken && (
        <Tip tip={label} title={iso} plain>
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG from /public/flags */}
          <img className="flag" src={`/flags/${iso.toLowerCase()}.svg`} alt={label?.split(" · ")[0] ?? iso} width={21} height={16} onError={() => setBroken(true)} />
        </Tip>
      )}
      {iata && <span className="small muted mono">{side === "dep" ? `/${iata}` : `${iata}/`}</span>}
    </span>
  );
}

function onTimeText(inTime: string, sta: string) {
  const d = clockDiff(sta, inTime);
  if (d == null) return null;
  const early = d > 720 ? 1440 - d : 0;
  if (early) return `${early} min early`;
  return d === 0 ? "on schedule" : `${d} min late`;
}
