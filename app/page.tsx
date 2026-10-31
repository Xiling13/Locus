"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Chevron, Clock, Plus, Search } from "@/components/icons";
import { Frame } from "@/components/Photo";
import { Logo, nav, Pill, Round, Screen, Shared, Splash, buttonClass, useIntro } from "@/components/ui";
import { ago, plural } from "@/lib/format";
import { ensureDemo, headOf, missingOf, statusOf, useHydrated, useLocus } from "@/lib/store";
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
    <main className="flex h-dvh flex-col bg-paper">
      <header className="pt-safe flex shrink-0 items-center justify-between px-4">
        <Logo className="pl-1" />
        <Round href="/activity" nav="forward" variant="card" aria-label="Activity">
          <Clock width={21} height={21} />
        </Round>
      </header>

      <h1 className={`home-display display mt-6 shrink-0 px-5 text-[52px] ${intro ? "rise" : ""}`}>
        {missing > 0 ? (
          <>
            {plural(missing, "thing")}
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

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Deck spaces={spaces} intro={intro} />
      </div>

      <nav className="home-actions pb-safe flex shrink-0 gap-2 px-5 pt-6">
        <Link href="/search" transitionTypes={nav("forward")} className={buttonClass("card", "flex-1")}>
          <Search width={20} height={20} />
          Search
        </Link>
        <Link href="/spaces/new" transitionTypes={nav("up")} className={buttonClass("ink", "flex-1")}>
          <Plus width={20} height={20} />
          New space
        </Link>
      </nav>
    </main>
    </Screen>
  );
}

function Deck({ spaces, intro }: { spaces: Space[]; intro: boolean }) {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  const dragged = useRef(false);
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

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const go = (i: number) => {
    const card = rail.current?.children[i] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <section className="mt-5 flex min-h-0 flex-1 flex-col justify-center pb-4">
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
        className="no-scrollbar flex cursor-grab snap-x snap-mandatory gap-3 overflow-x-auto px-[11%] pb-14 pt-3 active:cursor-grabbing"
      >
        {spaces.map((s, i) => (
          <DeckCard key={s.id} index={i} intro={intro}>
            <SpaceCard space={s} />
          </DeckCard>
        ))}
        <DeckCard index={spaces.length} intro={intro}>
          <Link
            href="/spaces/new"
            transitionTypes={nav("up")}
            className="flex h-full flex-col items-center justify-center gap-4 rounded-[34px] border-2 border-dashed border-line text-center transition-transform duration-300 active:scale-[0.97] active:duration-100"
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
  const last = space.audits[0];
  const missing = missingOf(space);
  const status = statusOf(space);
  // Prefer the check photo when there are findings so the card matches the glanceable space view.
  const shot = last && status.state !== "unchecked" && status.state !== "clear" ? last : null;
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
      className="block rounded-[34px] bg-card p-2 shadow-[0_16px_36px_-14px_rgb(0_0_0/0.22)] transition-transform duration-300 active:scale-[0.97] active:duration-100"
    >
      <div className="relative">
        <Shared name={`space-${space.id}`}>
          <Frame
            src={(shot ?? head).image}
            width={(shot ?? head).width}
            height={(shot ?? head).height}
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
