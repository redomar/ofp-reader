"use client";

import Link from "next/link";
import { Section } from "../ui";
import { Eg, Kbd, Note, See, Steps, Topic, Ui } from "./kit";

/** Phase → what to look at, what to type, where. The one-glance card at the top of Workflows. */
const CARD: [string, string, string, [string, string][]][] = [
  [
    "Briefing",
    "Summary flags (forecast at take-off and landing), fuel and arrival margin, alternates, SIGMETs, critical NOTAMs",
    "PIC extra fuel and its reason",
    [
      ["Summary", "/#summary"],
      ["Fuel", "/#fuel"],
      ["Weather", "/#wx"],
      ["NOTAM", "/#notam"],
    ],
  ],
  [
    "At the gate",
    "MCDU set-up sheet, planned V-speeds and flaps, departure ILS, frequencies",
    "ATIS, ATC clearance, COMMS frequencies",
    [
      ["Routing", "/#route"],
      ["Runway analysis", "/#tlr"],
      ["Radio", "/radio"],
    ],
  ],
  [
    "Taxi & take-off",
    "Take-off actuals, the runway you were given",
    "OUT and OFF (clock button), take-off actuals",
    [
      ["Times", "/#times"],
      ["Runway analysis", "/#tlr"],
    ],
  ],
  [
    "Cruise",
    "Next waypoint's ETO / RETO and EFOB, Δ columns, FIR crossings, fuel ERA",
    "ATO and AFOB at each waypoint (clock and ✓), RVSM check",
    [
      ["Flight log", "/#log"],
      ["Times & weights", "/#times"],
    ],
  ],
  [
    "Descent & landing",
    "Destination METAR / TAF, landing performance, arrival ILS, alternates",
    "Landing actuals, ON",
    [
      ["Weather", "/#wx"],
      ["Runway analysis", "/#tlr"],
      ["Radio", "/radio"],
    ],
  ],
  [
    "After landing",
    "Planned vs actual timeline, block time against schedule",
    "IN, actual weights; export if you want a copy",
    [
      ["Times & weights", "/#times"],
      ["Settings", "/settings"],
    ],
  ],
];

export function WorkflowsSection({ no }: { no: number }) {
  return (
    <Section id="m-flows" no={no} title="Workflows" meta={<span>quick reference by phase</span>}>
      <Topic id="flow-card" title="Quick reference card">
        <p>One row per phase of flight: what to read, what to type, and where. The links open the reader at that section for the active flight.</p>
        <div className="tbl-wrap">
          <table className="tbl man-card">
            <thead>
              <tr>
                <th scope="col">Phase</th>
                <th scope="col">Read</th>
                <th scope="col">Type in</th>
                <th scope="col">Go to</th>
              </tr>
            </thead>
            <tbody>
              {CARD.map(([phase, read, type, links]) => (
                <tr key={phase}>
                  <th scope="row">{phase}</th>
                  <td>{read}</td>
                  <td>{type}</td>
                  <td>
                    <div className="man-go">
                      {links.map(([l, href]) => (
                        <Link key={l} href={href} className="chip-btn">
                          {l}
                        </Link>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Topic>

      <Topic id="flow-brief" title="1 · Briefing in ten minutes">
        <Steps>
          <li>
            <b>Open the plan</b> (<See to="open-link">paste the link</See>). Check the top of <Link href="/#summary">Flight summary</Link>: flight number, date,
            registration and the <span className="mono">OFP</span> number. A higher OFP number than you expected means the plan was re-issued.
          </li>
          <li>
            <b>Weather at both ends.</b> The small sky icon on each country flag in the summary is the TAF forecast <i>at your take-off and landing time</i>,
            ringed in its flight category (VFR, MVFR, IFR, LIFR). A <b>T</b> on it means a TEMPO or PROB group applies then. Hover over it for the detail.
          </li>
          <li>
            <b>Fuel.</b> In <Link href="/#fuel">Planned fuel</Link>, read <Ui>Landing fuel</Ui> and <Ui>Arrival margin</Ui> (Comfortable or Tight). If you want
            more, type it into <Ui>PIC EXTRA</Ui> and give a reason; <Ui>TOTAL FUEL</Ui> and the time it buys update straight away.
          </li>
          <li>
            <b>Alternates and the fuel ERA.</b> <Link href="/#route">Alternate &amp; routing</Link> lists each alternate with track, distance, level, wind and
            fuel. An amber <Ui>Fuel en-route alternate</Ui> line names the airport the contingency fuel relies on and when you pass it.
          </li>
          <li>
            <b>Weather on the way.</b> At the top of <Link href="/#wx">Airport weather</Link>, the SIGMET / AIRMET badges say how many affect your route. Red{" "}
            <Ui>On your route</Ui> cards are the ones at your level and time. They are also drawn on the route map and profile in the Flight log.
          </li>
          <li>
            <b>NOTAMs.</b> In <Link href="/#notam">NOTAM</Link>, switch on <Ui>Critical</Ui> (closed, unserviceable, not available) and <Ui>Planned RWY</Ui>{" "}
            (mentions your take-off or landing runway). That usually leaves a handful worth reading.
          </li>
          <li>
            <b>Terrain.</b> The <Ui>MOST CRITICAL MORA</Ui> line at the top of the Flight log and the <Ui>Terrain clearance check</Ui> in Times &amp; weights
            tell you where the high ground is.
          </li>
        </Steps>
        <Note>
          Fold the sections you&apos;ve finished with (click the title bar). The Contents rail shows <i>closed</i> next to them, so you can see what&apos;s
          left.
        </Note>
      </Topic>

      <Topic id="flow-gate" title="2 · At the gate: setting up">
        <Steps>
          <li>
            <b>Program the FMS</b> from the <Ui>Print MCDU set-up sheet</Ui> button at the top of Alternate &amp; routing. It lists INIT A, INIT B, F-PLN, PERF
            TAKE OFF, RAD NAV and winds in the order you type them in. <Ui>Copy text</Ui> puts it on the clipboard.
          </li>
          <li>
            <b>Write down the ATIS</b> in the <Ui>ATIS</Ui> box in <Link href="/#times">Times &amp; weights</Link>, and the departure clearance in{" "}
            <Ui>Departure ATC clearance</Ui> (Alternate &amp; routing). Both are saved with the flight.
          </li>
          <li>
            <b>Frequencies.</b> On the <Link href="/radio">Radio</Link> page, type the departure ATIS, DEL, GND and TWR (from your charts or the sim). The
            departure ILS and every VOR / NDB on the route are already filled in from the OFP, in the order you&apos;ll need them under <Ui>NAV tuning</Ui>.
          </li>
          <li>
            <b>Take-off performance.</b> <Link href="/#tlr">Runway analysis → Takeoff · planned</Link> shows V1 / VR / V2, flaps, FLEX temperature and how far
            the planned weight is below the limit. If ATC gives you another runway, type it in <Ui>Takeoff actual → RWY</Ui> to see that runway&apos;s figures
            and wind components.
          </li>
        </Steps>
        <Eg title="Example: runway change">
          <p>
            The plan is for 36L but the ATIS says 32R. Type <span className="mono">32R</span> in Takeoff actual → RWY. An amber badge says <i>planned 36L</i>,
            and underneath you get 32R&apos;s head and crosswind from the planned wind, its weight limit and margin. The MCDU sheet&apos;s PERF TAKE OFF page
            also switches to 32R, noting the planned runway.
          </p>
        </Eg>
      </Topic>

      <Topic id="flow-takeoff" title="3 · Pushback to take-off">
        <Steps>
          <li>
            <b>OUT.</b> In <Link href="/#times">Times &amp; weights → Times</Link>, every Actual Z box shows the current UTC time in grey with a clock button.
            Click the clock next to <Ui>OUT</Ui> as you push back. The <Ui>Δ</Ui> column shows how early or late you are against the estimate.
          </li>
          <li>
            <b>OFF.</b> Click the clock next to <Ui>OFF</Ui> as you lift off. Now switch on <Ui>Times &amp; weights OFF</Ui> above the navigation log: a{" "}
            <Ui>RETO</Ui> column recalculates every ETO from your real take-off time. (The switch needs the nav log&apos;s own <Ui>Actual OFF</Ui> box to be
            empty, so there&apos;s only one take-off time.)
          </li>
          <li>
            <b>Take-off actuals</b> (optional): runway, OAT, wind, QNH, flaps, speeds in <Ui>Takeoff actual</Ui> under Runway analysis.
          </li>
        </Steps>
        <Note>
          Typed a time wrong? The clock button stays next to filled boxes, so one click puts in the time now. You can also select the box and type over it.
        </Note>
      </Topic>

      <Topic id="flow-cruise" title="4 · In cruise: at every waypoint">
        <Steps>
          <li>
            <b>Find the next fix</b> in <Link href="/#log">Flight log → Navigation log</Link>. The first unfilled waypoint after your last entry is outlined in
            blue: its ATO box offers the time now, its AFOB box offers the <b>predicted fuel</b>.
          </li>
          <li>
            <b>As you pass it,</b> click the clock in ATO (or press <Kbd>Enter</Kbd> in the box). The <Ui>Δ</Ui> beside it shows minutes early (green) or late
            (red) against ETO, or RETO if that&apos;s on.
          </li>
          <li>
            <b>Fuel:</b> check the predicted value against the aircraft&apos;s fuel on board. If it matches, click <Ui>✓</Ui>. If not, accept it and nudge with{" "}
            <Ui>▲ ▼</Ui> (0.1 t each), or type the real figure. The fuel <Ui>Δ</Ui> turns red when you&apos;re below plan.
          </li>
          <li>
            <b>Filling one you missed?</b> Hover over any row: it offers the time now and its own predicted fuel, worked out from the nearest fix above that you
            did fill in.
          </li>
        </Steps>
        <Eg title="Example: predicted fuel">
          <p>
            At MOSIS you logged AFOB <b>5.0</b> against an EFOB of 5.2, so Δ is <b>−0.2</b>. The next fix, BOBSI, has EFOB 4.9, so its AFOB box offers{" "}
            <b>4.7</b> (4.9 − 0.2). With <Ui>Include PIC extra</Ui> on, the prediction uses TFOB (EFOB plus the PIC extra still on board) instead.
          </p>
        </Eg>
        <p>
          While you&apos;re there: the route map shows where you are relative to FIR boundaries (the marks across the route), SIGMET areas and the fuel ERA. Do
          the <Ui>RVSM altimeter check</Ui> in Times &amp; weights: type LEFT, STBY and RIGHT, and it says whether the primaries agree within 200 ft.
        </p>
      </Topic>

      <Topic id="flow-change" title="5 · When something changes en route">
        <dl className="man-dl">
          <dt>Diverting, or checking an alternate</dt>
          <dd>
            <Ui>Print alternate sheet</Ui> (Alternate &amp; routing) has one page per alternate, each starting with FINRES, plus return to departure and the
            fuel ERA. The alternate&apos;s weather is in Airport weather; its frequencies under Alternates on the Radio page.
          </dd>
          <dt>Asked to climb or descend, or flying faster</dt>
          <dd>
            <Ui>Operational impacts</Ui> (Alternate &amp; routing) shows the fuel and time cost of cruising a level or two higher or lower, or carrying more
            weight. Red bars cost fuel; green bars save it.
          </dd>
          <dt>New weather</dt>
          <dd>
            Paste the new METAR, TAF or ATIS on the <Link href="/weather">Weather</Link> page to read it as cards. Your pasted reports are kept and never
            overwritten by the plan&apos;s.
          </dd>
          <dt>ATC hands you to a station you didn&apos;t plan</dt>
          <dd>
            On the Radio page, use <Ui>+ Add channel</Ui> under the airport or En route and type its name and frequency.
          </dd>
        </dl>
      </Topic>

      <Topic id="flow-arrival" title="6 · Descent and landing">
        <Steps>
          <li>
            <b>Destination weather:</b> the METAR and TAF cards in <Link href="/#wx">Airport weather</Link>. An amber badge warns when the temperature /
            dew-point spread is 2 °C or less (fog risk).
          </li>
          <li>
            <b>Landing performance:</b> <Link href="/#tlr">Runway analysis → Landing · planned</Link> has the landing weight limit and factored landing distance
            against the runway length. If you&apos;re given another runway, type it in <Ui>Landing actual → RWY</Ui> for its figures and an estimated landing
            distance.
          </li>
          <li>
            <b>Approach:</b> the arrival ILS is at the end of <Ui>NAV tuning</Ui> on the Radio page, with its Morse ident.
          </li>
          <li>
            <b>ON:</b> click the clock next to ON in Times &amp; weights when you touch down.
          </li>
        </Steps>
      </Topic>

      <Topic id="flow-after" title="7 · After landing">
        <Steps>
          <li>
            Click the clock for <Ui>IN</Ui> at the gate. Under Times you now see taxi out, airborne and taxi in times next to the plan, the block time against
            schedule, and a <b>planned vs actual timeline</b>.
          </li>
          <li>Type the final weights if you want them recorded (Times &amp; weights → Weights).</li>
          <li>
            Everything is already saved. To keep a copy outside this browser, use <Ui>Export JSON</Ui> in <Link href="/settings">Settings</Link>.
          </li>
          <li>
            Close the plan with <Ui>← Blank plan</Ui>, or just open the next one.
          </li>
        </Steps>
      </Topic>

      <Topic id="flow-shortcuts" title="Shortcuts worth knowing">
        <ul className="man-list">
          <li>
            <Kbd>Enter</Kbd> in an empty ATO / AFOB box accepts what it offers; <Kbd>↑</Kbd> <Kbd>↓</Kbd> in the latest AFOB nudge it by 0.1.
          </li>
          <li>
            Click a chart, then use <Kbd>←</Kbd> <Kbd>→</Kbd> to step through waypoints, and <Kbd>+</Kbd> <Kbd>−</Kbd> to zoom the map.
          </li>
          <li>
            <Kbd>/</Kbd> jumps to this manual&apos;s search box. All shortcuts are in <See to="keys-all">Keyboard &amp; gestures</See>.
          </li>
        </ul>
      </Topic>
    </Section>
  );
}
