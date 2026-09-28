"use client";

import { createContext, useCallback, useContext } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { OFP } from "@/lib/ofp/types";
import type { FieldEntry } from "@/lib/storage";

export interface OfpState {
  ofp: OFP | null;
  doc: PDFDocumentProxy | null;
}

export const OfpContext = createContext<OfpState>({ ofp: null, doc: null });
export const useOfp = () => useContext(OfpContext);

export interface FormApi {
  values: Record<string, FieldEntry>;
  set: (key: string, section: string, label: string, value: string) => void;
}

export const FormContext = createContext<FormApi>({ values: {}, set: () => {} });

/**
 * A pilot-entered form value, saved per flight in browser storage.
 * `section` and `label` describe the value on the Settings page.
 */
export function useField(key: string, section: string, label: string): [string, (v: string) => void] {
  const { values, set } = useContext(FormContext);
  const setter = useCallback((v: string) => set(key, section, label, v), [set, key, section, label]);
  return [values[key]?.value ?? "", setter];
}

/** For dynamic groups (one value per waypoint / column): returns a getter and setter by key. */
export function useFieldGroup(prefix: string, section: string) {
  const { values, set } = useContext(FormContext);
  const get = useCallback((k: string) => values[`${prefix}.${k}`]?.value ?? "", [values, prefix]);
  const put = useCallback((k: string, label: string, v: string) => set(`${prefix}.${k}`, section, label, v), [set, prefix, section]);
  return { get, put };
}
