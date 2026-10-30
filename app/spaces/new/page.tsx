"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Back, Camera, Photos } from "@/components/icons";
import { ScenePhoto } from "@/components/Photo";
import { Scanner, wait, type ScanStep } from "@/components/Scanner";
import { Button, InlineEdit, Round } from "@/components/ui";
import { buildCommit, detect, shortId } from "@/lib/engine";
import { plural } from "@/lib/format";
import { FRAME, fromFile, type LoadedImage } from "@/lib/image";
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
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  async function analyze(image: LoadedImage) {
    const steps: ScanStep[] = [
      { label: "Spotting your things" },
      { label: "Naming them" },
      { label: "Remembering where they go" },
    ];
    setStage({ k: "scan", image, steps });
    const started = Date.now();
    const detections = await detect(image);
    const commit = await buildCommit(image, detections, { parentId: null, message: "Initial commit" });
    const n = plural(commit.objects.length, "item");
    setStage({ k: "scan", image, steps: steps.map((s, i) => ({ ...s, value: [n, "done", "done"][i] })) });
    await wait(Math.max(0, 2400 - (Date.now() - started)));
    setStage({ k: "review", commit });
  }

  async function onFile(f?: File) {
    if (f) analyze(await fromFile(f));
  }

  function save() {
    if (stage.k !== "review") return;
    const c = {
      ...stage.commit,
      objects: stage.commit.objects
        .filter((o) => !excluded.has(o.id))
        .map((o) => ({ ...o, label: labels[o.id] ?? o.label })),
    };
    const id = shortId();
    addSpace({
      id,
      name: name.trim() || "My space",
      createdAt: c.createdAt,
      headId: c.id,
      commits: [c],
      audits: [],
    });
    router.replace(`/spaces/${id}`);
  }

  if (stage.k === "scan")
    return <Scanner src={stage.image.src} steps={stage.steps} title="Getting to know your space" />;

  if (stage.k === "review") {
    const objs = stage.commit.objects;
    const kept = objs.length - excluded.size;
    return (
      <main className="min-h-dvh bg-paper pb-36">
        <div className="pt-safe relative px-2">
          <ScenePhoto
            src={stage.commit.image}
            width={stage.commit.width}
            height={stage.commit.height}
            aspect={4 / 5}
            className="rounded-[34px]"
            pins={objs.map((o) => ({
              id: o.id,
              bbox: o.bbox,
              label: labels[o.id] ?? o.label,
              off: excluded.has(o.id),
            }))}
            active={active}
            onPick={(id) => {
              setActive((a) => (a === id ? null : id));
              document.getElementById(`obj-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
          <div className="absolute left-5 top-3">
            <Round aria-label="Retake" onClick={() => setStage({ k: "capture" })}>
              <Back />
            </Round>
          </div>
        </div>

        <section className="px-5 pt-6">
          <InlineEdit
            label="Space name"
            value={name.trim() || "My space"}
            onSave={setName}
            className="display text-[40px]"
          />
          <p className="mt-3 text-[15px] leading-relaxed text-soft">
            Found {plural(objs.length, "item")}. Tap a name to fix it, and switch off anything you don’t need to keep
            track of.
          </p>
          <ul className="mt-5 overflow-hidden rounded-[28px] bg-card">
            {objs.map((o) => {
              const off = excluded.has(o.id);
              return (
                <li
                  key={o.id}
                  id={`obj-${o.id}`}
                  className={`flex items-center gap-3.5 border-b border-paper p-2.5 pr-4 transition-colors last:border-0 ${
                    active === o.id ? "bg-paper" : ""
                  }`}
                >
                  <button
                    type="button"
                    aria-label={`Show ${labels[o.id] ?? o.label} in photo`}
                    onClick={() => setActive((a) => (a === o.id ? null : o.id))}
                    className="shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={o.crop}
                      alt=""
                      className={`size-14 rounded-[18px] object-cover transition ${off ? "opacity-35 grayscale" : ""}`}
                    />
                  </button>
                  <div className={`min-w-0 flex-1 transition ${off ? "opacity-40" : ""}`}>
                    <InlineEdit
                      label="Item name"
                      value={labels[o.id] ?? o.label}
                      onSave={(v) => setLabels((l) => ({ ...l, [o.id]: v }))}
                      className="text-[16px] font-semibold"
                    />
                  </div>
                  <Toggle
                    on={!off}
                    label={`Keep track of ${labels[o.id] ?? o.label}`}
                    onChange={() =>
                      setExcluded((s) => {
                        const n = new Set(s);
                        if (n.has(o.id)) n.delete(o.id);
                        else n.add(o.id);
                        return n;
                      })
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <div className="pb-safe fixed inset-x-0 bottom-0 mx-auto max-w-[480px] bg-gradient-to-t from-paper via-paper/95 to-transparent px-5 pt-10">
          <Button onClick={save} disabled={kept === 0}>
            Save space · {plural(kept, "item")}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-safe flex min-h-dvh flex-col bg-paper px-5 pb-safe">
      <div className="flex items-center justify-between">
        <Round href="/" aria-label="Back" variant="card">
          <Back />
        </Round>
        <span className="text-[15px] font-semibold">New space</span>
        <span className="size-11" />
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name it"
        aria-label="Space name"
        className="display mt-8 w-full bg-transparent text-[48px] outline-none placeholder:text-mute/60"
      />
      <p className="mt-2 text-[15px] text-soft">A desk, a drawer, the entry shelf…</p>

      <div className="mt-6 flex flex-1 flex-col justify-center">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="relative mx-auto flex w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-[32px] border-2 border-dashed border-line bg-card/50 px-8 text-center transition active:scale-[0.99]"
          style={{ aspectRatio: FRAME, width: `min(100%, calc(48dvh * ${FRAME}))` }}
        >
          <span className="grid size-16 place-items-center rounded-full bg-ink text-paper">
            <Camera width={28} height={28} />
          </span>
          <span className="text-[20px] font-bold tracking-[-0.03em]">Take one photo of the space</span>
          <span className="text-[14px] leading-relaxed text-soft">
            Shoot from above, in good light, with everything in view.
          </span>
        </button>
      </div>

      <div className="mt-6 flex gap-2">
        <Button tone="card" className="flex-1" onClick={() => libraryRef.current?.click()}>
          <Photos width={20} height={20} />
          Photos
        </Button>
        <Button className="flex-[1.5]" onClick={() => cameraRef.current?.click()}>
          <Camera width={20} height={20} />
          Take photo
        </Button>
      </div>
      <button
        type="button"
        onClick={() => {
          if (!name) setName("Workbench");
          analyze(DEMO);
        }}
        className="mt-2 h-12 text-[14px] font-medium text-soft transition active:text-ink"
      >
        Try it with a sample photo
      </button>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <input ref={libraryRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    </main>
  );
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-ink" : "bg-line"}`}
    >
      <span
        className={`absolute top-0.5 size-6 rounded-full bg-white shadow-sm transition-[left] duration-250 ease-[var(--ease-spring)] ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
