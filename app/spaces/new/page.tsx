"use client";

import { useRouter } from "next/navigation";
import { startTransition, useRef, useState, ViewTransition } from "react";
import { DrawHint, NameItem } from "@/components/AddItem";
import { Failure } from "@/components/Failure";
import { Back, Camera, Close, Photos, Plus } from "@/components/icons";
import { ScenePhoto } from "@/components/Photo";
import { Scanner, wait, type ScanStep } from "@/components/Scanner";
import { Button, Dock, InlineEdit, nav, Round, Screen, Shared, Sheet, Thumb, Toggle } from "@/components/ui";
import { buildCommit, detect, manualObject, shortId } from "@/lib/engine";
import { failureOf, type Failure as FailureInfo } from "@/lib/failure";
import { plural } from "@/lib/format";
import { FRAME, fromFile, type LoadedImage } from "@/lib/image";
import { useLocus } from "@/lib/store";
import type { BBox, Commit } from "@/lib/types";

type Stage =
  | { k: "capture" }
  | { k: "scan"; image: LoadedImage; steps: ScanStep[] }
  | { k: "failed"; image: LoadedImage; failure: FailureInfo }
  | { k: "review"; commit: Commit };

export default function NewSpace() {
  const router = useRouter();
  const addSpace = useLocus((s) => s.addSpace);
  const [name, setName] = useState("");
  const [stage, setStage] = useState<Stage>({ k: "capture" });
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [outline, setOutline] = useState<BBox | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  async function analyze(image: LoadedImage) {
    const steps: ScanStep[] = [
      { label: "Spotting your items" },
      { label: "Naming them" },
      { label: "Remembering where they go" },
    ];
    startTransition(() => setStage({ k: "scan", image, steps }));
    const started = Date.now();
    let commit: Commit;
    try {
      commit = await buildCommit(image, await detect(image), { parentId: null, message: "Initial commit" });
    } catch (err) {
      console.error(err);
      startTransition(() => setStage({ k: "failed", image, failure: failureOf(err) }));
      return;
    }
    const n = plural(commit.objects.length, "item");
    setStage({ k: "scan", image, steps: steps.map((s, i) => ({ ...s, value: [n, "done", "done"][i] })) });
    await wait(Math.max(600, 2400 - (Date.now() - started)));
    startTransition(() => setStage({ k: "review", commit }));
  }

  async function onFile(f?: File) {
    if (f) analyze(await fromFile(f));
  }

  function startAdding() {
    setActive(null);
    setDrawing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function addItem(label: string) {
    if (stage.k !== "review" || !outline) return;
    const obj = await manualObject(stage.commit, outline, label);
    setStage({ k: "review", commit: { ...stage.commit, objects: [...stage.commit.objects, obj] } });
    setOutline(null);
    setActive(obj.id);
  }

  function save() {
    if (stage.k !== "review") return;
    const objects = stage.commit.objects.map((o) => ({ ...o, label: labels[o.id] ?? o.label }));
    const c = { ...stage.commit, objects: objects.filter((o) => !excluded.has(o.id)) };
    const id = shortId();
    addSpace({
      id,
      name: name.trim() || "My space",
      createdAt: c.createdAt,
      headId: c.id,
      commits: [c],
      audits: [],
      untracked: objects.filter((o) => excluded.has(o.id)),
    });
    router.replace(`/spaces/${id}`, { transitionTypes: nav("forward") });
  }

  return (
    <Screen>
      <ViewTransition key={stage.k} enter="swap" exit="swap" default="none">
        {render()}
      </ViewTransition>
    </Screen>
  );

  function render() {
  if (stage.k === "scan")
    return <Scanner src={stage.image.src} steps={stage.steps} title="Getting to know your space" />;

  if (stage.k === "failed") {
    const { image, failure } = stage;
    return (
      <Failure
        kind={failure.kind}
        onRetry={() => analyze(image)}
        onClose={() => startTransition(() => setStage({ k: "capture" }))}
      />
    );
  }

  if (stage.k === "review") {
    const objs = stage.commit.objects;
    const kept = objs.length - excluded.size;
    const pick = (id: string) => setActive((a) => (a === id ? null : id));
    return (
      <main className="min-h-dvh bg-paper pb-36" onClick={() => setActive(null)}>
        <div className="pt-safe px-2" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <Shared name="shot">
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
                  pick(id);
                  document.getElementById(`obj-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                onClear={() => setActive(null)}
                onDraw={
                  drawing
                    ? (b) => {
                        setDrawing(false);
                        setOutline(b);
                      }
                    : undefined
                }
              />
            </Shared>
            {drawing ? (
              <DrawHint onCancel={() => setDrawing(false)} />
            ) : (
              <div className="absolute inset-x-2.5 top-2.5 z-40 flex justify-between">
                <Round aria-label="Retake" onClick={() => startTransition(() => setStage({ k: "capture" }))}>
                  <Back />
                </Round>
                <Round aria-label="Add an item" onClick={startAdding}>
                  <Plus />
                </Round>
              </div>
            )}
          </div>
        </div>

        <section className="px-5 pt-6">
          <div onClick={(e) => e.stopPropagation()}>
            <InlineEdit
              label="Space name"
              value={name.trim() || "My space"}
              onSave={setName}
              className="display text-[40px]"
            />
          </div>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    pick(o.id);
                  }}
                  className={`flex cursor-pointer items-center gap-3.5 border-b border-paper p-2.5 pr-4 transition-colors last:border-0 ${
                    active === o.id ? "bg-paper" : ""
                  }`}
                >
                  <Thumb src={o.crop} className={`transition-[opacity,filter] ${off ? "opacity-35 grayscale" : ""}`} />
                  <div
                    className={`min-w-0 flex-1 transition ${off ? "opacity-40" : ""}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <InlineEdit
                      label="Item name"
                      value={labels[o.id] ?? o.label}
                      onSave={(v) => setLabels((l) => ({ ...l, [o.id]: v }))}
                      className="text-[16px] font-semibold"
                    />
                  </div>
                  <span onClick={(e) => e.stopPropagation()}>
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
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <Dock>
          <Button onClick={save} disabled={kept === 0}>
            Save space · {plural(kept, "item")}
          </Button>
        </Dock>

        {outline && (
          <Sheet label="Name this item" onClose={() => setOutline(null)}>
            {(close) => (
              <NameItem
                commit={stage.commit}
                bbox={outline}
                onAdd={async (label) => {
                  await addItem(label);
                  close();
                }}
                onRedo={() => {
                  close();
                  setTimeout(startAdding, 300);
                }}
              />
            )}
          </Sheet>
        )}
      </main>
    );
  }

  return (
    <main className="pt-safe flex min-h-dvh flex-col bg-paper px-5 pb-safe">
      <div className="flex items-center justify-between">
        <Round href="/" nav="down" aria-label="Close" variant="card">
          <Close />
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
          className="relative mx-auto flex w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-[34px] border-2 border-dashed border-line bg-card/50 px-8 text-center transition-transform duration-300 active:scale-[0.98] active:duration-100"
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
        <Button tone="card" className="min-w-0 flex-1 basis-0" onClick={() => libraryRef.current?.click()}>
          <Photos width={20} height={20} />
          Photos
        </Button>
        <Button className="min-w-0 flex-1 basis-0" onClick={() => cameraRef.current?.click()}>
          <Camera width={20} height={20} />
          Take photo
        </Button>
      </div>

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
}
