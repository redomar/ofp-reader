"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Which graphic the flight-summary strip draws between departure and arrival. */
export type StripMode = "profile" | "profile-times" | "route" | "timeline" | "arc";

export const STRIP_MODES: { value: StripMode; label: string; desc: string }[] = [
  { value: "profile", label: "Vertical profile", desc: "Climb, cruise and descent to scale, with TOC/TOD and step climbs" },
  { value: "profile-times", label: "Profile + times", desc: "The profile with clock times under OFF, TOC, TOD and ON" },
  { value: "route", label: "Route silhouette", desc: "The real track, turned to run departure → arrival" },
  { value: "timeline", label: "Progress timeline", desc: "Gate to gate on a clock: taxi, climb, cruise, descent" },
  { value: "arc", label: "Classic arc", desc: "The original decorative arc" },
];

/** Default for first-time visitors. */
export const DEFAULT_STRIP: StripMode = "profile";

const KEY = "ofp-reader:strip";
const CHANGE = "ofp-reader:strip-change";
const valid = (v: string | null): v is StripMode => STRIP_MODES.some((m) => m.value === v);

let memory: StripMode | null = null; // used when storage is unavailable

function read(): StripMode {
  if (memory) return memory;
  try {
    const v = window.localStorage.getItem(KEY);
    return valid(v) ? v : DEFAULT_STRIP;
  } catch {
    return DEFAULT_STRIP;
  }
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE, cb);
  };
}

/** [mode, setMode]; the server render uses the default. */
export function useStripMode(): [StripMode, (m: StripMode) => void] {
  const mode = useSyncExternalStore(subscribe, read, () => DEFAULT_STRIP);
  const set = useCallback((m: StripMode) => {
    try {
      window.localStorage.setItem(KEY, m);
      memory = null;
    } catch {
      memory = m; // not persisted; applies until reload
    }
    window.dispatchEvent(new Event(CHANGE));
  }, []);
  return [mode, set];
}
