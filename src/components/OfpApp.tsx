"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { OFP } from "@/lib/ofp/types";
import { fetchPdf, readOfp, type Progress } from "@/lib/ofp/pdf";
import Link from "next/link";
import { FormContext, OfpContext, type FormApi } from "./context";
import { Brand, SettingsLink, ThemeToggle, Toc } from "./chrome";
import { CollapseAllButton, CollapseProvider } from "./collapse";
import {
  findByUrl,
  getServerVersion,
  getVersion,
  listFlights,
  openFlight,
  readFlight,
  setPdfSize,
  subscribe,
  writeField,
  type FieldEntry,
} from "@/lib/storage";
import { getPdf, putPdf } from "@/lib/pdfCache";
import { TooltipLayer } from "./TooltipLayer";
import { SummarySection } from "./sections/Summary";
import { FuelSection } from "./sections/Fuel";
import { RouteSection } from "./sections/Route";
import { TimesWeightsSection } from "./sections/TimesWeights";
import { FlightLogSection } from "./sections/FlightLog";
import { WindsSection } from "./sections/Winds";
import { FplSection } from "./sections/Fpl";
import { AdditionalSection } from "./sections/Additional";
import { TlrSection } from "./sections/Tlr";
import { WxSection } from "./sections/Wx";
import { NotamSection } from "./sections/Notams";
import { ChartsSection } from "./sections/Charts";
import { SourceSection } from "./sections/Source";

const SECTIONS = [
  ["summary", "Flight summary"],
  ["fuel", "Planned fuel"],
  ["route", "Alternate & routing"],
  ["times", "Times & weights"],
  ["log", "Flight log"],
  ["winds", "Wind information"],
  ["fpl", "ATC flight plan"],
  ["addl", "Additional info"],
  ["tlr", "Runway analysis"],
  ["wx", "Airport weather"],
  ["notam", "NOTAM"],
  ["company", "Company NOTAM"],
  ["charts", "Charts"],
  ["source", "Source text"],
] as const;

/**
 * Sample SimBrief OFP links once shown as "Try" chips in the status row.
 *
 * @deprecated No longer rendered. SimBrief only keeps generated OFP PDFs for a
 * limited time, after which these links return 404 (seen as a CORS failure in the
 * browser), so built-in samples go stale. Plans a user has opened are kept in their
 * browser and offered as "Recent" chips instead. Kept for reference; re-enable only
 * with links that don't expire (e.g. a self-hosted sample PDF).
 */
const EXAMPLES = [
  "https://www.simbrief.com/ofp/flightplans/LFSBLEBL_PDF_1790544580.4961f06b.pdf",
  "https://www.simbrief.com/ofp/flightplans/EKCHLFSB_PDF_1790528775.06b00640.pdf",
  "https://www.simbrief.com/ofp/flightplans/EDDBEKCH_PDF_1790516669.325d777a.pdf",
];

/**
 * "Try:" chips that open the sample OFPs in {@link EXAMPLES}.
 *
 * @deprecated Not rendered: the sample links have expired on SimBrief. See {@link EXAMPLES}.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- deprecated, kept for reference
function ExampleChips({ onPick }: { onPick: (url: string) => void }) {
  return (
    <>
      <span>Try:</span>
      {EXAMPLES.map((u) => (
        <button key={u} type="button" className="chip-btn" onClick={() => onPick(u)}>
          {u.split("/").pop()!.slice(0, 8).replace(/(....)(....)/, "$1→$2")}
        </button>
      ))}
    </>
  );
}

type Status =
  | { kind: "idle" }
  | { kind: "busy"; progress: Progress; label: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; label: string; saving: boolean; origin: Origin; sourceUrl: string | null };

/** Where the PDF bytes came from: SimBrief, the browser's saved copy, or a local file. */
type Origin = "network" | "saved" | "upload";
type Source = { data: ArrayBuffer; origin: Origin };

function BlankChip({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="chip-btn chip-blank" onClick={onClick} aria-label="Close this plan and go back to the blank form">
      <span aria-hidden="true">←</span> Blank plan
    </button>
  );
}

/*
 * Scroll restoration is manual: Chrome restores by re-pinning the element that was at
 * the top of the viewport, but on reload the blank-form banner briefly sits above the
 * summary (until the saved plan reopens), so it pinned ~160px too low. We save the
 * position per URL for this tab and restore it once the plan has loaded.
 */
const SCROLL_KEY = "ofp-reader:scroll";
const here = () => window.location.pathname + window.location.search;

function saveScroll() {
  try {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ url: here(), y: Math.round(window.scrollY) }));
  } catch {
    /* ignore */
  }
}

function restoreScroll() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (id) {
    document.getElementById(id)?.scrollIntoView();
    return;
  }
  let y = 0;
  try {
    const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? "null");
    if (saved?.url === here() && typeof saved.y === "number") y = saved.y;
  } catch {
    /* ignore */
  }
  window.scrollTo(0, y);
}

/** Keeps the address bar reloadable: ?ofp=<link> or ?flight=<saved id>. */
function setParam(key: "ofp" | "flight", value: string) {
  const q = new URL(window.location.href);
  q.searchParams.delete("ofp");
  q.searchParams.delete("flight");
  q.searchParams.set(key, value);
  window.history.replaceState(null, "", q);
}

function progressPct(p: Progress) {
  if (p.stage === "cache") return 4;
  if (p.stage === "fetch") return 8;
  if (p.stage === "read") return 10 + ((p.page ?? 0) / (p.total ?? 1)) * 80;
  if (p.stage === "parse") return 95;
  return 100;
}

function progressText(p: Progress) {
  if (p.stage === "cache") return "Opening saved copy…";
  if (p.stage === "fetch") return "Downloading PDF…";
  if (p.stage === "read") return `Reading page ${p.page} of ${p.total}…`;
  if (p.stage === "parse") return "Decoding OFP…";
  return "Done";
}

export function OfpApp() {
  const [ofp, setOfp] = useState<OFP | null>(null);
  const [flightId, setFlightId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, FieldEntry>>({});
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const loadId = useRef(0);
  const restorePending = useRef(false);

  const load = useCallback(async (getData: (p: (x: Progress) => void) => Promise<Source>, label: string, sourceUrl: string | null) => {
    const id = ++loadId.current;
    const onProgress = (progress: Progress) => {
      if (id === loadId.current) setStatus({ kind: "busy", progress, label });
    };
    onProgress({ stage: "cache" });
    try {
      const { data, origin } = await getData(onProgress);
      // pdf.js takes ownership of (detaches) the buffer it reads, so keep a copy to save.
      const copy = origin === "saved" ? null : data.slice(0);
      const res = await readOfp(data, label, onProgress);
      if (id !== loadId.current) return;
      setDoc((old) => {
        void old?.loadingTask.destroy();
        return res.doc;
      });
      const rec = openFlight(res.ofp, sourceUrl);
      if (copy) {
        const fid = rec.meta.id;
        void putPdf(fid, copy).then((ok) => ok && setPdfSize(fid, copy.byteLength));
      }
      // Uploads have no link; point the address bar at the saved copy so a reload reopens it.
      if (!sourceUrl) setParam("flight", rec.meta.id);
      setFlightId(rec.meta.id);
      setFields(rec.fields);
      setOfp(res.ofp);
      setStatus({ kind: "ready", label, saving: true, origin, sourceUrl: rec.meta.sourceUrl });
      // A deep-linked/reloaded plan: restore the scroll position once it has rendered.
      if (restorePending.current) {
        restorePending.current = false;
        requestAnimationFrame(() => requestAnimationFrame(restoreScroll));
      }
    } catch (e) {
      if (id !== loadId.current) return;
      setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  /** Opens a link, reusing the saved PDF when this link was opened before (unless `refresh`). */
  const loadUrl = useCallback(
    (u: string, refresh = false) => {
      if (!u.trim()) return;
      setUrl(u);
      setParam("ofp", u.trim());
      const saved = refresh ? null : findByUrl(u);
      void load(
        async (p) => {
          if (saved) {
            const data = await getPdf(saved.meta.id);
            if (data) return { data, origin: "saved" };
          }
          return { data: await fetchPdf(u, p), origin: "network" };
        },
        u.split("/").pop() ?? u,
        u.trim(),
      );
    },
    [load],
  );

  /** Opens a saved flight by its storage id (from Settings), falling back to its link. */
  const loadSaved = useCallback(
    (fid: string) => {
      const rec = readFlight(fid);
      if (!rec) {
        setStatus({ kind: "error", message: "That saved flight no longer exists — it may have been deleted in Settings." });
        return;
      }
      setParam("flight", fid);
      if (rec.meta.sourceUrl) setUrl(rec.meta.sourceUrl);
      void load(
        async (p) => {
          const data = await getPdf(fid);
          if (data) return { data, origin: "saved" };
          if (rec.meta.sourceUrl) return { data: await fetchPdf(rec.meta.sourceUrl, p), origin: "network" };
          throw new Error(`No saved copy of ${rec.meta.source} in this browser. Upload the PDF again — your entries will reload.`);
        },
        rec.meta.source,
        rec.meta.sourceUrl,
      );
    },
    [load],
  );

  /** Back to the blank form: drops the loaded plan (saved data stays in storage). */
  const reset = useCallback(() => {
    loadId.current++; // cancels any load still in flight
    setDoc((old) => {
      void old?.loadingTask.destroy();
      return null;
    });
    setOfp(null);
    setFlightId(null);
    setFields({});
    setUrl("");
    setStatus({ kind: "idle" });
    window.history.replaceState(null, "", window.location.pathname);
    window.scrollTo({ top: 0 });
  }, []);

  const loadFile = useCallback(
    (f: File) => {
      if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) {
        setStatus({ kind: "error", message: `${f.name} is not a PDF.` });
        return;
      }
      void load(async () => ({ data: await f.arrayBuffer(), origin: "upload" }), f.name, null);
    },
    [load],
  );

  // Deep link: ?ofp=<url>
  const deepLinked = useRef(false);
  useEffect(() => {
    // Run once: dev-mode Strict Mode re-runs effects, which would download twice.
    if (deepLinked.current) return;
    deepLinked.current = true;
    const params = new URL(window.location.href).searchParams;
    const u = params.get("ofp");
    const fid = params.get("flight");
    // Deferred so the initial render commits before loading starts.
    if (u) queueMicrotask(() => loadUrl(u));
    else if (fid) queueMicrotask(() => loadSaved(fid));
    else requestAnimationFrame(restoreScroll); // blank page: nothing to wait for
    restorePending.current = Boolean(u || fid);
  }, [loadUrl, loadSaved]);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.addEventListener("pagehide", saveScroll);
    return () => window.removeEventListener("pagehide", saveScroll);
  }, []);

  // Drag & drop anywhere
  useEffect(() => {
    let depth = 0;
    const has = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!has(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (has(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!has(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) loadFile(f);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [loadFile]);

  const onSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    loadUrl(url);
  };

  const ctx = useMemo(() => ({ ofp, doc }), [ofp, doc]);

  // Recently opened plans for the idle status row (storage is client-only, hence the store hook).
  const storeVersion = useSyncExternalStore(subscribe, getVersion, getServerVersion);
  const recent = useMemo(() => (storeVersion >= 0 ? listFlights().slice(0, 3) : []), [storeVersion]);

  const setField = useCallback<FormApi["set"]>(
    (key, section, label, value) => {
      setFields((prev) => {
        const next = { ...prev };
        if (value === "") delete next[key];
        else next[key] = { section, label, value, order: prev[key]?.order ?? Date.now() };
        return next;
      });
      if (flightId) {
        const ok = writeField(flightId, key, value === "" ? null : { section, label, value });
        setStatus((s) => (s.kind === "ready" && s.saving !== ok ? { ...s, saving: ok } : s));
      }
    },
    [flightId],
  );
  const form = useMemo<FormApi>(() => ({ values: fields, set: setField }), [fields, setField]);
  const busy = status.kind === "busy";
  const h = ofp?.header;

  return (
    <OfpContext.Provider value={ctx}>
      <FormContext.Provider value={form}>
        <CollapseProvider>
      <a href="#main" className="skip">
        Skip to flight plan
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand sub={h?.flightNo ? `· ${h.flightNo} ${h.dep}–${h.arr}` : "· SimBrief"} />
          <form className="loader" onSubmit={onSubmit} aria-label="Load a flight plan">
            <label htmlFor="ofp-url" className="sr-only">
              SimBrief PDF link
            </label>
            <input
              id="ofp-url"
              type="url"
              inputMode="url"
              placeholder="Paste a SimBrief PDF link…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="btn btn-primary" type="submit" disabled={busy || !url.trim()}>
              Load
            </button>
            <button className="btn" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 11V2M4 6l4-4 4 4M2 11v3h12v-3" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              Upload
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f);
                e.target.value = "";
              }}
            />
          </form>
          <CollapseAllButton ids={SECTIONS.map(([id]) => id)} className="btn status-all" />
          <SettingsLink />
          <ThemeToggle />
        </div>
        <div className="status" role="status" aria-live="polite">
          {status.kind === "idle" && (
            <div className="examples">
              {recent.length > 0 && (
                <>
                  <span>Recent:</span>
                  {recent.map(({ meta: m, fields }) => {
                    const n = Object.keys(fields).length;
                    const where = m.dep && m.arr ? `${m.dep}→${m.arr}` : m.source;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className="chip-btn chip-recent"
                        onClick={() => loadSaved(m.id)}
                        aria-label={`Reopen ${m.flightNo ?? m.source} ${where}${m.ofpNo ? `, OFP ${m.ofpNo}` : ""}${m.date ? `, ${m.date}` : ""}`}
                        data-tip={[m.date, n ? `${n} saved ${n === 1 ? "entry" : "entries"}` : "no entries yet", m.pdfSize ? "opens without downloading" : "downloads again"].filter(Boolean).join(" · ")}
                        data-tip-title={`${m.flightNo ?? "Plan"} · OFP ${m.ofpNo ?? "—"}`}
                      >
                        <b>{m.flightNo ?? "PLAN"}</b> {where}
                        {n > 0 && <span className="chip-count">{n}</span>}
                      </button>
                    );
                  })}
                  <span className="examples-sep" aria-hidden="true" />
                </>
              )}
              <span className="muted">Paste a SimBrief link, upload, or drop a PDF anywhere</span>
            </div>
          )}
          {status.kind === "busy" && (
            <>
              <span>{progressText(status.progress)}</span>
              <div className="status-bar" aria-hidden="true">
                <span style={{ width: `${progressPct(status.progress)}%` }} />
              </div>
            </>
          )}
          {status.kind === "error" && (
            <div className="examples">
              <BlankChip onClick={reset} />
              <span className="status-err">⚠ {status.message}</span>
            </div>
          )}
          {status.kind === "ready" && ofp && (
            <div className="examples">
              <BlankChip onClick={reset} />
              <span className="examples-sep" aria-hidden="true" />
              <span>
                <span className="mono">{status.label}</span> · {ofp.pageCount} pages
              </span>
              {status.origin === "saved" && status.sourceUrl && (
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => loadUrl(status.sourceUrl!, true)}
                  data-tip="Fetch this plan from SimBrief again instead of using the copy saved in this browser — use it if the plan was re-issued."
                  data-tip-title="Re-download"
                >
                  Re-download
                </button>
              )}
              {!status.saving && <span className="status-err">Browser storage unavailable — entries won&apos;t be kept</span>}
            </div>
          )}
        </div>
      </header>

      <div className="layout">
        <Toc
          sections={SECTIONS}
          footer={
            <>
              <Link href="/weather" className="toc-link">
                Weather cards →
              </Link>
              <Link href={`/radio${flightId ? `?flight=${encodeURIComponent(flightId)}` : ""}`} className="toc-link">
                Radio frequencies →
              </Link>
              <Link href="/settings" className="toc-link">
                Settings & saved flights →
              </Link>
              <div className="toc-exp" role="separator" aria-label="Experimental">
                <span>Experimental</span>
              </div>
              <Link href="/wind-lab" className="toc-link">
                Wind lab →
              </Link>
            </>
          }
        />
        <main id="main" className={ofp ? "is-filled" : ""} key={ofp?.source ?? "empty"} aria-busy={busy}>
          {!ofp && (
            <div className="hello">
              <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
                <rect x="8" y="4" width="40" height="48" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M16 16h24M16 24h24M16 32h14" stroke="currentColor" strokeWidth="2" />
              </svg>
              <div>
                <h1>Blank flight plan</h1>
                <p>
                  Paste a SimBrief OFP PDF link or upload the file. It is read and decoded entirely in this browser tab — the form below fills in
                  as the plan is decoded. Hover or focus any underlined label for an explanation.
                </p>
              </div>
            </div>
          )}
          <SummarySection no={1} />
          <FuelSection no={2} />
          <RouteSection no={3} />
          <TimesWeightsSection no={4} />
          <FlightLogSection no={5} />
          <WindsSection no={6} />
          <FplSection no={7} />
          <AdditionalSection no={8} />
          <TlrSection no={9} />
          <WxSection no={10} />
          <NotamSection no={11} id="notam" title="NOTAM" which="notams" />
          <NotamSection no={12} id="company" title="Company NOTAM" which="companyNotams" />
          <ChartsSection no={13} />
          <SourceSection no={14} />
        </main>
      </div>
      {dragging && (
        <div className="drop" aria-hidden="true">
          <div>Drop OFP PDF</div>
        </div>
      )}
      <TooltipLayer />
        </CollapseProvider>
      </FormContext.Provider>
    </OfpContext.Provider>
  );
}
