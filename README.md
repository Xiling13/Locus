# Locus

Version control for physical spaces. Commit a baseline photo of a desk, bench or shelf; every later photo is diffed against it and reports what went **missing**, what was **added**, and what **moved**.

Mobile-first web app (Next.js 16, React 19, Tailwind 4). All data lives in the browser (IndexedDB) — no backend.

## Run

```bash
pnpm install
pnpm dev
```

A sample "Workbench" space is created on first launch. Open it, tap **Start audit**, then **Use sample audit photo** to see a full diff.

## Flow

| Screen | Route |
| --- | --- |
| Spaces | `/` |
| New space (shoot baseline → review detections → commit) | `/spaces/new` |
| Space (baseline, ledger, audits, commits) | `/spaces/[id]` |
| Audit capture (camera + ghost overlay) | `/spaces/[id]/check` |
| Audit report (pan-zoom canvas, inspector, last seen, recommit) | `/spaces/[id]/audits/[auditId]` |

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
