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

/** "← Blank plan": closes the plan, so no flight is active on any page. */
export function BlankChip({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="chip-btn chip-blank" onClick={onClick} aria-label="Close this plan and go back to the blank form">
      <span aria-hidden="true">←</span> Blank plan
    </button>
  );
}

/**
 * How every page picks its plan, at the start of the status line: the "Blank plan" chip
 * (while a flight is active) and the flight menu chip.
 *
 * `onBlank` / `onNew` let the reader also clear its view or focus its paste box; elsewhere
 * Blank just clears the active flight and "Open another plan…" goes to the reader.
 */
export function PlanChips({ onBlank, onNew }: { onBlank?: () => void; onNew?: () => void }) {
  const { id } = useActiveFlight();
  return (
    <span className="examples plan-chips">
      {id && <BlankChip onClick={onBlank ?? (() => setActive(null))} />}
      <FlightMenu onNew={onNew} />
    </span>
  );
}

/** The flight menu chip: picking a flight makes it the active flight on every page. */
export function FlightMenu({ onNew }: { onNew?: () => void }) {
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion);
  const flights = useMemo(() => (version >= 0 ? listFlights() : []), [version]);
  const { id } = useActiveFlight();
  const router = useRouter();

  return (
    <select
      className="flight-menu"
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
}
