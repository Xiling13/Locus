import { center, region } from "../geometry";
import { forVision, type LoadedImage } from "../image";
import { VisionError } from "../failure";
import type { Detection, LedgerObject } from "../types";
import { fixtureHints, fixtures } from "./fixtures";
import { mockVision } from "./mock";
import type { DetectContext, VisionProvider } from "./provider";

/** Well past a normal round-trip (~9s), short of the route's 120s limit. */
const TIMEOUT_MS = 90_000;

function describeLocal(target: Detection, scene: Detection[]) {
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
  return near
    ? `${where[0].toUpperCase()}${where.slice(1)}, next to the ${near.d.label.toLowerCase()}`
    : where;
}

/**
 * Client provider: demo fixtures stay local; real photos go through
 * `/api/vision/detect` so MODEL_API_KEY never leaves the server.
 */
export const museVision: VisionProvider = {
  async detect(image: LoadedImage, ctx?: DetectContext) {
    const key = image.src.startsWith("/") ? image.src : "";
    if (key && fixtures[key]) {
      return mockVision.detect(image, ctx);
    }

    if (!navigator.onLine) throw new VisionError("offline", "OFFLINE", "Device is offline");

    // Same crop/aspect as Scanner / check viewfinder; compress only when oversized.
    let res: Response;
    try {
      res = await fetch("/api/vision/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: await forVision(image),
          base: ctx?.base as LedgerObject[] | undefined,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError")
        throw new VisionError("slow", "TIMEOUT", "Vision request timed out");
      throw new VisionError("offline", "NETWORK", "Vision request never reached the server");
    }

    const payload = (await res.json().catch(() => ({}))) as {
      detections?: Detection[];
      error?: string;
    };

    if (!res.ok) {
      const kind = res.status === 503 ? "setup" : res.status === 504 ? "slow" : "server";
      throw new VisionError(kind, `HTTP ${res.status}`, payload.error || `Vision API ${res.status}`);
    }
    if (!payload.detections) {
      throw new VisionError("server", "EMPTY", "Vision API returned no detections");
    }
    return payload.detections;
  },

  describePlacement(target, scene) {
    return describeLocal(target, scene);
  },
};
