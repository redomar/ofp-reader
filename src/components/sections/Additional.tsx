"use client";

import { useOfp } from "../context";
import { Section, V } from "../ui";
import { pageOf } from "@/lib/ofp/format";

export function AdditionalSection({ no }: { no: number }) {
  const { ofp } = useOfp();
  const lines = ofp?.additionalInfo ?? [];
  const brief = lines.map((l) => l.match(/^D\s?I\s?S\s?P\s?A\s?T\s?C\s?H.*?I\s?N\s?F\s?O\s+(\S+)\s+(\S+)/)).find(Boolean);
  return (
    <Section id="addl" no={no} title="Additional info" meta={<span>PDF p.{pageOf(ofp?.pages, /\[ Additional Info \]/) ?? 9}</span>}>
      {brief ? (
        <div className="fields">
          <div className="field">
            <span className="field-label">Dispatch briefing info</span>
            <div className="field-value">
              <V v={brief[1]} /> <span className="field-sub">flight reference</span>
            </div>
          </div>
          <div className="field">
            <span className="field-label">City pair</span>
            <div className="field-value">
              <V v={brief[2]} />
            </div>
          </div>
        </div>
      ) : null}
      {ofp ? (
        lines.length ? (
          <p className="pre muted small" style={{ marginTop: 10 }}>
            {lines.join("\n")}
          </p>
        ) : (
          <p className="muted">No additional dispatch information.</p>
        )
      ) : (
        <V v={null} w={50} />
      )}
    </Section>
  );
}
