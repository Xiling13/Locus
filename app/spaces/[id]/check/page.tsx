"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import { Close, Ghost, Photos } from "@/components/icons";
import { Scanner, wait, type ScanStep } from "@/components/Scanner";
import { Button, Missing, Round, Splash } from "@/components/ui";
import { runAudit } from "@/lib/engine";
import { fromFile, type LoadedImage } from "@/lib/image";
import { headOf, useHydrated, useLocus, useSpace } from "@/lib/store";
import type { Commit } from "@/lib/types";

const GHOST_LEVELS = [0.65, 0.3, 0];
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
      { label: "Segment" },
      { label: `Match ${head.id}` },
      { label: "Occlusion" },
      { label: "Diff" },
    ];
    setStage({ k: "scan", image, steps });
    const started = Date.now();
    const audit = await runAudit(head, image);
    const n = (k: string) => audit.items.filter((i) => i.kind === k).length;
    const occluded = audit.items.filter((i) => i.confidence === "occluded").length;
    const values = [
      `${audit.detections.length} objects`,
      `${audit.unchanged + n("moved")} / ${head.objects.length}`,
      occluded ? `${occluded} to review` : "clear",
      `${audit.items.length} changes`,
    ];
    setStage({ k: "scan", image, steps: steps.map((s, i) => ({ ...s, value: values[i] })) });
    await wait(Math.max(0, 2800 - (Date.now() - started)));
    addAudit(space!.id, audit);
    router.replace(`/spaces/${space!.id}/audits/${audit.id}`);
  }

  if (stage.k === "scan") return <Scanner src={stage.image.src} steps={stage.steps} title="Diffing" />;

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
  const [ghost, setGhost] = useState(0);
  const [peek, setPeek] = useState(false);
  const aspect = head.width / head.height;

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

  function capture() {
    const v = videoRef.current;
    if (!v || camera !== "live") return fileRef.current?.click();
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const [sw, sh] = vw / vh > aspect ? [vh * aspect, vh] : [vw, vw / aspect];
    const scale = Math.min(1, 2000 / Math.max(sw, sh));
    const c = document.createElement("canvas");
    c.width = Math.round(sw * scale);
    c.height = Math.round(sh * scale);
    c.getContext("2d")!.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    onShot({ src: c.toDataURL("image/jpeg", 0.86), width: c.width, height: c.height });
  }

  const ghostOpacity = GHOST_LEVELS[ghost];

  return (
    <main className="flex min-h-dvh flex-col bg-black">
      <header className="pt-safe flex items-center justify-between px-4 pb-3">
        <Round href={close} aria-label="Close" variant="flat">
          <Close />
        </Round>
        <span className="mono text-[11px] text-ash">
          {shot ? "Check framing" : "Align to"} <span className="text-bone">{head.id}</span>
        </span>
        <Round
          aria-label="Ghost overlay"
          onClick={() => setGhost((g) => (g + 1) % GHOST_LEVELS.length)}
          variant={ghostOpacity ? "solid" : "flat"}
        >
          <Ghost />
        </Round>
      </header>

      <div
        className="relative w-full touch-none select-none overflow-hidden bg-ink"
        style={{ aspectRatio: `${aspect}` }}
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
          style={{ opacity: peek ? 0.55 : !shot && camera === "off" ? 0.12 : 0 }}
        />
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: ghostOpacity,
            backgroundColor: "var(--color-bone)",
            maskImage: `url(${head.edges})`,
            maskSize: "100% 100%",
            WebkitMaskImage: `url(${head.edges})`,
            WebkitMaskSize: "100% 100%",
          }}
        />

        {!shot && camera === "off" && (
          <div className="absolute inset-x-0 bottom-0 p-6">
            <p className="display text-[30px]">Camera is off</p>
            <p className="mt-2 text-[14px] text-bone/70">Pick a photo taken from the same spot instead.</p>
          </div>
        )}
        <span className="mono pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-ink/55 px-3 py-1.5 text-[10px] text-bone/80 backdrop-blur-md">
          {peek ? "Baseline" : "Hold to peek baseline"}
        </span>
      </div>

      <div className="pb-safe flex flex-1 flex-col justify-end px-5 pt-6">
        {shot ? (
          <div className="flex gap-3">
            <Button tone="ink" className="flex-1" onClick={onRetake}>
              Retake
            </Button>
            <Button className="flex-[1.6]" onClick={() => onCompare(shot)}>
              Run diff
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-3">
              <button
                type="button"
                aria-label="Choose from library"
                onClick={() => fileRef.current?.click()}
                className="grid size-14 place-items-center rounded-[18px] bg-ink-2 text-bone transition active:scale-95"
              >
                <Photos />
              </button>
              <button
                type="button"
                aria-label="Capture"
                onClick={capture}
                className="grid size-[84px] place-items-center rounded-full bg-bone transition active:scale-95"
              >
                <span className="size-[68px] rounded-full bg-bone ring-[3px] ring-ink" />
              </button>
              <span className="size-14" />
            </div>
            {demo && (
              <button
                type="button"
                onClick={() => onShot(DEMO_CURRENT)}
                className="mt-5 h-11 text-[14px] text-ash transition active:text-bone"
              >
                Use sample audit photo
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
