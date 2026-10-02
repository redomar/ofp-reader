# Changelog

All notable changes to OFP Reader. Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- **Weather cards in the reader.** Airport weather now shows each airport's METAR and TAF as the same cards as the weather page (sky picture, headline, swaying wind arrow, visibility and cloud diagrams, TAF timeline and change groups, raw text with tooltips), under the existing airport header with its role, name, category and "Watch" hazards. The blank template is unchanged.
- Weather cards: observation cards share a row and each TAF takes the full width below, so a lone METAR no longer leaves half the row empty.

### Fixed

- TAF change groups after a CAVOK base kept saying "CAVOK" even when they brought cloud, showers or lower visibility, and their cloud layers were dropped.

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

[1.4.0]: https://github.com/redomar/ofp-reader/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/redomar/ofp-reader/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/redomar/ofp-reader/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/redomar/ofp-reader/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/redomar/ofp-reader/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/redomar/ofp-reader/releases/tag/v1.0.0
