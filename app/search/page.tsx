"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Back, Close, Search } from "@/components/icons";
import { Dock, nav, Pill, Round, Screen, Splash, Thumb, useIntro } from "@/components/ui";
import { plural } from "@/lib/format";
import { headOf, missingOf, useHydrated, useLocus } from "@/lib/store";
import type { LedgerObject, Space } from "@/lib/types";

type Hit = { space: Space; item: LedgerObject; missing: boolean; rank: number };

function rank(q: string, space: Space, item: LedgerObject) {
  const label = item.label.toLowerCase();
  if (label.startsWith(q)) return 0;
  if (label.split(/\s+/).some((w) => w.startsWith(q))) return 1;
  if (label.includes(q)) return 2;
  if (item.category.toLowerCase().includes(q)) return 3;
  if (space.name.toLowerCase().includes(q)) return 4;
  if (item.hint.toLowerCase().includes(q)) return 5;
  return -1;
}

function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[4px] bg-move-tint px-0.5 text-ink">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function SearchPage() {
  const hydrated = useHydrated();
  const spaces = useLocus((s) => s.spaces);
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());

  if (!hydrated) return <Splash />;
  return (
    <Screen>
      <Results spaces={spaces} query={query} setQuery={setQuery} q={q} />
    </Screen>
  );
}

function Results({
  spaces,
  query,
  setQuery,
  q,
}: {
  spaces: Space[];
  query: string;
  setQuery: (v: string) => void;
  q: string;
}) {
  const all = spaces.flatMap((space) => {
    const missing = new Set(missingOf(space).map((m) => m.objectId));
    return headOf(space).objects.map((item) => ({ space, item, missing: missing.has(item.id) }));
  });
  const hits: Hit[] = q
    ? all
        .map((h) => ({ ...h, rank: rank(q, h.space, h.item) }))
        .filter((h) => h.rank >= 0)
        .sort((a, b) => a.rank - b.rank || a.item.label.localeCompare(b.item.label))
    : [];
  const spaceHits = q ? spaces.filter((s) => s.name.toLowerCase().includes(q)) : [];

  return (
    <main className="min-h-dvh bg-paper pb-36">
      <header className="pt-safe sticky top-0 z-10 flex items-center gap-2 bg-paper/85 px-4 pb-3 backdrop-blur-xl">
        <Round href="/" variant="card" aria-label="Back">
          <Back />
        </Round>
      </header>

      {!q ? (
        <Browse spaces={spaces} />
      ) : hits.length === 0 && spaceHits.length === 0 ? (
        <div className="fade px-6 pt-20 text-center">
          <p className="display text-[34px]">No matches</p>
          <p className="mx-auto mt-3 max-w-[260px] text-[15px] leading-relaxed text-soft">
            Nothing called “{query.trim()}” in your spaces. Try a shorter word, like “key” or “pen”.
          </p>
        </div>
      ) : (
        <div className="fade px-4 pt-2">
          {spaceHits.length > 0 && (
            <section className="mb-6">
              <h2 className="px-1 text-[13px] font-semibold text-mute">Spaces</h2>
              <ul className="mt-2 overflow-hidden rounded-[28px] bg-card">
                {spaceHits.map((s) => (
                  <li key={s.id} className="border-b border-paper last:border-0">
                    <Link
                      href={`/spaces/${s.id}`}
                      transitionTypes={nav("forward")}
                      className="flex items-center gap-3.5 p-2.5 pr-4 transition-colors active:bg-paper"
                    >
                      <Thumb src={headOf(s).image} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[17px] font-semibold">
                          <Highlight text={s.name} q={q} />
                        </span>
                        <span className="text-[13px] text-soft">{plural(headOf(s).objects.length, "item")}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {hits.length > 0 && (
            <section>
              <h2 className="px-1 text-[13px] font-semibold text-mute">{plural(hits.length, "item")}</h2>
              <ul className="mt-2 overflow-hidden rounded-[28px] bg-card">
                {hits.map(({ space, item, missing }) => (
                  <li key={`${space.id}-${item.id}`} className="border-b border-paper last:border-0">
                    <Link
                      href={`/spaces/${space.id}?item=${item.id}`}
                      transitionTypes={nav("forward")}
                      className="flex items-center gap-3.5 p-2.5 pr-4 transition-colors active:bg-paper"
                    >
                      <Thumb src={item.crop} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-semibold">
                          <Highlight text={item.label} q={q} />
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] text-soft">
                          <span className="font-medium text-ink">{space.name}</span> · {item.hint}
                        </span>
                      </span>
                      {missing && <Pill tone="miss">Missing</Pill>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <Dock>
        <label className="flex h-15 w-full items-center gap-2.5 rounded-full bg-card px-5 shadow-[0_1px_2px_rgb(0_0_0/0.06)]">
          <Search width={19} height={19} className="shrink-0 text-mute" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keys, charger, tools…"
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-[17px] font-medium outline-none placeholder:text-mute"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => setQuery("")}
              className="pop grid size-6 place-items-center rounded-full bg-sunk text-soft transition-transform active:scale-90"
            >
              <Close width={13} height={13} strokeWidth={2.6} />
            </button>
          )}
        </label>
      </Dock>
    </main>
  );
}

function Browse({ spaces }: { spaces: Space[] }) {
  const intro = useIntro();
  if (!spaces.length)
    return <p className="px-6 pt-20 text-center text-[15px] text-soft">Add a space to start finding items.</p>;
  return (
    <div className="space-y-8 pt-3">
      {spaces.map((s, si) => {
        const missing = new Set(missingOf(s).map((m) => m.objectId));
        const items = [...headOf(s).objects].sort((a, b) => {
          const am = missing.has(a.id) ? 0 : 1;
          const bm = missing.has(b.id) ? 0 : 1;
          if (am !== bm) return am - bm;
          return new Date(b.seenAt).getTime() - new Date(a.seenAt).getTime();
        });
        const overflow = items.length > 6;
        const shown = overflow ? items.slice(0, 6) : items;
        const extra = overflow ? items.length - 6 : 0;
        return (
          <section key={s.id} className={intro ? "rise" : ""} style={{ animationDelay: `${si * 60}ms` }}>
            <div className="flex items-baseline justify-between px-5">
              <h2 className="text-[22px] font-bold tracking-[-0.03em]">{s.name}</h2>
              <Link
                href={`/spaces/${s.id}`}
                transitionTypes={nav("forward")}
                className="text-[14px] font-semibold text-soft transition-colors active:text-ink"
              >
                Open
              </Link>
            </div>
            <ul className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4">
              {shown.map((o) => (
                <li key={o.id} className="w-[calc((100%-2.25rem)/4.33)] shrink-0">
                  <Link
                    href={`/spaces/${s.id}?item=${o.id}`}
                    transitionTypes={nav("forward")}
                    className="block transition-transform duration-300 active:scale-95 active:duration-100"
                  >
                    <span className="relative block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={o.crop} alt="" className="aspect-square w-full rounded-[18px] object-cover" />
                      {missing.has(o.id) && (
                        <span className="absolute right-1.5 top-1.5 size-3 rounded-full bg-miss ring-2 ring-white" />
                      )}
                    </span>
                    <span className="mt-1.5 block truncate text-[12px] font-medium leading-tight">{o.label}</span>
                  </Link>
                </li>
              ))}
              {extra > 0 && (
                <li className="w-[calc((100%-2.25rem)/4.33)] shrink-0">
                  <Link
                    href={`/spaces/${s.id}`}
                    transitionTypes={nav("forward")}
                    className="block transition-transform duration-300 active:scale-95 active:duration-100"
                  >
                    <span className="grid aspect-square w-full place-items-center rounded-[18px] border-2 border-dashed border-line">
                      <span className="flex flex-col items-center gap-0.5 px-1 text-center">
                        <span className="text-[20px] font-medium leading-none tracking-[-0.03em]">+{extra}</span>
                        <span className="text-[11px] font-medium leading-tight text-soft">more →</span>
                      </span>
                    </span>
                  </Link>
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
