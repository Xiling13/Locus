"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useRef, useState } from "react";
import { Aperture, Arrow, Back, Check, More, Pencil, Trash } from "@/components/icons";
import { ScenePhoto, Spot } from "@/components/Photo";
import {
  Button,
  buttonClass,
  Changes,
  InlineEdit,
  Missing,
  Pill,
  Round,
  Sheet,
  Splash,
  Toggle,
  type InlineEditHandle,
} from "@/components/ui";
import { ago, plural, stamp } from "@/lib/format";
import { headOf, missingOf, openCheck, useHydrated, useLocus, useSpace } from "@/lib/store";
import type { Audit, Commit, LedgerObject, Space } from "@/lib/types";

export default function SpacePage({ params, searchParams }: PageProps<"/spaces/[id]">) {
  const { id } = use(params);
  const { item } = use(searchParams);
  const hydrated = useHydrated();
  const space = useSpace(id);

  if (!hydrated) return <Splash />;
  if (!space) return <Missing />;
  return <SpaceView space={space} initialItem={typeof item === "string" ? item : null} />;
}

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
  const focus = head.objects.find((o) => o.id === active);

  return (
    <main className="min-h-dvh bg-paper pb-36">
      <div className="pt-safe relative px-2">
        <div className="relative">
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
            onPick={setActive}
          />
          <div className="absolute inset-x-3 top-3 flex justify-between">
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
            className={`rise mt-6 flex items-center gap-4 rounded-[26px] p-4 pl-5 transition active:scale-[0.99] ${
              missing.length ? "bg-miss-tint" : "bg-card"
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className={`block text-[18px] font-bold ${missing.length ? "text-miss-deep" : ""}`}>
                {missing.length ? `${plural(missing.length, "thing")} missing` : "Nothing missing"}
              </span>
              <span className="mt-0.5 block truncate text-[14px] text-soft">
                {missing.length ? missing.map((m) => m.label).join(", ") : `Checked ${ago(open.createdAt)}`}
              </span>
            </span>
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-full ${
                missing.length ? "bg-miss text-ink" : "bg-paper"
              }`}
            >
              <Arrow width={18} height={18} />
            </span>
          </Link>
        )}
      </section>

      <section className="mt-10 px-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[22px] font-bold tracking-[-0.03em]">Items</h2>
          <span className="text-[14px] text-mute">{head.objects.length}</span>
        </div>
        <ul className="mt-4 grid grid-cols-3 gap-x-4 gap-y-5">
          {head.objects.map((o, i) => (
            <li key={o.id} className="rise" style={{ animationDelay: `${i * 30}ms` }}>
              <button type="button" onClick={() => setActive(o.id)} className="block w-full text-left transition active:scale-95">
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

      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] bg-gradient-to-t from-paper via-paper/95 to-transparent px-5 pt-10">
        <Link href={`/spaces/${space.id}/check`} className={buttonClass("ink")}>
          <Aperture />
          Check now
        </Link>
      </div>

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
                removeSpace(space.id);
                router.replace("/");
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
            <dl className="mt-5 space-y-4 rounded-[22px] bg-paper p-4">
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
              setTimeout(() => untrackItem(space.id, item.id), 260);
            }}
            className={buttonClass("clear", "mt-1 h-12 text-[15px]")}
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
      <div className="flex items-baseline justify-between">
        <h2 className="text-[22px] font-bold tracking-[-0.03em]">Not tracked</h2>
        <span className="text-[14px] text-mute">{items.length}</span>
      </div>
      <p className="mt-1 text-[14px] text-soft">Checks ignore these. Switch one on to keep an eye on it.</p>
      <ul className="mt-4 overflow-hidden rounded-[28px] bg-card">
        {items.map((o) => (
          <li key={o.id} className="flex items-center gap-3.5 border-b border-paper p-2.5 pr-4 last:border-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.crop} alt="" className="size-12 shrink-0 rounded-[14px] object-cover opacity-50 grayscale" />
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
        {space.audits.map((a) => {
          return (
            <li key={a.id} className="border-b border-paper">
              <Link
                href={`/spaces/${space.id}/audits/${a.id}`}
                className="flex items-center gap-3.5 p-3 pr-4 transition active:bg-paper"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.image} alt="" className="h-14 w-[42px] rounded-[12px] object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[16px] font-semibold">
                    Checked {ago(a.createdAt)}
                    {a.committedAs && <Check width={15} height={15} strokeWidth={2.6} className="text-soft" />}
                  </span>
                  <span className="mt-1 block">
                    <Changes audit={a} />
                  </span>
                </span>
                <Back width={18} height={18} className="rotate-180 text-mute" />
              </Link>
            </li>
          );
        })}
        <li className="flex items-center gap-3.5 p-3 pr-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={first.image} alt="" className="h-14 w-[42px] rounded-[12px] object-cover" />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold">Space created</span>
            <span className="mt-1 block text-[13px] text-soft">
              {stamp(first.createdAt)}
              {head.id !== first.id && " · reference photo updated since"}
            </span>
          </span>
        </li>
      </ol>
      {space.audits.length === 0 && (
        <p className="mt-3 px-1 text-[14px] text-mute">No checks yet.</p>
      )}
    </section>
  );
}
