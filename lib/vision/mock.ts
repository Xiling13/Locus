import { center, region } from "../geometry";
import type { LoadedImage } from "../image";
import type { BBox, Detection } from "../types";
import { fixtureHints, fixtures } from "./fixtures";
import type { DetectContext, VisionProvider } from "./provider";

const POOL: [string, string, string[]][] = [
  ["Notebook", "Stationery", ["A5", "dark cover"]],
  ["Water bottle", "Everyday", ["insulated"]],
  ["Key ring", "Personal", ["steel ring"]],
  ["Headphones", "Electronics", ["over-ear"]],
  ["Charger", "Electronics", ["white", "USB-C"]],
  ["Wallet", "Personal", ["leather"]],
  ["Glasses", "Personal", ["black frame"]],
  ["Pen", "Stationery", ["black"]],
  ["Phone", "Electronics", ["face down"]],
  ["Scissors", "Tool", ["steel blades"]],
  ["Tape", "Supplies", ["clear"]],
  ["Mouse", "Electronics", ["wireless"]],
];

function hash(s: string) {
  let h = 2166136261;
  const step = Math.max(1, Math.floor(s.length / 4096));
  for (let i = 0; i < s.length; i += step) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const uid = (r: () => number) => Math.floor(r() * 36 ** 6).toString(36).padStart(6, "0");

function scatter(r: () => number, cells: number[]): BBox[] {
  return cells.map((cell) => {
    const cx = (cell % 3) / 3;
    const cy = Math.floor(cell / 3) / 3;
    const w = 0.12 + r() * 0.12;
    const h = 0.1 + r() * 0.12;
    return {
      x: cx + 0.02 + r() * (1 / 3 - w - 0.04),
      y: cy + 0.02 + r() * (1 / 3 - h - 0.04),
      w,
      h,
    };
  });
}

function synthesize(image: LoadedImage, ctx?: DetectContext): Detection[] {
  const r = rng(hash(image.src));

  if (!ctx?.base?.length) {
    const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => r() - 0.5).slice(0, 7);
    const names = [...POOL].sort(() => r() - 0.5);
    return scatter(r, cells).map((bbox, i) => ({
      id: uid(r),
      label: names[i][0],
      category: names[i][1],
      traits: names[i][2],
      bbox,
      signature: `${names[i][0]}-${uid(r)}`,
    }));
  }

  // Audit: perturb the ledger so every diff state shows up.
  const base = ctx.base;
  const drop = Math.floor(r() * base.length);
  const move = (drop + 1 + Math.floor(r() * (base.length - 1))) % base.length;
  const out: Detection[] = [];
  base.forEach((o, i) => {
    if (i === drop) return;
    let bbox = o.bbox;
    if (i === move) {
      bbox = {
        ...bbox,
        x: Math.min(1 - bbox.w, Math.max(0, bbox.x + (r() > 0.5 ? 0.22 : -0.22))),
        y: Math.min(1 - bbox.h, Math.max(0, bbox.y + (r() - 0.5) * 0.2)),
      };
    }
    const { label, category, traits, signature } = o;
    out.push({ id: uid(r), label, category, traits, signature, bbox });
  });
  const used = new Set(base.map((o) => o.label));
  const extra = POOL.find(([n]) => !used.has(n)) ?? POOL[0];
  const dropped = base[drop].bbox;
  out.push({
    id: uid(r),
    label: extra[0],
    category: extra[1],
    traits: extra[2],
    bbox: { x: dropped.x + dropped.w * 0.3, y: dropped.y + dropped.h * 0.4, w: 0.16, h: 0.12 },
    signature: `${extra[0]}-${uid(r)}`,
  });
  return out;
}

export const mockVision: VisionProvider = {
  async detect(image, ctx) {
    const key = image.src.startsWith("/") ? image.src : "";
    const fixture = fixtures[key];
    if (fixture) {
      return fixture.map((f, i) => ({
        id: `${f.signature}-${i}`,
        label: f.label,
        category: f.category,
        traits: f.traits,
        bbox: f.bbox,
        signature: f.signature,
      }));
    }
    return synthesize(image, ctx);
  },

  describePlacement(target, scene) {
    if (fixtureHints[target.signature]) return fixtureHints[target.signature];
    const [tx, ty] = center(target.bbox);
    const near = scene
      .filter((d) => d.id !== target.id)
      .map((d) => {
        const [x, y] = center(d.bbox);
        return { d, dist: Math.hypot(x - tx, y - ty) };
      })
      .sort((a, b) => a.dist - b.dist)[0];
    const where = region(target.bbox);
    return near ? `${where[0].toUpperCase()}${where.slice(1)}, next to the ${near.d.label.toLowerCase()}` : where;
  },
};
