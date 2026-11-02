"use client";

import { useRouter } from "next/navigation";
import { startTransition, use, useEffect, useRef, useState, ViewTransition } from "react";
import { Failure } from "@/components/Failure";
import { Close, Photos } from "@/components/icons";
import { Scanner, wait, type ScanStep } from "@/components/Scanner";
import { Button, Missing, nav, Round, Screen, Shared, Splash } from "@/components/ui";
import { runAudit } from "@/lib/engine";
import { failureOf, type Failure as FailureInfo } from "@/lib/failure";
import { plural } from "@/lib/format";
import { FRAME, cssUrl, fromFile, fromSource, type LoadedImage } from "@/lib/image";
import { headOf, useHydrated, useLocus, useSpace } from "@/lib/store";
import type { Audit, Commit } from "@/lib/types";

const DEMO_CURRENT = { src: "/demo/bench-current.jpg", width: 864, height: 1152 };

type Stage =
  | { k: "aim" }
  | { k: "review"; image: LoadedImage }
  | { k: "scan"; image: LoadedImage; steps: ScanStep[] }
  | { k: "failed"; image: LoadedImage; failure: FailureInfo };

export default function CheckPage({ params }: PageProps<"/spaces/[id]/check">) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const space = useSpace(id);
  const addAudit = useLocus((s) => s.addAudit);
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ k: "aim" });

  if (!hydrated) return <Splash />;
  if (!space) return <Missing />;
  const head = headOf(space);

  async function compare(image: LoadedImage) {
    const steps: ScanStep[] = [
      { label: "Spotting your items" },
      { label: "Comparing with last time" },
      { label: "Checking hidden spots" },
    ];
    startTransition(() => setStage({ k: "scan", image, steps }));
    const started = Date.now();
    let audit: Audit;
    try {
      audit = await runAudit(head, image, space!.untracked);
    } catch (err) {
      console.error(err);
      startTransition(() => setStage({ k: "failed", image, failure: failureOf(err) }));
      return;
    }
    const occluded = audit.items.filter((i) => i.confidence === "occluded").length;
    const changes = audit.items.length;
    const values = [
      plural(audit.detections.length, "item"),
      changes ? plural(changes, "change") : "no changes",
      occluded ? `${occluded} to look at` : "all clear",
    ];
    // Keep the bar moving (esp. for instant demo fixtures) before snapping to 100%.
    await wait(Math.max(0, 2400 - (Date.now() - started)));
    setStage({ k: "scan", image, steps: steps.map((s, i) => ({ ...s, value: values[i] })) });
    await wait(600);
    addAudit(space!.id, audit);
    router.replace(`/spaces/${space!.id}/audits/${audit.id}`, { transitionTypes: nav("forward") });
  }

  return (
    <Screen>
      <ViewTransition key={stage.k === "aim" || stage.k === "review" ? "camera" : stage.k} enter="swap" exit="swap" default="none">
        {stage.k === "scan" ? (
          <Scanner src={stage.image.src} steps={stage.steps} title="Comparing…" />
        ) : stage.k === "failed" ? (
          <Failure
            kind={stage.failure.kind}
            onRetry={() => compare(stage.image)}
            onClose={() => startTransition(() => setStage({ k: "aim" }))}
          />
        ) : (
          <Viewfinder
            head={head}
            close={`/spaces/${space.id}`}
            shot={stage.k === "review" ? stage.image : null}
            onShot={(image) => setStage({ k: "review", image })}
            onRetake={() => setStage({ k: "aim" })}
            onCompare={compare}
            demo={space.demo}
          />
        )}
      </ViewTransition>
    </Screen>
  );
}

function Viewfinder({
  head,
  close,
  shot,
  onShot,
  onRetake,
  onCompare,
  demo,
}: {
  head: Commit;
  close: string;
  shot: LoadedImage | null;
  onShot: (i: LoadedImage) => void;
  onRetake: () => void;
  onCompare: (i: LoadedImage) => void;
  demo?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<"pending" | "live" | "off">("pending");
  const [peek, setPeek] = useState(false);

  useEffect(() => {
    if (shot) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    const request = navigator.mediaDevices
      ? navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        })
      : Promise.reject(new Error("no camera"));
    request
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
        setCamera("live");
      })
      .catch(() => setCamera("off"));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [shot]);

  // Kill native image/video drag & touch panning inside the frame — peek is view-only.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const block = (e: Event) => e.preventDefault();
    el.addEventListener("touchmove", block, { passive: false });
    el.addEventListener("dragstart", block);
    return () => {
      el.removeEventListener("touchmove", block);
      el.removeEventListener("dragstart", block);
    };
  }, []);

  async function capture() {
    const v = videoRef.current;
    if (!v || camera !== "live") return fileRef.current?.click();
    onShot(await fromSource(v));
  }

  const lastOpacity = peek ? 0.6 : !shot && camera === "off" ? 0.15 : 0;

  return (
    <main className="flex h-dvh flex-col bg-black text-white">
      <header className="pt-safe flex items-center px-4 pb-3">
        <Round href={close} nav="down" aria-label="Close" variant="dark">
          <Close />
        </Round>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center pb-8" style={{ containerType: "size" }}>
        <Shared name="shot">
        <div
          ref={frameRef}
          className="relative touch-none select-none overflow-hidden rounded-[34px] bg-[#1c1c1b] [-webkit-touch-callout:none]"
          style={{ aspectRatio: FRAME, width: `min(100cqw - 16px, ${FRAME * 100}cqh)` }}
        >
          {/* All still frames are CSS backgrounds (not <img>) so nothing can be native-dragged. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {shot ? (
              <div
                key={shot.src}
                aria-hidden
                className="fade absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: cssUrl(shot.src) }}
              />
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                controls={false}
                disablePictureInPicture
                disableRemotePlayback
                draggable={false}
                className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${
                  camera === "live" ? "opacity-100" : "opacity-0"
                }`}
              />
            )}
            <div
              aria-hidden
              className="absolute inset-0 bg-cover bg-center transition-opacity duration-200"
              style={{
                backgroundImage: cssUrl(head.image),
                opacity: lastOpacity,
              }}
            />
          </div>

          {/* Full-frame hit target: hold to peek only — pan/drag never moves the photo. */}
          <div
            role="presentation"
            className="absolute inset-0 z-10 touch-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setPeek(true);
            }}
            onPointerMove={(e) => e.preventDefault()}
            onPointerUp={() => setPeek(false)}
            onPointerCancel={() => setPeek(false)}
            onLostPointerCapture={() => setPeek(false)}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          />

          {!shot && camera === "off" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-6">
              <p className="text-[22px] font-bold tracking-[-0.03em]">Camera is off</p>
              <p className="mt-1 text-[14px] text-white/70">Pick a photo taken from the same spot instead.</p>
            </div>
          )}
          <span className="glass-dark pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold text-white/90">
            {peek ? "Last photo" : "Hold to see last photo"}
          </span>
        </div>
        </Shared>
      </div>

      <div className="pb-safe flex h-[188px] shrink-0 flex-col justify-center px-5">
        {shot ? (
          <div className="flex gap-2">
            <Button tone="smoke" className="min-w-0 flex-1 basis-0" onClick={onRetake}>
              Retake
            </Button>
            <Button tone="card" className="min-w-0 flex-1 basis-0" onClick={() => onCompare(shot)}>
              Compare
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4">
              <button
                type="button"
                aria-label="Choose from photos"
                onClick={() => fileRef.current?.click()}
                className="grid size-13 place-items-center rounded-full bg-white/12 text-white transition-transform duration-200 active:scale-90 active:duration-75"
              >
                <Photos />
              </button>
              <button
                type="button"
                aria-label="Take photo"
                onClick={capture}
                className="group grid size-[80px] place-items-center rounded-full border-[4px] border-white transition-transform duration-200 active:scale-95"
              >
                <span className="size-[62px] rounded-full bg-white transition-transform duration-200 group-active:scale-90 group-active:duration-75" />
              </button>
              <span className="size-13" />
            </div>
            {demo && (
              <button
                type="button"
                onClick={() => onShot(DEMO_CURRENT)}
                className="mt-4 h-10 text-[14px] font-medium text-white/55 transition active:text-white"
              >
                Use sample photo
              </button>
            )}
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) onShot(await fromFile(f));
          }}
        />
      </div>
    </main>
  );
}
