"use client";

import Link from "next/link";
import { use, useState } from "react";
import { Aperture, Back } from "@/components/icons";
import { PhotoBoxes } from "@/components/PhotoBoxes";
import { buttonClass, Missing, Round, Splash } from "@/components/ui";
import { ago, stamp } from "@/lib/format";
import { headOf, useHydrated, useSpace } from "@/lib/store";
import type { Audit } from "@/lib/types";

export default function SpacePage({ params }: PageProps<"/spaces/[id]">) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const space = useSpace(id);
  const [active, setActive] = useState<string | null>(null);

  if (!hydrated) return <Splash />;
  if (!space) return <Missing />;

  const head = headOf(space);
  const focus = head.objects.find((o) => o.id === active);

  return (
    <main className="pb-36">
      <div className="relative">
        <PhotoBoxes
          src={head.image}
          width={head.width}
          height={head.height}
          boxes={head.objects.map((o) => ({ id: o.id, bbox: o.bbox }))}
          active={active}
          onPick={(oid) => setActive((a) => (a === oid ? null : oid))}
        />
        <div className="pt-safe absolute left-4 top-0">
          <Round href="/" aria-label="Back">
            <Back />
          </Round>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink to-transparent" />
      </div>

      <section className="relative -mt-14 px-5">
        <h1 className="display text-[64px]">{space.name}</h1>
        <div className="mono mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ash">
          <span className="text-bone">HEAD {head.id}</span>
          <span>{head.objects.length} items</span>
          <span>{stamp(head.createdAt)}</span>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display px-5 text-[26px]">Ledger</h2>
        <div className="no-scrollbar mt-4 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5">
          {head.objects.map((o) => {
            const on = o.id === active;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setActive(on ? null : o.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-[104px] shrink-0 snap-start text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={o.crop}
                  alt=""
                  className={`aspect-square w-full rounded-[18px] object-cover transition ${
                    on ? "ring-2 ring-signal ring-offset-2 ring-offset-ink" : ""
                  }`}
                />
                <span className="mt-2 block truncate text-[13px] font-medium">{o.label}</span>
              </button>
            );
          })}
        </div>
        {focus && (
          <p key={focus.id} className="rise mx-5 mt-5 rounded-[20px] bg-ink-2 p-5 text-[15px] leading-relaxed">
            <span className="font-semibold">{focus.label}</span>
            <span className="text-ash"> · {focus.hint}</span>
          </p>
        )}
      </section>

      <section className="mt-12 px-5">
        <h2 className="display text-[26px]">Audits</h2>
        {space.audits.length === 0 ? (
          <p className="mt-4 text-[15px] leading-relaxed text-ash">
            No audits yet. Snap a photo before you leave and when you’re back — Locus tells you what’s gone.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {space.audits.map((a) => (
              <AuditRow key={a.id} audit={a} href={`/spaces/${space.id}/audits/${a.id}`} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 px-5">
        <h2 className="display text-[26px]">Commits</h2>
        <ol className="mono mt-4 space-y-3 text-[11px]">
          {space.commits.map((c) => (
            <li key={c.id} className="flex items-baseline gap-3">
              <span className={c.id === head.id ? "text-signal" : "text-ash"}>{c.id}</span>
              <span className="min-w-0 flex-1 truncate text-bone">{c.message}</span>
              <span className="text-ash">{stamp(c.createdAt)}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="pb-safe fixed inset-x-0 bottom-0 mx-auto max-w-[480px] bg-gradient-to-t from-ink via-ink/90 to-transparent px-5 pt-10">
        <Link href={`/spaces/${space.id}/check`} className={buttonClass()}>
          <Aperture />
          Start audit
        </Link>
      </div>
    </main>
  );
}

function AuditRow({ audit, href }: { audit: Audit; href: string }) {
  const count = (k: string) => audit.items.filter((i) => i.kind === k).length;
  const removed = count("removed");
  return (
    <li>
      <Link href={href} className="flex items-center gap-4 rounded-[20px] bg-ink-2 p-4 pr-5 transition active:scale-[0.99]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={audit.image} alt="" className="size-14 rounded-[14px] object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{ago(audit.createdAt)}</span>
          <span className="mono mt-1 block text-[11px] text-ash">
            {audit.committedAs ? `committed → ${audit.committedAs}` : `vs ${audit.baseCommitId}`}
          </span>
        </span>
        <span className="mono flex gap-3 text-[13px] font-semibold">
          <span className={removed ? "text-signal" : "text-ash"}>−{removed}</span>
          <span className="text-mint">+{count("added")}</span>
          <span className="text-bone">↗{count("moved")}</span>
        </span>
      </Link>
    </li>
  );
}
