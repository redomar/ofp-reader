"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { G } from "@/lib/ofp/glossary";
import { Tip } from "../ui";

/*
 * Building blocks for the manual (/manual). Every topic is a block with an id, so the
 * search can index it and anything can link straight to it (/manual#topic-id).
 */

/** One topic inside a manual section: a heading plus its text. Indexed by the search. */
export function Topic({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <div className="man-topic" id={id} data-topic={title}>
      <h3 className="sub">
        <a href={`#${id}`} className="man-anchor" aria-label={`Link to ${title}`}>
          #
        </a>
        {title}
      </h3>
      {children}
    </div>
  );
}

/** Where to look: the reader section (linked) and where the same thing sits in the OFP PDF. */
export function Where({ reader, href, ofp }: { reader: ReactNode; href?: string; ofp: ReactNode }) {
  return (
    <div className="man-where">
      <div>
        <span className="man-where-k">In the reader</span>
        <span>{href ? <Link href={href}>{reader}</Link> : reader}</span>
      </div>
      <div>
        <span className="man-where-k">In the OFP</span>
        <span>{ofp}</span>
      </div>
    </div>
  );
}

/** Numbered steps. */
export function Steps({ children }: { children: ReactNode }) {
  return <ol className="man-steps">{children}</ol>;
}

/** A worked example, optionally with OFP-style text in `pre`. */
export function Eg({ title = "Example", children, pre }: { title?: string; children?: ReactNode; pre?: string }) {
  return (
    <div className="man-eg">
      <span className="man-eg-k">{title}</span>
      {children}
      {pre && <pre className="man-pre">{pre}</pre>}
    </div>
  );
}

/** A highlighted note: a tip, or a caution. */
export function Note({ kind = "tip", children }: { kind?: "tip" | "warn"; children: ReactNode }) {
  return (
    <p className={`man-note${kind === "warn" ? " is-warn" : ""}`}>
      <b>{kind === "warn" ? "Watch out" : "Tip"}</b> {children}
    </p>
  );
}

/** The name of a button, switch or label on screen. */
export const Ui = ({ children }: { children: ReactNode }) => <b className="man-ui">{children}</b>;

/** A key to press. */
export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="man-kbd">{children}</kbd>;

/** An OFP abbreviation with its glossary explanation on hover / focus. */
export function Term({ k, children }: { k: string; children?: ReactNode }) {
  return (
    <Tip tip={G[k]} title={k}>
      <span className="mono">{children ?? k}</span>
    </Tip>
  );
}

/** A link to another place in the manual. */
export const See = ({ to, children }: { to: string; children: ReactNode }) => (
  <a href={`#${to}`} className="man-see">
    {children}
  </a>
);
