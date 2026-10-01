"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { itemsToLines, type RawTextItem } from "./lines";
import { parseOfp } from "./parse";
import type { OFP } from "./types";

export type Progress = { stage: "cache" | "fetch" | "read" | "parse" | "done"; page?: number; total?: number };

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

function pdfjs() {
  pdfjsPromise ??= import("pdfjs-dist").then((m) => {
    // Worker is copied to /public by the predev/prebuild scripts.
    m.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/pdf.worker.min.mjs`;
    return m;
  });
  return pdfjsPromise;
}

/** Normalises pasted SimBrief links (with or without scheme). */
export function normaliseUrl(input: string): string {
  const t = input.trim();
  if (!t) return t;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export async function fetchPdf(url: string, onProgress?: (p: Progress) => void): Promise<ArrayBuffer> {
  onProgress?.({ stage: "fetch" });
  let res: Response;
  try {
    res = await fetch(normaliseUrl(url), { mode: "cors" });
  } catch {
    throw new Error(
      "Couldn't download that link. SimBrief removes older OFPs, so it may have expired (generate the plan again), or the host may block browser downloads. If you have the PDF, drop it here instead.",
    );
  }
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}. The OFP may have expired on SimBrief's server.`);
  return res.arrayBuffer();
}

export interface LoadedOfp {
  ofp: OFP;
  doc: PDFDocumentProxy;
}

export async function readOfp(data: ArrayBuffer, source: string, onProgress?: (p: Progress) => void): Promise<LoadedOfp> {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(data), verbosity: 0 }).promise;
  const pages: { page: number; lines: string[] }[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    onProgress?.({ stage: "read", page: n, total: doc.numPages });
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    const items: RawTextItem[] = [];
    for (const it of tc.items) {
      if (!("str" in it)) continue;
      const [a, b, , , x, y] = it.transform as number[];
      items.push({ str: it.str, x, y, width: it.width, size: Math.hypot(a, b) });
    }
    pages.push({ page: n, lines: itemsToLines(items) });
  }
  onProgress?.({ stage: "parse" });
  const ofp = parseOfp(source, pages);
  if (!ofp.header.flightNo && !ofp.header.dep) {
    throw new Error("This PDF does not look like a SimBrief OFP (no [ OFP ] header found). Try the LIDO layout PDF.");
  }
  onProgress?.({ stage: "done" });
  return { ofp, doc };
}

/**
 * Renders an image-only page (maps, wind charts) and crops the white margin
 * and the footer strip, returning an object URL.
 */
export async function renderChart(doc: PDFDocumentProxy, pageNo: number, scale = 2): Promise<{ url: string; w: number; h: number }> {
  const page = await doc.getPage(pageNo);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;

  const { width, height } = canvas;
  const px = ctx.getImageData(0, 0, width, height).data;
  const limitY = Math.floor(height * 0.93); // ignore footer
  let x0 = width,
    y0 = limitY,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < limitY; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      if (px[i] < 235 || px[i + 1] < 235 || px[i + 2] < 235) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  let out = canvas;
  if (x1 > x0 && y1 > y0) {
    const pad = 6;
    const cw = Math.min(width, x1 - x0 + pad * 2);
    const ch = Math.min(height, y1 - y0 + pad * 2);
    out = document.createElement("canvas");
    out.width = cw;
    out.height = ch;
    out.getContext("2d")!.drawImage(canvas, Math.max(0, x0 - pad), Math.max(0, y0 - pad), cw, ch, 0, 0, cw, ch);
  }
  const blob = await new Promise<Blob>((r) => out.toBlob((b) => r(b!), "image/png"));
  return { url: URL.createObjectURL(blob), w: out.width, h: out.height };
}
