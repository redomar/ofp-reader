# Changelog

All notable changes to OFP Reader. Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **SIGMETs and AIRMETs, decoded and checked against your route.** Each one becomes a card in Airport weather: the phenomenon in plain English (embedded thunderstorms, severe turbulence, icing, mountain wave, volcanic ash…), validity with "active now / upcoming / expired", levels, observed or forecast, movement and trend, and a verdict for this flight: on your route (inside its area, within its levels, while it's valid), crosses it but clear of its levels, crosses it outside its time, or off your route, with the waypoints, minutes after take-off and levels involved. The take-off time is the nav log's Actual OFF, else Times & weights, else planned. The raw text keeps hover explanations. The section badges count SIGMETs (not text lines) and flag ones on your route.
- SIGMET / AIRMET areas on the route map (hatched; the stretch of route inside is drawn red; areas the route crosses are kept in view), their level band on the vertical profile over the stretch they cover, and a SIG marker on the affected waypoints in the navigation log. Hovering any of them highlights the matching card, and a switch above the map hides them.
- **ATC flight plan, decoded with badges.** The operator and radio callsign (EJU → easyJet Europe, "ALPINE 31FL"), flight rules and type, aircraft name and wake category, each equipment and surveillance code with a short label (S · Standard, W · RVSM, L · Mode S + ADS-B + EHS…), airport names, EOBT (flagged if it differs from the OFP's OUT), filed cruise speed and level plus any speed / level changes en route, EET and alternates; item 18 shows PBN capabilities by name, the date of flight, registration, operator, approach category and TCAS.
- **Explain route & navaids** button: item 15 drawn as a timetable along a line from departure to destination (ETO beside each fix), and for each leg the SID / airway / direct / STAR (with what kind of route it is), distance, minutes and levels (climbing / descending), the waypoints in between (TOC / TOD marked), filed speed / level changes and FIR crossings. VORs on the route show their frequency at the fix, and a table beside the diagram, behind a hatched divider and kept in view while scrolling, lists the radio navaids with type, frequency and ETO.
- **Printing animation.** The MCDU and alternate sheets print line by line like a dot-matrix head (about 12 ms a line, continuing across pages), and the explained route prints band by band (about 45 ms each). It replays each time you open them; reduced motion shows them at once.
- **Alternate sheet**, a second print button beside the MCDU sheet. Page 001 is the **return to departure (air turnback)**: the departure's runways with lengths and ILS frequencies (planned take-off runway marked), take-off weight against max landing weight with how far overweight and roughly how long to burn it off, the SID and first-leg MORA, the TAF forecast for 45 minutes after take-off, the METAR, and the take-off alternate if one is filed (the OFP has no landing performance for the departure, which the page says). Then one page per destination alternate, torn apart with a zigzag gap, each page numbered and starting with FINRES. Per alternate: name, runway, track and distance, routing, level and wind component, time and fuel, the minimum fuel at destination to divert (alternate + FINRES), the ETA if diverting from the planned arrival, the TAF forecast at that ETA (prevailing and any TEMPO / PROB) and the latest METAR. Copy text copies every page.
- **Route diagram on printer paper.** The explained route is printed on continuous-form paper (see-through tractor-feed holes, perforations, dimmed at night), each fix and its outgoing leg on its own band, alternating white and pink, keeping every detail.
- **MCDU set-up sheet**: a print button at the top of Alternate, routing & impacts (printer icon, the pages it covers as chips) opens the plan full screen over the dimmed page, as a line-printer listing that hugs its content and feeds in from the top; Esc, Close or clicking outside dismisses it, and Copy text copies it line by line. The listing in MCDU page order, to type straight in: INIT A (from/to, alternate, flight number, cost index, cruise level and step), INIT B (ZFW, block including any PIC extra, taxi, trip / time, route reserve, alternate, final, extra, TOW / LW in tonnes), F-PLN (one line per fix with ETO, via, distance, minutes, level, frequency, FIR crossings and totals), PERF TAKE OFF (runway, actual if picked, V1 / VR / V2, flaps, FLEX), RAD NAV and winds / temperatures for climb, cruise and descent at the levels flown.
- **Collapsible airports in Airport weather.** Click an airport's header (or its ⊟ / ⊞ box) to fold its weather cards away. Departure and destination start open and remember your choice for every plan; destination alternates start collapsed and remember the ones you open. A folded airport shows a one-line summary of its METAR (weather, wind, visibility) next to its category. Folded cards still open for find-in-page and always print expanded.

## [1.6.0] - 2026-10-02

### Added

- **Actual runway in Runway analysis.** A radio in the last (ACT) column of the take-off and landing runway tables marks the runway you actually used; the planned runway stays blue and your pick turns green, like the TFOB column. It shares the RWY box in the Takeoff / Landing actual row, so typing a runway there selects it too (click the radio again to clear). Below the actual row, a readout for that runway: whether it matches the plan, head- and crosswind from the actual wind (or the planned wind), FLEX and V1/VR/V2 from the performance table in view, MTOW or MLW with the margin over the planned weight, max landing weight at the actual OAT from the landing grid, length and ILS frequency. Runways that aren't in the TLR are flagged.
- **Estimated landing distance on a selected runway.** When the runway you landed on isn't the planned one, Runway analysis adds an estimate below the planned figures (after a rule): the planned-weight factored distances, corrected by the TLR's per-knot head/tailwind rows for that runway's wind component (actual wind if entered, otherwise planned), against that runway's ACARS length, with the wet margin. Same bars as the planned runway, hatched with a dashed outline, and marked as an estimate that isn't certified for that runway.
- **Times & weights OFF switch** in the navigation log, next to Include PIC extra. Off by default; when on it adds a **RETO** column (the Actual OFF from Times & weights + TTLT) and ATO is compared with it. It's disabled until Times & weights has an Actual OFF, and when both Actual OFF boxes are filled.

### Changed

- README screenshots: the blank template and airport weather shots are replaced by Runway analysis (actual runway and landing-distance estimate) and the route map with a waypoint selected; the weather cards shot now shows a deteriorating 30-hour TAF; the times shot shows the new timeline.
- **Planned vs actual timeline** in Times & weights: the PLANNED label sits above its bar, the Z start and end times run between the two bars, and the ACTUAL label sits below its bar; the bars span the full width.

### Fixed

- Landing-distance bar labels could become unreadable: on a short bar the white text ran off the fill onto the light track, and on the hatched estimate the stripes crossed the letters. The label is now drawn in ink over the track and in the sheet colour over the fill (switching exactly at the fill edge), and on hatched bars it is outlined (yellow letters with a dark outline by day, light letters with a deep-blue outline at night), keeping it readable over the stripes at any length.
- The ACARS runway tables were shifted one column: "ACARS LENGTH" was split into two headings, so the length showed under ACARS, the weight limit under LENGTH, and PMTOW / PMRLW and the ILS notes were empty.

## [1.5.0] - 2026-10-02

### Added

- **Forecast weather on the flight summary.** A small badge on each flag shows the TAF forecast at the planned take-off (departure) and landing (arrival) time, ringed in its flight category: the worse of the prevailing weather and any TEMPO / PROB group active then. A magenta **T** marks that a temporary group is in play. Hover or focus for the time, the prevailing weather, one magenta chip per TEMPO / PROB group with its weather and category, and a note on what T means.
- Tooltips can show several rows, each led by a coloured chip, and a closing note.

### Changed

- **Weather cards in the reader.** Airport weather now shows each airport's METAR and TAF as the same cards as the weather page (sky picture, headline, swaying wind arrow, visibility and cloud diagrams, TAF timeline and change groups, raw text with tooltips), under the existing airport header with its role, name, category and "Watch" hazards. The blank template is unchanged.
- **Weather cards animate as they come into view** and replay when you scroll back, like the other graphics: the card rises in, the sun spins up, clouds drift in, rain and snow fall, lightning flashes, fog lines spread, cloud layers grow, the visibility marker slides to its value, the wind arrow spins into direction, the facts rise in turn, the ATIS letter flips, and the TAF timeline, TEMPO/PROB bars and change groups wipe and rise in. Reduced motion shows the final state at once.
- Weather cards: observation cards share a row and each TAF takes the full width below, so a lone METAR no longer leaves half the row empty.
- **WX PROG / OBS** explained correctly: WX PROG is when the forecast upper winds and temperatures are valid, OBS is the model run (observation time) each comes from. Hover a chip to decode it, e.g. "Forecast valid day 02 at 12:00 UTC, from the model run based on day 01 at 18:00 UTC".
- Weather wording: CAVOK reads "CAVOK (clear, good visibility)" and BCFG "patchy fog".

### Fixed

- TAF change groups after a CAVOK base kept saying "CAVOK" even when they brought cloud, showers or lower visibility, and their cloud layers were dropped.
- ATIS: the information letter was missed in "ATIS INFORMATION B"; a closing "THIS WAS LEMD ATIS INFORMATION B" line started a second, empty ATIS; `VIS 10KM` and `QNH 1026HPA` were skipped when the ATIS also had coded groups; the airport code is found at the end ("THIS WAS LEMD ATIS") but no longer taken from "YOU HAVE INFO …"; time and greeting lines no longer show as notices; runways aren't listed twice.
- Weather cards side by side (e.g. two ATIS, or ATIS and METAR) didn't line up: the second sat 14 px lower.

## [1.4.0] - 2026-10-02

### Added

- **Import JSON** in Settings → Saved flights restores files saved with Export JSON, from this or another browser (several at once). Entries are merged with anything already saved for that flight, with the file's values winning. Since the file doesn't include the PDF, a new flight reopens from its stored SimBrief link and keeps a copy from then on. Files that aren't flight exports are rejected with a reason.
- **Swaying wind arrows.** The AVG WIND, PWIND and METAR wind arrows sway like a windsock, tuned in the wind lab: faster with more wind (70–500 bpm), a small steady tick-tock in steady air, and a wider, irregular sway with gusts or a variable sector. They're coloured by wind category on a weather-severity scale (calm grey, light green, moderate yellow, high amber, gale red, storm purple) with an ink outline, and hovering or focusing one shows its category as a coloured chip with the threshold. Arrows only animate while on screen and stand still with reduced motion or in print.
- **Weather cards page** at `/weather` (linked from the Contents rail): paste any mix of METARs, SPECIs, TAFs and ATIS, or pull the weather from a saved plan, and each report becomes a card grouped by airport. Observation cards show a sky picture, a plain-English headline, the swaying wind arrow, visibility on a flight-category scale, a cloud-layer column, temperature with fog risk, QNH in hPa and inHg, the METAR trend, and how long ago it was issued. TAF cards add a timeline coloured by flight category (BECMG hatched while it changes, TEMPO/PROB as dashed bars below, hover for details) and a row per change group. ATIS works coded (D-ATIS) or in plain language, with the information letter, runways for landing and take-off, approach and transition level. Abbreviated ATIS (`VIS 10 KM`, `TEMP 17, DP 15`, `WIND 020 AT 5`, `BKN AT 3000`, `ARVG RWYS 32L, 32R`) reads too, and notices such as bird activity are listed on the card. US formats (`10SM`, `A2995`) and m/s winds are converted. Text that isn't a report is listed as not recognised; everything stays in the browser.
- **Wind lab** at `/wind-lab` (not linked from the reader): the tuning page for the arrows, with dozens of samples, live angle traces, and every rhythm, sway, chaos and easing setting. The arrows and the lab share one model (`src/lib/wind`).
- **Coastlines and country borders on the route map**: thin solid coastlines and dashed borders under the route, from Natural Earth 1:50m (public domain, via world-atlas). The outlines are built into a compact file at build time (`copy-assets`) and fetched only when a map is shown (about 140 KB compressed).

### Changed

- README screenshots refreshed (coloured wind arrows, map outlines, Import JSON) and a new one for the weather cards page.
- The route map fills its frame at every width instead of sitting in a fixed box with blank bands at the sides; gridlines and outlines run edge to edge.

### Fixed

- Route-map longitude labels west of Greenwich read "MW003" instead of "W003".
- Dispatcher remarks (DISP RMKS) showed only their first line, cutting off multi-line remarks mid-sentence. All lines are now read and shown as a list, one remark per item, with wrapped sentences joined back together.

## [1.3.1] - 2026-10-01

### Fixed

- Refreshing the page no longer lands ~160px below the top. Chrome re-pinned the summary while the saved plan was still reopening behind the blank-form banner; scroll position is now saved per page and restored once the plan has loaded (links to `#section` still jump to it).

### Changed

- Graphics animate as they come into view and replay when you scroll back: operational-impact bars grow from the centre line, fuel and timeline bars wipe in, gauges and runway bars grow, wind barbs spin into direction, V-speed cards and chart thumbnails rise in, and the summary strip, plane and split-flap codes replay.
- The vertical profile animates once, and again only after the Flight log section is collapsed and reopened; the route map stays static, since it's scrolled past constantly while logging.

## [1.3.0] - 2026-10-01

### Added

- **Collapsible sections.** Click a section's header strip to hide or show it. The Contents rail shows a drafting-box toggle (⊟ open / ⊞ closed) per section, plus **Collapse all / Expand all**; on phones and narrow windows that button moves to the top bar. Collapsed sections are remembered across reloads and plans, don't flash open on load, open automatically when you jump to them or when find-in-page matches inside, and always print expanded.
- **Flight summary graphic styles** (Settings → Appearance): Vertical profile (new default), Profile + times, Route silhouette, Progress timeline and Classic arc. Labels go into rows so they never overlap, and TOC/TOD show time, level and distance on hover.
- **Fill-in animation.** Every graphic draws in from left to right; on the classic arc a small airliner flies the route and the line follows it.
- **Split-flap airport codes.** ICAO codes are bordered split-flap tiles that flip through random characters and drop onto each letter at random; the blank form shows empty tiles.
- **Country flags.** A small bordered flag, centred above the IATA code, from the airport's ICAO prefix (flag-icons, MIT). Hover for the country, with a note for shared airports such as Basel-Mulhouse.
- **Δ columns** next to ATO and AFOB in the navigation log, showing the difference from plan.

### Changed

- Typing ATO or AFOB no longer shifts the navigation log; the differences have their own fixed-width columns.
- The `copy-worker` script is now `copy-assets` and also copies the flag images.
- README screenshots refreshed for the new summary strip, Contents rail and settings.
- With reduced motion switched on, every animation shows its final state immediately.

## [1.2.0] - 2026-10-01

### Added

- **PIC extra in the navigation log.** An *Include PIC extra* switch adds a **TFOB** column and profile line: EFOB plus the extra still on board, less the cost of carrying it (from the OFP's weight-change impact). AFOB is compared with TFOB while it's on.
- ETO and TFOB explanations in a footnote under the navigation log.

### Changed

- The PIC switch is a split pill at the right of the nav-log bar, faded until a PIC extra is entered.
- Download errors name an expired SimBrief link as the likely cause.

### Removed

- The "Try" example chips: SimBrief removes OFP PDFs after a while, so built-in links go stale. The code is kept and marked `@deprecated`.

## [1.1.0] - 2026-09-29

### Added

- **Build-info footer** on every page: version, commit (linked to GitHub), branch, a flag for uncommitted changes, build time and environment.
- Docker + nginx deployment of the static export; live at charts.massorbit.co.uk.

### Fixed

- The Docker build failed on a fresh checkout because `public/` didn't exist yet.

## [1.0.0] - 2026-09-28

### Added

- Reads a SimBrief (LIDO layout) OFP PDF from a link or upload, entirely in the browser, and lays out every section in OFP order: summary, fuel, alternate and routing, times and weights, flight log with vertical profile and route map, winds, ICAO flight plan, runway analysis, weather, NOTAMs, company NOTAMs, charts and full source text.
- Explanations on hover and keyboard focus for OFP terms, METAR/TAF groups and ICAO codes.
- Fillable actuals (times, weights, ATIS, clearance, ATO/AFOB, TLR), saved per flight plan in the browser.
- Each PDF is kept in the browser, so saved plans reopen without downloading again.
- Settings page for saved flights, stored entries, export, deletion and theme.
- Recent-plan chips, Blank plan, a planned vs actual timeline and day/night themes meeting WCAG AA.

[1.6.0]: https://github.com/redomar/ofp-reader/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/redomar/ofp-reader/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/redomar/ofp-reader/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/redomar/ofp-reader/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/redomar/ofp-reader/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/redomar/ofp-reader/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/redomar/ofp-reader/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/redomar/ofp-reader/releases/tag/v1.0.0
