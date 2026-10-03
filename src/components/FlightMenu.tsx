"use client";

import { useRouter } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import { setActive, useActiveFlight } from "@/lib/active";
import { getServerVersion, getVersion, listFlights, subscribe, type FlightRecord } from "@/lib/storage";

const NEW = "__new__";

const label = (f: FlightRecord) => {
  const m = f.meta;
  const where = m.dep && m.arr ? `${m.dep}→${m.arr}` : m.source;
  // the OFP number tells re-releases of the same flight apart
  return `${m.flightNo ?? "Plan"} · ${where}${m.date ? ` · ${m.date}` : ""}${m.ofpNo ? ` · OFP ${m.ofpNo}` : ""}${m.pdfSize ? "" : " · PDF needed"}`;
};

/**
 * The shared flight menu: picking a flight makes it the active flight on every page.
 * "Open another plan…" goes to the reader's blank form to paste or upload one.
 *
 * `slot` sizes it for the top bar's middle slot (Weather, Radio, Settings); without it it's
 * the compact version in the reader's status line.
 */
export function FlightMenu({ slot, onNew }: { slot?: boolean; onNew?: () => void }) {
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion);
  const flights = useMemo(() => (version >= 0 ? listFlights() : []), [version]);
  const { id } = useActiveFlight();
  const router = useRouter();

  const select = (
    <select
      id={slot ? "flight-menu" : undefined}
      className={slot ? undefined : "flight-menu"}
      value={id ?? ""}
      aria-label="Active flight"
      disabled={version < 0}
      onChange={(e) => {
        const v = e.target.value;
        if (v === NEW) {
          setActive(null);
          if (onNew) onNew();
          else router.push("/");
        } else setActive(v || null);
      }}
    >
      {!id && <option value="">{flights.length ? "No flight selected" : "No saved flights yet"}</option>}
      {flights.map((f) => (
        <option key={f.meta.id} value={f.meta.id}>
          {label(f)}
        </option>
      ))}
      <option value={NEW}>＋ Open another plan…</option>
    </select>
  );
  if (!slot) return select;
  return (
    <div className="loader">
      <label htmlFor="flight-menu" className="sr-only">
        Active flight
      </label>
      {select}
    </div>
  );
}
