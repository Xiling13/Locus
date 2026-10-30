"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Chevron, Plus, Search } from "@/components/icons";
import { Frame } from "@/components/Photo";
import { Logo, Pill, Round, Splash } from "@/components/ui";
import { ago, plural } from "@/lib/format";
import { ensureDemo, headOf, missingOf, openCheck, useHydrated, useLocus } from "@/lib/store";
import type { Space } from "@/lib/types";

export default function Home() {
  const hydrated = useHydrated();
  const spaces = useLocus((s) => s.spaces);
  const seeded = useLocus((s) => s.seeded);

  useEffect(() => {
    if (hydrated && !seeded) ensureDemo();
  }, [hydrated, seeded]);

  if (!hydrated || !seeded) return <Splash />;

  const missing = spaces.flatMap((s) => missingOf(s).map((item) => ({ space: s, item })));
  const checked = spaces.some((s) => s.audits.length);
  const items = spaces.reduce((n, s) => n + headOf(s).objects.length, 0);

  return (
    <main className="min-h-dvh bg-paper pb-12">
      <header className="pt-safe flex items-center justify-between px-5">
        <Logo />
        <div className="flex gap-2">
          <Round href="/search" variant="card" aria-label="Search">
            <Search width={20} height={20} />
          </Round>
          <Round href="/spaces/new" variant="ink" aria-label="New space">
            <Plus width={20} height={20} />
          </Round>
        </div>
      </header>

      <h1 className="display rise mt-9 px-5 text-[52px]">
        {missing.length > 0 ? (
          <>
            {plural(missing.length, "thing")}
            <br />
            <span className="text-mute">need a look</span>
          </>
        ) : checked ? (
          <>
            Everything’s
            <br />
            <span className="text-mute">in its place</span>
          </>
        ) : (
          <>
            {plural(items, "thing")}
            <br />
            <span className="text-mute">ready to check</span>
          </>
        )}
      </h1>

      <Deck spaces={spaces} />

      {missing.length > 0 && (
        <section className="rise mt-10 px-5" style={{ animationDelay: "200ms" }}>
          <h2 className="text-[20px] font-bold tracking-[-0.02em]">Needs a look</h2>
          <ul className="mt-3 overflow-hidden rounded-[28px] bg-card">
            {missing.map(({ space, item }) => (
              <li key={`${space.id}-${item.id}`} className="border-b border-paper last:border-0">
                <Link
                  href={`/spaces/${space.id}/audits/${openCheck(space)!.id}?item=${item.id}`}
                  className="flex items-center gap-3.5 p-3 pr-4 transition active:bg-paper"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.crop} alt="" className="size-12 rounded-[14px] object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">{item.label}</span>
                    <span className="block truncate text-[13px] text-soft">{space.name}</span>
                  </span>
                  <Pill tone="miss">{item.confidence === "occluded" ? "Maybe hidden" : "Missing"}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Deck({ spaces }: { spaces: Space[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = spaces.length + 1;

  const update = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestD = Infinity;
    Array.from(el.children).forEach((node, i) => {
      const card = node as HTMLElement;
      const d = (card.offsetLeft + card.offsetWidth / 2 - mid) / card.offsetWidth;
      card.style.setProperty("--d", d.toFixed(3));
      card.style.setProperty("--a", Math.min(1, Math.abs(d)).toFixed(3));
      if (Math.abs(d) < bestD) {
        bestD = Math.abs(d);
        best = i;
      }
    });
    setIndex(best);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update, count]);

  const go = (i: number) => {
    const card = rail.current?.children[i] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <section className="mt-8">
      <div
        ref={rail}
        onScroll={update}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-[12%] pb-6 pt-2"
      >
        {spaces.map((s, i) => (
          <DeckCard key={s.id} index={i}>
            <SpaceCard space={s} />
          </DeckCard>
        ))}
        <DeckCard index={spaces.length}>
          <Link
            href="/spaces/new"
            className="flex h-full flex-col items-center justify-center gap-4 rounded-[34px] border-2 border-dashed border-line text-center transition active:scale-[0.98]"
          >
            <span className="grid size-16 place-items-center rounded-full bg-ink text-paper">
              <Plus width={26} height={26} />
            </span>
            <span className="text-[22px] font-bold tracking-[-0.03em]">New space</span>
            <span className="max-w-[200px] text-[14px] leading-snug text-soft">
              A desk, a drawer, a toolbox — anywhere things go missing.
            </span>
          </Link>
        </DeckCard>
      </div>

      <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Spaces">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={i < spaces.length ? spaces[i].name : "New space"}
            onClick={() => go(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-ink" : "w-1.5 bg-line"}`}
          />
        ))}
      </div>
    </section>
  );
}

function DeckCard({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div
      className="rise w-[76%] max-w-[360px] shrink-0 snap-center"
      style={{
        animationDelay: `${index * 70 + 60}ms`,
        transform: "rotate(calc(var(--d, 0) * 4deg)) scale(calc(1 - var(--a, 0) * 0.09))",
        transformOrigin: "50% 120%",
        opacity: "calc(1 - var(--a, 0) * 0.3)",
      }}
    >
      {children}
    </div>
  );
}

function SpaceCard({ space }: { space: Space }) {
  const head = headOf(space);
  const last = space.audits[0];
  const missing = missingOf(space);

  return (
    <Link
      href={`/spaces/${space.id}`}
      className="block rounded-[34px] bg-card p-2 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.25)] transition active:scale-[0.98]"
    >
      <div className="relative">
        <Frame
          src={last && !last.committedAs ? last.image : head.image}
          width={head.width}
          height={head.height}
          aspect={4 / 5}
          className="rounded-[27px]"
        />
        <div className="absolute left-3 top-3">
          {missing.length > 0 ? (
            <Pill tone="miss" className="shadow-sm">
              {missing.length} missing
            </Pill>
          ) : (
            <Pill tone="glass">{last ? "All in place" : "Not checked yet"}</Pill>
          )}
        </div>
      </div>
      <div className="flex items-end gap-3 px-3 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[26px] font-bold leading-tight tracking-[-0.035em]">{space.name}</div>
          <div className="mt-1 truncate text-[14px] text-soft">
            {plural(head.objects.length, "item")} · {ago((last ?? head).createdAt)}
          </div>
        </div>
        {missing.length > 0 ? (
          <div className="flex -space-x-3">
            {missing.slice(0, 3).map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={m.crop} alt="" className="size-10 rounded-full object-cover ring-[3px] ring-card" />
            ))}
          </div>
        ) : (
          <span className="grid size-10 place-items-center rounded-full bg-paper">
            <Chevron width={18} height={18} className="-rotate-90" />
          </span>
        )}
      </div>
    </Link>
  );
}
