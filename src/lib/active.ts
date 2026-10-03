"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getServerVersion, getVersion, listFlights, notifyChange, readFlight, subscribe, type FlightRecord } from "./storage";

/**
 * The active flight: the saved flight every page shows (reader, Weather, Radio, Settings).
 *
 * Stored in localStorage under `ofp-reader:active`, so it's per browser, survives reloads and
 * reaches other open tabs through the `storage` event (the key shares the storage namespace,
 * so the existing `subscribe` already picks it up).
 *
 * - never set: falls back to the most recently updated saved flight
 * - set to a flight that no longer exists (deleted): same fallback
 * - cleared on purpose ("Blank plan"): stored as an empty string, meaning "no flight"
 */
const KEY = "ofp-reader:active";

export function getActiveId(): string | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    /* storage unavailable: fall back below */
  }
  if (raw === "") return null;
  if (raw && readFlight(raw)) return raw;
  return listFlights()[0]?.meta.id ?? null;
}

/** Makes `id` the active flight everywhere; `null` clears it (the reader's "Blank plan"). */
export function setActive(id: string | null) {
  try {
    if (window.localStorage.getItem(KEY) === (id ?? "")) return;
    window.localStorage.setItem(KEY, id ?? "");
  } catch {
    return;
  }
  notifyChange();
}

/**
 * The active flight for rendering. `ready` is false on the server and the first client render
 * (storage isn't read yet), so pages show a neutral state there and avoid a hydration mismatch.
 */
export function useActiveFlight(): { id: string | null; record: FlightRecord | null; ready: boolean } {
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion);
  return useMemo(() => {
    if (version < 0) return { id: null, record: null, ready: false };
    const id = getActiveId();
    return { id, record: id ? readFlight(id) : null, ready: true };
  }, [version]);
}

/** Mirrors the active flight into `?flight=` so a reload or bookmark keeps it. */
export function mirrorFlightParam(id: string | null) {
  const u = new URL(window.location.href);
  if ((u.searchParams.get("flight") ?? null) === id) return;
  if (id) u.searchParams.set("flight", id);
  else u.searchParams.delete("flight");
  window.history.replaceState(window.history.state, "", u);
}

/** On arrival, a `?flight=<id>` link wins and becomes the active flight. */
export function adoptFlightParam() {
  const id = new URLSearchParams(window.location.search).get("flight");
  if (id && readFlight(id)) setActive(id);
}
