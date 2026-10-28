import type { Detection } from "../types";

type Fixture = Omit<Detection, "id"> & { hint?: string };

const px = (x0: number, y0: number, x1: number, y1: number) => ({
  x: x0 / 768,
  y: y0 / 1024,
  w: (x1 - x0) / 768,
  h: (y1 - y0) / 1024,
});

const benchBase: Fixture[] = [
  {
    signature: "tape-measure",
    label: "Tape measure",
    category: "Measuring",
    traits: ["yellow case", "5 m steel"],
    bbox: px(78, 176, 184, 278),
    hint: "Top-left corner of the cutting mat, right above the box cutter",
  },
  {
    signature: "box-cutter",
    label: "Box cutter",
    category: "Blade",
    traits: ["black", "snap-off blade"],
    bbox: px(168, 298, 230, 514),
    hint: "Left side of the mat, between the tape measure and the steel ruler",
  },
  {
    signature: "steel-ruler",
    label: "Steel ruler",
    category: "Measuring",
    traits: ["stainless", "30 cm", "diagonal"],
    bbox: px(93, 450, 325, 748),
    hint: "Lower-left of the mat, lying diagonally",
  },
  {
    signature: "scissors",
    label: "Orange scissors",
    category: "Blade",
    traits: ["orange handles", "blades down"],
    bbox: px(372, 326, 490, 576),
    hint: "Dead center of the mat, blades pointing at the screwdriver",
  },
  {
    signature: "screwdriver",
    label: "Red screwdriver",
    category: "Tool",
    traits: ["red grip", "flat head", "slim"],
    bbox: px(308, 586, 348, 770),
    hint: "Lower center of the mat, between the steel ruler and the blue tape",
  },
  {
    signature: "masking-tape",
    label: "Blue masking tape",
    category: "Supplies",
    traits: ["blue", "full roll"],
    bbox: px(384, 605, 518, 742),
    hint: "Lower-right of the mat, right next to the red screwdriver",
  },
  {
    signature: "mug",
    label: "White mug",
    category: "Everyday",
    traits: ["ceramic", "half-full coffee"],
    bbox: px(610, 132, 756, 307),
    hint: "Desk, top-right, off the mat",
  },
  {
    signature: "earbuds",
    label: "Earbuds case",
    category: "Electronics",
    traits: ["white", "wireless"],
    bbox: px(628, 344, 713, 434),
    hint: "Desk, right of the mat, directly below the mug",
  },
  {
    signature: "keys",
    label: "Key ring",
    category: "Personal",
    traits: ["three keys", "steel ring"],
    bbox: px(636, 462, 740, 587),
    hint: "Desk, right of the mat — below the earbuds case, above the pen",
  },
  {
    signature: "pen",
    label: "Black pen",
    category: "Stationery",
    traits: ["black", "cap up"],
    bbox: px(620, 603, 662, 827),
    hint: "Desk, bottom-right, standing vertical",
  },
];

const moved: Record<string, Fixture["bbox"]> = {
  scissors: px(296, 592, 548, 712),
  "masking-tape": px(250, 685, 376, 815),
};
const removed = new Set(["screwdriver", "keys"]);

const benchCurrent: Fixture[] = [
  ...benchBase
    .filter((f) => !removed.has(f.signature))
    .map((f) => ({
      ...f,
      bbox: moved[f.signature] ?? {
        ...f.bbox,
        x: f.bbox.x + 0.002,
        y: f.bbox.y + 0.001,
      },
    })),
  {
    signature: "phone",
    label: "Black phone",
    category: "Electronics",
    traits: ["face down", "triple camera"],
    bbox: px(348, 337, 473, 577),
  },
  {
    signature: "glue-stick",
    label: "Glue stick",
    category: "Stationery",
    traits: ["white cap", "blue label"],
    bbox: px(423, 188, 482, 286),
  },
  {
    signature: "tape-strip",
    label: "Ruler strip",
    category: "Measuring",
    traits: ["yellow", "graduated", "short"],
    bbox: px(110, 715, 204, 833),
  },
];

export const fixtures: Record<string, Fixture[]> = {
  "/demo/bench-base.jpg": benchBase,
  "/demo/bench-current.jpg": benchCurrent,
};

export const fixtureHints: Record<string, string> = Object.fromEntries(
  benchBase.filter((f) => f.hint).map((f) => [f.signature, f.hint as string]),
);
