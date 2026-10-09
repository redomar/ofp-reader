"use client";

import Link from "next/link";
import { Section } from "../ui";
import { Eg, Note, See, Steps, Topic, Ui, Where } from "./kit";

export function WeatherPageManual({ no }: { no: number }) {
  return (
    <Section id="m-weather" no={no} title="Weather page" meta={<span>/weather</span>}>
      <Where reader={<>Weather tab · /weather</>} href="/weather" ofp="Airport WX List, or any report you paste" />
      <Topic id="weather-what" title="Weather cards from any report">
        <p>
          The Weather page turns METARs, SPECIs, TAFs and ATIS into the same cards as the reader, one section per airport (ATIS first, then the observation,
          then the forecast). Use it for reports the OFP doesn&apos;t have: a newer METAR, an ATIS you copied, an airport you might divert to.
        </p>
      </Topic>
      <Topic id="weather-use" title="Using it">
        <Steps>
          <li>
            With an active flight, the box fills with that flight&apos;s METARs and TAFs automatically. The airports appear as sections in the Contents rail.
          </li>
          <li>
            Paste your own reports into the box, any mix, one after another. Coded and plain-language ATIS both work. What you paste is kept for next time and
            is <b>never replaced</b> by the plan&apos;s reports; a <Ui>Replace with … reports</Ui> button appears instead.
          </li>
          <li>
            <Ui>Load examples</Ui> fills the box with sample reports, and <Ui>Clear</Ui> empties it.
          </li>
          <li>
            Anything that can&apos;t be read (no airport code or time) is listed under <b>Not recognised</b> so you can fix it.
          </li>
        </Steps>
        <Eg title="Example · paste" pre={"METAR EGLL 021250Z 24012KT 9999 FEW040 15/09 Q1013\nEGLL ARR ATIS F 1250Z EXP ILS APCH RWY 27L"}>
          <p>
            You get an EGLL section with an ATIS card (information F, runway 27L, ILS approach) and a METAR card (VFR, a wind arrow for 240° at 12 kt,
            visibility 10 km or more, few clouds at 4000 ft, QNH 1013).
          </p>
        </Eg>
      </Topic>
    </Section>
  );
}

export function RadioPageManual({ no }: { no: number }) {
  return (
    <Section id="m-radio" no={no} title="Radio page" meta={<span>/radio</span>}>
      <Where
        reader={<>Radio tab · /radio</>}
        href="/radio"
        ofp="ILS from the TLR's notes; VOR / NDB from the flight log FREQ column; FIRs from the flight log"
      />
      <Topic id="radio-what" title="What's filled in and what you add">
        <p>
          The Radio page is for planning the flight&apos;s frequencies, shown in radio-panel windows. The OFP doesn&apos;t carry COMMS frequencies, so you type
          those in once; the NAV frequencies it does carry are filled in for you and marked as coming from the OFP.
        </p>
        <dl className="man-dl">
          <dt>1 · Departure, 3 · Destination</dt>
          <dd>ATIS, DEL, GND, TWR and APP for you to type; the ILS for each runway from the TLR (the planned runway first).</dd>
          <dt>2 · En route</dt>
          <dd>One centre frequency per FIR / UIR you cross, in order, with its ETO. The fuel ERA&apos;s frequencies appear here too when there is one.</dd>
          <dt>4 · Alternates</dt>
          <dd>The same five COMMS slots for each alternate.</dd>
          <dt>5 · NAV tuning</dt>
          <dd>
            What to set on the NAV and ADF radios, in the order you&apos;ll need it: the departure ILS (or the reciprocal for a return), each VOR and NDB on the
            route with its ETO, then the landing ILS. Each has its ident in <b>Morse</b> so you can check it by ear.
          </dd>
        </dl>
      </Topic>
      <Topic id="radio-typing" title="Typing frequencies">
        <ul className="man-list">
          <li>
            Type the digits only: <span className="mono">11895</span> becomes <span className="mono">118.95</span>, and COMMS read with three decimals once you
            leave the box (<span className="mono">118.950</span>).
          </li>
          <li>
            Checks as you type: COMMS must be 118.000–136.990 on a 25 or 8.33 kHz channel. A wrong one turns the window <b className="man-red">red</b> with a
            stop sign and says why (<i>Outside the COMMS band</i>, <i>NAV frequency, not COMMS</i>, <i>Not a 25 / 8.33 kHz channel</i>).
          </li>
          <li>
            A frequency a NOTAM reports as out of service (on test, U/S, not usable) gets an <b className="man-amber">amber</b> ring.
          </li>
          <li>Everything you type is saved with the flight and appears in Settings → Saved entries.</li>
        </ul>
      </Topic>
      <Topic id="radio-add" title="Adding stations">
        <p>
          ATC often hands you to stations the plan can&apos;t know about. Under any airport or En route, <Ui>+ Add channel</Ui> adds a row with a station name,
          a type (ATIS, DEL, GND, TWR, DEP, APP, CTR, INFO) and a frequency. In NAV tuning, <Ui>+ Add navaid</Ui> adds a VOR, VOR/DME, NDB, ILS, LOC or DME with
          its ident. <Ui>Remove</Ui> takes either away.
        </p>
        <Eg>
          <p>
            Leaving Luton you&apos;re handed to Essex Radar: under Departure, <Ui>+ Add channel</Ui>, name <span className="mono">ESSEX RADAR</span>, type APP,
            frequency <span className="mono">12505</span> → <span className="mono">125.050</span>.
          </p>
        </Eg>
      </Topic>
      <Topic id="radio-style" title="Display style">
        <p>
          The <Ui>Display</Ui> buttons on the right of the status row change how the windows look: <Ui>Scanlines</Ui> (VFD glass with a pixel font),{" "}
          <Ui>Dots</Ui> (VFD behind a dot mesh) or <Ui>Classic</Ui> (olive LCD by day, amber by night).
        </p>
      </Topic>
    </Section>
  );
}

export function SettingsManual({ no }: { no: number }) {
  return (
    <Section id="m-settings" no={no} title="Settings" meta={<span>/settings</span>}>
      <Where reader={<>⚙ Settings · /settings</>} href="/settings" ofp="Not on the OFP: your saved flights and preferences" />
      <Topic id="settings-flights" title="Saved flights">
        <p>
          Every plan you open gets its own storage, keyed by flight number, date, route and OFP number (for example{" "}
          <span className="mono">EZY2192_02OCT2026_LEMDEHAM_OFP2</span>), so re-releases and the same flight on another day never mix. The table lists them
          newest first, marks the <b>Active</b> one and shows whether the PDF is saved and its size.
        </p>
        <p>From each row you can make it active, open it in the reader, or delete it (after a confirmation).</p>
      </Topic>
      <Topic id="settings-data" title="Stored data for one flight">
        <p>Select a flight to see what&apos;s stored: its storage key, the saved PDF, the SimBrief link, and every entry you typed with its section.</p>
        <dl className="man-dl">
          <dt>Open in reader · Export JSON</dt>
          <dd>Open it, or download a JSON file of its details and entries (a backup, or to move it to another browser).</dd>
          <dt>Clear entries · Delete flight</dt>
          <dd>Remove what you typed but keep the flight, or remove the flight altogether. Both ask first.</dd>
          <dt>Deleting single entries</dt>
          <dd>Press the unlock button above the entries table; a delete button appears on each row. Lock it again when you&apos;re done.</dd>
          <dt>Import JSON</dt>
          <dd>Brings back exported files, from this or another browser (several at once). Entries are merged and the file&apos;s values win.</dd>
        </dl>
      </Topic>
      <Topic id="settings-appearance" title="Appearance">
        <dl className="man-dl">
          <dt>Theme</dt>
          <dd>Match system, Day (chart-paper light) or Night (low glare). The day / night button in the top bar of every page flips between the two.</dd>
          <dt>Flight summary graphic</dt>
          <dd>Vertical profile (default), Profile + times, Route silhouette, Progress timeline or Classic arc.</dd>
          <dt>Route map</dt>
          <dd>Contours (default), No contours, or Elevation (height bands on land and depth bands at sea, with a key under the waypoint card).</dd>
          <dt>FIR / UIR on the route map</dt>
          <dd>Lines with boundaries (default), Lines only (circles where you cross in), or Hidden.</dd>
        </dl>
      </Topic>
      <Topic id="settings-storage" title="Storage & privacy">
        <p>
          How many flights, entries and PDFs are stored and how much space they take. <Ui>Delete all saved data</Ui> removes every flight, entry and PDF (it
          asks first, and can&apos;t be undone). See <See to="data-where">Saved data &amp; privacy</See>.
        </p>
      </Topic>
    </Section>
  );
}

export function LabManual({ no }: { no: number }) {
  return (
    <Section id="m-lab" no={no} title="Wind lab" meta={<span>/wind-lab · experimental</span>}>
      <Topic id="lab-what" title="An experimental page">
        <p>
          Wind lab (the dashed, hatched tab under the page tabs) is where the swaying wind arrows are tuned: how fast they swing for a given wind, how gusts
          kick them, and how irregular the motion is. <Ui>Controls</Ui> has presets and every setting; <Ui>Filters &amp; custom card</Ui> narrows the sample
          arrows and can add a card from values you type (off by default); <Ui>Arrows</Ui> shows METAR, PWIND and AVG WIND samples.
        </p>
        <Note>It changes nothing in the reader. Use it to see how the arrows behave, or ignore it.</Note>
        <p>
          <Link href="/wind-lab">Open Wind lab</Link>
        </p>
      </Topic>
    </Section>
  );
}
