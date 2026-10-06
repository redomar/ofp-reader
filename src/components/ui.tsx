"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { useCollapse } from "./collapse";
import { Replay } from "./replay";
import { isBlank } from "@/lib/ofp/format";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

/** Hover/focus explanation. Keyboard-focusable; described for screen readers. */
export function Tip({
  tip,
  title,
  children,
  className,
  plain,
}: {
  tip: string | null | undefined;
  title?: string;
  children: ReactNode;
  className?: string;
  plain?: boolean;
}) {
  const id = useId();
  if (!tip) return <span className={className}>{children}</span>;
  return (
    <>
      <span
        className={cx("tip", plain && "tip-plain", className)}
        tabIndex={0}
        data-tip={tip}
        data-tip-title={title}
        aria-describedby={id}
      >
        {children}
      </span>
      <span id={id} hidden>
        {title ? `${title}: ` : ""}
        {tip}
      </span>
    </>
  );
}

/** A value slot: shows the value, or an empty dotted blank like an unfilled form. */
export function V({ v, w = 4, className, style }: { v: ReactNode; w?: number; className?: string; style?: CSSProperties }) {
  const empty = v == null || v === "" || (typeof v === "string" && isBlank(v));
  if (empty)
    return (
      <span className={cx("v v-empty", className)} style={{ ["--w" as string]: w, ...style }}>
        <span className="sr-only">blank</span>
      </span>
    );
  return (
    <span className={cx("v", className)} style={style}>
      {v}
    </span>
  );
}

export function Field({
  label,
  tip,
  children,
  sub,
  className,
  style,
}: {
  label: string;
  tip?: string | null;
  children: ReactNode;
  sub?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cx("field", className)} style={style}>
      <span className="field-label">
        <Tip tip={tip} title={label}>
          {label}
        </Tip>
      </span>
      <div className="field-value">
        {children}
        {sub != null && sub !== false && <span className="field-sub">{sub}</span>}
      </div>
    </div>
  );
}

/**
 * A page section ("sheet"). The whole header strip is the collapse toggle; there is
 * no caret on it (the Contents rail shows state). Collapsed bodies use
 * hidden="until-found", so the browser's find-in-page still reaches and reopens them.
 */
export function Section({
  id,
  no,
  title,
  meta,
  children,
}: {
  id: string;
  no: number;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  const { isCollapsed, toggle, open } = useCollapse();
  const collapsed = isCollapsed(id);
  const bodyRef = useRef<HTMLDivElement>(null);

  // React only writes `hidden` as a boolean, so set "until-found" directly; browsers
  // without support treat it as plain hidden.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (collapsed) el.setAttribute("hidden", "until-found");
    else el.removeAttribute("hidden");
  }, [collapsed]);

  // Find-in-page match inside a collapsed section: expand it.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onMatch = () => open(id);
    el.addEventListener("beforematch", onMatch);
    return () => el.removeEventListener("beforematch", onMatch);
  }, [id, open]);

  return (
    <section id={id} className={cx("sheet", collapsed && "is-collapsed")} aria-labelledby={`${id}-h`} style={{ ["--sec" as string]: no }}>
      <h2 className="sheet-heading">
        <button type="button" className="sheet-head" aria-expanded={!collapsed} aria-controls={`${id}-body`} onClick={() => toggle(id)}>
          <span className="sheet-no" aria-hidden="true">
            {String(no).padStart(2, "0")}
          </span>
          <span className="sheet-title" id={`${id}-h`}>
            {title}
          </span>
          {meta && <span className="sheet-meta">{meta}</span>}
        </button>
      </h2>
      <div className="sheet-body" id={`${id}-body`} ref={bodyRef}>
        {children}
      </div>
    </section>
  );
}

export function Sub({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h3 className="sub" id={id}>
      {children}
    </h3>
  );
}

export function Badge({ tone = "ink", children, tip }: { tone?: "green" | "amber" | "red" | "blue" | "mag" | "ink"; children: ReactNode; tip?: string }) {
  const b = <span className={`badge b-${tone}`}>{children}</span>;
  return tip ? (
    <Tip tip={tip} plain>
      {b}
    </Tip>
  ) : (
    b
  );
}

/** Horizontal gauge: value against a max, with warn/bad thresholds (percent of max). */
export function Gauge({
  label,
  value,
  max,
  display,
  tip,
  warnAt = 95,
}: {
  label: string;
  value: number | null;
  max: number | null;
  display: ReactNode;
  tip?: string;
  warnAt?: number;
}) {
  const p = value != null && max ? Math.min(100, (value / max) * 100) : 0;
  const cls = p >= 100 ? "bad" : p >= warnAt ? "warn" : "";
  return (
    <div className="gauge">
      <Tip tip={tip} title={label}>
        <span style={{ fontFamily: "var(--font-cond)", fontWeight: 600, letterSpacing: "0.06em" }}>{label}</span>
      </Tip>
      <Replay>
      <div
        className="gauge-track"
        role="meter"
        aria-label={`${label} against maximum`}
        aria-valuemin={0}
        aria-valuemax={max ?? 100}
        aria-valuenow={value ?? 0}
      >
        <span className={cx("gauge-fill a-grow-x", cls)} style={{ width: `${p}%` }} />
      </div>
      </Replay>
      <span>{display}</span>
    </div>
  );
}

/** Controlled input for pilot-filled "actual" values. Kept in memory only. */
export function Act({
  label,
  value,
  onChange,
  w = 6,
  placeholder,
  inputMode = "numeric",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  w?: number;
  placeholder?: string;
  inputMode?: "numeric" | "decimal" | "text";
}) {
  return (
    <ActInput label={label} value={value} onChange={onChange} w={w} placeholder={placeholder} inputMode={inputMode} />
  );
}

/**
 * Act with quick fill, for the nav log. `offer` shows a suggested value in the empty box with a
 * button (or Enter) that accepts it; `nudge` adds ▲▼ that step the value by that amount (the arrow
 * keys do the same).
 */
export function ActQuick({
  offer,
  offerIcon,
  offerLabel,
  nudge,
  always,
  ...p
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  w?: number;
  inputMode?: "numeric" | "decimal" | "text";
  offer?: string | null;
  offerIcon?: ReactNode;
  offerLabel?: string;
  nudge?: number;
  /** Keep the offer button even once filled (it then replaces the value), without the blue outline. */
  always?: boolean;
}) {
  const offering = !p.value && !!offer;
  const step = (dir: 1 | -1) => {
    const n = Number(p.value || offer);
    if (!nudge || Number.isNaN(n)) return;
    p.onChange(Math.max(0, n + dir * nudge).toFixed(1));
  };
  return (
    <span className={cx("act-box", offering && !always && "offer")}>
      <ActInput
        {...p}
        placeholder={offering ? offer : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" && offering) {
            e.preventDefault();
            p.onChange(offer);
          } else if (nudge && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            step(e.key === "ArrowUp" ? 1 : -1);
          }
        }}
      />
      {offering || (always && offer) ? (
        <button type="button" className="act-btn" aria-label={`${offerLabel ?? "Use"} ${offer}`} data-tip={`${offerLabel ?? "Use"} ${offer}`} onClick={() => p.onChange(offer!)}>
          {offerIcon ?? "✓"}
        </button>
      ) : (
        nudge &&
        p.value && (
          <span className="act-nudge">
            <button type="button" aria-label={`Add ${nudge}`} tabIndex={-1} onClick={() => step(1)}>
              ▲
            </button>
            <button type="button" aria-label={`Subtract ${nudge}`} tabIndex={-1} onClick={() => step(-1)}>
              ▼
            </button>
          </span>
        )
      )}
    </span>
  );
}

function ActInput({
  label,
  value,
  onChange,
  w = 6,
  placeholder,
  inputMode = "numeric",
  onKeyDown,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  w?: number;
  placeholder?: string;
  inputMode?: "numeric" | "decimal" | "text";
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      className="act"
      aria-label={label}
      value={value}
      placeholder={placeholder ?? "·".repeat(Math.min(w, 6))}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      onKeyDown={onKeyDown}
      style={{ ["--w" as string]: w }}
      spellCheck={false}
      autoComplete="off"
    />
  );
}

/** The time now as HHMM UTC, updated every 10 s; null until mounted, so the server render matches. */
export function useUtcNow() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(`${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}`);
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 10_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return now;
}

export const ClockIcon = () => (
  <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <circle cx="6" cy="6" r="4.8" />
    <path d="M6 3.4V6l1.8 1.2" />
  </svg>
);
