import { center } from "./geometry";
import { cropOf, loadImage, type LoadedImage } from "./image";
import type { Audit, BBox, Commit, Detection, DiffItem, LedgerObject } from "./types";
import { vision } from "./vision";

// Framing / angle will drift between checks — treat modest centroid shifts as moves, not new items.
const MOVE_THRESHOLD = 0.08;
/**
 * Fraction of an old spot that must sit under a current detection before we call it
 * "Maybe hidden". Keep this strict: grazing overlap from a nearby keyboard / rock
 * should read as Missing (empty desk), not occluded.
 */
const OCCLUSION_THRESHOLD = 0.45;
/** Minimum label likeness before we reuse a ledger identity without a matching signature. */
const SOFT_MATCH_MIN = 2;

export const shortId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 7);

/** Fraction of `a` covered by `b`. */
function coverage(a: BBox, b: BBox) {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return (ix * iy) / (a.w * a.h);
}

function containsPoint(b: BBox, x: number, y: number) {
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

/**
 * A second outline of the same object (detector double box), not two neighbors.
 * The smaller box has to sit mostly inside the larger one — side-by-side pens stay apart.
 */
function sameInstance(a: BBox, b: BBox) {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  if (inter <= 0) return false;
  const smaller = Math.min(a.w * a.h, b.w * b.h);
  return smaller > 0 && inter / smaller >= 0.6;
}

/**
 * True occlusion: another object is sitting on the old spot — not a corner clip from
 * a neighbour. Require solid coverage and that the spot's centre still lies under it.
 */
function occlusionOf(spot: BBox, detections: Detection[]) {
  const [cx, cy] = center(spot);
  let best: { d: Detection; c: number } | undefined;
  for (const d of detections) {
    const c = coverage(spot, d.bbox);
    if (c < OCCLUSION_THRESHOLD) continue;
    if (!containsPoint(d.bbox, cx, cy)) continue;
    if (!best || c > best.c) best = { d, c };
  }
  return best;
}

function normLabel(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** How alike two inventory names are. Exact / containment preferred over loose word overlap. */
function labelScore(a: string, b: string) {
  const na = normLabel(a);
  const nb = normLabel(b);
  if (!na || !nb) return 0;
  if (na === nb) return 3;
  if (na.includes(nb) || nb.includes(na)) return 2;
  const wa = new Set(na.split(" ").filter(Boolean));
  const wb = new Set(nb.split(" ").filter(Boolean));
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  if (overlap && overlap === Math.min(wa.size, wb.size)) return 1.5;
  return overlap ? 1 : 0;
}

function softScore(o: LedgerObject, d: Detection) {
  let score = labelScore(o.label, d.label);
  if (score <= 0) return 0;
  if (o.category && d.category && o.category.toLowerCase() === d.category.toLowerCase()) score += 0.35;
  const ot = new Set(o.traits.map((t) => t.toLowerCase()));
  for (const t of d.traits) if (ot.has(t.toLowerCase())) score += 0.15;
  // Prefer nearer boxes when several labels look alike.
  const [ax, ay] = center(o.bbox);
  const [bx, by] = center(d.bbox);
  score += Math.max(0, 0.4 - Math.hypot(ax - bx, ay - by));
  return score;
}

export function detect(image: LoadedImage, base?: LedgerObject[]) {
  return vision.detect(image, { base });
}

export async function buildCommit(
  image: LoadedImage,
  detections: Detection[],
  opts: { parentId: string | null; message: string; previous?: LedgerObject[] },
): Promise<Commit> {
  const img = await loadImage(image.src);
  const now = new Date().toISOString();
  const prev = new Map(opts.previous?.map((o) => [o.signature, o]));
  return {
    id: shortId(),
    parentId: opts.parentId,
    createdAt: now,
    message: opts.message,
    image: image.src,
    width: image.width,
    height: image.height,
    objects: detections.map((d) => ({
      ...d,
      id: prev.get(d.signature)?.id ?? d.id,
      label: prev.get(d.signature)?.label ?? d.label,
      crop: cropOf(img, d.bbox),
      hint: vision.describePlacement(d, detections),
      seenAt: now,
    })),
  };
}

/** An item the user outlined by hand on the reference photo. */
export async function manualObject(commit: Commit, bbox: BBox, label: string): Promise<LedgerObject> {
  const img = await loadImage(commit.image);
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
  const d: Detection = {
    id: shortId(),
    label,
    category: "Everyday",
    traits: [],
    signature: `${slug}-${shortId().slice(0, 4)}`,
    bbox,
  };
  return {
    ...d,
    crop: cropOf(img, bbox),
    hint: vision.describePlacement(d, [...commit.objects, d]),
    seenAt: new Date().toISOString(),
  };
}

export async function runAudit(base: Commit, image: LoadedImage, untracked: LedgerObject[] = []): Promise<Audit> {
  const ignored = new Set(untracked.map((o) => o.signature));
  const detections = (await detect(image, base.objects)).filter((d) => !ignored.has(d.signature));
  const img = await loadImage(image.src);
  const bySig = new Map(detections.map((d) => [d.signature, d]));
  const matchedDet = new Set<string>();
  const matchedObj = new Set<string>();
  const items: DiffItem[] = [];
  let unchanged = 0;

  const accept = (o: LedgerObject, hit: Detection) => {
    matchedDet.add(hit.id);
    matchedObj.add(o.id);
    // Re-bind identity so Save as current keeps the ledger id / name.
    hit.signature = o.signature;
    hit.label = o.label;
    hit.category = o.category;
    const [ax, ay] = center(o.bbox);
    const [bx, by] = center(hit.bbox);
    if (Math.hypot(ax - bx, ay - by) > MOVE_THRESHOLD) {
      items.push({
        id: `mv-${o.id}`,
        kind: "moved",
        label: o.label,
        category: o.category,
        crop: cropOf(img, hit.bbox),
        objectId: o.id,
        detectionId: hit.id,
        from: o.bbox,
        to: hit.bbox,
      });
    } else {
      unchanged++;
    }
  };

  for (const o of base.objects) {
    const hit = bySig.get(o.signature);
    if (hit && !matchedDet.has(hit.id)) accept(o, hit);
  }

  // Semantic greedy by exact label: unique 1:1 first, then N:N nearest-centroid so
  // two Pens that slid a little become Moved instead of Missing + New.
  {
    const freeObj = base.objects.filter((o) => !matchedObj.has(o.id));
    const freeDet = detections.filter((d) => !matchedDet.has(d.id));
    const objByLabel = new Map<string, LedgerObject[]>();
    const detByLabel = new Map<string, Detection[]>();
    for (const o of freeObj) {
      const k = normLabel(o.label);
      if (!k) continue;
      const list = objByLabel.get(k);
      if (list) list.push(o);
      else objByLabel.set(k, [o]);
    }
    for (const d of freeDet) {
      const k = normLabel(d.label);
      if (!k) continue;
      const list = detByLabel.get(k);
      if (list) list.push(d);
      else detByLabel.set(k, [d]);
    }
    for (const [k, objs] of objByLabel) {
      const dets = detByLabel.get(k);
      if (!dets?.length) continue;
      if (objs.length === 1 && dets.length === 1) {
        const o = objs[0];
        const d = dets[0];
        if (matchedObj.has(o.id) || matchedDet.has(d.id)) continue;
        accept(o, d);
        continue;
      }
      const near: { o: LedgerObject; d: Detection; dist: number }[] = [];
      for (const o of objs) {
        for (const d of dets) {
          const [ax, ay] = center(o.bbox);
          const [bx, by] = center(d.bbox);
          near.push({ o, d, dist: Math.hypot(ax - bx, ay - by) });
        }
      }
      near.sort((a, b) => a.dist - b.dist);
      for (const { o, d } of near) {
        if (matchedObj.has(o.id) || matchedDet.has(d.id)) continue;
        accept(o, d);
      }
    }
  }

  // Muse often mint a fresh signature when an item moves — pair leftovers by soft
  // label likeness before calling them Missing + New.
  const freeObj = base.objects.filter((o) => !matchedObj.has(o.id));
  const freeDet = detections.filter((d) => !matchedDet.has(d.id));
  const pairs: { o: LedgerObject; d: Detection; score: number; dist: number }[] = [];
  for (const o of freeObj) {
    for (const d of freeDet) {
      const score = softScore(o, d);
      if (score < SOFT_MATCH_MIN) continue;
      const [ax, ay] = center(o.bbox);
      const [bx, by] = center(d.bbox);
      pairs.push({ o, d, score, dist: Math.hypot(ax - bx, ay - by) });
    }
  }
  pairs.sort((a, b) => b.score - a.score || a.dist - b.dist);
  for (const { o, d } of pairs) {
    if (matchedObj.has(o.id) || matchedDet.has(d.id)) continue;
    accept(o, d);
  }

  // One physical thing sometimes arrives as two overlapping boxes with the same name.
  // Listing both makes one cable (or one pen) show up twice. Neighbors that only
  // touch, and two of the same name in different spots, stay separate.
  const sameName = (a: string, b: string) => {
    const na = normLabel(a);
    return na !== "" && na === normLabel(b);
  };
  const alreadyHeld = <T extends { id: string; label: string; bbox: BBox }>(
    item: T,
    kept: T[],
    pool: T[],
    taken: Set<string>,
  ) =>
    kept.some((k) => sameName(k.label, item.label) && sameInstance(k.bbox, item.bbox)) ||
    pool.some(
      (k) =>
        k.id !== item.id &&
        taken.has(k.id) &&
        sameName(k.label, item.label) &&
        sameInstance(k.bbox, item.bbox),
    );

  const removed = base.objects
    .filter((o) => !matchedObj.has(o.id))
    .sort((a, b) => b.bbox.w * b.bbox.h - a.bbox.w * a.bbox.h);
  const keptRemoved: LedgerObject[] = [];
  for (const o of removed) {
    if (alreadyHeld(o, keptRemoved, base.objects, matchedObj)) continue;
    keptRemoved.push(o);
  }
  for (const o of keptRemoved) {
    const cover = occlusionOf(o.bbox, detections);
    items.push({
      id: `rm-${o.id}`,
      kind: "removed",
      label: o.label,
      category: o.category,
      crop: o.crop,
      objectId: o.id,
      from: o.bbox,
      confidence: cover ? "occluded" : "confirmed",
      occludedBy: cover ? cover.d.label : undefined,
    });
  }

  const added = detections
    .filter((d) => !matchedDet.has(d.id))
    .sort((a, b) => b.bbox.w * b.bbox.h - a.bbox.w * a.bbox.h);
  const keptAdded: Detection[] = [];
  for (const d of added) {
    if (alreadyHeld(d, keptAdded, detections, matchedDet)) continue;
    keptAdded.push(d);
  }
  for (const d of keptAdded) {
    items.push({
      id: `ad-${d.id}`,
      kind: "added",
      label: d.label,
      category: d.category,
      crop: cropOf(img, d.bbox),
      detectionId: d.id,
      to: d.bbox,
    });
  }

  return {
    id: shortId(),
    baseCommitId: base.id,
    createdAt: new Date().toISOString(),
    image: image.src,
    width: image.width,
    height: image.height,
    detections,
    items,
    unchanged,
  };
}

/**
 * New reference from a check. Items marked found are carried over from the old reference
 * (they were hidden, not gone); new detections listed in `skip` go to the untracked list.
 */
export async function recommit(base: Commit, audit: Audit, skip: Set<string> = new Set()) {
  const found = new Set(
    audit.items.filter((i) => i.kind === "removed" && i.resolution === "found").map((i) => i.objectId),
  );
  const commit = await buildCommit(
    { src: audit.image, width: audit.width, height: audit.height },
    audit.detections,
    { parentId: base.id, message: `Recommit after audit ${audit.id}`, previous: base.objects },
  );
  const untracked = commit.objects.filter((o) => skip.has(o.id));
  commit.objects = [
    ...commit.objects.filter((o) => !skip.has(o.id)),
    ...base.objects.filter((o) => found.has(o.id)),
  ];
  return { commit, untracked };
}
