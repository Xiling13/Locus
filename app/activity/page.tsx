"use client";

import Link from "next/link";
import { startTransition, useState, ViewTransition } from "react";
import { Back } from "@/components/icons";
import { Changes, Chip, nav, Round, SavedBadge, Screen, Splash, Thumb, useIntro } from "@/components/ui";
import { day, plural, time } from "@/lib/format";
import { useHydrated, useLocus } from "@/lib/store";
import type { Audit, Space } from "@/lib/types";

type Entry = { key: string; at: string; space: Space; audit?: Audit };

export default function ActivityPage() {
  const hydrated = useHydrated();
  const spaces = useLocus((s) => s.spaces);
  const [only, setOnly] = useState<string | null>(null);
  const intro = useIntro();

  if (!hydrated) return <Splash />;

  const pick = (id: string | null) => startTransition(() => setOnly(id));
  const shown = only ? spaces.filter((s) => s.id === only) : spaces;
  const entries: Entry[] = shown
    .flatMap((space) => [
      ...space.audits.map((audit) => ({ key: audit.id, at: audit.createdAt, space, audit })),
      { key: `new-${space.id}`, at: space.createdAt, space },
    ])
    .sort((a, b) => b.at.localeCompare(a.at));

  const groups: { label: string; entries: Entry[] }[] = [];
  for (const e of entries) {
    const label = day(e.at);
    if (groups.at(-1)?.label === label) groups.at(-1)!.entries.push(e);
    else groups.push({ label, entries: [e] });
  }

  return (
    <Screen>
      <main className="min-h-dvh bg-paper pb-12">
        <header className="pt-safe sticky top-0 z-10 bg-paper/85 pb-3 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4">
            <Round href="/" variant="card" aria-label="Back">
              <Back />
            </Round>
            <h1 className="text-[17px] font-semibold">Activity</h1>
          </div>
          {spaces.length > 1 && (
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
              <Chip on={only === null} onClick={() => pick(null)}>
                All spaces
              </Chip>
              {spaces.map((s) => (
                <Chip key={s.id} on={only === s.id} onClick={() => pick(only === s.id ? null : s.id)}>
                  {s.name}
                </Chip>
              ))}
            </div>
          )}
        </header>

        <ViewTransition key={only ?? "all"} enter="swap" exit="swap" default="none">
          <div className="px-4">
            {groups.map((g, gi) => (
              <section key={g.label} className={`mt-5 ${intro ? "rise" : ""}`} style={{ animationDelay: `${gi * 60}ms` }}>
                <h2 className="px-1 text-[13px] font-semibold text-mute">{g.label}</h2>
                <ol className="mt-2 rounded-[28px] bg-card">
                  {g.entries.map((e, i) => (
                    <li
                      key={e.key}
                      className={`border-b border-paper last:border-0 ${
                        i === 0 ? "rounded-t-[28px]" : ""
                      } ${i === g.entries.length - 1 ? "rounded-b-[28px]" : ""}`}
                    >
                      <Row entry={e} />
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            {shown.every((s) => s.audits.length === 0) && (
              <p className="mt-6 px-1 text-[14px] text-mute">No checks yet. They’ll show up here as you make them.</p>
            )}
          </div>
        </ViewTransition>
      </main>
    </Screen>
  );
}

function Row({ entry: { at, space, audit } }: { entry: Entry }) {
  const first = space.commits.find((c) => c.parentId === null) ?? space.commits.at(-1)!;
  const body = (
    <>
      <Thumb src={audit?.image ?? first.image} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[16px] font-semibold">
          <span className="truncate">{space.name}</span>
          {audit && <SavedBadge space={space} audit={audit} />}
        </span>
        <span className="mt-1 block">
          {audit ? (
            <Changes audit={audit} />
          ) : (
            <span className="text-[13px] text-soft">Space created · {plural(first.objects.length, "item")}</span>
          )}
        </span>
      </span>
      <span className="shrink-0 self-center text-[13px] tabular-nums text-mute">{time(at)}</span>
    </>
  );
  if (!audit) return <div className="flex items-center gap-3.5 p-2.5 pr-4">{body}</div>;
  return (
    <Link
      href={`/spaces/${space.id}/audits/${audit.id}`}
      transitionTypes={nav("forward")}
      className="flex items-center gap-3.5 p-2.5 pr-4 transition-colors active:bg-paper"
    >
      {body}
    </Link>
  );
}
