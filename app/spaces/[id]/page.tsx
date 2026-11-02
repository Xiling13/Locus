"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useRef, useState } from "react";
import { DrawHint, NameItem } from "@/components/AddItem";
import { Aperture, Arrow, Back, More, Pencil, Plus, Trash } from "@/components/icons";
import { ScenePhoto, Spot } from "@/components/Photo";
import {
  Badge,
  Button,
  buttonClass,
  Changes,
  SavedBadge,
  Dock,
  InlineEdit,
  Missing,
  nav,
  Pill,
  Round,
  Screen,
  Shared,
  Sheet,
  Splash,
  Thumb,
  Toggle,
  useIntro,
  type InlineEditHandle,
} from "@/components/ui";
import { manualObject } from "@/lib/engine";
import { ago, plural, stamp } from "@/lib/format";
import { headOf, lastCheck, missingOf, primaryDiff, sceneOf, useHydrated, useLocus, useSpace } from "@/lib/store";
import type { Audit, BBox, Commit, LedgerObject, Space } from "@/lib/types";

export default function SpacePage({ params, searchParams }: PageProps<"/spaces/[id]">) {
  const { id } = use(params);
  const { item } = use(searchParams);
  const hydrated = useHydrated();
  const live = useSpace(id);
  // Keep drawing the space while we navigate away from deleting it.
  const [kept, setKept] = useState(live);
  if (live && live !== kept) setKept(live);
  const space = live ?? (leaving === id ? kept : undefined);

  if (!hydrated) return <Splash />;
  if (!space) return <Missing />;
  return (
    <Screen>
      <SpaceView space={space} initialItem={typeof item === "string" ? item : null} />
    </Screen>
  );
}

let leaving: string | null = null;

function SpaceView({ space, initialItem }: { space: Space; initialItem: string | null }) {
  const router = useRouter();
  const renameSpace = useLocus((s) => s.renameSpace);
  const removeSpace = useLocus((s) => s.removeSpace);
  const title = useRef<InlineEditHandle>(null);
  const [active, setActive] = useState<string | null>(initialItem);
  const [menu, setMenu] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [outline, setOutline] = useState<BBox | null>(null);
  const addItem = useLocus((s) => s.addItem);

  const head = headOf(space);
  const last = lastCheck(space);
  const missing = missingOf(space);
  const missingIds = new Set(missing.map((m) => m.objectId));
  // When something is missing, show the check's base photo so orange dots land on where it was.
  const scene = sceneOf(space);
  // New items are drawn on the current photo, the one the next check compares against.
  const photo = drawing || outline ? head : scene;
  // Items added to the current photo since that check (drawn by hand, switched back on) aren't
  // in the older scene; list them anyway, shown against the photo they were added on.
  const sceneIds = new Set(scene.objects.map((o) => o.id));
  const fresh =
    scene === head || !last
      ? []
      : head.objects.filter(
          (o) => !sceneIds.has(o.id) && !last.detections.some((d) => d.signature === o.signature),
        );
  const items = [...scene.objects, ...fresh].sort((a, b) => {
    const am = missingIds.has(a.id) ? 0 : 1;
    const bm = missingIds.has(b.id) ? 0 : 1;
    if (am !== bm) return am - bm;
    return new Date(b.seenAt).getTime() - new Date(a.seenAt).getTime();
  });

  function startAdding() {
    setActive(null);
    setDrawing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const checkStatus = last ? primaryDiff(last.items) : null;
  const focus = items.find((o) => o.id === active);
  const intro = useIntro();
  const checkTone =
    checkStatus?.kind === "removed"
      ? { bg: "bg-miss-tint", text: "text-miss-deep", btn: "bg-miss text-ink" }
      : checkStatus?.kind === "moved"
        ? { bg: "bg-move-tint", text: "text-move-deep", btn: "bg-move text-ink" }
        : checkStatus?.kind === "added"
          ? { bg: "bg-new-tint", text: "text-new-deep", btn: "bg-new text-paper" }
          : { bg: "bg-card", text: "", btn: "bg-paper" };
  const checkLabel = !checkStatus
    ? "All in place"
    : checkStatus.kind === "removed"
      ? `${plural(checkStatus.count, "item")} missing`
      : checkStatus.kind === "moved"
        ? `${checkStatus.count} moved`
        : `${checkStatus.count} new`;

  return (
    <main className="min-h-dvh bg-paper pb-36">
      <div className="pt-safe relative px-2 pb-3">
        <div className="space-hero relative rounded-[34px] shadow-[0_22px_44px_-18px_rgb(0_0_0/0.28)]">
          <Shared name={`space-${space.id}`}>
            <ScenePhoto
              src={photo.image}
              width={photo.width}
              height={photo.height}
              aspect={4 / 5}
              className="rounded-[34px]"
              pins={photo.objects.map((o) => ({
                id: o.id,
                bbox: o.bbox,
                label: o.label,
                missing: photo === scene && missingIds.has(o.id),
              }))}
              active={active}
              onPick={(id) => setActive((a) => (a === id ? null : id))}
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
              <Round href="/" aria-label="Back" className="space-chrome">
                <Back />
              </Round>
              <Round aria-label="Add an item" onClick={startAdding} className="space-chrome">
                <Plus />
              </Round>
            </div>
          )}
        </div>
      </div>

      <section className="px-5 pt-5">
        <div className="flex items-center gap-3">
          <InlineEdit
            ref={title}
            bare
            label="Space name"
            value={space.name}
            onSave={(v) => renameSpace(space.id, v)}
            className="space-title display text-[44px]"
          />
          <button
            type="button"
            aria-label="Space options"
            onClick={() => setMenu(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-start text-mute transition-[transform,color] duration-200 active:scale-90 active:text-ink active:duration-75"
          >
            <More width={18} height={18} />
          </button>
        </div>
        <p className="mt-2 text-[15px] text-soft">
          {plural(items.length, "item")} · photo from {stamp(scene.createdAt)}
        </p>

        {last && (
          <Link
            href={`/spaces/${space.id}/audits/${last.id}`}
            transitionTypes={nav("forward")}
            className={`mt-5 flex items-center gap-3.5 rounded-[24px] p-3.5 pl-4 transition-transform duration-300 active:scale-[0.98] active:duration-100 ${checkTone.bg} ${intro ? "rise" : ""}`}
          >
            <span className="min-w-0 flex-1">
              <span className={`block text-[16px] font-bold ${checkTone.text}`}>
                {checkLabel}
              </span>
              <span className="mt-0.5 block truncate text-[13px] text-soft">
                {missing.length ? missing.map((m) => m.label).join(", ") : `Checked ${ago(last.createdAt)}`}
              </span>
            </span>
            <span className={`grid size-10 shrink-0 place-items-center rounded-full ${checkTone.btn}`}>
              <Arrow width={16} height={16} />
            </span>
          </Link>
        )}
      </section>

      <section className="mt-10 px-5">
        <h2 className="text-[22px] font-bold tracking-[-0.03em]">Items</h2>
        <ul className="mt-4 grid grid-cols-3 gap-x-4 gap-y-5">
          {items.map((o, i) => (
            <li key={o.id} className={intro ? "rise" : ""} style={{ animationDelay: `${i * 30}ms` }}>
              <button
                type="button"
                onClick={() => setActive(o.id)}
                className="block w-full text-left transition-transform duration-300 active:scale-95 active:duration-100"
              >
                <span className="relative block">
                  <span
                    aria-hidden
                    className="block aspect-square w-full rounded-[22px] bg-sunk bg-cover bg-center"
                    style={{ backgroundImage: `url(${JSON.stringify(o.crop)})` }}
                  />
                  {missingIds.has(o.id) && (
                    <span className="absolute -right-0.5 -top-0.5 size-3.5 rounded-full bg-miss ring-[3px] ring-paper" />
                  )}
                </span>
                <span className="mt-2 line-clamp-2 block text-[14px] font-medium leading-snug">{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
        {items.length === 0 && (
          <p className="mt-3 px-1 text-[14px] text-mute">Nothing tracked here. Switch an item back on below.</p>
        )}
      </section>

      <Untracked space={space} />

      <History space={space} head={head} />

      <Dock>
        <Link href={`/spaces/${space.id}/check`} transitionTypes={nav("up")} className={buttonClass("ink")}>
          <Aperture />
          Check now
        </Link>
      </Dock>

      {focus && (
        <ItemSheet
          key={focus.id}
          space={space}
          head={fresh.includes(focus) ? head : scene}
          item={focus}
          missingCheck={missingIds.has(focus.id) ? last : undefined}
          onClose={() => setActive(null)}
        />
      )}

      {outline && (
        <Sheet label="Name this item" onClose={() => setOutline(null)}>
          {(close) => (
            <NameItem
              commit={head}
              bbox={outline}
              onAdd={async (label) => {
                addItem(space.id, await manualObject(head, outline, label));
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

      {menu && (
        <Sheet label="Space options" onClose={() => setMenu(false)}>
          {(close) => (
            <SpaceMenu
              name={space.name}
              onRename={() => {
                close();
                setTimeout(() => title.current?.edit(), 280);
              }}
              onDelete={() => {
                leaving = space.id;
                removeSpace(space.id);
                router.replace("/", { transitionTypes: nav("back") });
              }}
            />
          )}
        </Sheet>
      )}
    </main>
  );
}

function SpaceMenu({ name, onRename, onDelete }: { name: string; onRename: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm)
    return (
      <div className="fade px-5 pb-3 pt-2">
        <p className="display text-[30px]">Delete “{name}”?</p>
        <p className="mt-2 text-[15px] leading-relaxed text-soft">
          Its photos, items and check history will be removed from this device.
        </p>
        <div className="mt-6 flex gap-2">
          <Button tone="sunk" className="min-w-0 flex-1 basis-0" onClick={() => setConfirm(false)}>
            Keep
          </Button>
          <Button tone="miss" className="min-w-0 flex-1 basis-0" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    );
  return (
    <ul className="px-3 pb-2">
      <li>
        <button
          type="button"
          onClick={onRename}
          className="flex h-14 w-full items-center gap-4 rounded-[18px] px-3 text-[17px] font-semibold active:bg-paper"
        >
          <Pencil width={20} height={20} />
          Rename space
        </button>
      </li>
      <li>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="flex h-14 w-full items-center gap-4 rounded-[18px] px-3 text-[17px] font-semibold text-miss-deep active:bg-paper"
        >
          <Trash width={20} height={20} />
          Delete space
        </button>
      </li>
    </ul>
  );
}

function ItemSheet({
  space,
  head,
  item,
  missingCheck,
  onClose,
}: {
  space: Space;
  head: Commit;
  item: LedgerObject;
  missingCheck?: Audit;
  onClose: () => void;
}) {
  const renameItem = useLocus((s) => s.renameItem);
  const untrackItem = useLocus((s) => s.untrackItem);
  return (
    <Sheet label={item.label} onClose={onClose}>
      {(close) => (
        <div className="px-4 pb-2">
          <Spot
            src={head.image}
            width={head.width}
            height={head.height}
            bbox={item.bbox}
            aspect={16 / 11}
            tone={missingCheck ? "var(--color-miss)" : "white"}
            className="rounded-[24px]"
          />
          <div className="px-1 pt-5">
            {missingCheck && (
              <Pill tone="miss" className="mb-3">
                Missing in the last check
              </Pill>
            )}
            <InlineEdit
              label="Item name"
              value={item.label}
              onSave={(v) => renameItem(space.id, item.id, v)}
              className="text-[28px] font-bold leading-tight tracking-[-0.035em]"
            />
            <dl className="mt-5 rounded-[20px] bg-paper p-4">
              <div>
                <dt className="text-[12px] font-medium uppercase tracking-[0.04em] text-mute">Where it lives</dt>
                <dd className="mt-1.5 text-[17px] font-semibold leading-snug tracking-[-0.01em]">{item.hint}</dd>
              </div>
              <div className="mt-4 border-t border-line/60 pt-3">
                <dt className="text-[12px] font-medium uppercase tracking-[0.04em] text-mute">Last seen</dt>
                <dd className="mt-1 text-[14px] leading-snug text-soft">
                  {stamp(item.seenAt)} · {ago(item.seenAt)}
                </dd>
              </div>
            </dl>
          </div>
          <div className="mt-5 flex gap-2">
            {missingCheck ? (
              <>
                <Button tone="sunk" className="min-w-0 flex-1 basis-0" onClick={close}>
                  Close
                </Button>
                <Link
                  href={`/spaces/${space.id}/audits/${missingCheck.id}?item=rm-${item.id}`}
                  transitionTypes={nav("forward")}
                  className={buttonClass("ink", "min-w-0 flex-1 basis-0")}
                >
                  Open check
                </Link>
              </>
            ) : (
              <Button tone="sunk" onClick={close}>
                Done
              </Button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              close();
              setTimeout(() => untrackItem(space.id, item.id), 300);
            }}
            className={buttonClass("clear", "mt-1")}
          >
            Stop tracking
          </button>
        </div>
      )}
    </Sheet>
  );
}

function Untracked({ space }: { space: Space }) {
  const trackItem = useLocus((s) => s.trackItem);
  const items = space.untracked ?? [];
  if (!items.length) return null;
  return (
    <section className="mt-10 px-5">
      <h2 className="text-[22px] font-bold tracking-[-0.03em]">Not tracked</h2>
      <p className="mt-1 text-[14px] text-soft">
        {items.length} {items.length === 1 ? "item" : "items"}
      </p>
      <ul className="mt-4 overflow-hidden rounded-[28px] bg-card">
        {items.map((o) => (
          <li key={o.id} className="flex items-center gap-3.5 border-b border-paper p-2.5 pr-4 last:border-0">
            <Thumb src={o.crop} className="opacity-50 grayscale" />
            <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-soft">{o.label}</span>
            <Toggle on={false} label={`Keep track of ${o.label}`} onChange={() => trackItem(space.id, o.id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function History({ space, head }: { space: Space; head: Commit }) {
  const first = space.commits.find((c) => c.parentId === null) ?? space.commits.at(-1)!;
  return (
    <section className="mt-12 px-5">
      <h2 className="text-[22px] font-bold tracking-[-0.03em]">History</h2>
      <ol className="mt-4 overflow-hidden rounded-[28px] bg-card">
        {space.audits.map((a) => (
          <li key={a.id} className="border-b border-paper">
            <Link
              href={`/spaces/${space.id}/audits/${a.id}`}
              transitionTypes={nav("forward")}
              className="flex items-center gap-3.5 p-2.5 pr-4 transition-colors active:bg-paper"
            >
              <Thumb src={a.image} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[16px] font-semibold">
                  Checked {ago(a.createdAt)}
                  <SavedBadge space={space} audit={a} />
                </span>
                <span className="mt-1 block">
                  <Changes audit={a} />
                </span>
              </span>
              <Back width={18} height={18} className="shrink-0 rotate-180 text-mute" />
            </Link>
          </li>
        ))}
        <li className="flex items-center gap-3.5 p-2.5 pr-4">
          <Thumb src={first.image} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-[16px] font-semibold">
              Space created
              {head.id === first.id && <Badge>Current</Badge>}
            </span>
            <span className="mt-1 block text-[13px] text-soft">{stamp(first.createdAt)} · first photo</span>
          </span>
        </li>
      </ol>
      {space.audits.length === 0 && (
        <p className="mt-3 px-1 text-[14px] text-mute">Not checked yet.</p>
      )}
    </section>
  );
}
