"use client";

/*
 * MANUAL (/manual): how to use the site, section by section and phase by phase. The content
 * lives in components/manual/*; this is the page shell and the search.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Brand, SettingsLink, ThemeToggle, Toc } from "./chrome";
import { CollapseAllButton, CollapseProvider, useCollapse } from "./collapse";
import { TooltipLayer } from "./TooltipLayer";
import { FindSection, OpenSection, StartSection } from "./manual/Start";
import { WorkflowsSection } from "./manual/Workflows";
import {
  AddlManual,
  ChartsManual,
  FplManual,
  FuelManual,
  LogManual,
  NotamManual,
  RouteManual,
  SummaryManual,
  TimesManual,
  TlrManual,
  WindsManual,
  WxManual,
} from "./manual/Reader";
import { LabManual, RadioPageManual, SettingsManual, WeatherPageManual } from "./manual/Pages";
import { ColoursManual, DataManual, GlossaryManual, KeysManual, TroubleManual } from "./manual/Reference";

const SECTIONS = [
  ["m-start", "Start here"],
  ["m-open", "Opening a plan"],
  ["m-find", "Find it fast"],
  ["m-flows", "Workflows"],
  ["m-summary", "Flight summary"],
  ["m-fuel", "Planned fuel"],
  ["m-route", "Alternate & routing"],
  ["m-times", "Times & weights"],
  ["m-log", "Flight log"],
  ["m-winds", "Wind information"],
  ["m-fpl", "ATC flight plan"],
  ["m-addl", "Additional info"],
  ["m-tlr", "Runway analysis"],
  ["m-wx", "Airport weather"],
  ["m-notam", "NOTAM"],
  ["m-charts", "Charts & source"],
  ["m-weather", "Weather page"],
  ["m-radio", "Radio page"],
  ["m-settings", "Settings"],
  ["m-lab", "Wind lab"],
  ["m-data", "Saved data"],
  ["m-keys", "Keys & gestures"],
  ["m-colours", "Colours"],
  ["m-trouble", "Troubleshooting"],
  ["m-glossary", "Glossary"],
] as const;

const GROUPS = [
  ["Getting started", ["m-start", "m-open", "m-find"]],
  ["Workflows", ["m-flows"]],
  ["The reader", ["m-summary", "m-fuel", "m-route", "m-times", "m-log", "m-winds", "m-fpl", "m-addl", "m-tlr", "m-wx", "m-notam", "m-charts"]],
  ["Other pages", ["m-weather", "m-radio", "m-settings", "m-lab"]],
  ["Reference", ["m-data", "m-keys", "m-colours", "m-trouble", "m-glossary"]],
] as const;

type Entry = { id: string; title: string; section: string; sectionId: string; text: string };

/**
 * Stops lines breaking inside hyphenated words ("take-|off", "V-|speeds") and number ranges
 * ("118.000–|136.990"): hyphens between letters become non-breaking hyphens and range dashes get
 * word joiners. The manual is static, so this runs once on mount; links and OFP excerpts are left alone.
 */
function keepWordsTogether(root: HTMLElement | null) {
  if (!root) return;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n.textContent ?? "";
    if (!/[-–]/.test(t) || t.includes("://") || n.parentElement?.closest("pre, input, textarea")) continue;
    const v = t.replace(/(?<=\p{L}|\d)-(?=\p{L}|\d)/gu, "\u2011").replace(/(?<=\d)–(?=\d)/g, "\u2060–\u2060");
    if (v !== t) n.textContent = v;
  }
}

/** The readable text of a topic: text nodes joined with spaces (so table cells and terms don't run together), without the # link. */
function textOf(el: HTMLElement): string {
  const out: string[] = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (!n.parentElement?.closest(".man-anchor, [hidden]:not(.sheet-body)")) out.push(n.textContent ?? "");
  return out
    .join(" ")
    .replace(/\u2011/g, "-")
    .replace(/\u2060/g, "")
    .replace(/\s+/g, " ")
    .replace(/ ([.,;:)’'])/g, "$1")
    .replace(/\( /g, "(")
    .trim();
}

/** Every topic on the page (and each glossary term), read from the rendered manual. */
function readIndex(): Entry[] {
  return [...document.querySelectorAll<HTMLElement>("#main [data-topic]")].map((el) => {
    const sec = el.closest("section");
    return {
      id: el.id,
      title: el.dataset.topic ?? "",
      section: sec?.querySelector(".sheet-title")?.textContent ?? "",
      sectionId: sec?.id ?? "",
      text: textOf(el),
    };
  });
}

/** Topics matching every word of the query; title matches first. */
function search(index: Entry[], q: string): Entry[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return index
    .map((e) => {
      const t = e.title.toLowerCase();
      const body = e.text.toLowerCase();
      if (!words.every((w) => t.includes(w) || body.includes(w))) return null;
      const score = words.reduce((s, w) => s + (t === w ? 6 : t.startsWith(w) ? 4 : t.includes(w) ? 3 : 0) + (body.includes(w) ? 1 : 0), 0);
      return { e, score };
    })
    .filter((x): x is { e: Entry; score: number } => !!x)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.e);
}

/** A short excerpt around the first match, with the matches marked. */
function snippet(text: string, q: string): ReactNode {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  const at = Math.max(0, Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0)));
  const from = Math.max(0, at - 60);
  const part = (from ? "…" : "") + text.slice(from, from + 180) + (from + 180 < text.length ? "…" : "");
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return part.split(re).map((s, i) => (i % 2 ? <mark key={i}>{s}</mark> : s));
}

function Results({ q, index, onPick }: { q: string; index: Entry[]; onPick: (e: Entry) => void }) {
  const hits = useMemo(() => search(index, q), [index, q]);
  return (
    <div className="man-results" role="region" aria-label="Search results">
      <p className="man-results-k">
        {hits.length ? `${hits.length} ${hits.length === 1 ? "match" : "matches"} for “${q}”` : `Nothing matches “${q}”. Try another word, or an OFP code.`}
      </p>
      {hits.length > 0 && (
        <ul>
          {hits.slice(0, 12).map((e) => (
            <li key={e.id}>
              <a
                href={`#${e.id}`}
                onClick={(ev) => {
                  ev.preventDefault();
                  onPick(e);
                }}
              >
                <span className="man-results-where">{e.section}</span>
                <b>{e.title}</b>
                <span className="man-results-text">{snippet(e.text, q)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {hits.length > 12 && <p className="small muted">Showing the best 12. Add a word to narrow it down.</p>}
    </div>
  );
}

function ManualBody() {
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<Entry[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const { open } = useCollapse();

  useEffect(() => {
    // The manual is static, so read it once after the first paint.
    keepWordsTogether(document.getElementById("main"));
    const raf = requestAnimationFrame(() => setIndex(readIndex()));
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // A link to a topic inside a folded section opens the section first.
  useEffect(() => {
    const go = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      const sec = el?.closest("section");
      if (!el || !sec) return;
      open(sec.id);
      requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [open]);

  const pick = (e: Entry) => {
    if (window.location.hash === `#${e.id}`) {
      open(e.sectionId);
      requestAnimationFrame(() => document.getElementById(e.id)?.scrollIntoView({ block: "start" }));
    } else window.location.hash = e.id;
  };
  const query = q.trim();

  return (
    <>
      <a href="#main" className="skip">
        Skip to manual
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand sub="· Manual" />
          <form className="loader man-search" role="search" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="man-q" className="sr-only">
              Search the manual
            </label>
            <input
              id="man-q"
              ref={input}
              type="search"
              placeholder="Search the manual: fuel, RETO, NOTAM, frequency…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQ("")}
              autoComplete="off"
              spellCheck={false}
            />
          </form>
          <CollapseAllButton ids={SECTIONS.map(([id]) => id)} className="btn status-all" />
          <SettingsLink />
          <ThemeToggle />
        </div>
        <div className="status" role="status" aria-live="polite">
          <span className="muted">
            {query ? (
              "Select a result to go to it. Esc clears the search."
            ) : (
              <>
                How to use OFP Reader: what each section shows, where it is on the OFP, and what to do at each phase of flight. Press{" "}
                <kbd className="man-kbd">/</kbd> to search.
              </>
            )}
          </span>
        </div>
      </header>
      <div className="layout">
        <Toc sections={SECTIONS} groups={GROUPS} />
        <main id="main" className="is-filled man">
          {query.length >= 2 && <Results q={query} index={index} onPick={pick} />}
          <StartSection no={1} />
          <OpenSection no={2} />
          <FindSection no={3} />
          <WorkflowsSection no={4} />
          <SummaryManual no={5} />
          <FuelManual no={6} />
          <RouteManual no={7} />
          <TimesManual no={8} />
          <LogManual no={9} />
          <WindsManual no={10} />
          <FplManual no={11} />
          <AddlManual no={12} />
          <TlrManual no={13} />
          <WxManual no={14} />
          <NotamManual no={15} />
          <ChartsManual no={16} />
          <WeatherPageManual no={17} />
          <RadioPageManual no={18} />
          <SettingsManual no={19} />
          <LabManual no={20} />
          <DataManual no={21} />
          <KeysManual no={22} />
          <ColoursManual no={23} />
          <TroubleManual no={24} />
          <GlossaryManual no={25} />
        </main>
      </div>
      <TooltipLayer />
    </>
  );
}

export function ManualApp() {
  return (
    <CollapseProvider>
      <ManualBody />
    </CollapseProvider>
  );
}
