"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Brand, ThemeToggle, Toc } from "./chrome";
import { CollapseAllButton, CollapseProvider } from "./collapse";
import { TooltipLayer } from "./TooltipLayer";
import { Replay } from "./replay";
import { Badge, Section, V } from "./ui";
import { FlapCode } from "./FlapCode";
import { getServerVersion, getVersion, listFlights, readFlight, subscribe, writeField } from "@/lib/storage";
import { getPdf } from "@/lib/pdfCache";
import { hhmmToMin } from "@/lib/ofp/format";
import type { OFP } from "@/lib/ofp/types";

const S = "Radio";
const SKIN_KEY = "ofp-reader:radio-skin";
const SKINS = [
  ["scan", "Scanlines", "VFD glass with fine scanlines and a pixel font"],
  ["dots", "Dots", "VFD glass behind a fine dot mesh"],
  ["classic", "Classic", "Olive LCD by day, amber by night"],
] as const;
type Skin = (typeof SKINS)[number][0];
const APT_SERVICES: [string, string][] = [
  ["ATIS", "Information"],
  ["DEL", "Delivery"],
  ["GND", "Ground"],
  ["TWR", "Tower"],
  ["APP", "Approach"],
];

/** "11895" → "118.95"; keeps what's typed, inserts the dot after three digits. */
const tidy = (v: string) => {
  const d = v.replace(/[^\d.]/g, "");
  if (d.includes(".")) return d.slice(0, 7);
  return d.length > 3 ? `${d.slice(0, 3)}.${d.slice(3, 6)}` : d;
};

/** COMMS band and 8.33 / 25 kHz channel check. */
function comCheck(v: string): string | null {
  if (!/^\d{3}\.\d{1,3}$/.test(v)) return v ? "Type the frequency as nnn.nnn" : null;
  const f = Number(v);
  if (f >= 108 && f < 118) return "That's a NAV frequency (108–117.95), not COMMS";
  if (f < 118 || f > 136.99) return "Outside the VHF COMMS band (118.000–136.990)";
  const khz = Math.round((f - 118) * 1000);
  const ok = khz % 25 === 0 || [5, 10, 15].includes(khz % 25);
  return ok ? null : "Not a 25 / 8.33 kHz channel";
}

/** Frequencies the NOTAMs report as unusable ("ON TEST", "U/S", …). */
function notamOutages(ofp: OFP): Map<string, string> {
  const text = JSON.stringify([ofp.notams, ofp.companyNotams]).replace(/\\n/g, " ");
  const out = new Map<string, string>();
  for (const m of text.matchAll(/(\d{3}\.\d{2,3})\s*MHZ([^"]{0,60})/gi)) {
    const why = m[2].match(/ON TEST|U\/S|UNSERVICEABLE|NOT USABLE|NOT AVBL|OUT OF SERVICE/i)?.[0];
    if (why) out.set(Number(m[1]).toFixed(2), why.toUpperCase());
  }
  return out;
}

/** A radio-panel window: dark glass, amber digits, unlit 888.888 when empty. */
function Window({ value, onChange, label, from, warn }: { value: string; onChange?: (v: string) => void; label: string; from?: boolean; warn?: string | null }) {
  return (
    <span className={`rmp${value ? " has" : ""}${from ? " from" : ""}${warn ? " warn" : ""}`} data-tip={warn ?? (from ? "Carried over from the OFP" : undefined)} data-tip-title={warn ? label : undefined}>
      <span className="rmp-unlit" aria-hidden="true">
        888.888
      </span>
      <span className="rmp-flash" key={value} aria-hidden="true" />
      {onChange ? (
        <input aria-label={label} inputMode="decimal" value={value} placeholder="" onChange={(e) => onChange(tidy(e.target.value))} spellCheck={false} />
      ) : (
        <span className="rmp-val">{value}</span>
      )}
    </span>
  );
}

export function RadioApp() {
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion);
  const flights = useMemo(() => (version >= 0 ? listFlights().filter((f) => f.meta.pdfSize) : []), [version]);
  const [id, setId] = useState<string | null>(null);
  const [ofp, setOfp] = useState<OFP | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [skin, setSkin] = useState<Skin>("scan");
  const [pending, setPending] = useState<Record<string, number[]>>({});

  useEffect(() => {
    queueMicrotask(() => {
      setId(new URLSearchParams(window.location.search).get("flight"));
      try {
        const k = window.localStorage.getItem(SKIN_KEY);
        if (SKINS.some(([v]) => v === k)) setSkin(k as Skin);
      } catch {
        /* storage unavailable */
      }
    });
  }, []);
  const flightId = id ?? flights[0]?.meta.id ?? null;
  const rec = useMemo(() => (version >= 0 && flightId ? readFlight(flightId) : null), [version, flightId]);

  useEffect(() => {
    if (!flightId) return;
    let live = true;
    (async () => {
      setMsg("Reading the saved plan…");
      const data = await getPdf(flightId);
      if (!data) return live && setMsg("This flight has no saved PDF: open it in the reader first.");
      const { readOfp } = await import("@/lib/ofp/pdf");
      const { ofp: o } = await readOfp(data, rec?.meta.source ?? "plan.pdf");
      if (live) {
        setOfp(o);
        setMsg(null);
      }
    })().catch(() => live && setMsg("Couldn't read the saved plan."));
    return () => {
      live = false;
    };
    // the PDF only changes with the flight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightId]);

  const pickSkin = (v: Skin) => {
    setSkin(v);
    try {
      window.localStorage.setItem(SKIN_KEY, v);
    } catch {
      /* storage unavailable */
    }
  };

  const get = (key: string) => rec?.fields[key]?.value ?? "";
  const put = useCallback((key: string, label: string, v: string) => flightId && writeField(flightId, key, v ? { section: S, label, value: v } : null), [flightId]);

  const h = ofp?.header;
  const name = (icao: string) => ofp?.wx.airports.find((a) => a.icao === icao)?.name ?? "";
  const ils = (kind: "takeoff" | "landing") =>
    (ofp?.tlr[kind].tables.find((t) => /ACARS/.test(t.title))?.rows ?? []).map((r) => ({ rwy: r[0], ils: r[3]?.match(/ILS\s+(\d{3}\.\d+)/)?.[1] ?? null })).filter((r) => r.ils);
  const planned = { dep: ofp?.tlr.takeoff.planned?.PRWY, arr: ofp?.tlr.landing.planned?.PRWY };
  const outages = ofp ? notamOutages(ofp) : new Map<string, string>();
  const offMin = hhmmToMin(h?.offTime);
  const eto = (ttlt: string | null | undefined) => {
    const t = hhmmToMin(ttlt);
    if (offMin == null || t == null) return "";
    const v = (offMin + t) % 1440;
    return `${String(Math.floor(v / 60)).padStart(2, "0")}${String(v % 60).padStart(2, "0")}Z`;
  };
  const firs = (ofp?.log ?? []).filter((p) => p.kind === "fir").map((p) => ({ name: p.firName ?? p.position ?? "FIR", eto: eto(p.ttlt) }));
  const navs = (ofp?.log ?? []).filter((p) => p.freq).map((p) => ({ id: p.ident ?? "", name: p.position ?? "", freq: p.freq!, eto: eto(p.ttlt) }));
  const alts = (ofp?.alternates ?? []).map((a) => a.apt.split("/")[0]);

  const outageNote = (f: string) => outages.get(Number(f).toFixed(2));

  /** Channels you add yourself (e.g. Oxford Approach), stored as radio.<scope>.x<n>.name / .freq. */
  const added = (scope: string) => {
    const re = new RegExp(`^radio\\.${scope}\\.x(\\d+)\\.(name|freq)$`);
    const saved = Object.keys(rec?.fields ?? {}).flatMap((k) => (re.exec(k) ? [Number(re.exec(k)![1])] : []));
    return [...new Set([...saved, ...(pending[scope] ?? [])])].sort((x, y) => x - y);
  };
  const addChannel = (scope: string) => {
    const next = Math.max(0, ...added(scope)) + 1;
    setPending((p) => ({ ...p, [scope]: [...(p[scope] ?? []), next] }));
  };
  const removeChannel = (scope: string, n: number) => {
    put(`radio.${scope}.x${n}.name`, "", "");
    put(`radio.${scope}.x${n}.freq`, "", "");
    setPending((p) => ({ ...p, [scope]: (p[scope] ?? []).filter((x) => x !== n) }));
  };

  const channel = (key: string, code: string, sub: ReactNode, label: string, editable = true) => {
    const v = get(key);
    return (
      <label key={key} className="radio-row">
        <span className="radio-id">
          <span className="radio-svc">{code}</span>
          <span className="radio-sub">{sub}</span>
        </span>
        <Window value={v} label={label} onChange={editable ? (nv) => put(key, label, nv) : undefined} warn={comCheck(v)} />
      </label>
    );
  };

  const addedRows = (scope: string, where: string) => (
    <>
      {added(scope).map((n) => {
        const nameKey = `radio.${scope}.x${n}.name`;
        const freqKey = `radio.${scope}.x${n}.freq`;
        const nm = get(nameKey);
        const v = get(freqKey);
        return (
          <div key={n} className="radio-row added">
            <span className="radio-id">
              <input className="radio-name-in" value={nm} placeholder="Station name" aria-label={`${where} added channel name`} onChange={(e) => put(nameKey, `${where} added channel ${n} name`, e.target.value.toUpperCase())} spellCheck={false} />
              <button type="button" className="radio-sub linkish" onClick={() => removeChannel(scope, n)}>
                Remove
              </button>
            </span>
            <Window value={v} label={nm || `${where} added channel`} onChange={(nv) => put(freqKey, `${where} ${nm || `added channel ${n}`}`, nv)} warn={comCheck(v)} />
          </div>
        );
      })}
      <button type="button" className="radio-add" onClick={() => addChannel(scope)} disabled={!flightId}>
        + Add channel
      </button>
    </>
  );

  const airport = (icao: string | null | undefined, role: string, ilsList: { rwy: string; ils: string | null }[], plannedRwy?: string) => (
    <div className="radio-apt">
      <header className="radio-apt-head">
        {icao ? <FlapCode key={icao} code={icao} /> : <V v={null} w={4} />}
        <span className="radio-apt-name">
          <b>{role}</b>
          <span className="small muted">{icao ? name(icao) : ""}</span>
        </span>
      </header>
      <h3 className="radio-group">COMMS</h3>
      <div className="radio-rows">
        {APT_SERVICES.map(([svc, title]) => {
          const dep = svc === "APP" && role === "Departure";
          return channel(`radio.${icao}.${svc}`, dep ? "DEP" : svc, dep ? "Departure" : title, `${icao} ${dep ? "DEP" : svc}`, !!icao);
        })}
        {icao && addedRows(icao, icao)}
      </div>
      {ilsList.length > 0 && (
        <>
          <h3 className="radio-group">
            ILS <span className="muted">· from the OFP</span>
          </h3>
          <div className="radio-rows">
            {ilsList.map((r) => (
              <div key={r.rwy} className="radio-row">
                <span className="radio-id">
                  <span className="radio-svc">ILS {r.rwy}</span>
                  <span className={`radio-sub${r.rwy === plannedRwy ? " radio-planned" : ""}`}>{r.rwy === plannedRwy ? "Planned runway" : "Runway"}</span>
                </span>
                <Window value={r.ils!} label={`ILS ${r.rwy}`} from warn={outageNote(r.ils!) ? `NOTAM: ${outageNote(r.ils!)}` : null} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const sections = [
    ["dep", "Departure"],
    ["enroute", "En route"],
    ["dest", "Destination"],
    ["altn", "Alternates"],
    ["navaids", "Navaids & ILS"],
  ] as const;

  return (
    <CollapseProvider>
      <a href="#main" className="skip">
        Skip to frequencies
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand sub="· Radio" />
          <span style={{ flex: 1 }} />
          {flights.length > 0 && (
            <select className="wx-select" value={flightId ?? ""} onChange={(e) => setId(e.target.value)} aria-label="Flight">
              {flights.map((f) => (
                <option key={f.meta.id} value={f.meta.id}>
                  {f.meta.flightNo ?? f.meta.id} · {f.meta.dep}→{f.meta.arr} · {f.meta.date}
                </option>
              ))}
            </select>
          )}
          <span className="radio-skins" role="group" aria-label="Display style">
            {SKINS.map(([v, label, tip]) => (
              <button key={v} type="button" className="toggle" aria-pressed={skin === v} onClick={() => pickSkin(v)} title={tip}>
                {label}
              </button>
            ))}
          </span>
          <CollapseAllButton ids={sections.map(([s]) => s)} className="btn status-all" />
          <Link href={flightId ? `/?flight=${encodeURIComponent(flightId)}` : "/"} className="btn">
            ← Back to plan
          </Link>
          <ThemeToggle />
        </div>
        <div className="status" role="status">
          <span>{msg ?? (h ? `${h.flightNo} · ${h.dep} → ${h.arr} · typed frequencies are saved with this flight` : flights.length ? "Pick a flight" : "No saved flights with a PDF yet: open a plan in the reader first")}</span>
        </div>
      </header>
      <div className="layout">
        <Toc sections={sections} footer={<Link href="/" className="toc-link">← Back to plan</Link>} />
        <main id="main" className={ofp ? "is-filled" : ""} data-skin={skin}>
          <Section id="dep" no={1} title="Departure" meta={<span>COMMS · ILS</span>}>
            <Replay>
            {airport(h?.dep, "Departure", ils("takeoff"), planned.dep)}
            </Replay>
          </Section>
          <Section id="enroute" no={2} title="En route" meta={<span>{firs.length} FIR / UIR</span>}>
            <Replay>
            <h3 className="radio-group">
              Centres <span className="muted">· FIR / UIR crossings from the OFP</span>
            </h3>
            <div className="radio-rows">
              {firs.map((f) => channel(`radio.fir.${f.name}`, f.name, <>Centre{f.eto && ` · ${f.eto}`}</>, `${f.name} centre`))}
              {!firs.length && <V v={null} w={30} />}
            </div>
            <h3 className="radio-group">
              Other stations <span className="muted">· information, approach units, and so on</span>
            </h3>
            <div className="radio-rows">{addedRows("enroute", "En route")}</div>
            </Replay>
          </Section>
          <Section id="dest" no={3} title="Destination" meta={<span>COMMS · ILS</span>}>
            <Replay>
            {airport(h?.arr, "Destination", ils("landing"), planned.arr)}
            </Replay>
          </Section>
          <Section id="altn" no={4} title="Alternates" meta={<span>{alts.length} airport{alts.length === 1 ? "" : "s"}</span>}>
            <Replay>
            <div className="radio-alts">{alts.length ? alts.map((a) => <div key={a}>{airport(a, "Alternate", [])}</div>) : <V v={null} w={30} />}</div>
            </Replay>
          </Section>
          <Section id="navaids" no={5} title="Navaids & ILS" meta={<span>from the OFP</span>}>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Ident</th>
                    <th scope="col">Name</th>
                    <th scope="col" className="num">
                      Freq
                    </th>
                    <th scope="col" className="num">
                      ETO
                    </th>
                    <th scope="col">NOTAM</th>
                  </tr>
                </thead>
                <tbody>
                  {navs.map((n, i) => (
                    <tr key={i}>
                      <th scope="row" className="mono">
                        {n.id}
                      </th>
                      <td>{n.name}</td>
                      <td className="num mono">{n.freq}</td>
                      <td className="num mono">{n.eto}</td>
                      <td>{outageNote(n.freq) ? <Badge tone="amber">{outageNote(n.freq)}</Badge> : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!navs.length && ofp && <p className="small muted">No radio navaids on this route (flown on RNAV waypoints).</p>}
          </Section>
        </main>
      </div>
      <TooltipLayer />
    </CollapseProvider>
  );
}
