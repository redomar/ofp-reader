"use client";

import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { useOfp } from "../context";
import { Badge, Section, Tip, V, cx } from "../ui";
import { NOTAM_PREFIX } from "@/lib/ofp/glossary";
import { pageOf } from "@/lib/ofp/format";
import type { Notam, NotamBulletin } from "@/lib/ofp/types";

const CRIT = /\b(CLSD|CLOSED|U\/S|NOT AVBL|SUSPENDED|UNSERVICEABLE|JAMMING|SPOOFING|PROHIBITED)\b/;
const WARN = /\b(CRANE|OBST|OBSTACLE|WIP|GNSS|LTD|RESTRICTED|DRONE|UAS)\b/;
const KW = /(\bCLSD\b|\bCLOSED\b|\bU\/S\b|\bNOT AVBL\b|\bSUSPENDED\b|\bJAMMING\b|\bSPOOFING\b|\bPROHIBITED\b|\bRWY\s*\d{2}[LRC]?(?:\/\d{2}[LRC]?)?|\bILS\b|\bCRANE\b|\bOBST\b|\bGNSS\b)/g;

function highlight(text: string, q: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const qre = q ? new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi") : null;
  const segs = text.split(KW);
  segs.forEach((s, i) => {
    const isKw = i % 2 === 1;
    const inner: ReactNode[] = qre ? s.split(qre).map((x, j) => (j % 2 ? <mark key={j}>{x}</mark> : x)) : [s];
    if (isKw) {
      const key = Object.keys(NOTAM_PREFIX).find((k) => s.startsWith(k));
      parts.push(
        <mark key={i} className={CRIT.test(s) ? "kw-red" : undefined} title={key ? NOTAM_PREFIX[key] : undefined}>
          {inner}
        </mark>,
      );
    } else parts.push(<span key={i}>{inner}</span>);
  });
  return parts;
}

function runwaysIn(text: string): string[] {
  const out: string[] = [];
  const list = /\bRWYS?\s*(\d{2}[LRC]?(?:\/\d{2}[LRC]?)*(?:\s*(?:,|AND)\s*\d{2}[LRC]?(?:\/\d{2}[LRC]?)*)*)/g;
  for (const m of text.matchAll(list)) out.push(...m[1].split(/\s*(?:\/|,|AND)\s*/).filter(Boolean));
  return out;
}

function severity(n: Notam) {
  const t = n.lines.join(" ");
  if (CRIT.test(t)) return "crit";
  if (WARN.test(t)) return "warn";
  return "";
}

export function NotamSection({ no, id, title, which }: { no: number; id: string; title: string; which: "notams" | "companyNotams" }) {
  const { ofp } = useOfp();
  const b: NotamBulletin | undefined = ofp?.[which];
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q.trim());
  const [cat, setCat] = useState<string | null>(null);
  const [onlyCrit, setOnlyCrit] = useState(false);
  const [onlyRwy, setOnlyRwy] = useState(false);

  const planned = useMemo(() => {
    const m = new Map<string, string>();
    if (ofp?.tlr.takeoff.planned?.APT && ofp.tlr.takeoff.planned.PRWY) m.set(ofp.tlr.takeoff.planned.APT, ofp.tlr.takeoff.planned.PRWY);
    if (ofp?.tlr.landing.planned?.APT && ofp.tlr.landing.planned.PRWY) m.set(ofp.tlr.landing.planned.APT, ofp.tlr.landing.planned.PRWY);
    return m;
  }, [ofp]);

  const cats = useMemo(() => [...new Set((b?.groups ?? []).map((g) => g.category).filter(Boolean) as string[])], [b]);
  const total = b?.groups.reduce((s, g) => s + g.notams.length, 0) ?? 0;

  const sections = useMemo(() => {
    const out: { name: string; locs: { loc: string | null; name: string | null; groups: { cat: string | null; notams: (Notam & { sev: string; hitsRwy: boolean })[]; notes: string[] }[] }[] }[] = [];
    for (const g of b?.groups ?? []) {
      let s = out.find((x) => x.name === g.section);
      if (!s) out.push((s = { name: g.section, locs: [] }));
      let l = s.locs.find((x) => x.loc === g.location);
      if (!l) s.locs.push((l = { loc: g.location, name: g.locationName, groups: [] }));
      const prwy = g.location ? planned.get(g.location.slice(0, 4)) : undefined;
      const notams = g.notams
        .map((n) => {
          const text = n.lines.join(" ");
          return { ...n, sev: severity(n), hitsRwy: !!prwy && runwaysIn(text).includes(prwy) };
        })
        .filter((n) => (!cat || g.category === cat) && (!onlyCrit || n.sev === "crit") && (!onlyRwy || n.hitsRwy))
        .filter((n) => !dq || `${n.id} ${n.valid ?? ""} ${n.lines.join(" ")}`.toLowerCase().includes(dq.toLowerCase()));
      if (notams.length || (!cat && !onlyCrit && !onlyRwy && !dq && g.notes.length)) l.groups.push({ cat: g.category, notams, notes: g.notes });
    }
    return out;
  }, [b, cat, onlyCrit, onlyRwy, dq, planned]);

  const shown = sections.reduce((s, x) => s + x.locs.reduce((a, l) => a + l.groups.reduce((c, g) => c + g.notams.length, 0), 0), 0);
  const rwyHits = (b?.groups ?? []).reduce((s, g) => {
    const prwy = g.location ? planned.get(g.location.slice(0, 4)) : undefined;
    return s + (prwy ? g.notams.filter((n) => runwaysIn(n.lines.join(" ")).includes(prwy)).length : 0);
  }, 0);

  return (
    <Section id={id} no={no} title={title} meta={<span>{ofp ? `${total} items · PDF p.${pageOf(ofp.pages, which === "notams" ? /^\[ NOTAM \]/ : /^\[ Company NOTAM \]/) ?? "?"}` : "—"}</span>}>
      {b?.header.length ? (
        <div className="stack small mono" style={{ gap: 2, marginBottom: 12 }}>
          {b.header.map((h, i) => (
            <span key={i}>{h}</span>
          ))}
        </div>
      ) : !ofp ? (
        <div className="stack" style={{ gap: 4, marginBottom: 12 }}>
          <V v={null} w={50} />
          <V v={null} w={40} />
        </div>
      ) : null}

      {which === "notams" && (
        <div className="nt-filters" role="search">
          <label htmlFor={`${id}-q`} className="sr-only">
            Search NOTAMs
          </label>
          <input id={`${id}-q`} type="search" placeholder="Search NOTAMs (e.g. ILS, RWY 06R, crane)…" value={q} onChange={(e) => setQ(e.target.value)} disabled={!ofp} />
          <button type="button" className="toggle" aria-pressed={cat === null} onClick={() => setCat(null)}>
            All
          </button>
          {cats.map((c) => (
            <button key={c} type="button" className="toggle" aria-pressed={cat === c} onClick={() => setCat(cat === c ? null : c)}>
              {c}
            </button>
          ))}
          <button type="button" className="toggle" aria-pressed={onlyCrit} onClick={() => setOnlyCrit(!onlyCrit)} disabled={!ofp}>
            <Tip tip="Only items that close, suspend or disable something (CLSD, U/S, NOT AVBL…)" plain>
              Critical
            </Tip>
          </button>
          <button type="button" className="toggle" aria-pressed={onlyRwy} onClick={() => setOnlyRwy(!onlyRwy)} disabled={!ofp}>
            <Tip tip="Only items that mention your planned take-off or landing runway" plain>
              Planned RWY ({rwyHits})
            </Tip>
          </button>
          <span className="small muted" aria-live="polite">
            {ofp ? `${shown} of ${total} shown` : ""}
          </span>
        </div>
      )}

      {!ofp &&
        ["Departure airport", "Destination airport", "Alternate", "En-route"].map((s) => (
          <details className="nt-sec" key={s}>
            <summary>
              {s}
              <span className="count">
                <V v={null} w={3} />
              </span>
            </summary>
          </details>
        ))}

      {sections.map((s, si) => {
        const count = s.locs.reduce((a, l) => a + l.groups.reduce((c, g) => c + g.notams.length, 0), 0);
        const crit = s.locs.reduce((a, l) => a + l.groups.reduce((c, g) => c + g.notams.filter((n) => n.sev === "crit").length, 0), 0);
        return (
          <details className="nt-sec" key={s.name} open={si < 2 || !!dq || onlyCrit || onlyRwy || which === "companyNotams"}>
            <summary>
              {s.name}
              {crit > 0 && <Badge tone="red">{crit} critical</Badge>}
              <span className="count">{count}</span>
            </summary>
            <div className="nt-loc">
              {s.locs.map((l) => (
                <div key={l.loc ?? "x"}>
                  {l.loc && (
                    <h4>
                      {l.loc} <span>{l.name}</span>
                      {planned.get(l.loc.slice(0, 4)) && <Badge tone="blue">planned RWY {planned.get(l.loc.slice(0, 4))}</Badge>}
                    </h4>
                  )}
                  {l.groups.map((g, gi) => (
                    <div key={gi}>
                      {g.cat && <p className="nt-cat">{g.cat}</p>}
                      {g.notes.map((n, k) => (
                        <p key={k} className="small muted" style={{ margin: "2px 0" }}>
                          {n}
                        </p>
                      ))}
                      {g.notams.length > 0 && (
                        <div className="nt-list">
                          {g.notams.map((n, k) => (
                            <article key={n.id + k} className={cx("nt", n.sev)} aria-label={`NOTAM ${n.id}`}>
                              <div className="nt-id">
                                <span>{n.id}</span>
                                {n.valid && <span className="small muted">{n.valid}</span>}
                                {n.hitsRwy && <Badge tone="mag">Planned RWY</Badge>}
                                {n.sev === "crit" && <Badge tone="red">Critical</Badge>}
                              </div>
                              <div className="nt-body">{highlight(n.lines.join("\n"), dq)}</div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>
        );
      })}
      {ofp && shown === 0 && (dq || cat || onlyCrit || onlyRwy) && <p className="muted">No items match these filters.</p>}
      {b?.footer && <p className="note">{b.footer}</p>}
    </Section>
  );
}
