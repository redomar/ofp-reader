"use client";

import { useOfp } from "../context";
import { Badge, Section, Sub, Tip, V } from "../ui";
import {
  CATEGORY_TIP,
  decodeMetar,
  decodeToken,
  type Category,
} from "@/lib/ofp/metar";
import { pageOf } from "@/lib/ofp/format";
import { WindArrow, parseSector } from "../WindArrow";
import { ObsCard, TafCard } from "../WxCards";
import { parseReport } from "@/lib/wx/reports";

const CAT_TONE: Record<Category, "green" | "blue" | "red" | "mag"> = {
  VFR: "green",
  MVFR: "blue",
  IFR: "red",
  LIFR: "mag",
};

function Tokens({ text, taf }: { text: string; taf?: boolean }) {
  const toks = text.split(/\s+/).filter(Boolean);
  return (
    <span>
      {toks.map((t, i) => {
        const d = decodeToken(t, taf);
        return (
          <span key={i}>
            {d.tip ? (
              <span
                className="tok"
                data-k={d.kind}
                data-tip={d.tip}
                data-tip-title={t}
              >
                {t}
              </span>
            ) : (
              <span className="tok">{t}</span>
            )}{" "}
          </span>
        );
      })}
    </span>
  );
}

function tafHazards(lines: string[]) {
  const out: string[] = [];
  const all = lines.join(" ");
  const g = [...all.matchAll(/G(\d{2,3})KT/g)].map((m) => Number(m[1]));
  if (g.length) out.push(`gusts to ${Math.max(...g)} kt`);
  if (/\bTS|CB\b/.test(all)) out.push("thunderstorm / CB");
  if (/\b(\+|-)?(SH)?RA\b/.test(all)) out.push("rain");
  if (/\bFG\b|\bBR\b/.test(all)) out.push("reduced visibility");
  const vis = [...all.matchAll(/\s(\d{4})\s/g)]
    .map((m) => Number(m[1]))
    .filter((v) => v < 5000);
  if (vis.length) out.push(`vis down to ${Math.min(...vis)} m`);
  return out;
}

export function WxSection({ no }: { no: number }) {
  const { ofp } = useOfp();
  const wx = ofp?.wx;
  const airports = wx?.airports.length
    ? wx.airports
    : (["Departure", "Destination", "Destination Alternates"].map((role) => ({
        role,
        icao: "",
        iata: null,
        name: "",
        metar: null,
        taf: [],
        other: [],
      })) as NonNullable<typeof wx>["airports"]);

  return (
    <Section
      id="wx"
      no={no}
      title="Airport weather"
      meta={
        <span>PDF p.{pageOf(ofp?.pages, /\[ Airport WX List \]/) ?? 12}</span>
      }
    >
      <div className="stack small mono" style={{ gap: 2, marginBottom: 10 }}>
        {wx?.header.length ? (
          wx.header.map((h) => <span key={h}>{h}</span>)
        ) : (
          <V v={null} w={40} />
        )}
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        {(wx?.advisories.length
          ? wx.advisories
          : [
              { title: "AIRMETs", lines: [] },
              { title: "SIGMETs", lines: [] },
            ]
        ).map((a) => {
          const none = a.lines.every((l) => /No Wx data/i.test(l));
          return (
            <Badge
              key={a.title}
              tone={!ofp ? "ink" : none ? "green" : "amber"}
              tip={a.lines.join(" ") || "Not loaded"}
            >
              {a.title}:{" "}
              {!ofp ? "—" : none ? "none" : `${a.lines.length} active`}
            </Badge>
          );
        })}
      </div>
      {wx?.advisories.some((a) =>
        a.lines.some((l) => !/No Wx data/i.test(l)),
      ) && (
        <div className="stack" style={{ marginBottom: 14 }}>
          {wx.advisories
            .filter((a) => a.lines.some((l) => !/No Wx data/i.test(l)))
            .map((a) => (
              <div key={a.title}>
                <Sub>{a.title}</Sub>
                <p className="pre">{a.lines.join("\n")}</p>
              </div>
            ))}
        </div>
      )}

      <div
        className={ofp ? "stack wx-airports" : "cols"}
        style={ofp ? undefined : { ["--min" as string]: "320px" }}
      >
        {airports.map((a, i) => {
          const d = a.metar ? decodeMetar(a.metar) : null;
          const hz = tafHazards(a.taf);
          // The OFP lists reports under an airport heading, so the ICAO code is added back for parsing.
          const metarR = a.metar
            ? parseReport(`METAR ${a.icao} ${a.metar}`)
            : null;
          const tafR = a.taf.length
            ? parseReport(`TAF ${a.icao} ${a.taf.join(" ")}`)
            : null;
          return (
            <article
              className="wx-card"
              key={a.icao + i}
              aria-label={`${a.role} ${a.icao} weather`}
            >
              <header>
                <Badge
                  tone={
                    a.role.startsWith("Dest") && !a.role.includes("Alt")
                      ? "mag"
                      : a.role === "Departure"
                      ? "blue"
                      : "ink"
                  }
                >
                  {a.role}
                </Badge>
                <h3>
                  <V v={a.icao} w={4} />
                  {a.iata && <span className="small muted">/{a.iata}</span>}
                </h3>
                <span className="small muted">{a.name}</span>
                {d?.category && (
                  <span style={{ marginLeft: "auto" }}>
                    <Badge
                      tone={CAT_TONE[d.category]}
                      tip={CATEGORY_TIP[d.category]}
                    >
                      {d.category}
                    </Badge>
                  </span>
                )}
              </header>
              <div className="body">
                {metarR || tafR ? (
                  <>
                    {metarR && <ObsCard r={metarR} />}
                    {tafR && <TafCard r={tafR} />}
                  </>
                ) : (
                  <>
                    <div className="wx-facts" aria-label="Current conditions">
                      {d ? (
                        <>
                          <span className="wx-fact">
                            {d.wind?.dir != null && (
                              <WindArrow
                                kind="METAR"
                                dir={d.wind.dir}
                                spd={d.wind.spd}
                                gust={d.wind.gust}
                                sector={parseSector(d.wind.variable)}
                                label={`Wind from ${d.wind.dir} degrees at ${
                                  d.wind.spd
                                } knots${
                                  d.wind.gust ? `, gusting ${d.wind.gust}` : ""
                                }${
                                  d.wind.variable
                                    ? `, varying ${d.wind.variable}`
                                    : ""
                                }`}
                              />
                            )}
                            {d.wind
                              ? `${d.wind.dir ?? "VRB"}° ${d.wind.spd}${
                                  d.wind.gust ? `G${d.wind.gust}` : ""
                                } kt`
                              : "—"}
                            {d.wind?.variable && (
                              <span className="muted">
                                {" "}
                                ({d.wind.variable})
                              </span>
                            )}
                          </span>
                          <span className="wx-fact">
                            vis{" "}
                            {d.visM != null
                              ? d.visM >= 10000
                                ? "≥10 km"
                                : `${d.visM} m`
                              : "—"}
                          </span>
                          <span className="wx-fact">
                            ceiling{" "}
                            {d.ceilingFt != null ? `${d.ceilingFt} ft` : "none"}
                          </span>
                          <span className="wx-fact">
                            {d.temp}°/{d.dew}°
                            {d.temp != null &&
                            d.dew != null &&
                            d.temp - d.dew <= 2 ? (
                              <Badge
                                tone="amber"
                                tip="Temperature/dew-point spread ≤ 2 °C: fog or low cloud possible"
                              >
                                fog risk
                              </Badge>
                            ) : null}
                          </span>
                          <span className="wx-fact">Q{d.qnh}</span>
                        </>
                      ) : (
                        <V v={null} w={30} />
                      )}
                    </div>
                    <div>
                      <span className="field-label">
                        <Tip tip="METAR — routine aerodrome observation (SA)">
                          METAR
                        </Tip>
                      </span>
                      {a.metar ? (
                        <Tokens text={a.metar} />
                      ) : (
                        <V v={null} w={36} />
                      )}
                    </div>
                    <div>
                      <span className="field-label">
                        <Tip tip="TAF — aerodrome forecast (FT). Change groups (TEMPO, BECMG, PROB) in magenta">
                          TAF
                        </Tip>
                      </span>
                      {a.taf.length ? (
                        <div className="stack" style={{ gap: 2 }}>
                          {a.taf.map((l, k) => (
                            <div key={k} style={{ paddingLeft: k ? 16 : 0 }}>
                              <Tokens text={l} taf />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <V v={null} w={36} />
                      )}
                    </div>
                  </>
                )}
                {hz.length > 0 && (
                  <div className="row" style={{ gap: 6 }}>
                    <span className="field-label" style={{ margin: 0 }}>
                      Watch
                    </span>
                    {hz.map((h) => (
                      <Badge key={h} tone="amber">
                        {h}
                      </Badge>
                    ))}
                  </div>
                )}
                {a.other.length > 0 && (
                  <p className="pre small">{a.other.join("\n")}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {wx?.footer && <p className="note">{wx.footer}</p>}
    </Section>
  );
}
