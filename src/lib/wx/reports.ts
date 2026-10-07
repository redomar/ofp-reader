/**
 * Turns pasted METAR / SPECI / TAF / ATIS text into structured reports for the weather
 * cards page. Builds on the token decoder in lib/ofp/metar (tooltips, flight category).
 *
 * - Reports are split at blank lines, "=" terminators, and lines that start a new
 *   report (METAR/SPECI/TAF keyword, or an ICAO code followed by a ddhhmmZ time).
 * - A block that mentions ATIS or "INFORMATION <letter>" is read as one ATIS, coded
 *   (D-ATIS, METAR-style groups) or plain language ("SURFACE WIND 240 DEGREES 12 KNOTS").
 * - TAFs are split into change groups (FM, BECMG, TEMPO, PROBnn) on an hour timeline.
 */

import { category, decodeToken, type Category } from "@/lib/ofp/metar";

export type ReportKind = "METAR" | "SPECI" | "TAF" | "ATIS";

export interface CloudLayer {
  cover: "FEW" | "SCT" | "BKN" | "OVC" | "VV";
  baseFt: number | null;
  type: "CB" | "TCU" | null;
}

export interface Conditions {
  wind: { dir: number | null; spd: number; gust: number | null; sector: [number, number] | null; calm: boolean } | null;
  visM: number | null;
  cavok: boolean;
  /** Present weather codes, e.g. "-SHRA", "BR". */
  wx: string[];
  clouds: CloudLayer[];
  /** NSC / SKC / CLR / NCD. */
  noCloud: string | null;
  ceilingFt: number | null;
  temp: number | null;
  dew: number | null;
  qnh: number | null;
  category: Category | null;
}

export interface DayTime {
  day: number;
  hour: number;
  min: number;
}

export interface TafGroup {
  type: "BASE" | "FM" | "BECMG" | "TEMPO" | "PROB";
  prob: number | null;
  /** PROB30 TEMPO and the like. */
  tempo: boolean;
  from: DayTime | null;
  to: DayTime | null;
  text: string;
  cond: Conditions;
}

export interface AtisInfo {
  letter: string | null;
  kind: "ARR" | "DEP" | null;
  name: string | null;
  runways: { rwy: string; use: "landing" | "take-off" | null }[];
  approach: string | null;
  transitionLevel: string | null;
  /** True when the weather came from plain-language phrases rather than coded groups. */
  plain: boolean;
  /** Sentences that aren't weather or runway info: NOTAM-style notices, cautions. */
  notes: string[];
}

export interface Report {
  kind: ReportKind;
  /** METAR trend: "NOSIG", or "TEMPO 4000 SHRA" etc. */
  trend: string | null;
  icao: string | null;
  raw: string;
  time: DayTime | null;
  cond: Conditions;
  taf: { valid: { from: DayTime; to: DayTime } | null; groups: TafGroup[] } | null;
  atis: AtisInfo | null;
}

/* ---------- conditions from coded groups ---------- */

const MPS_TO_KT = 1.94384;

function smToM(t: string): number | null {
  if (/^P6SM$/.test(t)) return 10000;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{1,2})SM$/))) return Math.min(10000, Math.round(Number(m[1]) * 1609));
  if ((m = t.match(/^(\d)\/(\d{1,2})SM$/))) return Math.round((Number(m[1]) / Number(m[2])) * 1609);
  return null;
}

const temp = (s: string) => (s.startsWith("M") ? -Number(s.slice(1)) : Number(s));

export function emptyConditions(): Conditions {
  return { wind: null, visM: null, cavok: false, wx: [], clouds: [], noCloud: null, ceilingFt: null, temp: null, dew: null, qnh: null, category: null };
}

/** Reads the weather groups out of a token list (stops at the first trend / change group). */
export function conditionsFrom(tokens: string[], stopAtTrend = true): Conditions {
  const c = emptyConditions();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    let m: RegExpMatchArray | null;
    if (stopAtTrend && /^(NOSIG|TEMPO|BECMG|PROB\d\d|FM\d{6}|RMK)$/.test(t)) break;
    if ((m = t.match(/^(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?(KT|MPS|KMH)$/))) {
      const k = m[4] === "MPS" ? MPS_TO_KT : m[4] === "KMH" ? 0.539957 : 1;
      const spd = Math.round(Number(m[2]) * k);
      c.wind = { dir: m[1] === "VRB" ? null : Number(m[1]), spd, gust: m[3] ? Math.round(Number(m[3]) * k) : null, sector: null, calm: spd === 0 };
    } else if ((m = t.match(/^(\d{3})V(\d{3})$/)) && c.wind) c.wind.sector = [Number(m[1]), Number(m[2])];
    else if (t === "CAVOK") {
      c.cavok = true;
      c.visM = 10000;
    } else if ((m = t.match(/^(\d{4})(NDV)?$/)) && c.visM == null) c.visM = t.startsWith("9999") ? 10000 : Number(m[1]);
    else if (/^\d$/.test(t) && /^\d\/\d{1,2}SM$/.test(tokens[i + 1] ?? "")) {
      // "1 1/2SM"
      c.visM = Math.round((Number(t) + (smToM(tokens[i + 1]) ?? 0) / 1609) * 1609);
      i++;
    } else if (smToM(t) != null && c.visM == null) c.visM = smToM(t);
    else if ((m = t.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)(CB|TCU|\/\/\/)?$/))) {
      const base = m[2] === "///" ? null : Number(m[2]) * 100;
      c.clouds.push({ cover: m[1] as CloudLayer["cover"], baseFt: base, type: m[3] === "CB" || m[3] === "TCU" ? m[3] : null });
      if ((m[1] === "BKN" || m[1] === "OVC" || m[1] === "VV") && base != null && (c.ceilingFt == null || base < c.ceilingFt)) c.ceilingFt = base;
    } else if (/^(NSC|SKC|CLR|NCD)$/.test(t)) c.noCloud = t;
    else if ((m = t.match(/^(M?\d{2})\/(M?\d{2})?$/))) {
      c.temp = temp(m[1]);
      c.dew = m[2] ? temp(m[2]) : null;
    } else if ((m = t.match(/^Q(\d{4})$/))) c.qnh = Number(m[1]);
    else if ((m = t.match(/^A(\d{4})$/))) c.qnh = Math.round(Number(m[1]) * 0.338639);
    else if (t === "NSW") c.wx = [];
    else if (decodeToken(t).kind === "wx" && !c.wx.includes(t)) c.wx.push(t);
  }
  c.category = category(c.visM, c.ceilingFt ?? (c.visM != null ? 99999 : null));
  return c;
}

/** Applies a change group's groups on top of the prevailing conditions. */
export function mergeConditions(base: Conditions, change: Conditions, text: string): Conditions {
  const out: Conditions = { ...base, clouds: [...base.clouds], wx: [...base.wx] };
  if (change.wind) out.wind = change.wind;
  if (change.visM != null) out.visM = change.visM;
  if (change.cavok) {
    out.cavok = true;
    out.clouds = [];
    out.wx = [];
    out.ceilingFt = null;
  }
  if (change.clouds.length || change.noCloud) {
    out.clouds = change.clouds;
    out.noCloud = change.noCloud;
    out.ceilingFt = change.ceilingFt;
  }
  if (change.wx.length || /\bNSW\b/.test(text)) out.wx = change.wx;
  // CAVOK no longer holds once the group brings cloud, weather or lower visibility.
  if (!change.cavok && (change.clouds.length || change.wx.length || (change.visM != null && change.visM < 10000))) out.cavok = false;
  out.category = category(out.visM, out.ceilingFt ?? (out.visM != null ? 99999 : null));
  return out;
}

/* ---------- splitting ---------- */

const ATIS_RE = /\bATIS\b|\bINFORMATION\s+[A-Z]+\b|\bINFO\s+[A-Z]\b/;
/** An ATIS announces itself near the start: "EGLL ARR ATIS F", "THIS IS SCHIPHOL INFORMATION ROMEO". */
const ATIS_START = /^(?:\S+\s+){0,4}?(?:ARR\s+|DEP\s+|ARRIVAL\s+|DEPARTURE\s+)?(?:ATIS|INFORMATION|INFO)\s+[A-Z]/;
const START_RE = /^(METAR|SPECI|TAF)\b|^[A-Z]{4}\s+\d{6}Z?\b/;
const CHANGE_LINE = /^(TEMPO|BECMG|PROB\d\d|FM\d{6}|RMK)\b/;

/** The information letter: the first phonetic word or single letter after INFORMATION / INFO / ATIS. */
function atisLetter(s: string): string | null {
  for (const m of s.matchAll(/\b(?:INFORMATION|INFO|ATIS)\s+([A-Z][A-Z-]*)\b/g)) {
    const w = m[1];
    if (/^(INFORMATION|INFO|ARR|DEP|ARRIVAL|DEPARTURE|IS|AT)$/.test(w)) continue;
    const l = PHONETIC[w] ?? (w.length === 1 ? w : null);
    if (l) return l;
  }
  return null;
}

export function splitReports(text: string): string[] {
  const blocks = text
    .toUpperCase()
    .replace(/\r/g, "")
    .split(/=\s*|\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const block of blocks) {
    let cur: string[] = [];
    for (const line of block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)) {
      // Inside an ATIS, a line naming the same information ("THIS WAS … INFORMATION B") continues it.
      const inAtis = cur.length > 0 && ATIS_START.test(cur[0]);
      const sameAtis = inAtis && ATIS_START.test(line) && (/THIS (WAS|IS)$/.test(cur.at(-1)!) || atisLetter(line) === atisLetter(cur.join(" ")));
      const starts = (START_RE.test(line) || ATIS_START.test(line)) && !CHANGE_LINE.test(line) && !sameAtis;
      if (cur.length && starts) {
        out.push(cur.join(" "));
        cur = [];
      }
      cur.push(line);
    }
    if (cur.length) out.push(cur.join(" "));
  }
  return out.map((r) => r.replace(/\s+/g, " "));
}

/* ---------- report parsing ---------- */

const dayTime = (s: string): DayTime | null => {
  const m = s.match(/^(\d{2})(\d{2})(\d{2})Z?$/);
  return m ? { day: Number(m[1]), hour: Number(m[2]), min: Number(m[3]) } : null;
};
const period = (s: string): { from: DayTime; to: DayTime } | null => {
  const m = s.match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/);
  return m ? { from: { day: Number(m[1]), hour: Number(m[2]), min: 0 }, to: { day: Number(m[3]), hour: Number(m[4]), min: 0 } } : null;
};

function parseTaf(tokens: string[], raw: string): Report {
  let i = 0;
  while (/^(TAF|AMD|COR|RTD)$/.test(tokens[i] ?? "")) i++;
  const icao = /^[A-Z]{4}$/.test(tokens[i] ?? "") ? tokens[i++] : null;
  const time = dayTime(tokens[i] ?? "");
  if (time) i++;
  const valid = period(tokens[i] ?? "");
  if (valid) i++;
  const body = tokens.slice(i);

  // Cut the body into groups at change indicators.
  const parts: { head: string[]; toks: string[] }[] = [{ head: [], toks: [] }];
  for (let k = 0; k < body.length; k++) {
    const t = body[k];
    if (/^RMK$/.test(t)) break;
    if (/^FM\d{6}$/.test(t) || t === "BECMG" || t === "TEMPO" || /^PROB\d\d$/.test(t)) {
      const head = [t];
      if (/^PROB\d\d$/.test(t) && body[k + 1] === "TEMPO") head.push(body[++k]);
      parts.push({ head, toks: [] });
    } else parts.at(-1)!.toks.push(t);
  }

  const groups: TafGroup[] = [];
  let prevailing = emptyConditions();
  for (const p of parts) {
    const h = p.head[0];
    let from: DayTime | null = null;
    let to: DayTime | null = null;
    let toks = p.toks;
    const per = period(toks[0] ?? "");
    if (per) {
      from = per.from;
      to = per.to;
      toks = toks.slice(1);
    }
    const own = conditionsFrom(toks, false);
    const text = [...p.head, ...p.toks].join(" ");
    if (!h) {
      prevailing = own;
      groups.push({ type: "BASE", prob: null, tempo: false, from: valid?.from ?? null, to: valid?.to ?? null, text, cond: own });
    } else if (h.startsWith("FM")) {
      const m = h.match(/^FM(\d{2})(\d{2})(\d{2})$/)!;
      prevailing = own;
      groups.push({ type: "FM", prob: null, tempo: false, from: { day: Number(m[1]), hour: Number(m[2]), min: Number(m[3]) }, to: null, text, cond: own });
    } else if (h === "BECMG") {
      prevailing = mergeConditions(prevailing, own, text);
      groups.push({ type: "BECMG", prob: null, tempo: false, from, to, text, cond: prevailing });
    } else {
      const prob = h.startsWith("PROB") ? Number(h.slice(4)) : null;
      groups.push({
        type: prob ? "PROB" : "TEMPO",
        prob,
        tempo: h === "TEMPO" || p.head[1] === "TEMPO",
        from,
        to,
        text,
        cond: mergeConditions(prevailing, own, text),
      });
    }
  }
  // An FM group lasts until the next FM, or the end of the TAF.
  const fms = groups.filter((g) => g.type === "FM");
  fms.forEach((g, k) => (g.to = fms[k + 1]?.from ?? valid?.to ?? null));

  return { kind: "TAF", icao, raw, trend: null, time, cond: groups[0]?.cond ?? emptyConditions(), taf: { valid, groups }, atis: null };
}

function parseMetar(tokens: string[], raw: string): Report {
  let i = 0;
  let kind: ReportKind = "METAR";
  while (/^(METAR|SPECI|COR|AMD)$/.test(tokens[i] ?? "")) {
    if (tokens[i] === "SPECI") kind = "SPECI";
    i++;
  }
  const icao = /^[A-Z]{4}$/.test(tokens[i] ?? "") ? tokens[i++] : null;
  const time = dayTime(tokens[i] ?? "");
  if (time) i++;
  const body = tokens.slice(i);
  const tIdx = body.findIndex((t) => /^(NOSIG|TEMPO|BECMG)$/.test(t));
  const rIdx = body.indexOf("RMK");
  const trend = tIdx >= 0 ? body.slice(tIdx, rIdx > tIdx ? rIdx : undefined).join(" ") : null;
  return { kind, icao, raw, trend, time, cond: conditionsFrom(body), taf: null, atis: null };
}

/* ---------- ATIS ---------- */

const PHONETIC: Record<string, string> = {
  ALFA: "A",
  ALPHA: "A",
  BRAVO: "B",
  CHARLIE: "C",
  DELTA: "D",
  ECHO: "E",
  FOXTROT: "F",
  GOLF: "G",
  HOTEL: "H",
  INDIA: "I",
  JULIET: "J",
  JULIETT: "J",
  KILO: "K",
  LIMA: "L",
  MIKE: "M",
  NOVEMBER: "N",
  OSCAR: "O",
  PAPA: "P",
  QUEBEC: "Q",
  ROMEO: "R",
  SIERRA: "S",
  TANGO: "T",
  UNIFORM: "U",
  VICTOR: "V",
  WHISKEY: "W",
  WHISKY: "W",
  XRAY: "X",
  "X-RAY": "X",
  YANKEE: "Y",
  ZULU: "Z",
};
const NUMWORD: Record<string, string> = {
  ZERO: "0",
  ONE: "1",
  TWO: "2",
  THREE: "3",
  TREE: "3",
  FOUR: "4",
  FIVE: "5",
  FIFE: "5",
  SIX: "6",
  SEVEN: "7",
  EIGHT: "8",
  NINE: "9",
  NINER: "9",
};
const COVER_WORD: Record<string, CloudLayer["cover"]> = { FEW: "FEW", SCATTERED: "SCT", SCT: "SCT", BROKEN: "BKN", BKN: "BKN", OVERCAST: "OVC", OVC: "OVC" };
/** Sentences that are ATIS furniture rather than information. */
const BOILERPLATE = /\b(ADVISE|ADVS|ACKNOWLEDGE|ACK|ON (INITIAL )?(CONTACT|CTC)|YOU HAVE (INFO|INFORMATION))\b/;
/** Coded METAR-style groups (D-ATIS weather after a full stop isn't a notice). */
const CODED_GROUP = /\b(?:(?:VRB|\d{3})\d{2,3}(?:G\d{2,3})?(?:KT|MPS)|Q\d{4}|A\d{4}|(?:FEW|SCT|BKN|OVC)\d{3}|M?\d{2}\/M?\d{2}|CAVOK)\b/;
/** Sentences already shown as fields. */
const FIELD_SENTENCE =
  /^(?:\S+\s+){0,5}?(INFO|INFORMATION|ATIS)\b|^\d{4}Z?$|^(AT\s+)?TIME\b|\b(RWYS?|RUNWAYS?)\b|^(SURFACE )?WIND\b|^(VIS|VISIBILITY|CAVOK)\b|^(FEW|SCT|BKN|OVC|SCATTERED|BROKEN|OVERCAST|NO SIGNIFICANT CLOUD|SKY CLEAR)\b|^(TEMP|TEMPERATURE|DEW ?POINT|DP)\b|^(QNH|ALTIMETER)\b|^(TRL|TL|TRANSITION LEVEL)\b|^(EXP|EXPECT)\s+(ILS|RNP|RNAV|VOR|NDB|LOC|VISUAL)\b|^(LIGHT|HEAVY|MODERATE)?\s*(RAIN|DRIZZLE|SNOW|FOG|MIST|HAZE|SHOWERS?|THUNDERSTORMS?)\b/;
const WX_WORD: [RegExp, string][] = [
  [/\bTHUNDERSTORMS?\b/, "TS"],
  [/\bHEAVY RAIN\b/, "+RA"],
  [/\bLIGHT RAIN\b/, "-RA"],
  [/\bRAIN SHOWERS?\b|\bSHOWERS OF RAIN\b/, "SHRA"],
  [/\b(?<!LIGHT |HEAVY )RAIN\b/, "RA"],
  [/\bDRIZZLE\b/, "DZ"],
  [/\bSNOW\b/, "SN"],
  [/\bFREEZING FOG\b/, "FZFG"],
  [/\bFOG\b/, "FG"],
  [/\bMIST\b/, "BR"],
  [/\bHAZE\b/, "HZ"],
];

function parseAtis(raw: string): Report {
  // Spoken digits ("TWO FOUR ZERO") become numbers so the same patterns match both styles.
  let s = raw.replace(/\b(ZERO|ONE|TWO|THREE|TREE|FOUR|FIVE|FIFE|SIX|SEVEN|EIGHT|NINE|NINER)\b/g, (w) => NUMWORD[w]);
  // Join spoken single digits only ("2 4 0" → "240"), never two real numbers ("240 12").
  s = s.replace(/\b(\d)(?: (\d)\b)+/g, (m) => m.replace(/ /g, ""));
  const tokens = s.split(/[\s,]+/).filter(Boolean);

  const letter = atisLetter(s);
  // An ICAO code leads a coded ATIS ("EGLL ARR ATIS F") or names it ("THIS WAS LEMD ATIS …");
  // four-letter words like ARPT or INFO are not codes.
  // Only "XXXX ATIS" names an airport; "YOU HAVE INFO …" must not make HAVE an ICAO code.
  const NOT_ICAO = /^(THIS|INFO|ATIS|TIME|WIND|ARPT|BASE|CITY|PORT|WITH|THAT|FROM|HAVE|WILL|WERE|WHEN|YOUR|THEN|ALSO|NEAR|AREA|OPEN|USED|EACH)$/;
  const icao =
    (/^[A-Z]{4}$/.test(tokens[0] ?? "") && !NOT_ICAO.test(tokens[0]) ? tokens[0] : null) ??
    [...s.matchAll(/\b([A-Z]{4})\s+(?:ARR\s+|DEP\s+)?ATIS\b/g)].map((m) => m[1]).find((c) => !NOT_ICAO.test(c)) ??
    null;
  const nameM = s.match(/^(?:THIS IS\s+)?([A-Z][A-Z .]+?)[\s,]+(?:ARR\w*\s+|DEP\w*\s+)?(?:INFORMATION|INFO|ATIS)\b/);
  const kind = /\bARR(?:IVAL)?\b/.test(s) ? "ARR" : /\bDEP(?:ARTURE)?\b/.test(s) ? "DEP" : null;

  const runways: AtisInfo["runways"] = [];
  const RWY_ID = String.raw`\d{2}\s*(?:LEFT|RIGHT|CENTRE|CENTER|[LRC])?\b`;
  const listRe = new RegExp(
    String.raw`\b(?:(LANDING|LDG|ARRIVALS?|ARRIVING|ARVG|ARR|TAKE-?OFF|T\/O|DEPARTURES?|DEPARTING|DPTG|DEP)\s+)?(?:RWYS?|RUNWAYS?)(?:\s+IN\s+USE)?(?:\s+FOR\s+(LANDING|TAKE-?OFF|ARRIVALS?|DEPARTURES?))?\s+(${RWY_ID}(?:\s*(?:,|AND|&)\s*${RWY_ID})*)`,
    "g",
  );
  for (const m of s.matchAll(listRe)) {
    const role = m[1] ?? m[2];
    const use = role ? (/LAND|LDG|ARR|ARV/.test(role) ? "landing" : "take-off") : null;
    for (const id of m[3].matchAll(/(\d{2})\s*(LEFT|RIGHT|CENTRE|CENTER|[LRC])?/g)) {
      const rwy = id[1] + (id[2] ? id[2][0] : "");
      if (!runways.some((r) => r.rwy === rwy && r.use === use)) runways.push({ rwy, use });
    }
  }
  for (let k = runways.length - 1; k >= 0; k--)
    if (runways[k].use == null && runways.some((r) => r.rwy === runways[k].rwy && r.use != null)) runways.splice(k, 1);
  const approach = s.match(/\b(ILS|RNP|RNAV|VOR|NDB|LOC|LOCALIZER|VISUAL)(?:\s+[XYZ])?\s+(?:APPROACH(?:ES)?|APCH|APP)\b/)?.[1] ?? null;
  const tl = s.match(/\b(?:TRANSITION LEVEL|TRL|TL)\s*(?:FL\s*)?(\d{2,3})\b/)?.[1] ?? null;

  const timeM = s.match(/\b(\d{4})Z\b/) ?? s.match(/\bTIME\s+(\d{4})\b/);
  const time = timeM ? { day: new Date().getUTCDate(), hour: Number(timeM[1].slice(0, 2)), min: Number(timeM[1].slice(2)) } : null;

  // Coded D-ATIS: METAR-style groups are in the text.
  // Coded groups are read from the coded wind onwards (where the METAR-style part starts), so
  // plain numbers earlier ("FEW AT 2500", "TIME 1030") aren't taken for a visibility.
  const windAt = tokens.findIndex((t) => /^(VRB|\d{3})\d{2,3}(G\d{2,3})?(KT|MPS)$/.test(t));
  const codedCond = conditionsFrom(windAt >= 0 ? tokens.slice(windAt) : tokens);
  if (windAt < 0) codedCond.visM = null;
  const coded = windAt >= 0 || codedCond.clouds.length > 0 || codedCond.qnh != null;
  let cond: Conditions;
  {
    const p = emptyConditions();
    let m: RegExpMatchArray | null;
    if (/\bWIND\s+CALM\b|\bCALM\b/.test(s)) p.wind = { dir: null, spd: 0, gust: null, sector: null, calm: true };
    else if (
      (m = s.match(
        /\bWIND\s+(?:IS\s+)?(\d{3})\s*(?:DEGREES?|DEG)?\s*(?:AT\s+(\d{1,3})(?:\s*(?:KNOTS?|KT))?|(\d{1,3})\s*(?:KNOTS?|KT))\b(?:[^.]*?\b(?:GUST(?:ING|S)?|G)\s*(?:TO\s+)?(\d{1,3}))?/,
      ))
    )
      p.wind = { dir: Number(m[1]), spd: Number(m[2] ?? m[3]), gust: m[4] ? Number(m[4]) : null, sector: null, calm: false };
    else if ((m = s.match(/\bWIND\s+VARIABLE\s+(\d{1,2})\s*(?:KNOTS?|KT)/))) p.wind = { dir: null, spd: Number(m[1]), gust: null, sector: null, calm: false };
    if (p.wind && (m = s.match(/\bVARYING\s+(?:BETWEEN\s+)?(\d{3})\s*(?:DEGREES?)?\s*(?:AND|TO)\s+(\d{3})/))) p.wind.sector = [Number(m[1]), Number(m[2])];
    if (/\bCAVOK\b|\bCAV OK\b/.test(s)) {
      p.cavok = true;
      p.visM = 10000;
    } else if ((m = s.match(/\b(?:VISIBILITY|VIS)\s+(?:IS\s+)?(\d+(?:\.\d+)?)\s*(KILOMET(?:RE|ER)S?|KM|MET(?:RE|ER)S?|M|MILES?|SM)\b/)))
      p.visM = Math.min(10000, Math.round(Number(m[1]) * (/^K/.test(m[2]) ? 1000 : /^(MILE|SM)/.test(m[2]) ? 1609 : 1)));
    for (const m2 of s.matchAll(
      /\b(FEW|SCATTERED|SCT|BROKEN|BKN|OVERCAST|OVC)\s+(?:AT\s+)?(\d{3,5})(?:\s*(?:FEET|FT))?\b(\s+CUMULONIMBUS|\s+CB\b|\s+TOWERING CUMULUS|\s+TCU\b)?/g,
    )) {
      const cover = COVER_WORD[m2[1]];
      const base = Number(m2[2]);
      p.clouds.push({ cover, baseFt: base, type: /CUMULONIMBUS|CB/.test(m2[3] ?? "") ? "CB" : m2[3] ? "TCU" : null });
      if ((cover === "BKN" || cover === "OVC") && (p.ceilingFt == null || base < p.ceilingFt)) p.ceilingFt = base;
    }
    if (/\bNO SIGNIFICANT CLOUD\b/.test(s)) p.noCloud = "NSC";
    if (/\bSKY CLEAR\b/.test(s)) p.noCloud = "SKC";
    if ((m = s.match(/\b(?:TEMPERATURE|TEMP)\s+(MINUS\s+|M)?(\d{1,2})\b/))) p.temp = (m[1] ? -1 : 1) * Number(m[2]);
    if ((m = s.match(/\b(?:DEW ?POINT|DEWPOINT|DP)\s+(MINUS\s+|M)?(\d{1,2})\b/))) p.dew = (m[1] ? -1 : 1) * Number(m[2]);
    if ((m = s.match(/\bQNH\s*(\d{3,4})(?:\s*(?:HPA|HECTOPASCALS?))?\b/))) p.qnh = Number(m[1]);
    else if ((m = s.match(/\bALTIMETER\s+(\d{4})\b/))) p.qnh = Math.round(Number(m[1]) * 0.338639);
    for (const [re, code] of WX_WORD) if (re.test(s) && !p.wx.some((w) => w.includes(code.replace(/[+-]/, "")))) p.wx.push(code);
    p.category = category(p.visM, p.ceilingFt ?? (p.visM != null ? 99999 : null));
    // Coded groups win where both exist; phrases fill the gaps ("VIS 10KM", "QNH 1026HPA").
    const c = codedCond;
    cond = {
      wind: c.wind ?? p.wind,
      visM: c.visM ?? p.visM,
      cavok: c.cavok || p.cavok,
      wx: c.wx.length ? c.wx : p.wx,
      clouds: c.clouds.length ? c.clouds : p.clouds,
      noCloud: c.noCloud ?? p.noCloud,
      ceilingFt: c.clouds.length ? c.ceilingFt : p.ceilingFt,
      temp: c.temp ?? p.temp,
      dew: c.dew ?? p.dew,
      qnh: c.qnh ?? p.qnh,
      category: null,
    };
    cond.category = category(cond.visM, cond.ceilingFt ?? (cond.visM != null ? 99999 : null));
  }

  const notes = raw
    .split(/\.\s+|\.$/)
    .map((x) => x.trim().replace(/\.$/, ""))
    .filter((x) => /[A-Z]{2}/.test(x) && !BOILERPLATE.test(x) && !FIELD_SENTENCE.test(x) && !CODED_GROUP.test(x));

  return {
    kind: "ATIS",
    icao,
    raw,
    trend: null,
    time,
    cond,
    taf: null,
    atis: {
      letter,
      kind,
      name: nameM?.[1]?.trim().replace(/\s+(ARPT|AIRPORT|AIRFIELD|AERODROME)$/, "") ?? null,
      runways,
      approach: approach === "LOCALIZER" ? "LOC" : approach,
      transitionLevel: tl,
      plain: !coded,
      notes,
    },
  };
}

export function parseReport(text: string): Report {
  if (ATIS_START.test(text) || (!START_RE.test(text) && ATIS_RE.test(text))) return parseAtis(text);
  const tokens = text.split(/\s+/).filter(Boolean);
  let i = 0;
  while (/^(METAR|SPECI|COR|AMD)$/.test(tokens[i] ?? "")) i++;
  const isTaf = tokens[0] === "TAF" || (/^[A-Z]{4}$/.test(tokens[i] ?? "") && !!period(tokens[i + 2] ?? "") && !!dayTime(tokens[i + 1] ?? ""));
  return isTaf ? parseTaf(tokens, text) : parseMetar(tokens, text);
}

export function parseAll(text: string): Report[] {
  return splitReports(text).map(parseReport);
}

/* ---------- helpers for display ---------- */

/** Hours since the start of `from`, for placing TAF groups on a timeline (handles month roll-over). */
export function hoursFrom(from: DayTime, t: DayTime): number {
  let days = t.day - from.day;
  if (days < -15) days += 30;
  return days * 24 + (t.hour - from.hour) + (t.min - from.min) / 60;
}

/** Minutes between a report time (this or last month, UTC) and now. */
export function ageMinutes(t: DayTime, now = new Date()): number {
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  let at = Date.UTC(y, mo, t.day, t.hour, t.min);
  if (at - now.getTime() > 36 * 3600e3) at = Date.UTC(y, mo - 1, t.day, t.hour, t.min);
  return Math.round((now.getTime() - at) / 60000);
}

const WX_TEXT: Record<string, string> = {
  TS: "thunderstorm",
  RA: "rain",
  DZ: "drizzle",
  SN: "snow",
  SH: "showers",
  FG: "fog",
  BR: "mist",
  HZ: "haze",
  GR: "hail",
  GS: "small hail",
  PL: "ice pellets",
  SG: "snow grains",
  FZ: "freezing",
  VC: "nearby",
  BL: "blowing",
  DR: "drifting",
  MI: "shallow",
  BC: "patchy",
  FU: "smoke",
  DU: "dust",
  SA: "sand",
  SQ: "squalls",
};

/** "-SHRA" → "light rain showers". */
export function wxWords(code: string): string {
  const m = code.match(/^([+-]|VC)?([A-Z]+)$/);
  if (!m) return code;
  const parts: string[] = [];
  for (let k = 0; k < m[2].length; k += 2) parts.push(WX_TEXT[m[2].slice(k, k + 2)] ?? m[2].slice(k, k + 2));
  // "showers rain" reads better as "rain showers"
  if (parts[0] === "showers" && parts.length > 1) parts.push(parts.shift()!);
  const pre = m[1] === "+" ? "heavy " : m[1] === "-" ? "light " : m[1] === "VC" ? "nearby " : "";
  return pre + parts.join(" ");
}

/** A one-line plain-English summary: "Light rain, broken cloud at 1,200 ft". */
export function headline(c: Conditions): string {
  const bits: string[] = [];
  if (c.wx.length) bits.push(c.wx.map(wxWords).join(", "));
  if (c.cavok) bits.push("CAVOK (clear, good visibility)");
  else {
    const top = [...c.clouds].sort((a, b) => ({ VV: 5, OVC: 4, BKN: 3, SCT: 2, FEW: 1 })[b.cover] - { VV: 5, OVC: 4, BKN: 3, SCT: 2, FEW: 1 }[a.cover])[0];
    const word = { FEW: "a few clouds", SCT: "scattered cloud", BKN: "broken cloud", OVC: "overcast", VV: "sky obscured" } as const;
    if (top)
      bits.push(
        `${word[top.cover]}${top.baseFt != null ? ` at ${top.baseFt.toLocaleString("en-GB")} ft` : ""}${top.type === "CB" ? " (CB)" : top.type === "TCU" ? " (TCU)" : ""}`,
      );
    else if (c.noCloud) bits.push(c.noCloud === "NCD" ? "no cloud detected" : c.noCloud === "NSC" ? "no significant cloud" : "clear sky");
  }
  if (!bits.length) return c.visM != null || c.wind ? "No cloud or weather reported" : "No weather groups found";
  const s = bits.join(", ");
  return s[0].toUpperCase() + s.slice(1);
}

export type Sky = "thunder" | "snow" | "rain" | "fog" | "overcast" | "cloudy" | "partly" | "clear" | "unknown";

/** Which weather picture to draw. */
export function skyOf(c: Conditions): Sky {
  const w = c.wx.join(" ");
  if (/TS/.test(w)) return "thunder";
  if (/SN|SG|PL|GR|GS/.test(w)) return "snow";
  if (/RA|DZ|SH/.test(w)) return "rain";
  if (/FG|BR|HZ|FU/.test(w) || (c.visM != null && c.visM < 3000)) return "fog";
  if (c.cavok || c.noCloud) return "clear";
  if (c.clouds.some((l) => l.cover === "OVC" || l.cover === "VV")) return "overcast";
  if (c.clouds.some((l) => l.cover === "BKN")) return "cloudy";
  if (c.clouds.length) return "partly";
  return c.visM != null ? "clear" : "unknown";
}

/* ---------- forecast at a moment ---------- */

export interface ForecastAt {
  /** Prevailing conditions at that time (BASE / FM / BECMG applied). */
  prevailing: Conditions;
  /** TEMPO / PROB groups active at that time, with their conditions. */
  temporary: TafGroup[];
  /** The worse of prevailing and temporary, by flight category. */
  worst: Conditions;
}

const CAT_RANK: Record<Category, number> = { VFR: 0, MVFR: 1, IFR: 2, LIFR: 3 };

/** What a TAF forecasts at `t` (e.g. the planned take-off or landing time). Null when outside its validity. */
export function forecastAt(taf: Report, t: DayTime): ForecastAt | null {
  const v = taf.taf?.valid;
  if (!taf.taf || !v) return null;
  const at = hoursFrom(v.from, t);
  if (at < 0 || at > hoursFrom(v.from, v.to)) return null;
  const h = (d: DayTime | null) => (d ? hoursFrom(v.from, d) : 0);
  let prevailing = taf.cond;
  const temporary: TafGroup[] = [];
  for (const g of taf.taf.groups) {
    if (g.type === "BASE") prevailing = g.cond;
    else if (g.type === "FM" && h(g.from) <= at) prevailing = g.cond;
    // A BECMG change may happen any time in its period; treat it as done once the period starts.
    else if (g.type === "BECMG" && h(g.from) <= at) prevailing = g.cond;
    else if ((g.type === "TEMPO" || g.type === "PROB") && h(g.from) <= at && at < h(g.to)) temporary.push(g);
  }
  const rank = (c: Conditions) => (c.category ? CAT_RANK[c.category] : -1);
  const worst = temporary.reduce((w, g) => (rank(g.cond) > rank(w) ? g.cond : w), prevailing);
  return { prevailing, temporary, worst };
}
