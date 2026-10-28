import type { LoadedImage } from "../image";
import type { Detection, LedgerObject } from "../types";

export type DetectContext = {
  /** Ledger of the commit being audited against, when there is one. */
  base?: LedgerObject[];
};

/**
 * Everything Locus needs from the vision stack. Swap the implementation in
 * `lib/vision/index.ts` to plug in real segmentation / captioning models.
 */
export interface VisionProvider {
  /** Instance segmentation + semantic labelling of every physical object. */
  detect(image: LoadedImage, ctx?: DetectContext): Promise<Detection[]>;
  /** Short spoken-style description of where the object sits in the scene. */
  describePlacement(target: Detection, scene: Detection[]): string;
}
