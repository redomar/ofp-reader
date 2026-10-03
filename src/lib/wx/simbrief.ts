/**
 * Live METAR / TAF / ATIS from SimBrief's airport API, using the user's own Navigraph
 * access token. Unofficial (it's the API dispatch.simbrief.com uses), so it may change.
 * The token is only ever sent to api.simbrief.com, and results are cached for a minute.
 */

const API = "https://api.simbrief.com/v2/airports/";
const TTL_MS = 60_000;
const CACHE_KEY = "ofp-reader:sb-cache";

export interface SbAtis {
  letter: string | null;
  type: string | null;
  message: string;
  issued: string | null;
}

export interface SbAirport {
  icao: string;
  name: string | null;
  metar: string | null;
  taf: string | null;
  atis: SbAtis[];
  /** When this came from the network (ms). */
  at: number;
}

type Cache = Record<string, SbAirport>;

function readCache(): Cache {
  try {
    return JSON.parse(window.sessionStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function writeCache(c: Cache) {
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* cache is a nicety */
  }
}

/** Expiry of a JWT access token (ms), or null if it can't be read. */
export function tokenExpiry(token: string): number | null {
  try {
    const p = token.trim().replace(/^Bearer\s+/i, "").split(".")[1];
    const json = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(p.length / 4) * 4, "=")));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export class SbError extends Error {
  constructor(
    message: string,
    public icao: string,
  ) {
    super(message);
  }
}

/** One airport, from the 1-minute cache when fresh. */
export async function fetchAirport(icao: string, token: string): Promise<SbAirport & { cached: boolean }> {
  const key = icao.toUpperCase();
  const cache = readCache();
  const hit = cache[key];
  if (hit && Date.now() - hit.at < TTL_MS) return { ...hit, cached: true };
  const res = await fetch(API + encodeURIComponent(key), { headers: { Authorization: `Bearer ${token.trim().replace(/^Bearer\s+/i, "")}` } });
  if (res.status === 401) throw new SbError("Token rejected or expired: copy a fresh one from dispatch.simbrief.com", key);
  if (res.status === 404) throw new SbError("Airport not found", key);
  if (!res.ok) throw new SbError(`SimBrief replied ${res.status}`, key);
  const j = await res.json();
  const ap: SbAirport = {
    icao: j.airport_icao ?? key,
    name: j.airport_name ?? null,
    metar: j.text_metar || null,
    taf: j.text_taf || null,
    atis: Array.isArray(j.text_atis)
      ? j.text_atis.filter((a: { message?: string }) => a?.message).map((a: { letter?: string; type?: string; message: string; issued?: string }) => ({ letter: a.letter ?? null, type: a.type ?? null, message: a.message, issued: a.issued ?? null }))
      : [],
    at: Date.now(),
  };
  writeCache({ ...readCache(), [key]: ap });
  return { ...ap, cached: false };
}

/** The airport's reports as text the weather page parses (ICAO added to the ATIS so it groups). */
export function asReportText(a: SbAirport): string {
  const out: string[] = [];
  if (a.metar) out.push(`METAR ${a.metar}`);
  if (a.taf) out.push(`TAF ${a.taf.replace(/\n\s*/g, "\n  ")}`);
  for (const t of a.atis) out.push(`${a.icao} ATIS INFORMATION ${t.letter ?? ""}. ${t.message}`);
  return out.join("\n\n");
}
