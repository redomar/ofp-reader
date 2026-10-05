"use client";

import { useCallback, useSyncExternalStore } from "react";

/** How the route map draws the ground under the route. */
export type MapStyle = "contours" | "plain" | "relief";

export const MAP_STYLES: { value: MapStyle; label: string; desc: string }[] = [
  { value: "contours", label: "Contours", desc: "Parchment land and blue sea, with coastlines and country borders drawn" },
  { value: "plain", label: "No contours", desc: "No coast or border lines; neighbouring countries in different parchment tones" },
  { value: "relief", label: "Height map", desc: "Contours plus shaded relief, so mountains and high ground show (downloads about 1 MB the first time)" },
];

/** Default for first-time visitors. */
export const DEFAULT_MAP: MapStyle = "contours";

const KEY = "ofp-reader:map-style";
const CHANGE = "ofp-reader:map-style-change";
const valid = (v: string | null): v is MapStyle => MAP_STYLES.some((m) => m.value === v);

let memory: MapStyle | null = null; // used when storage is unavailable

function read(): MapStyle {
  if (memory) return memory;
  try {
    const v = window.localStorage.getItem(KEY);
    return valid(v) ? v : DEFAULT_MAP;
  } catch {
    return DEFAULT_MAP;
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
export function useMapStyle(): [MapStyle, (m: MapStyle) => void] {
  const mode = useSyncExternalStore(subscribe, read, () => DEFAULT_MAP);
  const set = useCallback((m: MapStyle) => {
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
