import type { OFP } from "./types";

/**
 * Fuel on board when the captain loads extra fuel over the plan (PIC extra).
 * The OFP's EFOB column is planned from block fuel without it. Carrying the extra
 * costs fuel too: the OFP's "WEIGHT CHANGE UP" impact gives the added trip burn per
 * tonne, applied progressively along the route by share of planned burn.
 */
export interface PicExtraModel {
  /** PIC extra loaded, in the plan's mass unit (kg or lb). */
  extra: number;
  /** Extra trip burn per 1000 units carried (e.g. 31 kg per tonne), or 0 if the OFP doesn't say. */
  burnPer1000: number;
  /** Extra still on board at a point, in plan units, given its planned burn (PBRN, thousands). */
  extraAt(pbrn: string | null): number;
  /** EFOB (thousands) + remaining extra, in thousands. */
  tfob(efob: string | null, pbrn: string | null): number | null;
}

export function picExtraModel(ofp: OFP, extra: number): PicExtraModel {
  const up = ofp.opImpacts.find((m) => m.kind === "WEIGHT CHANGE" && /^UP\s/.test(m.change));
  const amount = Number(up?.change.match(/^UP\s+([\d.]+)/)?.[1]);
  const burnPer1000 = up?.trip != null && amount > 0 ? ((up.tripSign === "M" ? -1 : 1) * up.trip) / amount : 0;

  const burns = ofp.log.filter((p) => p.kind === "wpt" && p.pbrn != null).map((p) => Number(p.pbrn));
  const start = burns[0] ?? 0; // taxi burn at departure
  const end = burns.at(-1) ?? start;

  const extraAt = (pbrn: string | null) => {
    const b = Number(pbrn);
    const f = pbrn == null || Number.isNaN(b) || end <= start ? 0 : Math.min(1, Math.max(0, (b - start) / (end - start)));
    return extra - (extra / 1000) * burnPer1000 * f;
  };

  return {
    extra,
    burnPer1000,
    extraAt,
    tfob: (efob, pbrn) => (efob == null || Number.isNaN(Number(efob)) ? null : Number(efob) + extraAt(pbrn) / 1000),
  };
}
