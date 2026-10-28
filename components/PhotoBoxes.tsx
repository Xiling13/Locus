import type { BBox } from "@/lib/types";

type Box = { id: string; bbox: BBox; off?: boolean };

export function PhotoBoxes({
  src,
  width,
  height,
  boxes,
  active,
  onPick,
  className = "",
}: {
  src: string;
  width: number;
  height: number;
  boxes: Box[];
  active?: string | null;
  onPick?: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={`relative w-full ${className}`} style={{ aspectRatio: `${width}/${height}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
      {boxes.map((b, i) => {
        const on = active === b.id;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onPick?.(b.id)}
            className="draw absolute rounded-[6px] transition-[opacity,box-shadow] duration-300"
            style={{
              left: `${b.bbox.x * 100}%`,
              top: `${b.bbox.y * 100}%`,
              width: `${b.bbox.w * 100}%`,
              height: `${b.bbox.h * 100}%`,
              boxShadow: on
                ? "0 0 0 2px var(--color-signal), 0 0 0 9999px rgb(11 12 10 / 0.55)"
                : "0 0 0 1.5px rgb(242 240 233 / 0.85), 0 0 0 3px rgb(11 12 10 / 0.25)",
              opacity: b.off ? 0.2 : 1,
              zIndex: on ? 2 : 1,
              animationDelay: `${i * 45}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
