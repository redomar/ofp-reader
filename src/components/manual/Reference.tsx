"use client";

import type { ReactNode } from "react";
import { G } from "@/lib/ofp/glossary";
import { Section } from "../ui";
import { Kbd, Note, See, Topic, Ui } from "./kit";

export function DataManual({ no }: { no: number }) {
  return (
    <Section id="m-data" no={no} title="Saved data & privacy" meta={<span>all in this browser</span>}>
      <Topic id="data-where" title="What is stored, and where">
        <p>Nothing is sent anywhere. The PDF is read on your device, and everything is kept in this browser only:</p>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">What</th>
                <th scope="col">Where</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Your entries and each flight&apos;s details</th>
                <td>Local storage, one record per flight</td>
              </tr>
              <tr>
                <th scope="row">The PDF of each plan</th>
                <td>IndexedDB (the browser&apos;s file store)</td>
              </tr>
              <tr>
                <th scope="row">The active flight, theme, folded sections, display choices</th>
                <td>Local storage</td>
              </tr>
              <tr>
                <th scope="row">Reports pasted on the Weather page</th>
                <td>Local storage</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Note kind="warn">
          Clearing site data, or browsing in a private window, removes it all. Another browser or device doesn&apos;t see it. To keep a copy, use{" "}
          <Ui>Export JSON</Ui> in <See to="settings-data">Settings</See>; <Ui>Import JSON</Ui> brings it back.
        </Note>
      </Topic>
      <Topic id="data-move" title="Moving a flight to another device">
        <ol className="man-steps">
          <li>
            On the first device: <Ui>Settings → Saved flights</Ui>, select the flight, <Ui>Export JSON</Ui>.
          </li>
          <li>
            On the second: <Ui>Settings → Import JSON</Ui> and choose the file. The flight appears with all your entries and becomes active.
          </li>
          <li>
            Open the same SimBrief link (or upload the PDF) there too: the JSON holds your notes, not the PDF. The flight chip shows{" "}
            <span className="mono">PDF needed</span> until you do.
          </li>
        </ol>
      </Topic>
    </Section>
  );
}

export function KeysManual({ no }: { no: number }) {
  const rows: [ReactNode, string][] = [
    [<Kbd key="k">/</Kbd>, "Jump to the manual's search box (on this page)"],
    [<Kbd key="k">Esc</Kbd>, "Clear the manual search; deselect the waypoint on a chart"],
    [
      <>
        <Kbd>Tab</Kbd>
      </>,
      "Move between controls; underlined labels show their explanation when focused",
    ],
    [
      <>
        <Kbd>←</Kbd> <Kbd>→</Kbd> <Kbd>↑</Kbd> <Kbd>↓</Kbd>
      </>,
      "On a focused chart (profile or map): step to the previous / next waypoint",
    ],
    [
      <>
        <Kbd>Home</Kbd> <Kbd>End</Kbd>
      </>,
      "On a focused chart: first / last waypoint",
    ],
    [
      <>
        <Kbd>+</Kbd> <Kbd>−</Kbd>
      </>,
      "On the focused route map: zoom in / out on the selected waypoint",
    ],
    [<Kbd key="k">Enter</Kbd>, "In an empty ATO or AFOB box: accept the offered time or predicted fuel"],
    [
      <>
        <Kbd>↑</Kbd> <Kbd>↓</Kbd>
      </>,
      "In the latest AFOB box: add or subtract 0.1 t",
    ],
    [
      <>
        <Kbd>Ctrl</Kbd> / <Kbd>⌘</Kbd> + <Kbd>F</Kbd>
      </>,
      "Browser find: also searches folded sections and opens the one it finds",
    ],
  ];
  return (
    <Section id="m-keys" no={no} title="Keyboard & gestures" meta={<span>shortcuts</span>}>
      <Topic id="keys-all" title="Keys">
        <div className="tbl-wrap">
          <table className="tbl man-keys">
            <tbody>
              {rows.map(([k, v], i) => (
                <tr key={i}>
                  <th scope="row">{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Topic>
      <Topic id="keys-gestures" title="Mouse, trackpad and touch">
        <dl className="man-dl">
          <dt>Route map</dt>
          <dd>
            Scroll or pinch to zoom where you point; double-click or double-tap to zoom in; <Kbd>Shift</Kbd> + double-click to zoom out; drag to move once
            zoomed in (one finger on a phone).
          </dd>
          <dt>Charts and the nav log</dt>
          <dd>Hover over the profile, map or a table row to select that waypoint everywhere.</dd>
          <dt>Files</dt>
          <dd>Drop a PDF anywhere on the reader to open it.</dd>
          <dt>Sections</dt>
          <dd>Click a title bar to fold or unfold it; the boxes in Contents and Collapse all do the same.</dd>
        </dl>
      </Topic>
    </Section>
  );
}

export function ColoursManual({ no }: { no: number }) {
  const rows: [string, string, string][] = [
    [
      "man-sw-mag",
      "Magenta",
      "Where you are or what's planned: the current section and page, the route, the planned level, the hovered row, change groups in a TAF.",
    ],
    ["man-sw-blue", "Blue", "What you type, links, and offers to fill in (outlined boxes). Also MVFR."],
    ["man-sw-green", "Green", "Good news: early, above planned fuel, tailwind, less fuel burnt, within limits, VFR."],
    [
      "man-sw-amber",
      "Amber",
      "Worth a look: tight margins, fog risk, a SIGMET you cross outside its levels or time, the fuel ERA, a NOTAM against a frequency.",
    ],
    ["man-sw-red", "Red", "Act on it: late, below planned fuel, headwind, more fuel burnt, a limit exceeded, a SIGMET on your route, a critical NOTAM, IFR."],
  ];
  return (
    <Section id="m-colours" no={no} title="Colours & markings" meta={<span>what they mean</span>}>
      <Topic id="colours-all" title="Colours">
        <div className="tbl-wrap">
          <table className="tbl man-colours">
            <tbody>
              {rows.map(([c, k, v]) => (
                <tr key={k}>
                  <th scope="row">
                    <i className={`man-sw ${c}`} aria-hidden="true" />
                    {k}
                  </th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Flight categories use their own fixed colours everywhere: <b className="man-green">VFR</b>, <b className="man-blue">MVFR</b>,{" "}
          <b className="man-red">IFR</b>, <b className="man-mag">LIFR</b>.
        </p>
      </Topic>
      <Topic id="colours-marks" title="Markings">
        <dl className="man-dl">
          <dt>Dotted underline</dt>
          <dd>Hover over or focus it for an explanation.</dd>
          <dt>Dotted blank</dt>
          <dd>A value that isn&apos;t there yet (no plan open), or isn&apos;t on this OFP.</dd>
          <dt>Dashed box</dt>
          <dd>Somewhere you can type. It turns solid blue while you type.</dd>
          <dt>Blue dot in Contents</dt>
          <dd>That section holds something you typed.</dd>
          <dt>Hatched row or tab</dt>
          <dd>A FIR crossing in the nav log; on the page tabs, the experimental Wind lab.</dd>
          <dt>
            <span className="mono">PDF p.4–</span>
          </dt>
          <dd>The page of the PDF that section comes from (in each title bar).</dd>
        </dl>
      </Topic>
    </Section>
  );
}

export function TroubleManual({ no }: { no: number }) {
  const qa: [string, ReactNode][] = [
    [
      "My notes have disappeared",
      <>
        Check you&apos;re on the same flight <i>and</i> OFP number (the flight chip). A re-released plan is a new flight with empty notes; the old one is still
        in Settings. Notes are also per browser: a private window or another browser starts empty.
      </>,
    ],
    ["The plan won't download any more", <>SimBrief deletes old PDFs. Reopen it from the flight chip (it uses the saved copy), or upload the PDF.</>],
    [
      "The ETOs are all wrong",
      <>
        They use the nav log&apos;s Actual OFF, or the planned OFF if that&apos;s empty. Check the Actual OFF box above the table, or switch on{" "}
        <Ui>Times &amp; weights OFF</Ui> to use the time you stamped there.
      </>,
    ],
    [
      "Include PIC extra / Times & weights OFF won't switch on",
      <>
        PIC extra needs a figure in Planned fuel. Times &amp; weights OFF needs an OFF in Times &amp; weights and an empty Actual OFF above the nav log. Hover
        over the switch for the reason.
      </>,
    ],
    ["The time the clock puts in is off by hours", <>It&apos;s UTC (Z), not local time, as on the OFP. Local offsets are under Times &amp; weights.</>],
    [
      "A section is empty",
      <>
        That part isn&apos;t in this OFP, or the layout differs from the airline-style (LIDO) one the reader is built for.{" "}
        <See to="charts-source">Source text</See> still has every line.
      </>,
    ],
    [
      "I can't find a section",
      <>
        It may be folded: Contents shows <i>closed</i> next to it. Click it there, or use <Ui>Expand all</Ui> (the Collapse all button once everything is
        folded).
      </>,
    ],
  ];
  return (
    <Section id="m-trouble" no={no} title="Troubleshooting" meta={<span>common questions</span>}>
      <Topic id="trouble-qa" title="Common questions">
        <dl className="man-dl man-qa">
          {qa.map(([q, a]) => (
            <div key={q} style={{ display: "contents" }}>
              <dt>{q}</dt>
              <dd>{a}</dd>
            </div>
          ))}
        </dl>
      </Topic>
    </Section>
  );
}

/** Every explanation the reader shows on hover, A–Z; each entry is a search result of its own. */
export function GlossaryManual({ no }: { no: number }) {
  const entries = Object.entries(G).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }));
  return (
    <Section id="m-glossary" no={no} title="Glossary" meta={<span>{entries.length} terms</span>}>
      <p className="small muted" style={{ marginTop: 0 }}>
        The explanations shown when you hover over a label in the reader, A–Z. Search for any of them with the box at the top.
      </p>
      <dl className="man-gloss" id="glossary">
        {entries.map(([k, v]) => (
          <div key={k} className="man-gloss-row" id={`g-${k.replace(/[^A-Za-z0-9]+/g, "-")}`} data-topic={k}>
            <dt className="mono">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <Note>
        Terms on the weather cards (METAR and TAF groups) and in the ATC flight plan (equipment and PBN codes) are explained in place when you hover over them.
      </Note>
    </Section>
  );
}
