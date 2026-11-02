# Locus

Take one photo of a space. Next time, Locus tells you what’s **missing**, what’s **new**, and what **moved**.

Mobile-first web app (Next.js 16, React 19, Tailwind 4). Spaces, items and check history live in the browser (IndexedDB). Real photos go through a server vision route; the API key never reaches the client.

## Run

```bash
pnpm install
pnpm dev
```

First launch seeds a sample **Workbench** space. Open it, tap **Check now**, then **Use sample photo** to see a full comparison without a camera or API key.

All stored photos are center-cropped to 3:4 (`FRAME` in `lib/image.ts`) so the viewfinder, current photo and check report line up.

## Flow

| Screen | Route |
| --- | --- |
| Home (swipeable space cards, things that need a look) | `/` |
| Search (items across spaces) | `/search` |
| Activity (checks across spaces, filter by space) | `/activity` |
| New space (photo → rename / toggle track / draw to add → save) | `/spaces/new` |
| Space (current photo, items, not tracked, history; `?item=` opens an item) | `/spaces/[id]` |
| Check (camera, library, or sample; hold to peek last photo) | `/spaces/[id]/check` |
| Check report (pan-zoom photo, missing / new / moved, found / gone, save as new current) | `/spaces/[id]/audits/[auditId]` |

On a check report you can mark **Found it** / **It’s gone**, **Keep track** / **Stop tracking**, and **Save as new current** so the next check compares against that photo. Occluded spots show as **Maybe hidden · take a look**.

Deleting a check that is the current photo rolls the reference back to the previous one (and drops any later checks compared against it). The first photo of a space can’t be deleted on its own; deleting the space removes everything.

In code, a reference photo is a `Commit`, its item list the ledger, and a check an `Audit`; the UI never shows these terms or their IDs.

## Vision (Meta Model API)

Pipeline for every real photo (demo fixtures stay local):

1. **Muse** — short Title Case concepts (“Monitor”, “Mouse”)
2. **SAM 3.1** — boxes / masks per concept (optional; on by default)
3. First photo uses those names directly; later checks re-label + Re-ID against the ledger

The API key stays on the server (`POST /api/vision/detect`). The browser never sees it.

```bash
cp .env.example .env.local
# put MODEL_API_KEY in .env.local — gitignored, do not commit
pnpm dev
```

| Env | Role |
| --- | --- |
| `MODEL_API_KEY` | Required for real camera / library photos |
| `MUSE_MODEL` | Default `muse-spark-1.3` (also `muse-wonder-1.0`) |
| `MUSE_REASONING_EFFORT` | Default `low` |
| `MUSE_USE_SAM` | Default on; set `0` for Muse-only boxes |

On **Vercel**, add the same vars under Project → Settings → Environment Variables (Production + Preview). `.env.local` is only for your laptop.

| Piece | Role |
| --- | --- |
| `lib/muse/detect.ts` | Muse + SAM pipeline |
| `lib/vision/muse.ts` | Client → `/api/vision/detect` |
| `lib/engine.ts` | Diff: signature match, moves, confirmed vs occluded missing |
| `lib/image.ts` | 3:4 framing, crops, vision downscale |
| `.env.local` | Secrets (gitignored) |
| `.env.example` | Safe template (safe to commit) |

`detect` must return a `signature` per object: the diff engine matches objects across photos by signature, flags moves by centroid shift, and splits missing items into *confirmed* vs *occluded* by how much of the old spot is covered by current detections. Crops are computed client-side.

## Deploy

Push to a Git repo and import it in Vercel. For real photos, set at least `MODEL_API_KEY` (and any optional Muse vars above). The Workbench sample works without a key.

## Fonts

Schibsted Grotesk — SIL Open Font License, self-hosted via Fontsource.
