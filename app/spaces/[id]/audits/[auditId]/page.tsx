"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useRef, useState, type ReactNode } from "react";
import { AuditViewport, type ViewportHandle } from "@/components/AuditViewport";
import { Back, Check } from "@/components/icons";
import { Button, Missing, Round, Splash, buttonClass } from "@/components/ui";
import { recommit } from "@/lib/engine";
import { ago, stamp } from "@/lib/format";
import { direction, region } from "@/lib/geometry";
import { headOf, useHydrated, useLocus, useSpace } from "@/lib/store";
import type { Audit, Commit, DiffItem, DiffKind, Space } from "@/lib/types";

const KINDS: { k: DiffKind; label: string; color: string }[] = [
  { k: "removed", label: "Missing", color: "text-signal" },
  { k: "added", label: "Added", color: "text-mint" },
  { k: "moved", label: "Moved", color: "text-bone" },
];

export default function AuditPage({ params }: PageProps<"/spaces/[id]/audits/[auditId]">) {
  const { id, auditId } = use(params);
  const hydrated = useHydrated();
  const space = useSpace(id);
  const audit = space?.audits.find((a) => a.id === auditId);

  if (!hydrated) return <Splash />;
  if (!space || !audit) return <Missing />;
  const base = space.commits.find((c) => c.id === audit.baseCommitId) ?? headOf(space);
  return <Report space={space} audit={audit} base={base} />;
}

function Report({ space, audit, base }: { space: Space; audit: Audit; base: Commit }) {
  const router = useRouter();
  const resolveItem = useLocus((s) => s.resolveItem);
  const pushCommit = useLocus((s) => s.pushCommit);
  const viewport = useRef<ViewportHandle>(null);
  const [filter, setFilter] = useState<DiffKind | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const order = { removed: 0, added: 1, moved: 2 };
  const items = [...audit.items].sort((a, b) => order[a.kind] - order[b.kind]);
  const visible = filter ? items.filter((i) => i.kind === filter) : items;
  const pending = items.filter(
    (i) => i.kind === "removed" && i.confidence === "occluded" && !i.resolution,
  ).length;

  function select(id: string, from: "list" | "canvas") {
    const next = selected === id ? null : id;
    setSelected(next);
    viewport.current?.focus(next ? (items.find((i) => i.id === id) ?? null) : null);
    if (next && from === "canvas") {
      const item = items.find((i) => i.id === id);
      if (filter && item?.kind !== filter) setFilter(null);
      requestAnimationFrame(() =>
        document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      );
    }
  }

  async function commitNew() {
    setSaving(true);
    const c = await recommit(base, audit);
    pushCommit(space.id, c, audit.id);
    router.push(`/spaces/${space.id}`);
  }

  return (
    <main className="flex h-dvh flex-col">
      <div className="relative h-[54dvh] shrink-0">
        <AuditViewport
          ref={viewport}
          current={audit.image}
          base={base.image}
          aspect={audit.width / audit.height}
          items={items}
          selected={selected}
          onSelect={(id) => select(id, "canvas")}
        />
        <div className="pt-safe absolute left-3 top-0">
          <Round href={`/spaces/${space.id}`} aria-label="Back">
            <Back />
          </Round>
        </div>
      </div>

      <section className="no-scrollbar flex-1 overflow-y-auto overscroll-contain">
        <div className="px-5 pt-5">
          <div className="mono flex items-baseline gap-3 text-[11px] text-ash">
            <span className="text-bone">{space.name}</span>
            <span>{ago(audit.createdAt)}</span>
            <span>
              {base.id} → {audit.id}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {KINDS.map(({ k, label, color }) => {
              const n = items.filter((i) => i.kind === k).length;
              const on = filter === k;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={n === 0}
                  onClick={() => setFilter(on ? null : k)}
                  className={`rounded-[22px] px-4 pb-3 pt-4 text-left transition ${
                    on ? "bg-ink-3" : "bg-ink-2"
                  } disabled:opacity-40`}
                >
                  <span className={`display block text-[52px] ${n ? color : "text-ash"}`}>{n}</span>
                  <span className="mono mt-1 block text-[11px] text-ash">{label}</span>
                </button>
              );
            })}
          </div>
          <p className="mono mt-3 text-[11px] text-ash">{audit.unchanged} others in place</p>
        </div>

        {items.length === 0 ? (
          <div className="px-5 pt-10">
            <p className="display text-[44px]">Nothing missing</p>
          </div>
        ) : (
          <ul className="mt-5 space-y-2 px-3">
            {visible.map((i) => (
              <Row
                key={i.id}
                item={i}
                base={base}
                open={selected === i.id}
                onToggle={() => select(i.id, "list")}
                onResolve={(r) => resolveItem(space.id, audit.id, i.id, r)}
              />
            ))}
          </ul>
        )}

        <div className="pb-safe px-5 pt-12">
          {audit.committedAs ? (
            <Link href={`/spaces/${space.id}`} className={buttonClass("ink")}>
              <Check />
              Committed as {audit.committedAs}
            </Link>
          ) : (
            <>
              <p className="display text-[30px]">All checked?</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ash">
                {pending
                  ? `${pending} occluded ${pending === 1 ? "spot still needs" : "spots still need"} a look. Committing makes this photo the reference for the next audit.`
                  : "Committing makes this photo the reference for the next audit."}
              </p>
              <Button tone="bone" className="mt-5" disabled={saving} onClick={commitNew}>
                {saving ? "Committing…" : "Commit as new baseline"}
              </Button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function Row({
  item,
  base,
  open,
  onToggle,
  onResolve,
}: {
  item: DiffItem;
  base: Commit;
  open: boolean;
  onToggle: () => void;
  onResolve: (r: DiffItem["resolution"]) => void;
}) {
  const ledger = item.objectId ? base.objects.find((o) => o.id === item.objectId) : undefined;
  const occluded = item.confidence === "occluded";

  let status: ReactNode;
  if (item.kind === "removed") {
    status =
      item.resolution === "found" ? (
        <span className="text-mint">Found</span>
      ) : item.resolution === "missing" ? (
        <span className="text-signal">Marked missing</span>
      ) : occluded ? (
        <span className="text-signal">Occluded · review</span>
      ) : (
        <span className="text-signal">Confirmed missing</span>
      );
  } else if (item.kind === "moved") {
    const { dir } = direction(item.from!, item.to!);
    status = <span>Moved {dir}</span>;
  } else {
    status = <span className="text-mint">{region(item.to!)}</span>;
  }

  return (
    <li id={`row-${item.id}`} className={`rounded-[24px] transition-colors ${open ? "bg-ink-2" : ""}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-4 p-2 pr-4 text-left">
        <span className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.crop}
            alt=""
            className={`size-16 rounded-[16px] object-cover ${item.resolution === "found" ? "opacity-40" : ""}`}
          />
          <span
            className={`absolute -right-1 -top-1 size-3.5 rounded-full ring-[3px] ${open ? "ring-ink-2" : "ring-ink"} ${
              item.kind === "removed" ? "bg-signal" : item.kind === "added" ? "bg-mint" : "bg-bone"
            }`}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold">{item.label}</span>
          <span className="mono mt-1 block text-[11px] text-ash">{status}</span>
        </span>
      </button>

      {open && (
        <div className="rise px-4 pb-5 pt-2">
          {item.kind === "removed" && ledger && (
            <LastSeen item={item} ledger={ledger} base={base} onResolve={onResolve} />
          )}
          {item.kind === "moved" && <Moved item={item} />}
          {item.kind === "added" && (
            <p className="text-[15px] leading-relaxed text-bone/85">
              Not in the baseline. If it belongs here, it’ll be added to the ledger when you commit.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function LastSeen({
  item,
  ledger,
  base,
  onResolve,
}: {
  item: DiffItem;
  ledger: Commit["objects"][number];
  base: Commit;
  onResolve: (r: DiffItem["resolution"]) => void;
}) {
  const occluded = item.confidence === "occluded";
  return (
    <>
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ledger.crop} alt="" className="size-32 shrink-0 rounded-[18px] object-cover" />
        <div className="mono flex min-w-0 flex-col justify-end gap-1.5 text-[11px]">
          <span className="text-ash">Last seen</span>
          <span className="text-[13px] text-bone">{stamp(ledger.seenAt)}</span>
          <span className="text-ash">commit {base.id}</span>
          <span className="truncate text-ash">{ledger.traits.join(" · ")}</span>
        </div>
      </div>
      <p className="mt-4 text-[17px] leading-relaxed">{ledger.hint}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-ash">
        {occluded
          ? `The ${item.occludedBy?.toLowerCase()} is covering this spot, so it may still be underneath. Take a look.`
          : "Its spot is empty."}
      </p>
      {!item.resolution ? (
        <div className="mt-5 flex gap-2">
          <Button tone="bone" className="h-12 flex-1 text-[15px]" onClick={() => onResolve("found")}>
            Found it
          </Button>
          {occluded && (
            <Button className="h-12 flex-1 text-[15px]" onClick={() => onResolve("missing")}>
              It’s gone
            </Button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onResolve(undefined)}
          className="mono mt-4 text-[11px] text-ash underline-offset-4 active:underline"
        >
          Undo
        </button>
      )}
    </>
  );
}

function Moved({ item }: { item: DiffItem }) {
  const { dist } = direction(item.from!, item.to!);
  return (
    <div className="mono grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12px]">
      <span className="text-ash">From</span>
      <span>{region(item.from!)}</span>
      <span className="text-ash">To</span>
      <span>{region(item.to!)}</span>
      <span className="text-ash">Shift</span>
      <span>{Math.round(dist * 100)}% of frame</span>
    </div>
  );
}
