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
  // low is enough for short inventory labels and is much faster than medium.
  return process.env.MUSE_REASONING_EFFORT?.trim() || "low";
}

/** "desktop monitor" / "laptop with colorful screen" → "Desktop Monitor" / "Laptop With Colorful Screen" — then we also shorten. */
function titleCase(raw: string) {
  return raw
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/** Prefer 1–2 word inventory names; drop filler like "with / of / and". */
function shortLabel(raw: string) {
  const stop = new Set(["a", "an", "the", "with", "and", "of", "on", "in", "for"]);
  const words = titleCase(raw)
    .split(" ")
    .filter((w) => w && !stop.has(w.toLowerCase()));
  if (words.length <= 2) return words.join(" ") || "Object";
  // Keep a leading color/material adjective + the last noun when overly long.
  return `${words[0]} ${words[words.length - 1]}`;
}

function samEnabled() {
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
    "You inventory a photo of a room / desk / shelf / bench for Locus (physical space versioning).",
    "Return short Title Case names for EVERY distinct movable object a person would track — scan the whole frame, edges and floor included.",
    "Include soft and small things: clothes on the floor, shoes, bags, cables, bottles, books, toys.",
    "Name style: 1–2 words, Title Case. Prefer the plain noun.",
    'Good: "Monitor", "Mouse", "Keyboard", "Laptop", "Tower", "Box", "Mug".',
    'OK when two similar items need telling apart: "Black Laptop", "Silver Laptop".',
    'Bad: "desktop monitor", "laptop with colorful screen", "white desktop tower", "computer mouse".',
    "Bad: inventing wallet/phone/notebook that are not visible; naming individual keys; the desk surface; walls.",
    "One name per object type present (not per instance) — the segmenter finds every instance. Max 16 concepts.",
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
    const phrase = shortLabel(c.phrase || "");
    const key = phrase.toLowerCase();
    if (!phrase || phrase.length < 2 || seen.has(key)) continue;
    seen.add(key);
    out.push({ phrase, category: (c.category || "Everyday").trim() });
  }
  return out.slice(0, 16);
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
  const batches = await mapPool(concepts, 5, async (c) => {
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

  return mergeCandidates([], batches.flat());
}

const MAX_CANDIDATES = 30;

/**
 * Adds `extra` to `kept` after size filtering and NMS. Boxes already in `kept` win,
 * so SAM's tight boxes take precedence over Muse's rough ones for the same object.
 */
function mergeCandidates(kept: Candidate[], extra: Candidate[], iouThresh = 0.5): Candidate[] {
  const out = [...kept];
  const ranked = [...extra].sort((a, b) => area(b.bbox) - area(a.bbox));
  for (const c of ranked) {
    if (out.length >= MAX_CANDIDATES) break;
    const a = area(c.bbox);
    if (a < 0.002 || a > 0.6) continue;
    if (out.some((k) => iou(k.bbox, c.bbox) >= iouThresh)) continue;
    out.push(c);
  }
  return out;
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
    "Locate EVERY distinct movable object in this room / desk / shelf photo, one box per instance.",
    "Scan the whole frame including edges and floor; include clothes, shoes, bags, books, bottles.",
    "Coordinates: normalized 0–1000 grid, (0,0) top-left. box = [x_min,y_min,x_max,y_max].",
    "label: Title Case, 1–2 words. Prefer the plain noun (Monitor, Mouse, Keyboard, Laptop).",
    "Only objects truly visible. Do not invent wallet/phone/notebook.",
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
        hintPhrase: shortLabel(o.label || "Object"),
        hintCategory: o.category || "Everyday",
      };
    });

  return mergeCandidates([], candidates);
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
    "label: Title Case, 1–2 words. Prefer the plain noun of what is inside the box (Monitor, Mouse, Keyboard, Laptop, Tower, Box).",
    'Add one short qualifier only to tell similar items apart (Black Laptop). Never long phrases ("laptop with colorful screen").',
    "traits: 1–2 visual cues (color, material) — put detail here, not in the label.",
    "Boxes:",
    boxList,
  ];

  if (base?.length) {
    lines.push(
      "This is a later audit. Reuse an existing signature when the same physical object is still present.",
      "Position, crop, and angle may change — that is still the same object; do NOT mint a new signature.",
      "Only invent a new signature when you are sure it is a different physical item.",
      "Known ledger (approx box is 0–1000 grid [x,y,w,h]):",
      JSON.stringify(
        base.map((o) => ({
          signature: o.signature,
          label: o.label,
          category: o.category,
          traits: o.traits,
          approx: [
            Math.round(o.bbox.x * 1000),
            Math.round(o.bbox.y * 1000),
            Math.round(o.bbox.w * 1000),
            Math.round(o.bbox.h * 1000),
          ],
        })),
      ),
    );
  } else {
    lines.push(
      'signature: "slug-of-label" + short token, unique per object (e.g. "monitor-a3f9").',
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
    const label = shortLabel(labeled?.label || candidates[i].hintPhrase);
    if (!label) continue;
    const slug = label.toLowerCase().replace(/\s+/g, "-");
    let signature = (labeled?.signature || `${slug}-${shortId().slice(0, 4)}`).trim();
    if (usedSig.has(signature)) signature = `${signature}-${shortId()}`;
    usedSig.add(signature);
    detections.push({
      id: shortId(),
      label,
      category: (labeled?.category || candidates[i].hintCategory || "Everyday").trim(),
      traits: (labeled?.traits ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 2),
      signature,
      bbox: candidates[i].bbox,
    });
  }

  return detections;
}

/** First commit: trust SAM hits + concept names — skips a full Muse pass. */
function detectionsFromHints(candidates: Candidate[]): Detection[] {
  const usedSig = new Set<string>();
  const detections: Detection[] = [];
  for (const c of candidates) {
    const label = shortLabel(c.hintPhrase);
    if (!label) continue;
    const slug = label.toLowerCase().replace(/\s+/g, "-");
    let signature = `${slug}-${shortId().slice(0, 4)}`;
    if (usedSig.has(signature)) signature = `${signature}-${shortId()}`;
    usedSig.add(signature);
    detections.push({
      id: shortId(),
      label,
      category: c.hintCategory || "Everyday",
      traits: [],
      signature,
      bbox: c.bbox,
    });
  }
  return detections;
}

/**
 * Locus vision pipeline:
 *  1) Muse Spark — propose short Title Case concepts → SAM 3.1 boxes per concept
 *  2) In parallel, Muse Spark boxes every instance directly; these fill what SAM missed
 *  3) First photo: use the names directly (faster).
 *     Later audits: Muse labels + Re-ID signatures against the ledger.
 */
export async function detectWithMuse(
  imageDataUrl: string,
  base?: LedgerObject[],
): Promise<Detection[]> {
  const sam = samEnabled()
    ? inventConcepts(imageDataUrl)
        .then((concepts) => (concepts.length ? segmentWithSam(imageDataUrl, concepts) : []))
        .catch((err) => {
          console.warn("[sam pipeline]", err);
          return [] as Candidate[];
        })
    : Promise.resolve([] as Candidate[]);
  const muse = museDetectBoxes(imageDataUrl, base).catch((err) => {
    console.warn("[muse boxes]", err);
    return [] as Candidate[];
  });

  const [samBoxes, museBoxes] = await Promise.all([sam, muse]);
  const candidates = mergeCandidates(samBoxes, museBoxes, 0.4);
  if (!candidates.length) return [];

  // Both sources already return short Title Case names; skip a second Muse
  // round-trip on the first commit.
  if (!base?.length) {
    return detectionsFromHints(candidates);
  }

  return labelBoxes(imageDataUrl, candidates, base);
}
