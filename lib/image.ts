import type { BBox } from "./types";

export type LoadedImage = { src: string; width: number; height: number };

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src.slice(0, 48)}`));
    img.src = src;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  return { c, ctx };
}

/** Downscales large photos so they fit comfortably in IndexedDB. */
export async function fromFile(file: Blob, maxSide = 2000): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  try {
    return await fromSource(url, maxSide);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function fromSource(
  source: string | CanvasImageSource,
  maxSide = 2000,
): Promise<LoadedImage> {
  const img = typeof source === "string" ? await loadImage(source) : source;
  const sw = "videoWidth" in img ? img.videoWidth : (img as HTMLImageElement).naturalWidth;
  const sh = "videoHeight" in img ? img.videoHeight : (img as HTMLImageElement).naturalHeight;
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.round(sw * k);
  const h = Math.round(sh * k);
  const { c, ctx } = canvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { src: c.toDataURL("image/jpeg", 0.86), width: w, height: h };
}

export function cropOf(img: HTMLImageElement, box: BBox, size = 320, pad = 0.18): string {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const side = Math.max(box.w * W, box.h * H) * (1 + pad * 2);
  const cx = (box.x + box.w / 2) * W;
  const cy = (box.y + box.h / 2) * H;
  const sx = Math.max(0, Math.min(W - side, cx - side / 2));
  const sy = Math.max(0, Math.min(H - side, cy - side / 2));
  const { c, ctx } = canvas(size, size);
  ctx.drawImage(img, sx, sy, Math.min(side, W), Math.min(side, H), 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.82);
}

/**
 * Sobel edge map rendered as white strokes on transparent background —
 * used as the ghost overlay when lining up the next shot.
 */
export function edgeMap(img: HTMLImageElement, width = 540): string {
  const k = width / img.naturalWidth;
  const w = width;
  const h = Math.round(img.naturalHeight * k);
  const { c, ctx } = canvas(w, h);
  ctx.filter = "blur(1.2px)";
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";
  const src = ctx.getImageData(0, 0, w, h).data;

  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114;
  }

  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] +
        gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] +
        gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      mag[i] = Math.hypot(gx, gy);
    }
  }

  const sorted = Float32Array.from(mag).sort();
  const lo = sorted[Math.floor(sorted.length * 0.86)];
  const hi = sorted[Math.floor(sorted.length * 0.985)] || lo + 1;

  const out = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const a = Math.max(0, Math.min(1, (mag[i] - lo) / (hi - lo)));
    out.data[i * 4] = 255;
    out.data[i * 4 + 1] = 255;
    out.data[i * 4 + 2] = 255;
    out.data[i * 4 + 3] = Math.round(a * 255);
  }
  ctx.putImageData(out, 0, 0);
  return c.toDataURL("image/png");
}
