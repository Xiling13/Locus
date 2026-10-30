"use client";

import { useEffect, useState } from "react";
import { FRAME } from "@/lib/image";
import { Check } from "./icons";

export type ScanStep = { label: string; value?: string };

/**
 * Photo with a sweeping scan band and a short list of steps.
 * Steps tick in on a timer; values fill once the real work resolves.
 */
export function Scanner({ src, steps, title }: { src: string; steps: ScanStep[]; title: string }) {
  const [shown, setShown] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setShown((n) => Math.min(steps.length, n + 1)), 620);
    return () => clearInterval(t);
  }, [steps.length]);

  return (
    <main className="pt-safe flex min-h-dvh flex-col bg-paper px-5 pb-safe">
      <div
        className="relative mx-auto mt-2 overflow-hidden rounded-[32px] bg-sunk"
        style={{ aspectRatio: FRAME, width: `min(100%, calc(56dvh * ${FRAME}))` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="absolute inset-0 size-full object-cover saturate-[0.7]" />
        <div className="absolute inset-0 bg-paper/25" />
        <div
          className="absolute inset-x-0 h-1/3"
          style={{
            background:
              "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--color-new) 30%, transparent) 85%, var(--color-new) 100%)",
            animation: "scan 2s cubic-bezier(.6,0,.4,1) infinite",
          }}
        />
      </div>

      <h1 className="display mt-8 text-[40px]">{title}</h1>
      <ol className="mt-5 space-y-1">
        {steps.slice(0, shown).map((s) => (
          <li key={s.label} className="rise flex h-9 items-center gap-3 text-[16px]">
            <span
              className={`grid size-5 place-items-center rounded-full transition-colors ${
                s.value ? "bg-ink text-paper" : "border-2 border-line border-t-ink"
              }`}
              style={s.value ? undefined : { animation: "spin 0.8s linear infinite" }}
            >
              {s.value && <Check width={12} height={12} strokeWidth={3} />}
            </span>
            <span className="font-medium">{s.label}</span>
            <span className="ml-auto text-soft">{s.value}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
