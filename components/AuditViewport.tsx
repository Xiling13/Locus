"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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

const KIND_DOT = {
  removed: "bg-miss",
  added: "bg-new",
  moved: "bg-move",
};

type Props = {
  current: string;
  base: string;
  aspect: number;
  items: DiffItem[];
  selected: string | null;
  onSelect: (id: string | null) => void;
};

export const AuditViewport = forwardRef<ViewportHandle, Props>(function AuditViewport(
  { current, base, aspect, items, selected, onSelect },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const zoom = useRef<ReactZoomPanPinchRef>(null);
  const tap = useRef<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [showBase, setShowBase] = useState(false);
  const [focus, setFocus] = useState<BBox | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const W = e.contentRect.width;
      const H = e.contentRect.height;
      if (W < 1 || H < 1) return;
      // Cover the viewport, then add a hair of overscan so rubber-band / subpixel
      // pan never flashes the sunk background ("露底").
      let w = Math.max(W, H * aspect);
      let h = w / aspect;
      if (h < H) {
        h = H;
        w = H * aspect;
      }
      const pad = 2;
      w += pad;
      h += pad;
      setSize((prev) => (prev && Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  useLayoutEffect(() => {
    if (!size) return;
    // Re-center after size changes (mobile browser chrome / orientation) so a
    // stale pan offset can't leave a strip of background on one side.
    const z = zoom.current;
    if (!z || z.state.scale > 1.01) return;
    z.centerView(1, 0);
  }, [size]);

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

  function onPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    tap.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e: ReactPointerEvent) {
    const start = tap.current;
    tap.current = null;
    if (!start || !selected) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx * dx + dy * dy > 36) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("button.draw")) return;
    if (t.closest(".glass")) return;
    onSelect(null);
  }

  return (
    <div ref={wrap} className="relative size-full overflow-hidden bg-sunk">
      {size && (
        <TransformWrapper
          ref={zoom}
          minScale={1}
          maxScale={6}
          centerOnInit
          limitToBounds
          disablePadding
          doubleClick={{ mode: "toggle", step: 1.2, animationTime: 420, animationType: "easeInOutCubic" }}
          zoomAnimation={{ animationTime: 320, animationType: "easeOutCubic" }}
          autoAlignment={{ animationTime: 320, velocityAlignmentTime: 420, animationType: "easeOutCubic" }}
          velocityAnimation={{ animationTime: 420, animationType: "easeOutCubic" }}
          panning={{ excluded: ["draw"] }}
          onTransform={(_, s) => content.current?.style.setProperty("--k", String(1 / s.scale))}
        >
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{ width: size.w, height: size.h }}
          >
            <div
              ref={content}
              className="relative"
              style={{ width: size.w, height: size.h }}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={base}
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-300"
                style={{ opacity: showBase ? 1 : 0 }}
              />

              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 size-full overflow-visible"
              >
                {items
                  .filter((i) => i.kind === "moved" && i.from && i.to && selected === i.id)
                  .map((i) => {
                    const [ax, ay] = center(i.from!);
                    const [bx, by] = center(i.to!);
                    return (
                      <g key={i.id}>
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

              {items.map((i, idx) => (
                <Mark
                  key={i.id}
                  item={i}
                  base={base}
                  showBase={showBase}
                  active={selected === i.id}
                  hideDot={!!selected}
                  delay={idx * 40 + 150}
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
        {(["Current", "Before"] as const).map((l, i) => {
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
  active,
  hideDot,
  delay,
  onClick,
}: {
  item: DiffItem;
  base: string;
  showBase: boolean;
  active: boolean;
  hideDot: boolean;
  delay: number;
  onClick: () => void;
}) {
  const color = KIND_COLOR[item.kind];
  const occluded = item.confidence === "occluded";
  const found = item.resolution === "found";
  const box = (item.kind === "removed" ? item.from : item.to)!;
  const [cx, cy] = center(box);
  const stroke = `calc(2.5px * var(--k, 1))`;

  return (
    <>
      {/* Default: a small status dot. Hidden entirely while any item is selected. */}
      <button
        type="button"
        aria-label={item.label}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="pop absolute z-20 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center transition-[opacity,scale] duration-300 active:scale-75"
        style={{
          left: `${cx * 100}%`,
          top: `${cy * 100}%`,
          opacity: hideDot ? 0 : found ? 0.4 : 1,
          pointerEvents: hideDot ? "none" : undefined,
          animationDelay: `${delay}ms`,
        }}
      >
        <span
          className={`size-2.5 rounded-full ring-2 ring-white shadow-[0_1px_4px_rgb(0_0_0/0.28)] ${KIND_DOT[item.kind]}`}
        />
      </button>

      {active && item.kind === "moved" && item.from && (
        <div
          className="pointer-events-none absolute rounded-[6px]"
          style={{
            ...pct(item.from),
            opacity: 0.8,
            outline: `${stroke} dashed var(--color-move)`,
          }}
        />
      )}

      {active && (
        <button
          type="button"
          aria-label={item.label}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="draw absolute rounded-[6px]"
          style={{
            ...pct(box),
            outline: `${stroke} ${occluded ? "dashed" : "solid"} ${color}`,
            opacity: found ? 0.35 : 1,
            zIndex: 3,
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
          <span
            className={`absolute bottom-full left-0 origin-bottom-left whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${
              item.kind === "added" ? "text-white" : "text-ink"
            }`}
            style={{ background: color, transform: "translateY(-5px) scale(var(--k, 1))" }}
          >
            {item.label}
          </span>
        </button>
      )}
    </>
  );
}
