# Radio page: methodology

## Goal
A **Radio** page (`/radio`) for the frequencies a flight needs: COMMS that the OFP doesn't carry (typed in once, kept with the flight) and the NAV frequencies the OFP does carry (filled in automatically).

## 1. Which plan
- The reader has no "current plan" across pages, so the page picks one. It defaults to the most recently updated saved flight and offers a menu of saved flights (as the weather page does). `/radio?flight=<id>` opens a specific one, so the reader can link straight to its plan.
- The OFP is re-read from the PDF saved in the browser (IndexedDB) with `readOfp`. Nothing is downloaded.

## 2. Where typed frequencies live
- In the flight's own record (`useField`), keys `radio.<ICAO>.<service>` and `radio.fir.<FIR>`, section "Radio".
- So they're saved as you type, are flight-specific, and travel with **Export / Import JSON** and appear in Settings → Stored data.

## 3. What's filled in automatically (carried over from the OFP)
| Source in the OFP | What it gives | Where it shows |
| --- | --- | --- |
| Flight log `FREQ` under a fix | VOR (108–117.95 MHz) / NDB (190–1750 kHz) on the route, with ETO | En route + Navaids |
| TLR take-off ACARS table `NOTES` | ILS per departure runway (planned runway first) | Departure card |
| TLR landing ACARS table `NOTES` | ILS per destination runway | Destination card |
| Flight log FIR crossings | Each FIR / UIR entered, with ETO: a row to fill its centre frequency | En route |
| NOTAMs mentioning `FREQ nnn.nnn` or an ILS / VOR frequency | Outages ("ON TEST", "U/S", "NOT USABLE") | Warning badge on any matching frequency |

Carried-over values are read-only and marked "from OFP", so they're never confused with typed ones.

## 4. What you fill in
- **Per airport:** departure, destination and each alternate get ATIS · DEL · GND · TWR · APP (DEP at the departure).
- **En route:** one centre frequency per FIR crossing, listed in the order crossed with its ETO.
- **Added channels:** "+ Add channel" under each airport and en route, for stations ATC hands you to that the plan can't know (e.g. Oxford Approach instead of London). Each has a name and a frequency, stored as `radio.<scope>.x<n>.name` / `.freq`, and can be removed.
- **Checks as you type:** a dot is inserted after three digits (`118` → `118.`). COMMS must be 118.000–136.990 MHz on 8.33 / 25 kHz channels, otherwise the field is flagged. A NAV frequency typed in a COMMS slot is called out.

## 5. Design (consistent with the plan page)
- Same shell: top bar with Brand "· Radio", numbered collapsible Sections, a Contents rail, and day / night themes.
- Sections: 01 Departure · 02 En route · 03 Destination · 04 Alternates · 05 NAV tuning.
- **05 NAV tuning** is a timeline in flight order: the planned departure runway's ILS (or "no ILS", plus the reciprocal runway's ILS for a quick return), each VOR / NDB on the route with its ETO, then the planned landing runway's ILS. Each step shows the ident in Morse, which radio to tune it on (ILS on NAV 1, VOR on NAV 2, NDB on the ADF, in kHz) and a NOTAM ring if it's out of service. "+ Add navaid" adds your own (VOR, VOR/DME, NDB, ILS, LOC, DME) with the same checks.
- **Flair:** each frequency sits in a small radio-panel "window": dark glass, amber monospaced digits, and a dim `888.888` placeholder like an unlit display. Carried-over ones use the same window, dimmer and with a "from OFP" tag. It stays within the existing tokens, rules and fonts.
- Airport headers reuse the split-flap ICAO tiles and the flags.

## 6. Links
- From the reader: "Radio frequencies →" in the Contents rail, opening `/radio?flight=<id>`.
- Later, optionally: a COMMS block on the MCDU / alternate print sheets from the same fields.
