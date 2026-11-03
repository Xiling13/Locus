"use client";

import { useEffect, useState } from "react";
import { FRAME } from "@/lib/image";
import { Shared } from "./ui";

export type ScanStep = { label: string; value?: string };

/** Typical time for the vision round-trip; the bar eases toward 90% around here. */
const EXPECTED_MS = 9000;

/**
 * Photo with a sweeping scan band, one progress bar and the step in progress.
 * Progress is estimated until every step has a value, then fills to 100%.
 */
export function Scanner({ src, steps, title }: { src: string; steps: ScanStep[]; title: string }) {
  const done = steps.every((s) => s.value);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (done) return;
    const t0 = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - t0), 120);
    return () => clearInterval(t);
  }, [done]);

  const progress = done ? 1 : 0.92 * (1 - Math.exp(-elapsed / (EXPECTED_MS / 2.3)));
  const step = steps[Math.min(steps.length - 1, Math.floor((progress / 0.92) * steps.length))];
  const status = done ? steps.map((s) => s.value).filter((v) => v !== "done")[0] ?? "Done" : `${step.label}…`;

  return (
    <main className="scan-shell pt-safe pb-safe flex flex-col justify-center bg-paper px-5">
      <Shared name="shot">
        {/* Same designed size as 58dvh, but svh so the URL bar can’t inflate it. */}
        <div
          className="scan-frame relative mx-auto w-full overflow-hidden rounded-[34px] bg-sunk"
          style={{ aspectRatio: FRAME, maxWidth: `calc(58svh * ${FRAME})` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="absolute inset-0 size-full object-cover saturate-[0.7]" />
          <div className="absolute inset-0 bg-paper/25" />
          {!done && (
            <div
              className="absolute inset-x-0 h-1/3"
              style={{
                background:
                  "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--color-new) 30%, transparent) 85%, var(--color-new) 100%)",
                animation: "scan 2s cubic-bezier(.6,0,.4,1) infinite",
              }}
            />
          )}
        </div>
      </Shared>

      <div className="scan-copy mx-auto mt-8 w-full" style={{ maxWidth: `calc(58svh * ${FRAME})` }}>
        <h1 className="scan-title display text-[34px] leading-[1.05]">{title}</h1>
        <div className="mt-5 flex items-baseline justify-between gap-3 text-[15px]">
          <span key={status} className="fade truncate font-medium">
            {status}
          </span>
          <span className="shrink-0 tabular-nums text-soft">{Math.round(progress * 100)}%</span>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunk"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-300 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </main>
  );
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
