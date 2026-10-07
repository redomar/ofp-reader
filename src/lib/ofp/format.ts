/** Formatting and small derived-value helpers shared across sections. */

export const isBlank = (v: string | null | undefined) => v == null || v === "" || /^\.+[A-Z]?$/.test(v);

/** "0124" → minutes */
export function hhmmToMin(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = v.match(/^(\d{2})(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** minutes → "1h24" */
export function fmtDur(min: number | null | undefined): string | null {
  if (min == null || Number.isNaN(min)) return null;
  const sign = min < 0 ? "−" : "";
  const a = Math.abs(Math.round(min));
  const h = Math.floor(a / 60);
  const m = a % 60;
  return h ? `${sign}${h}h${String(m).padStart(2, "0")}` : `${sign}${m} min`;
}

/** "0124" → "01:24" */
export const fmtHhmm = (v: string | null | undefined) => (v && /^\d{4}$/.test(v) ? `${v.slice(0, 2)}:${v.slice(2)}` : (v ?? null));

export const fmtNum = (n: number | null | undefined, digits = 0) =>
  n == null || Number.isNaN(n) ? null : n.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** "P004" / "M008" → +4 / −8 */
export function signed(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = v.match(/^([PM])(\d+(?:\.\d+)?)$/);
  if (!m) return /^-?\d+$/.test(v) ? Number(v) : null;
  return (m[1] === "M" ? -1 : 1) * Number(m[2]);
}

export const fmtSigned = (n: number | null, unit = "") => (n == null ? null : `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}${unit}`);

/** Clock difference in minutes between two HHMM strings, wrapping midnight. */
export function clockDiff(from: string | null | undefined, to: string | null | undefined): number | null {
  const a = hhmmToMin(from);
  const b = hhmmToMin(to);
  if (a == null || b == null) return null;
  return (((b - a) % 1440) + 1440) % 1440;
}

/** "2200Z/0000L" → offset in hours (+2) */
export function utcOffset(v: string | null | undefined): number | null {
  const m = v?.match(/^(\d{4})Z\/(\d{4})L$/);
  if (!m) return null;
  let d = (hhmmToMin(m[2])! - hhmmToMin(m[1])!) / 60;
  if (d > 14) d -= 24;
  if (d < -12) d += 24;
  return d;
}

export const fmtOffset = (h: number | null) => (h == null ? null : `UTC${h >= 0 ? "+" : "−"}${Math.abs(h)}`);

/** "27SEP2026" → "Sun 27 Sep 2026" */
export function fmtDate(v: string | null | undefined): string | null {
  const m = v?.match(/^(\d{2})([A-Z]{3})(\d{2,4})$/);
  if (!m) return v ?? null;
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(Date.UTC(year, months.indexOf(m[2]), Number(m[1])));
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "GZONA" → "G-ZONA" for common registration prefixes */
export function fmtReg(v: string | null | undefined): string | null {
  if (!v) return null;
  const two = ["EI", "EC", "OE", "HB", "OY", "SE", "LN", "OH", "PH", "SP", "OK", "YR", "LZ", "HA", "SX", "CS", "TC", "VH", "ZS", "JA", "HL", "9H", "9A", "4X"];
  if (v.includes("-")) return v;
  const p2 = v.slice(0, 2);
  if (two.includes(p2)) return `${p2}-${v.slice(2)}`;
  if (/^[GFDIM]/.test(v)) return `${v[0]}-${v.slice(1)}`;
  return v;
}

/** Wind "267/016" → { dir, spd } */
export function parseWind(v: string | null | undefined): { dir: number; spd: number } | null {
  const m = v?.match(/^(\d{3})\/(\d{3})$/);
  return m ? { dir: Number(m[1]), spd: Number(m[2]) } : null;
}

/** Temperatures printed as "M56" / "03" / "P11" */
export function parseTemp(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = v.match(/^([PM])?(\d+)$/);
  if (!m) return null;
  return (m[1] === "M" ? -1 : 1) * Number(m[2]);
}

export function pct(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || b === 0) return null;
  return (a / b) * 100;
}

/** Great-circle distance in NM */
export function gcNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 3440.065 * 2 * Math.asin(Math.sqrt(a));
}

/** First PDF page whose text matches, for "PDF p.N" references. */
export function pageOf(pages: { page: number; lines: string[] }[] | undefined, re: RegExp): number | null {
  if (!pages) return null;
  for (const p of pages) if (p.lines.some((l) => re.test(l))) return p.page;
  return null;
}
