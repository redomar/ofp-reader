"use client";

import { useRef, useState, type ReactNode } from "react";
import { useField, useFieldGroup, useOfp } from "./context";
import { legMetrics, ident, listing, printout } from "./RouteExplain";
import { hhmmToMin } from "@/lib/ofp/format";
import { routeLegs } from "@/lib/ofp/fplRef";
import { forecastAt, headline, parseReport } from "@/lib/wx/reports";

const col = (v: string | number | null | undefined, w: number, right = false) => {
  const t = v == null ? "" : String(v);
  return (right ? t.padStart(w) : t.padEnd(w)).slice(0, w);
};
const RULE = "-".repeat(52);
const head = (t: string) => [RULE, `[ ${t} ]`];

/**
 * The plan laid out in MCDU page order on line-printer paper, to type straight in:
 * INIT A, INIT B (fuel and weights), F-PLN, PERF TAKE OFF, RAD NAV, cruise winds.
 */
export function McduSheet() {
  const { ofp } = useOfp();
  const [logOff] = useField("log.off", "Flight log", "Actual take-off (OFF, UTC)");
  const [picRaw] = useField("fuel.picExtra", "Planned fuel", "PIC extra fuel");
  const toAct = useFieldGroup("tlr.takeoff", "Runway analysis");
  if (!ofp?.fpl) return null;
  const h = ofp.header;
  const item = (id: string) => ofp.fpl!.items.find((i) => i.item === id)?.value ?? "";
  const dep = item("13").slice(0, 4) || h.dep || "DEP";
  const dest = item("16").slice(0, 4) || h.arr || "DEST";
  const { initial, legs } = routeLegs(item("15"), dep, dest);
  const rows = legMetrics(legs, ofp.log, dep, dest);
  const off = hhmmToMin(/^\d{4}$/.test(logOff) ? logOff : h.offTime);
  const navOf = (name: string) => ofp.log.find((p) => ident(p) === name && p.freq);

  // INIT A
  const lines: string[] = [
    ...head("INIT A"),
    `${col("FROM/TO", 14)}${dep}/${dest}`,
    `${col("ALTN", 14)}${h.altn ?? "...."}`,
    `${col("FLT NBR", 14)}${h.atcCallsign ?? h.flightNo ?? ""}`,
    `${col("COST INDEX", 14)}${h.costIndex ?? "..."}`,
    `${col("CRZ FL", 14)}${initial?.level ?? "....."}${h.flSteps.length > 1 ? `  STEP ${h.flSteps.slice(1).map((s) => `FL${Number(s.fl)} AT ${s.fix}`).join(", ")}` : ""}`,
    `${col("AVG WIND/ISA", 14)}${h.avgWind ?? "..."}  ${h.avgIsa ?? ""}`,
  ];

  // INIT B: fuel in tonnes as the MCDU takes it
  const u = h.unit === "LBS" ? "LBS" : "KG";
  const t = (kg: number | null | undefined) => (kg == null ? "....." : (kg / 1000).toFixed(1));
  const fuel = (label: string) => ofp.fuel.rows.find((r) => r.label.startsWith(label));
  const tm = (r?: { time: string | null }) => (r?.time ? `/${r.time}` : "");
  const pic = Number(picRaw) || 0;
  const block = (fuel("BLOCK")?.fuel ?? 0) + pic;
  lines.push(
    ...head(`INIT B   (x1000 ${u})`),
    `${col("ZFW", 14)}${t(h.estZfw)}`,
    `${col("BLOCK", 14)}${t(block)}${pic ? `  (incl PIC EXTRA ${t(pic)})` : ""}`,
    `${col("TAXI", 14)}${t(fuel("TAXI")?.fuel)}`,
    `${col("TRIP/TIME", 14)}${t(fuel("TRIP")?.fuel)}${tm(fuel("TRIP"))}`,
    `${col("RTE RSV", 14)}${t(fuel("CONT")?.fuel)}`,
    `${col("ALTN/TIME", 14)}${t(fuel("ALTN")?.fuel)}${tm(fuel("ALTN"))}`,
    `${col("FINAL/TIME", 14)}${t(fuel("FINRES")?.fuel)}${tm(fuel("FINRES"))}`,
    `${col("EXTRA", 14)}${t((fuel("EXTRA")?.fuel ?? 0) + pic)}`,
    `${col("TOW / LW", 14)}${t(h.estTow != null ? h.estTow + pic : null)} / ${t(h.estLaw)}`,
  );

  // F-PLN: the route listing body
  const fpln = listing(ofp, dep, dest, rows, off, navOf);
  const totalAt = fpln.findIndex((l) => l.startsWith("TOTAL"));
  lines.push(...head("F-PLN"), ...fpln.slice(3, totalAt + 1));

  // PERF TAKE OFF from the TLR planned line (actual runway if one is picked)
  const to = ofp.tlr.takeoff.planned;
  const v = (s?: string) => (s ? String(Number(s) < 100 ? Number(s) + 100 : Number(s)) : "...");
  if (to) {
    lines.push(
      ...head("PERF TAKE OFF"),
      `${col("RWY", 14)}${toAct.get("RWY") || to.PRWY}${toAct.get("RWY") && toAct.get("RWY") !== to.PRWY ? `  (planned ${to.PRWY})` : ""}`,
      `${col("V1/VR/V2", 14)}${v(to.V1)}/${v(to.VR)}/${v(to.V2)}`,
      `${col("FLAPS", 14)}${to.FLP ?? "..."}`,
      `${col("FLEX TO TEMP", 14)}${to.MT ?? "..."}`,
    );
  }

  // RAD NAV: navaids on the route
  const navs = ofp.log.filter((p) => p.freq);
  if (navs.length) lines.push(...head("RAD NAV"), ...navs.map((p) => `${col(ident(p), 6)}${col(p.freq, 8)}${p.position ?? ""}`));

  // Winds: each wind station at the level flown there (the step climb included), else the filed cruise level
  const crz = Number(initial?.level.replace(/\D/g, "")) || null;
  const flownAt = (name: string) => Number(ofp.log.find((p) => ident(p) === name.replace(/\s/g, "") && p.fl)?.fl) || null;
  const winds = ofp.winds
    .map((w) => {
      const want = flownAt(w.name) ?? crz;
      const lv = want ? [...w.levels].sort((a, b) => Math.abs(Number(a.fl) - want) - Math.abs(Number(b.fl) - want))[0] : w.levels[0];
      return lv ? `${col(w.name, 8)}FL${col(lv.fl, 4)}${String(lv.dir).padStart(3, "0")}/${String(lv.spd).padStart(3, "0")}  ${lv.temp > 0 ? "+" : ""}${lv.temp}` : null;
    })
    .filter((x): x is string => !!x);
  if (winds.length) lines.push(...head("WINDS  (CLB / CRZ / DES)"), ...winds);

  lines.push(RULE, "", `${col("", 12)}*** END OF LISTING ***`);
  const title = [`${col("OFP READER  MCDU SET-UP SHEET", 40)}${col("PAGE 001", 12, true)}`, `${col(h.flightNo, 9)}${col(`${dep}-${dest}`, 11)}${col(h.date, 11)}${col(h.acType, 6)}${col(h.reg, 15)}`];
  return printout([...title, ...lines]);
}

const PAGES = ["INIT A", "INIT B", "F-PLN", "PERF T/O", "RAD NAV", "WINDS"];

/**
 * A button that "prints" a sheet: opens it full screen over a dimmed page (a modal
 * dialog, so Esc and focus work), with the paper's punched holes see-through.
 */
function PrintButton({ title, chips, sub, label, disabled, children }: { title: string; chips: string[]; sub: string; label: string; disabled: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const open = () => ref.current?.showModal();
  const close = () => ref.current?.close();
  const copy = async () => {
    // Every printed line, pages separated by a blank line.
    const pages = [...(ref.current?.querySelectorAll<HTMLElement>(".rx-paper") ?? [])];
    const text = pages.map((pg) => [...pg.querySelectorAll(".rx-pline")].map((l) => l.textContent?.replace(/\s+$/, "") ?? "").join("\n")).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };
  return (
    <>
      <button type="button" className="mcdu-btn" onClick={open} disabled={disabled} aria-haspopup="dialog">
        <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true" className="mcdu-btn-icon">
          <path d="M7 9V3h10v6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="3" y="9" width="18" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M7 14h10v7H7z" fill="var(--pp)" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9 17h6M9 19h4" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="18" cy="12" r="0.9" fill="currentColor" />
        </svg>
        <span className="mcdu-btn-text">
          <b>{title}</b>
          <span className="mcdu-btn-pages">
            {chips.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </span>
          <span className="mcdu-btn-sub">{sub}</span>
        </span>
      </button>
      <dialog ref={ref} className="mcdu-dialog" aria-label={label} onClick={(e) => e.target === ref.current && close()}>
        <div className="mcdu-dialog-bar">
          <button type="button" className="btn" onClick={copy}>
            {copied ? "Copied ✓" : "Copy text"}
          </button>
          <button type="button" className="btn" onClick={close} autoFocus>
            Close ✕
          </button>
        </div>
        <div className="mcdu-dialog-paper" onClick={(e) => e.target === e.currentTarget && close()}>
          {children}
        </div>
      </dialog>
    </>
  );
}

export function McduPrint() {
  const { ofp } = useOfp();
  return (
    <PrintButton title="Print MCDU set-up sheet" chips={PAGES} sub="The plan in MCDU page order, ready to type in." label="MCDU set-up sheet" disabled={!ofp?.fpl}>
      <McduSheet />
    </PrintButton>
  );
}

/** Wraps text to the paper width, continuation lines indented. */
function wrap(text: string, first: string, width = 52, indent = 14): string[] {
  const out: string[] = [];
  let cur = first;
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (cur.length + w.length + 1 > width && cur.trim().length > indent - 1) {
      out.push(cur);
      cur = " ".repeat(indent);
    }
    cur += (cur.endsWith(" ") || !cur.length ? "" : " ") + w;
  }
  out.push(cur);
  return out;
}

/** One page per destination alternate, each starting with FINRES. */
function altPages(ofp: NonNullable<ReturnType<typeof useOfp>["ofp"]>): string[][] {
  const h = ofp.header;
  const alts = ofp.alternates;
  const u = h.unit === "LBS" ? "LBS" : "KG";
  const finres = ofp.finresAltn ?? ofp.fuel.rows.find((r) => r.label.startsWith("FINRES"))?.fuel ?? null;
  const finresTime = ofp.fuel.rows.find((r) => r.label.startsWith("FINRES"))?.time;
  const onMin = hhmmToMin(h.onTime);
  const day = Number(h.flightDate?.slice(0, 2)) || null;
  const clockOf = (m: number) => {
    const v = ((m % 1440) + 1440) % 1440;
    return `${String(Math.floor(v / 60)).padStart(2, "0")}${String(v % 60).padStart(2, "0")}Z`;
  };
  const pageNo = (n: number) => `PAGE ${String(n).padStart(3, "0")}`;
  const altPagesOut = alts.map((a, i) => {
    const [icao, aptRwy] = a.apt.split("/");
    const rwy = a.rwy ?? aptRwy;
    const wx = ofp.wx.airports.find((w) => w.icao === icao);
    const altMin = hhmmToMin(a.time) ?? 0;
    const eta = onMin != null ? onMin + altMin : null;
    const nav = ofp.log.find((p) => p.freq && ident(p) === icao);
    const lines = [
      `${col("OFP READER  ALTERNATE SHEET", 40)}${col(pageNo(i + 2), 12, true)}`,
      `${col(h.flightNo, 9)}${col(`${h.dep}-${h.arr}`, 11)}${col(h.date, 11)}${col(`ALTN ${i + 1} OF ${alts.length}`, 21)}`,
      RULE,
      `[ FINRES ]    ${finres != null ? `${finres.toLocaleString("en-GB")} ${u}` : "....."}${finresTime ? `  ${finresTime.slice(0, 2)}:${finresTime.slice(2)}` : ""}`,
      ...head(`ALTN ${icao}${wx?.name ? `  ${wx.name}` : ""}`),
      `${col("RWY", 14)}${rwy ?? "..."}`,
      `${col("TRK / DIST", 14)}${a.trk ?? "..."}° / ${a.dst ?? "..."} NM`,
      ...wrap(a.via, col("ROUTE", 14)),
      `${col("FL / W/C", 14)}${a.fl ? `FL${a.fl}` : "..."} / ${a.wc ?? "..."}`,
      `${col("TIME / FUEL", 14)}${a.time ? `${a.time.slice(0, 2)}:${a.time.slice(2)}` : "..."} / ${a.fuel != null ? `${a.fuel.toLocaleString("en-GB")} ${u}` : "..."}`,
      `${col("MIN DIVERT", 14)}${a.fuel != null && finres != null ? `${(a.fuel + finres).toLocaleString("en-GB")} ${u} at ${h.arr} (ALTN + FINRES)` : "....."}`,
      `${col("ETA ALTN", 14)}${eta != null ? `${clockOf(eta)}  if diverting from ${clockOf(onMin!)} at ${h.arr}` : "....."}`,
    ];
    if (nav?.freq) lines.push(`${col("NAVAID", 14)}${nav.freq}`);
    if (wx?.taf.length && eta != null && day) {
      const taf = parseReport(`TAF ${icao} ${wx.taf.join(" ")}`);
      const at = { day: day + (eta >= 1440 ? 1 : 0), hour: Math.floor((eta % 1440) / 60), min: eta % 60 };
      const f = forecastAt(taf, at);
      lines.push(...head(`FCST AT ETA ${clockOf(eta)}`));
      if (f) {
        lines.push(...wrap(`${headline(f.prevailing)}${f.prevailing.category ? ` · ${f.prevailing.category}` : ""}`.toUpperCase(), col("PREVAILING", 14)));
        for (const g of f.temporary) lines.push(...wrap(`${headline(g.cond)}${g.cond.category ? ` · ${g.cond.category}` : ""}`.toUpperCase(), col(g.type === "PROB" ? `PROB${g.prob}${g.tempo ? " TEMPO" : ""}` : "TEMPO", 14)));
      } else lines.push("ETA OUTSIDE THE TAF VALIDITY");
    }
    if (wx?.metar) lines.push(...head("METAR"), ...wrap(`${icao} ${wx.metar}`, "", 52, 0));
    lines.push(RULE, "", `${col("", 10)}*** END OF PAGE ${String(i + 2).padStart(3, "0")} ***`);
    return lines;
  });

  // Page 001: return to departure (air turnback), and the take-off alternate if one is filed.
  const dep = h.dep ?? "DEP";
  const depWx = ofp.wx.airports.find((w) => w.icao === dep);
  const to = ofp.tlr.takeoff.planned;
  const acars = ofp.tlr.takeoff.tables.find((t) => /ACARS/.test(t.title));
  const ci = (name: string) => acars?.columns.indexOf(name) ?? -1;
  const tow = h.estTow;
  const over = tow != null && h.maxLaw != null ? tow - h.maxLaw : null;
  const offMin = hhmmToMin(h.offTime);
  const ret: string[] = [
    `${col("OFP READER  ALTERNATE SHEET", 40)}${col(pageNo(1), 12, true)}`,
    `${col(h.flightNo, 9)}${col(`${h.dep}-${h.arr}`, 11)}${col(h.date, 11)}${col("RETURN TO DEP", 21)}`,
    RULE,
    `[ FINRES ]    ${finres != null ? `${finres.toLocaleString("en-GB")} ${u}` : "....."}${finresTime ? `  ${finresTime.slice(0, 2)}:${finresTime.slice(2)}` : ""}`,
    ...head(`RETURN TO DEPARTURE  ${dep}`),
    ...wrap(`${depWx?.name ? `${depWx.name}  ` : ""}(AIR TURNBACK)`, "", 52, 0),
  ];
  if (acars) {
    ret.push(`${col("RWY", 7)}${col("LENGTH", 9, true)}  NOTES`);
    for (const r of acars.rows) {
      const len = Number(r[ci("LENGTH")]);
      ret.push(`${col(r[0] + (r[0] === to?.PRWY ? "*" : ""), 7)}${col(len ? `${len.toLocaleString("en-GB")} FT` : "", 9, true)}  ${r[ci("NOTES")] ?? ""}`);
    }
    if (to?.PRWY) ret.push(`${col("", 7)}* PLANNED TAKE-OFF RUNWAY`);
  }
  ret.push(...wrap("NO LANDING PERFORMANCE FOR THE DEPARTURE IN THE OFP: CHECK THE LANDING DISTANCE WITH YOUR PERFORMANCE TOOL.", "", 52, 0));
  ret.push(...head("WEIGHT"));
  ret.push(`${col("TOW / MLW", 14)}${tow != null ? tow.toLocaleString("en-GB") : "..."} / ${h.maxLaw != null ? h.maxLaw.toLocaleString("en-GB") : "..."} ${u}`);
  if (over != null && over > 0) {
    const mins = h.avgFf ? Math.round((over / h.avgFf) * 60) : null;
    ret.push(`${col("OVERWEIGHT", 14)}${over.toLocaleString("en-GB")} ${u} ABOVE MLW`);
    if (mins != null) ret.push(...wrap(`ABOUT ${mins} MIN TO BURN AT THE PLANNED AVG FUEL FLOW (${h.avgFf} ${u}/H), OR LAND OVERWEIGHT PER YOUR PROCEDURES`, col("", 14)));
  } else if (over != null) ret.push(`${col("OVERWEIGHT", 14)}NO, ${(-over).toLocaleString("en-GB")} ${u} BELOW MLW`);
  const mora = ofp.log.find((p) => p.mora)?.mora;
  const sid = routeLegs(ofp.fpl?.items.find((i) => i.item === "15")?.value ?? "", dep, h.arr ?? "").legs[0];
  ret.push(...head("DEPARTURE"));
  if (sid?.via === "SID") ret.push(`${col("SID", 14)}${sid.proc} TO ${sid.to}`);
  if (mora) ret.push(`${col("MORA", 14)}${(Number(mora) * 100).toLocaleString("en-GB")} FT (FIRST LEG)`);
  if (offMin != null) ret.push(`${col("PLANNED OFF", 14)}${clockOf(offMin)}`);
  if (depWx?.taf.length && offMin != null && day) {
    const back = offMin + 45;
    const taf = parseReport(`TAF ${dep} ${depWx.taf.join(" ")}`);
    const f = forecastAt(taf, { day: day + (back >= 1440 ? 1 : 0), hour: Math.floor((back % 1440) / 60), min: back % 60 });
    ret.push(...head(`FCST AT ${clockOf(back)} (OFF + 45 MIN)`));
    if (f) {
      ret.push(...wrap(`${headline(f.prevailing)}${f.prevailing.category ? ` · ${f.prevailing.category}` : ""}`.toUpperCase(), col("PREVAILING", 14)));
      for (const g of f.temporary) ret.push(...wrap(`${headline(g.cond)}${g.cond.category ? ` · ${g.cond.category}` : ""}`.toUpperCase(), col(g.type === "PROB" ? `PROB${g.prob}${g.tempo ? " TEMPO" : ""}` : "TEMPO", 14)));
    } else ret.push("OUTSIDE THE TAF VALIDITY");
  }
  if (depWx?.metar) ret.push(...head("METAR"), ...wrap(`${dep} ${depWx.metar}`, "", 52, 0));
  const tk = h.tkofAltn && !/^\.+$/.test(h.tkofAltn) ? h.tkofAltn : null;
  ret.push(...head("TAKE-OFF ALTERNATE"));
  if (tk) {
    const tkWx = ofp.wx.airports.find((w) => w.icao === tk);
    ret.push(`${col("FILED", 14)}${tk}${tkWx?.name ? `  ${tkWx.name}` : ""}`);
    if (tkWx?.metar) ret.push(...wrap(`${tk} ${tkWx.metar}`, "", 52, 0));
  } else ret.push("NONE FILED");
  ret.push(RULE, "", `${col("", 10)}*** END OF PAGE 001 ***`);
  return [ret, ...altPagesOut];
}

function AltSheet() {
  const { ofp } = useOfp();
  if (!ofp) return null;
  const pages = altPages(ofp);
  // Pages torn apart with a zigzag gap between them.
  return (
    <div className="rx-pages">
      {pages.map((lines, i) => (
        <div key={i} className={`rx-page${i > 0 ? " zz-top" : ""}${i < pages.length - 1 ? " zz-bottom" : ""}`}>
          {/* keep printing on from where the previous page stopped */}
          {printout(lines, pages.slice(0, i).reduce((n, pg) => n + pg.length, 0))}
        </div>
      ))}
    </div>
  );
}

export function AltPrint() {
  const { ofp } = useOfp();
  const alts = ofp?.alternates ?? [];
  return (
    <PrintButton
      title="Print alternate sheet"
      chips={[`${ofp?.header.dep ?? "DEP"} RTN`, ...alts.map((a) => a.apt.split("/")[0])]}
      sub={`Return to departure, then one page per alternate (${alts.length}); each page starts with FINRES.`}
      label="Alternate sheet"
      disabled={!ofp}
    >
      <AltSheet />
    </PrintButton>
  );
}
