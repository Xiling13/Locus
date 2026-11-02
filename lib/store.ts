"use client";

import { del, get, set } from "idb-keyval";
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { buildCommit, detect, recommit, runAudit, shortId } from "./engine";
import type { Audit, Commit, DiffItem, DiffKind, LedgerObject, Space } from "./types";

type State = {
  spaces: Space[];
  seeded: boolean;
  addSpace: (space: Space) => void;
  removeSpace: (id: string) => void;
  renameSpace: (id: string, name: string) => void;
  renameItem: (spaceId: string, objectId: string, label: string) => void;
  addItem: (spaceId: string, object: LedgerObject) => void;
  addAudit: (spaceId: string, audit: Audit) => void;
  resolveItem: (spaceId: string, auditId: string, itemId: string, r: DiffItem["resolution"]) => void;
  pushCommit: (spaceId: string, commit: Commit, fromAudit?: string, untracked?: LedgerObject[]) => void;
  deleteCheck: (spaceId: string, auditId: string) => void;
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
      addItem: (spaceId, object) =>
        setState((s) => ({
          spaces: mapSpace(s.spaces, spaceId, (sp) => ({
            ...sp,
            commits: sp.commits.map((c) => (c.id === sp.headId ? { ...c, objects: [...c.objects, object] } : c)),
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
      deleteCheck: (spaceId, auditId) =>
        setState((s) => ({
          spaces: mapSpace(s.spaces, spaceId, (sp) => {
            const { drop, commit } = deletionOf(sp, auditId);
            if (!drop.length) return sp;
            const gone = new Set(drop.map((a) => a.id));
            if (!commit) return { ...sp, audits: sp.audits.filter((a) => !gone.has(a.id)) };
            const off = new Set(sp.untracked?.map((o) => o.signature));
            return {
              ...sp,
              headId: commit.parentId!,
              commits: sp.commits
                .filter((c) => c.id !== commit.id)
                .map((c) =>
                  c.id === commit.parentId ? { ...c, objects: c.objects.filter((o) => !off.has(o.signature)) } : c,
                ),
              audits: sp.audits.filter((a) => !gone.has(a.id)),
            };
          }),
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
      // Bump so demo reseeds with newest-first commits (matches pushCommit).
      version: 7,
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

/** Most recent check, whether or not it was saved as the current photo. */
export const lastCheck = (space: Space) => space.audits[0];

/** The latest check, if it hasn't been saved as the new current photo yet. */
export const openCheck = (space: Space) =>
  space.audits[0] && !space.audits[0].committedAs ? space.audits[0] : undefined;

/** Missing items from the latest check (saved or not) — still unaccounted for. */
export const missingOf = (space: Space) =>
  lastCheck(space)?.items.filter((i) => i.kind === "removed" && i.resolution !== "found") ?? [];

/** Current reference photo for a space (same as head). */
export const sceneOf = headOf;

/** Display order / priority: Missing > Moved > New. */
export const KIND_ORDER: Record<DiffKind, number> = { removed: 0, moved: 1, added: 2 };

/** Highest-priority change in a check (Missing > Moved > New), or null if clear. */
export function primaryDiff(items: DiffItem[]) {
  const counts: Record<DiffKind, number> = { removed: 0, moved: 0, added: 0 };
  for (const i of items) {
    if (i.kind === "removed" && i.resolution === "found") continue;
    counts[i.kind]++;
  }
  if (counts.removed) return { kind: "removed" as const, count: counts.removed };
  if (counts.moved) return { kind: "moved" as const, count: counts.moved };
  if (counts.added) return { kind: "added" as const, count: counts.added };
  return null;
}

/** Space card status from the latest check (Missing > Moved > New). */
export function statusOf(space: Space) {
  const last = space.audits[0];
  if (!last) return { state: "unchecked" } as const;
  const primary = primaryDiff(last.items);
  if (!primary) return { state: "clear" } as const;
  return { state: primary.kind, count: primary.count } as const;
}
/**
 * What deleting a check takes with it. A check that became the current reference photo
 * is rolled back: its photo goes, the previous one is the reference again, and any later
 * checks compared against it go too. The first photo of a space is never removed here.
 */
export function deletionOf(space: Space, auditId: string) {
  const audit = space.audits.find((a) => a.id === auditId);
  if (!audit) return { drop: [] as Audit[], commit: undefined };
  const c = audit.committedAs ? space.commits.find((x) => x.id === audit.committedAs) : undefined;
  const commit = c && c.id === space.headId && c.parentId ? c : undefined;
  const drop = commit ? [audit, ...space.audits.filter((a) => a.baseCommitId === commit.id)] : [audit];
  const previous = commit ? space.commits.find((x) => x.id === commit.parentId) : undefined;
  return { drop, commit, previous };
}

let seeding: Promise<void> | null = null;

export function ensureDemo() {
  const st = useLocus.getState();
  if (st.seeded) return null;
  if (seeding) return seeding;
  seeding = (async () => {
    try {
      const image = { src: "/demo/bench-base.jpg", width: 864, height: 1152 };
      const detections = await detect(image);
      const commit = await buildCommit(image, detections, { parentId: null, message: "Initial commit" });
      commit.createdAt = new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString();
      commit.objects.forEach((o) => (o.seenAt = commit.createdAt));
      const current = { src: "/demo/bench-current.jpg", width: 864, height: 1152 };
      const audit = await runAudit(commit, current);
      audit.createdAt = new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString();
      // Checks are normally saved; keep the glanceable missing UI from that check.
      const { commit: saved, untracked } = await recommit(commit, audit);
      saved.createdAt = audit.createdAt;
      audit.committedAs = saved.id;
      useLocus.getState().addSpace({
        id: shortId(),
        name: "Workbench",
        createdAt: commit.createdAt,
        headId: saved.id,
        // Newest first — same order pushCommit keeps.
        commits: [saved, commit],
        audits: [audit],
        untracked,
        demo: true,
      });
    } catch (err) {
      console.error("Demo seed failed", err);
    } finally {
      // Always leave the splash — an empty home beats an infinite logo screen.
      useLocus.getState().markSeeded();
      seeding = null;
    }
  })();
  return seeding;
}
