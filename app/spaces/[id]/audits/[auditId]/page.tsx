"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState, type ReactNode } from "react";
import { AuditViewport, type ViewportHandle } from "@/components/AuditViewport";
import { Back, Check, Chevron } from "@/components/icons";
import { Button, buttonClass, Missing, Round, Splash, Toggle } from "@/components/ui";
import { recommit } from "@/lib/engine";
import { ago, plural, stamp } from "@/lib/format";
import { direction, region } from "@/lib/geometry";
import { FRAME } from "@/lib/image";
import { headOf, useHydrated, useLocus, useSpace } from "@/lib/store";
import type { Audit, Commit, DiffItem, DiffKind, Space } from "@/lib/types";

const KINDS: { k: DiffKind; label: string; dot: string; on: string }[] = [
  { k: "removed", label: "Missing", dot: "bg-miss", on: "bg-miss-tint text-miss-deep" },
  { k: "added", label: "New", dot: "bg-new", on: "bg-new-tint text-new-deep" },
  { k: "moved", label: "Moved", dot: "bg-move", on: "bg-move-tint text-move-deep" },
];

export default function AuditPage({ params, searchParams }: PageProps<"/spaces/[id]/audits/[auditId]">) {
  const { id, auditId } = use(params);
  const { item } = use(searchParams);
  const hydrated = useHydrated();
  const space = useSpace(id);
  const audit = space?.audits.find((a) => a.id === auditId);

  if (!hydrated) return <Splash />;
  if (!space || !audit) return <Missing />;
  const base = space.commits.find((c) => c.id === audit.baseCommitId) ?? headOf(space);
  return <Report space={space} audit={audit} base={base} initial={typeof item === "string" ? item : null} />;
}

function Report({
  space,
  audit,
  base,
  initial,
}: {
  space: Space;
  audit: Audit;
  base: Commit;
  initial: string | null;
}) {
  const router = useRouter();
  const resolveItem = useLocus((s) => s.resolveItem);
  const pushCommit = useLocus((s) => s.pushCommit);
  const viewport = useRef<ViewportHandle>(null);
  const [filter, setFilter] = useState<DiffKind | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [skip, setSkip] = useState<Set<string>>(new Set());

  const order = { removed: 0, added: 1, moved: 2 };
  const items = [...audit.items].sort((a, b) => order[a.kind] - order[b.kind]);
  const visible = filter ? items.filter((i) => i.kind === filter) : items;
  const pending = items.filter(
    (i) => i.kind === "removed" && i.confidence === "occluded" && !i.resolution,
  ).length;

  function select(id: string | null, from: "list" | "canvas") {
    const next = id === null || selected === id ? null : id;
    setSelected(next);
    const item = items.find((i) => i.id === next) ?? null;
    viewport.current?.focus(item);
    if (item && from === "canvas") {
      if (filter && item.kind !== filter) setFilter(null);
      requestAnimationFrame(() =>
        document.getElementById(`row-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      );
    }
  }

  useEffect(() => {
    if (!initial || !audit.items.some((i) => i.id === initial)) return;
    const t = setTimeout(() => select(initial, "canvas"), 450);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true);
    const { commit, untracked } = await recommit(base, audit, skip);
    pushCommit(space.id, commit, audit.id, untracked);
    router.push(`/spaces/${space.id}`);
  }

  return (
    <main className="flex h-dvh flex-col bg-paper">
      <div
        className="relative shrink-0 overflow-hidden rounded-b-[34px]"
        style={{ height: `min(calc(min(100vw, 480px) / ${FRAME}), 56dvh)` }}
      >
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
        <div className="px-5 pt-6">
          <p className="text-[14px] font-medium text-soft">
            {space.name} · checked {ago(audit.createdAt)}
          </p>
          <h1 className="display mt-1.5 text-[38px]">
            {items.length === 0
              ? "Nothing changed"
              : items.some((i) => i.kind === "removed" && i.resolution !== "found")
                ? `${plural(items.filter((i) => i.kind === "removed" && i.resolution !== "found").length, "thing")} missing`
                : "Nothing missing"}
          </h1>

          {items.length > 0 && (
            <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5">
              <Chip on={filter === null} onClick={() => setFilter(null)} className="bg-ink text-paper">
                All {items.length}
              </Chip>
              {KINDS.map(({ k, label, dot, on }) => {
                const n = items.filter((i) => i.kind === k).length;
                if (!n) return null;
                return (
                  <Chip key={k} on={filter === k} onClick={() => setFilter(filter === k ? null : k)} className={on}>
                    <span className={`size-2 rounded-full ${dot}`} />
                    {label} {n}
                  </Chip>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-[13px] text-mute">{plural(audit.unchanged, "other thing")} right where they were</p>
        </div>

        <ul className="mt-4 space-y-2 px-3">
          {visible.map((i) => (
            <Row
              key={i.id}
              item={i}
              base={base}
              open={selected === i.id}
              onToggle={() => select(i.id, "list")}
              onResolve={(r) => resolveItem(space.id, audit.id, i.id, r)}
              track={
                i.kind === "added" && !audit.committedAs
                  ? {
                      on: !skip.has(i.detectionId!),
                      toggle: () =>
                        setSkip((s) => {
                          const n = new Set(s);
                          if (!n.delete(i.detectionId!)) n.add(i.detectionId!);
                          return n;
                        }),
                    }
                  : undefined
              }
            />
          ))}
        </ul>

        <div className="pb-safe px-3 pt-8">
          {audit.committedAs ? (
            <div className="flex items-center gap-3 rounded-[26px] bg-card p-5">
              <span className="grid size-9 place-items-center rounded-full bg-ink text-paper">
                <Check width={18} height={18} strokeWidth={2.6} />
              </span>
              <span className="text-[15px] font-medium">Saved as your reference photo</span>
            </div>
          ) : (
            <div className="rounded-[30px] bg-card p-5">
              <p className="text-[22px] font-bold tracking-[-0.03em]">Done checking?</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-soft">
                {pending ? `${plural(pending, "spot")} still ${pending === 1 ? "needs" : "need"} a look. ` : ""}
                Save this photo and your next check will compare against it.
              </p>
              <Button className="mt-5" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save as new reference"}
              </Button>
            </div>
          )}
          <Link href={`/spaces/${space.id}`} className={buttonClass("clear", "mt-2")}>
            Back to {space.name}
          </Link>
        </div>
      </section>
    </main>
  );
}

function Chip({
  on,
  onClick,
  className,
  children,
}: {
  on: boolean;
  onClick: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition ${
        on ? className : "bg-card text-soft"
      }`}
    >
      {children}
    </button>
  );
}

function statusOf(item: DiffItem) {
  if (item.kind === "removed") {
    if (item.resolution === "found") return { text: "Found", cls: "text-soft" };
    if (item.resolution === "missing") return { text: "Gone", cls: "text-miss-deep" };
    if (item.confidence === "occluded") return { text: "Maybe hidden · take a look", cls: "text-miss-deep" };
    return { text: "Missing", cls: "text-miss-deep" };
  }
  if (item.kind === "moved") return { text: `Moved ${direction(item.from!, item.to!).dir}`, cls: "text-move-deep" };
  return { text: "New here", cls: "text-new-deep" };
}

function Row({
  item,
  base,
  open,
  onToggle,
  onResolve,
  track,
}: {
  item: DiffItem;
  base: Commit;
  open: boolean;
  onToggle: () => void;
  onResolve: (r: DiffItem["resolution"]) => void;
  track?: { on: boolean; toggle: () => void };
}) {
  const ledger = item.objectId ? base.objects.find((o) => o.id === item.objectId) : undefined;
  const status = track && !track.on ? { text: "Won’t be tracked", cls: "text-soft" } : statusOf(item);
  const dot = item.kind === "removed" ? "bg-miss" : item.kind === "added" ? "bg-new" : "bg-move";

  return (
    <li id={`row-${item.id}`} className="overflow-hidden rounded-[26px] bg-card">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3.5 p-2.5 pr-4 text-left">
        <span className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.crop}
            alt=""
            className={`size-14 rounded-[18px] object-cover ${item.resolution === "found" ? "opacity-40" : ""}`}
          />
          <span className={`absolute -right-0.5 -top-0.5 size-3.5 rounded-full ring-[3px] ring-card ${dot}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold">{item.label}</span>
          <span className={`mt-0.5 block truncate text-[13px] font-medium ${status.cls}`}>{status.text}</span>
        </span>
        <Chevron
          width={20}
          height={20}
          className={`shrink-0 text-mute transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-400 ease-[var(--ease-out-expo)]"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-4 pt-1">
            {item.kind === "removed" && ledger && <MissingDetail item={item} ledger={ledger} onResolve={onResolve} />}
            {item.kind === "moved" && <MovedDetail item={item} hint={ledger?.hint} />}
            {item.kind === "added" && (
              <p className="rounded-[18px] bg-paper p-4 text-[15px] leading-relaxed text-soft">
                Wasn’t here last time — now at the {region(item.to!)}.
                {track && (track.on ? " Save this check and it becomes one of your items." : " Checks will ignore it.")}
              </p>
            )}
            {track && (
              <div className="mt-3 flex items-center justify-between gap-3 px-1">
                <span className="text-[15px] font-semibold">Keep track of it</span>
                <Toggle on={track.on} label={`Keep track of ${item.label}`} onChange={track.toggle} />
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="space-y-3 rounded-[18px] bg-paper p-4">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[13px] font-medium text-mute">{k}</dt>
          <dd className="mt-0.5 text-[15px] leading-snug">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function MissingDetail({
  item,
  ledger,
  onResolve,
}: {
  item: DiffItem;
  ledger: Commit["objects"][number];
  onResolve: (r: DiffItem["resolution"]) => void;
}) {
  const occluded = item.confidence === "occluded";
  return (
    <>
      <Facts
        rows={[
          ["Where it was", ledger.hint],
          ["Last seen", `${stamp(ledger.seenAt)} · ${ago(ledger.seenAt)}`],
        ]}
      />
      {occluded && (
        <p className="mt-3 px-1 text-[14px] leading-relaxed text-soft">
          The {item.occludedBy?.toLowerCase()} is sitting on this spot, so it may just be underneath.
        </p>
      )}
      {!item.resolution ? (
        <div className="mt-4 flex gap-2">
          <Button tone="sunk" className="h-13 flex-1 text-[16px]" onClick={() => onResolve("found")}>
            Found it
          </Button>
          {occluded && (
            <Button tone="miss" className="h-13 flex-1 text-[16px]" onClick={() => onResolve("missing")}>
              It’s gone
            </Button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onResolve(undefined)}
          className="mt-3 h-10 px-1 text-[14px] font-semibold text-soft active:text-ink"
        >
          Undo
        </button>
      )}
    </>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function MovedDetail({ item, hint }: { item: DiffItem; hint?: string }) {
  return (
    <Facts
      rows={[
        ["Was", cap(region(item.from!))],
        ["Now", cap(region(item.to!))],
        ...(hint ? ([["Usually", hint]] as [string, string][]) : []),
      ]}
    />
  );
}
