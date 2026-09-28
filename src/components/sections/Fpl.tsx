"use client";

import { useState, type ReactNode } from "react";
import { useOfp } from "../context";
import { Section, Sub, Tip, V } from "../ui";
import { EQUIP, FLIGHT_RULES, FLIGHT_TYPE, G, PBN, SURV, WAKE, splitEquip } from "@/lib/ofp/glossary";
import { fmtHhmm, pageOf } from "@/lib/ofp/format";
import { RouteString } from "./Route";

const PER: Record<string, string> = {
  A: "Cat A — Vat < 91 kt",
  B: "Cat B — Vat 91–120 kt",
  C: "Cat C — Vat 121–140 kt",
  D: "Cat D — Vat 141–165 kt",
  E: "Cat E — Vat 166–210 kt",
};

function Codes({ list, dict }: { list: string[]; dict: Record<string, string> }) {
  return (
    <span className="codes">
      {list.map((c, i) => (
        <Tip key={c + i} tip={dict[c] ?? "Code not in the quick reference"} title={c} plain>
          <span className="code">{c}</span>
        </Tip>
      ))}
    </span>
  );
}

export function FplSection({ no }: { no: number }) {
  const { ofp } = useOfp();
  const [on, setOn] = useState<string | null>(null);
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
  decoded.push({ id: "7", label: "Aircraft ID", body: <V v={i7} w={7} /> });
  decoded.push({
    id: "8",
    label: "Rules / type",
    body: i8 ? (
      <span>
        {i8} — {FLIGHT_RULES[i8[0]] ?? i8[0]}, {FLIGHT_TYPE[i8[1]] ?? i8[1]}
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
      <span>
        {type} · wake {WAKE[wake] ?? wake}
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
        <Codes list={splitEquip(eq)} dict={EQUIP} />
        {surv && <Codes list={splitEquip(surv)} dict={SURV} />}
      </span>
    ) : (
      <V v={null} w={20} />
    ),
  });
  decoded.push({
    id: "13",
    label: "Departure / EOBT",
    body: i13 ? (
      <span>
        {i13.slice(0, 4)} off-blocks {fmtHhmm(i13.slice(4))}Z
      </span>
    ) : (
      <V v={null} w={10} />
    ),
  });
  decoded.push({ id: "15", label: "Speed / level / route", body: i15 ? <RouteString route={i15} /> : <V v={null} w={40} /> });
  const [destEet, ...altns] = i16?.split(/\s+/) ?? [];
  decoded.push({
    id: "16",
    label: "Destination / EET / altn",
    body: i16 ? (
      <span>
        {destEet.slice(0, 4)} · total EET {fmtHhmm(destEet.slice(4))} · alternate {altns.join(", ") || "none"}
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
  if (key === "PBN") return <Codes list={value.match(/[A-Z]\d/g) ?? []} dict={PBN} />;
  if (key === "DOF") {
    const m = value.match(/^(\d{2})(\d{2})(\d{2})$/);
    return m ? `${value} — 20${m[1]}-${m[2]}-${m[3]}` : value;
  }
  if (key === "PER") return `${value} — ${PER[value] ?? ""}`;
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
  if (key === "RMK" && value === "TCAS") return "TCAS — aircraft equipped with ACAS II";
  return value;
}
