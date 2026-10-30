"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useRef, useState } from "react";
import { Aperture, Arrow, Back, More, Pencil, Trash } from "@/components/icons";
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
import { ago, plural, stamp } from "@/lib/format";
import { headOf, missingOf, openCheck, primaryDiff, useHydrated, useLocus, useSpace } from "@/lib/store";
import type { Audit, Commit, LedgerObject, Space } from "@/lib/types";

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

  const head = headOf(space);
  const missing = missingOf(space);
  const missingIds = new Set(missing.map((m) => m.objectId));
  const open = openCheck(space);
  const openStatus = open ? primaryDiff(open.items) : null;
  const focus = head.objects.find((o) => o.id === active);
  const intro = useIntro();
  const openTone =
    openStatus?.kind === "removed"
      ? { bg: "bg-miss-tint", text: "text-miss-deep", btn: "bg-miss text-ink" }
      : openStatus?.kind === "moved"
        ? { bg: "bg-move-tint", text: "text-move-deep", btn: "bg-move text-ink" }
        : openStatus?.kind === "added"
          ? { bg: "bg-new-tint", text: "text-new-deep", btn: "bg-new text-paper" }
          : { bg: "bg-card", text: "", btn: "bg-paper" };
  const openLabel = !openStatus
    ? "All in place"
    : openStatus.kind === "removed"
      ? `${plural(openStatus.count, "thing")} missing`
      : openStatus.kind === "moved"
        ? `${openStatus.count} moved`
        : `${openStatus.count} new`;

  return (
    <main className="min-h-dvh bg-paper pb-36">
      <div className="pt-safe relative px-2">
        <div className="relative">
          <Shared name={`space-${space.id}`}>
            <ScenePhoto
              src={head.image}
              width={head.width}
              height={head.height}
              aspect={4 / 5}
              className="rounded-[34px]"
              pins={head.objects.map((o) => ({
                id: o.id,
                bbox: o.bbox,
                label: o.label,
                missing: missingIds.has(o.id),
              }))}
              active={active}
              onPick={(id) => setActive((a) => (a === id ? null : id))}
            />
          </Shared>
          <div className="absolute inset-x-2 top-2 flex justify-between">
            <Round href="/" aria-label="Back">
              <Back />
            </Round>
            <Round aria-label="More" onClick={() => setMenu(true)}>
              <More />
            </Round>
          </div>
        </div>
      </div>

      <section className="px-5 pt-6">
        <InlineEdit
          ref={title}
          label="Space name"
          value={space.name}
          onSave={(v) => renameSpace(space.id, v)}
          className="display text-[44px]"
        />
        <p className="mt-2 text-[15px] text-soft">
          {plural(head.objects.length, "item")} · photo from {stamp(head.createdAt)}
        </p>

        {open && (
          <Link
            href={`/spaces/${space.id}/audits/${open.id}`}
            transitionTypes={nav("forward")}
            className={`mt-6 flex items-center gap-4 rounded-[28px] p-4 pl-5 transition-transform duration-300 active:scale-[0.98] active:duration-100 ${openTone.bg} ${intro ? "rise" : ""}`}
          >
            <span className="min-w-0 flex-1">
              <span className={`block text-[18px] font-bold ${openTone.text}`}>
                {openLabel}
              </span>
              <span className="mt-0.5 block truncate text-[14px] text-soft">
                {missing.length ? missing.map((m) => m.label).join(", ") : `Checked ${ago(open.createdAt)}`}
              </span>
            </span>
            <span className={`grid size-11 shrink-0 place-items-center rounded-full ${openTone.btn}`}>
              <Arrow width={18} height={18} />
            </span>
          </Link>
        )}
      </section>

      <section className="mt-10 px-5">
        <h2 className="text-[22px] font-bold tracking-[-0.03em]">Items</h2>
        <ul className="mt-4 grid grid-cols-3 gap-x-4 gap-y-5">
          {head.objects.map((o, i) => (
            <li key={o.id} className={intro ? "rise" : ""} style={{ animationDelay: `${i * 30}ms` }}>
              <button
                type="button"
                onClick={() => setActive(o.id)}
                className="block w-full text-left transition-transform duration-300 active:scale-95 active:duration-100"
              >
                <span className="relative block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.crop} alt="" className="aspect-square w-full rounded-[22px] object-cover" />
                  {missingIds.has(o.id) && (
                    <span className="absolute right-2 top-2 size-3.5 rounded-full bg-miss ring-[3px] ring-white" />
                  )}
                </span>
                <span className="mt-2 line-clamp-2 block text-[14px] font-medium leading-snug">{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
        {head.objects.length === 0 && (
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
          head={head}
          item={focus}
          missingCheck={missingIds.has(focus.id) ? open : undefined}
          onClose={() => setActive(null)}
        />
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
          <Button tone="sunk" className="flex-1" onClick={() => setConfirm(false)}>
            Keep
          </Button>
          <Button tone="miss" className="flex-1" onClick={onDelete}>
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
            <dl className="mt-5 space-y-4 rounded-[20px] bg-paper p-4">
              <div>
                <dt className="text-[13px] font-medium text-mute">Where it lives</dt>
                <dd className="mt-0.5 text-[16px] leading-snug">{item.hint}</dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-mute">Last seen</dt>
                <dd className="mt-0.5 text-[16px]">
                  {stamp(item.seenAt)} <span className="text-soft">· {ago(item.seenAt)}</span>
                </dd>
              </div>
            </dl>
          </div>
          <div className="mt-5 flex gap-2">
            {missingCheck ? (
              <>
                <Button tone="sunk" className="flex-1" onClick={close}>
                  Close
                </Button>
                <Link
                  href={`/spaces/${space.id}/audits/${missingCheck.id}?item=rm-${item.id}`}
                  transitionTypes={nav("forward")}
                  className={buttonClass("ink", "flex-[1.4]")}
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
  const first = space.commits[space.commits.length - 1];
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
