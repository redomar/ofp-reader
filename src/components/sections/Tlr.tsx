"use client";

import { useState } from "react";
import { useFieldGroup, useOfp } from "../context";
import { Act, Badge, Field, Gauge, Section, Sub, Tip, V, cx } from "../ui";
import { Replay } from "../replay";
import { G } from "@/lib/ofp/glossary";
import { components } from "@/lib/ofp/metar";
import { fmtNum, pageOf } from "@/lib/ofp/format";
import type { KeyedRow, LandingGrid, Table } from "@/lib/ofp/types";
import { WindArrow } from "../WindArrow";

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

/** "070/15", "07015", "070 15KT" → wind; anything else → null. */
function windOf(v?: string | null) {
  const m = v?.replace(/\s+/g, " ").match(/^(\d{3})\D{0,2}(\d{1,3})/);
  return m ? { dir: Number(m[1]), spd: Number(m[2]) } : null;
}

/** Typed runway → TLR form: "rwy 9" → "09", "32 l" → "32L". */
const normRwy = (v: string) => {
  const m = v.toUpperCase().replace(/^RWY\s*/, "").replace(/\s+/g, "").match(/^(\d{1,2})([LRC]?)$/);
  return m ? m[1].padStart(2, "0") + m[2] : v.toUpperCase().trim();
};

/** TLR prints V-speeds ≥ 100 kt with the hundreds digit dropped in the planned line. */
function vs(v?: string | null) {
  if (!v) return { shown: null as string | null, full: null as number | null };
  const n = Number(v);
  return { shown: v, full: n < 100 ? n + 100 : n };
}

function WindComp({ w, rwy, source = "the planned (magnetic) wind" }: { w: { dir: number; spd: number } | null; rwy: string | null | undefined; source?: string }) {
  const h = rwyHdg(rwy);
  if (!w || h == null) return null;
  const c = components(w.dir, w.spd, h);
  return (
    <span className="row" style={{ gap: 6 }}>
      <Badge tone={c.head >= 0 ? "green" : "red"} tip={`Along-runway component from ${source}`}>
        {c.head >= 0 ? `${c.head} kt head` : `${-c.head} kt tail`}
      </Badge>
      <Badge tone={Math.abs(c.cross) > 20 ? "amber" : "ink"} tip="Crosswind component">
        {Math.abs(c.cross)} kt X-wind {c.cross > 0 ? "from R" : c.cross < 0 ? "from L" : ""}
      </Badge>
    </span>
  );
}

function PerfTable({
  t,
  planned,
  actual,
  onActual,
  verb,
}: {
  t: Table;
  planned?: string | null;
  /** The runway marked as actually used (radio in the last column). */
  actual?: string | null;
  onActual?: (rwy: string | null) => void;
  verb?: string;
}) {
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
            {onActual && (
              <th scope="col" className="rwy-pick">
                <Tip tip={`The runway you actually ${verb}. Planned stays blue; your pick is green and fills the actual RWY box. Click it again to clear.`} title="Actual">
                  ACT
                </Tip>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={i} className={cx(r[0] === planned && "planned", onActual && r[0] === actual && "actual")}>
              {r.map((c, j) => {
                const col = t.columns[j];
                if (j === 0)
                  return (
                    <th key={j} scope="row">
                      {c} {r[0] === planned && <span className="sr-only">(planned)</span>}
                      {onActual && r[0] === actual && <span className="sr-only">(actual)</span>}
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
              {onActual && (
                <td className="rwy-pick">
                  <input
                    type="radio"
                    name={`act-${verb}-${t.title}`}
                    checked={r[0] === actual}
                    aria-label={`${verb} runway ${r[0]}`}
                    onChange={() => onActual(r[0])}
                    onClick={() => r[0] === actual && onActual(null)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * What the TLR says about the runway actually used: how it compares with the plan, wind
 * components (from the actual wind if typed, else the planned wind), and that runway's
 * own limits against the planned weight.
 */
function ActualRunway({
  kind,
  rwy,
  planned,
  acars,
  perf,
  grid,
  oat,
  wind,
  distRow,
}: {
  kind: "to" | "ld";
  rwy: string;
  planned: KeyedRow | null;
  acars?: Table;
  perf?: Table;
  grid?: LandingGrid | null;
  oat?: string;
  wind?: string;
  distRow?: string[];
}) {
  const same = planned?.PRWY === rwy;
  const acRow = acars?.rows.find((r) => r[0] === rwy);
  const col = (t: Table | undefined, row: string[] | undefined, name: string) => (t && row ? row[t.columns.indexOf(name)] : undefined);
  const length = Number(col(acars, acRow, "LENGTH")) || null;
  const notes = col(acars, acRow, "NOTES");
  const actualWind = windOf(wind);
  const w = actualWind ?? pwind(planned?.PWIND);
  const weightKey = kind === "to" ? "PTOW" : "PLDW";
  const plannedW = x10(planned?.[weightKey]);
  const pfRow = perf?.rows.find((r) => r[0] === rwy);
  // Take-off: MTOW from the performance table in view, else the ACARS limit. Landing: the ACARS limit.
  const maxW = kind === "to" ? (x10(col(perf, pfRow, "MTOW")) ?? x10(col(acars, acRow, "PMTOW"))) : x10(col(acars, acRow, "PMRLW"));
  const margin = maxW != null && plannedW != null ? maxW - plannedW : null;
  // Landing grid: max landing weight for this runway at the actual OAT (nearest row), else the planned OAT.
  const gRwy = grid?.runways.find((r) => r.rwy === rwy);
  const oatN = Number(oat);
  const cell = gRwy
    ? oat && !Number.isNaN(oatN)
      ? [...gRwy.cells].sort((a, b) => Math.abs(Number(a.oat) - oatN) - Math.abs(Number(b.oat) - oatN))[0]
      : gRwy.cells.find((c) => c.planned)
    : undefined;
  const found = !!(acRow || pfRow || gRwy);
  const verb = kind === "to" ? "Took off from" : "Landed on";
  return (
    <div className="act-rwy" role="status">
      <span className="act-rwy-name">
        {verb} <b>{rwy}</b>
      </span>
      {planned?.PRWY && (
        <Badge tone={same ? "green" : "amber"} tip={same ? "Same runway as the plan" : `The plan used ${planned.PRWY}; the figures below are for ${rwy}`}>
          {same ? "as planned" : `planned ${planned.PRWY}`}
        </Badge>
      )}
      {!found && <Badge tone="red" tip="This runway isn't in the TLR, so there are no figures for it: check performance separately">not in the analysis</Badge>}
      <WindComp w={w} rwy={rwy} source={actualWind ? `the actual wind ${wind}` : "the planned (magnetic) wind"} />
      {perf && pfRow && (
        <span className="small">
          <Tip tip={`From ${perf.title}`}>FLEX {col(perf, pfRow, "MT")}°</Tip> · V1/VR/V2 {col(perf, pfRow, "V1")}/{col(perf, pfRow, "VR")}/{col(perf, pfRow, "V2")}
        </span>
      )}
      {maxW != null && (
        <span className="small">
          {kind === "to" ? "MTOW" : "MLW"} {fmtNum(maxW)} kg{" "}
          {margin != null && (
            <Badge tone={margin >= 0 ? "green" : "red"} tip={`Against the planned ${weightKey} of ${fmtNum(plannedW!)} kg`}>
              {margin >= 0 ? `${fmtNum(margin)} kg margin` : `${fmtNum(-margin)} kg over`}
            </Badge>
          )}
        </span>
      )}
      {cell && (
        <span className="small">
          <Tip tip={`Max landing weight on ${rwy} at ${cell.oat} °C (${oat ? "nearest to the actual OAT" : "planned OAT"}); F = limited`}>MLW @ {cell.oat}°C</Tip> {cell.value}
        </span>
      )}
      {length && <span className="small">{fmtNum(length)} ft</span>}
      {notes && <span className="small mono">{notes}</span>}
      {kind === "ld" && !same && distRow && <span className="small muted">Estimated landing distance below the planned one.</span>}
    </div>
  );
}

/** Factored landing distance (dry, wet) against runway length, one bar each with the figure inside. */
function LdgDistance({ title, dry, wet, length, estimate = false, tip }: { title: string; dry: number; wet: number; length: number; estimate?: boolean; tip?: string }) {
  return (
    <>
      <span className="field-label">{tip ? <Tip tip={tip}>{title}</Tip> : title}</span>
      {[
        ["Dry", dry],
        ["Wet", wet],
      ].map(([k, d]) => {
        const p = ((d as number) / length) * 100;
        const fill = Math.min(100, p);
        const colour = p > 90 ? "var(--red)" : p > 75 ? "var(--amber)" : "var(--green)";
        const text = `${k} ${fmtNum(d as number)} ft · ${p.toFixed(0)}%`;
        // The label is drawn twice across the whole bar: ink where it's over the empty track,
        // sheet-coloured (clipped to the fill) where it's over the bar, so it reads at any length.
        return (
          <Replay key={k as string}>
            <div className={cx("rwybar", estimate && "est")} style={{ ["--fill" as string]: `${fill}%`, ["--barc" as string]: colour }} role="meter" aria-label={`${estimate ? "Estimated " : ""}${k} factored distance ${d} of ${length} ft`} aria-valuemin={0} aria-valuemax={length} aria-valuenow={d as number}>
              <span className="rwybar-fill a-grow-x" />
              <span className="rwybar-lbl" aria-hidden="true">
                {text}
              </span>
              <span className="rwybar-lbl on" aria-hidden="true">
                {text}
              </span>
            </div>
          </Replay>
        );
      })}
    </>
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
                <WindArrow kind="PWIND" dir={w.dir} spd={w.spd} label={`Wind from ${w.dir} degrees magnetic at ${w.spd} knots`} />
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
  // The actual runways live in the "actual" rows' RWY box, so typing there and the radios agree.
  const toAct = useFieldGroup("tlr.takeoff", "Runway analysis");
  const ldAct = useFieldGroup("tlr.landing", "Runway analysis");
  const toRwy = toAct.get("RWY") ? normRwy(toAct.get("RWY")) : null;
  const ldRwy = ldAct.get("RWY") ? normRwy(ldAct.get("RWY")) : null;
  // Estimated factored landing distance on a selected (non-planned) runway: the planned row
  // corrected by the per-knot head/tailwind rows for that runway's wind component.
  const ldEst = (() => {
    if (!ldRwy || ldRwy === ld?.PRWY || !plannedDistRow || !dist) return null;
    const length = Number(acarsLd?.rows.find((r) => r[0] === ldRwy)?.[1]);
    const h = rwyHdg(ldRwy);
    if (!length || h == null) return null;
    const actualWind = windOf(ldAct.get("WIND"));
    const w = actualWind ?? pwind(ld?.PWIND);
    const head = w ? components(w.dir, w.spd, h).head : 0;
    const per = dist.rows.find((r) => r[0]?.startsWith(head >= 0 ? "HW" : "TW"));
    const adj = (i: number) => Math.round(Number(plannedDistRow[i]) + (per ? Number(per[i]) * Math.abs(head) : 0));
    const windNote = !w || head === 0 ? "calm wind" : `${Math.abs(head)} kt ${head > 0 ? "headwind" : "tailwind"} from the ${actualWind ? "actual" : "planned"} wind`;
    return { dry: adj(5), wet: adj(6), length, windNote };
  })();
  const setToRwy = (r: string | null) => toAct.put("RWY", "Takeoff actual RWY", r ?? "");
  const setLdRwy = (r: string | null) => ldAct.put("RWY", "Landing actual RWY", r ?? "");

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
      {toRwy && <ActualRunway kind="to" rwy={toRwy} planned={to} acars={acarsTo} perf={toPerf[perfIdx]} wind={toAct.get("WIND")} />}

      <div className="cols" style={{ ["--min" as string]: "340px", marginTop: 14 }}>
        {acarsTo ? <PerfTable t={acarsTo} planned={to?.PRWY} actual={toRwy} onActual={setToRwy} verb="took off from" /> : <V v={null} w={30} />}
        <div>
          <div className="row" role="group" aria-label="Performance table" style={{ marginBottom: 8, gap: 6 }}>
            {toPerf.map((t, i) => (
              <button key={t.title} type="button" className="toggle" aria-pressed={perfIdx === i} onClick={() => setPerfIdx(i)}>
                {t.title.replace(/ - CALM WIND/, "").replace(/RWY - /, "· ")}
              </button>
            ))}
          </div>
          {toPerf[perfIdx] ? <PerfTable t={toPerf[perfIdx]} planned={to?.PRWY} actual={toRwy} onActual={setToRwy} verb="took off from" /> : <V v={null} w={30} />}
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
      {ldRwy && <ActualRunway kind="ld" rwy={ldRwy} planned={ld} acars={acarsLd} grid={grid} oat={ldAct.get("OAT")} wind={ldAct.get("WIND")} distRow={plannedDistRow} />}

      <div className="cols" style={{ ["--min" as string]: "340px", marginTop: 14 }}>
        {acarsLd ? <PerfTable t={acarsLd} planned={ld?.PRWY} actual={ldRwy} onActual={setLdRwy} verb="landed on" /> : <V v={null} w={30} />}
        <div>
          {plannedDistRow && ldRwyLen ? (
            <div>
              <LdgDistance title={`Planned runway ${ld?.PRWY} — factored landing distance vs length`} dry={Number(plannedDistRow[5])} wet={Number(plannedDistRow[6])} length={ldRwyLen} />
              <p className="small muted" style={{ margin: "4px 0 0" }}>
                Runway {fmtNum(ldRwyLen)} ft. Margin wet {fmtNum(ldRwyLen - Number(plannedDistRow[6]))} ft (distances assumed ft, as runway lengths).
              </p>
              {ldEst && (
                <>
                  <hr className="ldg-split" />
                  <LdgDistance
                    estimate
                    title={`Selected runway ${ldRwy} — estimated factored landing distance`}
                    dry={ldEst.dry}
                    wet={ldEst.wet}
                    length={ldEst.length}
                    tip={`From the planned-runway table (planned landing weight, calm wind), corrected for ${ldEst.windNote} on ${ldRwy}. Not certified for ${ldRwy}: slope, elevation and declared distances may differ. Check with your performance tool.`}
                  />
                  <p className="small muted" style={{ margin: "4px 0 0" }}>
                    Estimate · runway {fmtNum(ldEst.length)} ft · {ldEst.windNote}. Margin wet {fmtNum(ldEst.length - ldEst.wet)} ft.
                  </p>
                </>
              )}
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
