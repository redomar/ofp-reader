// Copies the pdf.js worker into public/ (served at /pdf.worker.min.mjs).
// public/ may not exist in a fresh checkout because the worker is gitignored.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
mkdirSync("public", { recursive: true });
copyFileSync(require.resolve("pdfjs-dist/build/pdf.worker.min.mjs"), "public/pdf.worker.min.mjs");
