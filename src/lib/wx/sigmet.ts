/**
 * SIGMET / AIRMET decoding and route impact.
 *
 * Format per ICAO Annex 3 (Part II, App. 6) and the regional SIGMET guides (EUR Doc 014):
 *   <FIR> <name> FIR[/UIR] · SIGMET <n> VALID ddhhmm/ddhhmm <MWO>- · <phenomenon>
 *   · OBS|FCST [AT hhmmZ] · <location> · <levels> · MOV <dir> <spd>KT | STNR · INTSF|WKN|NC
 *   · [FCST AT hhmmZ WI <end position>] =
 * One phenomenon per SIGMET. Location is a polygon (WI …), lines (N OF N4500 …) or the
 * entire FIR. Validity is at most 4 h (6 h for volcanic ash and tropical cyclones).
 */

export type Severity = "sev" | "mod";

export interface Phenomenon {
  code: string;
  text: string;
  severity: Severity;
}

/** A bound on latitude or longitude ("N OF N4500" → lat ≥ 45). */
export interface HalfPlane {
  axis: "lat" | "lon";
  op: "gt" | "lt";
  value: number;
}

export type Area =
  | { kind: "polygon"; points: [number, number][] } // [lat, lon]
  | { kind: "bounds"; planes: HalfPlane[] }
  | { kind: "fir" }
  | { kind: "unknown" };

export interface Levels {
  /** Feet; 0 for SFC or when only a top is given. */
  base: number;
  /** Feet; null when open-ended ("ABV FL300"). */
  top: number | null;
  text: string;
}

export interface Sigmet {
  id: string;
  kind: "SIGMET" | "AIRMET";
  fir: string | null;
  firName: string | null;
  seq: string | null;
  validFrom: { day: number; hour: number; min: number } | null;
  validTo: { day: number; hour: number; min: number } | null;
  phenomenon: Phenomenon | null;
  obs: "OBS" | "FCST" | null;
  obsAt: string | null;
  area: Area;
  levels: Levels | null;
  movement: { dir: string; spd: number; unit: string } | "STNR" | null;
  change: "INTSF" | "WKN" | "NC" | null;
  /** Forecast position at the end of validity (FCST AT hhmmZ WI …), when given. */
  endArea: Area | null;
  endAt: string | null;
  cancels: string | null;
  raw: string;
}

/* ---------- vocabulary ---------- */

const PHENOMENA: [RegExp, string, Severity][] = [
  [/\bOBSC TSGR\b/, "Obscured thunderstorms with hail", "sev"],
  [/\bEMBD TSGR\b/, "Embedded thunderstorms with hail", "sev"],
  [/\bFRQ TSGR\b/, "Frequent thunderstorms with hail", "sev"],
  [/\bSQL TSGR\b/, "Squall line of thunderstorms with hail", "sev"],
  [/\bOBSC TS\b/, "Obscured thunderstorms (hidden in haze or smoke)", "sev"],
  [/\bEMBD TS\b/, "Embedded thunderstorms (hidden inside cloud layers)", "sev"],
  [/\bFRQ TS\b/, "Frequent thunderstorms (little or no separation)", "sev"],
  [/\bSQL TS\b/, "Squall line of thunderstorms", "sev"],
  [/\bSEV TURB\b/, "Severe turbulence", "sev"],
  [/\bSEV ICE \(FZRA\)/, "Severe icing from freezing rain", "sev"],
  [/\bSEV ICE\b/, "Severe icing", "sev"],
  [/\bSEV MTW\b/, "Severe mountain wave", "sev"],
  [/\bHVY DS\b/, "Heavy duststorm", "sev"],
  [/\bHVY SS\b/, "Heavy sandstorm", "sev"],
  [/\bVA ERUPTION\b|\bVA CLD\b|\bVA\b/, "Volcanic ash", "sev"],
  [/\bTC [A-Z]+\b|\bTC\b/, "Tropical cyclone", "sev"],
  [/\bRDOACT CLD\b/, "Radioactive cloud", "sev"],
  // AIRMET (lower levels, moderate)
  [/\bISOL TSGR\b|\bISOL TS\b/, "Isolated thunderstorms", "mod"],
  [/\bOCNL TSGR\b|\bOCNL TS\b/, "Occasional thunderstorms", "mod"],
  [/\bMT OBSC\b/, "Mountains obscured", "mod"],
  [/\bMOD TURB\b/, "Moderate turbulence", "mod"],
  [/\bMOD ICE\b/, "Moderate icing", "mod"],
  [/\bMOD MTW\b/, "Moderate mountain wave", "mod"],
  [/\bSFC VIS\b/, "Low surface visibility", "mod"],
  [/\bSFC WIND\b/, "Strong surface wind", "mod"],
  [/\bBKN CLD\b|\bOVC CLD\b/, "Low cloud", "mod"],
  [/\bISOL CB\b|\bOCNL CB\b|\bFRQ CB\b|\bISOL TCU\b|\bOCNL TCU\b|\bFRQ TCU\b/, "Cumulonimbus / towering cumulus", "mod"],
];

/** Hover help for SIGMET groups. */
export const SIGMET_TOKENS: Record<string, string> = {
  SIGMET: "Significant meteorological information: hazardous en-route weather (ICAO Annex 3)",
  AIRMET: "Weather hazardous to low-level flights, below SIGMET severity",
  VALID: "Validity period, ddhhmm/ddhhmm UTC (at most 4 h, 6 h for volcanic ash / tropical cyclone)",
  OBS: "Observed (and expected to persist)",
  FCST: "Forecast",
  WI: "Within the area joining these points",
  TOP: "Upper limit of the phenomenon",
  ABV: "Above",
  BLW: "Below",
  SFC: "Surface",
  MOV: "Moving (direction and speed)",
  STNR: "Stationary",
  INTSF: "Intensifying",
  WKN: "Weakening",
  NC: "No change in intensity",
  EMBD: "Embedded in cloud layers, so hard to see",
  OBSC: "Obscured by haze or smoke",
  FRQ: "Frequent: little or no separation between storms",
  SQL: "Squall line",
  SEV: "Severe",
  MOD: "Moderate",
  TURB: "Turbulence",
  ICE: "Icing",
  MTW: "Mountain wave",
  CNL: "Cancels an earlier SIGMET",
  ENTIRE: "Covers the entire FIR",
  "FIR/UIR": "Flight information region / upper information region",
};

/* ---------- parsing ---------- */

/** N4118 → 41.3, W00038 → -0.633, N41 → 41, E012 → 12. */
export function coord(s: string): number | null {
  const m = s.match(/^([NSEW])(\d{2,3})(\d{2})?$/);
  if (!m) return null;
  const isLat = m[1] === "N" || m[1] === "S";
  const deg = Number(m[2]);
  if ((isLat && m[2].length !== 2) || (!isLat && m[2].length !== 3)) return null;
  const v = deg + (m[3] ? Number(m[3]) / 60 : 0);
  return m[1] === "S" || m[1] === "W" ? -v : v;
}

const fl = (s: string) => {
  const m = s.match(/^FL(\d{2,3})$/);
  if (m) return Number(m[1]) * 100;
  const f = s.match(/^(\d{3,5})(FT|M)$/);
  if (f) return f[2] === "M" ? Math.round(Number(f[1]) * 3.281) : Number(f[1]);
  return s === "SFC" ? 0 : null;
};

function parseArea(text: string): Area {
  if (/\bENTIRE (FIR|UIR|CTA)\b/.test(text)) return { kind: "fir" };
  const wi = text.match(/\bWI ((?:[NS]\d{2,4} [EW]\d{3,5}\s*-?\s*)+)/);
  if (wi) {
    const pts = [...wi[1].matchAll(/([NS]\d{2,4}) ([EW]\d{3,5})/g)].map((m) => [coord(m[1])!, coord(m[2])!] as [number, number]);
    if (pts.length >= 3) return { kind: "polygon", points: pts };
  }
  const planes: HalfPlane[] = [];
  for (const m of text.matchAll(/\b([NSEW]) OF ([NSEW]\d{2,5})\b/g)) {
    const v = coord(m[2]);
    if (v == null) continue;
    planes.push({ axis: m[1] === "N" || m[1] === "S" ? "lat" : "lon", op: m[1] === "N" || m[1] === "E" ? "gt" : "lt", value: v });
  }
  return planes.length ? { kind: "bounds", planes } : { kind: "unknown" };
}

function parseLevels(text: string): Levels | null {
  let m: RegExpMatchArray | null;
  if ((m = text.match(/\bTOP (ABV |BLW )?(FL\d{2,3})\b/)))
    return { base: 0, top: fl(m[2])!, text: `top ${m[1] ? `${m[1].trim().toLowerCase() === "abv" ? "above" : "below"} ` : ""}${m[2]}` };
  if ((m = text.match(/\b(SFC|FL\d{2,3}|\d{3,5}(?:FT|M))\/(FL)?(\d{2,3}|\d{3,5}(?:FT|M))\b/))) {
    const base = fl(m[1]) ?? 0;
    const top = m[2] ? Number(m[3]) * 100 : /FT|M$/.test(m[3]) ? fl(m[3]) : Number(m[3]) * 100;
    return { base, top, text: `${m[1] === "SFC" ? "surface" : m[1]} to ${m[2] ? `FL${m[3]}` : /FT|M$/.test(m[3]) ? m[3] : `FL${m[3]}`}` };
  }
  if ((m = text.match(/\bABV (FL\d{2,3})\b/))) return { base: fl(m[1])!, top: null, text: `above ${m[1]}` };
  if ((m = text.match(/\b(FL\d{2,3})\b(?!\/)/)) && !/\bTOP\b/.test(text)) return { base: fl(m[1])!, top: fl(m[1])!, text: `at ${m[1]}` };
  return null;
}

const dt = (s?: string) => (s && /^\d{6}$/.test(s) ? { day: Number(s.slice(0, 2)), hour: Number(s.slice(2, 4)), min: Number(s.slice(4)) } : null);

export function parseSigmet(chunk: string, idx: number): Sigmet | null {
  const raw = chunk.replace(/\s+/g, " ").trim();
  const head = raw.match(/\b(SIGMET|AIRMET)\s+(\S+)\s+VALID\s+(\d{6})\/(\d{6})(?:\s+([A-Z]{4})\s*-)?/);
  if (!head) return null;
  const firM = raw.match(/\b([A-Z]{4})\s+([A-Z][A-Z .'-]*?)\s+(FIR\/UIR|FIR|UIR|CTA)\b/);
  const body = raw.slice(head.index! + head[0].length);
  const cnl = body.match(/\bCNL (?:SIGMET|AIRMET) (\S+)/);
  const ph = PHENOMENA.find(([re]) => re.test(body));
  const obsM = body.match(/\b(OBS|FCST)(?: AT (\d{4})Z)?\b/);
  // The current position is everything before an end-of-validity forecast position.
  const endIdx = body.search(/\bFCST AT \d{4}Z\b/);
  const endPos = endIdx > (obsM?.index ?? -1) && endIdx > 0 ? body.slice(endIdx) : null;
  const now = endPos ? body.slice(0, endIdx) : body;
  const mov = body.match(/\bMOV ([NESW]{1,3}) (\d+) ?(KT|KMH)\b/);
  return {
    id: `${head[1]}-${firM?.[1] ?? "x"}-${head[2]}-${idx}`,
    kind: head[1] as Sigmet["kind"],
    fir: firM?.[1] ?? null,
    firName: firM ? `${firM[2].trim()} ${firM[3]}` : null,
    seq: head[2],
    validFrom: dt(head[3]),
    validTo: dt(head[4]),
    phenomenon: ph ? { code: body.match(ph[0])![0], text: ph[1], severity: ph[2] } : null,
    obs: (obsM?.[1] as Sigmet["obs"]) ?? null,
    obsAt: obsM?.[2] ?? null,
    area: parseArea(now),
    levels: parseLevels(now),
    movement: mov ? { dir: mov[1], spd: Number(mov[2]), unit: mov[3] } : /\bSTNR\b/.test(body) ? "STNR" : null,
    change: (body.match(/\b(INTSF|WKN|NC)\b/)?.[1] as Sigmet["change"]) ?? null,
    endArea: endPos ? parseArea(endPos) : null,
    endAt: endPos?.match(/FCST AT (\d{4})Z/)?.[1] ?? null,
    cancels: cnl?.[1] ?? null,
    raw,
  };
}

/** All SIGMETs / AIRMETs in an advisory block (lines from the OFP or pasted text). */
export function parseSigmets(lines: string[]): Sigmet[] {
  const text = lines.filter((l) => !/No Wx data/i.test(l)).join("\n");
  // A SIGMET ends at "="; its FIR line comes just before the SIGMET line.
  return text
    .split(/=/)
    .map((c, i) => parseSigmet(c, i))
    .filter((s): s is Sigmet => !!s);
}

/* ---------- geometry ---------- */

function inPolygon(lat: number, lon: number, pts: [number, number][]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [yi, xi] = pts[i];
    const [yj, xj] = pts[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inArea(area: Area, lat: number, lon: number): boolean | null {
  if (area.kind === "polygon") return inPolygon(lat, lon, area.points);
  if (area.kind === "bounds")
    return area.planes.every((p) => (p.op === "gt" ? (p.axis === "lat" ? lat : lon) > p.value : (p.axis === "lat" ? lat : lon) < p.value));
  return null;
}

/* ---------- route impact ---------- */

export interface RoutePoint {
  name: string;
  lat: number;
  lon: number;
  /** Feet. */
  alt: number;
  /** Minutes after take-off. */
  ttlt: number;
  /** Cumulative distance, NM. */
  cum: number;
  /** FIR crossing name, for FIR-wide SIGMETs. */
  fir?: string | null;
}

export interface Impact {
  /** Where the route is inside the area (minutes after take-off and NM). */
  from: { name: string; t: number; cum: number; alt: number } | null;
  to: { name: string; t: number; cum: number; alt: number } | null;
  /** Lowest / highest altitude flown inside the area, feet. */
  altMin: number;
  altMax: number;
  lateral: boolean | null;
  vertical: "inside" | "above" | "below" | null;
  /** When the route is in the area, relative to validity: before it starts, during, or after it ends. */
  timing: "during" | "before" | "after" | null;
  /** Minutes between the nearer validity edge and the time on route (positive = gap). */
  gapMin: number | null;
  verdict: "affects" | "clear-level" | "clear-time" | "off-route" | "unknown";
  /** Waypoint names inside the area. */
  names: string[];
}

const absMin = (t: { day: number; hour: number; min: number }, ref: { day: number }) => {
  let d = t.day - ref.day;
  if (d < -15) d += 30;
  if (d > 15) d -= 30;
  return d * 1440 + t.hour * 60 + t.min;
};

/**
 * Samples the route between waypoints to find where it is inside the SIGMET area, at what
 * levels, and whether the flight is there during the SIGMET's validity.
 * @param offAbs take-off time in minutes from 00:00 UTC on `day` (the flight's date).
 */
export function routeImpact(s: Sigmet, route: RoutePoint[], offAbs: number | null, day: number): Impact {
  const blank: Impact = {
    from: null,
    to: null,
    altMin: 0,
    altMax: 0,
    lateral: null,
    vertical: null,
    timing: null,
    gapMin: null,
    verdict: "unknown",
    names: [],
  };
  if (route.length < 2) return blank;
  type Hit = { name: string; t: number; cum: number; alt: number };
  const hits: Hit[] = [];
  const names = new Set<string>();
  if (s.area.kind === "fir") {
    // FIR-wide: the stretch between entering this FIR and the next FIR crossing.
    const key = (s.firName ?? s.fir ?? "").split(" ")[0];
    let inFir = false;
    for (const p of route) {
      if (p.fir) inFir = !!key && p.fir.toUpperCase().includes(key);
      if (inFir) {
        hits.push({ name: p.name, t: p.ttlt, cum: p.cum, alt: p.alt });
        names.add(p.name);
      }
    }
    if (!key) return blank;
  } else if (s.area.kind === "polygon" || s.area.kind === "bounds") {
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];
      const n = 12;
      for (let k = 0; k <= n; k++) {
        const f = k / n;
        const lat = a.lat + (b.lat - a.lat) * f;
        const lon = a.lon + (b.lon - a.lon) * f;
        if (inArea(s.area, lat, lon)) {
          hits.push({ name: f < 0.5 ? a.name : b.name, t: a.ttlt + (b.ttlt - a.ttlt) * f, cum: a.cum + (b.cum - a.cum) * f, alt: a.alt + (b.alt - a.alt) * f });
          if (k === 0) names.add(a.name);
          if (k === n) names.add(b.name);
        }
      }
    }
  } else return blank;

  if (!hits.length) return { ...blank, lateral: false, verdict: "off-route" };
  const from = hits[0];
  const to = hits[hits.length - 1];
  const altMin = Math.min(...hits.map((h) => h.alt));
  const altMax = Math.max(...hits.map((h) => h.alt));
  const lv = s.levels;
  const vertical = !lv ? null : lv.top != null && altMin > lv.top ? "above" : altMax < lv.base ? "below" : "inside";
  let timing: Impact["timing"] = null;
  let gapMin: number | null = null;
  if (offAbs != null && s.validFrom && s.validTo) {
    const ref = { day };
    const vf = absMin(s.validFrom, ref);
    const vt = absMin(s.validTo, ref);
    const t0 = offAbs + from.t;
    const t1 = offAbs + to.t;
    if (t1 < vf) {
      timing = "before";
      gapMin = Math.round(vf - t1);
    } else if (t0 > vt) {
      timing = "after";
      gapMin = Math.round(t0 - vt);
    } else timing = "during";
  }
  const verdict: Impact["verdict"] = vertical && vertical !== "inside" ? "clear-level" : timing && timing !== "during" ? "clear-time" : "affects";
  return { from, to, altMin, altMax, lateral: true, vertical, timing, gapMin, verdict, names: [...names] };
}

/** Status of the SIGMET right now. */
export function nowStatus(s: Sigmet, now = new Date()): "active" | "upcoming" | "expired" | null {
  if (!s.validFrom || !s.validTo) return null;
  const ref = { day: now.getUTCDate() };
  const n = now.getUTCHours() * 60 + now.getUTCMinutes();
  const vf = absMin(s.validFrom, ref);
  const vt = absMin(s.validTo, ref);
  return n < vf ? "upcoming" : n > vt ? "expired" : "active";
}

export const fmtDdhhmm = (t: { day: number; hour: number; min: number } | null) =>
  t ? `${String(t.day).padStart(2, "0")} ${String(t.hour).padStart(2, "0")}${String(t.min).padStart(2, "0")}Z` : "—";
