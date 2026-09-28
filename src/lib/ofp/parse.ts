import type {
  AltRoute,
  AtcFpl,
  Fuel,
  FuelRow,
  Header,
  KeyedRow,
  LandingGrid,
  LogPoint,
  Notam,
  NotamBulletin,
  NotamGroup,
  OFP,
  OpImpact,
  Table,
  TimeRow,
  Tlr,
  WeightRow,
  WindStation,
  Wx,
  WxAirport,
} from "./types";

type Lines = string[];

const FOOTER = /-\s*Not for real world navigation\s*-/i;
const PAGE_NO = /^\s*Page\s+\d+\s*$/;
const DASHES = /^-{8,}\s*$/;

/* ---------- small helpers ---------- */

const num = (s: string | null | undefined): number | null => {
  if (s == null) return null;
  const t = s.trim();
  if (!/^[-+]?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
};

const orNull = (s: string | null | undefined): string | null => {
  if (s == null) return null;
  const t = s.trim();
  return t.length ? t : null;
};

function match(lines: Lines, re: RegExp): RegExpMatchArray | null {
  for (const l of lines) {
    const m = l.match(re);
    if (m) return m;
  }
  return null;
}

interface Token {
  text: string;
  start: number;
  end: number;
}

function tokens(line: string, from = 0): Token[] {
  const out: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index < from) continue;
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length - 1 });
  }
  return out;
}

/** Assigns right-aligned tokens to the nearest column anchor (anchor = last char column). */
function columns(line: string, anchors: Record<string, number>, from: number): Record<string, string> {
  const out: Record<string, string> = {};
  const entries = Object.entries(anchors);
  for (const t of tokens(line, from)) {
    let best: string | null = null;
    let bestD = Infinity;
    for (const [k, col] of entries) {
      const d = Math.abs(col - t.end);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    if (best && bestD <= 3) out[best] = out[best] ? `${out[best]} ${t.text}` : t.text;
  }
  return out;
}

/** Splits lines into chunks at lines matching `re`; returns [heading, body] pairs. */
function splitBy(lines: Lines, re: RegExp): { head: string; body: Lines }[] {
  const out: { head: string; body: Lines }[] = [];
  let cur: { head: string; body: Lines } | null = null;
  for (const l of lines) {
    const m = l.match(re);
    if (m) {
      cur = { head: (m[1] ?? l).trim(), body: [] };
      out.push(cur);
    } else if (cur) cur.body.push(l);
  }
  return out;
}

const trimBlankEdges = (ls: Lines): Lines => {
  let a = 0;
  let b = ls.length;
  while (a < b && !ls[a].trim()) a++;
  while (b > a && !ls[b - 1].trim()) b--;
  return ls.slice(a, b);
};

function between(lines: Lines, start: RegExp, end: RegExp | null, include = false): Lines {
  const i = lines.findIndex((l) => start.test(l));
  if (i < 0) return [];
  const rest = lines.slice(include ? i : i + 1);
  if (!end) return rest;
  const j = rest.findIndex((l, k) => (include ? k > 0 : true) && end.test(l));
  return j < 0 ? rest : rest.slice(0, j);
}

export function coordToDeg(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/^([NSEW])(\d{2,3})(\d{2}(?:\.\d+)?)$/);
  if (!m) return null;
  const v = Number(m[2]) + Number(m[3]) / 60;
  return m[1] === "S" || m[1] === "W" ? -v : v;
}

/* ---------- page cleanup ---------- */

function cleanPages(pages: { page: number; lines: Lines }[]) {
  const titleLine =
    pages[0]?.lines.slice(0, 3).find((l) => l.trim() && !PAGE_NO.test(l) && !/^\[/.test(l.trim())) ?? "";
  const title = titleLine.replace(/Page\s+\d+\s*$/, "").trim();
  const cleaned = pages.map((p) => {
    const lines = p.lines.filter((l, idx) => {
      const t = l.trim();
      if (FOOTER.test(l)) return false;
      if (PAGE_NO.test(l)) return false;
      if (idx < 3 && title && t.replace(/\s*Page\s+\d+$/, "") === title) return false;
      if (/^\d{1,3}$/.test(t) && Number(t) === p.page) return false;
      return true;
    });
    return { page: p.page, lines };
  });
  const chartPages = cleaned.filter((p) => p.lines.every((l) => !l.trim())).map((p) => p.page);
  return { title: title || null, cleaned, chartPages };
}

/* ---------- OFP page 1 ---------- */

function parseHeader(block: Lines, title: string | null): Header {
  const l1 = match(block, /^(\S+)\s+(\d{2}[A-Z]{3}\d{4})\s+([A-Z]{4})-([A-Z]{4})\s+(\S+)\s+(\S+)\s+RELEASE\s+(\d{4})\s+(\S+)/);
  const l2 = match(block, /^OFP\s+(\d+)\s+(.+)$/);
  const wx = match(block, /WX\s+PROG\s+([\d ]+?)\s{2,}OBS\s+([\d ]+)$/);
  const atc = match(block, /ATC C\/S\s+(\S+)\s+([A-Z]{4})\/([A-Z]{3})\s+([A-Z]{4})\/([A-Z]{3})\s+CRZ SYS\s+(\S*?)\s*(CI\s*\S+)?\s*$/);
  const tl = match(block, /^(\d{2}[A-Z]{3}\d{4})\s+(\S+)\s+(\d{4})\/(\d{4})\s+(\d{4})\/(\d{4})/);
  const ac = match(block, /^(\S.*?\/\s*\S+)\s{2,}STA\s+(\d{4})/);
  const ctot = match(block, /CTOT:(\S+)/);
  const g = (re: RegExp) => match(block, re)?.[1] ?? null;
  const w = (kind: "MAXIMUM" | "ESTIMATED") =>
    match(block, new RegExp(`^${kind}\\s+TOW\\s+(\\d+)\\s+LAW\\s+(\\d+)\\s+ZFW\\s+(\\d+)`));
  const max = w("MAXIMUM");
  const est = w("ESTIMATED");
  const ff = match(block, /AVG FF\s+(KGS|LBS)\/HR\s+(\d+)/);
  const steps = g(/^FL STEPS\s+(\S+)/);
  const flSteps: Header["flSteps"] = [];
  if (steps) {
    const parts = steps.split("/").filter(Boolean);
    for (let i = 0; i + 1 < parts.length; i += 2) flSteps.push({ fix: parts[i], fl: parts[i + 1] });
  }
  const ci = atc?.[7]?.replace(/^CI\s*/, "") ?? null;
  return {
    title,
    flightNo: l1?.[1] ?? null,
    date: l1?.[2] ?? null,
    dep: l1?.[3] ?? null,
    arr: l1?.[4] ?? null,
    acType: l1?.[5] ?? null,
    reg: l1?.[6] ?? null,
    releaseTime: l1?.[7] ?? null,
    releaseDate: l1?.[8] ?? null,
    ofpNo: l2?.[1] ?? null,
    routeName: l2?.[2]?.trim() ?? null,
    wxProg: wx?.[1]?.trim().split(/\s+/) ?? [],
    wxObs: wx?.[2]?.trim().split(/\s+/) ?? [],
    atcCallsign: atc?.[1] ?? null,
    depIata: atc?.[3] ?? null,
    arrIata: atc?.[5] ?? null,
    crzSys: orNull(atc?.[6]),
    costIndex: ci,
    flightDate: tl?.[1] ?? null,
    outTime: tl?.[3] ?? null,
    offTime: tl?.[4] ?? null,
    onTime: tl?.[5] ?? null,
    inTime: tl?.[6] ?? null,
    sta: ac?.[2] ?? null,
    ctot: ctot?.[1] ?? null,
    aircraft: ac?.[1]?.trim() ?? null,
    gndDist: num(g(/GND DIST\s+(\d+)/)),
    airDist: num(g(/AIR DIST\s+(\d+)/)),
    gcDist: num(g(/G\/C DIST\s+(\d+)/)),
    avgWind: g(/AVG WIND\s+(\d{3}\/\d{3})/),
    avgWc: g(/AVG W\/C\s+([PM]\d+)/),
    avgIsa: g(/AVG ISA\s+([PM]\d+)/),
    avgFf: num(ff?.[2]),
    unit: (ff?.[1] as "KGS" | "LBS") ?? "KGS",
    fuelBias: g(/FUEL BIAS\s+(\S+)/),
    maxTow: num(max?.[1]),
    maxLaw: num(max?.[2]),
    maxZfw: num(max?.[3]),
    estTow: num(est?.[1]),
    estLaw: num(est?.[2]),
    estZfw: num(est?.[3]),
    altn: g(/^ALTN\s+([A-Z]{4})/),
    tkofAltn: g(/TKOF ALTN\s+(\S+)/),
    flSteps,
    dispRmks: g(/^DISP RMKS\s+(.+)$/)?.trim() ?? null,
  };
}

function parseFuel(block: Lines): Fuel {
  const table = between(block, /^FUEL\s+ARPT\s+FUEL\s+TIME/, /^FMC INFO/);
  const rows: FuelRow[] = [];
  let picExtra: string | null = null;
  let totalFuel: string | null = null;
  let reason: string | null = null;
  for (const l of table) {
    if (!l.trim() || DASHES.test(l)) continue;
    const r = l.match(/^REASON FOR PIC EXTRA\s+(.*)$/);
    if (r) {
      reason = r[1].trim();
      continue;
    }
    const pe = l.match(/^(PIC EXTRA|TOTAL FUEL)\s+(\S+)/);
    if (pe) {
      if (pe[1] === "PIC EXTRA") picExtra = pe[2];
      else totalFuel = pe[2];
      continue;
    }
    const m = l.match(/^(.+?)\s{2,}(?:([A-Z]{3})\s{2,})?(\d+)(?:\s+(\d{4}))?\s*$/);
    if (m) rows.push({ label: m[1].trim(), arpt: m[2] ?? null, fuel: num(m[3]), time: m[4] ?? null });
  }
  const fmc = between(block, /^FMC INFO/, DASHES)
    .map((l) => l.match(/^(.+?)\s{2,}(\d+)\s*$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ label: m[1].trim(), value: num(m[2]) }));
  const tank = match(block, /^(.*TANKERING.*)$/)?.[1]?.trim() ?? null;
  const confIdx = block.findIndex((l) => /^I HEREWITH CONFIRM/.test(l));
  const conf: string[] = [];
  if (confIdx >= 0)
    for (let i = confIdx; i < block.length && !/^DISPATCHER:/.test(block[i]); i++) conf.push(block[i].trim());
  const disp = match(block, /^DISPATCHER:\s*(.+?)\s{2,}PIC NAME:\s*(.+)$/);
  const tel = match(block, /^TEL:\s*(.+?)\s{2,}PIC SIGNATURE:\s*(.+)$/);
  return {
    rows,
    picExtra,
    totalFuel,
    reasonPicExtra: reason,
    fmc,
    tankering: tank,
    confirmation: conf.length ? conf.join(" ") : null,
    dispatcher: disp?.[1]?.trim() ?? null,
    picName: disp?.[2]?.trim() ?? null,
    tel: tel?.[1]?.trim() ?? null,
    picSignature: tel?.[2]?.trim() ?? null,
  };
}

function parseAlternates(block: Lines): { finres: number | null; alts: AltRoute[] } {
  const finres = num(match(block, /ALTERNATE ROUTE TO:.*FINRES\s+(\d+)/)?.[1]);
  const body = between(block, /^APT\s+TRK\s+DST/, /^MEL\/CDL/).filter((l) => !DASHES.test(l) && l.trim());
  const alts: AltRoute[] = [];
  for (const l of body) {
    const m = l.match(/^([A-Z]{4})(?:\/(\S+))?\s+(\d{3})\s+(\d+)\s+(.*?)\s+(\d{3})\s+([PM]\d{3})\s+(\d{4})\s+(\d+)\s*$/);
    if (m) {
      alts.push({ apt: m[1], rwy: m[2] ?? null, trk: m[3], dst: num(m[4]), via: m[5].trim(), fl: m[6], wc: m[7], time: m[8], fuel: num(m[9]) });
    } else if (alts.length) {
      alts[alts.length - 1].via += " " + l.trim();
    }
  }
  return { finres, alts };
}

function sectionAfter(block: Lines, head: RegExp): Lines {
  return trimBlankEdges(between(block, head, DASHES)).map((l) => l.trim());
}

function parseOpImpacts(block: Lines): OpImpact[] {
  const out: OpImpact[] = [];
  for (const l of block) {
    const m = l.match(/^((?:WEIGHT|FL|SPD) CHANGE)\s+(.+?)\s{2,}TRIP\s+([PM])\s+(\d+)\s+(\S+)\s+TIME\s+([PM])\s+(\d{4})/);
    if (m) out.push({ kind: m[1], change: m[2].trim(), tripSign: m[3], trip: num(m[4]), tripUnit: m[5], timeSign: m[6], time: m[7] });
  }
  return out;
}

function parseTimes(block: Lines): TimeRow[] {
  const out: TimeRow[] = [];
  for (const l of between(block, /^\s+ESTIMATED\s+SKED\s+ACTUAL/, DASHES)) {
    const m = l.match(/^(OUT|OFF|ON|IN|BLOCK TIME)\s+(\S+)\s+(\S+)\s+(\S+)/);
    if (m) out.push({ label: m[1], est: m[2], sked: m[3], actual: m[4] });
  }
  return out;
}

function parseWeights(block: Lines): WeightRow[] {
  const head = block.find((l) => /^\s+EST\s+MAX\s+ACTUAL/.test(l));
  if (!head) return [];
  const anchors = {
    est: head.indexOf("EST") + 2,
    max: head.indexOf("MAX") + 2,
    actual: head.indexOf("ACTUAL") + 5,
  };
  const out: WeightRow[] = [];
  for (const l of between(block, /^\s+EST\s+MAX\s+ACTUAL/, DASHES)) {
    if (!l.trim()) continue;
    const label = l.slice(0, 15).trim();
    let rest = l.slice(15);
    let note: string | null = null;
    const pe = rest.match(/\s{3,}(POSS EXTRA.*)$/);
    if (pe) {
      note = pe[1].trim();
      rest = rest.slice(0, pe.index);
    }
    const ldg = rest.match(/\s(LDG)(\.+)/);
    if (ldg) {
      note = "LDG";
      rest = rest.replace(/LDG(\.+)/, (_, d: string) => "   " + d);
    }
    const c = columns(" ".repeat(15) + rest, anchors, 15);
    // ACTUAL column is a blank to fill – treat dots as empty.
    const actual = c.actual && !/^\.+$/.test(c.actual) ? c.actual : null;
    out.push({ label, est: c.est ?? null, max: c.max ?? null, actual, note });
  }
  return out;
}

/* ---------- Flight log ---------- */

const L1 = { fl: 31, imt: 37, mn: 42, wind: 50, oat: 55, efob: 61, pbrn: 67 };
const L2 = { lat: 18, eet: 23, eto: 27, mora: 31, itt: 37, tas: 42, comp: 50, tdv: 55 };
const L3 = { long: 18, ttlt: 23, ato: 27, dis: 31, rdis: 37, gs: 42, shr: 50, trp: 55, afob: 61, abrn: 67 };
const LAT_LINE = /^.{0,12}\s[NS]\d{4}\.\d\b/;
const LON_LINE = /^.{0,11}[EW]\d{5}\.\d\b/;
const FREQ_LINE = /^\d{3}\.\d{1,3}\s*$/;

function parseLog(lines: Lines): LogPoint[] {
  const body = lines.filter(
    (l) =>
      !DASHES.test(l) &&
      !/^(AWY|POSITION|IDENT|FREQ)\s/.test(l) &&
      l.trim() !== "FREQ" &&
      !/FLIGHT LOG|^-{5,}$/.test(l.trim()) &&
      !/^MOST CRITICAL MORA/.test(l),
  );
  const pts: LogPoint[] = [];
  const dotted = (v?: string) => (v && !/^\.+$/.test(v) ? v : null);
  for (let i = 0; i < body.length; i++) {
    if (!LAT_LINE.test(body[i]) || LON_LINE.test(body[i])) continue;
    const l2 = body[i];
    const l3 = body[i + 1] && LON_LINE.test(body[i + 1]) ? body[i + 1] : "";
    const prev = body[i - 1] ?? "";
    const position = l2.slice(0, 11).trim();
    const isFir = position.startsWith("-");
    const hasL1 = !isFir && prev && !LAT_LINE.test(prev) && !LON_LINE.test(prev) && !FREQ_LINE.test(prev);
    const c1 = hasL1 ? columns(prev, L1, 20) : {};
    const awy = hasL1 ? orNull(prev.slice(0, 28)) : null;
    const c2 = columns(l2, L2, 11);
    const c3 = l3 ? columns(l3, L3, 11) : {};
    const next = body[i + 2] ?? "";
    const freq = FREQ_LINE.test(next) ? next.trim() : null;
    const lat = c2.lat ?? null;
    const lon = c3.long ?? null;
    pts.push({
      kind: isFir ? "fir" : "wpt",
      awy,
      fl: c1.fl ?? null,
      imt: c1.imt ?? null,
      mn: c1.mn ?? null,
      wind: c1.wind ?? null,
      oat: c1.oat ?? null,
      efob: c1.efob ?? null,
      pbrn: c1.pbrn ?? null,
      position: isFir ? position.replace(/^-/, "") : position,
      lat,
      eet: c2.eet ?? null,
      eto: dotted(c2.eto),
      mora: c2.mora ?? null,
      itt: c2.itt ?? null,
      tas: c2.tas ?? null,
      comp: c2.comp ?? null,
      tdv: c2.tdv ?? null,
      ident: orNull(l3.slice(0, 11)),
      long: lon,
      ttlt: c3.ttlt ?? null,
      ato: dotted(c3.ato),
      dis: c3.dis ?? null,
      rdis: c3.rdis ?? null,
      gs: c3.gs ?? null,
      shr: c3.shr ?? null,
      trp: c3.trp ?? null,
      afob: dotted(c3.afob),
      abrn: dotted(c3.abrn),
      freq,
      firName: isFir ? orNull(prev) : null,
      latDeg: coordToDeg(lat),
      lonDeg: coordToDeg(lon),
    });
  }
  return pts;
}

function parseWinds(lines: Lines): WindStation[] {
  const body = between(lines, /WIND INFORMATION/, DASHES).filter((l) => l.trim() && !/^-+$/.test(l.trim()));
  const out: WindStation[] = [];
  let group: WindStation[] = [];
  const re = /(\d{3})\s(\d{3})\/(\d{3})\s([+-]\d{2})/g;
  for (const l of body) {
    const data = [...l.matchAll(re)];
    if (data.length === 0) {
      group = l
        .trim()
        .split(/\s{2,}/)
        .map((name) => ({ name, levels: [] }));
      out.push(...group);
    } else {
      data.forEach((m, k) => {
        group[k]?.levels.push({ fl: m[1], dir: Number(m[2]), spd: Number(m[3]), temp: Number(m[4]) });
      });
    }
  }
  return out;
}

/* ---------- ATC flight plan ---------- */

const FPL_ITEMS = ["7", "8", "9", "10", "13", "15", "16", "18", "19"];
const FPL_LABELS: Record<string, string> = {
  "7": "Aircraft identification",
  "8": "Flight rules / type of flight",
  "9": "Type of aircraft / wake turbulence",
  "10": "Equipment / surveillance",
  "13": "Departure aerodrome / time",
  "15": "Cruising speed / level / route",
  "16": "Destination / total EET / alternates",
  "18": "Other information",
  "19": "Supplementary information",
};

function parseFpl(lines: Lines): AtcFpl {
  const body = trimBlankEdges(between(lines, /ICAO FLIGHT PLAN/, null)).filter((l) => !/^-+$/.test(l.trim()));
  const addresses = body.find((l) => /^FF\s/.test(l))?.trim() ?? null;
  const originator = body.find((l) => /^\d{6}\s+\S+$/.test(l.trim()))?.trim() ?? null;
  const start = body.findIndex((l) => l.trim().startsWith("(FPL"));
  const text = start >= 0 ? body.slice(start).map((l) => l.replace(/\s+$/, "")) : [];
  // Continuation lines start with a space; each new ICAO item starts with "-".
  const flat = text.join("").replace(/^\(/, "").replace(/\)\s*$/, "");
  const parts = flat.split("-");
  const items: AtcFpl["items"] = [];
  // parts[0] is "FPL"; item 18 onward may legitimately contain dashes.
  const body18 = parts.slice(8).join("-");
  [...parts.slice(1, 8), ...(body18 ? [body18] : [])].forEach((p, k) => {
    const id = FPL_ITEMS[k] ?? String(k);
    items.push({ item: id, label: FPL_LABELS[id] ?? "Item", value: p.replace(/\s+/g, " ").trim() });
  });
  const i18 = items.find((i) => i.item === "18")?.value ?? "";
  const item18 = [...i18.matchAll(/([A-Z]+)\/(.*?)(?=\s[A-Z]+\/|$)/g)].map((m) => ({ key: m[1], value: m[2].trim() }));
  return { addresses, originator, text, items, item18 };
}

/* ---------- Runway analysis ---------- */

function kv(head: string, val: string): KeyedRow | null {
  const h = head.trim().split(/\s+/);
  const v = val.trim().split(/\s+/);
  if (v.length !== h.length) return null;
  return Object.fromEntries(h.map((k, i) => [k, v[i]]));
}

function parseTlr(lines: Lines): Tlr {
  const header = lines.filter((l) => /^(TAKEOFF AND LANDING REPORT|TLR-|A\/C )/.test(l)).map((l) => l.trim());
  const footer = lines.find((l) => /^END TAKEOFF AND LANDING REPORT/.test(l))?.trim() ?? null;
  const toIdx = lines.findIndex((l) => /\/\/\/ TAKEOFF DATA/.test(l));
  const ldIdx = lines.findIndex((l) => /\/\/\/ LANDING DATA/.test(l));
  const endIdx = lines.findIndex((l) => /^END TAKEOFF AND LANDING/.test(l));
  const to = toIdx >= 0 ? lines.slice(toIdx + 1, ldIdx >= 0 ? ldIdx : undefined) : [];
  const ld = ldIdx >= 0 ? lines.slice(ldIdx + 1, endIdx >= 0 ? endIdx : undefined) : [];

  const planned = (blk: Lines) => {
    const hi = blk.findIndex((l) => /^APT\s+PRWY/.test(l));
    return hi >= 0 && blk[hi + 1] ? kv(blk[hi], blk[hi + 1]) : null;
  };
  const rmks = (blk: Lines) => {
    const i = blk.findIndex((l) => /^RMKS\s/.test(l));
    if (i < 0) return [];
    const out = [blk[i].replace(/^RMKS\s+/, "").trim()];
    for (let k = i + 1; k < blk.length && /^\s{3,}\S/.test(blk[k]); k++) out.push(blk[k].trim());
    return out;
  };
  const tables = (blk: Lines): Table[] => {
    const out: Table[] = [];
    let cur: Table | null = null;
    for (const l of blk) {
      const t = l.match(/^-{3,}\s*(.+?)\s*-{3,}\s*$/);
      if (t && !/^[-\s]+$/.test(t[1])) {
        cur = { title: t[1], columns: [], rows: [] };
        out.push(cur);
        continue;
      }
      if (!cur) continue;
      if (/^(RWY|OAT|DRY RWY|\s+ACTUAL)/.test(l) && cur.columns.length === 0 && /^RWY\s/.test(l)) {
        cur.columns = l.trim().replace("ACARS LENGTH", "LENGTH").split(/\s+/);
        continue;
      }
      if (/^(\d{2}[LRC]?|[0-3]\d[LRC]?)\s/.test(l) && cur.columns.length) {
        const ci = cur.columns.indexOf("CONFIG");
        if (ci >= 0) {
          const m = l.match(/^(\S+)\s+(\d+)\s+(\d+)\s+(.+?)\s+(\d)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s*$/);
          if (m) cur.rows.push(m.slice(1));
        } else {
          const m = l.match(/^(\S+)\s+(\d+)\s+(\d+)\s*(.*)$/);
          if (m) cur.rows.push([m[1], m[2], m[3], m[4].trim()]);
        }
      }
    }
    return out.filter((t) => t.rows.length);
  };

  let grid: LandingGrid | null = null;
  const gi = ld.findIndex((l) => /FLAPS .* ENROUTE ICING|FLAPS FULL - PACKS/.test(l));
  if (gi >= 0) {
    const title = ld[gi].replace(/-{3,}/g, "").trim();
    const sub = ld[gi + 1]?.trim() ?? null;
    const runways: LandingGrid["runways"] = [];
    let k = gi + 2;
    while (k < ld.length && !/^-{3,}\s*LANDING DISTANCE/.test(ld[k])) {
      const names = ld[k].trim().split(/\s+/);
      if (!names.length || !/^\d{2}/.test(names[0])) {
        k++;
        continue;
      }
      const lens = [...(ld[k + 1] ?? "").matchAll(/(\d+)\s+FT/g)].map((m) => m[1]);
      const group = names.map((rwy, n) => ({ rwy, length: lens[n] ?? null, cells: [] as LandingGrid["runways"][0]["cells"], hw: null as string | null, tw: null as string | null }));
      k += 2;
      while (k < ld.length && /^\s*(\/\s*)?\d+\s+\d/.test(ld[k])) {
        const m = ld[k].match(/^\s*(\/)?\s*(\d+)\s+(.*)$/);
        if (m) {
          const vals = m[3].trim().split(/\s+/);
          group.forEach((g, n) => g.cells.push({ oat: m[2], planned: !!m[1], value: vals[n] ?? "" }));
        }
        k++;
      }
      for (const kind of ["HW", "TW"] as const) {
        if (ld[k]?.startsWith(kind)) {
          const vals = [...ld[k].replace(/^\S+/, "").matchAll(/(-?\d+)\/\s*(-?\d+)/g)].map((m) => `${m[1]}/${m[2]}`);
          group.forEach((g, n) => (g[kind === "HW" ? "hw" : "tw"] = vals[n] ?? null));
          k++;
        }
      }
      runways.push(...group);
    }
    grid = { title, subtitle: sub, runways };
  }

  let distance: Table | null = null;
  const di = ld.findIndex((l) => /^-{3,}\s*LANDING DISTANCE/.test(l));
  if (di >= 0) {
    const title = ld[di].replace(/-{3,}/g, "").trim();
    const rows: string[][] = [];
    for (const l of ld.slice(di + 1)) {
      const m = l.match(/^\s*(\/)?\s*(\d{4,5})\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/);
      if (m) rows.push([m[1] ? "/" : "", ...m.slice(2)]);
      const c = l.match(/^(HW\/KT|TW\/KT)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/);
      if (c) rows.push([c[1], "", "", c[2], c[3], c[4], c[5]]);
    }
    distance = { title, columns: ["", "LDW", "VREF", "ACTUAL DRY", "ACTUAL WET", "FACTORED DRY", "FACTORED WET"], rows };
  }

  const ldTables = gi >= 0 ? tables(ld.slice(0, gi)) : tables(ld);
  return {
    header,
    takeoff: { planned: planned(to), rmks: rmks(to), tables: tables(to) },
    landing: { planned: planned(ld), rmks: rmks(ld), tables: ldTables, grid, distance },
    footer,
  };
}

/* ---------- Weather ---------- */

function parseWx(lines: Lines): Wx {
  const header: string[] = [];
  const advisories: Wx["advisories"] = [];
  const airports: WxAirport[] = [];
  let role = "";
  let curAdv: Wx["advisories"][0] | null = null;
  let curApt: WxAirport | null = null;
  let lastKind: "metar" | "taf" | "other" = "other";
  let footer: string | null = null;
  for (const raw of lines) {
    const l = raw.replace(/\s+$/, "");
    if (!l.trim() || DASHES.test(l)) continue;
    if (/AIRPORTLIST ENDED/.test(l)) {
      footer = l.trim();
      continue;
    }
    const adv = l.match(/^((?:[A-Z][A-Za-z ]*)?(?:AIRMETs|SIGMETs)):\s*$/);
    if (adv) {
      curAdv = { title: adv[1], lines: [] };
      advisories.push(curAdv);
      curApt = null;
      continue;
    }
    const r = l.match(/^([A-Z][A-Za-z ]+):\s*$/);
    if (r) {
      role = r[1];
      curAdv = null;
      continue;
    }
    const apt = l.match(/^([A-Z]{4})\/([A-Z0-9]{3})?\s+(.+)$/);
    if (apt && role) {
      curApt = { role, icao: apt[1], iata: apt[2] ?? null, name: apt[3].trim(), metar: null, taf: [], other: [] };
      airports.push(curApt);
      continue;
    }
    if (curAdv && !role) {
      curAdv.lines.push(l.trim());
      continue;
    }
    if (curApt) {
      const t = l.trim();
      if (/^SA\s/.test(t)) {
        curApt.metar = t.replace(/^SA\s+/, "");
        lastKind = "metar";
      } else if (/^FT\s/.test(t)) {
        curApt.taf.push(t.replace(/^FT\s+/, ""));
        lastKind = "taf";
      } else if (lastKind === "taf") curApt.taf.push(t);
      else if (lastKind === "metar" && curApt.metar) curApt.metar += " " + t;
      else curApt.other.push(t);
      continue;
    }
    header.push(l.trim());
  }
  return { header, advisories, airports, footer };
}

/* ---------- NOTAM bulletins ---------- */

const NOTAM_ID = /^([A-Z]{1,3}\d{2,4}\/\d{2})(?:\s+VALID:\s*(.+))?\s*$/;

function parseNotams(lines: Lines): NotamBulletin {
  const header: string[] = [];
  const groups: NotamGroup[] = [];
  let section = "";
  let location: string | null = null;
  let locationName: string | null = null;
  let category: string | null = null;
  let group: NotamGroup | null = null;
  let notam: Notam | null = null;
  let footer: string | null = null;
  const startGroup = () => {
    group = { section, location, locationName, category, notams: [], notes: [] };
    groups.push(group);
    notam = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].replace(/\s+$/, "");
    const t = l.trim();
    if (!t) continue;
    if (/^=+\s*END OF .*=+$/.test(t)) {
      footer = t.replace(/=+/g, "").trim();
      continue;
    }
    if (/^={4,}$/.test(t)) {
      if (lines[i + 2] && /^={4,}$/.test(lines[i + 2].trim())) {
        section = lines[i + 1].trim();
        location = locationName = category = null;
        group = null;
        i += 2;
      }
      continue;
    }
    if (/^-{4,}$/.test(t)) continue;
    const cat = t.match(/^\++\s*(.+?)\s*\++$/);
    if (cat) {
      category = cat[1];
      startGroup();
      continue;
    }
    const loc = l.match(/^([A-Z]{4}(?:\/[A-Z0-9]{3})?)\s{3,}(\S.+)$/);
    if (loc && section && lines[i + 1] && /^-{4,}$/.test(lines[i + 1].trim())) {
      location = loc[1];
      locationName = loc[2].trim();
      category = null;
      startGroup();
      continue;
    }
    const id = t.match(NOTAM_ID);
    if (id && !/^\s/.test(l)) {
      if (!group) startGroup();
      notam = { id: id[1], valid: id[2] ?? null, lines: [] };
      group!.notams.push(notam);
      continue;
    }
    if (!section) {
      header.push(t);
      continue;
    }
    if (notam && /^\s/.test(l)) {
      (notam as Notam).lines.push(t);
      continue;
    }
    if (!group) startGroup();
    group!.notes.push(t);
  }
  return { header, groups, footer };
}

/* ---------- top level ---------- */

export function parseOfp(source: string, pages: { page: number; lines: Lines }[]): OFP {
  const { title, cleaned, chartPages } = cleanPages(pages);
  const all = cleaned.flatMap((p) => p.lines);
  const sections = splitBy(all, /^\[\s*(.+?)\s*\]\s*$/);
  const sec = (name: RegExp) => sections.find((s) => name.test(s.head))?.body ?? [];

  const ofp = sec(/^OFP$/);
  const p1End = ofp.findIndex((l) => /^ALTERNATE ROUTE TO:/.test(l));
  const page1 = p1End >= 0 ? ofp.slice(0, p1End) : ofp;
  const rest = p1End >= 0 ? ofp.slice(p1End) : [];
  const { finres, alts } = parseAlternates(rest);

  const routing = between(rest, /^ROUTING:/, DASHES);
  const routeId = routing.find((l) => /^ROUTE ID:/.test(l))?.replace(/^ROUTE ID:\s*/, "").trim() ?? null;
  const route = routing.filter((l) => !/^ROUTE ID:/.test(l)).map((l) => l.trim()).join(" ") || null;

  const logStart = rest.findIndex((l) => /^\s+FLIGHT LOG\s*$/.test(l));
  const windStart = rest.findIndex((l) => /WIND INFORMATION/.test(l));
  const logLines = logStart >= 0 ? rest.slice(logStart, windStart >= 0 ? windStart : undefined) : [];

  const rvsm = rest.find((l) => /^RVSM:/.test(l))?.trim() ?? null;
  const atis = trimBlankEdges(between(rest, /^ATIS:/, /^-{9}\s/)).map((l) => l.trim());
  const mel = between(rest, /^MEL\/CDL ITEMS/, /^-{20,}/)
    .filter((l) => !/^-+(\s+-+)*\s*$/.test(l) && l.trim())
    .map((l) => l.trim());
  const terrain = sectionAfter(rest, /TERRAIN CLEARANCE CHECK/).filter((l) => !/^-+$/.test(l));

  const endNote = all.find((l) => /End of Document/i.test(l))?.trim() ?? null;
  const addl = sec(/^Additional Info/)
    .filter((l) => l.trim() && !DASHES.test(l))
    .filter((l) => !/End of Document/.test(l))
    .map((l) => l.trim());

  const stripEnd = (ls: Lines) => ls.filter((l) => !/End of Document/.test(l));

  return {
    source,
    pageCount: pages.length,
    pages: cleaned,
    chartPages,
    header: parseHeader(page1, title),
    fuel: parseFuel(page1),
    alternates: alts,
    finresAltn: finres,
    mel,
    routeId,
    route,
    atcClearance: between(rest, /^DEPARTURE ATC CLEARANCE:/, DASHES).map((l) => l.trim()).filter((l) => l && l !== "."),
    opImpacts: parseOpImpacts(rest),
    atis: atis.filter((l) => l !== "."),
    rvsm,
    times: parseTimes(rest),
    weights: parseWeights(rest),
    terrain,
    criticalMora: rest.find((l) => /^MOST CRITICAL MORA/.test(l))?.trim() ?? null,
    log: parseLog(logLines),
    winds: parseWinds(rest),
    fpl: parseFpl(sec(/^ATC Flight Plan/)),
    additionalInfo: addl,
    tlr: parseTlr(sec(/^Runway Analysis/)),
    wx: parseWx(sec(/^Airport WX/)),
    notams: parseNotams(stripEnd(sec(/^NOTAM$/))),
    companyNotams: parseNotams(stripEnd(sec(/^Company NOTAM/))),
    endNote,
  };
}
