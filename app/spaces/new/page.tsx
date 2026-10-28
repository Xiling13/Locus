"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Aperture, Back } from "@/components/icons";
import { PhotoBoxes } from "@/components/PhotoBoxes";
import { Scanner, wait, type ScanStep } from "@/components/Scanner";
import { Button, Round } from "@/components/ui";
import { buildCommit, detect, shortId } from "@/lib/engine";
import { fromFile, type LoadedImage } from "@/lib/image";
import { useLocus } from "@/lib/store";
import type { Commit } from "@/lib/types";

type Stage =
  | { k: "capture" }
  | { k: "scan"; image: LoadedImage; steps: ScanStep[] }
  | { k: "review"; commit: Commit };

const DEMO = { src: "/demo/bench-base.jpg", width: 864, height: 1152 };

export default function NewSpace() {
  const router = useRouter();
  const addSpace = useLocus((s) => s.addSpace);
  const [name, setName] = useState("");
  const [stage, setStage] = useState<Stage>({ k: "capture" });
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function analyze(image: LoadedImage) {
    const steps: ScanStep[] = [
      { label: "Segment" },
      { label: "Label" },
      { label: "Map layout" },
      { label: "Write ledger" },
    ];
    setStage({ k: "scan", image, steps });
    const started = Date.now();
    const detections = await detect(image);
    const commit = await buildCommit(image, detections, { parentId: null, message: "Initial commit" });
    const n = String(commit.objects.length);
    const filled = [`${n} objects`, `${n} labels`, "relative", commit.id].map((value, i) => ({
      ...steps[i],
      value,
    }));
    setStage({ k: "scan", image, steps: filled });
    await wait(Math.max(0, 2600 - (Date.now() - started)));
    setStage({ k: "review", commit });
  }

  async function onFile(f?: File) {
    if (!f) return;
    analyze(await fromFile(f));
  }

  function commit() {
    if (stage.k !== "review") return;
    const c = { ...stage.commit, objects: stage.commit.objects.filter((o) => !excluded.has(o.id)) };
    const id = shortId();
    addSpace({
      id,
      name: name.trim() || "Untitled space",
      createdAt: c.createdAt,
      headId: c.id,
      commits: [c],
      audits: [],
    });
    router.replace(`/spaces/${id}`);
  }

  if (stage.k === "scan") return <Scanner src={stage.image.src} steps={stage.steps} title="Committing" />;

  if (stage.k === "review") {
    const objs = stage.commit.objects;
    const kept = objs.length - excluded.size;
    return (
      <main className="pb-40">
        <div className="relative">
          <PhotoBoxes
            src={stage.commit.image}
            width={stage.commit.width}
            height={stage.commit.height}
            boxes={objs.map((o) => ({ id: o.id, bbox: o.bbox, off: excluded.has(o.id) }))}
            active={active}
            onPick={setActive}
          />
          <div className="pt-safe absolute left-4 top-0">
            <Round aria-label="Retake" onClick={() => setStage({ k: "capture" })}>
              <Back />
            </Round>
          </div>
        </div>
        <section className="px-5 pt-8">
          <h1 className="display text-[44px]">
            Found {objs.length} items
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ash">
            Tap to drop anything you don’t want tracked — like the mug you’ll clear away later.
          </p>
          <ul className="mt-6 space-y-2">
            {objs.map((o) => {
              const off = excluded.has(o.id);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActive(o.id);
                      setExcluded((s) => {
                        const n = new Set(s);
                        if (n.has(o.id)) n.delete(o.id);
                        else n.add(o.id);
                        return n;
                      });
                    }}
                    className={`flex w-full items-center gap-4 rounded-[20px] p-2 pr-5 text-left transition ${
                      off ? "opacity-35" : "bg-ink-2"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.crop} alt="" className="size-14 rounded-[14px] object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[16px] font-semibold ${off ? "line-through" : ""}`}>
                        {o.label}
                      </span>
                      <span className="mono mt-1 block truncate text-[11px] text-ash">
                        {o.traits.join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <div className="pb-safe fixed inset-x-0 bottom-0 mx-auto max-w-[480px] bg-gradient-to-t from-ink via-ink to-transparent px-5 pt-10">
          <Button onClick={commit} disabled={kept === 0}>
            Commit baseline · {kept}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-safe flex min-h-dvh flex-col px-5 pb-safe">
      <div className="-ml-1 pt-1">
        <Round href="/" aria-label="Back" variant="flat">
          <Back />
        </Round>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name this space"
        className="display mt-8 w-full bg-transparent text-[48px] text-bone outline-none placeholder:text-ink-3"
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="relative mt-8 flex flex-1 flex-col items-center justify-center gap-5 overflow-hidden rounded-[28px] bg-ink-2 transition active:scale-[0.99]"
      >
        <span className="grid size-20 place-items-center rounded-full bg-signal text-ink">
          <Aperture width={34} height={34} />
        </span>
        <span className="display text-[30px]">Shoot the baseline</span>
        <span className="mono px-10 text-center text-[11px] leading-5 text-ash">
          Top-down · even light · nothing hidden
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <button
        type="button"
        onClick={() => {
          if (!name) setName("Workbench");
          analyze(DEMO);
        }}
        className="mt-5 h-12 text-[15px] text-ash transition active:text-bone"
      >
        No space handy? Use the sample workbench
      </button>
    </main>
  );
}
