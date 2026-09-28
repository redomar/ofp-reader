"use client";

import { useOfp } from "../context";
import { Section, V, cx } from "../ui";
import { pageOf } from "@/lib/ofp/format";

/** Standard meteorological wind barb; the staff points to where the wind comes from. */
export function WindBarb({ dir, spd, size = 26 }: { dir: number; spd: number; size?: number }) {
  let rest = Math.round(spd / 5) * 5;
  const parts: string[] = [];
  let y = -11;
  while (rest >= 50) {
    parts.push(`M0 ${y} L7 ${y + 2} L0 ${y + 4} Z`);
    y += 5;
    rest -= 50;
  }
  while (rest >= 10) {
    parts.push(`M0 ${y} L7 ${y - 3}`);
    y += 3;
    rest -= 10;
  }
  if (rest >= 5) parts.push(`M0 ${y + (parts.length ? 0 : 2)} L4 ${y - 1.5 + (parts.length ? 0 : 2)}`);
  return (
    <svg width={size} height={size} viewBox="-13 -13 26 26" aria-hidden="true" style={{ flex: "none" }}>
      {spd < 3 ? (
        <circle r="4" fill="none" stroke="var(--ink-2)" strokeWidth="1.5" />
      ) : (
        <g transform={`rotate(${dir})`} stroke="var(--blue)" strokeWidth="1.6" fill="var(--blue)" strokeLinecap="round">
          <line x1="0" y1="0" x2="0" y2="-11" />
          {parts.map((d, i) => (
            <path key={i} d={d} fill={d.endsWith("Z") ? "var(--blue)" : "none"} />
          ))}
          <circle r="1.8" stroke="none" />
        </g>
      )}
    </svg>
  );
}

export function WindsSection({ no }: { no: number }) {
  const { ofp } = useOfp();
  const stations = ofp?.winds.length ? ofp.winds : Array.from({ length: 8 }, (_, i) => ({ name: "", levels: [], i }));
  const cruiseAt = (name: string) => {
    const p = ofp?.log.find((l) => (l.ident ?? l.position?.replace(/\s/g, "")) === name.replace(/\s/g, "") || l.position === name);
    return p?.fl ? Number(p.fl) : null;
  };
  const strongest = ofp?.winds.flatMap((s) => s.levels.map((l) => ({ ...l, name: s.name }))).sort((a, b) => b.spd - a.spd)[0];
  const coldest = ofp?.winds.flatMap((s) => s.levels.map((l) => ({ ...l, name: s.name }))).sort((a, b) => a.temp - b.temp)[0];

  return (
    <Section id="winds" no={no} title="Wind information" meta={<span>PDF p.{pageOf(ofp?.pages, /WIND INFORMATION/) ?? 7}</span>}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Forecast wind and temperature at five levels around each point. Rows highlighted in magenta are the planned level at that point.{" "}
        {strongest && (
          <>
            Strongest: <b className="mono">{strongest.dir}/{strongest.spd}</b> at FL{Number(strongest.fl)} over {strongest.name}. Coldest:{" "}
            <b className="mono">{coldest!.temp}°C</b> at FL{Number(coldest!.fl)}.
          </>
        )}
      </p>
      <div className="windgrid">
        {stations.map((s, k) => {
          const cfl = s.name ? cruiseAt(s.name) : null;
          const nearest = cfl != null && s.levels.length ? s.levels.reduce((a, b) => (Math.abs(Number(b.fl) - cfl) < Math.abs(Number(a.fl) - cfl) ? b : a)).fl : null;
          return (
            <div className="windcard" key={s.name + k}>
              <h4>
                <span>{s.name ? s.name : <V v={null} w={6} />}</span>
                {cfl != null && <span className="mono small muted">FL{cfl}</span>}
                {/CLIMB|DESCENT/.test(s.name) && <span className="mono small muted">{s.name === "CLIMB" ? "↗" : "↘"}</span>}
              </h4>
              <ul aria-label={s.name ? `Winds at ${s.name}` : "Winds, not loaded"}>
                {(s.levels.length ? s.levels : Array.from({ length: 5 }, () => null)).map((l, i) =>
                  l ? (
                    <li key={i} className={cx(nearest === l.fl && "cruise")}>
                      <span>{Number(l.fl)}</span>
                      <span data-tip={`Wind from ${l.dir}° true at ${l.spd} kt, ${l.temp}°C`} data-tip-title={`FL${Number(l.fl)}`}>
                        <WindBarb dir={l.dir} spd={l.spd} size={24} />
                      </span>
                      <span className="v">
                        {String(l.dir).padStart(3, "0")}/{String(l.spd).padStart(3, "0")}
                      </span>
                      <span className="v" style={{ textAlign: "right", color: l.temp < -50 ? "var(--blue)" : undefined }}>
                        {l.temp > 0 ? "+" : ""}
                        {l.temp}
                      </span>
                    </li>
                  ) : (
                    <li key={i}>
                      <V v={null} w={3} />
                      <span />
                      <V v={null} w={7} />
                      <V v={null} w={3} />
                    </li>
                  ),
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
