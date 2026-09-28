"use client";

/**
 * Keeps each opened OFP PDF in IndexedDB (keyed by the flight's storage id) so a
 * saved plan reopens without downloading it again. PDFs are ~0.5–1 MB, too large
 * for localStorage. Every call fails soft: no IndexedDB just means no cache.
 */

import { notifyChange } from "./storage";

const DB = "ofp-reader";
const STORE = "pdfs";

export interface CachedPdf {
  id: string;
  data: ArrayBuffer;
  size: number;
  savedAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export async function getPdf(id: string): Promise<ArrayBuffer | null> {
  try {
    const r = (await run("readonly", (s) => s.get(id))) as CachedPdf | undefined;
    return r?.data ?? null;
  } catch {
    return null;
  }
}

export async function putPdf(id: string, data: ArrayBuffer): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.put({ id, data, size: data.byteLength, savedAt: new Date().toISOString() } satisfies CachedPdf));
    notifyChange();
    return true;
  } catch {
    return false;
  }
}

export async function deletePdf(id: string) {
  try {
    await run("readwrite", (s) => s.delete(id));
    notifyChange();
  } catch {
    /* ignore */
  }
}

export async function clearPdfs() {
  try {
    await run("readwrite", (s) => s.clear());
    notifyChange();
  } catch {
    /* ignore */
  }
}
