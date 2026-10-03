# Active flight: one OFP across every page

## Goal
Import an OFP once and it becomes the **active flight** everywhere: the reader, Weather, Radio and Settings all show the same plan, and moving between pages keeps it. Any page can switch to a different saved flight, and that switch applies everywhere.

## How each page chooses a flight today
| Page | How it picks | Problem |
| --- | --- | --- |
| Reader (`/`) | `?ofp=` link, `?flight=` id, or a file upload; otherwise starts blank with "Recent" chips | Opening the reader without a link forgets what you were on |
| Radio | `?flight=`, else the most recently updated saved flight; its own menu | Its menu changes Radio only |
| Weather | Nothing until you pick "Load a saved plan"; the pasted text is global | Doesn't follow the plan you're reading |
| Settings | First flight in the list (most recently updated) | The flight you're on isn't preselected |
| Wind lab | No flight | n/a |

The rail's Radio and Plan tabs pass `?flight=` along, which papers over this for one hop, but nothing is shared.

## Design
### One source of truth
- The active flight is a saved-flight id kept in `localStorage` under `ofp-reader:active`. It lives beside the flight records, not inside one, and belongs to this browser.
- A small module `src/lib/active.ts` owns it: `getActive()`, `setActive(id | null)` and a `useActiveFlight()` hook built on the existing storage `subscribe` / version (`useSyncExternalStore`). Every page reads it the same way, and a change on one page (or another tab) re-renders the others.
- If the stored id no longer exists (the flight was deleted), it falls back to the most recently updated saved flight, or none.

### What makes a flight active
- Uploading a PDF, loading a SimBrief link, or reopening a saved one in the reader.
- Picking a flight in the shared flight menu on any page.
- Opening a link with `?flight=<id>` (bookmarks keep working).
- Importing a JSON export in Settings: the imported flight becomes active (the last one, if you import several).

### The URL
`?flight=<id>` stays as a reloadable, bookmarkable mirror of the active flight. Each page writes it with `history.replaceState` when the active flight changes, so reload keeps you where you were. A `?flight=` in a link wins on arrival and becomes active.

### Shared flight menu
One component, `<FlightMenu>`, used on every page that shows flight data. It lists saved flights newest first as `EZY2192 · LEMD→EHAM · 02OCT2026`, marks ones whose PDF isn't stored in this browser ("PDF needed"), and ends with "Open another plan…" (goes to the reader's paste/upload).
- **Weather, Radio, Settings:** in the top bar's middle slot, where Radio's menu is now.
- **Reader:** that slot is the SimBrief paste box, so a compact menu sits in the status line: next to "Blank plan" when a plan is open, and in place of the "Recent" chips on the blank form (it does the same job, for every saved flight rather than the last few).
- **Wind lab:** no menu (it doesn't use flight data).

### Per page
- **Reader:** with no link in the URL, it opens the active flight from the browser's saved PDF. If that PDF isn't stored (e.g. an imported JSON), it shows the existing "Upload <file> to continue" prompt. "Blank plan" clears the active flight.
- **Weather:** loads the active flight's METAR / TAF automatically. If you've pasted your own reports since, it doesn't overwrite them. It offers "Replace with EZY2192's reports" instead.
- **Radio:** follows the active flight; its menu becomes the shared one.
- **Settings:** the active flight is preselected in the Saved flights table and marked **Active**. Choosing another row makes it active. Deleting the active flight falls back as above.

### Client-only (production)
Everything stays in the browser: `localStorage` for the id and the records, IndexedDB for the PDFs, so the static nginx build doesn't change. Pages render a neutral "no flight" state on the server and in the first client render, then fill in once storage is read. That's the same pattern the pages use now, so there's no hydration mismatch. Other open tabs follow the change through the `storage` event.

## Git workflow
- Work happens on branches: `feature/<name>` for each feature, cut from local `main`.
- A release gathers its features on `release/<version>`, which is pushed and merged into GitHub `main` when releasing. The version is then tagged and the GitHub release created as before.
- Local `main` stays the day-to-day development branch.
- `release/1.8.0` holds everything since v1.7.0 (Radio page, NAV tuning, Settings deletes, Wind lab layout, new rail). This work is on `feature/active-flight`.

## Verification
Done on `feature/active-flight` against the production build (`pnpm build`, served statically):
- Each page follows the active flight.
- Switching on each page carries over to the others.
- Reload and `?flight=` links work.
- Deleting the active flight falls back.
- Cross-tab sync works.
- No console errors.
- No sideways scroll at phone width.
