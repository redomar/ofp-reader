// Copies runtime assets from node_modules into public/ (gitignored, regenerated on dev/build):
//  - the pdf.js worker, served at /pdf.worker.min.mjs
//  - flag-icons 4x3 SVGs, served at /flags/<iso2>.svg (only the flags a plan needs are fetched)
//  - coastline and border outlines for the route map, at /geo/outlines-50m.json (see build-geo.mjs)
//  - airport coordinates (OurAirports, public domain: large and medium airports, ICAO → [lat, lon]),
//    at /geo/airports.json, from data/airports.json; used to place a fuel en-route alternate
//  - country polygons and names at /geo/countries-50m.json, and shaded relief at /geo/relief.jpg
// public/ may not exist in a fresh checkout because everything in it is generated.
import { copyFileSync, cpSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { buildCountries, buildGeo } from "./build-geo.mjs";

const require = createRequire(import.meta.url);
mkdirSync("public", { recursive: true });
copyFileSync(require.resolve("pdfjs-dist/build/pdf.worker.min.mjs"), "public/pdf.worker.min.mjs");
const flags = join(dirname(require.resolve("flag-icons/package.json")), "flags", "4x3");
cpSync(flags, "public/flags", { recursive: true });
buildGeo("50m");
mkdirSync("public/geo", { recursive: true });
copyFileSync("data/airports.json", "public/geo/airports.json");
// country fills and names for the route map, and the height map's shaded relief
// (Natural Earth SR_50M, public domain, greyscale, flat land lifted to white; see data/README)
buildCountries("50m");
copyFileSync("data/relief.jpg", "public/geo/relief.jpg");
