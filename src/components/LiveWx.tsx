"use client";

import { useEffect, useState } from "react";
import { asReportText, fetchAirport, tokenExpiry, type SbAirport } from "@/lib/wx/simbrief";

const TOKEN_KEY = "ofp-reader:sb-token";
const ICAO_KEY = "ofp-reader:sb-icaos";

const read = (store: Storage | undefined, k: string) => {
  try {
    return store?.getItem(k) ?? "";
  } catch {
    return "";
  }
};
const write = (store: Storage | undefined, k: string, v: string | null) => {
  try {
    if (v == null) store?.removeItem(k);
    else store?.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

/**
 * Live METAR / TAF / ATIS from SimBrief with your own Navigraph token. The token stays in
 * this tab (or this browser, if you tick Remember) and is only sent to api.simbrief.com.
 */
export function LiveWx({ onText, suggested }: { onText: (text: string, from: string) => void; suggested: string[] }) {
  const [token, setToken] = useState("");
  const [remember, setRemember] = useState(false);
  const [icaos, setIcaos] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    queueMicrotask(() => {
      const kept = read(window.localStorage, TOKEN_KEY);
      setToken(kept || read(window.sessionStorage, TOKEN_KEY));
      setRemember(!!kept);
      setIcaos(read(window.localStorage, ICAO_KEY));
    });
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const saveToken = (v: string, keep: boolean) => {
    setToken(v);
    write(window.sessionStorage, TOKEN_KEY, v || null);
    write(window.localStorage, TOKEN_KEY, keep && v ? v : null);
  };

  const exp = token ? tokenExpiry(token) : null;
  const left = exp != null ? Math.round((exp - now) / 60000) : null;
  const list = (icaos.trim() ? icaos : suggested.join(" ")).toUpperCase().match(/\b[A-Z]{4}\b/g) ?? [];

  const go = async () => {
    if (!token || !list.length) return;
    setBusy(true);
    setStatus(null);
    write(window.localStorage, ICAO_KEY, icaos);
    const got: (SbAirport & { cached: boolean })[] = [];
    const failed: string[] = [];
    for (const icao of [...new Set(list)]) {
      try {
        got.push(await fetchAirport(icao, token));
      } catch (e) {
        failed.push(`${icao}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }
    setBusy(false);
    if (got.length) onText(got.map(asReportText).filter(Boolean).join("\n\n"), `SimBrief ${new Date().toISOString().slice(11, 16)}Z`);
    const cached = got.filter((g) => g.cached);
    setStatus({
      ok: !failed.length,
      text: [
        got.length ? `${got.length} airport${got.length > 1 ? "s" : ""} loaded${cached.length ? ` (${cached.map((c) => `${c.icao} cached ${Math.round((Date.now() - c.at) / 1000)} s ago`).join(", ")})` : ""}` : "",
        ...failed,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  };

  return (
    <details className="live-wx" open={!!token}>
      <summary>Live weather from SimBrief</summary>
      <p className="small muted" style={{ margin: "6px 0 10px" }}>
        Uses your own sign-in token from dispatch.simbrief.com (DevTools → Network → an <code>api.simbrief.com</code> request → the <code>Authorization</code> header, the part after “Bearer”). It lasts about an hour, stays in this {remember ? "browser" : "tab"} and is only sent to api.simbrief.com. Results are kept for 1 minute.
      </p>
      <div className="live-wx-row">
        <label className="live-wx-field">
          <span className="field-label">Token</span>
          <input type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => saveToken(e.target.value, remember)} placeholder="eyJ…" />
        </label>
        <label className="live-wx-field" style={{ flex: "0 1 220px" }}>
          <span className="field-label">Airports</span>
          <input value={icaos} onChange={(e) => setIcaos(e.target.value.toUpperCase())} placeholder={suggested.join(" ") || "EGBB EGLL"} spellCheck={false} />
        </label>
        <button type="button" className="btn btn-primary" disabled={!token || !list.length || busy} onClick={go}>
          {busy ? "Fetching…" : `Fetch ${list.length || ""}`.trim()}
        </button>
      </div>
      <div className="row small" style={{ gap: 14, marginTop: 6 }}>
        <label className="row" style={{ gap: 6 }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => {
              setRemember(e.target.checked);
              saveToken(token, e.target.checked);
            }}
          />
          Remember in this browser
        </label>
        {token && (
          <span className={left != null && left <= 0 ? "status-err" : "muted"}>
            {left == null ? "Can't read the token's expiry" : left <= 0 ? "Token expired: copy a fresh one" : `Token valid for ${left} min`}
          </span>
        )}
        {token && (
          <button type="button" className="linkish small" onClick={() => saveToken("", false)}>
            Forget token
          </button>
        )}
      </div>
      {status && (
        <p className={`small ${status.ok ? "import-ok" : "status-err"}`} role="status" style={{ margin: "6px 0 0" }}>
          {status.text}
        </p>
      )}
    </details>
  );
}
