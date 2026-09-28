# OFP Reader

Interactive pilot-chart view of a SimBrief OFP (LIDO layout PDF). Runs entirely in the browser:
the PDF is fetched (SimBrief serves `Access-Control-Allow-Origin: *`) or read from a local upload,
text is extracted with pdf.js and parsed client-side. Nothing is stored or sent anywhere.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # static export in ./out
```

Deep link: `/?ofp=<simbrief pdf url>`.

- `src/lib/ofp/lines.ts` – rebuilds the monospaced columns from pdf.js text items
- `src/lib/ofp/parse.ts` – OFP → typed model (`types.ts`)
- `src/components/sections/*` – one component per OFP section, in PDF order
