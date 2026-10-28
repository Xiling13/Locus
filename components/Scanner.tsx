"use client";

import { useEffect, useState } from "react";

export type ScanStep = { label: string; value?: string };

/**
 * Full-bleed photo with a sweeping scan line and a log of pipeline steps.
 * Steps tick in on a timer; values fill once the real work resolves.
 */
export function Scanner({ src, steps, title }: { src: string; steps: ScanStep[]; title: string }) {
  const [shown, setShown] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setShown((n) => Math.min(steps.length, n + 1)), 620);
    return () => clearInterval(t);
  }, [steps.length]);

  return (
    <div className="relative flex min-h-dvh flex-col bg-ink">
      <div className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="block w-full opacity-60 grayscale-[0.4]" />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-x-0 h-1/3"
            style={{
              background:
                "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--color-signal) 28%, transparent) 92%, var(--color-signal) 100%)",
              animation: "scan 1.8s cubic-bezier(.6,0,.4,1) infinite",
            }}
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
      </div>
      <div className="-mt-16 relative flex-1 px-6 pb-safe">
        <h1 className="display text-[44px] text-bone">{title}</h1>
        <ol className="mono mt-6 space-y-3 text-[12px]">
          {steps.slice(0, shown).map((s, i) => (
            <li key={s.label} className="rise flex items-baseline gap-3">
              <span className="text-ash">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-bone">{s.label}</span>
              <span className="ml-auto text-signal">{s.value ?? "···"}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
