import { museVision } from "./muse";
import type { VisionProvider } from "./provider";

/** Muse Spark (+ optional SAM) via Meta Model API. Demo fixture photos still use local labels. */
export const vision: VisionProvider = museVision;
export type { VisionProvider } from "./provider";
