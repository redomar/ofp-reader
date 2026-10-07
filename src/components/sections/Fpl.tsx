"use client";

import { useState, type ReactNode } from "react";
import { useOfp } from "../context";
import { Section, Sub, Tip, V } from "../ui";
import { RouteExplain } from "../RouteExplain";
import { AIRCRAFT, EQUIP_SHORT, OPERATORS, SURV_SHORT, routeLegs, speedLevel } from "@/lib/ofp/fplRef";
import { PrintFace } from "../McduSheet";
import { EQUIP, FLIGHT_RULES, FLIGHT_TYPE, PBN, SURV, WAKE, splitEquip } from "@/lib/ofp/glossary";
import { fmtHhmm, fmtReg, pageOf } from "@/lib/ofp/format";
import { RouteString } from "./Route";

const PER: Record<string, string> = {
  A: "Cat A — Vat < 91 kt",
  B: "Cat B — Vat 91–120 kt",
  C: "Cat C — Vat 121–140 kt",
  D: "Cat D — Vat 141–165 kt",
  E: "Cat E — Vat 166–210 kt",
};

/** One labelled line of a decoded card; hovering it lights up that item in the message. */
function FcRow({ it, label, children, on, setOn }: { it: string; label: string; children: ReactNode; on: string | null; setOn: (v: string | null) => void }) {
  return (
    <div className={`fc-row${on === it ? " on" : ""}`} onPointerEnter={() => setOn(it)} onPointerLeave={() => setOn(null)}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function FplSection({ no }: { no: number }) {
  const { ofp } = useOfp();
  const [on, setOn] = useState<string | null>(null);
  const [explain, setExplain] = useState(false);
  const fpl = ofp?.fpl;
  const item = (id: string) => fpl?.items.find((i) => i.item === id)?.value ?? null;

  const i7 = item("7");
  const i8 = item("8");
  const i9 = item("9");
  const i10 = item("10");
  const i13 = item("13");
  const i15 = item("15");
  const i16 = item("16");
  const i18 = new Map((fpl?.item18 ?? []).map((kv) => [kv.key, kv.value]));
  const opr = i7 ? OPERATORS[i7.slice(0, 3)] : undefined;
  const aptName = (icao: string) => ofp?.wx.airports.find((a) => a.icao === icao)?.name ?? null;
  const [type, wake] = i9?.split("/") ?? [];
  const [eq, surv] = i10?.split("/") ?? [];
  const cruise = i15 ? speedLevel(i15.split(/\s+/)[0]) : null;
  const changes = i15 ? [...i15.matchAll(/([A-Z]{2,5})\/([NKM]\d{3,4}[FASM]\d{3,4})/g)].map((m) => ({ at: m[1], sl: speedLevel(m[2]) })) : [];
  const [destEet, ...altns] = i16?.split(/\s+/) ?? [];
  const dep = i13?.slice(0, 4) ?? null;
  const dest = destEet?.slice(0, 4) ?? null;
  const dof = i18.get("DOF")?.match(/^(\d{2})(\d{2})(\d{2})$/);
  const dofText = dof
    ? new Date(Date.UTC(2000 + Number(dof[1]), Number(dof[2]) - 1, Number(dof[3]))).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;
  const known = new Set(["PBN", "DOF", "REG", "EET", "OPR", "PER", "RMK"]);
  const other = [...i18].filter(([k, v]) => !known.has(k) || (k === "RMK" && v !== "TCAS"));

  // Item 10 grouped by what the codes are for.
  const codes = eq ? splitEquip(eq) : [];
  const groups: [string, string[]][] = [
    ["Comms", codes.filter((c) => /^(S|V|H|U|Y|M\d)$/.test(c))],
    ["Datalink", codes.filter((c) => /^(E\d|J\d)$/.test(c))],
    ["Nav", codes.filter((c) => /^(D|F|G|I|O|L|B|K|T|A|C)$/.test(c))],
    ["Approvals", codes.filter((c) => /^(R|W|X|Z|N)$/.test(c))],
  ];
  const svs = surv ? splitEquip(surv) : [];
  const pbn = i18.get("PBN")?.match(/[A-Z]\d/g) ?? [];

  const chip = (c: string, label: string, tip: string, key?: string) => (
    <Tip key={key ?? c} tip={tip} title={c} plain>
      <span className="fc-chip">
        <b>{c}</b> {label}
      </span>
    </Tip>
  );
  const legs = i15 && dep && dest ? routeLegs(i15, dep, dest).legs : [];
  const vors = (ofp?.log ?? []).filter((p) => p.freq).length;

  return (
    <Section id="fpl" no={no} title="ATC flight plan" meta={<span>ICAO · PDF p.{pageOf(ofp?.pages, /ICAO FLIGHT PLAN/) ?? 8}</span>}>
      <PrintFace
        icon="route"
        title={explain ? "Hide route explanation" : "Explain route & navaids"}
        chips={dep && dest ? [`${dep} → ${dest}`, `${legs.length} legs`, vors ? `${vors} VOR${vors > 1 ? "s" : ""}` : "RNAV only"] : ["ROUTE", "NAVAIDS"]}
        sub="Each leg of item 15 drawn on printer paper, with the radio navaids beside it."
        aria-expanded={explain}
        aria-controls="fpl-explain"
        disabled={!fpl?.items.length}
        onClick={() => setExplain(!explain)}
      />
      {explain && (
        <div id="fpl-explain">
          <RouteExplain />
        </div>
      )}
      <hr className="mcdu-rule" />
      <div className="stack" style={{ gap: 16 }}>
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
          {fpl?.items.length ? (
            <div className="fc-grid">
              <section className="fc">
                <h4>Flight</h4>
                <div className="fc-hero">
                  <span className="fc-big mono">{i7}</span>
                  {opr && (
                    <span className="fc-hero-sub">
                      {opr.name} ·{" "}
                      <span title="Radio callsign">
                        “{opr.call} {i7?.slice(3)}”
                      </span>
                    </span>
                  )}
                </div>
                <dl>
                  <FcRow on={on} setOn={setOn} it="8" label="Rules">
                    {i8 ? `${FLIGHT_RULES[i8[0]] ?? i8[0]} · ${FLIGHT_TYPE[i8[1]] ?? i8[1]}` : "—"}
                  </FcRow>
                  {dofText && (
                    <FcRow on={on} setOn={setOn} it="18" label="Date">
                      {dofText}
                    </FcRow>
                  )}
                  {i18.get("OPR") && (
                    <FcRow on={on} setOn={setOn} it="18" label="Operator">
                      {OPERATORS[i18.get("OPR")!]?.name ?? i18.get("OPR")}
                    </FcRow>
                  )}
                </dl>
              </section>

              <section className="fc">
                <h4>Aircraft</h4>
                <div className="fc-hero">
                  <span className="fc-big mono">{type}</span>
                  {AIRCRAFT[type] && <span className="fc-hero-sub">{AIRCRAFT[type]}</span>}
                </div>
                <dl>
                  {i18.get("REG") && (
                    <FcRow on={on} setOn={setOn} it="18" label="Registration">
                      {fmtReg(i18.get("REG")!) ?? i18.get("REG")}
                    </FcRow>
                  )}
                  <FcRow on={on} setOn={setOn} it="9" label="Wake">
                    <Tip tip="Wake turbulence category: sets separation behind and ahead" plain>
                      <span>{WAKE[wake] ?? wake ?? "—"}</span>
                    </Tip>
                  </FcRow>
                  {i18.get("PER") && (
                    <FcRow on={on} setOn={setOn} it="18" label="Approach">
                      {PER[i18.get("PER")!] ?? i18.get("PER")}
                    </FcRow>
                  )}
                  {i18.get("RMK") === "TCAS" && (
                    <FcRow on={on} setOn={setOn} it="18" label="TCAS">
                      Fitted (ACAS II)
                    </FcRow>
                  )}
                </dl>
              </section>

              <section className="fc fc-caps">
                <h4>Capabilities</h4>
                <dl>
                  {groups
                    .filter(([, list]) => list.length)
                    .map(([g, list]) => (
                      <FcRow on={on} setOn={setOn} key={g} it="10" label={g}>
                        <span className="fc-chips">{list.map((c) => chip(c, EQUIP_SHORT[c] ?? c, EQUIP[c] ?? "Code not in the quick reference"))}</span>
                      </FcRow>
                    ))}
                  {svs.length > 0 && (
                    <FcRow on={on} setOn={setOn} it="10" label="Surveillance">
                      <span className="fc-chips">{svs.map((c) => chip(c, SURV_SHORT[c] ?? c, SURV[c] ?? "Code not in the quick reference"))}</span>
                    </FcRow>
                  )}
                  {pbn.length > 0 && (
                    <FcRow on={on} setOn={setOn} it="18" label="PBN">
                      <span className="fc-chips">
                        {pbn.map((c) =>
                          chip(c, (PBN[c] ?? c).replace(/ — all permitted sensors/, ""), `PBN capability ${c}: ${PBN[c] ?? "not in the quick reference"}`),
                        )}
                      </span>
                    </FcRow>
                  )}
                  {other.map(([k, v]) => (
                    <FcRow on={on} setOn={setOn} key={k} it="18" label={k}>
                      {v}
                    </FcRow>
                  ))}
                </dl>
              </section>
              <section className="fc fc-route-card">
                <h4>Route &amp; times</h4>
                <div className="fc-route" onPointerEnter={() => setOn("13")} onPointerLeave={() => setOn(null)}>
                  <span>
                    <span className="fc-big mono">{dep}</span>
                    <span className="fc-hero-sub">{dep && aptName(dep)}</span>
                  </span>
                  <span className="fc-arrow" aria-hidden="true">
                    → <span className="small mono">{destEet ? `EET ${fmtHhmm(destEet.slice(4))}` : ""}</span>
                  </span>
                  <span>
                    <span className="fc-big mono">{dest}</span>
                    <span className="fc-hero-sub">{dest && aptName(dest)}</span>
                  </span>
                </div>
                <dl>
                  <FcRow on={on} setOn={setOn} it="13" label="EOBT">
                    {i13 ? `${fmtHhmm(i13.slice(4))}Z` : "—"}
                    {ofp?.header.outTime && i13 && ofp.header.outTime !== i13.slice(4) && (
                      <span className="muted"> (OFP OUT {fmtHhmm(ofp.header.outTime)}Z)</span>
                    )}
                  </FcRow>
                  <FcRow on={on} setOn={setOn} it="15" label="Cruise">
                    {cruise ? `${cruise.speed} · ${cruise.level}` : "—"}
                    {changes.map((c, k) =>
                      c.sl ? (
                        <span key={k} className="muted">
                          {" "}
                          · from {c.at}: {c.sl.speed}, {c.sl.level}
                        </span>
                      ) : null,
                    )}
                  </FcRow>
                  <FcRow on={on} setOn={setOn} it="15" label="Route">
                    <RouteString route={i15} />
                  </FcRow>
                  <FcRow on={on} setOn={setOn} it="16" label="Alternates">
                    {altns.length ? altns.map((a) => `${a}${aptName(a) ? ` ${aptName(a)}` : ""}`).join(" · ") : "none"}
                  </FcRow>
                  {i18.get("EET") && (
                    <FcRow on={on} setOn={setOn} it="18" label="FIR times">
                      {i18
                        .get("EET")!
                        .split(/\s+/)
                        .map((e) => `${e.slice(0, 4)} +${fmtHhmm(e.slice(4))}`)
                        .join(" · ")}
                    </FcRow>
                  )}
                </dl>
              </section>
            </div>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              {Array.from({ length: 6 }, (_, i) => (
                <V key={i} v={null} w={[18, 26, 22, 30, 24, 28][i]} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
