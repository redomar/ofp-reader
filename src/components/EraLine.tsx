"use client";

import { useOfp } from "./context";
import { Badge, Tip } from "./ui";
import { ERA_TIP, abeamOf, afterOff, fuelEra, useAirportCoord } from "@/lib/ofp/era";
import { CATEGORY_TIP } from "@/lib/ofp/metar";
import { forecastAt, headline, parseReport } from "@/lib/wx/reports";

const CAT_TONE = { VFR: "green", MVFR: "blue", IFR: "red", LIFR: "mag" } as const;

/** The fuel en-route alternate, where the route passes it and the forecast then (and its nearest point, for callers). */
export function useEra() {
  const { ofp } = useOfp();
  const era = fuelEra(ofp);
  const coord = useAirportCoord(era?.icao);
  const abeam = ofp && coord ? abeamOf(ofp.log, coord) : null;
  const when = ofp && abeam ? afterOff(ofp, abeam.min) : null;
  const forecast = era?.wx.taf.length && when ? forecastAt(parseReport(`TAF ${era.icao} ${era.wx.taf.join(" ")}`), when.at) : null;
  return { era, coord, abeam, when, forecast };
}

/**
 * One line about the fuel en-route alternate: which airport, the contingency fuel it's used for,
 * where the route passes closest (and when), and the forecast category then. Renders nothing
 * when the plan has no fuel ERA.
 */
export function EraLine({ unit = "kg" }: { unit?: string }) {
  const { era, abeam, when, forecast } = useEra();
  if (!era) return null;
  const cat = forecast?.prevailing.category ?? null;
  return (
    <p className="era-line">
      <Badge tone="amber" tip={ERA_TIP}>
        Fuel en-route alternate
      </Badge>
      <b className="mono">
        {era.icao}
        {era.iata && `/${era.iata}`}
      </b>
      <span>{era.name}</span>
      {era.cont && (
        <span className="muted">
          · for{" "}
          <Tip tip="Contingency fuel: covers unforeseen factors en route. This plan's contingency is worked out with the fuel en-route alternate named on its line." title={era.cont.label}>
            {era.cont.label}
          </Tip>
          {era.cont.fuel != null && ` (${era.cont.fuel.toLocaleString("en-GB")} ${unit})`}
        </span>
      )}
      {abeam && (
        <span className="muted">
          · {Math.round(abeam.nm)} NM off track, abeam <b className="mono">{abeam.fix}</b>
          {when && ` at ${when.clock}`}
        </span>
      )}
      {cat && (
        <span className="era-cat">
          · forecast then{" "}
          <Badge tone={CAT_TONE[cat]} tip={`${CATEGORY_TIP[cat]} ${forecast ? `Forecast: ${headline(forecast.prevailing)}.` : ""}`}>
            {cat}
          </Badge>
        </span>
      )}
    </p>
  );
}
