/** Lightweight METAR / TAF token decoder for tooltips and summary chips. */

export type Category = "VFR" | "MVFR" | "IFR" | "LIFR";

export interface MetarToken {
  raw: string;
  kind: "time" | "wind" | "vis" | "wx" | "cloud" | "temp" | "qnh" | "trend" | "change" | "period" | "auto" | "other";
  tip: string;
}

export interface DecodedMetar {
  tokens: MetarToken[];
  wind: { dir: number | null; spd: number; gust: number | null; variable: string | null } | null;
  visM: number | null;
  ceilingFt: number | null;
  temp: number | null;
  dew: number | null;
  qnh: number | null;
  category: Category | null;
}

const WX: Record<string, string> = {
  RA: "rain",
  SHRA: "rain showers",
  DZ: "drizzle",
  SN: "snow",
  SG: "snow grains",
  GR: "hail",
  GS: "small hail",
  TS: "thunderstorm",
  TSRA: "thunderstorm with rain",
  FG: "fog",
  BR: "mist",
  HZ: "haze",
  FU: "smoke",
  DU: "dust",
  SA: "sand",
  VA: "volcanic ash",
  SQ: "squalls",
  FC: "funnel cloud",
  SH: "showers",
  FZ: "freezing",
  BC: "patches",
  MI: "shallow",
  PR: "partial",
  BL: "blowing",
  DR: "drifting",
  VC: "in the vicinity",
  PL: "ice pellets",
  IC: "ice crystals",
  UP: "unknown precipitation",
  SHSN: "snow showers",
  FZRA: "freezing rain",
  FZDZ: "freezing drizzle",
  FZFG: "freezing fog",
};

const COVER: Record<string, string> = {
  FEW: "Few (1–2 oktas)",
  SCT: "Scattered (3–4 oktas)",
  BKN: "Broken (5–7 oktas)",
  OVC: "Overcast (8 oktas)",
  VV: "Vertical visibility",
};

function decodeWx(t: string): string | null {
  const m = t.match(/^([+-]|VC)?([A-Z]{2,8})$/);
  if (!m) return null;
  let rest = m[2];
  const parts: string[] = [];
  while (rest.length) {
    const code = rest.slice(0, 2);
    if (!WX[code]) return null;
    parts.push(WX[code]);
    rest = rest.slice(2);
  }
  const intensity = m[1] === "+" ? "Heavy " : m[1] === "-" ? "Light " : m[1] === "VC" ? "In vicinity: " : "";
  return intensity + parts.join(" ");
}

export function decodeToken(t: string, isTaf = false): MetarToken {
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{2})(\d{2})(\d{2})Z?$/)) && !isTaf) return { raw: t, kind: "time", tip: `Observed day ${m[1]} at ${m[2]}:${m[3]} UTC` };
  if ((m = t.match(/^(\d{2})(\d{2})(\d{2})Z?$/))) return { raw: t, kind: "time", tip: `Issued day ${m[1]} at ${m[2]}:${m[3]} UTC` };
  if ((m = t.match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/)))
    return { raw: t, kind: "period", tip: `Valid from day ${m[1]} ${m[2]}:00 to day ${m[3]} ${m[4]}:00 UTC` };
  if ((m = t.match(/^(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/))) {
    const dir = m[1] === "VRB" ? "Variable direction" : `From ${m[1]}° true`;
    return { raw: t, kind: "wind", tip: `${dir} at ${Number(m[2])} ${m[4] === "KT" ? "kt" : "m/s"}${m[3] ? `, gusting ${Number(m[3])}` : ""}` };
  }
  if ((m = t.match(/^(\d{3})V(\d{3})$/))) return { raw: t, kind: "wind", tip: `Wind direction varying between ${m[1]}° and ${m[2]}°` };
  if (t === "CAVOK")
    return { raw: t, kind: "vis", tip: "Ceiling and visibility OK: vis ≥ 10 km, no cloud below 5000 ft or MSA, no CB/TCU, no significant weather" };
  if (t === "9999") return { raw: t, kind: "vis", tip: "Visibility 10 km or more" };
  if ((m = t.match(/^(\d{4})$/))) return { raw: t, kind: "vis", tip: `Visibility ${Number(m[1])} m` };
  if ((m = t.match(/^(P)?(\d{1,2}|\d\/\d{1,2})SM$/)))
    return { raw: t, kind: "vis", tip: `Visibility ${m[1] ? "more than " : ""}${m[2]} statute mile${m[2] === "1" ? "" : "s"}` };
  if (t === "NCD") return { raw: t, kind: "cloud", tip: "No cloud detected (automatic station)" };
  if (t === "NSC") return { raw: t, kind: "cloud", tip: "No significant cloud" };
  if (t === "SKC" || t === "CLR") return { raw: t, kind: "cloud", tip: "Sky clear" };
  if ((m = t.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)(CB|TCU|\/\/\/)?$/))) {
    const h = m[2] === "///" ? "unknown height" : `${Number(m[2]) * 100} ft AGL`;
    const type = m[3] === "CB" ? ", cumulonimbus" : m[3] === "TCU" ? ", towering cumulus" : "";
    return { raw: t, kind: "cloud", tip: `${COVER[m[1]]} at ${h}${type}` };
  }
  if ((m = t.match(/^(M?\d{2})\/(M?\d{2})$/))) {
    const c = (s: string) => (s.startsWith("M") ? -Number(s.slice(1)) : Number(s));
    return { raw: t, kind: "temp", tip: `Temperature ${c(m[1])} °C, dew point ${c(m[2])} °C (spread ${c(m[1]) - c(m[2])} °C)` };
  }
  if ((m = t.match(/^T([XN])(M?\d{2})\/(\d{2})(\d{2})Z$/))) {
    const v = m[2].startsWith("M") ? -Number(m[2].slice(1)) : Number(m[2]);
    return { raw: t, kind: "temp", tip: `${m[1] === "X" ? "Maximum" : "Minimum"} temperature ${v} °C on day ${m[3]} at ${m[4]}:00 UTC` };
  }
  if ((m = t.match(/^Q(\d{4})$/))) return { raw: t, kind: "qnh", tip: `QNH ${Number(m[1])} hPa` };
  if ((m = t.match(/^A(\d{4})$/))) return { raw: t, kind: "qnh", tip: `Altimeter ${m[1].slice(0, 2)}.${m[1].slice(2)} inHg` };
  if (t === "NOSIG") return { raw: t, kind: "trend", tip: "No significant change expected in the next 2 hours" };
  if (t === "AUTO") return { raw: t, kind: "auto", tip: "Fully automated observation, no human oversight" };
  if (t === "TEMPO") return { raw: t, kind: "change", tip: "Temporary fluctuations lasting under an hour each, in total less than half of the period" };
  if (t === "BECMG") return { raw: t, kind: "change", tip: "Conditions becoming — a permanent change during the period" };
  if ((m = t.match(/^PROB(\d{2})$/))) return { raw: t, kind: "change", tip: `${m[1]}% probability of the following conditions` };
  if ((m = t.match(/^FM(\d{2})(\d{2})(\d{2})$/))) return { raw: t, kind: "change", tip: `From day ${m[1]} at ${m[2]}:${m[3]} UTC, conditions change to` };
  const wx = decodeWx(t);
  if (wx) return { raw: t, kind: "wx", tip: wx[0].toUpperCase() + wx.slice(1) };
  return { raw: t, kind: "other", tip: "" };
}

export function category(visM: number | null, ceilingFt: number | null): Category | null {
  if (visM == null && ceilingFt == null) return null;
  const v = visM ?? 99999;
  const c = ceilingFt ?? 99999;
  if (v < 1600 || c < 500) return "LIFR";
  if (v < 4800 || c < 1000) return "IFR";
  if (v <= 8000 || c <= 3000) return "MVFR";
  return "VFR";
}

export const CATEGORY_TIP: Record<Category, string> = {
  VFR: "VFR — ceiling above 3000 ft and visibility above 5 SM (≈8 km)",
  MVFR: "Marginal VFR — ceiling 1000–3000 ft and/or visibility 3–5 SM",
  IFR: "IFR — ceiling 500–1000 ft and/or visibility 1–3 SM",
  LIFR: "Low IFR — ceiling below 500 ft and/or visibility below 1 SM",
};

export function decodeMetar(raw: string): DecodedMetar {
  const parts = raw.trim().split(/\s+/);
  const tokens = parts.map((p) => decodeToken(p));
  let wind: DecodedMetar["wind"] = null;
  let visM: number | null = null;
  let ceilingFt: number | null = null;
  let temp: number | null = null;
  let dew: number | null = null;
  let qnh: number | null = null;
  for (const p of parts) {
    let m: RegExpMatchArray | null;
    if ((m = p.match(/^(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?KT$/)))
      wind = { dir: m[1] === "VRB" ? null : Number(m[1]), spd: Number(m[2]), gust: m[3] ? Number(m[3]) : null, variable: null };
    else if ((m = p.match(/^(\d{3})V(\d{3})$/)) && wind) wind.variable = `${m[1]}–${m[2]}`;
    else if (p === "CAVOK") {
      visM = 10000;
      ceilingFt = null;
    } else if ((m = p.match(/^(\d{4})$/)) && visM == null) visM = p === "9999" ? 10000 : Number(m[1]);
    else if ((m = p.match(/^(BKN|OVC|VV)(\d{3})/))) {
      const h = Number(m[2]) * 100;
      if (ceilingFt == null || h < ceilingFt) ceilingFt = h;
    } else if ((m = p.match(/^(M?\d{2})\/(M?\d{2})$/))) {
      const c = (s: string) => (s.startsWith("M") ? -Number(s.slice(1)) : Number(s));
      temp = c(m[1]);
      dew = c(m[2]);
    } else if ((m = p.match(/^Q(\d{4})$/))) qnh = Number(m[1]);
    else if (p === "NOSIG" || p === "TEMPO" || p === "BECMG") break;
  }
  return { tokens, wind, visM, ceilingFt, temp, dew, qnh, category: category(visM, ceilingFt ?? (visM != null ? 99999 : null)) };
}

/** Head/cross-wind components for a runway heading (degrees). */
export function components(windDir: number, windSpd: number, rwyHdg: number) {
  const a = ((windDir - rwyHdg) * Math.PI) / 180;
  return { head: Math.round(windSpd * Math.cos(a)), cross: Math.round(windSpd * Math.sin(a)) };
}
