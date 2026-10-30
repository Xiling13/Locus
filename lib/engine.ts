import { center } from "./geometry";
import { cropOf, edgeMap, loadImage, type LoadedImage } from "./image";
import type { Audit, BBox, Commit, Detection, DiffItem, LedgerObject } from "./types";
import { vision } from "./vision";

const MOVE_THRESHOLD = 0.035;
const OCCLUSION_THRESHOLD = 0.25;

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
    edges: edgeMap(img),
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

export async function runAudit(base: Commit, image: LoadedImage, untracked: LedgerObject[] = []): Promise<Audit> {
  const ignored = new Set(untracked.map((o) => o.signature));
  const detections = (await detect(image, base.objects)).filter((d) => !ignored.has(d.signature));
  const img = await loadImage(image.src);
  const bySig = new Map(detections.map((d) => [d.signature, d]));
  const matched = new Set<string>();
  const items: DiffItem[] = [];
  let unchanged = 0;

  for (const o of base.objects) {
    const hit = bySig.get(o.signature);
    if (hit) {
      matched.add(hit.id);
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
      continue;
    }
    const cover = detections
      .map((d) => ({ d, c: coverage(o.bbox, d.bbox) }))
      .sort((a, b) => b.c - a.c)[0];
    const occluded = cover && cover.c >= OCCLUSION_THRESHOLD;
    items.push({
      id: `rm-${o.id}`,
      kind: "removed",
      label: o.label,
      category: o.category,
      crop: o.crop,
      objectId: o.id,
      from: o.bbox,
      confidence: occluded ? "occluded" : "confirmed",
      occludedBy: occluded ? cover.d.label : undefined,
    });
  }

  for (const d of detections) {
    if (matched.has(d.id)) continue;
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
