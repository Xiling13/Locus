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
| Check (camera + outline guide) | `/spaces/[id]/check` |
| Check report (pan-zoom photo, missing / new / moved, save as new reference) | `/spaces/[id]/audits/[auditId]` |

In code, a reference photo is a `Commit`, its item list the ledger, and a check an `Audit`; the UI never shows these terms or their IDs.

## Plugging in real vision

The vision stack is mocked. Everything model-specific sits behind one interface:

- `lib/vision/provider.ts` — `VisionProvider` contract (`detect`, `describePlacement`)
- `lib/vision/mock.ts` — mock implementation; uses hand-labelled fixtures for the demo photos, synthetic detections otherwise
- `lib/vision/index.ts` — swap `mockVision` for your implementation

`detect` must return a `signature` per object: the diff engine (`lib/engine.ts`) matches objects across photos by signature, flags moves by centroid shift, and splits missing items into *confirmed* vs *occluded* by how much of the old spot is covered by current detections. Ghost overlay edges and crops are computed client-side (`lib/image.ts`).

## Deploy

Push to a Git repo and import it in Vercel — no env vars or config needed.

## Fonts

Big Shoulders Display, Schibsted Grotesk, Martian Mono — all SIL Open Font License, self-hosted via Fontsource.
