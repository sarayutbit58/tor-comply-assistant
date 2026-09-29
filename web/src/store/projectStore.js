'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { reviewComparison } from '@/lib/torModel.mjs';

const pending = 'รอตรวจสอบ';
const newId = () => crypto.randomUUID();
const emptyRow = requirementId => ({ requirementId, proposal: '', comparison: pending, productId: null });

const safeStorage = {
  getItem(name) { try { return typeof window === 'undefined' ? null : window.localStorage.getItem(name); } catch { return null; } },
  setItem(name, value) { try { window.localStorage.setItem(name, value); } catch { window.dispatchEvent(new Event('tor-storage-error')); } },
  removeItem(name) { try { window.localStorage.removeItem(name); } catch { /* browser storage disabled */ } },
};

export const useProjectStore = create()(persist((set, get) => ({
  projects: [],

  createProject({ name, torDocId = null, torFilename = '', requirements = [], unreadablePages = [] }) {
    const id = newId();
    const rows = Object.fromEntries(requirements.map(requirement => [requirement.id, emptyRow(requirement.id)]));
    const project = { id, name: name.trim() || 'โครงการใหม่', torDocId, torFilename, createdAt: new Date().toISOString(), requirements, unreadablePages, ocrPages: [], products: [], docs: [], evidence: [], rows };
    set(state => ({ projects: [project, ...state.projects] }));
    return id;
  },

  rename(projectId, name) {
    set(state => ({ projects: state.projects.map(project => project.id === projectId ? { ...project, name } : project) }));
  },

  deleteProject(projectId) {
    set(state => ({ projects: state.projects.filter(project => project.id !== projectId) }));
  },

  addRequirements(projectId, incoming, ocrPage = null) {
    set(state => ({ projects: state.projects.map(project => {
      if (project.id !== projectId) return project;
      const ids = new Set(project.requirements.map(requirement => requirement.id));
      const additions = incoming.filter(requirement => {
        if (ids.has(requirement.id)) return false;
        ids.add(requirement.id);
        return true;
      });
      const rows = { ...project.rows };
      for (const requirement of additions) rows[requirement.id] = emptyRow(requirement.id);
      return {
        ...project,
        requirements: [...project.requirements, ...additions],
        rows,
        unreadablePages: ocrPage === null ? project.unreadablePages : project.unreadablePages.filter(page => page !== ocrPage),
        ocrPages: ocrPage === null ? project.ocrPages : [...project.ocrPages, ocrPage],
      };
    }) }));
  },

  updateRequirement(projectId, requirementId, patch) {
    set(state => ({ projects: state.projects.map(project => {
      if (project.id !== projectId) return project;
      const current = project.requirements.find(item => item.id === requirementId);
      if (!current) throw new Error('ไม่พบข้อ TOR');
      const nextId = patch.id?.trim() || requirementId;
      if (nextId !== requirementId && project.requirements.some(item => item.id === nextId)) throw new Error('เลขข้อ TOR ซ้ำ');
      const next = { ...current, ...patch, id: nextId, sourceMethod: current.sourceMethod === 'ocr' ? 'ocr-reviewed' : current.sourceMethod };
      const requirements = project.requirements.map(item => item.id === requirementId ? next : item);
      const changed = nextId !== requirementId || next.textSnapshot !== current.textSnapshot || next.title !== current.title;
      const rows = { ...project.rows };
      const row = rows[requirementId] || emptyRow(requirementId);
      if (nextId !== requirementId) delete rows[requirementId];
      rows[nextId] = { ...row, requirementId: nextId, comparison: changed ? pending : row.comparison };
      return { ...project, requirements, rows, evidence: project.evidence.map(item => item.requirementId === requirementId ? { ...item, requirementId: nextId } : item) };
    }) }));
  },

  deleteRequirement(projectId, requirementId) {
    set(state => ({ projects: state.projects.map(project => {
      if (project.id !== projectId) return project;
      const rows = { ...project.rows };
      delete rows[requirementId];
      return { ...project, requirements: project.requirements.filter(item => item.id !== requirementId), evidence: project.evidence.filter(item => item.requirementId !== requirementId), rows };
    }) }));
  },

  addProduct(projectId, name, model) {
    const id = newId();
    set(state => ({ projects: state.projects.map(project => project.id === projectId ? { ...project, products: [...project.products, { id, name: name.trim(), model: model.trim() }] } : project) }));
    return id;
  },

  addDocument(projectId, document) {
    set(state => ({ projects: state.projects.map(project => project.id === projectId ? { ...project, docs: [...project.docs, document] } : project) }));
  },

  removeDocument(projectId, docId) {
    set(state => ({ projects: state.projects.map(project => {
      if (project.id !== projectId) return project;
      const evidence = project.evidence.filter(item => item.docId !== docId);
      const rows = { ...project.rows };
      for (const item of project.evidence.filter(entry => entry.docId === docId)) {
        rows[item.requirementId] = { ...rows[item.requirementId], comparison: pending };
      }
      return { ...project, docs: project.docs.filter(item => item.id !== docId), evidence, rows };
    }) }));
  },

  addEvidence(projectId, evidence) {
    const project = get().projects.find(item => item.id === projectId);
    if (!project?.requirements.some(item => item.id === evidence.requirementId)) throw new Error('ไม่พบข้อ TOR');
    const document = project.docs.find(item => item.id === evidence.docId);
    if (!document || evidence.pdfPage < 1 || evidence.pdfPage > document.pageCount) throw new Error('หน้าเอกสารไม่ถูกต้อง');
    const [x, y, width, height] = evidence.box;
    if (!(x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1 && y + height <= 1)) throw new Error('กรอบไฮไลต์ไม่ถูกต้อง');
    set(state => ({ projects: state.projects.map(item => item.id === projectId ? { ...item, evidence: [...item.evidence, { ...evidence, id: newId() }] } : item) }));
  },

  removeEvidence(projectId, evidenceId) {
    set(state => ({ projects: state.projects.map(project => {
      if (project.id !== projectId) return project;
      const removed = project.evidence.find(item => item.id === evidenceId);
      if (!removed) return project;
      return { ...project, evidence: project.evidence.filter(item => item.id !== evidenceId), rows: { ...project.rows, [removed.requirementId]: { ...project.rows[removed.requirementId], comparison: pending } } };
    }) }));
  },

  setRow(projectId, requirementId, patch) {
    set(state => ({ projects: state.projects.map(project => {
      if (project.id !== projectId) return project;
      const previous = project.rows[requirementId] || emptyRow(requirementId);
      const next = { ...previous, ...patch, requirementId };
      if (!('comparison' in patch) && (next.proposal !== previous.proposal || next.productId !== previous.productId)) next.comparison = pending;
      next.comparison = reviewComparison({ proposal: next.proposal, comparison: next.comparison, productId: next.productId, evidence: project.evidence.filter(item => item.requirementId === requirementId), docs: project.docs });
      return { ...project, rows: { ...project.rows, [requirementId]: next } };
    }) }));
  },
}), {
  name: 'tor-comply-web-v2',
  storage: createJSONStorage(() => safeStorage),
  partialize: state => ({ projects: state.projects }),
}));
