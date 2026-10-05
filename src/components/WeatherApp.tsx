"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Brand, ThemeToggle, Toc } from "./chrome";
import { CollapseAllButton, CollapseProvider } from "./collapse";
import { TooltipLayer } from "./TooltipLayer";
import { Section } from "./ui";
import { ObsCard, TafCard } from "./WxCards";
import { LiveWx } from "./LiveWx";
import { getServerVersion, getVersion, listFlights, subscribe } from "@/lib/storage";
import { getPdf } from "@/lib/pdfCache";
import { adoptFlightParam, mirrorFlightParam, useActiveFlight } from "@/lib/active";
import { PlanChips, StatusLine } from "./FlightMenu";
import { parseAll, type Report } from "@/lib/wx/reports";

const INPUT_KEY = "ofp-reader:wx-input";
/** Which flight's reports fill the box: a flight id, or "user" once you've pasted, fetched or cleared it yourself. */
const FROM_KEY = "ofp-reader:wx-from";

/**
 * Illustrative reports for trying the page; not real observations. Times are stamped
 * relative to now so the "minutes ago" readouts make sense.
 */
function buildExample(now = new Date()) {
  const at = (minAgo: number) => {
    const d = new Date(now.getTime() - minAgo * 60000);
    const p = (n: number) => String(n).padStart(2, "0");
    return {
      dd: p(d.getUTCDate()),
      hh: p(d.getUTCHours()),
      mm: p(d.getUTCMinutes()),
      d,
    };
  };
  const p = (n: number) => String(n).padStart(2, "0");
  const obs = at(20);
  const iss = at(110);
  const from = at(-40); // validity starts at the next hour-ish
  const vFrom = `${from.dd}${from.hh}`;
  const end = new Date(from.d.getTime() + 30 * 3600e3);
  const vTo = `${p(end.getUTCDate())}${p(end.getUTCHours())}`;
  const h = (add: number) => {
    const d = new Date(from.d.getTime() + add * 3600e3);
    return `${p(d.getUTCDate())}${p(d.getUTCHours())}`;
  };
  return `METAR EGLL ${obs.dd}${obs.hh}${obs.mm}Z 24012G24KT 210V280 9999 -SHRA FEW014 BKN032CB 15/09 Q1013 TEMPO 4000 SHRA
TAF EGLL ${iss.dd}${iss.hh}${iss.mm}Z ${vFrom}/${vTo} 24012KT 9999 SCT030
  TEMPO ${h(0)}/${h(6)} 24018G30KT 4000 SHRA BKN014CB
  BECMG ${h(8)}/${h(11)} 27008KT
  PROB30 TEMPO ${h(12)}/${h(18)} 2500 BR BKN006
EGLL ARR ATIS F ${obs.hh}${obs.mm}Z EXP ILS APCH RWY 27L 24012G24KT 9999 -SHRA FEW014 BKN032CB 15/09 Q1013 TL 70

METAR LFPG ${obs.dd}${obs.hh}${obs.mm}Z VRB02KT 0300 FG VV001 08/08 Q1021 NOSIG
TAF LFPG ${iss.dd}${iss.hh}${iss.mm}Z ${vFrom}/${vTo} VRB03KT 0400 FG VV002 BECMG ${h(1)}/${h(3)} 4000 BR BKN005 FM${h(6)}00 21010KT 9999 SCT025

THIS IS SCHIPHOL INFORMATION ROMEO, TIME ${obs.hh}${
    obs.mm
  }. LANDING RUNWAY 18 RIGHT, TAKE-OFF RUNWAY 24. TRANSITION LEVEL 60. SURFACE WIND 220 DEGREES 15 KNOTS, GUSTING 27 KNOTS. VISIBILITY 10 KILOMETRES. LIGHT RAIN. SCATTERED 1800 FEET, BROKEN 3500 FEET. TEMPERATURE 13, DEW POINT 10. QNH 1009. ACKNOWLEDGE INFORMATION ROMEO.

METAR KJFK ${obs.dd}${obs.hh}${obs.mm}Z 31022G35KT 10SM FEW050 SCT250 18/02 A2995`;
}

/* ---------- page ---------- */

function readKey(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
const readInput = () => readKey(INPUT_KEY) ?? "";

export function WeatherApp() {
  const [text, setText] = useState("");
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  // Restore the last text once, then save on change (not before the restore, or it would be wiped).
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      setText(readInput());
      setFrom(readKey(FROM_KEY));
      setRestored(true);
    });
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(INPUT_KEY, text);
      if (from) window.localStorage.setItem(FROM_KEY, from);
    } catch {
      /* storage unavailable: the page still works */
    }
  }, [text, from, restored]);
  /** Text you typed, fetched or cleared yourself: never replaced automatically. */
  const setOwnText = (t: string) => {
    setText(t);
    setFrom("user");
    setLoadedFrom(null);
  };

  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion);
  const saved = useMemo(() => (version >= 0 ? listFlights().filter((f) => f.meta.pdfSize) : []), [version]);

  // A report needs an airport or a time (ATIS: a letter or runway) to count; the rest is listed as not recognised.
  const [reports, unknown] = useMemo(() => {
    const all = parseAll(text);
    const ok = (r: Report) => (r.kind === "ATIS" ? !!(r.atis?.letter || r.icao || r.atis?.runways.length) : !!(r.icao || r.time));
    return [all.filter(ok), all.filter((r) => !ok(r))];
  }, [text]);
  const airports = useMemo(() => {
    const by = new Map<string, Report[]>();
    for (const r of reports) {
      const k = r.icao ?? r.atis?.name ?? "Unknown";
      by.set(k, [...(by.get(k) ?? []), r]);
    }
    const rank = { ATIS: 0, METAR: 1, SPECI: 1, TAF: 2 };
    return [...by.entries()].map(([k, list]) => ({
      key: k,
      id: `wx-${k.replace(/\W+/g, "-").toLowerCase()}`,
      list: list.sort((a, b) => rank[a.kind] - rank[b.kind]),
    }));
  }, [reports]);

  const loadPlan = useCallback(async (id: string) => {
    const f = saved.find((s) => s.meta.id === id);
    if (!f) return;
    setBusy(`Reading ${f.meta.flightNo ?? id}…`);
    try {
      const data = await getPdf(id);
      if (!data) throw new Error("The saved PDF is missing.");
      const { readOfp } = await import("@/lib/ofp/pdf");
      const { ofp } = await readOfp(data, f.meta.source);
      // The OFP lists reports under an airport heading, without the ICAO code in the report itself.
      const lines = ofp.wx.airports.flatMap((a) => [a.metar ? `METAR ${a.icao} ${a.metar}` : "", a.taf.length ? `TAF ${a.icao} ${a.taf.join("\n  ")}` : "", ""]).filter((l, i, arr) => l || arr[i - 1]);
      setText(lines.join("\n").trim());
      setFrom(id);
      setLoadedFrom(`${f.meta.flightNo ?? id} ${f.meta.dep ?? ""}→${f.meta.arr ?? ""}`);
      setBusy(null);
    } catch (e) {
      setBusy(e instanceof Error ? e.message : "Couldn't read that plan.");
    }
  }, [saved]);

  // Follow the active flight: load its reports when the box holds another flight's (or nothing yet),
  // but never replace reports you pasted yourself; for those, offer a button instead.
  const { id: activeId, record: activeRec, ready: activeReady } = useActiveFlight();
  useEffect(() => {
    if (activeReady) adoptFlightParam();
  }, [activeReady]);
  useEffect(() => {
    if (activeReady) mirrorFlightParam(activeId);
  }, [activeReady, activeId]);
  const own = from === "user" && !!text.trim();
  const canLoad = !!activeId && !!activeRec?.meta.pdfSize && from !== activeId;
  const autoLoad = restored && canLoad && (from === null ? !text.trim() : from !== "user");
  useEffect(() => {
    if (autoLoad && activeId) queueMicrotask(() => void loadPlan(activeId));
  }, [autoLoad, activeId, loadPlan]);

  // "from …": the source just loaded, or, after a reload, the saved flight whose reports fill the box
  const fromRec = from && from !== "user" ? saved.find((f) => f.meta.id === from) : null;
  const fromLabel = loadedFrom ?? (fromRec ? `${fromRec.meta.flightNo ?? fromRec.meta.id} ${fromRec.meta.dep ?? ""}→${fromRec.meta.arr ?? ""}` : null);
  const pending = !restored || !activeReady || autoLoad || (busy?.startsWith("Reading") ?? false);
  const sections = [["reports", "Paste reports"], ...airports.map((a) => [a.id, a.key] as const)] as const;

  return (
    <CollapseProvider>
      <a href="#main" className="skip">
        Skip to weather
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand sub="· Weather" />
          <span style={{ flex: 1 }} />
          <CollapseAllButton ids={sections.map(([id]) => id)} className="btn status-all" />
          <Link href="/" className="btn">
            ← Back to reader
          </Link>
          <ThemeToggle />
        </div>
        <StatusLine>
          <PlanChips />
          <span className="examples-sep" aria-hidden="true" />
          <span role="status">
            {reports.length
              ? `${reports.length} ${reports.length === 1 ? "report" : "reports"} · ${airports.length} ${airports.length === 1 ? "airport" : "airports"}${fromLabel ? ` · from ${fromLabel}` : ""}`
              : "Paste METARs, TAFs or ATIS to see them as weather cards"}
          </span>
        </StatusLine>
      </header>

      <div className="layout">
        <Toc
          sections={sections}
          pending={pending}
        />
        <main id="main" className="is-filled">
          {!pending && (
            <>
          <Section id="reports" no={1} title="Paste reports" meta={<span>METAR · SPECI · TAF · ATIS</span>}>
            <p className="small muted" style={{ marginTop: 0 }}>
              Paste any mix of reports, one after another. Coded and plain-language ATIS both work. Nothing leaves your browser; the text is kept here for next time.
            </p>
            <textarea
              className="wx-input"
              value={text}
              onChange={(e) => setOwnText(e.target.value)}
              spellCheck={false}
              rows={8}
              aria-label="METAR, TAF and ATIS text"
              placeholder={"METAR EGLL 021250Z 24012KT 9999 FEW040 15/09 Q1013\nTAF EGLL 021100Z 0212/0318 24012KT 9999 SCT030 TEMPO 0212/0218 4000 SHRA\nEGLL ARR ATIS F 1250Z EXP ILS APCH RWY 27L …"}
            />
            <LiveWx
              suggested={[...new Set(reports.map((r) => r.icao).filter((x): x is string => !!x))]}
              onText={(t, src) => {
                setOwnText(t);
                setLoadedFrom(src);
              }}
            />
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" className="btn" onClick={() => setOwnText(buildExample())}>
                Load examples
              </button>
              {canLoad && !autoLoad && (
                <button type="button" className="btn" onClick={() => void loadPlan(activeId!)}>
                  {own ? "Replace with" : "Load"} {activeRec?.meta.flightNo ?? "the active flight"}&apos;s reports
                </button>
              )}
              <button type="button" className="btn" disabled={!text} onClick={() => setOwnText("")}>
                Clear
              </button>
              {busy && <span className="small muted">{busy}</span>}
            </div>
            {unknown.length > 0 && (
              <div className="note" role="status">
                <b>Not recognised</b> (no airport code or report time):
                <ul className="small mono">
                  {unknown.map((r, i) => (
                    <li key={i}>{r.raw.length > 90 ? `${r.raw.slice(0, 90)}…` : r.raw}</li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {airports.map((a, i) => (
            <Section key={a.id} id={a.id} no={i + 2} title={a.key} meta={<span>{a.list.map((r) => r.kind + (r.atis?.letter ? ` ${r.atis.letter}` : "")).join(" · ")}</span>}>
              {/* Observations (METAR / SPECI / ATIS) share a row; each TAF takes the full width below. */}
              <div className="wxc-grid">
                {a.list
                  .filter((r) => r.kind !== "TAF")
                  .map((r, k) => (
                    <ObsCard key={k} r={r} />
                  ))}
              </div>
              {a.list
                .filter((r) => r.kind === "TAF")
                .map((r, k) => (
                  <TafCard key={k} r={r} />
                ))}
            </Section>
          ))}
            </>
          )}
        </main>
      </div>
      <TooltipLayer />
    </CollapseProvider>
  );
}
