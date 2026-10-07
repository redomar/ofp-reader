"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

const PAGE_ICONS = {
  plan: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </>
  ),
  weather: <path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18z" />,
  radio: (
    <>
      <path d="M12 13v8M8.5 7.5a5 5 0 0 0 0 7M15.5 7.5a5 5 0 0 1 0 7M5.6 4.6a9 9 0 0 0 0 12.8M18.4 4.6a9 9 0 0 1 0 12.8" />
      <circle cx="12" cy="11" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  lab: <path d="M4 3v18M4 4l15 2.5v5L4 14zM9 4.8v8.4M14 5.7v6.6" />,
};
const PageIcon = ({ k, size = 22 }: { k: keyof typeof PAGE_ICONS; size?: number }) => (
  <svg className="toc-ic" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    {PAGE_ICONS[k]}
  </svg>
);

/**
 * The app's pages as a 2×2 block of tabs (the page you're on is marked), with the
 * experimental Wind lab on a dashed, hatched tab underneath.
 */
function PageTabs({ links }: { links?: { plan?: string; radio?: string } }) {
  const path = (usePathname() ?? "/").replace(/\/$/, "") || "/";
  const tabs = [
    ["plan", "Plan", links?.plan ?? "/", "/"],
    ["weather", "Weather", "/weather", "/weather"],
    ["radio", "Radio", links?.radio ?? "/radio", "/radio"],
    ["settings", "Settings", "/settings", "/settings"],
  ] as const;
  return (
    <div className="toc-pages">
      {tabs.map(([k, label, href, at]) => (
        <Link key={k} href={href} className="toc-tab" aria-current={path === at ? "page" : undefined}>
          <PageIcon k={k} />
          {label}
        </Link>
      ))}
      <Link href="/wind-lab" className="toc-tab lab" aria-current={path === "/wind-lab" ? "page" : undefined} title="Experimental">
        <span className="toc-hatch" aria-hidden="true" />
        <PageIcon k="lab" size={18} />
        Wind lab
        <span className="toc-hatch" aria-hidden="true" />
      </Link>
    </div>
  );
}

/**
 * Left rail: the page tabs, then the "Contents" card with scroll-spy.
 *
 * - `groups` splits the sections under headings (with a count each); without it they're one list.
 * - `saved` marks sections that hold entries you've typed with a blue dot.
 * - `links` overrides the Plan / Radio tab targets (e.g. to keep the selected flight).
 */
export function Toc({
  sections,
  groups,
  saved,
  links,
  footer,
  pending,
}: {
  sections: readonly (readonly [string, string])[];
  groups?: readonly (readonly [string, readonly string[]])[];
  saved?: ReadonlySet<string>;
  links?: { plan?: string; radio?: string };
  footer?: ReactNode;
  /** The page's sections aren't known yet: show the tabs only, so the card doesn't grow in later. */
  pending?: boolean;
}) {
  const [active, setActive] = useState(sections[0]?.[0] ?? "");
  const ids = sections.map(([id]) => id).join(",");
  // Scroll-spy from scroll position rather than an IntersectionObserver: the reader swaps
  // its section elements when a plan loads, and looking them up by id each time copes with that.
  useEffect(() => {
    const list = ids.split(",");
    let raf = 0;
    const update = () => {
      raf = 0;
      let current = list[0];
      for (const id of list) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ids]);

  const { isCollapsed, toggle, open, ready } = useCollapse();
  const sectionIds = sections.map(([id]) => id);

  const index = new Map(sections.map(([id, label], i) => [id, { label, i }]));
  const at = index.get(active)?.i ?? 0;
  const item = (id: string) => {
    const { label, i } = index.get(id)!;
    const closed = isCollapsed(id);
    return (
      <li key={id} className={closed ? "closed" : undefined}>
        {/* Jumping to a closed section opens it first. */}
        <a href={`#${id}`} aria-current={active === id ? "true" : undefined} onClick={() => open(id)}>
          <span className="n">{String(i + 1).padStart(2, "0")}</span>
          <span className="toc-label">{label}</span>
          {closed ? <i className="toc-closed">closed</i> : saved?.has(id) && <span className="toc-dot" title="Has saved entries" />}
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
  };

  return (
    <nav className="toc" aria-label="Pages and sections">
      <PageTabs links={links} />
      {!pending && (
        <>
          <div className="toc-card">
            <div className="toc-top">
              <p className="toc-title">Contents</p>
              <span className="toc-pos" aria-label={`Section ${at + 1} of ${sections.length}`}>
                {String(at + 1).padStart(2, "0")} / {sections.length}
              </span>
            </div>
            {groups ? (
              groups.map(([g, ids]) => (
                <div key={g}>
                  <p className="toc-grp">
                    <span>{g}</span>
                    <b>{ids.length}</b>
                  </p>
                  <ol>{ids.filter((id) => index.has(id)).map(item)}</ol>
                </div>
              ))
            ) : (
              <ol>{sections.map(([id]) => item(id))}</ol>
            )}
          </div>
          {/* attached under the card; the box is there from the first paint so nothing shifts when the button appears */}
          <div className="toc-foot-box">
            {ready ? <CollapseAllButton ids={sectionIds} className="toc-all" /> : <span className="toc-all" aria-hidden="true" />}
          </div>
          {saved && saved.size > 0 && (
            <p className="toc-legend">
              <span className="toc-dot" aria-hidden="true" />
              has saved entries
            </p>
          )}
        </>
      )}
      {footer && <div className="toc-foot">{footer}</div>}
    </nav>
  );
}
