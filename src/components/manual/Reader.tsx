"use client";

import { Section } from "../ui";
import { Eg, Kbd, Note, See, Steps, Term, Topic, Ui, Where } from "./kit";

/*
 * The reader, section by section: what each one shows, where it comes from on the OFP,
 * what you can do there, and an example. Examples are illustrative (a LEMD → EHAM plan).
 */

export function SummaryManual({ no }: { no: number }) {
  return (
    <Section id="m-summary" no={no} title="Flight summary" meta={<span>reader 01 · OFP p.1</span>}>
      <Where reader="01 · Flight summary" href="/#summary" ofp="Page 1: the header block at the top of the OFP" />
      <Topic id="summary-id" title="The ID bar">
        <p>
          The first line: <Ui>FLT</Ui> (flight number), <Term k="ATC C/S" /> (the callsign ATC will use), date, registration, aircraft type, the{" "}
          <Term k="OFP" /> number and the <Term k="RELEASE" /> time. Check the OFP number first: it goes up each time dispatch re-issues the plan.
        </p>
      </Topic>
      <Topic id="summary-flags" title="The departure and arrival flags">
        <p>
          Big split-flap ICAO codes with the airport name, country flag, IATA code and the planned times: <Term k="OUT" /> and <Term k="OFF" /> under departure,{" "}
          <Term k="ON" /> and <Term k="IN" /> under arrival.
        </p>
        <p>
          The small sky icon on each flag is the <b>TAF forecast for your take-off or landing time</b>. Its ring is the flight category: green VFR, blue MVFR,
          red IFR, magenta LIFR. A <b>T</b> means a TEMPO or PROB group is active then; the icon shows the worse of the two. Hover over it to read both.
        </p>
        <Eg>
          <p>
            EHAM shows a cloud with a red ring and a T: at your landing time the TAF prevails with broken cloud at 1200 ft (MVFR), but a{" "}
            <span className="mono">TEMPO 4000 SHRA BKN008</span> group makes it IFR at times.
          </p>
        </Eg>
      </Topic>
      <Topic id="summary-graphic" title="The flight graphic">
        <p>
          Between the flags is a picture of the flight. Choose its style in <See to="settings-appearance">Settings → Appearance</See>: vertical profile (the
          default, to scale with TOC / TOD and step climbs), profile with clock times, the route&apos;s real shape, a gate-to-gate timeline, or the classic arc.
        </p>
      </Topic>
      <Topic id="summary-fields" title="Cruise, distance and wind figures">
        <dl className="man-dl">
          <dt>
            <Term k="CRZ SYS" /> · Cost index
          </dt>
          <dd>The speed schedule. The cost index is also described in words: economy (20 or less), balanced, or fast (60 or more).</dd>
          <dt>
            <Term k="GND DIST" /> · <Term k="AIR DIST" /> · <Term k="G/C DIST" />
          </dt>
          <dd>
            Ground and air distance, and great-circle distance. Underneath: air distance against ground (more means a headwind) and how direct the route is as a
            percentage.
          </dd>
          <dt>
            <Term k="AVG WIND" /> · <Term k="AVG W/C" /> · <Term k="AVG ISA" />
          </dt>
          <dd>
            Average wind (with a wind arrow that sways faster in stronger wind), the component in words (<span className="mono">M015</span> = 15 kt headwind)
            and temperature against ISA.
          </dd>
          <dt>
            <Term k="FUEL BIAS" /> · <Term k="STA" /> · <Term k="CTOT" />
          </dt>
          <dd>The burn correction for this airframe, scheduled arrival (with &ldquo;12 min early / late&rdquo; against the planned IN) and any slot time.</dd>
          <dt>
            <Term k="ALTN" /> · <Term k="TKOF ALTN" />
          </dt>
          <dd>The destination alternate (with its name) and the take-off alternate if one was needed.</dd>
        </dl>
      </Topic>
      <Topic id="summary-weights" title="Weights and the cruise plan">
        <p>
          <Ui>Weights</Ui> compares <Term k="TOW" />, <Term k="LAW" /> and <Term k="ZFW" />: maximum, estimated, the margin, and a gauge showing how full each
          one is. <Ui>Cruise plan</Ui> lists the <Term k="FL STEPS" /> as badges (<span className="mono">MOSIS · FL360</span> = climb to FL360 at MOSIS),
          dispatcher remarks, and the <Term k="WX PROG" /> / <Term k="OBS" /> times of the forecast the plan used.
        </p>
        <Eg pre={"MAXIMUM   TOW 70000  LAW 62500  ZFW 59000\nESTIMATED TOW 66120  LAW 61080  ZFW 57900"}>
          <p>Shown as TOW margin 3880 kg (94.5 %), LAW margin 1420 kg (97.7 %), ZFW margin 1100 kg (98.1 %). LAW is the tightest here.</p>
        </Eg>
      </Topic>
    </Section>
  );
}

export function FuelManual({ no }: { no: number }) {
  return (
    <Section id="m-fuel" no={no} title="Planned fuel" meta={<span>reader 02 · OFP p.1</span>}>
      <Where reader="02 · Planned fuel" href="/#fuel" ofp="Page 1: the fuel block (FUEL / ARPT / FUEL / TIME) below the header" />
      <Topic id="fuel-table" title="The fuel table">
        <p>
          Every line of the OFP fuel block, in the plan&apos;s unit, with the airport it relates to and its time equivalent: <Term k="TRIP" />,{" "}
          <Term k="CONT" /> (contingency), <Term k="ALTN" />, <Term k="FINRES" />, any additional or extra fuel, <Term k="TAXI" />, then the totals{" "}
          <span className="mono">MINIMUM T/OFF FUEL</span>, <span className="mono">T/OFF FUEL</span> and <span className="mono">BLOCK FUEL</span>
          (highlighted).
        </p>
        <Eg
          title="Example · as printed"
          pre={
            "FUEL               ARPT    FUEL   TIME\nTRIP               AMS     5040   0219\nCONT 5%            BIO      252   0007\nALTN               RTM     1180   0024\nFINRES                     1040   0030\nMINIMUM T/OFF FUEL         7512   0320\nT/OFF FUEL                 7512   0320\nTAXI               MAD      200   0012\nBLOCK FUEL                 7712"
          }
        >
          <p>
            In the reader the CONT line&apos;s airport (BIO) is underlined: it&apos;s the fuel en-route alternate. Landing fuel is 7512 − 5040 = <b>2472</b>,
            which is 252 above ALTN + FINRES (2220), so the arrival margin shows <b>Tight</b>. Above 400 it shows Comfortable.
          </p>
        </Eg>
      </Topic>
      <Topic id="fuel-pic" title="Adding PIC extra fuel">
        <Steps>
          <li>
            Type the extra into <Ui>PIC EXTRA</Ui> (whole kg or lb). The time it buys at the average fuel flow appears beside it, for example{" "}
            <span className="mono">+8 min</span>.
          </li>
          <li>
            <Ui>TOTAL FUEL</Ui> becomes block + PIC extra, and a grey <Ui>PIC</Ui> segment joins the composition bar.
          </li>
          <li>
            Give a reason in <Ui>Reason for PIC extra</Ui> (weather at destination, expected holding…). It&apos;s saved with the flight.
          </li>
          <li>
            In the Flight log, switch on <Ui>Include PIC extra</Ui> to see fuel on board with it at every waypoint (<See to="log-navlog">TFOB</See>).
          </li>
        </Steps>
      </Topic>
      <Topic id="fuel-era" title="The fuel en-route alternate (fuel ERA)">
        <p>
          Some contingency policies (a reduced percentage of trip fuel, for example) are only allowed with an airport along the route that you could divert to.
          LIDO plans name it on the CONT line, in the Airport WX List as <i>Fuel Enroute Airport</i> and in the NOTAMs. When the plan has one, an amber line
          appears under the fuel table (and under the alternates):
        </p>
        <Eg pre={"Fuel en-route alternate  LEBB/BIO Bilbao · for CONT 5% (252 kg) · 18 NM off track, abeam PPN at 1214Z · forecast then VFR"} />
        <p>It also gets a diamond on the route map, its own card in Airport weather, a page on the alternate sheet and its frequencies on the Radio page.</p>
      </Topic>
      <Topic id="fuel-derived" title="Worked-out figures">
        <dl className="man-dl">
          <dt>Landing fuel</dt>
          <dd>T/OFF fuel − trip: what should be in the tanks at touchdown.</dd>
          <dt>Arrival margin</dt>
          <dd>Landing fuel above ALTN + FINRES, the minimum you must land with to still divert. Comfortable above 400, otherwise Tight.</dd>
          <dt>Endurance at T/O</dt>
          <dd>How long the T/OFF fuel lasts, from the OFP&apos;s time column.</dd>
          <dt>Extra over min · Trip share · Burn / NM</dt>
          <dd>T/OFF fuel above the minimum, trip fuel as a share of block, and trip fuel per ground mile.</dd>
          <dt>
            <Term k="FMC INFO" /> · <Term k="TANKERING" />
          </dt>
          <dd>The figures to enter in the FMS (FINRES+ALTN, TRIP+TAXI) and the tankering advice.</dd>
          <dt>Release</dt>
          <dd>
            The self-briefing statement, dispatcher and phone, PIC name, and a <Ui>PIC signature</Ui> box you can sign.
          </dd>
        </dl>
      </Topic>
    </Section>
  );
}

export function RouteManual({ no }: { no: number }) {
  return (
    <Section id="m-route" no={no} title="Alternate & routing" meta={<span>reader 03 · OFP p.2</span>}>
      <Where
        reader="03 · Alternate, routing & impacts"
        href="/#route"
        ofp="Around page 2: ALTERNATE ROUTE TO, MEL / CDL, the routing line and OPERATIONAL IMPACTS"
      />
      <Topic id="route-sheets" title="Printouts: MCDU set-up sheet and alternate sheet">
        <p>
          Two buttons at the top print onto continuous-form paper on screen. Each has <Ui>Copy text</Ui> and <Ui>Close ✕</Ui>.
        </p>
        <dl className="man-dl">
          <dt>Print MCDU set-up sheet</dt>
          <dd>
            The plan in MCDU page order: <b>INIT A</b> (from / to, alternate, flight number, cost index, cruise level and steps, average wind / ISA),{" "}
            <b>INIT B</b> (fuel figures in tonnes), <b>F-PLN</b>, <b>PERF TAKE OFF</b> (runway, V-speeds, flaps, FLEX), <b>RAD NAV</b> and the <b>winds</b> for
            climb, cruise and descent at the levels you&apos;ll fly. If you typed an actual take-off runway, PERF TAKE OFF uses it.
          </dd>
          <dt>Print alternate sheet</dt>
          <dd>Return to departure, the fuel ERA if there is one, then one page per alternate. Each page starts with FINRES and includes its METAR.</dd>
        </dl>
      </Topic>
      <Topic id="route-alternates" title="Alternate route to…">
        <p>
          One row per alternate: airport and runway, track, distance, <Term k="VIA" /> (the route), level, wind component (hover for head / tail in words), time
          and fuel. <Term k="FINRES" /> is shown in the heading.
        </p>
        <Eg pre={"EHRD/24  TRK 236  DST 31  VIA ARNEM L980 RTM  FL100  WC M010  0024  1180"} />
      </Topic>
      <Topic id="route-mel" title="MEL / CDL items and the departure clearance">
        <p>
          Deferred defects the aircraft is dispatched with, or &ldquo;None&rdquo;. Under it, <Ui>Departure ATC clearance</Ui> is a box for the clearance as you
          copy it (CLRD TO … VIA … CLIMB … SQUAWK …).
        </p>
      </Topic>
      <Topic id="route-string" title="The route string">
        <p>
          The filed route, coloured by what each word is: airports and runways (ink), SID / STAR (green), airways (blue), fixes and navaids (magenta), DCT
          (grey). Hover over any word to have it explained, including speed / level changes like <span className="mono">MOSIS/N0450F360</span> (&ldquo;At MOSIS
          change to 450 kt TAS and FL360&rdquo;). <Term k="ROUTE ID" /> is in the heading.
        </p>
      </Topic>
      <Topic id="route-impacts" title="Operational impacts">
        <p>
          What a change would cost compared with the plan: a level or two higher or lower, or more / less weight. Each row shows the change in words, trip fuel
          difference (with a bar: red costs fuel, green saves it) and time difference.
        </p>
        <Eg>
          <p>
            <span className="mono">FL DN 2</span> appears as <b>2 levels lower</b>, trip <b>+180</b>, time <b>−0:01</b>: descending two levels burns 180 kg more
            and saves a minute. <span className="mono">WEIGHT UP 1</span> appears as <b>+1 t</b>.
          </p>
        </Eg>
      </Topic>
    </Section>
  );
}

export function TimesManual({ no }: { no: number }) {
  return (
    <Section id="m-times" no={no} title="Times & weights" meta={<span>reader 04 · OFP p.3</span>}>
      <Where reader="04 · ATIS, times & weights" href="/#times" ofp="Around page 3: the TIMES and WEIGHTS blocks, ATIS lines, RVSM check and terrain block" />
      <Topic id="times-atis" title="ATIS and RVSM check">
        <p>
          <Ui>ATIS</Ui> is a free-text box for the information you copy (INFO … RWY … WIND … VIS … QNH …). In <Ui>RVSM altimeter check</Ui>, type the LEFT, STBY
          and RIGHT altimeter readings in feet: it confirms the two primaries are within 200 ft (green) or warns that they aren&apos;t (red).
        </p>
      </Topic>
      <Topic id="times-oooi" title="Times: estimated, local, schedule and actual">
        <p>
          A row each for <Term k="OUT" />, <Term k="OFF" />, <Term k="ON" />, <Term k="IN" /> and block time. Columns: estimated (UTC), local, schedule,{" "}
          <b>Actual Z</b> (yours to fill in) and <b>Δ</b> (actual minus estimated, red when late).
        </p>
        <Steps>
          <li>
            Each Actual Z box shows the current UTC time in grey with a clock button beside it. <b>Click the clock</b> to stamp it, or type{" "}
            <span className="mono">HHMM</span>.
          </li>
          <li>The clock stays after the box is filled, so you can re-stamp it if you clicked too early.</li>
        </Steps>
        <p>
          Underneath: <Ui>Taxi out</Ui>, <Ui>Airborne</Ui> and <Ui>Taxi in</Ui> durations (with your actual ones once both ends are filled),{" "}
          <Ui>vs schedule</Ui>, and the UTC offset of each airport. A <b>planned vs actual timeline</b> draws both on one clock.
        </p>
        <Eg>
          <p>
            Planned OFF 1155Z. You stamp OFF at 1203: Δ shows <b>+8′</b> in red. Switch on <Ui>Times &amp; weights OFF</Ui> in the Flight log and every waypoint
            gets a RETO 8 minutes later than its ETO.
          </p>
        </Eg>
      </Topic>
      <Topic id="times-weights" title="Weights">
        <p>
          ZFW, FUEL, TOW and LAW: estimated, operational maximum and an <b>Actual</b> box for the final load sheet, plus <Ui>LDG</Ui> (actual landing weight). A{" "}
          <i>LAW-limited</i> note appears when the take-off weight limit comes from the landing limit plus trip fuel. Gauges, payload share of TOW and average
          payload per passenger follow.
        </p>
      </Topic>
      <Topic id="times-terrain" title="Terrain clearance check">
        <p>The OFP&apos;s terrain lines, with each check&apos;s abbreviation explained on hover. Compare it with the MOST CRITICAL MORA in the Flight log.</p>
      </Topic>
    </Section>
  );
}

export function LogManual({ no }: { no: number }) {
  return (
    <Section id="m-log" no={no} title="Flight log" meta={<span>reader 05 · OFP p.4–</span>}>
      <Where reader="05 · Flight log" href="/#log" ofp="The FLIGHT LOG pages, from around page 4: one line per waypoint, FIR rows between them" />
      <Topic id="log-top" title="The line at the top">
        <p>
          <Term k="MOST CRITICAL MORA" /> (the highest minimum off-route altitude and where it is), the maximum wind shear (<Term k="SHR" />
          ), and badges for <Term k="TOC" />, <Term k="TOD" /> and the highest cruise level.
        </p>
      </Topic>
      <Topic id="log-profile" title="Vertical profile">
        <p>
          Flight level against distance, with the MORA terrain shaded underneath, fuel on board (EFOB) on the right-hand axis and a <b>minimum fuel line</b> at
          FINRES + ALTN. With PIC extra switched on, a TFOB line is added. SIGMET / AIRMET areas you fly through are drawn as bands.
        </p>
        <p>
          Hover over the chart (or click it and use <Kbd>←</Kbd> <Kbd>→</Kbd>) to step through waypoints. The same waypoint is highlighted on the map and in the
          table.
        </p>
      </Topic>
      <Topic id="log-map" title="Route map">
        <p>
          The route from the waypoint coordinates over a map in one of three styles (<See to="settings-appearance">Settings</See>): contours, no contours
          (neighbouring countries in different tones), or height map. Country names are placed so they don&apos;t cover the route.
        </p>
        <dl className="man-dl">
          <dt>FIR / UIR</dt>
          <dd>
            A dashed line beside the route, named, for each FIR you&apos;re in. A short mark across both lines shows where one ends and the next begins. In
            Settings you can switch to circles (Lines only) or hide them.
          </dd>
          <dt>Zoom</dt>
          <dd>
            <Ui>Route</Ui>, <Ui>Region</Ui>, <Ui>Close</Ui> levels and + / − buttons, or scroll the mouse wheel, pinch on a trackpad or touchscreen,
            double-click or double-tap. <Kbd>Shift</Kbd> + double-click zooms out. When zoomed in, drag to move; the fit button returns to the whole route. When
            the map shows the whole route, scrolling down scrolls the page.
          </dd>
          <dt>Markers</dt>
          <dd>
            Triangles for waypoints (more names appear as you zoom in), circles for the airports, an amber diamond for the fuel ERA with a line to where you
            pass closest, and SIGMET / AIRMET areas (switch them off with <Ui>Show SIGMET / AIRMET areas</Ui>).
          </dd>
        </dl>
      </Topic>
      <Topic id="log-waypoint" title="Waypoint card">
        <p>
          The waypoint under your pointer: name and position, then the same rows every time (level, wind, temperatures, speeds, distances, times, fuel), with a
          dash where the OFP has nothing. Below the charts, the FIR boundaries are listed with the time after take-off for each.
        </p>
      </Topic>
      <Topic id="log-navlog" title="Navigation log columns">
        <p>One row per waypoint, with FIR crossings as hatched rows. Hover over any column header for its meaning. The main ones:</p>
        <div className="tbl-wrap">
          <table className="tbl man-cols">
            <tbody>
              {(
                [
                  ["Ident", "Waypoint, with its full name underneath. SIG / AIR badges mark SIGMET or AIRMET areas you're in there."],
                  ["AWY · FL · MORA", "Airway to it, planned level, minimum off-route altitude (hundreds of feet)."],
                  ["WIND · COMP · OAT · TDV", "Forecast wind, its component (green tailwind, red headwind), temperature and ISA deviation."],
                  ["IMT · ITT · MN · TAS · GS", "Magnetic and true track, Mach, true airspeed, ground speed."],
                  ["DIS · RDIS · EET · TTLT", "Leg distance, distance remaining, leg time, total time since take-off."],
                  ["ETO", "Estimated time over: take-off time + TTLT. Uses the nav log's Actual OFF if typed, otherwise the planned OFF."],
                  ["RETO", "Revised ETO from the Actual OFF in Times & weights (switch on Times & weights OFF)."],
                  ["ATO · Δ", "Actual time over (yours) and minutes early (green) or late (red)."],
                  ["EFOB · TFOB", "Estimated fuel on board (tonnes); TFOB adds the PIC extra still on board (switch on Include PIC extra)."],
                  ["AFOB · Δ", "Actual fuel on board (yours) and how far above (green) or below (red) plan."],
                  ["PBRN · SHR · TRP · FREQ · LAT / LONG", "Fuel burnt so far, wind shear, tropopause, navaid frequency, coordinates."],
                ] as const
              ).map(([k, v]) => (
                <tr key={k}>
                  <th scope="row" className="mono">
                    {k}
                  </th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Topic>
      <Topic id="log-quickfill" title="Filling it in: quick fill">
        <p>The next waypoint after your last entry is outlined in blue, and so is any row you hover over or are typing in.</p>
        <dl className="man-dl">
          <dt>ATO</dt>
          <dd>
            Shows the time now in grey with a clock. Click the clock, or press <Kbd>Enter</Kbd> in the box, to stamp it.
          </dd>
          <dt>AFOB</dt>
          <dd>
            Shows the <b>predicted fuel</b> with a ✓: the planned fuel there (TFOB with PIC extra on, otherwise EFOB) shifted by the fuel Δ of the nearest
            filled-in waypoint above. Click ✓ or press <Kbd>Enter</Kbd> to accept.
          </dd>
          <dt>▲ ▼</dt>
          <dd>
            The latest AFOB you entered gets ▲ ▼ to adjust it by 0.1 t; <Kbd>↑</Kbd> <Kbd>↓</Kbd> do the same in the box. When you fill the next one, the arrows
            move to it.
          </dd>
        </dl>
        <Eg title="Example: three waypoints">
          <pre className="man-pre">
            {
              "FIX     ETO    ATO    Δ     EFOB  AFOB   Δ\nPPN     1214   1215   +1′   5.6   5.4   −0.2\nMOSIS   1229   1229   ±0′   5.2   5.0   −0.2   ▲▼\nBOBSI   1241   [now]        4.9   [4.7 ✓]"
            }
          </pre>
          <p>BOBSI is next: its ATO offers the time now and its AFOB offers 4.7 (4.9 − 0.2). The ▲▼ sit on MOSIS, the latest entry, until you accept BOBSI.</p>
        </Eg>
        <Note>
          The buttons sit over the next column, so the table never shifts sideways as offers appear. You can always ignore the offer and type your own value.
        </Note>
      </Topic>
      <Topic id="log-switches" title="Actual OFF and the two switches">
        <dl className="man-dl">
          <dt>Actual OFF (above the table)</dt>
          <dd>Type your take-off time here to recalculate every ETO. Left empty, ETOs use the planned OFF.</dd>
          <dt>Times &amp; weights OFF</dt>
          <dd>
            Adds a RETO column from the OFF you stamped in Times &amp; weights, so you don&apos;t type it twice. It needs that OFF filled in and the Actual OFF
            above the table empty.
          </dd>
          <dt>Include PIC extra</dt>
          <dd>
            Needs PIC extra in Planned fuel. Adds TFOB: EFOB plus the extra still on board, less the cost of carrying it (from Operational impacts). AFOB is
            then compared with TFOB.
          </dd>
        </dl>
      </Topic>
    </Section>
  );
}

export function WindsManual({ no }: { no: number }) {
  return (
    <Section id="m-winds" no={no} title="Wind information" meta={<span>reader 06 · OFP p.7</span>}>
      <Where reader="06 · Wind information" href="/#winds" ofp="Around page 7: WIND INFORMATION, a block of levels per waypoint" />
      <Topic id="winds-what" title="Winds at five levels">
        <p>
          The forecast wind and temperature at five levels around each point. The row at the planned level is highlighted in magenta, so you can see straight
          away whether a level above or below would have a better wind. The strongest wind on the route is quoted at the top.
        </p>
        <Eg pre={"PPN      FL380 265/062 -57\n         FL360 262/058 -54   ← planned\n         FL340 260/051 -50"}>
          <p>Here FL340 has 7 kt less headwind than the planned FL360: compare that with the cost in Operational impacts.</p>
        </Eg>
      </Topic>
    </Section>
  );
}

export function FplManual({ no }: { no: number }) {
  return (
    <Section id="m-fpl" no={no} title="ATC flight plan" meta={<span>reader 07 · OFP p.8</span>}>
      <Where reader="07 · ATC flight plan" href="/#fpl" ofp="Around page 8: ICAO FLIGHT PLAN, the (FPL-… ) message" />
      <Topic id="fpl-explain" title="Explain route & navaids">
        <p>
          The button at the top draws item 15 leg by leg on printer paper: each fix with its time from take-off, the airway or procedure to the next one (SID,
          STAR, airway, DCT), speed / level changes, and the VOR / NDB frequencies beside the legs. Its chips summarise the flight, for example{" "}
          <span className="mono">LEMD → EHAM · 18 legs · 3 VORs</span> or <span className="mono">RNAV only</span>.
        </p>
      </Topic>
      <Topic id="fpl-message" title="Message and decoded cards">
        <p>
          <Ui>Message</Ui> shows the message as filed, with the AFTN addresses and originator explained. Hover over any item in the message and its decoded card
          lights up, and the other way round.
        </p>
        <p>
          <Ui>Decoded</Ui> splits it into cards: <b>Flight</b> (callsign and operator&apos;s radio name, rules, date, registration), <b>Aircraft</b> (wake
          category, equipment and surveillance codes, PBN capabilities, approach and TCAS), and <b>Route &amp; times</b> (EOBT, cruise speed and level, route,
          alternates and the estimated FIR times from item 18).
        </p>
        <Eg>
          <p>
            Item 18 <span className="mono">PBN/A1B1C1D1O1S2</span> is decoded code by code: RNAV 10, RNAV 5, RNAV 2 and RNAV 1 (all permitted sensors), Basic
            RNP 1, and RNP APCH with BARO-VNAV.
          </p>
        </Eg>
      </Topic>
    </Section>
  );
}

export function AddlManual({ no }: { no: number }) {
  return (
    <Section id="m-addl" no={no} title="Additional info" meta={<span>reader 08 · OFP p.9</span>}>
      <Where reader="08 · Additional info" href="/#addl" ofp="Around page 9: [ Additional Info ]" />
      <Topic id="addl-what" title="Dispatch briefing info">
        <p>The flight reference and city pair, then any other dispatch notes as printed. If the plan has none it says so.</p>
      </Topic>
    </Section>
  );
}

export function TlrManual({ no }: { no: number }) {
  return (
    <Section id="m-tlr" no={no} title="Runway analysis" meta={<span>reader 09 · OFP p.10</span>}>
      <Where reader="09 · Runway analysis" href="/#tlr" ofp="Around page 10: TAKEOFF AND LANDING REPORT (TLR)" />
      <Topic id="tlr-takeoff" title="Takeoff · planned">
        <p>
          The basic empty weight / CG the analysis used, then the planned runway as cards: <b>V1, VR, V2</b>, flaps, FLEX temperature and thrust. The planned
          take-off weight is compared with the maximum for these conditions, with the margin. Head and crosswind components are worked out from the planned wind
          and the runway heading.
        </p>
        <Note>
          The TLR prints V-speeds with the hundreds digit dropped (<span className="mono">61</span> for 161 kt). The reader puts it back and shows what was
          printed.
        </Note>
      </Topic>
      <Topic id="tlr-actual" title="Using a different runway">
        <Steps>
          <li>
            In <Ui>Takeoff actual</Ui> (or <Ui>Landing actual</Ui>), type the runway in <Ui>RWY</Ui>. Fill in OAT, wind and QNH too if you have them.
          </li>
          <li>
            A badge says <i>as planned</i> or <i>planned 36L</i>, or <i>not in the analysis</i> in red when the TLR has no figures for it (check performance
            separately).
          </li>
          <li>
            Underneath you get that runway&apos;s head / crosswind (from your wind if typed, otherwise the planned wind), its weight limit and margin, and for
            landing an estimated landing distance.
          </li>
        </Steps>
      </Topic>
      <Topic id="tlr-tables" title="Performance tables, landing grid and distances">
        <p>
          Toggle between the TLR&apos;s performance tables. <Ui>Landing · planned</Ui> compares the planned landing weight (PLDW) with the runway&apos;s
          maximum. The landing grid gives the maximum landing weight (× 10 kg) per runway and OAT, dry / wet; the letter after each figure is what limits it (A
          = structural, F = field length). Factored landing distances are shown against runway length.
        </p>
        <Eg pre={"RWY  OAT   DRY     WET\n18R   15   6250A   6110F"}>
          <p>18R at 15 °C: 62 500 kg dry (structural limit), 61 100 kg wet (field length).</p>
        </Eg>
      </Topic>
    </Section>
  );
}

export function WxManual({ no }: { no: number }) {
  return (
    <Section id="m-wx" no={no} title="Airport weather" meta={<span>reader 10 · OFP p.12</span>}>
      <Where reader="10 · Airport weather" href="/#wx" ofp="Around page 12: [ Airport WX List ] and the SIGMET / AIRMET advisories" />
      <Topic id="wx-sigmets" title="SIGMETs and AIRMETs on your route">
        <p>
          A badge per advisory type: green <i>none</i>, amber when some were issued for your FIRs, red with <i>n on route</i> when any are at your level and
          time. Each one is decoded into a card with the hazard, levels, valid time and a verdict:
        </p>
        <ul className="man-list">
          <li>
            <b className="man-red">On your route</b>: your route is inside it at its levels while it&apos;s valid. The card says between which waypoints and
            times.
          </li>
          <li>
            <b className="man-amber">Route crosses it · clear of its levels</b> or <b className="man-amber">· outside its time</b>.
          </li>
          <li>Doesn&apos;t touch your route, or can&apos;t be placed (check it against your track).</li>
        </ul>
        <p>The same areas are drawn on the route map and profile in the Flight log, and marked SIG / AIR on the waypoints inside them.</p>
      </Topic>
      <Topic id="wx-cards" title="Airport cards">
        <p>
          One card per airport in the OFP, labelled Departure, Destination, alternate, or <i>Fuel en-route alternate</i>. Each has its flight category (VFR /
          MVFR / IFR / LIFR), a sky picture, wind (with a swaying arrow), visibility and cloud, and an amber warning when the temperature / dew-point spread is
          2 °C or less.
        </p>
        <p>
          Below are the <b>METAR</b> and <b>TAF</b> as printed. Hover over any group to decode it; TAF change groups (TEMPO, BECMG, PROB) are in magenta.
        </p>
        <Eg pre={"TAF EHAM 021100Z 0212/0318 24015KT 9999 SCT025\n    TEMPO 0214/0220 4000 SHRA BKN012"}>
          <p>
            Hover over TEMPO for &ldquo;Temporary fluctuations lasting under an hour each, in total less than half of the period&rdquo;, and over BKN012 for
            &ldquo;Broken (5–7 oktas) at 1200 ft AGL&rdquo;.
          </p>
        </Eg>
      </Topic>
    </Section>
  );
}

export function NotamManual({ no }: { no: number }) {
  return (
    <Section id="m-notam" no={no} title="NOTAM & Company NOTAM" meta={<span>reader 11–12</span>}>
      <Where reader="11 · NOTAM and 12 · Company NOTAM" href="/#notam" ofp="The NOTAM and COMPANY NOTAM pages, grouped by airport and FIR" />
      <Topic id="notam-filter" title="Cutting NOTAMs down to what matters">
        <Steps>
          <li>
            <b>Search</b> for a word: ILS, RWY 06R, crane, a frequency.
          </li>
          <li>
            <b>Category</b> buttons show one category at a time (the OFP&apos;s own groups).
          </li>
          <li>
            <Ui>Critical</Ui> keeps only items that close, suspend or disable something (CLSD, U/S, NOT AVBL…).
          </li>
          <li>
            <Ui>Planned RWY (n)</Ui> keeps only items that mention your planned take-off or landing runway; n is how many there are.
          </li>
        </Steps>
        <p>
          Results stay grouped by location. Each heading shows the planned runway there and how many critical items it has; each NOTAM is tagged{" "}
          <b className="man-red">Critical</b> and / or <b className="man-mag">Planned RWY</b>. The count of shown items is beside the filters.
        </p>
        <Note>Company NOTAM works the same way, for the airline&apos;s own notices.</Note>
      </Topic>
    </Section>
  );
}

export function ChartsManual({ no }: { no: number }) {
  return (
    <Section id="m-charts" no={no} title="Charts & Source text" meta={<span>reader 13–14</span>}>
      <Where reader="13 · Charts and 14 · Source text" href="/#charts" ofp="The image pages at the end, and every page of text" />
      <Topic id="charts-source" title="Charts and the full text">
        <dl className="man-dl">
          <dt>Charts</dt>
          <dd>
            The image pages attached to the OFP (route map, wind / temperature charts, cross-section), drawn from the PDF and cropped. Select one to enlarge it.
          </dd>
          <dt>Source text</dt>
          <dd>
            Every line of text in the PDF, page by page, exactly as printed. Use <Ui>Search all pages…</Ui> to find any value, including anything the other
            sections don&apos;t show.
          </dd>
        </dl>
        <Eg>
          <p>
            Looking for the SELCAL or the dispatcher&apos;s phone number? Search <span className="mono">SELCAL</span> or <span className="mono">TEL</span> in
            Source text.
          </p>
        </Eg>
      </Topic>
    </Section>
  );
}
