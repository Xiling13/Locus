"use client";

import Link from "next/link";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from "react";
import type { Audit } from "@/lib/types";
import { Pencil } from "./icons";

type Tone = "ink" | "card" | "sunk" | "miss" | "clear" | "smoke";

const tones: Record<Tone, string> = {
  ink: "bg-ink text-paper active:bg-black",
  card: "bg-card text-ink active:bg-sunk",
  sunk: "bg-sunk text-ink active:bg-line",
  miss: "bg-miss text-ink active:brightness-95",
  clear: "text-soft active:text-ink",
  smoke: "bg-white/12 text-white active:bg-white/20",
};

export const buttonClass = (tone: Tone = "ink", className = "") =>
  `flex h-15 w-full items-center justify-center gap-2.5 rounded-full text-[17px] font-semibold tracking-[-0.01em] transition-[transform,background-color,filter] duration-150 active:scale-[0.98] disabled:opacity-40 ${tones[tone]} ${className}`;

export function Button({
  tone = "ink",
  className = "",
  ...rest
}: ComponentProps<"button"> & { tone?: Tone }) {
  return <button type="button" {...rest} className={buttonClass(tone, className)} />;
}

const rounds = {
  glass: "glass text-ink shadow-[0_2px_12px_rgb(0_0_0/0.08)]",
  card: "bg-card text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]",
  ink: "bg-ink text-paper",
  dark: "glass-dark text-white",
};

export function Round({
  href,
  children,
  variant = "glass",
  className = "",
  ...rest
}: ComponentProps<"button"> & {
  href?: string;
  children: ReactNode;
  variant?: keyof typeof rounds;
}) {
  const cls = `grid size-11 shrink-0 place-items-center rounded-full transition active:scale-92 ${rounds[variant]} ${className}`;
  if (href)
    return (
      <Link href={href} className={cls} aria-label={rest["aria-label"]}>
        {children}
      </Link>
    );
  return (
    <button type="button" {...rest} className={cls}>
      {children}
    </button>
  );
}

const pills = {
  miss: "bg-miss-tint text-miss-deep",
  new: "bg-new-tint text-new-deep",
  move: "bg-move-tint text-move-deep",
  ink: "bg-ink text-paper",
  calm: "bg-sunk text-soft",
  glass: "glass text-ink",
};
const dots = { miss: "bg-miss", new: "bg-new", move: "bg-move", ink: "bg-paper", calm: "bg-mute", glass: "bg-ink" };

export function Pill({
  tone,
  children,
  className = "",
}: {
  tone: keyof typeof pills;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold ${pills[tone]} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${dots[tone]}`} />
      {children}
    </span>
  );
}

export function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-ink" : "bg-line"}`}
    >
      <span
        className={`absolute top-0.5 size-6 rounded-full bg-white shadow-sm transition-[left] duration-250 ease-[var(--ease-spring)] ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

/** Coloured dots summarising a check: "2 missing · 1 new · 1 moved". */
export function Changes({ audit }: { audit: Audit }) {
  const n = (k: string) => audit.items.filter((i) => i.kind === k).length;
  const parts = [
    n("removed") && { tone: "bg-miss", text: `${n("removed")} missing` },
    n("added") && { tone: "bg-new", text: `${n("added")} new` },
    n("moved") && { tone: "bg-move", text: `${n("moved")} moved` },
  ].filter(Boolean) as { tone: string; text: string }[];
  return (
    <span className="flex flex-wrap gap-x-3 text-[13px] text-soft">
      {parts.length ? (
        parts.map((p) => (
          <span key={p.text} className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${p.tone}`} />
            {p.text}
          </span>
        ))
      ) : (
        <span>Everything in place</span>
      )}
    </span>
  );
}

/** Bottom sheet. Plays its own exit animation, then calls onClose. */
export function Sheet({
  onClose,
  children,
  label,
}: {
  onClose: () => void;
  children: ReactNode | ((close: () => void) => ReactNode);
  label: string;
}) {
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const [start, setStart] = useState<number | null>(null);

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 260);
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  });

  return (
    <div className="fixed inset-0 z-50 mx-auto max-w-[480px]" role="dialog" aria-modal aria-label={label}>
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className={`fade absolute inset-0 bg-ink/35 transition-opacity duration-250 ${closing ? "opacity-0" : ""}`}
      />
      <div
        className="sheet absolute inset-x-2 bottom-2 max-h-[88dvh] overflow-hidden rounded-[34px] bg-card shadow-[0_-8px_40px_rgb(0_0_0/0.18)]"
        style={{
          transform: closing ? "translateY(110%)" : `translateY(${drag}px)`,
          transition: start === null ? "transform 0.3s var(--ease-out-expo)" : "none",
        }}
      >
        <div
          className="flex h-7 cursor-grab touch-none items-center justify-center"
          onPointerDown={(e) => {
            setStart(e.clientY);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => start !== null && setDrag(Math.max(0, e.clientY - start))}
          onPointerUp={() => {
            setStart(null);
            if (drag > 90) close();
            else setDrag(0);
          }}
        >
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        <div className="no-scrollbar max-h-[calc(88dvh-28px)] overflow-y-auto overscroll-contain pb-safe">
          {typeof children === "function" ? children(close) : children}
        </div>
      </div>
    </div>
  );
}

export type InlineEditHandle = { edit: () => void };

/** Text that turns into an input on tap. Saves on Enter or blur, cancels on Escape. */
export function InlineEdit({
  value,
  onSave,
  className = "",
  label,
  ref,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  label: string;
  ref?: Ref<InlineEditHandle>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({ edit: () => setDraft(value) }));

  useEffect(() => {
    if (draft !== null) input.current?.select();
  }, [draft !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    const v = draft?.trim();
    if (v && v !== value) onSave(v);
    setDraft(null);
  };

  if (draft !== null)
    return (
      <input
        ref={input}
        value={draft}
        aria-label={label}
        enterKeyHint="done"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setDraft(null);
        }}
        className={`w-full min-w-0 rounded-[12px] bg-transparent outline-none ring-2 ring-ink/10 ring-offset-4 ring-offset-transparent ${className}`}
      />
    );

  return (
    <button
      type="button"
      aria-label={`${label}: ${value}`}
      onClick={() => setDraft(value)}
      className={`group flex min-w-0 max-w-full items-baseline gap-2 text-left ${className}`}
    >
      <span className="min-w-0 break-words">{value}</span>
      <Pencil
        width="0.5em"
        height="0.5em"
        strokeWidth={2.4}
        className="shrink-0 translate-y-[-0.1em] text-mute transition group-active:text-ink"
      />
    </button>
  );
}

export function Missing() {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-8 text-center">
      <div>
        <p className="display text-[40px]">Space not found</p>
        <p className="mt-3 text-[15px] text-soft">It may have been deleted.</p>
        <Link href="/" className={buttonClass("ink", "mt-8")}>
          Back home
        </Link>
      </div>
    </div>
  );
}

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper">
      <Logo className="fade" />
    </div>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[19px] font-bold tracking-[-0.04em] ${className}`}>
      <span className="relative grid size-6 place-items-center rounded-full bg-ink">
        <span className="size-2 rounded-full bg-miss" />
      </span>
      locus
    </span>
  );
}
