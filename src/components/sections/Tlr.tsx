"use client";

import { useState } from "react";
import { useFieldGroup, useOfp } from "../context";
import { Act, Badge, Field, Gauge, Section, Sub, Tip, V, cx } from "../ui";
import { Replay } from "../replay";
import { G } from "@/lib/ofp/glossary";
import { components } from "@/lib/ofp/metar";
import { fmtNum, pageOf } from "@/lib/ofp/format";
import type { KeyedRow, Table } from "@/lib/ofp/types";
import { WindArrow } from "./Summary";

const LIMIT: Record<string, string> = {
  AFM: "Limited by the certified (AFM) structural maximum — not by the runway",
  FLD: "Limited by field length",
  OBS: "Limited by obstacles in the departure path",
  CLB: "Limited by climb gradient",
  TIRE: "Limited by tyre speed",
  BRKE: "Limited by brake energy",
};

const x10 = (v?: string | null) => (v && /^\d+$/.test(v) ? Number(v) * 10 : null);

function pwind(v?: string | null) {
  const m = v?.match(/^(\d{3})M(\d{2,3})$/);
  return m ? { dir: Number(m[1]), spd: Number(m[2]) } : null;
}

function rwyHdg(r?: string | null) {
  const m = r?.match(/^(\d{2})/);
  return m ? Number(m[1]) * 10 : null;
}

/** TLR prints V-speeds ≥ 100 kt with the hundreds digit dropped in the planned line. */
function vs(v?: string | null) {
  if (!v) return { shown: null as string | null, full: null as number | null };
  const n = Number(v);
  return { shown: v, full: n < 100 ? n + 100 : n };
}

function WindComp({ w, rwy }: { w: { dir: number; spd: number } | null; rwy: string | null | undefined }) {
  const h = rwyHdg(rwy);
  if (!w || h == null) return null;
  const c = components(w.dir, w.spd, h);
  return (
    <span className="row" style={{ gap: 6 }}>
      <Badge tone={c.head >= 0 ? "green" : "red"} tip="Along-runway component from the planned (magnetic) wind">
        {c.head >= 0 ? `${c.head} kt head` : `${-c.head} kt tail`}
      </Badge>
      <Badge tone={Math.abs(c.cross) > 20 ? "amber" : "ink"} tip="Crosswind component">
        {Math.abs(c.cross)} kt X-wind {c.cross > 0 ? "from R" : c.cross < 0 ? "from L" : ""}
      </Badge>
    </span>
  );
}

function PerfTable({ t, planned }: { t: Table; planned?: string | null }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <caption>{t.title}</caption>
        <thead>
          <tr>
            {t.columns.map((c) => (
              <th key={c} scope="col" className={/^(MTOW|MT|FLP|V1|VR|V2|LENGTH|PMTOW|PMRLW|ACARS)$/.test(c) ? "num" : undefined}>
                <Tip tip={G[c]} title={c}>
                  {c}
                </Tip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={i} className={cx(r[0] === planned && "planned")}>
              {r.map((c, j) => {
                const col = t.columns[j];
                if (j === 0)
                  return (
                    <th key={j} scope="row">
                      {c} {r[0] === planned && <span className="sr-only">(planned)</span>}
                    </th>
                  );
                if (col === "LIMIT")
                  return (
                    <td key={j}>
                      <Tip tip={LIMIT[c]} plain>
                        <span className={`badge ${c === "AFM" ? "b-ink" : "b-amber"}`}>{c}</span>
                      </Tip>
                    </td>
                  );
                if (col === "MTOW" || col === "PMTOW" || col === "PMRLW")
                  return (
                    <td key={j} className="num">
                      {fmtNum(x10(c))}
                    </td>
                  );
                return (
                  <td key={j} className={/^\d/.test(c) && col !== "CONFIG" && col !== "NOTES" ? "num" : undefined}>
                    {c}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActualRow({ cols, label }: { cols: string[]; label: string }) {
  const g = useFieldGroup(`tlr.${label.split(" ")[0].toLowerCase()}`, "Runway analysis");
  return (
    <div className="tbl-wrap" style={{ marginTop: 10 }}>
      <table className="tbl">
        <caption>{label} — fill in from ATIS / final figures</caption>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} scope="col">
                <Tip tip={G[c] ?? (c === "PWR" ? "Thrust setting (FLEX / TOGA)" : c === "CONFIG/CONDITION" ? "Configuration and runway condition" : undefined)} title={c}>
                  {c}
                </Tip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {cols.map((c) => (
              <td key={c}>
                <Act label={`${label} ${c}`} value={g.get(c)} onChange={(v) => g.put(c, `${label} ${c}`, v)} w={c.includes("CONFIG") ? 12 : c === "WIND" ? 6 : 4} inputMode="text" />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Planned({ p, kind, fallback }: { p: KeyedRow | null; kind: "to" | "ld"; fallback: string[] }) {
  const w = pwind(p?.PWIND);
  const keys = p ? Object.keys(p) : fallback;
  return (
    <div className="fields">
      {keys
        .filter((k) => !["V1", "VR", "V2"].includes(k))
        .map((k) => {
          const v = p?.[k] ?? null;
          let shown: React.ReactNode = v;
          let sub: React.ReactNode = null;
          if (v && ["PMRTW", "PTOW", "MFPTW", "PMRLW", "PLDW"].includes(k)) {
            shown = fmtNum(x10(v));
            sub = "kg";
          }
          if (k === "PWIND" && w) {
            shown = (
              <>
                <WindArrow dir={w.dir} label={`Wind from ${w.dir} degrees magnetic at ${w.spd} knots`} />
                {v}
              </>
            );
            sub = `${w.dir}°M / ${w.spd} kt`;
          }
          if (k === "MT" && v) sub = "°C FLEX";
          if (k === "POAT" && v) sub = "°C";
          if (k === "PQNH" && v) sub = "hPa";
          if (k === "LIMIT" && v) shown = <Badge tone={v === "AFM" ? "ink" : "amber"} tip={LIMIT[v]}>{v}</Badge>;
          return (
            <Field key={k} label={k} tip={G[k]} sub={sub} className={k === "PRWY" ? "field-lg" : undefined}>
              <V v={shown} w={4} />
            </Field>
          );
        })}
      {kind === "to" || kind === "ld" ? (
        <Field label="Wind components" tip="Computed from the planned wind and the runway's magnetic heading (runway number × 10)">
          {p ? <WindComp w={w} rwy={p.PRWY} /> : <V v={null} w={14} />}
        </Field>
      ) : null}
    </div>
  );
}

export function TlrSection({ no }: { no: number }) {
  const { ofp } = useOfp();
  const tlr = ofp?.tlr;
  const to = tlr?.takeoff.planned ?? null;
  const ld = tlr?.landing.planned ?? null;
  const toPerf = tlr?.takeoff.tables.filter((t) => t.columns.includes("CONFIG")) ?? [];
  const [perfIdx, setPerfIdx] = useState(0);
  const acarsTo = tlr?.takeoff.tables.find((t) => /ACARS/.test(t.title));
  const acarsLd = tlr?.landing.tables.find((t) => /ACARS/.test(t.title));
  const grid = tlr?.landing.grid;
  const dist = tlr?.landing.distance;
  const plannedDistRow = dist?.rows.find((r) => r[0] === "/");
  const ldRwyLen = Number(acarsLd?.rows.find((r) => r[0] === ld?.PRWY)?.[1]);
  const ac = tlr?.header.find((h) => h.startsWith("A/C"))?.match(/BEW\/CG\s+(\d+)\/(\S+)/);

  return (
    <Section id="tlr" no={no} title="Runway analysis" meta={<span>TLR · PDF p.{pageOf(ofp?.pages, /TAKEOFF AND LANDING REPORT/) ?? 10}</span>}>
      <div className="stack small mono" style={{ gap: 2, marginBottom: 12 }}>
        {tlr?.header.length ? tlr.header.map((h) => <span key={h}>{h}</span>) : <V v={null} w={50} />}
        {ac && (
          <span className="muted" style={{ fontFamily: "var(--font-sans)" }}>
            <Tip tip="Basic Empty Weight / centre of gravity used for the analysis">BEW</Tip> {fmtNum(Number(ac[1]))} kg
          </span>
        )}
      </div>

      <Sub>Takeoff · planned</Sub>
      <div className="cols" style={{ ["--min" as string]: "300px" }}>
        <div className="stack">
          <Replay>
          <div className="vspeeds" role="group" aria-label="Planned V-speeds">
            {(["V1", "VR", "V2"] as const).map((k, i) => {
              const s = vs(to?.[k]);
              return (
                <div className="vspeed a-rise" key={k} style={{ ["--i" as string]: i }}>
                  <Tip tip={G[k]} title={k} plain>
                    <span className="k">{k}</span>
                  </Tip>
                  <span className="val">
                    <V v={s.full} w={3} />
                  </span>
                  <span className="u">{s.shown && Number(s.shown) < 100 ? <Tip tip={`Printed as "${s.shown}" — the TLR drops the hundreds digit`}>kt · printed {s.shown}</Tip> : "kt"}</span>
                </div>
              );
            })}
            <div className="vspeed a-rise" style={{ ["--i" as string]: 3 }}>
              <Tip tip={G.MT} title="FLEX" plain>
                <span className="k">FLEX</span>
              </Tip>
              <span className="val">
                <V v={to?.MT} w={2} />
              </span>
              <span className="u">°C</span>
            </div>
            <div className="vspeed a-rise" style={{ ["--i" as string]: 4 }}>
              <Tip tip={G.FLP} title="FLAP" plain>
                <span className="k">FLAP</span>
              </Tip>
              <span className="val">
                <V v={to?.FLP} w={1} />
              </span>
              <span className="u">CONF</span>
            </div>
          </div>
          </Replay>
          <Gauge
            label="PTOW"
            value={x10(to?.PTOW)}
            max={x10(to?.MFPTW)}
            tip="Planned take-off weight against the maximum flex take-off weight for these conditions"
            display={<V v={to ? `${fmtNum(x10(to.PTOW))} / ${fmtNum(x10(to.MFPTW))}` : null} w={13} />}
          />
          {tlr?.takeoff.rmks.length ? (
            <div className="row">
              <span className="field-label" style={{ margin: 0 }}>
                RMKS
              </span>
              {tlr.takeoff.rmks.map((r) => (
                <Badge key={r} tone="blue">
                  {r}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <Planned p={to} kind="to" fallback={["APT", "PRWY", "POAT", "PWIND", "PQNH", "PMRTW", "FLP", "MT", "PTOW", "MFPTW", "LIMIT"]} />
      </div>
      <ActualRow label="Takeoff actual" cols={["RWY", "OAT", "WIND", "QNH", "MRTW", "FLP", "V1", "VR", "V2", "PWR", "CONFIG/CONDITION"]} />

      <div className="cols" style={{ ["--min" as string]: "340px", marginTop: 14 }}>
        {acarsTo ? <PerfTable t={acarsTo} planned={to?.PRWY} /> : <V v={null} w={30} />}
        <div>
          <div className="row" role="group" aria-label="Performance table" style={{ marginBottom: 8, gap: 6 }}>
            {toPerf.map((t, i) => (
              <button key={t.title} type="button" className="toggle" aria-pressed={perfIdx === i} onClick={() => setPerfIdx(i)}>
                {t.title.replace(/ - CALM WIND/, "").replace(/RWY - /, "· ")}
              </button>
            ))}
          </div>
          {toPerf[perfIdx] ? <PerfTable t={toPerf[perfIdx]} planned={to?.PRWY} /> : <V v={null} w={30} />}
        </div>
      </div>

      <Sub>Landing · planned</Sub>
      <Planned p={ld} kind="ld" fallback={["APT", "PRWY", "POAT", "PWIND", "PQNH", "PMRLW", "FLP", "PLDW", "LIMIT"]} />
      <div style={{ marginTop: 10 }}>
        <Gauge
          label="PLDW"
          value={x10(ld?.PLDW)}
          max={x10(ld?.PMRLW)}
          tip="Planned landing weight against the maximum landing weight for the runway"
          display={<V v={ld ? `${fmtNum(x10(ld.PLDW))} / ${fmtNum(x10(ld.PMRLW))}` : null} w={13} />}
        />
      </div>
      {tlr?.landing.rmks.length ? (
        <div className="row" style={{ marginTop: 8 }}>
          <span className="field-label" style={{ margin: 0 }}>
            RMKS
          </span>
          {tlr.landing.rmks.map((r) => (
            <Badge key={r} tone={/WET|CONTAM/.test(r) ? "amber" : "blue"}>
              {r}
            </Badge>
          ))}
        </div>
      ) : null}
      <ActualRow label="Landing actual" cols={["RWY", "OAT", "WIND", "QNH", "MRLW", "FLP", "VREF", "PWR", "CONFIG/CONDITION"]} />

      <div className="cols" style={{ ["--min" as string]: "340px", marginTop: 14 }}>
        {acarsLd ? <PerfTable t={acarsLd} planned={ld?.PRWY} /> : <V v={null} w={30} />}
        <div>
          {plannedDistRow && ldRwyLen ? (
            <div>
              <span className="field-label">Planned runway {ld?.PRWY} — factored landing distance vs length</span>
              {[
                ["Dry", Number(plannedDistRow[5])],
                ["Wet", Number(plannedDistRow[6])],
              ].map(([k, d]) => {
                const p = ((d as number) / ldRwyLen) * 100;
                return (
                  <Replay key={k as string}>
                    <div className="rwybar" role="meter" aria-label={`${k} factored distance ${d} of ${ldRwyLen} ft`} aria-valuemin={0} aria-valuemax={ldRwyLen} aria-valuenow={d as number}>
                      <span className="a-grow-x" style={{ width: `${Math.min(100, p)}%`, background: p > 90 ? "var(--red)" : p > 75 ? "var(--amber)" : "var(--green)" }}>
                        {k} {fmtNum(d as number)} ft · {p.toFixed(0)}%
                      </span>
                    </div>
                  </Replay>
                );
              })}
              <p className="small muted" style={{ margin: "4px 0 0" }}>
                Runway {fmtNum(ldRwyLen)} ft. Margin wet {fmtNum(ldRwyLen - Number(plannedDistRow[6]))} ft (distances assumed ft, as runway lengths).
              </p>
            </div>
          ) : (
            <V v={null} w={30} />
          )}
        </div>
      </div>

      {grid && grid.runways.length > 0 && (
        <>
          <Sub>
            <Tip tip="Maximum landing weight (×10 kg) per runway and OAT, dry / wet. Suffix letter = limiting factor (A = AFM structural, F = field length)." title={grid.title}>
              {grid.title}
            </Tip>
          </Sub>
          <div className="tbl-wrap">
            <table className="tbl">
              <caption>{grid.subtitle}</caption>
              <thead>
                <tr>
                  <th scope="col">OAT °C</th>
                  {grid.runways.map((r) => (
                    <th key={r.rwy} scope="col" className="num" style={r.rwy === ld?.PRWY ? { color: "var(--magenta)" } : undefined}>
                      {r.rwy} <span className="muted">· {r.length} ft</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.runways[0].cells.map((c, i) => (
                  <tr key={c.oat} className={c.planned ? "planned" : undefined}>
                    <th scope="row">
                      {c.oat}
                      {c.planned && <span className="small muted"> planned</span>}
                    </th>
                    {grid.runways.map((r) => {
                      const v = r.cells[i]?.value ?? "";
                      const limited = /F/.test(v);
                      return (
                        <td key={r.rwy} className="num" style={limited ? { color: "var(--amber)", fontWeight: 600 } : undefined}>
                          {v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {(["hw", "tw"] as const).map((k) => (
                  <tr key={k}>
                    <th scope="row">
                      <Tip tip={k === "hw" ? "Change in max landing weight per 10 kt headwind (dry / wet)" : "Change per 10 kt tailwind (dry / wet)"}>{k === "hw" ? "HW/10KT" : "TW/10KT"}</Tip>
                    </th>
                    {grid.runways.map((r) => (
                      <td key={r.rwy} className="num">
                        {r[k] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {dist && (
        <>
          <Sub>{dist.title}</Sub>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {dist.columns.slice(1).map((c) => (
                    <th key={c} scope="col" className="num">
                      <Tip tip={G[c.split(" ")[0]]} title={c}>
                        {c}
                      </Tip>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dist.rows.map((r, i) => (
                  <tr key={i} className={r[0] === "/" ? "planned" : undefined}>
                    {r[0] && r[0] !== "/" ? (
                      <th scope="row" colSpan={2}>
                        <Tip tip={r[0].startsWith("HW") ? "Distance change per kt of headwind" : "Distance change per kt of tailwind"}>{r[0]}</Tip>
                      </th>
                    ) : (
                      <>
                        <td className="num">
                          {fmtNum(x10(r[1]))}
                          {r[0] === "/" && <span className="small muted"> planned</span>}
                        </td>
                        <td className="num">{r[2]}</td>
                      </>
                    )}
                    {r.slice(3).map((c, j) => (
                      <td key={j} className="num">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="note">{tlr?.footer ?? "End of takeoff and landing report."}</p>
    </Section>
  );
}
