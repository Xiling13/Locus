"use client";

import { useState } from "react";
import type { BBox, Commit } from "@/lib/types";
import { Close } from "./icons";
import { Spot } from "./Photo";
import { Button, Round } from "./ui";

/** Sits over the photo while it's a drawing canvas. */
export function DrawHint({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="fade pointer-events-none absolute inset-x-2.5 top-2.5 z-40 flex items-center justify-between gap-2">
      <span className="glass rounded-full px-4 py-2.5 text-[14px] font-semibold">Drag around the item</span>
      <Round aria-label="Cancel" onClick={onCancel} className="pointer-events-auto">
        <Close />
      </Round>
    </div>
  );
}

/** Sheet body for naming a hand-drawn outline. */
export function NameItem({
  commit,
  bbox,
  onAdd,
  onRedo,
}: {
  commit: Commit;
  bbox: BBox;
  onAdd: (label: string) => void;
  onRedo: () => void;
}) {
  const [name, setName] = useState("");
  const label = name.trim();
  return (
    <form
      className="px-4 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (label) onAdd(label);
      }}
    >
      <Spot src={commit.image} width={commit.width} height={commit.height} bbox={bbox} aspect={16 / 11} className="rounded-[24px]" />
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What is it?"
        aria-label="Item name"
        enterKeyHint="done"
        className="mt-5 w-full bg-transparent px-1 text-[28px] font-bold leading-tight tracking-[-0.035em] outline-none placeholder:text-mute/60"
      />
      <div className="mt-6 flex gap-2">
        <Button tone="sunk" className="min-w-0 flex-1 basis-0" onClick={onRedo}>
          Redraw
        </Button>
        <Button type="submit" className="min-w-0 flex-1 basis-0" disabled={!label}>
          Add item
        </Button>
      </div>
    </form>
  );
}
