"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { FRAME } from "@/lib/image";
import type { BBox } from "@/lib/types";

const pct = (b: BBox): CSSProperties => ({
  left: `${b.x * 100}%`,
  top: `${b.y * 100}%`,
  width: `${b.w * 100}%`,
  height: `${b.h * 100}%`,
});

/**
 * Shows a photo cover-fitted into a fixed aspect ratio. Children are laid out in the
 * photo's own 0..1 coordinate space, so overlays line up even when the photo is cropped.
 */
export function Frame({
  src,
  width,
  height,
  aspect = FRAME,
  className = "",
  children,
}: {
  src: string;
  width: number;
  height: number;
  aspect?: number;
  className?: string;
  children?: ReactNode;
}) {
  const r = width / height;
  const layer: CSSProperties =
    r > aspect
      ? { width: `${(r / aspect) * 100}%`, height: "100%", left: `${(1 - r / aspect) * 50}%`, top: 0 }
      : { width: "100%", height: `${(aspect / r) * 100}%`, top: `${(1 - aspect / r) * 50}%`, left: 0 };
  return (
    <div className={`relative overflow-hidden bg-sunk ${className}`} style={{ aspectRatio: aspect }}>
      <div className="absolute" style={layer}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} className="absolute inset-0 size-full select-none" />
        {children}
      </div>
    </div>
  );
}

export type Pin = { id: string; bbox: BBox; label: string; off?: boolean; missing?: boolean };

/** A photo with a small pin on every item. Picking one spotlights it and hides the rest. */
export function ScenePhoto({
  src,
  width,
  height,
  aspect,
  pins,
  active,
  onPick,
  className = "",
}: {
  src: string;
  width: number;
  height: number;
  aspect?: number;
  pins: Pin[];
  active?: string | null;
  onPick?: (id: string) => void;
  className?: string;
}) {
  const focus = pins.find((p) => p.id === active);
  // Keep the last spotlight around so it can fade out in place instead of vanishing.
  const [last, setLast] = useState(focus);
  if (focus && focus !== last) setLast(focus);
  const spot = focus ?? last;
  return (
    <Frame src={src} width={width} height={height} aspect={aspect} className={className}>
      {pins.map((p, i) => {
        const hidden = focus && focus.id !== p.id;
        return (
          <button
            key={p.id}
            type="button"
            aria-label={p.label}
            onClick={() => onPick?.(p.id)}
            className="pop absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center transition-[opacity,scale] duration-300 active:scale-75"
            style={{
              left: `${(p.bbox.x + p.bbox.w / 2) * 100}%`,
              top: `${(p.bbox.y + p.bbox.h / 2) * 100}%`,
              opacity: hidden || focus?.id === p.id ? 0 : p.off ? 0.45 : 1,
              pointerEvents: hidden ? "none" : undefined,
              animationDelay: `${i * 40 + 150}ms`,
            }}
          >
            <span
              className={`rounded-full ring-2 shadow-[0_1px_4px_rgb(0_0_0/0.28)] ${
                p.missing
                  ? "size-3 bg-miss ring-white"
                  : p.off
                    ? "size-2.5 bg-transparent ring-white/80"
                    : "size-2.5 bg-white/85 ring-black/8"
              }`}
            />
          </button>
        );
      })}
      {spot && (
        <div
          className="pointer-events-none absolute rounded-[10px] ring-2 ring-white transition-[left,top,width,height,opacity] duration-500 ease-[var(--ease-glide)]"
          style={{
            ...pct(spot.bbox),
            opacity: focus ? 1 : 0,
            boxShadow: "0 0 0 9999px rgb(21 21 20 / 0.5)",
          }}
        >
          <span
            key={spot.id}
            className={`glass fade absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold ${
              spot.bbox.y < 0.1 ? "top-full mt-2" : "bottom-full mb-2"
            }`}
          >
            {spot.label}
          </span>
        </div>
      )}
    </Frame>
  );
}

/** A close-up of one item inside its surroundings, so you can see where it lives. */
export function Spot({
  src,
  width: W,
  height: H,
  bbox,
  aspect = 4 / 3,
  tone = "white",
  dashed,
  className = "",
}: {
  src: string;
  width: number;
  height: number;
  bbox: BBox;
  aspect?: number;
  tone?: string;
  dashed?: boolean;
  className?: string;
}) {
  let rw = Math.max(bbox.w * W * 2.6, bbox.h * H * 2.6 * aspect, W * 0.42);
  let rh = rw / aspect;
  const s = Math.min(1, W / rw, H / rh);
  rw *= s;
  rh *= s;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  const x0 = clamp((bbox.x + bbox.w / 2) * W - rw / 2, W - rw);
  const y0 = clamp((bbox.y + bbox.h / 2) * H - rh / 2, H - rh);
  return (
    <div className={`relative overflow-hidden bg-sunk ${className}`} style={{ aspectRatio: aspect }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="absolute max-w-none"
        style={{
          width: `${(W / rw) * 100}%`,
          height: `${(H / rh) * 100}%`,
          left: `${(-x0 / rw) * 100}%`,
          top: `${(-y0 / rh) * 100}%`,
        }}
      />
      <div
        className="draw absolute rounded-[10px]"
        style={{
          left: `${((bbox.x * W - x0) / rw) * 100}%`,
          top: `${((bbox.y * H - y0) / rh) * 100}%`,
          width: `${((bbox.w * W) / rw) * 100}%`,
          height: `${((bbox.h * H) / rh) * 100}%`,
          outline: `2.5px ${dashed ? "dashed" : "solid"} ${tone}`,
          outlineOffset: 3,
          boxShadow: "0 0 0 9999px rgb(21 21 20 / 0.32)",
        }}
      />
    </div>
  );
}
