"use client";

import { useField, useOfp } from "../context";
import { Act, Badge, Field, Section, Sub, Tip, V, cx } from "../ui";
import { G } from "@/lib/ofp/glossary";
import { fmtDur, fmtHhmm, fmtNum, hhmmToMin } from "@/lib/ofp/format";

const SEGMENTS: { key: string; match: RegExp; color: string; ink: string; tip: string }[] = [
  { key: "TRIP", match: /^TRIP$/, color: "var(--magenta)", ink: "var(--sheet)", tip: G.TRIP },
  { key: "CONT", match: /^CONT/, color: "var(--amber-bg)", ink: "var(--amber)", tip: G.CONT },
  { key: "ALTN", match: /^ALTN$/, color: "var(--blue)", ink: "var(--sheet)", tip: G.ALTN },
  { key: "FINRES", match: /^FINRES$/, color: "var(--red)", ink: "var(--sheet)", tip: G.FINRES },
  { key: "EXTRA", match: /^EXTRA$/, color: "var(--green)", ink: "var(--sheet)", tip: G.EXTRA },
  { key: "TAXI", match: /^TAXI$/, color: "var(--sunk)", ink: "var(--ink)", tip: G.TAXI },
];

const PLACEHOLDER_ROWS = ["TRIP", "CONT 15 MIN", "ALTN", "FINRES", "MINIMUM T/OFF FUEL", "EXTRA", "T/OFF FUEL", "TAXI", "BLOCK FUEL"];

export function FuelSection({ no }: { no: number }) {
  const { ofp } = useOfp();
  const S = "Planned fuel";
  const [picExtra, setPicExtra] = useField("fuel.picExtra", S, "PIC extra fuel");
  const [reason, setReason] = useField("fuel.picReason", S, "Reason for PIC extra");
  const [sig, setSig] = useField("fuel.picSignature", S, "PIC signature");
  const f = ofp?.fuel;
  const unit = ofp?.header.unit ?? "KGS";
  const rows = f?.rows.length ? f.rows : PLACEHOLDER_ROWS.map((label) => ({ label, arpt: null, fuel: null, time: null }));
  const get = (re: RegExp) => f?.rows.find((r) => re.test(r.label));
  const block = get(/^BLOCK FUEL/)?.fuel ?? null;
  const trip = get(/^TRIP$/)?.fuel ?? null;
  const tof = get(/^T\/OFF FUEL/)?.fuel ?? null;
  const minTof = get(/^MINIMUM T\/OFF/)?.fuel ?? null;
  const altn = get(/^ALTN$/)?.fuel ?? null;
  const finres = get(/^FINRES$/)?.fuel ?? null;
  const landing = tof != null && trip != null ? tof - trip : null;
  const minLanding = altn != null && finres != null ? altn + finres : null;
  const pic = Number(picExtra) || 0;
  const total = block != null ? block + pic : null;
  const ff = ofp?.header.avgFf ?? null;
  const picMin = ff && pic ? Math.round((pic / ff) * 60) : null;

  const segs = SEGMENTS.map((s) => ({ ...s, value: f?.rows.find((r) => s.match.test(r.label))?.fuel ?? 0, row: f?.rows.find((r) => s.match.test(r.label)) }));
  if (pic) segs.push({ key: "PIC", match: /x/, color: "var(--ink-2)", ink: "var(--sheet)", tip: G["PIC EXTRA"], value: pic, row: undefined });
  const sum = segs.reduce((s, x) => s + x.value, 0);

  return (
    <Section id="fuel" no={no} title="Planned fuel" meta={<span>{unit} · PDF p.1</span>}>
      <div className="cols" style={{ ["--min" as string]: "340px" }}>
        <div>
          <div className="tbl-wrap">
            <table className="tbl">
              <caption className="sr-only">Planned fuel breakdown</caption>
              <thead>
                <tr>
                  <th scope="col">Fuel</th>
                  <th scope="col">
                    <Tip tip="Airport the figure relates to (IATA)">Arpt</Tip>
                  </th>
                  <th scope="col" className="num">
                    {unit}
                  </th>
                  <th scope="col" className="num">
                    <Tip tip="Time equivalent (HH:MM)">Time</Tip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const total = /^(MINIMUM T\/OFF|T\/OFF FUEL|BLOCK FUEL)/.test(r.label);
                  return (
                    <tr key={r.label + i} className={cx(total && "total", /^BLOCK/.test(r.label) && "hl")}>
                      <th scope="row">
                        <Tip tip={G[r.label] ?? G[r.label.split(" ")[0]]} title={r.label}>
                          {r.label}
                        </Tip>
                      </th>
                      <td>
                        <V v={r.arpt} w={3} />
                      </td>
                      <td className="num">
                        <V v={fmtNum(r.fuel)} w={5} />
                      </td>
                      <td className="num">
                        <V v={fmtHhmm(r.time)} w={5} />
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <th scope="row">
                    <Tip tip={G["PIC EXTRA"]} title="PIC EXTRA">
                      PIC EXTRA
                    </Tip>
                  </th>
                  <td />
                  <td className="num">
                    <Act label={`PIC extra fuel in ${unit}`} value={picExtra} onChange={(v) => setPicExtra(v.replace(/[^\d]/g, ""))} w={5} />
                  </td>
                  <td className="num small muted">{picMin ? `+${picMin} min` : ""}</td>
                </tr>
                <tr className="total">
                  <th scope="row">
                    <Tip tip={G["TOTAL FUEL"]} title="TOTAL FUEL">
                      TOTAL FUEL
                    </Tip>
                  </th>
                  <td />
                  <td className="num">
                    <V v={pic ? fmtNum(total) : null} w={5} />
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <label htmlFor="pic-reason" className="field-label" style={{ margin: 0 }}>
              Reason for PIC extra
            </label>
            <input
              id="pic-reason"
              className="act"
              style={{ flex: 1, width: "auto", minWidth: 160 }}
              value={reason}
              onChange={(e) => setReason(e.target.value.toUpperCase())}
              placeholder="…………"
            />
          </div>
        </div>

        <div>
          <Sub>Block fuel composition</Sub>
          <div className="fuelbar" role="img" aria-label={ofp ? `Block fuel ${block} ${unit}: ${segs.filter((s) => s.value).map((s) => `${s.key} ${s.value}`).join(", ")}` : "Block fuel composition, not loaded"}>
            {segs
              .filter((s) => s.value > 0)
              .map((s) => (
                <span
                  key={s.key}
                  style={{ flexGrow: s.value, flexBasis: 0, background: s.color, color: s.ink }}
                  data-tip={`${fmtNum(s.value)} ${unit} (${((s.value / sum) * 100).toFixed(1)}% of ${pic ? "total" : "block"})${s.row?.time ? ` · ${fmtHhmm(s.row.time)}` : ""}`}
                  data-tip-title={s.key}
                >
                  {s.value / sum > 0.09 ? s.key : ""}
                </span>
              ))}
          </div>
          <div className="legend" aria-hidden="true">
            {segs.map((s) => (
              <span key={s.key}>
                <i style={{ background: s.color }} />
                {s.key} {s.value ? fmtNum(s.value) : "—"}
              </span>
            ))}
          </div>

          <div className="fields" style={{ marginTop: 14 }}>
            <Field label="Landing fuel" tip="Fuel expected on board at touchdown at destination (T/OFF fuel − trip)" sub={unit}>
              <V v={fmtNum(landing)} w={5} />
            </Field>
            <Field
              label="Arrival margin"
              tip="Landing fuel above the minimum you must land with to divert (alternate + final reserve)"
              sub={landing != null && minLanding != null ? `${fmtNum(landing - minLanding)} above ALTN+FINRES` : null}
            >
              {landing != null && minLanding != null ? (
                <Badge tone={landing - minLanding > 400 ? "green" : "amber"}>{landing - minLanding > 400 ? "Comfortable" : "Tight"}</Badge>
              ) : (
                <V v={null} w={8} />
              )}
            </Field>
            <Field label="Endurance at T/O" tip="Time the T/OFF fuel lasts at planned consumption (from the OFP time column)">
              <V v={fmtDur(hhmmToMin(get(/^T\/OFF FUEL/)?.time))} w={5} />
            </Field>
            <Field label="Extra over min" tip="T/OFF fuel minus the minimum required at take-off" sub={unit}>
              <V v={tof != null && minTof != null ? fmtNum(tof - minTof) : null} w={4} />
            </Field>
            <Field label="Trip share" tip="Share of block fuel that will be burnt en-route">
              <V v={trip != null && block ? `${((trip / block) * 100).toFixed(0)}%` : null} w={3} />
            </Field>
            <Field label="Burn / NM" tip="Trip fuel divided by ground distance" sub={`${unit}/NM`}>
              <V v={trip != null && ofp?.header.gndDist ? (trip / ofp.header.gndDist).toFixed(2) : null} w={4} />
            </Field>
          </div>
        </div>
      </div>

      <div className="cols" style={{ ["--min" as string]: "260px", marginTop: 16 }}>
        <div>
          <Sub>
            <Tip tip={G["FMC INFO"]} title="FMC INFO">
              FMC info
            </Tip>
          </Sub>
          <div className="fields">
            {(f?.fmc.length ? f.fmc : [{ label: "FINRES+ALTN", value: null }, { label: "TRIP+TAXI", value: null }]).map((r) => (
              <Field key={r.label} label={r.label} tip={G[r.label]} className="field-lg" sub={unit}>
                <V v={fmtNum(r.value)} w={5} />
              </Field>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            {f?.tankering ? (
              <Badge tone={/NO TANKERING/.test(f.tankering) ? "ink" : "amber"} tip={G.TANKERING}>
                {f.tankering}
              </Badge>
            ) : (
              <V v={null} w={26} />
            )}
          </div>
        </div>
        <div>
          <Sub>Release</Sub>
          <p className="pre small" style={{ marginBottom: 10 }}>
            {f?.confirmation ?? <V v={null} w={40} />}
          </p>
          <div className="fields">
            <Field label="Dispatcher">
              <V v={f?.dispatcher} w={14} />
            </Field>
            <Field label="Tel">
              <V v={f?.tel} w={14} />
            </Field>
            <Field label="PIC name">
              <V v={f?.picName} w={14} />
            </Field>
            <Field label="PIC signature" tip="Sign to confirm the self-briefing statement above (kept only in this tab)">
              <Act label="PIC signature" value={sig} onChange={setSig} w={14} inputMode="text" placeholder="…………" />
            </Field>
          </div>
        </div>
      </div>
    </Section>
  );
}
