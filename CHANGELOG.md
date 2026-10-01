# Changelog

All notable changes to OFP Reader. Versions follow [Semantic Versioning](https://semver.org/).

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

[1.3.0]: https://github.com/redomar/ofp-reader/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/redomar/ofp-reader/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/redomar/ofp-reader/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/redomar/ofp-reader/releases/tag/v1.0.0
