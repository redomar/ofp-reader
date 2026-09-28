"use client";

/**
 * Per-flight browser storage for everything the pilot types into the form.
 *
 * One record per flight plan, keyed by flight number + date + route + OFP number
 * (see `flightKey`). Plans missing a flight or OFP number fall back to a hash of
 * the OFP's first page. All access is wrapped: storage can be unavailable
 * (private mode, blocked site data) and the app must keep working without it.
 */

import type { OFP } from "@/lib/ofp/types";

const NS = "ofp-reader:";
const INDEX = `${NS}flights`;
const recKey = (id: string) => `${NS}flight:${id}`;
const CHANGE = "ofp-reader:change";

export interface FlightMeta {
  id: string;
  keyBasis: "flight" | "fallback";
  flightNo: string | null;
  ofpNo: string | null;
  date: string | null;
  dep: string | null;
  arr: string | null;
  reg: string | null;
  acType: string | null;
  release: string | null;
  source: string;
  sourceUrl: string | null;
  /** Bytes of the PDF copy kept in IndexedDB (see pdfCache), or null when none. */
  pdfSize?: number | null;
  firstSeen: string;
  updatedAt: string;
}

export interface FieldEntry {
  section: string;
  label: string;
  value: string;
  order: number;
}

export interface FlightRecord {
  meta: FlightMeta;
  fields: Record<string, FieldEntry>;
}

/* ---------- key ---------- */

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Flight numbers repeat daily and OFPs are renumbered per release, so the key is
 * flight + date + route + OFP number. Without a flight or OFP number, a hash of
 * the plan's first page (which includes the release stamp) identifies it.
 */
export function flightKey(ofp: OFP): { id: string; basis: FlightMeta["keyBasis"] } {
  const h = ofp.header;
  if (h.flightNo && h.ofpNo) {
    const parts = [h.flightNo, h.date ?? "NODATE", `${h.dep ?? "XXXX"}${h.arr ?? "XXXX"}`, `OFP${h.ofpNo}`];
    return { id: parts.join("_"), basis: "flight" };
  }
  const page1 = ofp.pages[0]?.lines.join("\n") ?? ofp.source;
  return { id: `PLAN_${fnv1a(page1)}`, basis: "fallback" };
}

/* ---------- safe storage ---------- */

function get(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function del(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

let version = 0;
export function notifyChange() {
  changed();
}
function changed() {
  version++;
  try {
    window.dispatchEvent(new Event(CHANGE));
  } catch {
    /* ignore */
  }
}

/* ---------- subscription (useSyncExternalStore) ---------- */

export function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(NS)) {
      version++;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE, cb);
  };
}
export const getVersion = () => version;
export const getServerVersion = () => -1;

/* ---------- reads ---------- */

export function listIds(): string[] {
  try {
    const v = JSON.parse(get(INDEX) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function readFlight(id: string): FlightRecord | null {
  try {
    const raw = get(recKey(id));
    if (!raw) return null;
    const r = JSON.parse(raw) as FlightRecord;
    return r && r.meta && r.fields ? r : null;
  } catch {
    return null;
  }
}

export function listFlights(): FlightRecord[] {
  return listIds()
    .map(readFlight)
    .filter((r): r is FlightRecord => !!r)
    .sort((a, b) => b.meta.updatedAt.localeCompare(a.meta.updatedAt));
}

export function storageBytes(): number {
  let n = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(NS)) n += (k.length + (window.localStorage.getItem(k)?.length ?? 0)) * 2;
    }
  } catch {
    /* ignore */
  }
  return n;
}

/* ---------- writes ---------- */

function writeRecord(r: FlightRecord) {
  if (!set(recKey(r.meta.id), JSON.stringify(r))) return false;
  const ids = listIds();
  if (!ids.includes(r.meta.id)) set(INDEX, JSON.stringify([...ids, r.meta.id]));
  changed();
  return true;
}

/** Registers a freshly opened plan (keeps existing fields); returns its saved record. */
export function openFlight(ofp: OFP, sourceUrl: string | null): FlightRecord {
  const { id, basis } = flightKey(ofp);
  const h = ofp.header;
  const now = new Date().toISOString();
  const prev = readFlight(id);
  const meta: FlightMeta = {
    id,
    keyBasis: basis,
    flightNo: h.flightNo,
    ofpNo: h.ofpNo,
    date: h.date,
    dep: h.dep,
    arr: h.arr,
    reg: h.reg,
    acType: h.acType,
    release: h.releaseTime ? `${h.releaseTime}Z ${h.releaseDate ?? ""}`.trim() : null,
    source: ofp.source,
    sourceUrl: sourceUrl ?? prev?.meta.sourceUrl ?? null,
    pdfSize: prev?.meta.pdfSize ?? null,
    firstSeen: prev?.meta.firstSeen ?? now,
    updatedAt: prev?.meta.updatedAt ?? now,
  };
  const rec: FlightRecord = { meta, fields: prev?.fields ?? {} };
  writeRecord(rec);
  return rec;
}

/** Sets (or clears, when value is empty) one form field for a flight. */
export function writeField(id: string, key: string, entry: Omit<FieldEntry, "order"> | null): boolean {
  const rec = readFlight(id);
  if (!rec) return false;
  if (!entry || entry.value === "") delete rec.fields[key];
  else rec.fields[key] = { ...entry, order: rec.fields[key]?.order ?? Date.now() };
  rec.meta.updatedAt = new Date().toISOString();
  return writeRecord(rec);
}

export function setPdfSize(id: string, size: number | null) {
  const rec = readFlight(id);
  if (!rec) return;
  rec.meta.pdfSize = size;
  writeRecord(rec);
}

const normUrl = (u: string) => u.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();

/** The saved flight previously opened from this link, if any. */
export function findByUrl(url: string): FlightRecord | null {
  const n = normUrl(url);
  return listFlights().find((f) => f.meta.sourceUrl && normUrl(f.meta.sourceUrl) === n) ?? null;
}

/** Deletes the record; callers also remove the cached PDF (pdfCache.deletePdf). */
export function deleteFlight(id: string) {
  del(recKey(id));
  set(INDEX, JSON.stringify(listIds().filter((x) => x !== id)));
  changed();
}

export function clearFields(id: string) {
  const rec = readFlight(id);
  if (!rec) return;
  rec.fields = {};
  rec.meta.updatedAt = new Date().toISOString();
  writeRecord(rec);
}

export function clearAll() {
  for (const id of listIds()) del(recKey(id));
  del(INDEX);
  changed();
}

/* ---------- theme preference (shared with the inline boot script) ---------- */

export const THEME_KEY = "ofp-theme";
export type ThemePref = "system" | "light" | "dark";

export function readTheme(): ThemePref {
  const t = get(THEME_KEY);
  return t === "light" || t === "dark" ? t : "system";
}

export function applyTheme(pref: ThemePref) {
  const el = document.documentElement;
  if (pref === "system") {
    delete el.dataset.theme;
    del(THEME_KEY);
  } else {
    el.dataset.theme = pref;
    set(THEME_KEY, pref);
  }
  changed();
}
