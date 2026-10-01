/**
 * ICAO airport code → ISO 3166-1 alpha-2 country, from the ICAO location-indicator
 * prefixes (Doc 7910). Longest prefix wins, so territories that share a region prefix
 * (e.g. Réunion under Madagascar's FM, Montenegro under Serbia's LY) resolve correctly.
 */
const PREFIX: Record<string, string> = {
  // Single-letter regions
  C: "CA", K: "US", Y: "AU", Z: "CN", U: "RU",

  // Europe
  BG: "GL", BI: "IS", BK: "XK",
  EB: "BE", ED: "DE", ET: "DE", EE: "EE", EF: "FI", EG: "GB", EH: "NL", EI: "IE", EK: "DK", EL: "LU",
  EN: "NO", EP: "PL", ES: "SE", EV: "LV", EY: "LT",
  LA: "AL", LB: "BG", LC: "CY", LD: "HR", LE: "ES", LF: "FR", LG: "GR", LH: "HU", LI: "IT", LJ: "SI",
  LK: "CZ", LL: "IL", LM: "MT", LN: "MC", LO: "AT", LP: "PT", LQ: "BA", LR: "RO", LS: "CH", LT: "TR",
  LU: "MD", LW: "MK", LX: "GI", LY: "RS", LYPG: "ME", LYTV: "ME", LYBR: "ME", LZ: "SK",
  UA: "KZ", UB: "AZ", UC: "KG", UD: "AM", UG: "GE", UK: "UA", UM: "BY",
  UTA: "TM", UTD: "TJ", UTK: "UZ", UTN: "UZ", UTS: "UZ", UTT: "UZ",

  // Africa
  DA: "DZ", DB: "BJ", DF: "BF", DG: "GH", DI: "CI", DN: "NG", DR: "NE", DT: "TN", DX: "TG",
  FA: "ZA", FB: "BW", FC: "CG", FD: "SZ", FE: "CF", FG: "GQ", FH: "SH", FI: "MU", FJ: "IO", FK: "CM",
  FL: "ZM", FM: "MG", FMC: "KM", FMCZ: "YT", FME: "RE", FN: "AO", FO: "GA", FP: "ST", FQ: "MZ",
  FS: "SC", FT: "TD", FV: "ZW", FW: "MW", FX: "LS", FY: "NA", FZ: "CD",
  GA: "ML", GB: "GM", GC: "ES", GE: "ES", GF: "SL", GG: "GW", GL: "LR", GM: "MA", GO: "SN", GQ: "MR",
  GS: "EH", GU: "GN", GV: "CV",
  HA: "ET", HB: "BI", HC: "SO", HD: "DJ", HE: "EG", HH: "ER", HJ: "SS", HK: "KE", HL: "LY",
  HR: "RW", HS: "SD", HT: "TZ", HU: "UG",

  // Middle East & Asia
  OA: "AF", OB: "BH", OE: "SA", OI: "IR", OJ: "JO", OK: "KW", OL: "LB", OM: "AE", OO: "OM",
  OP: "PK", OR: "IQ", OS: "SY", OT: "QA", OY: "YE",
  VA: "IN", VE: "IN", VI: "IN", VO: "IN", VC: "LK", VD: "KH", VG: "BD", VH: "HK", VL: "LA",
  VM: "MO", VN: "NP", VQ: "BT", VR: "MV", VT: "TH", VV: "VN", VY: "MM",
  WA: "ID", WI: "ID", WQ: "ID", WR: "ID", WB: "MY", WBSB: "BN", WM: "MY", WP: "TL", WS: "SG",
  RC: "TW", RJ: "JP", RO: "JP", RK: "KR", RP: "PH", ZK: "KP", ZM: "MN",

  // Oceania & Pacific
  NZ: "NZ", NC: "CK", NFF: "FJ", NFT: "TO", NG: "KI", NI: "NU", NL: "WF", NS: "WS", NSTU: "AS",
  NT: "PF", NV: "VU", NW: "NC", AG: "SB", AN: "NR", AY: "PG",
  PA: "US", PH: "US", PG: "GU", PK: "MH", PT: "FM", PTR: "PW", PL: "KI",

  // Americas & Caribbean
  MB: "TC", MD: "DO", MG: "GT", MH: "HN", MK: "JM", MM: "MX", MN: "NI", MP: "PA", MR: "CR",
  MS: "SV", MT: "HT", MU: "CU", MW: "KY", MY: "BS", MZ: "BZ",
  TA: "AG", TB: "BB", TD: "DM", TF: "GP", TFFF: "MQ", TFFJ: "BL", TFFG: "MF", TG: "GD",
  TI: "VI", TJ: "PR", TK: "KN", TL: "LC", TN: "CW", TNCA: "AW", TNCB: "BQ", TNCE: "BQ", TNCS: "BQ",
  TNCM: "SX", TQ: "AI", TR: "MS", TT: "TT", TU: "VG", TV: "VC", TX: "BM",
  SA: "AR", SB: "BR", SD: "BR", SI: "BR", SJ: "BR", SN: "BR", SS: "BR", SW: "BR",
  SC: "CL", SE: "EC", SF: "FK", SG: "PY", SK: "CO", SL: "BO", SM: "SR", SO: "GF", SP: "PE",
  SU: "UY", SV: "VE", SY: "GY",
};

/** ISO 3166 alpha-2 country for an ICAO airport code, or null if unknown. */
export function icaoCountry(icao: string | null | undefined): string | null {
  if (!icao || !/^[A-Z]{4}$/.test(icao)) return null;
  for (let n = 4; n >= 1; n--) {
    const hit = PREFIX[icao.slice(0, n)];
    if (hit) return hit;
  }
  return null;
}

/** Airports whose country alone tells only part of the story. */
const NOTES: Record<string, string> = {
  LFSB: "EuroAirport, on French soil; serves Basel (Switzerland), Mulhouse (France) and Freiburg (Germany)",
};

/** Country name for a tooltip, e.g. "France", plus any note for shared airports. */
export function countryLabel(icao: string, iso: string): string {
  let name = iso;
  try {
    name = new Intl.DisplayNames(["en-GB"], { type: "region" }).of(iso) ?? iso;
  } catch {
    /* keep the code */
  }
  return NOTES[icao] ? `${name} · ${NOTES[icao]}` : name;
}
