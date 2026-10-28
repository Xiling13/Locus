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

const COLOR = { removed: "var(--color-signal)", added: "var(--color-mint)", moved: "var(--color-bone)" };

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
      const w = Math.min(W, H * aspect);
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
        z.resetTransform(500, "easeOut");
        return;
      }
      const box = item.from && item.to ? union(item.from, item.to) : (item.to ?? item.from)!;
      const target = inflate(box, item.kind === "moved" ? 0.35 : 1.4);
      setFocus(target);
      requestAnimationFrame(() =>
        z.zoomToElement("vp-focus", { maxScale: 4, animationTime: 650, animationType: "easeOut" }),
      );
    },
  }));

  const dim = (id: string) => (selected && selected !== id ? 0.28 : 1);

  return (
    <div ref={wrap} className="relative size-full overflow-hidden bg-black">
      {size && (
        <TransformWrapper
          ref={zoom}
          minScale={1}
          maxScale={6}
          centerOnInit
          doubleClick={{ mode: "toggle", step: 1.2 }}
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
                          strokeOpacity={0.5}
                          strokeWidth={5}
                          vectorEffect="non-scaling-stroke"
                          strokeLinecap="round"
                        />
                        <line
                          x1={ax * 100}
                          y1={ay * 100}
                          x2={bx * 100}
                          y2={by * 100}
                          stroke="var(--color-bone)"
                          strokeWidth={2}
                          strokeDasharray="1 6"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                        />
                        <circle cx={ax * 100} cy={ay * 100} r={0.9} fill="var(--color-bone)" />
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

      <div className="absolute right-3 top-3 flex rounded-full bg-ink/60 p-1 backdrop-blur-md">
        {(["Now", "Base"] as const).map((l, i) => {
          const on = showBase === (i === 1);
          return (
            <button
              key={l}
              type="button"
              onClick={() => setShowBase(i === 1)}
              className={`h-8 rounded-full px-3.5 text-[13px] font-semibold transition ${
                on ? "bg-bone text-ink" : "text-bone/70"
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Reset view"
        onClick={() => zoom.current?.resetTransform(500, "easeOut")}
        className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-full bg-ink/60 text-bone backdrop-blur-md active:scale-95"
      >
        <Fit width={18} height={18} />
      </button>
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
  const color = COLOR[item.kind];
  const occluded = item.confidence === "occluded";
  const found = item.resolution === "found";
  const box = (item.kind === "removed" ? item.from : item.to)!;
  const stroke = `calc(2px * var(--k, 1))`;

  return (
    <>
      {item.kind === "moved" && item.from && (
        <div
          className="pointer-events-none absolute rounded-[4px] transition-opacity duration-300"
          style={{
            ...pct(item.from),
            opacity: opacity * 0.7,
            outline: `${stroke} dashed var(--color-bone)`,
          }}
        />
      )}
      <button
        type="button"
        onClick={onClick}
        className="draw absolute rounded-[4px] transition-opacity duration-300"
        style={{
          ...pct(box),
          opacity: found ? opacity * 0.35 : opacity,
          outline: `${stroke} ${occluded ? "dashed" : "solid"} ${color}`,
          boxShadow: `0 0 0 calc(4px * var(--k, 1)) rgb(11 12 10 / 0.28)`,
          zIndex: active ? 3 : 1,
        }}
      >
        {item.kind === "removed" && !showBase && (
          <span
            className="absolute inset-0 rounded-[4px] saturate-[0.6]"
            style={{
              backgroundImage: `url(${base})`,
              backgroundSize: `${100 / box.w}% ${100 / box.h}%`,
              backgroundPosition: `${(box.x / (1 - box.w)) * 100}% ${(box.y / (1 - box.h)) * 100}%`,
              opacity: occluded ? 0.35 : 0.8,
            }}
          />
        )}
        {occluded && <span className="hatch absolute inset-0 rounded-[4px] opacity-60" />}
        {item.kind === "added" && <span className="absolute inset-0 bg-mint/10" />}
        {active && (
          <span
            className="mono absolute bottom-full left-0 origin-bottom-left whitespace-nowrap rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold text-ink"
            style={{ background: color, transform: "translateY(-4px) scale(var(--k, 1))" }}
          >
            {item.label}
          </span>
        )}
      </button>
    </>
  );
}
