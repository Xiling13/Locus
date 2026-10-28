"use client";

import { del, get, set } from "idb-keyval";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { buildCommit, detect, shortId } from "./engine";
import type { Audit, Commit, DiffItem, Space } from "./types";

type State = {
  spaces: Space[];
  seeded: boolean;
  addSpace: (space: Space) => void;
  removeSpace: (id: string) => void;
  addAudit: (spaceId: string, audit: Audit) => void;
  resolveItem: (spaceId: string, auditId: string, itemId: string, r: DiffItem["resolution"]) => void;
  pushCommit: (spaceId: string, commit: Commit, fromAudit?: string) => void;
  markSeeded: () => void;
};

const idb = createJSONStorage(() => ({
  getItem: async (k: string) => (await get<string>(k)) ?? null,
  setItem: (k: string, v: string) => set(k, v),
  removeItem: (k: string) => del(k),
}));

const mapSpace = (spaces: Space[], id: string, fn: (s: Space) => Space) =>
  spaces.map((s) => (s.id === id ? fn(s) : s));

export const useLocus = create<State>()(
  persist(
    (setState) => ({
      spaces: [],
      seeded: false,
      addSpace: (space) => setState((s) => ({ spaces: [space, ...s.spaces] })),
      removeSpace: (id) => setState((s) => ({ spaces: s.spaces.filter((x) => x.id !== id) })),
      addAudit: (spaceId, audit) =>
        setState((s) => ({
          spaces: mapSpace(s.spaces, spaceId, (sp) => ({ ...sp, audits: [audit, ...sp.audits] })),
        })),
      resolveItem: (spaceId, auditId, itemId, resolution) =>
        setState((s) => ({
          spaces: mapSpace(s.spaces, spaceId, (sp) => ({
            ...sp,
            audits: sp.audits.map((a) =>
              a.id !== auditId
                ? a
                : { ...a, items: a.items.map((i) => (i.id === itemId ? { ...i, resolution } : i)) },
            ),
          })),
        })),
      pushCommit: (spaceId, commit, fromAudit) =>
        setState((s) => ({
          spaces: mapSpace(s.spaces, spaceId, (sp) => ({
            ...sp,
            headId: commit.id,
            commits: [commit, ...sp.commits],
            audits: sp.audits.map((a) => (a.id === fromAudit ? { ...a, committedAs: commit.id } : a)),
          })),
        })),
      markSeeded: () => setState({ seeded: true }),
    }),
    {
      name: "locus",
      storage: idb,
      // Bump to wipe any leftover Chinese demo rows from earlier sessions.
      version: 3,
      migrate: () => ({ spaces: [], seeded: false }) as unknown as State,
    },
  ),
);

export function useHydrated() {
  return useSyncExternalStore(
    (cb) => useLocus.persist.onFinishHydration(cb),
    () => useLocus.persist.hasHydrated(),
    () => false,
  );
}

export function useSpace(id: string) {
  return useLocus((s) => s.spaces.find((x) => x.id === id));
}

export const headOf = (space: Space) =>
  space.commits.find((c) => c.id === space.headId) ?? space.commits[0];

let seeding: Promise<void> | null = null;

export function ensureDemo() {
  const st = useLocus.getState();
  if (st.seeded || seeding) return seeding;
  seeding = (async () => {
    const image = { src: "/demo/bench-base.jpg", width: 864, height: 1152 };
    const detections = await detect(image);
    const commit = await buildCommit(image, detections, { parentId: null, message: "Initial commit" });
    commit.createdAt = new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString();
    commit.objects.forEach((o) => (o.seenAt = commit.createdAt));
    useLocus.getState().addSpace({
      id: shortId(),
      name: "Workbench",
      createdAt: commit.createdAt,
      headId: commit.id,
      commits: [commit],
      audits: [],
      demo: true,
    });
    useLocus.getState().markSeeded();
  })().finally(() => {
    seeding = null;
  });
  return seeding;
}
