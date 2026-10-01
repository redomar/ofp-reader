"use client";

import { useEffect, useRef, useState } from "react";
import { useOfp } from "../context";
import { Section } from "../ui";
import { renderChart } from "@/lib/ofp/pdf";
import { Replay } from "../replay";

interface Img {
  page: number;
  url: string;
  w: number;
  h: number;
}

export function ChartsSection({ no }: { no: number }) {
  const { ofp, doc } = useOfp();
  const [imgs, setImgs] = useState<Record<number, Img>>({});
  const [open, setOpen] = useState<Img | null>(null);
  const [zoom, setZoom] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const pages = ofp?.chartPages ?? [];

  useEffect(() => {
    if (!doc || !pages.length) return;
    let cancelled = false;
    const made: string[] = [];
    (async () => {
      for (const p of pages) {
        if (cancelled) return;
        try {
          const r = await renderChart(doc, p);
          made.push(r.url);
          if (cancelled) return;
          setImgs((s) => ({ ...s, [p]: { page: p, ...r } }));
        } catch {
          /* page failed to render — leave placeholder */
        }
      }
    })();
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL(u));
      setImgs({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, ofp]);

  useEffect(() => {
    if (open) dlg.current?.showModal();
    else dlg.current?.close();
  }, [open]);

  const list = pages.length ? pages : [0, 0, 0, 0];
  return (
    <Section id="charts" no={no} title="Charts" meta={<span>{pages.length ? `${pages.length} image pages` : "—"}</span>}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Route map, wind/temperature charts and cross-section attached to the OFP. Rendered from the PDF in your browser — select one to enlarge.
      </p>
      <Replay className="thumbs">
        {list.map((p, i) => {
          const img = p ? imgs[p] : undefined;
          return (
            <button key={p || `ph${i}`} type="button" className="thumb a-rise" style={{ ["--i" as string]: i }} disabled={!img} onClick={() => img && setOpen(img)} aria-label={p ? `Open chart on PDF page ${p}` : "Chart placeholder"}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
              {img ? <img src={img.url} alt={`Chart, PDF page ${p}`} /> : <div className="ph">{p ? "rendering…" : "chart"}</div>}
              <figcaption>{p ? `Chart ${i + 1} · p.${p}` : `Chart ${i + 1}`}</figcaption>
            </button>
          );
        })}
      </Replay>
      <dialog ref={dlg} className="lightbox" onClose={() => setOpen(null)} aria-label={open ? `Chart, PDF page ${open.page}` : "Chart"}>
        {open && (
          <>
            <div className="lb-head">
              <span>Chart · PDF page {open.page}</span>
              <span style={{ flex: 1 }} />
              <button type="button" className="btn" onClick={() => setZoom(!zoom)} aria-pressed={zoom}>
                {zoom ? "Fit" : "100%"}
              </button>
              <button type="button" className="btn" onClick={() => setOpen(null)} autoFocus>
                Close
              </button>
            </div>
            <div className="lb-body">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
              <img src={open.url} alt={`Chart, PDF page ${open.page}`} style={zoom ? { width: open.w, maxWidth: "none" } : { width: "100%", height: "auto" }} />
            </div>
          </>
        )}
      </dialog>
    </Section>
  );
}
