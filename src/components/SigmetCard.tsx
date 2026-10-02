"use client";

import { Badge, cx } from "./ui";
import { setHighlightedSigmet, useHighlightedSigmet, type SigmetOnRoute } from "./useSigmets";
import { SIGMET_TOKENS, fmtDdhhmm, nowStatus, type Impact } from "@/lib/wx/sigmet";

const flOf = (ft: number) => (ft <= 0 ? "ground" : ft < 10000 ? `${Math.round(ft).toLocaleString("en-GB")} ft` : `FL${String(Math.round(ft / 100)).padStart(3, "0")}`);
const plus = (m: number) => `+${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
const dur = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);

/** One sentence on what the SIGMET means for this flight. */
function verdictText(i: Impact, levels: string | null, offLabel: string | null) {
  if (i.verdict === "off-route") return "Doesn't touch your route.";
  if (i.verdict === "unknown" || !i.from || !i.to) return "Its area can't be placed against the route, so check it against your track.";
  const where = `Your route is inside it ${i.from.name === i.to.name ? `near ${i.from.name}` : `from ${i.from.name} to ${i.to.name}`} (${plus(i.from.t)}–${plus(i.to.t)} after take-off${offLabel ? ` at ${offLabel}` : ""}, ${flOf(i.altMin)}${i.altMax !== i.altMin ? `–${flOf(i.altMax)}` : ""})`;
  if (i.verdict === "clear-level") return `${where}, but you pass ${i.vertical} its levels (${levels}).`;
  if (i.verdict === "clear-time") return `${where}, but ${i.timing === "after" ? `it ends ${dur(i.gapMin!)} before you get there` : `it starts ${dur(i.gapMin!)} after you've passed`}.`;
  return `${where}, within its levels${i.timing === "during" ? " and while it's valid" : ""}.`;
}

const VERDICT: Record<Impact["verdict"], { tone: "red" | "amber" | "green" | "ink"; label: string }> = {
  affects: { tone: "red", label: "On your route" },
  "clear-level": { tone: "amber", label: "Route crosses it · clear of its levels" },
  "clear-time": { tone: "amber", label: "Route crosses it · outside its time" },
  "off-route": { tone: "green", label: "Off your route" },
  unknown: { tone: "ink", label: "Check against route" },
};

function Raw({ text }: { text: string }) {
  return (
    <span>
      {text.split(" ").map((t, i) => {
        const coord = /^[NS]\d{2,4}$|^[EW]\d{3,5}$/.test(t);
        const tip = SIGMET_TOKENS[t] ?? (coord ? `${t[0] === "N" || t[0] === "S" ? "Latitude" : "Longitude"} ${t.slice(1, t[0] === "N" || t[0] === "S" ? 3 : 4)}°${t.length > (t[0] === "N" || t[0] === "S" ? 3 : 4) ? ` ${t.slice(t[0] === "N" || t[0] === "S" ? 3 : 4)}′` : ""} ${t[0]}` : /^FL\d{2,3}$/.test(t) ? `Flight level ${Number(t.slice(2))}` : /^\d{6}\/\d{6}$/.test(t) ? "Valid from / to, ddhhmm UTC" : null);
        return (
          <span key={i}>
            {tip ? (
              <span className="tok" data-k={coord ? "wind" : /^FL/.test(t) ? "temp" : "change"} data-tip={tip} data-tip-title={t}>
                {t}
              </span>
            ) : (
              <span className="tok">{t}</span>
            )}{" "}
          </span>
        );
      })}
    </span>
  );
}

export function SigmetCard({ item, offLabel }: { item: SigmetOnRoute; offLabel: string | null }) {
  const { s, impact } = item;
  const hl = useHighlightedSigmet();
  const st = nowStatus(s);
  const v = VERDICT[impact.verdict];
  const sev = s.phenomenon?.severity === "sev" || s.kind === "SIGMET";
  const showOnMap = () => {
    setHighlightedSigmet(s.id);
    document.querySelector('svg[aria-label^="Route map"]')?.closest(".cols")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return (
    <article
      className={cx("sig-card", sev ? "sev" : "mod", hl === s.id && "hl")}
      onPointerEnter={() => setHighlightedSigmet(s.id)}
      onPointerLeave={() => setHighlightedSigmet(null)}
      aria-label={`${s.kind} ${s.seq ?? ""} ${s.firName ?? ""}`}
    >
      <header className="sig-head">
        <Badge tone={sev ? "red" : "amber"} tip={SIGMET_TOKENS[s.kind]}>
          {s.kind} {s.seq}
        </Badge>
        <b className="mono">{s.fir}</b>
        <span className="small muted">{s.firName}</span>
        <span className="small mono" style={{ marginLeft: "auto" }}>
          {fmtDdhhmm(s.validFrom)} → {fmtDdhhmm(s.validTo)}
        </span>
        {st && (
          <Badge tone={st === "active" ? "red" : st === "upcoming" ? "amber" : "ink"} tip="Relative to the time now">
            {st === "active" ? "active now" : st}
          </Badge>
        )}
      </header>
      {s.cancels ? (
        <p className="sig-what">Cancels {s.kind} {s.cancels}.</p>
      ) : (
        <>
          <p className="sig-what">
            {s.phenomenon?.text ?? "Hazard"}
            {s.phenomenon && <span className="code">{s.phenomenon.code}</span>}
          </p>
          <dl className="sig-facts">
            <div>
              <dt>Levels</dt>
              <dd>{s.levels?.text ?? "—"}</dd>
            </div>
            <div>
              <dt>{s.obs === "OBS" ? "Observed" : s.obs === "FCST" ? "Forecast" : "Type"}</dt>
              <dd>{s.obsAt ? `at ${s.obsAt.slice(0, 2)}:${s.obsAt.slice(2)}Z` : s.obs ? "for the validity period" : "—"}</dd>
            </div>
            <div>
              <dt>Movement</dt>
              <dd>{s.movement === "STNR" ? "Stationary" : s.movement ? `${s.movement.dir} at ${s.movement.spd} ${s.movement.unit === "KT" ? "kt" : "km/h"}` : s.endArea ? `to forecast position at ${s.endAt?.slice(0, 2)}:${s.endAt?.slice(2)}Z` : "—"}</dd>
            </div>
            <div>
              <dt>Trend</dt>
              <dd>{s.change === "INTSF" ? "↑ Intensifying" : s.change === "WKN" ? "↓ Weakening" : s.change === "NC" ? "No change" : "—"}</dd>
            </div>
            <div>
              <dt>Area</dt>
              <dd>{s.area.kind === "polygon" ? `${s.area.points.length - (s.area.points.length > 3 ? 1 : 0)}-point area` : s.area.kind === "bounds" ? "Part of the FIR (by latitude / longitude)" : s.area.kind === "fir" ? "Entire FIR" : "—"}</dd>
            </div>
          </dl>
          <div className={cx("sig-verdict", `v-${v.tone}`)}>
            <Badge tone={v.tone}>{v.label}</Badge>
            <span>{verdictText(impact, s.levels?.text ?? null, offLabel)}</span>
            {(s.area.kind === "polygon" || s.area.kind === "bounds") && (
              <button type="button" className="toggle" onClick={showOnMap}>
                Show on map
              </button>
            )}
          </div>
        </>
      )}
      <details className="wxc-raw">
        <summary>Raw {s.kind}</summary>
        <Raw text={s.raw} />
      </details>
    </article>
  );
}
