# Locus

Version control for physical spaces. Commit a baseline photo of a desk, bench or shelf; every later photo is diffed against it and reports what went **missing**, what was **added**, and what **moved**.

Mobile-first web app (Next.js 16, React 19, Tailwind 4). All data lives in the browser (IndexedDB) — no backend.

## Run

```bash
pnpm install
pnpm dev
```

A sample "Workbench" space is created on first launch. Open it, tap **Check now**, then **Use sample photo** to see a full comparison.

All photos are center-cropped to 3:4 (`FRAME` in `lib/image.ts`) so the viewfinder, reference photo and check report always line up.

## Flow

| Screen | Route |
| --- | --- |
| Home (swipeable space cards, items that need a look) | `/` |
| Search (every item across spaces) | `/search` |
| Activity (every check across spaces, filter by space) | `/activity` |
| New space (take photo → rename / switch off items → save) | `/spaces/new` |
| Space (reference photo, items, untracked items, history; `?item=` opens an item) | `/spaces/[id]` |
| Check (camera) | `/spaces/[id]/check` |
| Check report (pan-zoom photo, missing / new / moved, save as new reference, delete) | `/spaces/[id]/audits/[auditId]` |

Deleting a check that is the current reference photo rolls the reference back to the previous one (and drops any later checks compared against it). The first photo of a space can't be deleted on its own; deleting the space removes everything.

In code, a reference photo is a `Commit`, its item list the ledger, and a check an `Audit`; the UI never shows these terms or their IDs.

## Vision (Meta Model API)

Pipeline for every real photo (demo fixtures stay local):

1. **Muse Spark** — short Title Case concepts (“Monitor”, “Mouse”)
2. **SAM 3.1** — boxes / masks per concept
3. First photo uses those names directly; later checks re-label + Re-ID against the ledger

The API key stays on the server (`/api/vision/detect`). The browser never sees it.

```bash
cp .env.example .env.local
# put MODEL_API_KEY in .env.local — gitignored, do not commit
pnpm dev
```

On **Vercel**, add the same `MODEL_API_KEY` under Project → Settings → Environment Variables (Production + Preview). `.env.local` is only for your laptop.

| Piece | Role |
| --- | --- |
| `lib/muse/detect.ts` | Muse + SAM pipeline |
| `lib/vision/muse.ts` | Client → `/api/vision/detect` |
| `.env.local` | Secrets (gitignored) |
| `.env.example` | Safe template (safe to commit) |

`detect` must return a `signature` per object: the diff engine (`lib/engine.ts`) matches objects across photos by signature, flags moves by centroid shift, and splits missing items into *confirmed* vs *occluded* by how much of the old spot is covered by current detections. Crops are computed client-side (`lib/image.ts`).

## Deploy

Push to a Git repo and import it in Vercel — no env vars or config needed.

## Fonts

Big Shoulders Display, Schibsted Grotesk, Martian Mono — all SIL Open Font License, self-hosted via Fontsource.
