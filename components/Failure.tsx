"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { FailureKind } from "@/lib/failure";
import { Close, Retry } from "./icons";
import { Button, Round } from "./ui";

const COPY: Record<FailureKind, { title: string; lines: string[] }> = {
  offline: {
    title: "You’re offline",
    lines: [
      "Your photo is still here on this device.",
      "Locus will pick up again the moment you’re back online.",
    ],
  },
  slow: {
    title: "That took too long",
    lines: [
      "The connection looks slow, or the service is busy",
      "right now. One more try usually gets through.",
    ],
  },
  server: {
    title: "Couldn’t read\nthat photo",
    lines: [
      "Something went wrong while looking at it on our side.",
      "Trying again usually clears it up.",
    ],
  },
  setup: {
    title: "Vision is off",
    lines: [
      "This copy of Locus doesn’t have a model key yet.",
      "Only the sample photos can be read for now.",
    ],
  },
  crash: {
    title: "Something broke",
    lines: [
      "Your spaces and checks are still safe on this device.",
      "Try again, or head back home and carry on.",
    ],
  },
};

/**
 * One calm message and one way forward. Offline failures wait for the connection and
 * retry on their own; everything else gets a single Try again.
 */
export function Failure({
  kind,
  onRetry,
  onClose,
  closeHref,
  connected,
}: {
  kind: FailureKind;
  onRetry: () => void;
  onClose?: () => void;
  closeHref?: string;
  /** Overrides the browser's online flag (previews). */
  connected?: boolean;
}) {
  const copy = COPY[kind];
  const live = useOnline();
  const online = connected ?? live;
  const back = useBackOnline(kind === "offline", onRetry);
  const waiting = kind === "offline" && !back && !online;

  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col bg-paper px-5">
      <div className="flex">
        <Round href={closeHref} nav="down" onClick={onClose} aria-label="Close" variant="card">
          <Close />
        </Round>
      </div>

      {/* A little bottom padding keeps the block just above true centre. */}
      <div className="flex flex-1 flex-col justify-center pb-[10dvh]">
        <h1 className="display rise whitespace-pre-line text-[52px]">{copy.title}</h1>
        <div className="rise mt-5 space-y-1.5 text-[17px] leading-relaxed text-soft" style={{ animationDelay: "80ms" }}>
          {copy.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        {kind === "offline" && (waiting || back) && (
          <p key={back ? "back" : "wait"} className="fade mt-8 text-[14px] font-semibold text-mute">
            {back ? "Back online — picking up again…" : "Waiting for a connection…"}
          </p>
        )}
      </div>

      {!waiting && !back && (
        <Button className="fade" onClick={onRetry}>
          <Retry width={20} height={20} />
          Try again
        </Button>
      )}
    </main>
  );
}

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** True once the browser reports it's back online; retries shortly after. */
function useBackOnline(watch: boolean, retry: () => void) {
  const [back, setBack] = useState(false);
  const latest = useRef(retry);
  useEffect(() => {
    latest.current = retry;
  });
  useEffect(() => {
    if (!watch) return;
    let t: ReturnType<typeof setTimeout>;
    const on = () => {
      setBack(true);
      t = setTimeout(() => latest.current(), 900);
    };
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("online", on);
      clearTimeout(t);
    };
  }, [watch]);
  return back;
}
