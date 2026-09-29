'use client';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { uniqueRequirements } from '@/lib/torModel.mjs';
import { STATUS, emptyResponse, migrateProject, linkedRequirements, mergeMark, passProblems, eligibleDocument } from '@/lib/projectModel.mjs';
const newId = () => crypto.randomUUID();
const invalidate = (rows, ids) => Object.fromEntries(Object.entries(rows).map(([id, row]) => [id, ids.includes(id) ? { ...row, comparison: STATUS.pending, assessment: null } : row]));
const safeStorage = {
  getItem(name) { try { return typeof window === 'undefined' ? null : window.localStorage.getItem(name); } catch { return null; } },
  setItem(name, value) { try { window.localStorage.setItem(name, value); } catch { window.dispatchEvent(new Event('tor-storage-error')); throw new Error('พื้นที่เก็บข้อมูลเบราว์เซอร์เต็มหรือถูกปิด ส่งออกโครงการเพื่อสำรองงาน'); } },
  removeItem(name) { window.localStorage.removeItem(name); },
};
export const useProjectStore = create()(persist((set, get) => {
  const edit = (id, transform) => set(state => ({ projects: state.projects.map(p => p.id === id ? { ...transform(p), updatedAt: new Date().toISOString() } : p) }));
  return {
    projects: [],
    createProject({ name, torDocId = null, torFilename = '', requirements = [], unreadablePages = [], mode = 'manual', domain = 'Internet' }) {
      const id = newId();
      const distinct = uniqueRequirements(requirements);
      const project = migrateProject({ id, name: name.trim() || 'โครงการใหม่', createdAt: new Date().toISOString(), torDocId, torFilename, requirements: distinct, unreadablePages, mode, domain, rows: {} });
      set(state => ({ projects: [project, ...state.projects] }));
      return id;
    },
    importProject(project) {
      set(state => ({ projects: [migrateProject(project), ...state.projects] }));
      return project.id;
    },
    rename(id, name) { edit(id, p => ({ ...p, name })); },
    settings(id, patch) { edit(id, p => ({ ...p, ...patch })); },
    deleteProject(id) { set(state => ({ projects: state.projects.filter(p => p.id !== id) })); },
    addRequirements(id, incoming, ocrPage = null) {
      const project = get().projects.find(p => p.id === id);
      const additions = uniqueRequirements(incoming, project.requirements).map(r => ({ ...r, reviewed: Boolean(r.reviewed) }));
      edit(id, p => ({ ...p, requirements: [...p.requirements, ...additions], rows: { ...p.rows, ...Object.fromEntries(additions.map(r => [r.id, emptyResponse(r.id)])) }, unreadablePages: p.unreadablePages.filter(n => n !== ocrPage), ocrPages: ocrPage ? [...new Set([...p.ocrPages, ocrPage])] : p.ocrPages }));
      return additions;
    },
    updateRequirement(id, reqId, patch) {
      edit(id, p => {
        const current = p.requirements.find(r => r.id === reqId);
        const nextId = patch.id?.trim() || reqId;
        if (nextId !== reqId && p.requirements.some(r => r.id === nextId)) throw new Error('เลขข้อ TOR ซ้ำ');
        if (!patch.textSnapshot?.trim()) throw new Error('ต้องมีข้อความ TOR');
        const next = { ...current, ...patch, id: nextId, reviewed: Boolean(patch.reviewed) };
        if (nextId !== reqId) delete next.duplicateOf;
        const rows = invalidate(p.rows, [reqId]);
        rows[nextId] = { ...rows[reqId], requirementId: nextId };
        if (nextId !== reqId) delete rows[reqId];
        return { ...p, requirements: p.requirements.map(r => r.id === reqId ? next : r), rows, evidence: p.evidence.map(mark => ({ ...mark, requirementIds: linkedRequirements(mark).map(n => n === reqId ? nextId : n) })) };
      });
    },
    deleteRequirement(id, reqId) {
      edit(id, p => {
        const rows = { ...p.rows }; delete rows[reqId];
        return { ...p, requirements: p.requirements.filter(r => r.id !== reqId), rows, evidence: p.evidence.map(m => ({ ...m, requirementIds: linkedRequirements(m).filter(n => n !== reqId) })).filter(m => m.requirementIds.length) };
      });
    },
    addProduct(id, item) {
      const itemId = newId();
      edit(id, p => ({ ...p, products: [...p.products, { ...item, id: itemId }] }));
      return itemId;
    },
    removeProduct(id, itemId) {
      edit(id, p => ({ ...p, products: p.products.filter(i => i.id !== itemId), docs: p.docs.map(d => ({ ...d, itemIds: d.itemIds.filter(n => n !== itemId) })), rows: Object.fromEntries(Object.entries(p.rows).map(([key, r]) => [key, r.itemIds.includes(itemId) ? { ...r, itemIds: r.itemIds.filter(n => n !== itemId), comparison: STATUS.pending, assessment: null } : r])) }));
    },
    addDocument(id, document) {
      if (!eligibleDocument(document)) throw new Error('กรุณากำหนดประเภทเอกสารหลักฐาน');
      edit(id, p => ({ ...p, docs: [...p.docs, document] }));
    },
    removeDocument(id, docId) {
      edit(id, p => ({ ...p, docs: p.docs.filter(d => d.id !== docId), rows: invalidate(p.rows, p.evidence.filter(m => m.docId === docId).flatMap(linkedRequirements)), evidence: p.evidence.filter(m => m.docId !== docId) }));
    },
    addEvidence(id, mark) {
      const evidenceId = newId();
      edit(id, p => ({ ...p, evidence: mergeMark(p, { ...mark, id: evidenceId }), rows: invalidate(p.rows, linkedRequirements(mark)) }));
      return evidenceId;
    },
    updateEvidence(id, evidenceId, patch) {
      edit(id, p => {
        const mark = p.evidence.find(m => m.id === evidenceId);
        const next = { ...mark, ...patch };
        return { ...p, evidence: p.evidence.map(m => m.id === evidenceId ? next : m), rows: invalidate(p.rows, [...linkedRequirements(mark), ...linkedRequirements(next)]) };
      });
    },
    removeEvidence(id, evidenceId, reqId) {
      edit(id, p => {
        const mark = p.evidence.find(m => m.id === evidenceId);
        if (!mark) return p;
        const remaining = reqId ? linkedRequirements(mark).filter(n => n !== reqId) : [];
        return { ...p, evidence: p.evidence.flatMap(m => m.id !== evidenceId ? [m] : remaining.length ? [{ ...m, requirementIds: remaining }] : []), rows: invalidate(p.rows, reqId ? [reqId] : linkedRequirements(mark)) };
      });
    },
    setRow(id, reqId, patch) {
      edit(id, p => {
        const previous = p.rows[reqId] || emptyResponse(reqId);
        const next = { ...previous, ...patch };
        if (!('comparison' in patch) && ('proposal' in patch || 'itemIds' in patch)) { next.comparison = STATUS.pending; next.assessment = null; }
        const result = { ...p, rows: { ...p.rows, [reqId]: next } };
        if (next.comparison === STATUS.pass) {
          const errors = passProblems(result, reqId);
          if (errors.length) throw new Error(errors.join(' · '));
        }
        return result;
      });
    },
    applyAssessment(id, reqId, assessment, candidates, proposal) {
      edit(id, p => {
        let evidence = p.evidence;
        for (const mark of candidates) evidence = mergeMark({ ...p, evidence }, { ...mark, id: newId(), requirementIds: [reqId] });
        const row = { ...p.rows[reqId], assessment, proposal: p.rows[reqId].proposal || proposal, comparison: STATUS.pending };
        const result = { ...p, evidence, rows: { ...p.rows, [reqId]: row } };
        if ((row.mode || p.mode) === 'auto' && !p.unreadablePages.length && p.requirements.every(r=>r.reviewed)) {
          if (assessment.status === 'fail') row.comparison = STATUS.fail;
          if (assessment.status === 'pass' && !passProblems(result, reqId).length) row.comparison = STATUS.pass;
        }
        return result;
      });
    },
  };
}, { name: 'tor-comply-web-v2', version: 3, storage: createJSONStorage(() => safeStorage), migrate: state => ({ projects: (state.projects || []).map(migrateProject) }), partialize: state => ({ projects: state.projects }) }));
