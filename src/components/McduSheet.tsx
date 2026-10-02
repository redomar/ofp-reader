"use client";

import { useField, useFieldGroup, useOfp } from "./context";
import { legMetrics, ident, listing, printout } from "./RouteExplain";
import { hhmmToMin } from "@/lib/ofp/format";
import { routeLegs } from "@/lib/ofp/fplRef";

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
