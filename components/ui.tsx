import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Tone = "signal" | "bone" | "ink";

const tones: Record<Tone, string> = {
  signal: "bg-signal text-ink active:bg-[#e8401a]",
  bone: "bg-bone text-ink active:bg-[#dcd9d0]",
  ink: "bg-ink-2 text-bone active:bg-ink-3",
};

export const buttonClass = (tone: Tone = "signal", className = "") =>
  `flex h-16 w-full items-center justify-center gap-3 rounded-full text-[17px] font-semibold transition-[transform,background-color] duration-150 active:scale-[0.98] disabled:opacity-40 ${tones[tone]} ${className}`;

export function Button({
  tone = "signal",
  className = "",
  ...rest
}: ComponentProps<"button"> & { tone?: Tone }) {
  return <button {...rest} className={buttonClass(tone, className)} />;
}

export function Missing() {
  return (
    <div className="grid min-h-dvh place-items-center px-8 text-center">
      <div>
        <p className="display text-[40px]">Space not found</p>
        <Link href="/" className={buttonClass("ink", "mt-8")}>
          Back home
        </Link>
      </div>
    </div>
  );
}

const rounds = {
  glass: "bg-ink/55 text-bone backdrop-blur-md",
  flat: "bg-ink-2 text-bone",
  solid: "bg-bone text-ink",
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
  const cls = `grid size-11 place-items-center rounded-full transition active:scale-95 ${rounds[variant]} ${className}`;
  if (href)
    return (
      <Link href={href} className={cls} aria-label={rest["aria-label"]}>
        {children}
      </Link>
    );
  return (
    <button {...rest} className={cls}>
      {children}
    </button>
  );
}

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <span className="mono text-[11px] uppercase tracking-[0.3em] text-ash">locus</span>
    </div>
  );
}
