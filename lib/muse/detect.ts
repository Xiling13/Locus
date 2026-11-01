import type { BBox, Detection, LedgerObject } from "../types";

const META_BASE = "https://api.meta.ai/v1";

type Concept = { phrase: string; category: string };

type LabeledObject = {
  boxIndex: number;
  keep: boolean;
  label: string;
  category: string;
  traits: string[];
  signature: string;
};

const CONCEPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["concepts"],
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["phrase", "category"],
        properties: {
          phrase: { type: "string" },
          category: { type: "string" },
        },
      },
    },
  },
} as const;

const LABEL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["objects"],
  properties: {
    objects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["boxIndex", "keep", "label", "category", "traits", "signature"],
        properties: {
          boxIndex: { type: "integer" },
          keep: { type: "boolean" },
          label: { type: "string" },
          category: { type: "string" },
          traits: { type: "array", items: { type: "string" } },
          signature: { type: "string" },
        },
      },
    },
  },
} as const;

function apiKey() {
  const key = process.env.MODEL_API_KEY?.trim();
  if (!key) throw new Error("MODEL_API_KEY is not set (add it to .env.local / Vercel env)");
  return key;
}

function modelId() {
  return process.env.MUSE_MODEL?.trim() || "muse-spark-1.3";
}

function reasoningEffort() {
  return process.env.MUSE_REASONING_EFFORT?.trim() || "medium";
}

function useSam() {
  const v = process.env.MUSE_USE_SAM?.trim().toLowerCase();
  // Default ON — Locus needs SAM boxes; set MUSE_USE_SAM=0 to skip.
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

function shortId() {
  return Math.floor(Math.random() * 36 ** 6)
    .toString(36)
    .padStart(6, "0");
}

function area(b: BBox) {
  return b.w * b.h;
}

function iou(a: BBox, b: BBox) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/** Drop tiny noise / huge background slabs, then NMS near-duplicates. */
function pruneBoxes(boxes: BBox[], iouThresh = 0.55): BBox[] {
  const filtered = boxes.filter((b) => {
    const a = area(b);
    return a >= 0.004 && a <= 0.35 && b.w >= 0.03 && b.h >= 0.03;
  });
  const ranked = [...filtered].sort((a, b) => area(b) - area(a));
  const kept: BBox[] = [];
  for (const box of ranked) {
    if (kept.some((k) => iou(k, box) >= iouThresh)) continue;
    kept.push(box);
  }
  return kept.slice(0, 16);
}

async function museJson<T>(
  prompt: string,
  imageDataUrl: string,
  schema: object,
  schemaName: string,
): Promise<T> {
  const res = await fetch(`${META_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelId(),
      reasoning_effort: reasoningEffort(),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema,
        },
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Muse ${res.status}: ${detail.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Muse returned empty content");
  return JSON.parse(content) as T;
}

async function inventConcepts(imageDataUrl: string): Promise<Concept[]> {
  const prompt = [
    "You inventory a desk / shelf / bench photo for Locus (physical space versioning).",
    "Return short SAM-ready noun phrases for every distinct movable object a person would track.",
    "Good: \"green crochet clover\", \"yellow highlighter\", \"blue pen\", \"grey stone\", \"laptop keyboard\".",
    "Bad: inventing wallet/phone/notebook that are not visible; naming individual keys; the desk surface; walls; monitor bezel as clutter.",
    "One phrase per object type present (not per instance). Max 10 concepts.",
    "category: Electronics | Stationery | Personal | Tool | Supplies | Everyday | Decor | Other.",
  ].join("\n");

  const parsed = await museJson<{ concepts: Concept[] }>(
    prompt,
    imageDataUrl,
    CONCEPT_SCHEMA,
    "locus_concepts",
  );

  const seen = new Set<string>();
  const out: Concept[] = [];
  for (const c of parsed.concepts ?? []) {
    const phrase = c.phrase?.trim().toLowerCase();
    if (!phrase || phrase.length < 2 || seen.has(phrase)) continue;
    seen.add(phrase);
    out.push({ phrase, category: (c.category || "Everyday").trim() });
  }
  return out.slice(0, 10);
}

type SamBox = { x1: number; y1: number; x2: number; y2: number; w: number; h: number };

function parseSamBoxes(line: string): SamBox[] {
  const boxes: SamBox[] = [];
  const re =
    /<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)(?:;c=[\d.]+)?\|>/g;
  for (const m of line.matchAll(re)) {
    boxes.push({
      x1: Number(m[1]),
      y1: Number(m[2]),
      x2: Number(m[3]),
      y2: Number(m[4]),
      w: Number(m[5]),
      h: Number(m[6]),
    });
  }
  return boxes;
}

function extractSamText(json: {
  output_text?: string;
  output?: { content?: { type?: string; text?: string }[] }[];
}): string {
  let text = json.output_text ?? "";
  if (!text && Array.isArray(json.output)) {
    for (const item of json.output) {
      for (const part of item.content ?? []) {
        if (part.type === "output_text" && part.text) text += part.text;
      }
    }
  }
  return text;
}

async function samBoxesForConcept(imageDataUrl: string, concept: string): Promise<BBox[]> {
  const res = await fetch(`${META_BASE}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sam-3.1",
      stream: false,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: concept },
            { type: "input_image", image_url: imageDataUrl },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`SAM ${res.status}: ${detail.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
  };

  return parseSamBoxes(extractSamText(json)).map((b) => ({
    x: b.x1 / b.w,
    y: b.y1 / b.h,
    w: Math.max(0.01, (b.x2 - b.x1) / b.w),
    h: Math.max(0.01, (b.y2 - b.y1) / b.h),
  }));
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

type Candidate = { bbox: BBox; hintPhrase: string; hintCategory: string };

async function segmentWithSam(
  imageDataUrl: string,
  concepts: Concept[],
): Promise<Candidate[]> {
  const batches = await mapPool(concepts, 3, async (c) => {
    try {
      const boxes = await samBoxesForConcept(imageDataUrl, c.phrase);
      return boxes.map((bbox) => ({
        bbox,
        hintPhrase: c.phrase,
        hintCategory: c.category,
      }));
    } catch (err) {
      console.warn("[sam]", c.phrase, err);
      return [] as Candidate[];
    }
  });

  const flat = batches.flat();
  // NMS across concepts (same physical region from "pen" vs "blue pen")
  const ranked = [...flat].sort((a, b) => area(b.bbox) - area(a.bbox));
  const kept: Candidate[] = [];
  for (const c of ranked) {
    const a = area(c.bbox);
    if (a < 0.004 || a > 0.35) continue;
    if (kept.some((k) => iou(k.bbox, c.bbox) >= 0.55)) continue;
    kept.push(c);
  }
  return kept.slice(0, 16);
}

/** Muse-only fallback when SAM is off or returns nothing. */
async function museDetectBoxes(
  imageDataUrl: string,
  base?: LedgerObject[],
): Promise<Candidate[]> {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["objects"],
    properties: {
      objects: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "category", "box"],
          properties: {
            label: { type: "string" },
            category: { type: "string" },
            box: {
              type: "array",
              items: { type: "number" },
              minItems: 4,
              maxItems: 4,
            },
          },
        },
      },
    },
  } as const;

  const lines = [
    "Locate each distinct movable object on this desk/shelf photo.",
    "Coordinates: normalized 0–1000 grid, (0,0) top-left. box = [x_min,y_min,x_max,y_max].",
    "Only objects truly visible. Do not invent wallet/phone/notebook/mouse.",
    "Do not mark individual keyboard keys — one box for the keyboard if visible.",
    "Ignore desk surface, walls, empty background.",
  ];
  if (base?.length) {
    lines.push(`Prior ledger labels for context: ${base.map((o) => o.label).join(", ")}`);
  }

  const parsed = await museJson<{
    objects: { label: string; category: string; box: [number, number, number, number] }[];
  }>(lines.join("\n"), imageDataUrl, schema, "locus_boxes");

  const candidates: Candidate[] = (parsed.objects ?? [])
    .filter((o) => Array.isArray(o.box) && o.box.length === 4)
    .map((o) => {
      const [x1, y1, x2, y2] = o.box.map((n) => Math.max(0, Math.min(1000, n)));
      return {
        bbox: {
          x: Math.min(x1, x2) / 1000,
          y: Math.min(y1, y2) / 1000,
          w: Math.max(0.01, Math.abs(x2 - x1) / 1000),
          h: Math.max(0.01, Math.abs(y2 - y1) / 1000),
        },
        hintPhrase: o.label || "object",
        hintCategory: o.category || "Everyday",
      };
    })
    .filter((c) => {
      const a = area(c.bbox);
      return a >= 0.004 && a <= 0.35;
    });

  const ranked = [...candidates].sort((a, b) => area(b.bbox) - area(a.bbox));
  const kept: Candidate[] = [];
  for (const c of ranked) {
    if (kept.some((k) => iou(k.bbox, c.bbox) >= 0.55)) continue;
    kept.push(c);
  }
  return kept.slice(0, 16);
}

async function labelBoxes(
  imageDataUrl: string,
  candidates: Candidate[],
  base?: LedgerObject[],
): Promise<Detection[]> {
  const boxList = candidates
    .map((c, i) => {
      const b = c.bbox;
      return `#${i}: approx [${Math.round(b.x * 1000)},${Math.round(b.y * 1000)},${Math.round((b.x + b.w) * 1000)},${Math.round((b.y + b.h) * 1000)}] hint="${c.hintPhrase}"`;
    })
    .join("\n");

  const lines = [
    "You label SAM / detector boxes for Locus. Each boxIndex is a crop region on the photo (0–1000 grid).",
    "For every listed box, set keep=true only if it is a real distinct movable object worth tracking.",
    "keep=false for: empty background, desk texture, monitor edge, duplicate of another box, a single keycap, tiny noise.",
    "label: short everyday English name of what is actually inside the box (look at the pixels).",
    "traits: 1–3 visual cues (color, material).",
    "Do NOT reuse fake inventory names — name what you see (e.g. crochet clover, highlighter, stone).",
    "Boxes:",
    boxList,
  ];

  if (base?.length) {
    lines.push(
      "This is a later audit. Reuse an existing signature when the same physical object is still present.",
      "Known ledger:",
      JSON.stringify(
        base.map((o) => ({
          signature: o.signature,
          label: o.label,
          category: o.category,
          traits: o.traits,
        })),
      ),
    );
  } else {
    lines.push(
      'signature: "slug-of-label" + short token, unique per object (e.g. "clover-a3f9").',
    );
  }

  const parsed = await museJson<{ objects: LabeledObject[] }>(
    lines.join("\n"),
    imageDataUrl,
    LABEL_SCHEMA,
    "locus_labels",
  );

  const byIndex = new Map((parsed.objects ?? []).map((o) => [o.boxIndex, o]));
  const usedSig = new Set<string>();
  const detections: Detection[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const labeled = byIndex.get(i);
    if (labeled && !labeled.keep) continue;
    const label = (labeled?.label || candidates[i].hintPhrase).trim();
    if (!label) continue;
    let signature = (labeled?.signature || label.toLowerCase().replace(/\s+/g, "-")).trim();
    if (usedSig.has(signature)) signature = `${signature}-${shortId()}`;
    usedSig.add(signature);
    detections.push({
      id: shortId(),
      label,
      category: (labeled?.category || candidates[i].hintCategory || "Everyday").trim(),
      traits: (labeled?.traits ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 4),
      signature,
      bbox: candidates[i].bbox,
    });
  }

  return detections;
}

/**
 * Locus vision pipeline:
 *  1) Muse Spark — propose object concepts (inventory)
 *  2) SAM 3.1 — dense boxes / masks per concept
 *  3) Muse Spark — label each box + cross-photo Re-ID signatures
 */
export async function detectWithMuse(
  imageDataUrl: string,
  base?: LedgerObject[],
): Promise<Detection[]> {
  let candidates: Candidate[] = [];

  if (useSam()) {
    const concepts = await inventConcepts(imageDataUrl);
    if (concepts.length) {
      candidates = await segmentWithSam(imageDataUrl, concepts);
    }
  }

  if (!candidates.length) {
    candidates = await museDetectBoxes(imageDataUrl, base);
  }

  if (!candidates.length) return [];

  return labelBoxes(imageDataUrl, candidates, base);
}
