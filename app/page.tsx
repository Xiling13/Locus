"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Chevron, Clock, Plus, Search } from "@/components/icons";
import { Frame } from "@/components/Photo";
import { Logo, nav, Pill, Round, Screen, Shared, Splash, buttonClass, useIntro } from "@/components/ui";
import { ago, plural } from "@/lib/format";
import { cssUrl } from "@/lib/image";
import { ensureDemo, glanceOf, headOf, missingOf, statusOf, useHydrated, useLocus } from "@/lib/store";
import type { Space } from "@/lib/types";

export default function Home() {
  const hydrated = useHydrated();
  const spaces = useLocus((s) => s.spaces);
  const seeded = useLocus((s) => s.seeded);
  const intro = useIntro();

  useEffect(() => {
    if (hydrated && !seeded) ensureDemo();
  }, [hydrated, seeded]);

  if (!hydrated || !seeded) return <Splash />;

  const missing = spaces.reduce((n, s) => n + missingOf(s).length, 0);
  const checked = spaces.some((s) => s.audits.length);
  const items = spaces.reduce((n, s) => n + headOf(s).objects.length, 0);

  return (
    <Screen>
    <main className="home-shell flex flex-col bg-paper">
      <header className="home-header pt-safe flex shrink-0 items-center justify-between px-4">
        <Logo className="pl-1" />
        <Round href="/activity" nav="forward" variant="card" aria-label="Activity" className="home-round">
          <Clock width={21} height={21} />
        </Round>
      </header>

      <h1 className={`home-display display mt-6 shrink-0 px-5 text-[52px] ${intro ? "rise" : ""}`}>
        {spaces.length === 0 ? (
          <>
            Add an image
            <br />
            <span className="text-mute">to begin</span>
          </>
        ) : missing > 0 ? (
          <>
            {plural(missing, "item")}
            <br />
            <span className="text-mute">need attention</span>
          </>
        ) : checked ? (
          <>
            Everything’s
            <br />
            <span className="text-mute">in its place</span>
          </>
        ) : (
          <>
            {plural(items, "item")}
            <br />
            <span className="text-mute">ready to check</span>
          </>
        )}
      </h1>

      <div className="flex min-h-0 flex-1 flex-col">
        <Deck spaces={spaces} intro={intro} />
      </div>

      <nav className="home-actions pb-safe flex shrink-0 gap-2 px-5 pt-6">
        <Link href="/search" transitionTypes={nav("forward")} className={buttonClass("card", "min-w-0 flex-1 basis-0")}>
          <Search width={18} height={18} />
          Search
        </Link>
        <Link href="/spaces/new" transitionTypes={nav("up")} className={buttonClass("ink", "min-w-0 flex-1 basis-0")}>
          <Plus width={18} height={18} />
          New space
        </Link>
      </nav>
    </main>
    </Screen>
  );
}

function NewSpaceCard() {
  // Match SpaceCard outer size (p-2 + 4:5 + foot); center the CTA in the full card like the deck.
  return (
    <Link
      href="/spaces/new"
      transitionTypes={nav("up")}
      className="relative block rounded-[34px] border-2 border-dashed border-line p-2 text-center transition-transform duration-300 active:scale-[0.97] active:duration-100"
    >
      <span className="block aspect-[4/5] rounded-[27px]" aria-hidden />
      <span className="home-card-foot invisible flex items-end gap-3 px-3 pb-3 pt-4" aria-hidden>
        <span className="min-w-0 flex-1">
          <span className="home-card-name block truncate text-[26px] font-bold leading-tight tracking-[-0.035em]">
            New space
          </span>
          <span className="home-card-meta mt-1 block truncate text-[14px]">0 items</span>
        </span>
        <span className="home-card-avatars grid size-10 place-items-center rounded-full">
          <Chevron width={18} height={18} />
        </span>
      </span>
      <span className="absolute inset-0 flex -translate-y-3 flex-col items-center justify-center gap-4 px-4">
        <span className="grid size-16 place-items-center rounded-full bg-ink text-paper">
          <Plus width={26} height={26} />
        </span>
        <span className="text-[22px] font-bold tracking-[-0.03em]">New space</span>
        <span className="max-w-[200px] text-[14px] leading-snug text-soft">
          A desk, a drawer, a toolbox — anywhere items go missing.
        </span>
      </span>
    </Link>
  );
}

function spaceRecency(space: Space) {
  return new Date((space.audits[0] ?? headOf(space)).createdAt).getTime();
}

/** Missing first, then most recently checked / updated. */
function sortSpaces(spaces: Space[]) {
  return [...spaces].sort((a, b) => {
    const am = missingOf(a).length > 0 ? 0 : 1;
    const bm = missingOf(b).length > 0 ? 0 : 1;
    if (am !== bm) return am - bm;
    return spaceRecency(b) - spaceRecency(a);
  });
}

function Deck({ spaces, intro }: { spaces: Space[]; intro: boolean }) {
  const ordered = sortSpaces(spaces);
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const dragged = useRef(false);
  const [index, setIndex] = useState(0);
  const count = ordered.length + 1;

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
    if (count <= 1) return;
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update, count]);

  useEffect(() => {
    if (count <= 1) return;
    const el = rail.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [count]);

  const go = (i: number) => {
    const card = rail.current?.children[i] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  // Solo card: same deck slot size, centered, no tilt / pager.
  if (count === 1) {
    return (
      <section className="home-deck mt-5 flex min-h-0 flex-1 flex-col justify-center pb-4">
        <div className="home-rail flex justify-center px-[11%] pb-14 pt-5">
          <div
            className={`w-[78%] max-w-[360px] shrink-0 ${intro ? "rise" : ""}`}
            style={{ animationDelay: "60ms" }}
          >
            <NewSpaceCard />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="home-deck mt-5 flex min-h-0 flex-1 flex-col justify-center pb-4">
      <div
        ref={rail}
        onScroll={update}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") return;
          const el = rail.current;
          if (!el) return;
          dragged.current = false;
          drag.current = { x: e.clientX, left: el.scrollLeft };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          const el = rail.current;
          if (!d || !el) return;
          const dx = e.clientX - d.x;
          if (!dragged.current && Math.abs(dx) > 6) {
            dragged.current = true;
            el.setPointerCapture(e.pointerId);
          }
          if (dragged.current) el.scrollLeft = d.left - dx;
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onClickCapture={(e) => {
          if (!dragged.current) return;
          e.preventDefault();
          e.stopPropagation();
          dragged.current = false;
        }}
        className="home-rail no-scrollbar flex cursor-grab snap-x snap-mandatory gap-3 overflow-x-auto px-[11%] pb-14 pt-5 active:cursor-grabbing"
      >
        {ordered.map((s, i) => (
          <DeckCard key={s.id} index={i} intro={intro}>
            <SpaceCard space={s} />
          </DeckCard>
        ))}
        <DeckCard index={ordered.length} intro={intro}>
          <NewSpaceCard />
        </DeckCard>
      </div>

      <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Spaces">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={i < ordered.length ? ordered[i].name : "New space"}
            onClick={() => go(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-ink" : "w-1.5 bg-line"}`}
          />
        ))}
      </div>
    </section>
  );
}

function DeckCard({ index, intro, children }: { index: number; intro: boolean; children: ReactNode }) {
  return (
    <div
      className={`w-[78%] max-w-[360px] shrink-0 snap-center ${intro ? "rise" : ""}`}
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

const statusTone = { removed: "miss", moved: "move", added: "new" } as const;

function SpaceCard({ space }: { space: Space }) {
  const head = headOf(space);
  const glance = glanceOf(space);
  const missing = missingOf(space);
  const status = statusOf(space);
  const label =
    status.state === "unchecked"
      ? "Not checked yet"
      : status.state === "clear"
        ? "All in place"
        : status.state === "removed"
          ? `${status.count} missing`
          : status.state === "moved"
            ? `${status.count} moved`
            : `${status.count} new`;

  return (
    <Link
      href={`/spaces/${space.id}`}
      transitionTypes={nav("forward")}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      className="home-card block rounded-[34px] bg-card p-2 shadow-[0_16px_36px_-14px_rgb(0_0_0/0.22)] transition-transform duration-300 active:scale-[0.97] active:duration-100"
    >
      <div className="relative">
        <Shared name={`space-${space.id}`}>
          <Frame
            src={glance.image}
            width={glance.width}
            height={glance.height}
            aspect={4 / 5}
            className="rounded-[27px]"
          />
        </Shared>
        <div className="absolute left-3 top-3">
          {status.state === "unchecked" || status.state === "clear" ? (
            <Pill tone="glass">{label}</Pill>
          ) : (
            <Pill tone={statusTone[status.state]} className="shadow-sm">
              {label}
            </Pill>
          )}
        </div>
      </div>
      <div className="home-card-foot flex items-end gap-3 px-3 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <div className="home-card-name truncate text-[26px] font-bold leading-tight tracking-[-0.035em]">{space.name}</div>
          <div className="home-card-meta mt-1 truncate text-[14px] text-soft">
            {plural(head.objects.length, "item")} · {ago(glance.createdAt)}
          </div>
        </div>
        {missing.length > 0 ? (
          <div className="home-card-avatars flex -space-x-3">
            {missing.slice(0, 3).map((m) => (
              <span
                key={m.id}
                aria-hidden
                className="size-10 rounded-full bg-cover bg-center ring-[3px] ring-card"
                style={{ backgroundImage: cssUrl(m.crop) }}
              />
            ))}
          </div>
        ) : (
          <span className="home-card-avatars grid size-10 place-items-center rounded-full bg-paper">
            <Chevron width={18} height={18} className="-rotate-90" />
          </span>
        )}
      </div>
    </Link>
  );
}
