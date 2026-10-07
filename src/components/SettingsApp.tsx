"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Brand, ThemeToggle, Toc } from "./chrome";
import { CollapseAllButton, CollapseProvider } from "./collapse";
import { TooltipLayer } from "./TooltipLayer";
import { Badge, Field, Section, Sub, Tip, V, cx } from "./ui";
import { fmtDate } from "@/lib/ofp/format";
import {
  applyTheme,
  clearAll,
  clearFields,
  deleteFlight,
  getServerVersion,
  getVersion,
  importFlight,
  listFlights,
  readTheme,
  storageBytes,
  subscribe,
  type FlightRecord,
  type ThemePref,
  writeField,
} from "@/lib/storage";
import { clearPdfs, deletePdf } from "@/lib/pdfCache";
import { adoptFlightParam, mirrorFlightParam, setActive, useActiveFlight } from "@/lib/active";
import { PlanChips, StatusLine } from "./FlightMenu";
import { DEFAULT_STRIP, STRIP_MODES, useStripMode, type StripMode } from "@/lib/stripPref";
import { DEFAULT_FIR, DEFAULT_MAP, FIR_MODES, MAP_STYLES, useFirMode, useMapStyle, type MapStyle } from "@/lib/mapPref";

const SECTIONS = [
  ["flights", "Saved flights"],
  ["stored", "Stored data"],
  ["appearance", "Appearance"],
  ["storage", "Storage & privacy"],
] as const;

const SECTION_ORDER = ["Planned fuel", "Alternate & routing", "Times & weights", "Flight log", "Runway analysis"];

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`);

/** Saved copy first (no download); otherwise the original link. */
function readerHref(r: FlightRecord) {
  if (r.meta.pdfSize) return `/?flight=${encodeURIComponent(r.meta.id)}`;
  return r.meta.sourceUrl ? `/?ofp=${encodeURIComponent(r.meta.sourceUrl)}` : null;
}

function removeFlight(id: string) {
  deleteFlight(id);
  void deletePdf(id);
}

function exportFlight(r: FlightRecord) {
  const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ofp-reader_${r.meta.id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

interface ImportMsg {
  ok: boolean;
  text: string;
}

/** Imports each chosen export file; returns one line per file and the last imported id. */
async function importFiles(files: FileList): Promise<{ msgs: ImportMsg[]; lastId: string | null }> {
  const msgs: ImportMsg[] = [];
  let lastId: string | null = null;
  for (const file of Array.from(files)) {
    try {
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error("Not valid JSON.");
      }
      const r = importFlight(data);
      lastId = r.id;
      const n = r.added + r.replaced;
      const what = r.isNew
        ? `added with ${r.added} ${r.added === 1 ? "entry" : "entries"}`
        : n
          ? `merged: ${r.added} new, ${r.replaced} updated`
          : "already up to date";
      msgs.push({ ok: true, text: `${r.label}: ${what}` });
    } catch (e) {
      msgs.push({ ok: false, text: `${file.name}: ${e instanceof Error ? e.message : "couldn't import"}` });
    }
  }
  return { msgs, lastId };
}

/** Tiny schematic of each flight-summary graphic for the Appearance picker. */
function StripIcon({ mode }: { mode: StripMode }) {
  const paths: Record<StripMode, React.ReactNode> = {
    profile: <path d="M4 22 L18 7 L62 7 L76 22" />,
    "profile-times": (
      <>
        <path d="M4 17 L18 4 L62 4 L76 17" />
        <path d="M4 17v4M18 17v7M62 17v7M76 17v4" strokeWidth="1" />
      </>
    ),
    route: <path d="M4 14 L14 19 L26 17 L36 9 L48 13 L60 16 L76 14" />,
    timeline: (
      <>
        <path d="M4 13h12" className="ic-taxi" />
        <path d="M18 13h52" strokeWidth="4" />
        <path d="M70 13h6" className="ic-taxi" />
      </>
    ),
    arc: <path d="M4 22 Q40 -6 76 22" />,
  };
  return (
    <svg width="80" height="26" viewBox="0 0 80 26" className="strip-icon" aria-hidden="true">
      {paths[mode]}
    </svg>
  );
}

function LockIcon({ open, dim }: { open: boolean; dim?: boolean }) {
  return (
    <svg className={cx("lock-ic", dim && "dim")} viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d={open ? "M8 11V7.5a4 4 0 0 1 7.6-1.7" : "M8 11V7.5a4 4 0 0 1 8 0V11"} />
    </svg>
  );
}

/** A small sample of each route-map style: sea, two countries, a coast, a ridge and the route. */
function MapIcon({ style }: { style: MapStyle }) {
  const lines = style !== "plain";
  return (
    <svg className="map-icon" viewBox="0 0 120 44" aria-hidden="true">
      <rect width="120" height="44" fill="var(--map-sea)" />
      <path d="M0 14 C18 10 30 18 44 12 L62 8 L62 44 L0 44 Z" fill="var(--map-land)" />
      <path d="M62 8 L84 6 C98 10 108 4 120 8 L120 44 L62 44 Z" fill={style === "plain" ? "var(--map-land-1)" : "var(--map-land)"} />
      {style === "relief" && (
        <g>
          <path d="M0 30 C20 26 40 32 62 28 L62 44 L0 44 Z" fill="var(--map-d0)" stroke="var(--map-depth-line)" strokeWidth="0.7" strokeDasharray="3 2" />
          <path d="M68 44 C70 30 80 20 92 22 C104 24 112 32 116 44 Z" fill="var(--map-h1)" stroke="var(--map-contour)" strokeWidth="0.7" />
          <path d="M80 44 C82 34 88 28 94 30 C100 32 104 38 106 44 Z" fill="var(--map-h3)" stroke="var(--map-contour)" strokeWidth="0.7" />
          <path d="M88 44 C90 38 93 35 96 37 C99 39 100 42 101 44 Z" fill="var(--map-h5)" stroke="var(--map-contour)" strokeWidth="0.9" />
        </g>
      )}
      {lines && <path d="M0 14 C18 10 30 18 44 12 L62 8 L84 6 C98 10 108 4 120 8" fill="none" stroke="var(--map-coast)" strokeWidth="1" />}
      {lines && <path d="M62 8 L62 44" fill="none" stroke="var(--map-border)" strokeWidth="0.9" />}
      <path d="M10 36 L50 26 L110 30" fill="none" stroke="var(--magenta)" strokeWidth="2" />
      <path d="M10 32 L50 22 L110 26" fill="none" stroke="var(--ink-2)" strokeWidth="1" strokeDasharray="3 2" />
    </svg>
  );
}

export function SettingsApp() {
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion);
  const ready = version >= 0;
  // `version` changes whenever storage does, so these re-read on every change.
  const flights = useMemo(() => (version >= 0 ? listFlights() : []), [version]);
  const theme = useMemo<ThemePref>(() => (version >= 0 ? readTheme() : "system"), [version]);
  const bytes = useMemo(() => (version >= 0 ? storageBytes() : 0), [version]);
  const pdfBytes = flights.reduce((s, f) => s + (f.meta.pdfSize ?? 0), 0);
  // The flight shown below is the active flight (shared with every page); choosing a row switches it.
  const { id: activeId, ready: activeReady } = useActiveFlight();
  useEffect(() => {
    if (activeReady) adoptFlightParam();
  }, [activeReady]);
  useEffect(() => {
    if (activeReady) mirrorFlightParam(activeId);
  }, [activeReady, activeId]);
  const [stripMode, setStripMode] = useStripMode();
  const [mapStyle, setMapStyle] = useMapStyle();
  const [firMode, setFirMode] = useFirMode();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsgs, setImportMsgs] = useState<ImportMsg[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const sel = flights.find((f) => f.meta.id === activeId) ?? null;

  const groups = useMemo(() => {
    if (!sel) return [];
    const by = new Map<string, { key: string; label: string; value: string }[]>();
    for (const [key, f] of Object.entries(sel.fields)) {
      const list = by.get(f.section) ?? [];
      list.push({ key, label: f.label, value: f.value });
      by.set(f.section, list);
    }
    const rank = (s: string) => (SECTION_ORDER.includes(s) ? SECTION_ORDER.indexOf(s) : 99);
    return [...by.entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0]))
      .map(([section, items]) => ({ section, items: items.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true })) }));
  }, [sel]);

  const count = (r: FlightRecord) => Object.keys(r.fields).length;

  return (
    <CollapseProvider>
      <a href="#main" className="skip">
        Skip to settings
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand sub="· Settings" />
          <span style={{ flex: 1 }} />
          <CollapseAllButton ids={SECTIONS.map(([id]) => id)} className="btn status-all" />
          <Link href="/" className="btn">
            ← Back to reader
          </Link>
          <ThemeToggle />
        </div>
        <StatusLine>
          <PlanChips />
          <span className="examples-sep" aria-hidden="true" />
          <span role="status">
            {ready
              ? `${flights.length} saved ${flights.length === 1 ? "flight" : "flights"} · ${fmtBytes(bytes + pdfBytes)} used in this browser`
              : "Reading browser storage…"}
          </span>
        </StatusLine>
      </header>

      <div className="layout">
        <Toc sections={SECTIONS} />
        <main id="main" className={ready ? "is-filled" : ""}>
          {ready && activeReady && (
            <>
              <Section
                id="flights"
                no={1}
                title="Saved flights"
                meta={<span>{ready ? `${flights.length} ${flights.length === 1 ? "plan" : "plans"}` : "—"}</span>}
              >
                <p className="small muted" style={{ marginTop: 0 }}>
                  Every plan you open gets its own storage, identified by{" "}
                  <Tip tip="Flight numbers repeat every day and each re-release gets a new OFP number, so the key is flight number + date + route + OFP number. Plans without a flight or OFP number use a fingerprint of the OFP's first page (which includes the release time) instead.">
                    flight number, date, route and OFP number
                  </Tip>
                  . Anything typed into the reader is saved as you type. Select a flight to see what is stored.
                </p>
                <div className="row import-bar">
                  <button type="button" className="btn" disabled={!ready} onClick={() => fileRef.current?.click()}>
                    Import JSON
                  </button>
                  <span className="small muted">
                    Restore files saved with Export JSON, from this or another browser. Entries are merged; the file&apos;s values win.
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    multiple
                    hidden
                    onChange={async (e) => {
                      const files = e.currentTarget.files;
                      if (!files?.length) return;
                      const input = e.currentTarget;
                      const { msgs, lastId } = await importFiles(files);
                      input.value = "";
                      setImportMsgs(msgs);
                      if (lastId) setActive(lastId);
                    }}
                  />
                </div>
                <ul className="import-msgs small" role="status">
                  {importMsgs.map((m, i) => (
                    <li key={i} className={m.ok ? "import-ok" : "status-err"}>
                      {m.ok ? "✓ " : "⚠ "}
                      {m.text}
                    </li>
                  ))}
                </ul>
                {ready && flights.length === 0 ? (
                  <div className="hello" style={{ gridTemplateColumns: "1fr" }}>
                    <div>
                      <h1 style={{ fontSize: 20 }}>No saved flights yet</h1>
                      <p>
                        Open a plan in the <Link href="/">reader</Link> — it will appear here, along with anything you fill in.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <caption className="sr-only">Saved flight plans</caption>
                      <thead>
                        <tr>
                          <th scope="col">Flight</th>
                          <th scope="col" className="num">
                            <Tip tip="Operational Flight Plan number — each re-release of the same flight gets a new number and its own storage">OFP</Tip>
                          </th>
                          <th scope="col">Date</th>
                          <th scope="col">Route</th>
                          <th scope="col">Aircraft</th>
                          <th scope="col" className="num">
                            Entries
                          </th>
                          <th scope="col">
                            <Tip tip="A copy of the PDF kept in this browser, so the plan reopens without downloading it again">PDF</Tip>
                          </th>
                          <th scope="col">Last updated</th>
                          <th scope="col">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ready ? flights : Array.from({ length: 3 }, () => null)).map((r, i) => {
                          if (!r)
                            return (
                              <tr key={i}>
                                {Array.from({ length: 9 }, (_, c) => (
                                  <td key={c}>
                                    <V v={null} w={c === 0 ? 8 : 4} />
                                  </td>
                                ))}
                              </tr>
                            );
                          const m = r.meta;
                          const on = sel?.meta.id === m.id;
                          const href = readerHref(r);
                          return (
                            <tr key={m.id} className={cx(on && "active")}>
                              <th scope="row">
                                <button type="button" className="linkish" aria-pressed={on} onClick={() => setActive(m.id)}>
                                  {m.flightNo ?? m.id}
                                </button>{" "}
                                {on && (
                                  <Badge tone="mag" tip="The flight every page shows. Choose another row, or use the flight menu on any page, to switch.">
                                    Active
                                  </Badge>
                                )}
                                {m.keyBasis === "fallback" && (
                                  <Badge tone="amber" tip="This plan had no flight or OFP number, so it is identified by a fingerprint of its first page.">
                                    fingerprint
                                  </Badge>
                                )}
                              </th>
                              <td className="num">
                                <V v={m.ofpNo} w={1} />
                              </td>
                              <td>
                                <V v={m.date} w={9} />
                              </td>
                              <td>
                                <V v={m.dep && m.arr ? `${m.dep} → ${m.arr}` : null} w={11} />
                              </td>
                              <td>
                                <V v={[m.acType, m.reg].filter(Boolean).join(" · ") || null} w={10} />
                              </td>
                              <td className="num">{count(r) ? <Badge tone="blue">{count(r)}</Badge> : <span className="muted">0</span>}</td>
                              <td className="small">
                                {m.pdfSize ? <Badge tone="green">Saved · {fmtBytes(m.pdfSize)}</Badge> : <span className="muted">—</span>}
                              </td>
                              <td className="small">{when(m.updatedAt)}</td>
                              <td>
                                <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                                  <button
                                    type="button"
                                    className="toggle"
                                    aria-pressed={on}
                                    onClick={() => setActive(m.id)}
                                    aria-label={`Make ${m.flightNo ?? m.id} the active flight`}
                                  >
                                    {on ? "Active" : "Select"}
                                  </button>
                                  {href && (
                                    <Link className="toggle" href={href} aria-label={`Open ${m.flightNo ?? m.id} in the reader`}>
                                      Open
                                    </Link>
                                  )}
                                  <button
                                    type="button"
                                    className="toggle danger"
                                    onClick={() => {
                                      if (confirm(`Delete ${m.flightNo ?? m.id} (OFP ${m.ofpNo ?? "?"}) and its ${count(r)} saved entries?`))
                                        removeFlight(m.id);
                                    }}
                                    aria-label={`Delete ${m.flightNo ?? m.id}`}
                                  >
                                    Delete
                                  </button>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section
                id="stored"
                no={2}
                title="Stored data"
                meta={<span>{sel ? `${sel.meta.flightNo ?? sel.meta.id} · OFP ${sel.meta.ofpNo ?? "—"}` : "—"}</span>}
              >
                <div className="fields">
                  <Field label="Storage key" tip="The identifier this plan's data is saved under" style={{ gridColumn: "span 2" }}>
                    <span style={{ wordBreak: "break-all" }}>
                      <V v={sel?.meta.id} w={24} />
                    </span>
                  </Field>
                  <Field label="Flight">
                    <V v={sel?.meta.flightNo} w={7} />
                  </Field>
                  <Field label="OFP">
                    <V v={sel?.meta.ofpNo} w={2} />
                  </Field>
                  <Field label="Date" sub={sel?.meta.date ? fmtDate(sel.meta.date) : null}>
                    <V v={sel?.meta.date} w={9} />
                  </Field>
                  <Field label="Route">
                    <V v={sel?.meta.dep && sel.meta.arr ? `${sel.meta.dep} → ${sel.meta.arr}` : null} w={11} />
                  </Field>
                  <Field label="Aircraft">
                    <V v={sel ? [sel.meta.acType, sel.meta.reg].filter(Boolean).join(" · ") : null} w={10} />
                  </Field>
                  <Field label="Release">
                    <V v={sel?.meta.release} w={12} />
                  </Field>
                  <Field label="Saved PDF" tip="Reopening this plan uses this copy instead of downloading it again">
                    <V v={sel ? (sel.meta.pdfSize ? fmtBytes(sel.meta.pdfSize) : "none") : null} w={6} />
                  </Field>
                  <Field label="First opened">
                    <V v={sel ? when(sel.meta.firstSeen) : null} w={14} />
                  </Field>
                  <Field label="Last updated">
                    <V v={sel ? when(sel.meta.updatedAt) : null} w={14} />
                  </Field>
                  <Field
                    label="Source"
                    tip="Plans opened from a link can be reopened directly; a saved PDF copy opens without downloading anything"
                    style={{ gridColumn: "1 / -1" }}
                  >
                    <span style={{ wordBreak: "break-all", fontSize: 13 }}>
                      <V v={sel ? (sel.meta.sourceUrl ?? `${sel.meta.source} (uploaded)`) : null} w={20} />
                    </span>
                  </Field>
                </div>

                {sel && (
                  <div className="row" style={{ marginTop: 12 }}>
                    {readerHref(sel) ? (
                      <Link className="btn btn-primary" href={readerHref(sel)!}>
                        Open in reader
                      </Link>
                    ) : (
                      <Link className="btn" href="/">
                        Upload {sel.meta.source} to continue
                      </Link>
                    )}
                    <button type="button" className="btn" onClick={() => exportFlight(sel)}>
                      Export JSON
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={!count(sel)}
                      onClick={() =>
                        confirm(`Clear the ${count(sel)} saved entries for ${sel.meta.flightNo ?? sel.meta.id}? The flight stays in the list.`) &&
                        clearFields(sel.meta.id)
                      }
                    >
                      Clear entries
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => confirm(`Delete ${sel.meta.flightNo ?? sel.meta.id} and all its saved entries?`) && removeFlight(sel.meta.id)}
                    >
                      Delete flight
                    </button>
                    {groups.length > 0 && (
                      <button
                        type="button"
                        className={cx("btn", "lock-toggle", unlocked && "btn-danger is-open")}
                        aria-pressed={unlocked}
                        onClick={() => setUnlocked(!unlocked)}
                        title={unlocked ? "Lock: hide the delete buttons" : "Unlock to delete single saved entries"}
                      >
                        <LockIcon open={unlocked} />
                        {unlocked ? "Lock" : "Unlock to delete"}
                      </button>
                    )}
                  </div>
                )}

                <Sub>Saved entries</Sub>
                {!sel ? (
                  <V v={null} w={40} />
                ) : groups.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>
                    Nothing filled in for this flight yet. Values you type in the reader (actual times, fuel, ATIS, clearance, nav-log ATO/AFOB…) appear here.
                  </p>
                ) : (
                  <div className="cols" style={{ ["--min" as string]: "320px" }}>
                    {groups.map((g) => (
                      <div className="tbl-wrap" key={g.section}>
                        <table className={cx("tbl", "entries-tbl", unlocked && "unlocked")}>
                          <caption>
                            {g.section} · {g.items.length}
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">Field</th>
                              <th scope="col">Value</th>
                              <th scope="col" className="del-col">
                                <span className="sr-only">Delete</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.items.map((it) => (
                              <tr key={it.key}>
                                <th scope="row" style={{ fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: 13.5, letterSpacing: 0 }}>
                                  {it.label}
                                </th>
                                <td style={{ whiteSpace: "pre-wrap", color: "var(--blue)" }}>{it.value}</td>
                                <td className="del-col">
                                  {unlocked ? (
                                    <button
                                      type="button"
                                      className="row-del"
                                      aria-label={`Delete ${it.label}`}
                                      title={`Delete ${it.label}`}
                                      onClick={() => writeField(sel.meta.id, it.key, null)}
                                    >
                                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                                        <path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13M10.5 11v5.5M13.5 11v5.5" />
                                      </svg>
                                    </button>
                                  ) : (
                                    <span className="del-slot">
                                      <LockIcon open={false} dim />
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section id="appearance" no={3} title="Appearance">
                <fieldset className="radios">
                  <legend className="field-label">Theme</legend>
                  {(
                    [
                      ["system", "Match system", "Follows your device's light / dark setting"],
                      ["light", "Day", "Chart-paper light theme"],
                      ["dark", "Night", "Low-glare dark theme for the flight deck"],
                    ] as const
                  ).map(([v, label, desc]) => (
                    <label key={v} className={cx("radio", theme === v && "on")}>
                      <input type="radio" name="theme" value={v} checked={ready && theme === v} onChange={() => applyTheme(v)} />
                      <span>
                        <b>{label}</b>
                        <span className="small muted">{desc}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <fieldset className="radios" style={{ marginTop: 18 }}>
                  <legend className="field-label">Flight summary graphic</legend>
                  {STRIP_MODES.map((m) => (
                    <label key={m.value} className={cx("radio", ready && stripMode === m.value && "on")}>
                      <input type="radio" name="strip" value={m.value} checked={ready && stripMode === m.value} onChange={() => setStripMode(m.value)} />
                      <span>
                        <b className="radio-title">
                          {m.label}
                          {m.value === DEFAULT_STRIP && <span className="badge b-ink">Default</span>}
                        </b>
                        <span className="small muted">{m.desc}</span>
                        <StripIcon mode={m.value} />
                      </span>
                    </label>
                  ))}
                </fieldset>
                <fieldset className="radios" style={{ marginTop: 18 }}>
                  <legend className="field-label">Route map</legend>
                  {MAP_STYLES.map((m) => (
                    <label key={m.value} className={cx("radio", ready && mapStyle === m.value && "on")}>
                      <input type="radio" name="map-style" value={m.value} checked={ready && mapStyle === m.value} onChange={() => setMapStyle(m.value)} />
                      <span>
                        <b className="radio-title">
                          {m.label}
                          {m.value === DEFAULT_MAP && <span className="badge b-ink">Default</span>}
                        </b>
                        <span className="small muted">{m.desc}</span>
                        <MapIcon style={m.value} />
                      </span>
                    </label>
                  ))}
                </fieldset>
                <fieldset className="radios" style={{ marginTop: 18 }}>
                  <legend className="field-label">FIR / UIR on the route map</legend>
                  {FIR_MODES.map((m) => (
                    <label key={m.value} className={cx("radio", ready && firMode === m.value && "on")}>
                      <input type="radio" name="map-fir" value={m.value} checked={ready && firMode === m.value} onChange={() => setFirMode(m.value)} />
                      <span>
                        <b className="radio-title">
                          {m.label}
                          {m.value === DEFAULT_FIR && <span className="badge b-ink">Default</span>}
                        </b>
                        <span className="small muted">{m.desc}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              </Section>

              <Section id="storage" no={4} title="Storage & privacy" meta={<span>{ready ? fmtBytes(bytes + pdfBytes) : "—"}</span>}>
                <ul className="small" style={{ margin: "0 0 12px", paddingLeft: 18, lineHeight: 1.7 }}>
                  <li>Everything is kept in this browser&apos;s local storage only — nothing is uploaded, and other devices or browsers won&apos;t see it.</li>
                  <li>Clearing site data or using a private window removes it. Use Export JSON above to keep a copy.</li>
                  <li>
                    Each plan&apos;s PDF is kept (in IndexedDB) so it reopens without downloading it again. If a plan was re-issued under the same link, use
                    &ldquo;Re-download from SimBrief&rdquo; in the reader.
                  </li>
                </ul>
                <div className="fields">
                  <Field label="Saved flights">
                    <V v={ready ? String(flights.length) : null} w={2} />
                  </Field>
                  <Field label="Saved entries">
                    <V v={ready ? String(flights.reduce((s, f) => s + count(f), 0)) : null} w={3} />
                  </Field>
                  <Field label="Saved PDFs" sub={ready ? `${flights.filter((f) => f.meta.pdfSize).length} files` : null}>
                    <V v={ready ? fmtBytes(pdfBytes) : null} w={6} />
                  </Field>
                  <Field label="Entries & flight list">
                    <V v={ready ? fmtBytes(bytes) : null} w={6} />
                  </Field>
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={!flights.length}
                    onClick={() =>
                      confirm(`Delete all ${flights.length} saved flights and their entries? This cannot be undone.`) && (clearAll(), void clearPdfs())
                    }
                  >
                    Delete all saved data
                  </button>
                </div>
              </Section>
            </>
          )}
        </main>
      </div>
      <TooltipLayer />
    </CollapseProvider>
  );
}
