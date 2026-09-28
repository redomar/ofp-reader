"use client";

import { createContext, useContext } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { OFP } from "@/lib/ofp/types";

export interface OfpState {
  ofp: OFP | null;
  doc: PDFDocumentProxy | null;
}

export const OfpContext = createContext<OfpState>({ ofp: null, doc: null });
export const useOfp = () => useContext(OfpContext);
