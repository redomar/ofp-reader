"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { OFP } from "@/lib/ofp/types";
import { fetchPdf, readOfp, type Progress } from "@/lib/ofp/pdf";
import { OfpContext } from "./context";
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

const EXAMPLES = [
  "https://www.simbrief.com/ofp/flightplans/LFSBLEBL_PDF_1790544580.4961f06b.pdf",
  "https://www.simbrief.com/ofp/flightplans/EKCHLFSB_PDF_1790528775.06b00640.pdf",
  "https://www.simbrief.com/ofp/flightplans/EDDBEKCH_PDF_1790516669.325d777a.pdf",
];

type Status = { kind: "idle" } | { kind: "busy"; progress: Progress; label: string } | { kind: "error"; message: string } | { kind: "ready"; label: string };

function progressPct(p: Progress) {
  if (p.stage === "fetch") return 8;
  if (p.stage === "read") return 10 + ((p.page ?? 0) / (p.total ?? 1)) * 80;
  if (p.stage === "parse") return 95;
  return 100;
}

function progressText(p: Progress) {
  if (p.stage === "fetch") return "Downloading PDF…";
  if (p.stage === "read") return `Reading page ${p.page} of ${p.total}…`;
  if (p.stage === "parse") return "Decoding OFP…";
  return "Done";
}

export function OfpApp() {
  const [ofp, setOfp] = useState<OFP | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [active, setActive] = useState<string>("summary");
  const fileRef = useRef<HTMLInputElement>(null);
  const loadId = useRef(0);

  const load = useCallback(async (getData: (p: (x: Progress) => void) => Promise<ArrayBuffer>, label: string) => {
    const id = ++loadId.current;
    const onProgress = (progress: Progress) => {
      if (id === loadId.current) setStatus({ kind: "busy", progress, label });
    };
    onProgress({ stage: "fetch" });
    try {
      const data = await getData(onProgress);
      const res = await readOfp(data, label, onProgress);
      if (id !== loadId.current) return;
      setDoc((old) => {
        void old?.loadingTask.destroy();
        return res.doc;
      });
      setOfp(res.ofp);
      setStatus({ kind: "ready", label });
    } catch (e) {
      if (id !== loadId.current) return;
      setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const loadUrl = useCallback(
    (u: string) => {
      if (!u.trim()) return;
      setUrl(u);
      const q = new URL(window.location.href);
      q.searchParams.set("ofp", u.trim());
      window.history.replaceState(null, "", q);
      void load((p) => fetchPdf(u, p), u.split("/").pop() ?? u);
    },
    [load],
  );

  const loadFile = useCallback(
    (f: File) => {
      if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) {
        setStatus({ kind: "error", message: `${f.name} is not a PDF.` });
        return;
      }
      const q = new URL(window.location.href);
      q.searchParams.delete("ofp");
      window.history.replaceState(null, "", q);
      void load(() => f.arrayBuffer(), f.name);
    },
    [load],
  );

  // Deep link: ?ofp=<url>
  useEffect(() => {
    const u = new URL(window.location.href).searchParams.get("ofp");
    // Deferred so the initial render commits before loading starts.
    if (u) queueMicrotask(() => loadUrl(u));
  }, [loadUrl]);

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

  // Scroll-spy for the table of contents
  useEffect(() => {
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-130px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const toggleTheme = () => {
    const el = document.documentElement;
    const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const current = el.dataset.theme ?? (sysDark ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    el.dataset.theme = next;
    try {
      localStorage.setItem("ofp-theme", next);
    } catch {}
  };

  const onSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    loadUrl(url);
  };

  const ctx = useMemo(() => ({ ofp, doc }), [ofp, doc]);
  const busy = status.kind === "busy";
  const h = ofp?.header;

  return (
    <OfpContext.Provider value={ctx}>
      <a href="#main" className="skip">
        Skip to flight plan
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
              <circle cx="13" cy="13" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M13 4 L15 13 L13 22 L11 13 Z" fill="currentColor" />
              <circle cx="13" cy="13" r="2" fill="var(--sheet)" stroke="currentColor" />
            </svg>
            <span>
              OFP Reader <small>{h?.flightNo ? `· ${h.flightNo} ${h.dep}–${h.arr}` : "· SimBrief"}</small>
            </span>
          </div>
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
          <button
            className="btn btn-icon"
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle day / night theme"
            title="Toggle day / night"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1v14" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 1a7 7 0 0 1 0 14z" fill="currentColor" />
            </svg>
          </button>
        </div>
        <div className="status" role="status" aria-live="polite">
          {status.kind === "idle" && (
            <div className="examples">
              <span>Try:</span>
              {EXAMPLES.map((u) => (
                <button key={u} type="button" className="chip-btn" onClick={() => loadUrl(u)}>
                  {u.split("/").pop()!.slice(0, 8).replace(/(....)(....)/, "$1→$2")}
                </button>
              ))}
              <span className="muted">or drop a PDF anywhere</span>
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
          {status.kind === "error" && <span className="status-err">⚠ {status.message}</span>}
          {status.kind === "ready" && ofp && (
            <span>
              Loaded <span className="mono">{status.label}</span> · {ofp.pageCount} pages · parsed locally, nothing uploaded
            </span>
          )}
        </div>
      </header>

      <div className="layout">
        <nav className="toc" aria-label="Sections">
          <p className="toc-title">Contents</p>
          <ol>
            {SECTIONS.map(([id, label], i) => (
              <li key={id}>
                <a href={`#${id}`} aria-current={active === id ? "true" : undefined}>
                  <span className="n">{String(i + 1).padStart(2, "0")}</span>
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
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
    </OfpContext.Provider>
  );
}
