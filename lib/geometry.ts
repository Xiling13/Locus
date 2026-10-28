import type { BBox } from "./types";

export const center = (b: BBox) => [b.x + b.w / 2, b.y + b.h / 2] as const;

export function region(b: BBox) {
  const [cx, cy] = center(b);
  const v = cy < 0.34 ? "top" : cy > 0.66 ? "bottom" : "";
  const h = cx < 0.34 ? "left" : cx > 0.66 ? "right" : "";
  if (!v && !h) return "center of frame";
  if (!v) return `${h} edge of frame`;
  if (!h) return `${v} of frame`;
  return `${v}-${h} of frame`;
}

export function direction(from: BBox, to: BBox) {
  const [ax, ay] = center(from);
  const [bx, by] = center(to);
  const dx = bx - ax;
  const dy = by - ay;
  const v = Math.abs(dy) < 0.04 ? "" : dy > 0 ? "down" : "up";
  const h = Math.abs(dx) < 0.04 ? "" : dx > 0 ? "right" : "left";
  return { dist: Math.hypot(dx, dy), dir: [v, h].filter(Boolean).join(" & ") || "in place" };
}

export function inflate(b: BBox, k: number): BBox {
  const dw = b.w * k;
  const dh = b.h * k;
  return { x: b.x - dw / 2, y: b.y - dh / 2, w: b.w + dw, h: b.h + dh };
}

export function union(a: BBox, b: BBox): BBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
