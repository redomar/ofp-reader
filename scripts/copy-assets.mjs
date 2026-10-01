// Copies runtime assets from node_modules into public/ (gitignored, regenerated on dev/build):
//  - the pdf.js worker, served at /pdf.worker.min.mjs
//  - flag-icons 4x3 SVGs, served at /flags/<iso2>.svg (only the flags a plan needs are fetched)
// public/ may not exist in a fresh checkout because everything in it is generated.
import { copyFileSync, cpSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
mkdirSync("public", { recursive: true });
copyFileSync(require.resolve("pdfjs-dist/build/pdf.worker.min.mjs"), "public/pdf.worker.min.mjs");
const flags = join(dirname(require.resolve("flag-icons/package.json")), "flags", "4x3");
cpSync(flags, "public/flags", { recursive: true });
