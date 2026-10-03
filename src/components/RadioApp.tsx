"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Brand, ThemeToggle, Toc } from "./chrome";
import { CollapseAllButton, CollapseProvider } from "./collapse";
import { TooltipLayer } from "./TooltipLayer";
import { Replay } from "./replay";
import { Section, V } from "./ui";
import { FlapCode } from "./FlapCode";
import { CHANNEL_TYPES, ChannelIcon, NAVAID_TYPES, type ChannelType, type IconKind, type NavaidType } from "./radioIcons";
import { getServerVersion, getVersion, listFlights, readFlight, subscribe, writeField } from "@/lib/storage";
import { getPdf } from "@/lib/pdfCache";
import { hhmmToMin } from "@/lib/ofp/format";
import { navaidKind } from "@/lib/ofp/fplRef";
import type { OFP } from "@/lib/ofp/types";

const S = "Radio";
const SKIN_KEY = "ofp-reader:radio-skin";
const SKINS = [
  ["scan", "Scanlines", "VFD glass with fine scanlines and a pixel font"],
  ["dots", "Dots", "VFD glass behind a fine dot mesh"],
  ["classic", "Classic", "Olive LCD by day, amber by night"],
] as const;
type Skin = (typeof SKINS)[number][0];
const APT_SERVICES: [string, string, ChannelType][] = [
  ["ATIS", "Information", "atis"],
  ["DEL", "Delivery", "del"],
  ["GND", "Ground", "gnd"],
  ["TWR", "Tower", "twr"],
  ["APP", "Approach", "app"],
];

/** "11895" → "118.95"; keeps what's typed, inserts the dot after three digits. */
const tidy = (v: string) => {
  const d = v.replace(/[^\d.]/g, "");
  if (d.includes(".")) return d.slice(0, 7);
  return d.length > 3 ? `${d.slice(0, 3)}.${d.slice(3, 6)}` : d;
};

const UNLIT = "888.888";
/** "125.33" → "125.330": COMMS read with three decimals (8.33 kHz style) once you leave the field. */
const full = (v: string) => (/^\d{3}\.\d{1,2}$/.test(v) ? v.padEnd(7, "0") : v);

/** COMMS band and 8.33 / 25 kHz channel check. */
function comCheck(v: string): string | null {
  if (/^\d{0,3}\.?$/.test(v)) return null; // still typing
  if (!/^\d{3}\.\d{1,3}$/.test(v)) return "Type it as nnn.nnn";
  const f = Number(v);
  if (f >= 108 && f < 118) return "NAV frequency, not COMMS";
  if (f < 118 || f > 136.99) return "Outside the COMMS band";
  const khz = Math.round((f - 118) * 1000);
  const ok = khz % 25 === 0 || [5, 10, 15].includes(khz % 25);
  return ok ? null : "Not a 25 / 8.33 kHz channel";
}

/** NAV checks: NDB in kHz on the ADF, the rest in MHz; ILS / LOC on their odd-tenth channels. */
function navCheck(v: string, type: NavaidType): string | null {
  if (type === "ndb") {
    if (!v || /^\d{0,2}$/.test(v)) return null;
    const k = Number(v);
    return k >= 190 && k <= 1750 ? null : "Outside the NDB band (190–1750 kHz)";
  }
  if (/^\d{0,3}\.?$/.test(v)) return null;
  if (!/^\d{3}\.\d{1,2}$/.test(v)) return "Type it as nnn.nn";
  const f = Number(v);
  if (f < 108 || f > 117.95) return "Outside the NAV band (108–117.95)";
  if ((type === "ils" || type === "loc") && (f > 111.95 || Math.round(f * 10) % 2 === 0)) return "Not an ILS / LOC channel";
  return null;
}
const tidyKhz = (v: string) => v.replace(/[^\d]/g, "").slice(0, 4);
const tidyNav = (v: string) => tidy(v).replace(/^(\d{3}\.\d{0,2}).*$/, "$1");

/** "112.6" → "112.60": NAV frequencies read with two decimals. */
const full2 = (v: string) => (/^\d{3}\.\d$/.test(v) ? `${v}0` : v);

/** Title case for OFP names ("SAN SEBASTI" → "San Sebasti"). */
const titleCase = (v: string) => v.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** Runway on the reciprocal heading: 14R → 32L, 18C → 36C. */
function reciprocal(rwy: string): string {
  const m = /^(\d{2})([LCR]?)$/.exec(rwy);
  if (!m) return "";
  const n = ((Number(m[1]) + 17) % 36) + 1;
  return `${String(n).padStart(2, "0")}${{ L: "R", R: "L", C: "C", "": "" }[m[2] as "L"]}`;
}

const MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--",
  N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.",
};

/** A station ident in Morse: dots and dashes per letter, the letter underneath. */
function Morse({ ident }: { ident: string }) {
  const letters = [...ident.toUpperCase()].filter((c) => MORSE[c]);
  if (!letters.length) return null;
  return (
    <span className="morse" data-tip={`Morse ident: ${letters.map((c) => MORSE[c].replace(/\./g, "·").replace(/-/g, "−")).join("  ")}`}>
      {letters.map((c, i) => (
        <span key={i} className="morse-l">
          <i aria-hidden="true">
            {[...MORSE[c]].map((x, j) => (
              <span key={j} className={x === "." ? "dit" : "dah"} />
            ))}
          </i>
          <b>{c}</b>
        </span>
      ))}
    </span>
  );
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

/**
 * A radio-panel window: a pictogram segment, then the digits over an unlit 888.888.
 * `error` (a wrong frequency) turns it red with a stop sign; `warn` (a NOTAM) rings it amber.
 */
function Window({
  value,
  onChange,
  label,
  icon,
  from,
  error,
  warn,
  unlit = UNLIT,
  unit,
  clean = tidy,
  finish = full,
}: {
  value: string;
  onChange?: (v: string) => void;
  label: string;
  icon: IconKind;
  from?: boolean;
  error?: string | null;
  warn?: string | null;
  /** The unlit segments, e.g. "888.88" for NAV, "8888" for an NDB. */
  unlit?: string;
  unit?: string;
  clean?: (v: string) => string;
  finish?: (v: string) => string;
}) {
  const tip = error ?? warn ?? (from ? "Carried over from the OFP" : undefined);
  return (
    <span className={`rmp${value ? " has" : ""}${from ? " from" : ""}${error ? " bad" : warn ? " warn" : ""}`} data-tip={tip} data-tip-title={error || warn ? label : undefined}>
      <span className="rmp-ic">
        <ChannelIcon kind={error ? "stop" : icon} />
      </span>
      <span className="rmp-unlit" aria-hidden="true">
        {unlit}
        {unit && <span className="rmp-unit">{unit}</span>}
      </span>
      <span className="rmp-flash" key={value} aria-hidden="true" />
      <span className="rmp-val" aria-hidden={onChange ? true : undefined}>
        {/* kHz (ADF) pads on the left like an ADF display; MHz leaves the unused decimals unlit on the right */}
        {value && unit && <span className="rmp-rest">{unlit.slice(value.length)}</span>}
        {value}
        {value && !unit && <span className="rmp-rest">{unlit.slice(value.length)}</span>}
        {value && unit && <span className="rmp-unit">{unit}</span>}
      </span>
      {onChange && (
        <input
          aria-label={label}
          aria-invalid={!!error}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(clean(e.target.value))}
          onBlur={() => value !== finish(value) && onChange(finish(value))}
          spellCheck={false}
        />
      )}
    </span>
  );
}

/** The type picker on an added channel: a pill that opens a menu of types with their pictograms. */
function TypePicker<T extends IconKind>({ value, onPick, where, options = CHANNEL_TYPES as unknown as readonly (readonly [T, string, string])[] }: { value: T; onPick: (t: T) => void; where: string; options?: readonly (readonly [T, string, string])[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const code = options.find(([t]) => t === value)?.[1] ?? options[0][1];
  return (
    <span className="ch-type" ref={ref}>
      <button type="button" className="ch-type-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={`${where} channel type: ${code}`} onClick={() => setOpen(!open)}>
        {code} ▾
      </button>
      {open && (
        <span className={`ch-menu${options.some(([, c]) => c.length > 4) ? " wide" : ""}`} role="listbox" aria-label="Type">
          {options.map(([t, c, name]) => (
            <button
              key={t}
              type="button"
              role="option"
              aria-selected={t === value}
              onClick={() => {
                onPick(t);
                setOpen(false);
              }}
            >
              <ChannelIcon kind={t} size={18} />
              <b>{c}</b>
              {name}
            </button>
          ))}
        </span>
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
  const clock = (v: number | null) => (v == null ? "" : `${String(Math.floor((v % 1440) / 60)).padStart(2, "0")}${String(v % 60).padStart(2, "0")}Z`);
  const eto = (ttlt: string | null | undefined) => {
    const t = hhmmToMin(ttlt);
    return offMin == null || t == null ? "" : clock(offMin + t);
  };
  const firs = (ofp?.log ?? []).filter((p) => p.kind === "fir").map((p) => ({ name: p.firName ?? p.position ?? "FIR", eto: eto(p.ttlt) }));
  const navs = (ofp?.log ?? []).filter((p) => p.freq).map((p) => ({ id: p.ident ?? "", name: p.position ?? "", freq: p.freq!, eto: eto(p.ttlt) }));
  const alts = (ofp?.alternates ?? []).map((a) => a.apt.split("/")[0]);

  const outageNote = (f: string) => outages.get(Number(f).toFixed(2));

  /** Channels you add yourself (e.g. Oxford Approach), stored as radio.<scope>.x<n>.name / .freq. */
  const added = (scope: string) => {
    const re = new RegExp(`^radio\\.${scope}\\.x(\\d+)\\.(name|freq|type|ident)$`);
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
    put(`radio.${scope}.x${n}.type`, "", "");
    put(`radio.${scope}.x${n}.ident`, "", "");
    setPending((p) => ({ ...p, [scope]: (p[scope] ?? []).filter((x) => x !== n) }));
  };

  const channel = (key: string, code: string, sub: ReactNode, label: string, icon: IconKind, editable = true) => {
    const v = get(key);
    const err = comCheck(v);
    return (
      <label key={key} className={`radio-row${err ? " bad" : ""}`}>
        <span className="radio-id">
          <span className="radio-svc">{code}</span>
          <span className={`radio-sub${err ? " err" : ""}`}>{err ?? sub}</span>
        </span>
        <Window value={v} label={label} icon={icon} onChange={editable ? (nv) => put(key, label, nv) : undefined} error={err} />
      </label>
    );
  };

  const addedRows = (scope: string, where: string, fallback: ChannelType) => (
    <>
      {added(scope).map((n) => {
        const base = `radio.${scope}.x${n}`;
        const nm = get(`${base}.name`);
        const v = get(`${base}.freq`);
        const type = (CHANNEL_TYPES.find(([t]) => t === get(`${base}.type`))?.[0] ?? fallback) as ChannelType;
        const err = comCheck(v);
        return (
          <div key={n} className={`radio-row added${err ? " bad" : ""}`}>
            <span className="radio-id">
              <input className="radio-name-in" value={nm} placeholder="Station name" aria-label={`${where} added channel name`} onChange={(e) => put(`${base}.name`, `${where} added channel ${n} name`, e.target.value.toUpperCase())} spellCheck={false} />
              <span className="radio-added-meta">
                <TypePicker value={type} where={nm || where} onPick={(t) => put(`${base}.type`, `${where} added channel ${n} type`, t)} />
                {err ? (
                  <span className="radio-sub err">{err}</span>
                ) : (
                  <button type="button" className="radio-sub linkish" onClick={() => removeChannel(scope, n)}>
                    Remove
                  </button>
                )}
              </span>
            </span>
            <Window value={v} label={nm || `${where} added channel`} icon={type} onChange={(nv) => put(`${base}.freq`, `${where} ${nm || `added channel ${n}`}`, nv)} error={err} />
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
        {APT_SERVICES.map(([svc, title, icon]) => {
          const dep = svc === "APP" && role === "Departure";
          return channel(`radio.${icao}.${svc}`, dep ? "DEP" : svc, dep ? "Departure" : title, `${icao} ${dep ? "DEP" : svc}`, dep ? "dep" : icon, !!icao);
        })}
        {icao && addedRows(icao, icao, role === "Departure" ? "dep" : "app")}
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
                <Window value={r.ils!} label={`ILS ${r.rwy}`} icon="ils" unlit="888.88" from warn={outageNote(r.ils!) ? `NOTAM: ${outageNote(r.ils!)}` : null} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  /* ---- 05 NAV tuning: what to set on the NAV / ADF radios, in flight order ---- */
  type NavStep = { key: string; eto?: string; etoSub?: string; ident: string; tag: string; tagClass?: string; name: string; note?: string; radio: string; icon: IconKind; freq: string; unlit: string; unit?: string; morse?: boolean; apt?: boolean };
  const ilsOf = (list: { rwy: string; ils: string | null }[], rwy?: string | null) => (rwy ? (list.find((r) => r.rwy === rwy)?.ils ?? null) : null);
  const rwyStep = (key: string, apt: string, rwy: string, freq: string | null, what: string, extra: Partial<NavStep>): NavStep => ({
    key,
    ident: rwy,
    tag: freq ? "ILS" : "NO ILS",
    tagClass: freq ? "ils" : "",
    name: freq ? `${titleCase(name(apt) || apt)} · ${what}` : `Runway ${rwy} has no ILS in the plan`,
    radio: "NAV 1",
    icon: "ils",
    freq: freq ?? "",
    unlit: "888.88",
    ...extra,
  });
  const depSteps: NavStep[] = [];
  const arrSteps: NavStep[] = [];
  if (h?.dep && planned.dep) {
    const own = ilsOf(ils("takeoff"), planned.dep);
    const rec = reciprocal(planned.dep);
    const recIls = rec !== planned.dep ? ilsOf(ils("takeoff"), rec) : null;
    depSteps.push(rwyStep("dep", h.dep, planned.dep, own, "planned take-off runway", { eto: clock(offMin), etoSub: "off", apt: true, note: !own && recIls ? `For a quick return: ILS ${rec}, the reciprocal runway, below` : undefined }));
    if (recIls) depSteps.push(rwyStep("ret", h.dep, rec, recIls, "", { name: `Return to ${h.dep} · the reciprocal of ${planned.dep}` }));
  }
  const routeSteps: NavStep[] = navs.map((n, i) => {
    const ndb = navaidKind(n.freq).kind === "NDB";
    return { key: `nav${i}`, eto: n.eto, ident: n.id, tag: ndb ? "NDB" : "VOR", tagClass: ndb ? "ndb" : "", name: `${titleCase(n.name)} · ${n.freq} ${ndb ? "kHz" : "MHz"}`, radio: ndb ? "ADF" : "NAV 2", icon: ndb ? "ndb" : "vor", freq: n.freq, unlit: ndb ? "8888" : "888.88", unit: ndb ? "kHz" : undefined, morse: true };
  });
  if (h?.arr && planned.arr) arrSteps.push(rwyStep("arr", h.arr, planned.arr, ilsOf(ils("landing"), planned.arr), "planned landing runway", { eto: clock(hhmmToMin(h.onTime)), etoSub: "on", apt: true }));

  const navStep = (st: NavStep, cls: string) => {
    const out = st.freq ? outageNote(st.freq) : undefined;
    return (
      <div key={st.key} className={`nav-step${cls}${st.apt ? " apt" : ""}`}>
        <div className="nav-eto">
          {st.eto}
          {st.etoSub && <small>{st.etoSub}</small>}
        </div>
        <div className="nav-rail">
          <span className="nav-dot" />
        </div>
        <div className={`nav-card${out ? " warn" : ""}`}>
          <div className="nav-who">
            <div className="nav-top">
              <span className="nav-ident">{st.ident}</span>
              <span className={`nav-tag ${st.tagClass ?? ""}`}>{st.tag}</span>
              {st.morse && <Morse ident={st.ident} />}
            </div>
            <div className="nav-name">{st.name}</div>
            {(out || st.note) && <div className={`nav-note${out ? " warn" : ""}`}>{out ? `NOTAM: ${out}` : st.note}</div>}
          </div>
          <div className="nav-radio">
            tune on<b>{st.radio}</b>
          </div>
          <Window value={st.freq} label={`${st.ident} ${st.tag}`} icon={st.icon} unlit={st.unlit} unit={st.unit} from warn={out ? `NOTAM: ${out}` : null} />
        </div>
      </div>
    );
  };
  const navGroup = (steps: NavStep[], start: boolean, end: boolean) => steps.map((st, i) => navStep(st, `${start && i === 0 ? " first" : ""}${end && i === steps.length - 1 ? " last" : ""}`));

  const addedNavaids = () => (
    <>
      {added("nav").map((n) => {
        const base = `radio.nav.x${n}`;
        const id = get(`${base}.ident`);
        const nm = get(`${base}.name`);
        const v = get(`${base}.freq`);
        const type = (NAVAID_TYPES.find(([t]) => t === get(`${base}.type`))?.[0] ?? "vor") as NavaidType;
        const ndb = type === "ndb";
        const err = navCheck(v, type);
        const label = `Navaid ${id || n}`;
        return (
          <div key={n} className="nav-step added">
            <div className="nav-eto" />
            <div className="nav-rail" />
            <div className={`nav-card${err ? " bad" : ""}`}>
              <div className="nav-who">
                <div className="nav-top">
                  <input className="nav-ident-in" value={id} placeholder="Ident" aria-label="Navaid ident" maxLength={4} onChange={(e) => put(`${base}.ident`, `${label} ident`, e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} spellCheck={false} />
                  <TypePicker value={type} options={NAVAID_TYPES} where={id || "Navaid"} onPick={(t) => put(`${base}.type`, `${label} type`, t)} />
                  <Morse ident={id} />
                </div>
                <span className="radio-added-meta">
                  <input className="nav-name-in" value={nm} placeholder="Station name" aria-label="Navaid name" onChange={(e) => put(`${base}.name`, `${label} name`, e.target.value)} />
                  <button type="button" className="radio-sub linkish" onClick={() => removeChannel("nav", n)}>
                    Remove
                  </button>
                </span>
                {err && <div className="nav-note bad">{err}</div>}
              </div>
              <div className="nav-radio">
                tune on<b>{ndb ? "ADF" : "NAV"}</b>
              </div>
              <Window
                value={v}
                label={`${id || "Navaid"} ${ndb ? "kHz" : "MHz"}`}
                icon={type}
                unlit={ndb ? "8888" : "888.88"}
                unit={ndb ? "kHz" : undefined}
                clean={ndb ? tidyKhz : tidyNav}
                finish={ndb ? (x) => x : full2}
                onChange={(nv) => put(`${base}.freq`, `${label} frequency`, nv)}
                error={err}
              />
            </div>
          </div>
        );
      })}
      <div className="nav-step">
        <div className="nav-eto" />
        <div className="nav-rail" />
        <button type="button" className="radio-add" onClick={() => addChannel("nav")} disabled={!flightId}>
          + Add navaid
        </button>
      </div>
    </>
  );

  const sections = [
    ["dep", "Departure"],
    ["enroute", "En route"],
    ["dest", "Destination"],
    ["altn", "Alternates"],
    ["navaids", "NAV tuning"],
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
              {firs.map((f) => channel(`radio.fir.${f.name}`, f.name, <>Centre{f.eto && ` · ${f.eto}`}</>, `${f.name} centre`, "ctr"))}
              {!firs.length && <V v={null} w={30} />}
            </div>
            <h3 className="radio-group">
              Other stations <span className="muted">· information, approach units, and so on</span>
            </h3>
            <div className="radio-rows">{addedRows("enroute", "En route", "info")}</div>
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
          <Section id="navaids" no={5} title="NAV tuning" meta={<span>from the OFP · in flight order</span>}>
            <Replay>
              <p className="nav-lede">What to set on the NAV and ADF radios, in the order you&apos;ll need it. The Morse code is each station&apos;s ident, so you can check it by ear.</p>
              {depSteps.length > 0 && (
                <>
                  <h3 className="radio-group nav-phase">
                    Departure <span className="muted">· {h?.dep} runway {planned.dep}</span>
                  </h3>
                  {navGroup(depSteps, true, false)}
                </>
              )}
              <h3 className="radio-group nav-phase">
                En route <span className="muted">· VOR and NDB on the route</span>
              </h3>
              {routeSteps.length ? navGroup(routeSteps, false, false) : ofp && <p className="small muted nav-none">No radio navaids on this route: it&apos;s flown on RNAV waypoints.</p>}
              {arrSteps.length > 0 && (
                <>
                  <h3 className="radio-group nav-phase">
                    Arrival <span className="muted">· {h?.arr} runway {planned.arr}</span>
                  </h3>
                  {navGroup(arrSteps, false, true)}
                </>
              )}
              <h3 className="radio-group nav-phase">
                Added by you <span className="muted">· anything the OFP doesn&apos;t list</span>
              </h3>
              {addedNavaids()}
            </Replay>
          </Section>
        </main>
      </div>
      <TooltipLayer />
    </CollapseProvider>
  );
}
