"use client";

import { useCallback, useSyncExternalStore } from "react";

/** How the route map draws the ground under the route. */
export type MapStyle = "contours" | "plain" | "relief";

export const MAP_STYLES: { value: MapStyle; label: string; desc: string }[] = [
  { value: "contours", label: "Contours", desc: "Parchment land and blue sea, with coastlines and country borders drawn" },
  { value: "plain", label: "No contours", desc: "No coast or border lines; neighbouring countries in different parchment tones" },
  // stored as "relief" (its earlier name), so a saved choice carries over
  {
    value: "relief",
    label: "Elevation",
    desc: "Contours plus height bands on land and depth bands at sea, with a key (only the area around the route is downloaded)",
  },
];

/** Default for first-time visitors. */
export const DEFAULT_MAP: MapStyle = "contours";

/** How FIR / UIR stretches show on the route map. */
export type FirMode = "marks" | "line" | "off";

export const FIR_MODES: { value: FirMode; label: string; desc: string }[] = [
  {
    value: "marks",
    label: "Lines with boundaries",
    desc: "Dashed line beside the route, named, with a mark across both lines where one FIR ends and the next begins",
  },
  { value: "line", label: "Lines only", desc: "Dashed line beside the route, named, with a circle where the route crosses in" },
  { value: "off", label: "Hidden", desc: "No FIR / UIR lines, circles or names on the map" },
];

export const DEFAULT_FIR: FirMode = "marks";

/** A preference kept in localStorage, shared by every page and tab. */
function pref<T extends string>(key: string, values: readonly { value: T }[], fallback: T) {
  const change = `${key}-change`;
  const valid = (v: string | null): v is T => values.some((m) => m.value === v);
  let memory: T | null = null; // used when storage is unavailable
  const read = (): T => {
    if (memory) return memory;
    try {
      const v = window.localStorage.getItem(key);
      return valid(v) ? v : fallback;
    } catch {
      return fallback;
    }
  };
  const subscribe = (cb: () => void) => {
    const onStorage = (e: StorageEvent) => e.key === key && cb();
    window.addEventListener("storage", onStorage);
    window.addEventListener(change, cb);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(change, cb);
    };
  };
  const set = (m: T) => {
    try {
      window.localStorage.setItem(key, m);
      memory = null;
    } catch {
      memory = m; // not persisted; applies until reload
    }
    window.dispatchEvent(new Event(change));
  };
  /** [value, setValue]; the server render uses the default. */
  return function usePref(): [T, (m: T) => void] {
    const v = useSyncExternalStore(subscribe, read, () => fallback);
    return [v, useCallback(set, [])];
  };
}

export const useMapStyle = pref<MapStyle>("ofp-reader:map-style", MAP_STYLES, DEFAULT_MAP);
export const useFirMode = pref<FirMode>("ofp-reader:map-fir", FIR_MODES, DEFAULT_FIR);
