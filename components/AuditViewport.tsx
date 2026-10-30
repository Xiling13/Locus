"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { center, inflate, union } from "@/lib/geometry";
import type { BBox, DiffItem } from "@/lib/types";
import { Fit } from "./icons";

export type ViewportHandle = { focus: (item: DiffItem | null) => void };

const pct = (b: BBox) => ({
  left: `${b.x * 100}%`,
  top: `${b.y * 100}%`,
  width: `${b.w * 100}%`,
  height: `${b.h * 100}%`,
});

export const KIND_COLOR = {
  removed: "var(--color-miss)",
  added: "var(--color-new)",
  moved: "var(--color-move)",
};

type Props = {
  current: string;
  base: string;
  aspect: number;
  items: DiffItem[];
  selected: string | null;
  onSelect: (id: string) => void;
};

export const AuditViewport = forwardRef<ViewportHandle, Props>(function AuditViewport(
  { current, base, aspect, items, selected, onSelect },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const zoom = useRef<ReactZoomPanPinchRef>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [showBase, setShowBase] = useState(false);
  const [focus, setFocus] = useState<BBox | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const W = e.contentRect.width;
      const H = e.contentRect.height;
      const w = Math.max(W, H * aspect);
      setSize({ w, h: w / aspect });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  useImperativeHandle(ref, () => ({
    focus(item) {
      const z = zoom.current;
      if (!z) return;
      if (!item) {
        setFocus(null);
        z.resetTransform(560, "easeInOutCubic");
        return;
      }
      const box = item.from && item.to ? union(item.from, item.to) : (item.to ?? item.from)!;
      const target = inflate(box, item.kind === "moved" ? 0.35 : 1.4);
      setFocus(target);
      requestAnimationFrame(() =>
        z.zoomToElement("vp-focus", { maxScale: 4, animationTime: 620, animationType: "easeInOutCubic" }),
      );
    },
  }));

  const dim = (id: string) => (selected && selected !== id ? 0 : 1);

  return (
    <div ref={wrap} className="relative size-full overflow-hidden bg-sunk">
      {size && (
        <TransformWrapper
          ref={zoom}
          minScale={1}
          maxScale={6}
          centerOnInit
          doubleClick={{ mode: "toggle", step: 1.2, animationTime: 420, animationType: "easeInOutCubic" }}
          zoomAnimation={{ animationTime: 320, animationType: "easeOutCubic" }}
          autoAlignment={{ animationTime: 320, velocityAlignmentTime: 420, animationType: "easeOutCubic" }}
          velocityAnimation={{ animationTime: 420, animationType: "easeOutCubic" }}
          onTransform={(_, s) => content.current?.style.setProperty("--k", String(1 / s.scale))}
        >
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{ width: size.w, height: size.h }}
          >
            <div ref={content} className="relative" style={{ width: size.w, height: size.h }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current} alt="" draggable={false} className="absolute inset-0 size-full" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={base}
                alt=""
                draggable={false}
                className="absolute inset-0 size-full transition-opacity duration-300"
                style={{ opacity: showBase ? 1 : 0 }}
              />

              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 size-full overflow-visible"
              >
                {items
                  .filter((i) => i.kind === "moved" && i.from && i.to)
                  .map((i) => {
                    const [ax, ay] = center(i.from!);
                    const [bx, by] = center(i.to!);
                    return (
                      <g key={i.id} style={{ opacity: dim(i.id) }} className="transition-opacity duration-300">
                        <line
                          x1={ax * 100}
                          y1={ay * 100}
                          x2={bx * 100}
                          y2={by * 100}
                          stroke="var(--color-ink)"
                          strokeOpacity={0.35}
                          strokeWidth={5}
                          vectorEffect="non-scaling-stroke"
                          strokeLinecap="round"
                        />
                        <line
                          x1={ax * 100}
                          y1={ay * 100}
                          x2={bx * 100}
                          y2={by * 100}
                          stroke="var(--color-move)"
                          strokeWidth={2.5}
                          strokeDasharray="1 6"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </g>
                    );
                  })}
              </svg>

              {items.map((i) => (
                <Mark
                  key={i.id}
                  item={i}
                  base={base}
                  showBase={showBase}
                  opacity={dim(i.id)}
                  active={selected === i.id}
                  onClick={() => onSelect(i.id)}
                />
              ))}

              {focus && <div id="vp-focus" className="pointer-events-none absolute" style={pct(focus)} />}
            </div>
          </TransformComponent>
        </TransformWrapper>
      )}

      <button
        type="button"
        aria-label="Reset view"
        onClick={() => zoom.current?.resetTransform(560, "easeInOutCubic")}
        className="glass absolute right-4 top-[max(env(safe-area-inset-top),12px)] grid size-11 place-items-center rounded-full text-ink shadow-[0_2px_12px_rgb(0_0_0/0.08)] transition-transform duration-200 active:scale-90 active:duration-75"
      >
        <Fit width={19} height={19} />
      </button>
      <div className="glass absolute bottom-4 right-4 grid grid-cols-2 rounded-full p-1 shadow-[0_2px_12px_rgb(0_0_0/0.08)]">
        <span
          className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-ink transition-transform duration-300 ease-[var(--ease-glide)]"
          style={{ transform: showBase ? "translateX(100%)" : "none" }}
        />
        {(["Now", "Before"] as const).map((l, i) => {
          const on = showBase === (i === 1);
          return (
            <button
              key={l}
              type="button"
              aria-pressed={on}
              onClick={() => setShowBase(i === 1)}
              className={`relative h-9 rounded-full px-4 text-[14px] font-semibold transition-colors duration-300 ${
                on ? "text-paper" : "text-soft"
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
});

function Mark({
  item,
  base,
  showBase,
  opacity,
  active,
  onClick,
}: {
  item: DiffItem;
  base: string;
  showBase: boolean;
  opacity: number;
  active: boolean;
  onClick: () => void;
}) {
  const color = KIND_COLOR[item.kind];
  const occluded = item.confidence === "occluded";
  const found = item.resolution === "found";
  const box = (item.kind === "removed" ? item.from : item.to)!;
  const stroke = `calc(2.5px * var(--k, 1))`;

  return (
    <>
      {item.kind === "moved" && item.from && (
        <div
          className="pointer-events-none absolute rounded-[6px] transition-opacity duration-300"
          style={{
            ...pct(item.from),
            opacity: opacity * 0.8,
            outline: `${stroke} dashed var(--color-move)`,
          }}
        />
      )}
      <button
        type="button"
        onClick={onClick}
        className="draw absolute rounded-[6px] transition-opacity duration-300"
        style={{
          ...pct(box),
          opacity: found ? opacity * 0.35 : opacity,
          pointerEvents: opacity ? undefined : "none",
          outline: `${stroke} ${occluded ? "dashed" : "solid"} ${color}`,
          zIndex: active ? 3 : 1,
        }}
      >
        {item.kind === "removed" && !showBase && (
          <span
            className="absolute inset-0 rounded-[6px] saturate-[0.5]"
            style={{
              backgroundImage: `url(${base})`,
              backgroundSize: `${100 / box.w}% ${100 / box.h}%`,
              backgroundPosition: `${(box.x / (1 - box.w)) * 100}% ${(box.y / (1 - box.h)) * 100}%`,
              opacity: occluded ? 0.35 : 0.75,
            }}
          />
        )}
        {occluded && <span className="hatch absolute inset-0 rounded-[6px] opacity-70" />}
        {item.kind === "added" && <span className="absolute inset-0 rounded-[6px] bg-new/15" />}
        {active && (
          <span
            className={`absolute bottom-full left-0 origin-bottom-left whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${
              item.kind === "added" ? "text-white" : "text-ink"
            }`}
            style={{ background: color, transform: "translateY(-5px) scale(var(--k, 1))" }}
          >
            {item.label}
          </span>
        )}
      </button>
    </>
  );
}
