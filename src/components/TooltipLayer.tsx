"use client";

import { useEffect, useRef, useState } from "react";

interface TipState {
  title: string | null;
  /** Optional filled chip above the text (data-tip-chip, coloured by data-tip-chip-color / -ink). */
  chip: { label: string; color: string; ink: string } | null;
  text: string;
  x: number;
  y: number;
  below: boolean;
}

/**
 * One floating tooltip for the whole page. Any element with `data-tip` shows it on
 * hover or keyboard focus. It is purely visual (aria-hidden): each tip target also
 * carries its own aria-describedby text so screen readers get the same content.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<TipState | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const current = useRef<Element | null>(null);

  useEffect(() => {
    const show = (el: Element) => {
      current.current = el;
      const text = el.getAttribute("data-tip");
      if (!text) return;
      const r = el.getBoundingClientRect();
      const below = r.top < 90;
      const chip = el.getAttribute("data-tip-chip");
      setTip({
        title: el.getAttribute("data-tip-title"),
        chip: chip ? { label: chip, color: el.getAttribute("data-tip-chip-color") ?? "var(--blue)", ink: el.getAttribute("data-tip-chip-ink") ?? "var(--sheet)" } : null,
        text,
        x: r.left + r.width / 2,
        y: below ? r.bottom + 8 : r.top - 8,
        below,
      });
    };
    const hide = () => {
      current.current = null;
      setTip(null);
    };
    const find = (t: EventTarget | null) => (t instanceof Element ? t.closest("[data-tip]") : null);
    const over = (e: PointerEvent) => {
      const el = find(e.target);
      if (el === current.current) return;
      if (el) show(el);
      else if (current.current && !(document.activeElement && current.current.contains(document.activeElement))) hide();
    };
    const focusIn = (e: FocusEvent) => {
      const el = find(e.target);
      if (el) show(el);
    };
    const focusOut = () => hide();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", focusOut);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", focusOut);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", hide, { capture: true });
    };
  }, []);

  // Clamp inside viewport after measuring.
  useEffect(() => {
    const el = ref.current;
    if (!el || !tip) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(12, Math.min(window.innerWidth - w - 12, tip.x - w / 2));
    const top = tip.below ? tip.y : tip.y - h;
    el.style.left = `${left}px`;
    el.style.top = `${Math.max(8, top)}px`;
  }, [tip]);

  return (
    <div id="ofp-tip" ref={ref} hidden={!tip} aria-hidden="true">
      {tip?.chip && (
        <span className="tip-chip" style={{ background: tip.chip.color, color: tip.chip.ink }}>
          {tip.chip.label}
        </span>
      )}
      {tip?.title && <b>{tip.title}</b>}
      {tip?.text}
    </div>
  );
}
