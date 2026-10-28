/** Normalized to the image: 0..1 on both axes. */
export type BBox = { x: number; y: number; w: number; h: number };

export type Detection = {
  id: string;
  label: string;
  category: string;
  traits: string[];
  bbox: BBox;
  /**
   * Identity key used to match the same physical object across photos.
   * A real provider would put an embedding hash / re-id token here.
   */
  signature: string;
};

export type LedgerObject = Detection & {
  crop: string;
  hint: string;
  seenAt: string;
};

export type Commit = {
  id: string;
  parentId: string | null;
  createdAt: string;
  message: string;
  image: string;
  width: number;
  height: number;
  edges: string;
  objects: LedgerObject[];
};

export type DiffKind = "removed" | "added" | "moved";

export type DiffItem = {
  id: string;
  kind: DiffKind;
  label: string;
  category: string;
  crop: string;
  /** Ledger object this item refers to (removed / moved). */
  objectId?: string;
  /** Current detection this item refers to (added / moved). */
  detectionId?: string;
  from?: BBox;
  to?: BBox;
  confidence?: "confirmed" | "occluded";
  occludedBy?: string;
  resolution?: "found" | "missing";
};

export type Audit = {
  id: string;
  baseCommitId: string;
  createdAt: string;
  image: string;
  width: number;
  height: number;
  detections: Detection[];
  items: DiffItem[];
  unchanged: number;
  committedAs?: string;
};

export type Space = {
  id: string;
  name: string;
  createdAt: string;
  headId: string;
  commits: Commit[];
  audits: Audit[];
  demo?: boolean;
};
