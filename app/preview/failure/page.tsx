"use client";

import { notFound } from "next/navigation";
import { startTransition, use, useState, ViewTransition } from "react";
import { Failure } from "@/components/Failure";
import { Scanner, wait } from "@/components/Scanner";
import { Screen } from "@/components/ui";
import type { FailureKind } from "@/lib/failure";

const KINDS: FailureKind[] = ["offline", "slow", "server", "setup", "crash"];

/** Dev-only gallery of the failure screen. `?kind=offline|slow|server|setup|crash`. */
export default function FailurePreview({ searchParams }: PageProps<"/preview/failure">) {
  const { kind: raw } = use(searchParams);
  const [retrying, setRetrying] = useState(false);
  if (process.env.NODE_ENV === "production") notFound();
  const kind = (KINDS.find((k) => k === raw) ?? "offline") as FailureKind;

  async function retry() {
    startTransition(() => setRetrying(true));
    await wait(2200);
    startTransition(() => setRetrying(false));
  }

  return (
    <Screen>
      <ViewTransition key={retrying ? "scan" : kind} enter="swap" exit="swap" default="none">
        {retrying ? (
          <Scanner src="/demo/bench-current.jpg" steps={[{ label: "Trying again" }]} title="Comparing…" />
        ) : (
          <Failure kind={kind} onRetry={retry} onClose={() => {}} connected={kind === "offline" ? false : undefined} />
        )}
      </ViewTransition>
    </Screen>
  );
}
