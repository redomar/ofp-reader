"use client";

import { useState, type ReactNode } from "react";
import { useOfp } from "../context";
import { Badge, Section, Sub, Tip, V } from "../ui";
import { RouteExplain } from "../RouteExplain";
import { AIRCRAFT, EQUIP_SHORT, OPERATORS, SURV_SHORT, speedLevel } from "@/lib/ofp/fplRef";
import { EQUIP, FLIGHT_RULES, FLIGHT_TYPE, G, PBN, SURV, WAKE, splitEquip } from "@/lib/ofp/glossary";
import { fmtHhmm, fmtReg, pageOf } from "@/lib/ofp/format";
import { RouteString } from "./Route";

const PER: Record<string, string> = {
  A: "Cat A — Vat < 91 kt",
  B: "Cat B — Vat 91–120 kt",
  C: "Cat C — Vat 121–140 kt",
  D: "Cat D — Vat 141–165 kt",
  E: "Cat E — Vat 166–210 kt",
};

export function FplSection({ no }: { no: number }) {
  const { ofp } = useOfp();
  const [on, setOn] = useState<string | null>(null);
  const [explain, setExplain] = useState(false);
  const fpl = ofp?.fpl;
  const item = (id: string) => fpl?.items.find((i) => i.item === id)?.value ?? null;
  const firNames = new Map((ofp?.log ?? []).filter((l) => l.kind === "fir").map((l) => [l.position, l.firName]));

  const decoded: { id: string; label: string; body: ReactNode }[] = [];
  const i7 = item("7");
  const i8 = item("8");
  const i9 = item("9");
  const i10 = item("10");
  const i13 = item("13");
  const i15 = item("15");
  const i16 = item("16");
  const opr = i7 ? OPERATORS[i7.slice(0, 3)] : undefined;
  const aptName = (icao: string) => ofp?.wx.airports.find((a) => a.icao === icao)?.name ?? null;
  decoded.push({
    id: "7",
    label: "Aircraft ID",
    body: i7 ? (
      <span className="codes">
        <span className="code">{i7}</span>
        {opr && (
          <Badge tone="blue" tip={`${i7.slice(0, 3)} is the ICAO designator for ${opr.name}; on the radio the flight is "${opr.call} ${i7.slice(3)}"`}>
            {opr.name}
          </Badge>
        )}
        {opr && <Badge tone="ink" tip="Radio callsign (telephony designator + flight number)">“{opr.call} {i7.slice(3)}”</Badge>}
      </span>
    ) : (
      <V v={i7} w={7} />
    ),
  });
  decoded.push({
    id: "8",
    label: "Rules / type",
    body: i8 ? (
      <span className="codes">
        <Badge tone="blue" tip={`Flight rules ${i8[0]}`}>
          {FLIGHT_RULES[i8[0]] ?? i8[0]}
        </Badge>
        <Badge tone="ink" tip={`Type of flight ${i8[1]}`}>
          {FLIGHT_TYPE[i8[1]] ?? i8[1]}
        </Badge>
      </span>
    ) : (
      <V v={null} w={16} />
    ),
  });
  const [type, wake] = i9?.split("/") ?? [];
  decoded.push({
    id: "9",
    label: "Type / wake",
    body: i9 ? (
      <span className="codes">
        <span className="code">{type}</span>
        {AIRCRAFT[type] && <Badge tone="blue">{AIRCRAFT[type]}</Badge>}
        <Badge tone={wake === "H" || wake === "J" ? "amber" : "ink"} tip="Wake turbulence category: sets separation behind and ahead">
          {WAKE[wake] ?? wake} wake
        </Badge>
      </span>
    ) : (
      <V v={null} w={12} />
    ),
  });
  const [eq, surv] = i10?.split("/") ?? [];
  decoded.push({
    id: "10",
    label: "Equipment",
    body: i10 ? (
      <span className="stack" style={{ gap: 6 }}>
        <span className="codes">
          <span className="field-label" style={{ margin: 0 }}>
            Comms / nav
          </span>
          {splitEquip(eq).map((c, k) => (
            <Badge key={c + k} tone={c === "W" || c === "R" || c === "G" ? "blue" : "ink"} tip={EQUIP[c] ?? "Code not in the quick reference"}>
              {c} · {EQUIP_SHORT[c] ?? c}
            </Badge>
          ))}
        </span>
        {surv && (
          <span className="codes">
            <span className="field-label" style={{ margin: 0 }}>
              Surveillance
            </span>
            {splitEquip(surv).map((c, k) => (
              <Badge key={c + k} tone="ink" tip={SURV[c] ?? "Code not in the quick reference"}>
                {c} · {SURV_SHORT[c] ?? c}
              </Badge>
            ))}
          </span>
        )}
      </span>
    ) : (
      <V v={null} w={20} />
    ),
  });
  decoded.push({
    id: "13",
    label: "Departure / EOBT",
    body: i13 ? (
      <span className="codes">
        <span className="code">{i13.slice(0, 4)}</span>
        {aptName(i13.slice(0, 4)) && <span className="small muted">{aptName(i13.slice(0, 4))}</span>}
        <Badge tone="blue" tip="Estimated off-block time: when you plan to push back">
          EOBT {fmtHhmm(i13.slice(4))}Z
        </Badge>
        {ofp?.header.outTime && ofp.header.outTime !== i13.slice(4) && (
          <Badge tone="amber" tip="The OFP's OUT time differs from the filed EOBT">
            OFP OUT {fmtHhmm(ofp.header.outTime)}Z
          </Badge>
        )}
      </span>
    ) : (
      <V v={null} w={10} />
    ),
  });
  const cruise = i15 ? speedLevel(i15.split(/\s+/)[0]) : null;
  const changes = i15 ? [...i15.matchAll(/([A-Z]{2,5})\/([NKM]\d{3,4}[FASM]\d{3,4})/g)].map((m) => ({ at: m[1], sl: speedLevel(m[2]) })) : [];
  decoded.push({
    id: "15",
    label: "Speed / level / route",
    body: i15 ? (
      <span className="stack" style={{ gap: 6 }}>
        <span className="codes">
          {cruise && (
            <>
              <Badge tone="mag" tip="Initial cruising speed (true airspeed)">
                {cruise.speed}
              </Badge>
              <Badge tone="mag" tip="Initial requested cruising level">
                {cruise.level}
              </Badge>
            </>
          )}
          {changes.map((c, k) =>
            c.sl ? (
              <Badge key={k} tone="ink" tip={`Filed speed / level change at ${c.at}`}>
                from {c.at}: {c.sl.speed} · {c.sl.level}
              </Badge>
            ) : null,
          )}
        </span>
        <RouteString route={i15} />
      </span>
    ) : (
      <V v={null} w={40} />
    ),
  });
  const [destEet, ...altns] = i16?.split(/\s+/) ?? [];
  decoded.push({
    id: "16",
    label: "Destination / EET / altn",
    body: i16 ? (
      <span className="codes">
        <span className="code">{destEet.slice(0, 4)}</span>
        {aptName(destEet.slice(0, 4)) && <span className="small muted">{aptName(destEet.slice(0, 4))}</span>}
        <Badge tone="blue" tip="Total estimated elapsed time, take-off to destination">
          EET {fmtHhmm(destEet.slice(4))}
        </Badge>
        {altns.map((a) => (
          <Badge key={a} tone="ink" tip={`Destination alternate${aptName(a) ? `: ${aptName(a)}` : ""}`}>
            ALTN {a}
          </Badge>
        ))}
        {!altns.length && <span className="small muted">no alternate</span>}
      </span>
    ) : (
      <V v={null} w={20} />
    ),
  });

  return (
    <Section id="fpl" no={no} title="ATC flight plan" meta={<span>ICAO · PDF p.{pageOf(ofp?.pages, /ICAO FLIGHT PLAN/) ?? 8}</span>}>
      <div className="cols" style={{ ["--min" as string]: "360px" }}>
        <div>
          <Sub>Message</Sub>
          <div className="fpl">
            <div className="muted">
              <Tip tip="AFTN addressees: FF = priority, then each ATC unit's flight plan office (ZQZX)">{fpl?.addresses ?? <V v={null} w={30} />}</Tip>
            </div>
            <div className="muted">
              <Tip tip="Filing time (DDHHMM, UTC) and the originator's AFTN address">{fpl?.originator ?? <V v={null} w={16} />}</Tip>
            </div>
            {fpl?.items.length ? (
              <div>
                (FPL
                {fpl.items.map((it) => (
                  <span key={it.item}>
                    -
                    <span
                      className="it"
                      data-on={on === it.item}
                      data-tip={it.label}
                      data-tip-title={`Item ${it.item}`}
                      onPointerEnter={() => setOn(it.item)}
                      onPointerLeave={() => setOn(null)}
                    >
                      {it.value}
                    </span>
                    {["8", "10", "13", "15", "16"].includes(it.item) ? <br /> : null}
                  </span>
                ))}
                )
              </div>
            ) : (
              <div className="stack" style={{ gap: 4 }}>
                {Array.from({ length: 6 }, (_, i) => (
                  <V key={i} v={null} w={[14, 26, 10, 48, 14, 40][i]} />
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <Sub>Decoded</Sub>
          <dl className="dl">
            {decoded.map((d) => (
              <div key={d.id} style={{ display: "contents" }} onPointerEnter={() => setOn(d.id)} onPointerLeave={() => setOn(null)}>
                <dt style={{ color: on === d.id ? "var(--magenta)" : undefined }}>
                  <span className="mono small">{d.id}</span> {d.label}
                </dt>
                <dd>{d.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" className="btn" aria-expanded={explain} aria-controls="fpl-explain" disabled={!fpl?.items.length} onClick={() => setExplain(!explain)}>
          {explain ? "▾ Hide route explanation" : "▸ Explain route & navaids"}
        </button>
        <span className="small muted">Each leg of item 15 diagrammed with distance, time and levels, plus the VOR / NDB frequencies on the route.</span>
      </div>
      {explain && (
        <div id="fpl-explain">
          <RouteExplain />
        </div>
      )}

      <Sub>Item 18 · other information</Sub>
      <dl className="dl" onPointerEnter={() => setOn("18")} onPointerLeave={() => setOn(null)}>
        {(fpl?.item18.length ? fpl.item18 : [{ key: "PBN", value: "" }, { key: "DOF", value: "" }, { key: "REG", value: "" }, { key: "EET", value: "" }]).map((kv) => (
          <div key={kv.key} style={{ display: "contents" }}>
            <dt>
              <Tip tip={G[kv.key] ?? G[`${kv.key}/`]} title={kv.key}>
                {kv.key}/
              </Tip>
            </dt>
            <dd>{render18(kv.key, kv.value, firNames)}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function render18(key: string, value: string, firs: Map<string | null, string | null>): ReactNode {
  if (!value) return <V v={null} w={14} />;
  if (key === "PBN")
    return (
      <span className="codes">
        {(value.match(/[A-Z]\d/g) ?? []).map((c) => (
          <Badge key={c} tone={/^[ST]/.test(c) ? "green" : "blue"} tip={`PBN capability ${c}: ${PBN[c] ?? "not in the quick reference"}${/^[ST]/.test(c) ? " (approach)" : " (en route / terminal)"}`}>
            {c} · {(PBN[c] ?? c).replace(/ — all permitted sensors/, "")}
          </Badge>
        ))}
      </span>
    );
  if (key === "DOF") {
    const m = value.match(/^(\d{2})(\d{2})(\d{2})$/);
    if (!m) return value;
    const d = new Date(Date.UTC(2000 + Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return (
      <span className="codes">
        <span className="code">{value}</span>
        <Badge tone="blue" tip="Date of flight (YYMMDD)">
          {d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
        </Badge>
      </span>
    );
  }
  if (key === "REG")
    return (
      <span className="codes">
        <span className="code">{value}</span>
        <Badge tone="ink" tip="Aircraft registration">
          {fmtReg(value) ?? value}
        </Badge>
      </span>
    );
  if (key === "OPR")
    return (
      <span className="codes">
        <span className="code">{value}</span>
        {OPERATORS[value] && <Badge tone="blue">{OPERATORS[value].name}</Badge>}
      </span>
    );
  if (key === "PER")
    return (
      <span className="codes">
        <span className="code">{value}</span>
        <Badge tone="ink" tip="Aircraft approach category, from the speed at the threshold: sets the approach minima you use">
          {PER[value] ?? value}
        </Badge>
      </span>
    );
  if (key === "EET")
    return (
      <span className="codes">
        {value.split(/\s+/).map((e, i) => {
          const fir = e.slice(0, 4);
          return (
            <Tip key={i} tip={`${firs.get(fir) ?? fir} boundary at ${fmtHhmm(e.slice(4))} after take-off`} title={fir} plain>
              <span className="code">
                {fir} +{fmtHhmm(e.slice(4))}
              </span>
            </Tip>
          );
        })}
      </span>
    );
  if (key === "RMK" && value === "TCAS")
    return (
      <Badge tone="green" tip="Remark: the aircraft carries ACAS II (TCAS)">
        TCAS fitted
      </Badge>
    );
  return value;
}
