import type { BBox } from "./types";

export type LoadedImage = { src: string; width: number; height: number };

/** Every photo in the app is stored and shown at this width / height ratio. */
export const FRAME = 3 / 4;

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

/** Center-crops to FRAME and downscales so photos fit comfortably in IndexedDB. */
export async function fromFile(file: Blob, maxSide = 2000): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  try {
    return await fromSource(url, maxSide);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function fromSource(
  source: string | HTMLImageElement | HTMLVideoElement,
  maxSide = 2000,
): Promise<LoadedImage> {
  const img = typeof source === "string" ? await loadImage(source) : source;
  const vw = "videoWidth" in img ? img.videoWidth : img.naturalWidth;
  const vh = "videoHeight" in img ? img.videoHeight : img.naturalHeight;
  const [sw, sh] = vw / vh > FRAME ? [vh * FRAME, vh] : [vw, vw / FRAME];
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.round(sw * k);
  const h = Math.round(sh * k);
  const { c, ctx } = canvas(w, h);
  ctx.drawImage(img, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, w, h);
  return { src: c.toDataURL("image/jpeg", 0.86), width: w, height: h };
}

/**
 * Vision payload for Muse/SAM: the same framed scan the UI shows (content + aspect),
 * only smaller if needed so large photos don’t burn tokens. Never re-crops or pads.
 */
export async function forVision(image: LoadedImage, maxSide = 1280): Promise<string> {
  if (Math.max(image.width, image.height) <= maxSide) {
    return image.src;
  }
  const img = await loadImage(image.src);
  const k = maxSide / Math.max(image.width, image.height);
  const w = Math.max(1, Math.round(image.width * k));
  const h = Math.max(1, Math.round(image.height * k));
  const { c, ctx } = canvas(w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.82);
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
