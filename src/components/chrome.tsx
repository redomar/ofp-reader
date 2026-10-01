"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { applyTheme, readTheme } from "@/lib/storage";
import { BoxToggleIcon, CollapseAllButton, useCollapse } from "./collapse";

export function Brand({ sub }: { sub: ReactNode }) {
  return (
    <Link href="/" className="brand" aria-label="OFP Reader home">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <circle cx="13" cy="13" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M13 4 L15 13 L13 22 L11 13 Z" fill="currentColor" />
        <circle cx="13" cy="13" r="2" fill="var(--sheet)" stroke="currentColor" />
      </svg>
      <span>
        OFP Reader <small>{sub}</small>
      </span>
    </Link>
  );
}

export function ThemeToggle() {
  const toggle = () => {
    const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const pref = readTheme();
    const current = pref === "system" ? (sysDark ? "dark" : "light") : pref;
    applyTheme(current === "dark" ? "light" : "dark");
  };
  return (
    <button className="btn btn-icon" type="button" onClick={toggle} aria-label="Toggle day / night theme" title="Toggle day / night">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1v14" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 1a7 7 0 0 1 0 14z" fill="currentColor" />
      </svg>
    </button>
  );
}

export function SettingsLink() {
  return (
    <Link href="/settings" className="btn btn-icon" aria-label="Settings and saved flights" title="Settings & saved flights">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M8 1v2.2M8 12.8V15M1 8h2.2M12.8 8H15M3 3l1.6 1.6M11.4 11.4L13 13M3 13l1.6-1.6M11.4 4.6L13 3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </Link>
  );
}

/** Left "Contents" rail with scroll-spy. */
export function Toc({ sections, footer }: { sections: readonly (readonly [string, string])[]; footer?: ReactNode }) {
  const [active, setActive] = useState(sections[0]?.[0] ?? "");
  const ids = sections.map(([id]) => id).join(",");
  useEffect(() => {
    const els = ids
      .split(",")
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-130px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);

  const { isCollapsed, toggle, open, ready } = useCollapse();
  const sectionIds = sections.map(([id]) => id);

  return (
    <nav className="toc" aria-label="Sections">
      <div className="toc-top">
        <p className="toc-title">Contents</p>
        {ready && <CollapseAllButton ids={sectionIds} className="toc-all" />}
      </div>
      <ol>
        {sections.map(([id, label], i) => {
          const closed = isCollapsed(id);
          return (
            <li key={id} className={closed ? "closed" : undefined}>
              {/* Jumping to a closed section opens it first. */}
              <a href={`#${id}`} aria-current={active === id ? "true" : undefined} onClick={() => open(id)}>
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                {label}
              </a>
              <button
                type="button"
                className="toc-caret"
                aria-expanded={!closed}
                aria-controls={`${id}-body`}
                aria-label={`${closed ? "Expand" : "Collapse"} ${label}`}
                title={closed ? "Expand" : "Collapse"}
                onClick={() => toggle(id)}
              >
                <BoxToggleIcon open={!closed} />
              </button>
            </li>
          );
        })}
      </ol>
      {footer && <div className="toc-foot">{footer}</div>}
    </nav>
  );
}
