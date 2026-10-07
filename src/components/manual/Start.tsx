"use client";

import { Section } from "../ui";
import { Eg, Kbd, Note, See, Steps, Topic, Ui, Where } from "./kit";

export function StartSection({ no }: { no: number }) {
  return (
    <Section id="m-start" no={no} title="Start here" meta={<span>what it is · the screen</span>}>
      <Topic id="what" title="What OFP Reader does">
        <p>
          OFP Reader turns a SimBrief operational flight plan (the PDF, in the airline-style LIDO layout) into an interactive briefing. Every part of the OFP
          gets its own section, in the same order as the PDF. Codes are explained when you hover over them, and the numbers are worked out for you: margins,
          wind components, landing fuel, how far off plan you are.
        </p>
        <p>
          It is built for people who already know roughly what an OFP is. The aim of this manual is to tell you <b>where each piece of information is</b>, both
          in the reader and on the printed OFP, and <b>what to do with it</b> at each stage of a flight.
        </p>
        <ul className="man-list">
          <li>
            <b>Runs in your browser.</b> The PDF is read on your device. Nothing is uploaded, and there is no account.
          </li>
          <li>
            <b>Keeps your notes.</b> Anything you type (times, fuel, ATIS, clearance, frequencies) is saved to this browser as you type, per flight.
          </li>
          <li>
            <b>Works offline once opened.</b> Each PDF is kept in the browser, so a plan reopens even after SimBrief has deleted its copy.
          </li>
        </ul>
        <Note kind="warn">For flight simulation only. Not for real-world navigation. Not affiliated with SimBrief or Navigraph.</Note>
      </Topic>

      <Topic id="screen" title="Finding your way around the screen">
        <p>Every page has the same layout, from top to bottom:</p>
        <dl className="man-dl">
          <dt>Top bar</dt>
          <dd>
            The OFP Reader logo (goes back to the reader), then the page&apos;s main tool: the SimBrief link box on the plan, the search box here. On the right:{" "}
            <Ui>⚙ Settings</Ui> and the day / night switch. On narrower screens <Ui>Collapse all</Ui> is here too; on wide ones it sits under the Contents card.
          </dd>
          <dt>Status row</dt>
          <dd>
            Just under the top bar. It shows the <b>flight chip</b> (the plan that is open, which you can change from any page), the loading bar while a PDF is
            read, and messages such as errors.
          </dd>
          <dt>Left rail</dt>
          <dd>
            The page tabs (<Ui>Plan</Ui>, <Ui>Weather</Ui>, <Ui>Radio</Ui>, <Ui>Settings</Ui>, <Ui>Manual</Ui>, <Ui>Wind lab</Ui>), then the <Ui>Contents</Ui>{" "}
            card. Contents lists the page&apos;s numbered sections grouped by phase of flight, highlights the one you&apos;re reading, and shows <b>01 / 14</b>{" "}
            style progress. A blue dot means that section holds something you typed.
          </dd>
          <dt>Sections</dt>
          <dd>
            Numbered cards. Click a section&apos;s title bar (or its box in Contents) to fold it away; it stays folded next time. The PDF page it comes from is
            on the right of the title bar, for example <span className="mono">PDF p.4–</span>.
          </dd>
        </dl>
        <p>On a phone the rail moves above the content and everything stacks into one column; nothing scrolls sideways.</p>
      </Topic>

      <Topic id="tooltips" title="Underlined labels explain themselves">
        <p>
          Any label with a dotted underline has an explanation. Hover over it with the mouse, or tab to it with the keyboard. That covers almost every OFP
          abbreviation (<span className="mono">EFOB</span>, <span className="mono">MORA</span>, <span className="mono">FINRES</span>…), ICAO flight plan codes,
          METAR / TAF groups and TLR columns. The same explanations are collected in the <See to="glossary">Glossary</See>.
        </p>
        <Eg>
          <p>
            Hover over <span className="mono">AVG W/C</span> in the Flight summary:{" "}
            <i>&ldquo;Average wind component over the route: M = headwind, P = tailwind (kt)&rdquo;</i>. The value underneath is also turned into words, for
            example <b>M012 → 12 kt headwind</b>.
          </p>
        </Eg>
      </Topic>

      <Topic id="blank-form" title="The blank form">
        <p>
          Before a plan is open, the reader shows the whole OFP as an empty form: every section, with dotted blanks where values will go. As a PDF is read, the
          blanks fill in, the airport codes flip in on split-flap tiles and the flight graphic draws from left to right. Use the empty form to learn where
          things will appear.
        </p>
      </Topic>

      <Topic id="active-flight" title="One active flight across every page">
        <p>
          The plan you open becomes the <b>active flight</b>. The reader, Weather, Radio and Settings all show that same flight, and switching it on one page
          switches it on every page, including other open tabs. The flight chip in the status row shows which one is active.
        </p>
        <Eg>
          <p>
            You open EZY2192 Madrid → Amsterdam in the reader, then click <Ui>Radio</Ui>: the Radio page already shows LEMD, the FIRs and EHAM for that flight.
            Choose another flight from the chip on the Radio page, then go back to <Ui>Plan</Ui>, and the reader has switched to it too.
          </p>
        </Eg>
      </Topic>
    </Section>
  );
}

export function OpenSection({ no }: { no: number }) {
  return (
    <Section id="m-open" no={no} title="Opening a plan" meta={<span>link · upload · saved</span>}>
      <Topic id="open-link" title="From a SimBrief link">
        <Steps>
          <li>
            In SimBrief, open your generated flight and copy the link to the OFP PDF. It looks like{" "}
            <span className="mono man-wrap">https://www.simbrief.com/ofp/flightplans/LEMDEHAM_PDF_1791211422.4264540f.pdf</span>.
          </li>
          <li>
            On the <Ui>Plan</Ui> page, paste it into the box at the top (<Ui>Paste a SimBrief PDF link…</Ui>) and press <Ui>Load</Ui> or <Kbd>Enter</Kbd>.
          </li>
          <li>
            The status row shows <i>Downloading PDF… → Reading page 3 of 14… → Decoding OFP…</i> while the form fills in.
          </li>
        </Steps>
        <p>
          The address bar changes to <span className="mono">/?ofp=&lt;link&gt;</span>, so you can bookmark or share it. Opening the same link again later uses
          the copy saved in your browser instead of downloading it.
        </p>
      </Topic>

      <Topic id="open-file" title="From a PDF file">
        <p>
          Click <Ui>Upload</Ui> and choose the PDF, or drag the file from your desktop and drop it <b>anywhere</b> on the page. Uploaded plans are saved too,
          and the address bar changes to <span className="mono">/?flight=&lt;id&gt;</span> so a reload reopens them.
        </p>
      </Topic>

      <Topic id="open-saved" title="Reopening a plan you've used before">
        <ul className="man-list">
          <li>
            <b>Just open the site.</b> With no link in the address bar, the reader reopens the active flight, the one you were last on.
          </li>
          <li>
            <b>The flight chip.</b> Click it in the status row of any page and pick a flight. Flights are listed newest first as{" "}
            <span className="mono">EZY2192 · LEMD→EHAM · 02OCT2026 · OFP 2</span>. The OFP number tells re-releases of the same flight apart.{" "}
            <span className="mono">PDF needed</span> means only your notes are stored in this browser, not the PDF (an imported JSON, for example).
          </li>
          <li>
            <b>Settings.</b> <Ui>⚙ Settings → Saved flights</Ui> lists every flight; <Ui>Open in reader</Ui> opens it.
          </li>
        </ul>
      </Topic>

      <Topic id="open-blank" title="Closing a plan: Blank plan">
        <p>
          The <Ui>← Blank plan</Ui> chip closes the plan on every page and returns the reader to the empty form. Nothing is deleted: the flight and your notes
          are still in <Ui>Saved flights</Ui>.
        </p>
      </Topic>

      <Topic id="open-redownload" title="Re-released plans and Re-download">
        <p>
          If dispatch re-issues the plan (a new OFP number), open the new link: it gets its own storage, so notes for OFP 1 and OFP 2 stay separate. If you
          reopen a link you&apos;ve used before and want SimBrief&apos;s latest copy rather than the saved one, use <Ui>Re-download</Ui> in the status row (only
          while SimBrief still has the file).
        </p>
      </Topic>

      <Topic id="open-errors" title="When a plan won't open">
        <dl className="man-dl">
          <dt>The link fails or reports a network error</dt>
          <dd>
            SimBrief only keeps OFP PDFs for a limited time. If you opened it before, use the flight chip instead (the saved copy still works). Otherwise
            download the PDF from SimBrief again and use <Ui>Upload</Ui>.
          </dd>
          <dt>&ldquo;No saved copy of … in this browser&rdquo;</dt>
          <dd>The notes are here but the PDF isn&apos;t (an imported JSON, or cleared browser data). Upload the PDF again; your notes reload with it.</dd>
          <dt>Some sections stay blank</dt>
          <dd>
            The reader is built for SimBrief&apos;s airline-style (LIDO) layout. Other layouts only partly fill the sections, but{" "}
            <See to="charts-source">Source text</See> always shows every line of the PDF.
          </dd>
        </dl>
      </Topic>
    </Section>
  );
}

/** "Where do I find…" lookup: the question, the reader section, the OFP location. */
const FIND: [string, string, string, string][] = [
  ["Flight number, callsign, registration, aircraft type", "Flight summary", "/#summary", "Page 1, the header lines"],
  ["Planned OUT / OFF / ON / IN times", "Flight summary (the flags) · Times & weights", "/#summary", "Page 1 header; TIMES block (around page 3)"],
  ["Cruise level and step climbs", "Flight summary → Cruise plan → FL STEPS", "/#summary", "Page 1, the cruise / step climb line"],
  ["Cost index", "Flight summary → Cost index", "/#summary", "Page 1, CRZ SYS / CI"],
  ["Average wind and headwind / tailwind", "Flight summary → AVG WIND, AVG W/C", "/#summary", "Page 1, AVG WIND and AVG W/C"],
  ["Weights and how close to the limits", "Flight summary → Weights; Times & weights → Weights", "/#summary", "Page 1, MAXIMUM / ESTIMATED weights"],
  ["Block, trip, reserve and alternate fuel", "Planned fuel", "/#fuel", "Page 1, the fuel block"],
  ["How much fuel I'll land with", "Planned fuel → Landing fuel, Arrival margin", "/#fuel", "Worked out: T/OFF fuel − trip"],
  ["Extra fuel the captain added", "Planned fuel → PIC EXTRA (you type it)", "/#fuel", "Not on the OFP; you add it"],
  ["Fuel en-route alternate (fuel ERA)", "Planned fuel / Alternate & routing (the amber line)", "/#fuel", "CONT line of the fuel block; Airport WX List"],
  ["Tankering advice, FMC fuel figures", "Planned fuel → FMC info", "/#fuel", "Page 1, under the fuel block"],
  ["Alternate airports, track, distance, fuel", "Alternate & routing → Alternate route to", "/#route", "ALTERNATE ROUTE TO block (around page 2)"],
  ["Deferred defects (MEL / CDL)", "Alternate & routing → MEL / CDL items", "/#route", "MEL / CDL block (around page 2)"],
  ["The filed route string", "Alternate & routing → Routing; ATC flight plan", "/#route", "Routing line; ICAO flight plan item 15"],
  ["What a higher level or more weight costs", "Alternate & routing → Operational impacts", "/#route", "OPERATIONAL IMPACTS table (around page 2)"],
  ["Taxi, airborne and block times", "Times & weights → Times", "/#times", "TIMES block (around page 3)"],
  ["Local time at the airports", "Times & weights → Dep local / Arr local", "/#times", "Worked out from the Z / L times"],
  ["Terrain warnings (MORA, drift-down)", "Times & weights → Terrain clearance check; Flight log", "/#times", "Terrain block; MOST CRITICAL MORA line"],
  ["Each waypoint: level, wind, time, fuel", "Flight log → Navigation log", "/#log", "FLIGHT LOG pages (from around page 4)"],
  ["Where I cross into each FIR", "Flight log → route map and the FIR rows", "/#log", "FIR rows in the flight log"],
  ["Vertical profile, TOC / TOD", "Flight log → Vertical profile", "/#log", "Worked out from the flight log"],
  ["Upper winds at other levels", "Wind information", "/#winds", "WIND INFORMATION block (around page 7)"],
  ["Equipment codes, PBN, SELCAL, EOBT", "ATC flight plan → Decoded", "/#fpl", "ICAO FLIGHT PLAN (around page 8)"],
  ["Each leg of the route with VOR / NDB frequencies", "ATC flight plan → Explain route & navaids", "/#fpl", "Item 15 + flight log FREQ column"],
  ["V1, VR, V2, flaps, FLEX temperature", "Runway analysis → Takeoff · planned", "/#tlr", "TAKEOFF AND LANDING REPORT (around page 10)"],
  ["Landing weight limits and landing distance", "Runway analysis → Landing · planned", "/#tlr", "TAKEOFF AND LANDING REPORT, landing part"],
  ["METAR and TAF for every airport", "Airport weather", "/#wx", "Airport WX List (around page 12)"],
  ["SIGMETs and AIRMETs on my route", "Airport weather (top); Flight log (map and profile)", "/#wx", "SIGMET / AIRMET advisories in the WX pages"],
  ["Closed runways, unserviceable navaids", "NOTAM → Critical filter", "/#notam", "NOTAM pages"],
  ["Airline notices", "Company NOTAM", "/#company", "COMPANY NOTAM pages"],
  ["Route map, wind charts, cross-section images", "Charts", "/#charts", "The image pages at the end of the PDF"],
  ["Anything else on the OFP", "Source text → Search all pages", "/#source", "Every page, as printed"],
  ["Radio frequencies to plan", "Radio page", "/radio", "ILS from the TLR; VOR / NDB from the flight log"],
];

export function FindSection({ no }: { no: number }) {
  return (
    <Section id="m-find" no={no} title="Find it fast" meta={<span>where is…?</span>}>
      <Topic id="find-table" title="Where is…?">
        <p>
          Look up what you need on the left. The middle column is where it sits in the reader (click it to go there with the active flight), and the right
          column is where the same thing is on the printed OFP. Page numbers vary between plans: each section&apos;s title bar shows the exact PDF page for
          yours.
        </p>
        <div className="tbl-wrap">
          <table className="tbl man-find">
            <thead>
              <tr>
                <th scope="col">I want to know…</th>
                <th scope="col">In the reader</th>
                <th scope="col">On the OFP</th>
              </tr>
            </thead>
            <tbody>
              {FIND.map(([q, r, href, o]) => (
                <tr key={q}>
                  <th scope="row">{q}</th>
                  <td>
                    <a href={href}>{r}</a>
                  </td>
                  <td>{o}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Topic>
      <Topic id="find-search" title="Searching">
        <ul className="man-list">
          <li>
            <b>This manual:</b> type in the search box at the top, or press <Kbd>/</Kbd> to jump to it. Results list the matching topics; select one to go
            there.
          </li>
          <li>
            <b>The OFP itself:</b> in the reader, <See to="charts-source">Source text</See> searches every line of every page.
          </li>
          <li>
            <b>NOTAMs:</b> the NOTAM sections have their own search box and filters.
          </li>
          <li>
            <b>The browser&apos;s find</b> (<Kbd>Ctrl</Kbd> / <Kbd>⌘</Kbd> + <Kbd>F</Kbd>) also finds text inside folded sections and opens them.
          </li>
        </ul>
        <Where reader="Source text, section 14" href="/#source" ofp="every page" />
      </Topic>
    </Section>
  );
}
