"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type { ComplyRow, DocRef, Project, ProjectDoc, Requirement } from "@/lib/types";
import seed from "@/data/requirements.seed.json";

type State = {
  projects: Project[];
  activeId: string | null;
  createBlank: (name?: string) => string;
  createDemo: () => string;
  setActive: (id: string | null) => void;
  rename: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  upsertRequirement: (projectId: string, req: Requirement) => void;
  addDoc: (projectId: string, doc: Omit<ProjectDoc, "id" | "addedAt"> & { id?: string }) => string;
  removeDoc: (projectId: string, docId: string) => void;
  setRow: (projectId: string, requirementId: string, patch: Partial<ComplyRow>) => void;
  addRef: (projectId: string, requirementId: string, ref: DocRef) => void;
  removeRef: (projectId: string, requirementId: string, index: number) => void;
};

function emptyRows(requirements: Requirement[]): Record<string, ComplyRow> {
  const rows: Record<string, ComplyRow> = {};
  for (const r of requirements) {
    rows[r.id] = { requirementId: r.id, bidderText: "", compareText: "", refs: [] };
  }
  return rows;
}

export const useProjectStore = create<State>()(
  persist(
    (set, get) => ({
      projects: [],
      activeId: null,

      createBlank: (name = "โครงการใหม่") => {
        const id = uuidv4();
        const project: Project = {
          id,
          name,
          createdAt: new Date().toISOString(),
          requirements: [],
          docs: [],
          rows: {},
        };
        set((s) => ({ projects: [project, ...s.projects], activeId: id }));
        return id;
      },

      createDemo: () => {
        const id = uuidv4();
        const requirements = (seed.requirements as Requirement[]).map((r) => ({
          id: r.id,
          title: r.title,
          textSnapshot: r.textSnapshot,
        }));
        const demoDocId = "huawei-ar6000";
        const project: Project = {
          id,
          name: "กพบ เช่าใช้อินเทอร์เน็ต (demo)",
          createdAt: new Date().toISOString(),
          requirements,
          docs: [
            {
              id: demoDocId,
              name: "huawei-ar6000-datasheet.pdf",
              mimeType: "application/pdf",
              addedAt: new Date().toISOString(),
            },
          ],
          rows: emptyRows(requirements),
        };
        // seed one example annotation on 5.1 if present
        if (project.rows["5.1"]) {
          project.rows["5.1"] = {
            requirementId: "5.1",
            bidderText:
              "เสนอวงจร Leased Line Fiber ตามข้อกำหนด พร้อมอุปกรณ์ Router/Switch ที่รองรับ IPv6",
            compareText: "รายละเอียดตรงตามข้อกำหนด",
            refs: [{ docId: demoDocId, page: 1 }],
          };
        }
        set((s) => ({ projects: [project, ...s.projects], activeId: id }));
        return id;
      },

      setActive: (id) => set({ activeId: id }),

      rename: (id, name) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)),
        })),

      deleteProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),

      upsertRequirement: (projectId, req) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const exists = p.requirements.some((r) => r.id === req.id);
            const requirements = exists
              ? p.requirements.map((r) => (r.id === req.id ? req : r))
              : [...p.requirements, req];
            const rows = { ...p.rows };
            if (!rows[req.id]) {
              rows[req.id] = { requirementId: req.id, bidderText: "", compareText: "", refs: [] };
            }
            return { ...p, requirements, rows };
          }),
        })),

      addDoc: (projectId, doc) => {
        const id = doc.id ?? uuidv4();
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  docs: [
                    ...p.docs,
                    {
                      id,
                      name: doc.name,
                      dataUrl: doc.dataUrl,
                      mimeType: doc.mimeType,
                      addedAt: new Date().toISOString(),
                    },
                  ],
                }
              : p
          ),
        }));
        return id;
      },

      removeDoc: (projectId, docId) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const rows: Record<string, ComplyRow> = {};
            for (const [k, row] of Object.entries(p.rows)) {
              rows[k] = {
                ...row,
                refs: row.refs.filter((r) => r.docId !== docId),
              };
            }
            return {
              ...p,
              docs: p.docs.filter((d) => d.id !== docId),
              rows,
            };
          }),
        })),

      setRow: (projectId, requirementId, patch) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const prev = p.rows[requirementId] ?? {
              requirementId,
              bidderText: "",
              compareText: "",
              refs: [],
            };
            return {
              ...p,
              rows: {
                ...p.rows,
                [requirementId]: { ...prev, ...patch, requirementId },
              },
            };
          }),
        })),

      addRef: (projectId, requirementId, ref) => {
        const p = get().projects.find((x) => x.id === projectId);
        const prev = p?.rows[requirementId];
        get().setRow(projectId, requirementId, {
          refs: [...(prev?.refs ?? []), ref],
        });
      },

      removeRef: (projectId, requirementId, index) => {
        const p = get().projects.find((x) => x.id === projectId);
        const prev = p?.rows[requirementId];
        if (!prev) return;
        get().setRow(projectId, requirementId, {
          refs: prev.refs.filter((_, i) => i !== index),
        });
      },
    }),
    { name: "tor-comply-mvp-v1-compare" }
  )
);

export function selectActive(projects: Project[], activeId: string | null) {
  return projects.find((p) => p.id === activeId) ?? null;
}
