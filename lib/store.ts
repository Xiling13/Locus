"use client";

import { del, get, set } from "idb-keyval";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { buildCommit, detect, shortId } from "./engine";
import type { Audit, Commit, DiffItem, LedgerObject, Space } from "./types";

type State = {
  spaces: Space[];
  seeded: boolean;
  addSpace: (space: Space) => void;
  removeSpace: (id: string) => void;
  renameSpace: (id: string, name: string) => void;
  renameItem: (spaceId: string, objectId: string, label: string) => void;
  addAudit: (spaceId: string, audit: Audit) => void;
  resolveItem: (spaceId: string, auditId: string, itemId: string, r: DiffItem["resolution"]) => void;
  pushCommit: (spaceId: string, commit: Commit, fromAudit?: string, untracked?: LedgerObject[]) => void;
  untrackItem: (spaceId: string, objectId: string) => void;
  trackItem: (spaceId: string, objectId: string) => void;
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
      renameSpace: (id, name) =>
        setState((s) => ({ spaces: mapSpace(s.spaces, id, (sp) => ({ ...sp, name })) })),
      renameItem: (spaceId, objectId, label) =>
        setState((s) => ({
          spaces: mapSpace(s.spaces, spaceId, (sp) => ({
            ...sp,
            commits: sp.commits.map((c) => ({
              ...c,
              objects: c.objects.map((o) => (o.id === objectId ? { ...o, label } : o)),
            })),
            audits: sp.audits.map((a) => ({
              ...a,
              items: a.items.map((i) => (i.objectId === objectId ? { ...i, label } : i)),
            })),
          })),
        })),
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
      pushCommit: (spaceId, commit, fromAudit, untracked = []) =>
        setState((s) => ({
          spaces: mapSpace(s.spaces, spaceId, (sp) => ({
            ...sp,
            headId: commit.id,
            commits: [commit, ...sp.commits],
            audits: sp.audits.map((a) => (a.id === fromAudit ? { ...a, committedAs: commit.id } : a)),
            untracked: [...untracked, ...(sp.untracked ?? [])],
          })),
        })),
      untrackItem: (spaceId, objectId) =>
        setState((s) => ({
          spaces: mapSpace(s.spaces, spaceId, (sp) => {
            const obj = headOf(sp).objects.find((o) => o.id === objectId);
            if (!obj) return sp;
            const open = openCheck(sp);
            return {
              ...sp,
              commits: sp.commits.map((c) =>
                c.id === sp.headId ? { ...c, objects: c.objects.filter((o) => o.id !== objectId) } : c,
              ),
              audits: sp.audits.map((a) =>
                a !== open
                  ? a
                  : {
                      ...a,
                      items: a.items.filter((i) => i.objectId !== objectId),
                      detections: a.detections.filter((d) => d.signature !== obj.signature),
                      unchanged: a.items.some((i) => i.objectId === objectId) ? a.unchanged : a.unchanged - 1,
                    },
              ),
              untracked: [obj, ...(sp.untracked ?? [])],
            };
          }),
        })),
      trackItem: (spaceId, objectId) =>
        setState((s) => ({
          spaces: mapSpace(s.spaces, spaceId, (sp) => {
            const obj = sp.untracked?.find((o) => o.id === objectId);
            if (!obj) return sp;
            return {
              ...sp,
              commits: sp.commits.map((c) => (c.id === sp.headId ? { ...c, objects: [...c.objects, obj] } : c)),
              untracked: sp.untracked!.filter((o) => o.id !== objectId),
            };
          }),
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

/** The latest check, if it hasn't been saved as the new reference photo yet. */
export const openCheck = (space: Space) =>
  space.audits[0] && !space.audits[0].committedAs ? space.audits[0] : undefined;

/** Items from the latest open check that are still unaccounted for. */
export const missingOf = (space: Space) =>
  openCheck(space)?.items.filter((i) => i.kind === "removed" && i.resolution !== "found") ?? [];

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
