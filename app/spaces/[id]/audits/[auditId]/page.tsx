"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState, type ReactNode } from "react";
import { AuditViewport, type ViewportHandle } from "@/components/AuditViewport";
import { Back, Check, Chevron } from "@/components/icons";
import { Button, Chip, Missing, nav, Round, Screen, Shared, Sheet, Splash, Thumb, Toggle } from "@/components/ui";
import { recommit } from "@/lib/engine";
import { ago, plural, stamp } from "@/lib/format";
import { direction, region } from "@/lib/geometry";
import { FRAME } from "@/lib/image";
import { deletionOf, headOf, KIND_ORDER, primaryDiff, useHydrated, useLocus, useSpace } from "@/lib/store";
import type { Audit, Commit, DiffItem, DiffKind, Space } from "@/lib/types";

const KINDS: { k: DiffKind; label: string; dot: string; on: string }[] = [
  { k: "removed", label: "Missing", dot: "bg-miss", on: "bg-miss-tint text-miss-deep" },
  { k: "moved", label: "Moved", dot: "bg-move", on: "bg-move-tint text-move-deep" },
  { k: "added", label: "New", dot: "bg-new", on: "bg-new-tint text-new-deep" },
];

export default function AuditPage({ params, searchParams }: PageProps<"/spaces/[id]/audits/[auditId]">) {
  const { id, auditId } = use(params);
  const { item } = use(searchParams);
  const hydrated = useHydrated();
  const liveSpace = useSpace(id);
  const live = liveSpace?.audits.find((a) => a.id === auditId);
  // Keep drawing the report while we navigate away from deleting it.
  const [kept, setKept] = useState(liveSpace);
  if (liveSpace && live && liveSpace !== kept) setKept(liveSpace);
  const space = live ? liveSpace : leaving === auditId ? kept : undefined;
  const audit = space?.audits.find((a) => a.id === auditId);
  const shown =
    space && audit
      ? { space, audit, base: space.commits.find((c) => c.id === audit.baseCommitId) ?? headOf(space) }
      : undefined;

  if (!hydrated) return <Splash />;
  if (!shown) return <Missing />;
  return (
    <Screen>
      <Report {...shown} initial={typeof item === "string" ? item : null} />
    </Screen>
  );
}

let leaving: string | null = null;

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
  const untrackItem = useLocus((s) => s.untrackItem);
  const pushCommit = useLocus((s) => s.pushCommit);
  const viewport = useRef<ViewportHandle>(null);
  const [filter, setFilter] = useState<DiffKind | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [leavePrompt, setLeavePrompt] = useState(false);
  const deleteCheck = useLocus((s) => s.deleteCheck);

  const items = [...audit.items].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  const status = primaryDiff(items);
  const headline = !status
    ? "All in place"
    : status.kind === "removed"
      ? `${plural(status.count, "item")} missing`
      : status.kind === "moved"
        ? `${status.count} moved`
        : `${status.count} new`;
  const visible = filter ? items.filter((i) => i.kind === filter) : items;
  const pending = items.filter(
    (i) => i.kind === "removed" && i.confidence === "occluded" && !i.resolution,
  ).length;

  function revealRow(id: string, fully: boolean) {
    const row = document.getElementById(`row-${id}`);
    const sheet = row?.closest<HTMLElement>("section");
    if (!row || !sheet) return;
    const pad = 12;
    const rowRect = row.getBoundingClientRect();
    const sheetRect = sheet.getBoundingClientRect();
    if (!fully) {
      // Pin the card near the top of the sheet so its expanded body has room below.
      sheet.scrollTo({ top: sheet.scrollTop + (rowRect.top - sheetRect.top) - pad, behavior: "smooth" });
      return;
    }
    if (rowRect.bottom <= sheetRect.bottom - pad && rowRect.top >= sheetRect.top + pad) return;
    if (rowRect.top < sheetRect.top + pad) {
      sheet.scrollBy({ top: rowRect.top - sheetRect.top - pad, behavior: "smooth" });
      return;
    }
    // Expanded body spilled past the fold — scroll just enough, without hiding the header.
    const overflow = rowRect.bottom - sheetRect.bottom + pad;
    const room = rowRect.top - sheetRect.top - pad;
    sheet.scrollBy({ top: Math.min(overflow, Math.max(0, room)), behavior: "smooth" });
  }

  function select(id: string | null, from: "list" | "canvas") {
    const next = id === null || selected === id ? null : id;
    setSelected(next);
    const item = items.find((i) => i.id === next) ?? null;
    viewport.current?.focus(item);
    if (item && from === "canvas") {
      if (filter && item.kind !== filter) setFilter(null);
      // After paint / filter clear, pin the row; after expand animation, keep the body in view.
      window.setTimeout(() => revealRow(item.id, false), 50);
      window.setTimeout(() => revealRow(item.id, true), 460);
    }
  }

  useEffect(() => {
    if (!initial || !audit.items.some((i) => i.id === initial)) return;
    const t = setTimeout(() => select(initial, "canvas"), 450);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function goBack() {
    router.push(`/spaces/${space.id}`, { transitionTypes: nav("back") });
  }

  function requestBack() {
    if (audit.committedAs) goBack();
    else setLeavePrompt(true);
  }

  async function save() {
    if (audit.committedAs || saving) return;
    setSaving(true);
    try {
      const { commit, untracked } = await recommit(base, audit, skip);
      pushCommit(space.id, commit, audit.id, untracked);
      goBack();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  function remove() {
    leaving = audit.id;
    deleteCheck(space.id, audit.id);
    router.replace(`/spaces/${space.id}`, { transitionTypes: nav("back") });
  }

  return (
    <main className="flex h-svh max-h-svh flex-col bg-paper">
      <div
        className="audit-hero relative shrink-0 overflow-hidden rounded-b-[34px]"
        style={{ height: `min(calc(min(100vw, 480px) / ${FRAME}), 56dvh)` }}
      >
        <Shared name="shot">
          <div className="size-full">
            <AuditViewport
              ref={viewport}
              current={audit.image}
              base={base.image}
              aspect={audit.width / audit.height}
              items={items}
              selected={selected}
              onSelect={(id) => select(id, "canvas")}
            />
          </div>
        </Shared>
        <div className="pt-safe absolute left-4 top-0">
          <Round aria-label="Back" onClick={requestBack}>
            <Back />
          </Round>
        </div>
      </div>

      <section className="no-scrollbar flex-1 overflow-y-auto overscroll-contain">
        <div className="px-5 pt-6">
          <p className="text-[14px] font-medium text-soft">
            {space.name} · checked {ago(audit.createdAt)}
          </p>
          <h1 className="audit-headline display mt-1.5 text-[38px]">{headline}</h1>

          {items.length > 0 && (
            <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5">
              <Chip on={filter === null} onClick={() => setFilter(null)}>
                All {items.length}
              </Chip>
              {KINDS.map(({ k, label, dot, on }) => {
                const n = items.filter((i) => i.kind === k).length;
                if (!n) return null;
                return (
                  <Chip key={k} on={filter === k} onClick={() => setFilter(filter === k ? null : k)} onClass={on}>
                    <span className={`size-2 rounded-full ${dot}`} />
                    {label} {n}
                  </Chip>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-[13px] text-mute">{plural(audit.unchanged, "item")} right in place</p>
        </div>

        <ul className="mt-4 space-y-2 px-4">
          {visible.map((i) => (
            <Row
              key={i.id}
              item={i}
              base={base}
              open={selected === i.id}
              onToggle={() => select(i.id, "list")}
              onResolve={(r) => resolveItem(space.id, audit.id, i.id, r)}
              onUntrack={
                i.kind === "removed" && i.objectId
                  ? () => {
                      select(null, "list");
                      untrackItem(space.id, i.objectId!);
                    }
                  : undefined
              }
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

        <div className="pb-safe px-4 pt-8">
          {audit.committedAs ? (
            <div className="flex items-center gap-3.5 rounded-[28px] bg-card p-4 pl-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-paper">
                <Check width={18} height={18} strokeWidth={2.6} />
              </span>
              <span className="text-[15px] font-medium">
                {audit.committedAs === space.headId ? "This is your current photo" : "Saved as current earlier"}
              </span>
            </div>
          ) : (
            <div className="rounded-[28px] bg-card p-5">
              <p className="text-[22px] font-bold tracking-[-0.03em]">Done checking?</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-soft">
                {pending ? `${plural(pending, "spot")} still ${pending === 1 ? "needs" : "need"} a look. ` : ""}
                Save this photo and your next check will compare against it.
              </p>
              <Button className="mt-5" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save as new current"}
              </Button>
            </div>
          )}
          <Button
            tone="clear"
            className="mt-2 text-miss-deep/80 active:text-miss-deep"
            onClick={() => setConfirm(true)}
          >
            Delete this check
          </Button>
        </div>
      </section>

      {confirm && (
        <Sheet label="Delete check" onClose={() => setConfirm(false)}>
          {(close) => <DeleteCheck space={space} audit={audit} onKeep={close} onDelete={remove} />}
        </Sheet>
      )}

      {leavePrompt && !audit.committedAs && (
        <Sheet label="Save as current" onClose={() => setLeavePrompt(false)}>
          {(close) => (
            <div className="sheet-body px-5 pb-3 pt-2">
              <p className="sheet-title display text-[30px]">Save as current?</p>
              <p className="mt-2 text-[15px] leading-relaxed text-soft">
                Next check will still use your older photo unless you save the new image.
              </p>
              <div className="sheet-actions mt-6 flex gap-2">
                <Button
                  tone="sunk"
                  className="min-w-0 flex-1 basis-0"
                  onClick={() => {
                    close();
                    goBack();
                  }}
                >
                  Leave
                </Button>
                <Button className="min-w-0 flex-1 basis-0" disabled={saving} onClick={() => void save()}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </Sheet>
      )}
    </main>
  );
}

function DeleteCheck({
  space,
  audit,
  onKeep,
  onDelete,
}: {
  space: Space;
  audit: Audit;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const { drop, previous } = deletionOf(space, audit.id);
  const later = drop.length - 1;
  return (
    <div className="sheet-body px-5 pb-3 pt-2">
      <p className="sheet-title display text-[30px]">Delete this check?</p>
      <p className="mt-2 text-[15px] leading-relaxed text-soft">
        {previous
          ? `Its photo is your current photo right now. Deleting it brings back the current from ${stamp(previous.createdAt)}.`
          : audit.committedAs
            ? "It comes out of your history. Your current photo stays the same."
            : "It comes out of your history. Nothing else changes."}
        {later > 0 && ` The ${plural(later, "newer check")} compared against it will go too.`}
      </p>
      <div className="sheet-actions mt-6 flex gap-2">
        <Button tone="sunk" className="min-w-0 flex-1 basis-0" onClick={onKeep}>
          Keep
        </Button>
        <Button tone="miss" className="min-w-0 flex-1 basis-0" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}

function statusOf(item: DiffItem) {
  if (item.kind === "removed") {
    if (item.resolution === "found") return { text: "Found", cls: "text-soft" };
    if (item.resolution === "missing") return { text: "Gone", cls: "text-miss-deep" };
    if (item.confidence === "occluded") return { text: "Maybe hidden", cls: "text-miss-deep" };
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
  onUntrack,
  track,
}: {
  item: DiffItem;
  base: Commit;
  open: boolean;
  onToggle: () => void;
  onResolve: (r: DiffItem["resolution"]) => void;
  onUntrack?: () => void;
  track?: { on: boolean; toggle: () => void };
}) {
  const ledger = item.objectId ? base.objects.find((o) => o.id === item.objectId) : undefined;
  const status = track && !track.on ? { text: "Won’t be tracked", cls: "text-soft" } : statusOf(item);
  const dot = item.kind === "removed" ? "bg-miss" : item.kind === "added" ? "bg-new" : "bg-move";

  return (
    <li
      id={`row-${item.id}`}
      className={`overflow-hidden rounded-[28px] bg-card transition-shadow duration-300 ${
        open ? "shadow-[0_10px_30px_-14px_rgb(0_0_0/0.22)]" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 p-2.5 pr-4 text-left transition-colors active:bg-paper/60"
      >
        <span className="relative shrink-0">
          <Thumb src={item.crop} className={`transition-opacity ${item.resolution === "found" ? "opacity-40" : ""}`} />
          <span className={`absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-card ${dot}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold">{item.label}</span>
          <span className={`mt-0.5 block truncate text-[13px] font-medium ${status.cls}`}>{status.text}</span>
        </span>
        <Chevron
          width={20}
          height={20}
          className={`shrink-0 text-mute transition-transform duration-400 ease-[var(--ease-glide)] ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-400 ease-[var(--ease-glide)]"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div
          className={`min-h-0 overflow-hidden transition-opacity duration-300 ${open ? "opacity-100 delay-75" : "opacity-0"}`}
          inert={!open}
        >
          <div className="px-4 pb-4 pt-1">
            {item.kind === "removed" && ledger && (
              <MissingDetail item={item} ledger={ledger} onResolve={onResolve} onUntrack={onUntrack} />
            )}
            {item.kind === "moved" && <MovedDetail item={item} hint={ledger?.hint} />}
            {item.kind === "added" && (
              <p className="rounded-[20px] bg-paper p-4 text-[15px] leading-relaxed text-soft">
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
  const [primary, ...rest] = rows;
  return (
    <dl className="rounded-[20px] bg-paper p-4">
      {primary && (
        <div>
          <dt className="text-[12px] font-medium uppercase tracking-[0.04em] text-mute">{primary[0]}</dt>
          <dd className="mt-1.5 text-[16px] font-semibold leading-snug tracking-[-0.01em]">{primary[1]}</dd>
        </div>
      )}
      {rest.map(([k, v]) => (
        <div key={k} className="mt-4 border-t border-line/60 pt-3">
          <dt className="text-[12px] font-medium uppercase tracking-[0.04em] text-mute">{k}</dt>
          <dd className="mt-1 text-[14px] leading-snug text-soft">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function MissingDetail({
  item,
  ledger,
  onResolve,
  onUntrack,
}: {
  item: DiffItem;
  ledger: Commit["objects"][number];
  onResolve: (r: DiffItem["resolution"]) => void;
  onUntrack?: () => void;
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
          <Button tone="sunk" size="md" className="min-w-0 flex-1 basis-0" onClick={() => onResolve("found")}>
            Found it
          </Button>
          <Button tone="miss" size="md" className="min-w-0 flex-1 basis-0" onClick={() => onResolve("missing")}>
            It’s gone
          </Button>
        </div>
      ) : (
        <Button tone="clear" size="md" className="mt-2" onClick={() => onResolve(undefined)}>
          Undo
        </Button>
      )}
      {onUntrack && (
        <Button tone="clear" size="md" className="mt-1" onClick={onUntrack}>
          Stop tracking
        </Button>
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
        ["Current", cap(region(item.to!))],
        ...(hint ? ([["Before", hint]] as [string, string][]) : []),
      ]}
    />
  );
}
