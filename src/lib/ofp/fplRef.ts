/**
 * Quick-reference data and helpers for reading an ICAO flight plan (FPL): operators and
 * aircraft types for badges, short labels for equipment codes, airway types, and item 15
 * split into legs (SID, airways / directs, STAR) with speed / level changes.
 */

/** ICAO operator designator → airline and its radio callsign (telephony). Common European carriers. */
export const OPERATORS: Record<string, { name: string; call: string }> = {
  EZY: { name: "easyJet", call: "EASY" },
  EJU: { name: "easyJet Europe", call: "ALPINE" },
  EZS: { name: "easyJet Switzerland", call: "TOPSWISS" },
  RYR: { name: "Ryanair", call: "RYANAIR" },
  RUK: { name: "Ryanair UK", call: "BLUE MAX" },
  BAW: { name: "British Airways", call: "SPEEDBIRD" },
  SHT: { name: "British Airways (UK domestic)", call: "SHUTTLE" },
  VIR: { name: "Virgin Atlantic", call: "VIRGIN" },
  EXS: { name: "Jet2", call: "CHANNEX" },
  TOM: { name: "TUI Airways", call: "TOMSON" },
  DLH: { name: "Lufthansa", call: "LUFTHANSA" },
  EWG: { name: "Eurowings", call: "EUROWINGS" },
  AFR: { name: "Air France", call: "AIRFRANS" },
  KLM: { name: "KLM", call: "KLM" },
  TRA: { name: "Transavia", call: "TRANSAVIA" },
  IBE: { name: "Iberia", call: "IBERIA" },
  VLG: { name: "Vueling", call: "VUELING" },
  TAP: { name: "TAP Air Portugal", call: "AIR PORTUGAL" },
  SWR: { name: "Swiss", call: "SWISS" },
  AUA: { name: "Austrian", call: "AUSTRIAN" },
  SAS: { name: "SAS", call: "SCANDINAVIAN" },
  NAX: { name: "Norwegian", call: "NOR SHUTTLE" },
  WZZ: { name: "Wizz Air", call: "WIZZ AIR" },
  ITY: { name: "ITA Airways", call: "ITARROW" },
  THY: { name: "Turkish Airlines", call: "TURKISH" },
  UAE: { name: "Emirates", call: "EMIRATES" },
  QTR: { name: "Qatar Airways", call: "QATARI" },
  EIN: { name: "Aer Lingus", call: "SHAMROCK" },
  FIN: { name: "Finnair", call: "FINNAIR" },
  BEL: { name: "Brussels Airlines", call: "BEELINE" },
  LOT: { name: "LOT Polish Airlines", call: "POLLOT" },
};

/** ICAO aircraft type designator → name. */
export const AIRCRAFT: Record<string, string> = {
  A20N: "Airbus A320neo",
  A21N: "Airbus A321neo",
  A19N: "Airbus A319neo",
  A318: "Airbus A318",
  A319: "Airbus A319",
  A320: "Airbus A320",
  A321: "Airbus A321",
  A332: "Airbus A330-200",
  A333: "Airbus A330-300",
  A339: "Airbus A330-900neo",
  A359: "Airbus A350-900",
  A35K: "Airbus A350-1000",
  A388: "Airbus A380-800",
  BCS1: "Airbus A220-100",
  BCS3: "Airbus A220-300",
  B737: "Boeing 737-700",
  B738: "Boeing 737-800",
  B739: "Boeing 737-900",
  B38M: "Boeing 737 MAX 8",
  B39M: "Boeing 737 MAX 9",
  B752: "Boeing 757-200",
  B763: "Boeing 767-300",
  B772: "Boeing 777-200",
  B77W: "Boeing 777-300ER",
  B788: "Boeing 787-8",
  B789: "Boeing 787-9",
  E190: "Embraer E190",
  E195: "Embraer E195",
  E75L: "Embraer E175",
  CRJ9: "Bombardier CRJ900",
  AT76: "ATR 72-600",
  DH8D: "De Havilland Dash 8-400",
};

/** Short badge labels for item 10 codes (the long meaning stays in the tooltip). */
export const EQUIP_SHORT: Record<string, string> = {
  S: "Standard",
  N: "None",
  A: "GBAS",
  B: "LPV",
  C: "LORAN C",
  D: "DME",
  E1: "FMC WPR ACARS",
  E2: "D-FIS ACARS",
  E3: "PDC ACARS",
  F: "ADF",
  G: "GNSS",
  H: "HF RTF",
  I: "Inertial",
  J1: "CPDLC ATN",
  J2: "CPDLC HFDL",
  J3: "CPDLC VDL A",
  J4: "CPDLC VDL 2",
  J5: "CPDLC SATCOM",
  J6: "CPDLC MTSAT",
  J7: "CPDLC Iridium",
  K: "MLS",
  L: "ILS",
  M1: "SATVOICE INMARSAT",
  M2: "SATVOICE MTSAT",
  M3: "SATVOICE Iridium",
  O: "VOR",
  R: "PBN approved",
  T: "TACAN",
  U: "UHF RTF",
  V: "VHF RTF",
  W: "RVSM",
  X: "MNPS",
  Y: "8.33 kHz",
  Z: "Other (item 18)",
};

export const SURV_SHORT: Record<string, string> = {
  N: "None",
  A: "Mode A",
  C: "Mode A/C",
  E: "Mode S + ADS-B ES",
  H: "Mode S + EHS",
  I: "Mode S (ID only)",
  L: "Mode S + ADS-B + EHS",
  P: "Mode S (alt only)",
  S: "Mode S",
  X: "Mode S (no ID/alt)",
  B1: "ADS-B out 1090",
  B2: "ADS-B in/out 1090",
  U1: "ADS-B out UAT",
  U2: "ADS-B in/out UAT",
  V1: "ADS-B out VDL 4",
  V2: "ADS-B in/out VDL 4",
  D1: "ADS-C FANS",
  G1: "ADS-C ATN",
};

/** What kind of ATS route an airway designator is (ICAO Annex 11, App. 1). */
export function airwayKind(a: string): string {
  if (a === "DCT") return "Direct: straight line between the two points";
  const upper = a.startsWith("U") && a.length > 2;
  const l = (upper ? a[1] : a[0]) ?? "";
  const kind = /[LMNP]/.test(l)
    ? "regional RNAV route"
    : /[QTYZ]/.test(l)
      ? "RNAV route"
      : /[ABGR]/.test(l)
        ? "regional ATS route (conventional, navaid-based)"
        : /[HJVW]/.test(l)
          ? "domestic ATS route (conventional)"
          : "ATS route";
  return `Airway ${a}: ${upper ? "upper-airspace " : ""}${kind}`;
}

/** "N0425F340" → { speed: "425 kt TAS", level: "FL340" }. */
export function speedLevel(s: string): { speed: string; level: string } | null {
  const m = s.match(/^([NKM])(\d{3,4})([FASM])(\d{3,4})$/);
  if (!m) return null;
  const speed = m[1] === "N" ? `${Number(m[2])} kt TAS` : m[1] === "K" ? `${Number(m[2])} km/h TAS` : `Mach .${m[2].slice(1)}`;
  const level =
    m[3] === "F" ? `FL${m[4]}` : m[3] === "A" ? `${Number(m[4]) * 100} ft` : m[3] === "S" ? `${Number(m[4]) * 10} m (metric level)` : `${Number(m[4]) * 10} m`;
  return { speed, level };
}

export interface RouteLeg {
  from: string;
  to: string;
  /** "SID", "STAR", "DCT" or the airway designator. */
  via: string;
  /** The SID / STAR name when via is SID / STAR. */
  proc: string | null;
  /** Speed / level change filed at the start of this leg. */
  change: { speed: string; level: string } | null;
}

const PROC = /^[A-Z]{2,5}\d[A-Z]$/;
const FIX = /^([A-Z]{2,5}|\d{2,4}[NS]\d{3,5}[EW])(?:\/([NKM]\d{3,4}[FASM]\d{3,4}))?$/;

/** Item 15 split into legs from departure to destination. */
export function routeLegs(item15: string, dep: string, dest: string): { initial: { speed: string; level: string } | null; legs: RouteLeg[] } {
  const toks = item15.trim().split(/\s+/);
  const initial = speedLevel(toks[0] ?? "");
  const body = initial ? toks.slice(1) : toks;
  const legs: RouteLeg[] = [];
  let i = 0;
  let cur = dep;
  let pendingVia = "DCT";
  let pendingProc: string | null = null;
  if (PROC.test(body[0] ?? "") && FIX.test(body[1] ?? "")) {
    pendingVia = "SID";
    pendingProc = body[0];
    i = 1;
  }
  let change: RouteLeg["change"] = null;
  for (; i < body.length; i++) {
    const t = body[i];
    const isLast = i === body.length - 1;
    if (isLast && PROC.test(t)) {
      legs.push({ from: cur, to: dest, via: "STAR", proc: t, change: null });
      cur = dest;
      break;
    }
    const f = t === "DCT" ? null : t.match(FIX);
    if (f) {
      legs.push({ from: cur, to: f[1], via: pendingVia, proc: pendingProc, change });
      change = f[2] ? speedLevel(f[2]) : null;
      cur = f[1];
      pendingVia = "DCT";
      pendingProc = null;
      continue;
    }
    pendingVia = t; // airway or DCT
  }
  if (cur !== dest) legs.push({ from: cur, to: dest, via: "DCT", proc: null, change });
  return { initial, legs };
}

/** Radio navaid type from its frequency: 108–117.95 MHz VOR (often with DME), 190–1750 kHz NDB. */
export function navaidKind(freq: string): { kind: "VOR" | "NDB" | "?"; unit: string } {
  const f = Number(freq);
  if (f >= 108 && f <= 117.95) return { kind: "VOR", unit: "MHz" };
  if (f >= 190 && f <= 1750) return { kind: "NDB", unit: "kHz" };
  return { kind: "?", unit: "" };
}
