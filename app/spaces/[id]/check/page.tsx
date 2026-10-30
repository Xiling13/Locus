"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { Close, Ghost, Photos } from "@/components/icons";
import { Scanner, wait, type ScanStep } from "@/components/Scanner";
import { Button, Missing, Round, Splash } from "@/components/ui";
import { runAudit } from "@/lib/engine";
import { plural } from "@/lib/format";
import { FRAME, fromFile, fromSource, type LoadedImage } from "@/lib/image";
import { headOf, useHydrated, useLocus, useSpace } from "@/lib/store";
import type { Commit } from "@/lib/types";

const GHOST_ON = 0.7;
const DEMO_CURRENT = { src: "/demo/bench-current.jpg", width: 864, height: 1152 };

type Stage =
  | { k: "aim" }
  | { k: "review"; image: LoadedImage }
  | { k: "scan"; image: LoadedImage; steps: ScanStep[] };

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
      { label: "Spotting your things" },
      { label: "Comparing with last time" },
      { label: "Checking hidden spots" },
    ];
    setStage({ k: "scan", image, steps });
    const started = Date.now();
    const audit = await runAudit(head, image);
    const occluded = audit.items.filter((i) => i.confidence === "occluded").length;
    const changes = audit.items.length;
    const values = [
      plural(audit.detections.length, "item"),
      changes ? plural(changes, "change") : "no changes",
      occluded ? `${occluded} to look at` : "all clear",
    ];
    setStage({ k: "scan", image, steps: steps.map((s, i) => ({ ...s, value: values[i] })) });
    await wait(Math.max(0, 2400 - (Date.now() - started)));
    addAudit(space!.id, audit);
    router.replace(`/spaces/${space!.id}/audits/${audit.id}`);
  }

  if (stage.k === "scan") return <Scanner src={stage.image.src} steps={stage.steps} title="Comparing…" />;

  return (
    <Viewfinder
      head={head}
      close={`/spaces/${space.id}`}
      shot={stage.k === "review" ? stage.image : null}
      onShot={(image) => setStage({ k: "review", image })}
      onRetake={() => setStage({ k: "aim" })}
      onCompare={compare}
      demo={space.demo}
    />
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<"pending" | "live" | "off">("pending");
  const [ghostOn, setGhostOn] = useState(true);
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

  async function capture() {
    const v = videoRef.current;
    if (!v || camera !== "live") return fileRef.current?.click();
    onShot(await fromSource(v));
  }

  const ghostOpacity = ghostOn ? GHOST_ON : 0;

  return (
    <main className="flex h-dvh flex-col bg-black text-white">
      <header className="pt-safe flex items-center justify-between px-4 pb-3">
        <Round href={close} aria-label="Close" variant="dark">
          <Close />
        </Round>
        <span className="text-[15px] font-semibold">{shot ? "Look good?" : "Line up with last time"}</span>
        <Round
          aria-label="Outline guide"
          aria-pressed={ghostOn}
          onClick={() => setGhostOn((on) => !on)}
          variant={ghostOn ? "card" : "dark"}
        >
          <Ghost />
        </Round>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center pb-8" style={{ containerType: "size" }}>
        <div
          className="relative touch-none select-none overflow-hidden rounded-[28px] bg-[#1c1c1b]"
          style={{ aspectRatio: FRAME, width: `min(100cqw - 16px, ${FRAME * 100}cqh)` }}
          onPointerDown={() => setPeek(true)}
          onPointerUp={() => setPeek(false)}
          onPointerLeave={() => setPeek(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot.src} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${
                camera === "live" ? "opacity-100" : "opacity-0"
              }`}
            />
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={head.image}
            alt=""
            className="absolute inset-0 size-full object-cover transition-opacity duration-200"
            style={{ opacity: peek ? 0.6 : !shot && camera === "off" ? 0.15 : 0 }}
          />
          <div
            className="pointer-events-none absolute inset-0 transition-opacity duration-300"
            style={{
              opacity: ghostOpacity,
              backgroundColor: "white",
              maskImage: `url(${head.edges})`,
              maskSize: "cover",
              maskPosition: "center",
              WebkitMaskImage: `url(${head.edges})`,
              WebkitMaskSize: "cover",
              WebkitMaskPosition: "center",
            }}
          />

          {!shot && camera === "off" && (
            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="text-[22px] font-bold tracking-[-0.03em]">Camera is off</p>
              <p className="mt-1 text-[14px] text-white/70">Pick a photo taken from the same spot instead.</p>
            </div>
          )}
          <span className="glass-dark pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold text-white/90">
            {peek ? "Last photo" : "Hold to see last photo"}
          </span>
        </div>
      </div>

      <div className="pb-safe flex h-[188px] shrink-0 flex-col justify-center px-5">
        {shot ? (
          <div className="flex gap-2">
            <Button tone="smoke" className="min-w-0 flex-1" onClick={onRetake}>
              Retake
            </Button>
            <Button tone="card" className="min-w-0 flex-1" onClick={() => onCompare(shot)}>
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
                className="grid size-13 place-items-center rounded-full bg-white/12 text-white transition active:scale-95"
              >
                <Photos />
              </button>
              <button
                type="button"
                aria-label="Take photo"
                onClick={capture}
                className="grid size-[80px] place-items-center rounded-full border-[4px] border-white transition active:scale-95"
              >
                <span className="size-[62px] rounded-full bg-white" />
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
