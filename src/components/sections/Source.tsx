"use client";

import { useState } from "react";
import { useOfp } from "../context";
import { Section, V } from "../ui";

export function SourceSection({ no }: { no: number }) {
  const { ofp } = useOfp();
  const [q, setQ] = useState("");
  const pages = ofp?.pages ?? [];
  const match = q.trim().toUpperCase();
  const hits = match ? pages.filter((p) => p.lines.some((l) => l.toUpperCase().includes(match))) : pages;

  return (
    <Section id="source" no={no} title="Source text" meta={<span>{ofp ? `${ofp.pageCount} pages` : "—"}</span>}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Every line of text extracted from the PDF, page by page, exactly as printed — nothing on the OFP is left out. Search to find any value.
      </p>
      <div className="nt-filters">
        <label htmlFor="src-q" className="sr-only">
          Search source text
        </label>
        <input id="src-q" type="search" placeholder="Search all pages…" value={q} onChange={(e) => setQ(e.target.value)} disabled={!ofp} />
        {ofp && <span className="small muted">{match ? `${hits.length} page(s) match` : ""}</span>}
      </div>
      {!ofp && <V v={null} w={60} />}
      {hits.map((p) => (
        <details className="nt-sec" key={p.page} open={!!match && hits.length <= 3}>
          <summary>
            Page {p.page}
            <span className="count">{ofp?.chartPages.includes(p.page) ? "image page" : `${p.lines.filter((l) => l.trim()).length} lines`}</span>
          </summary>
          <pre className="pre" style={{ padding: "0 12px 12px", overflowX: "auto", whiteSpace: "pre" }}>
            {p.lines.map((l, i) =>
              match && l.toUpperCase().includes(match) ? (
                <mark key={i} style={{ display: "block" }}>
                  {l || " "}
                </mark>
              ) : (
                <span key={i} style={{ display: "block" }}>
                  {l || " "}
                </span>
              ),
            )}
          </pre>
        </details>
      ))}
    </Section>
  );
}
