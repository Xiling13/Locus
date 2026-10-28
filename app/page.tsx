"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Plus } from "@/components/icons";
import { Splash } from "@/components/ui";
import { ago } from "@/lib/format";
import { ensureDemo, headOf, useHydrated, useLocus } from "@/lib/store";
import type { Space } from "@/lib/types";

const openMissing = (s: Space) =>
  s.audits[0] && !s.audits[0].committedAs
    ? s.audits[0].items.filter((i) => i.kind === "removed" && i.resolution !== "found").length
    : 0;

export default function Home() {
  const hydrated = useHydrated();
  const spaces = useLocus((s) => s.spaces);
  const seeded = useLocus((s) => s.seeded);

  useEffect(() => {
    if (hydrated && !seeded) ensureDemo();
  }, [hydrated, seeded]);

  if (!hydrated || !seeded) return <Splash />;

  const missing = spaces.reduce((n, s) => n + openMissing(s), 0);
  const audited = spaces.some((s) => s.audits.length);

  return (
    <main className="pt-safe px-5 pb-12">
      <header className="flex items-center justify-between pt-2">
        <span className="mono text-[11px] uppercase tracking-[0.3em] text-ash">Locus</span>
        <span className="mono text-[11px] text-ash">{spaces.length} {spaces.length === 1 ? "space" : "spaces"}</span>
      </header>

      <h1 className="display rise mt-10 text-[64px]">
        {missing > 0 ? (
          <>
            <span className="text-signal">{missing}</span> {missing === 1 ? "item" : "items"}
            <br />
            out of place
          </>
        ) : audited ? (
          <>
            Everything
            <br />
            in its place
          </>
        ) : (
          <>
            Commit your
            <br />
            first space
          </>
        )}
      </h1>

      <div className="mt-10 space-y-4">
        {spaces.map((s, i) => (
          <SpaceCard key={s.id} space={s} index={i} />
        ))}
        <Link
          href="/spaces/new"
          className="rise flex h-28 items-center justify-between rounded-[28px] bg-ink-2 px-7 transition active:scale-[0.98]"
          style={{ animationDelay: `${spaces.length * 80 + 120}ms` }}
        >
          <span className="display text-[34px]">New space</span>
          <span className="grid size-12 place-items-center rounded-full bg-bone text-ink">
            <Plus />
          </span>
        </Link>
      </div>
    </main>
  );
}

function SpaceCard({ space, index }: { space: Space; index: number }) {
  const head = headOf(space);
  const last = space.audits[0];
  const missing = openMissing(space);

  return (
    <Link
      href={`/spaces/${space.id}`}
      className="rise relative block aspect-[4/5] overflow-hidden rounded-[28px] bg-ink-2 transition active:scale-[0.98]"
      style={{ animationDelay: `${index * 80 + 80}ms` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={last?.image ?? head.image} alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />

      {missing > 0 ? (
        <span className="mono absolute right-4 top-4 rounded-full bg-signal px-3 py-1.5 text-[11px] font-semibold text-ink">
          {missing} missing
        </span>
      ) : !last ? (
        <span className="mono absolute right-4 top-4 rounded-full bg-ink/60 px-3 py-1.5 text-[11px] text-bone backdrop-blur-md">
          Not audited
        </span>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 p-6">
        <div className="display text-[52px]">{space.name}</div>
        <div className="mono mt-3 flex gap-3 text-[11px] text-bone/70">
          <span>{head.id}</span>
          <span>{head.objects.length} items</span>
          <span>{last ? `audited ${ago(last.createdAt)}` : `committed ${ago(head.createdAt)}`}</span>
        </div>
      </div>
    </Link>
  );
}
