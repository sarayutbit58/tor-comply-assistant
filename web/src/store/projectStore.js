'use client';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { uniqueRequirements } from '@/lib/torModel.mjs';
import { STATUS, emptyResponse, migrateProject, linkedRequirements, mergeMark, passProblems, eligibleDocument } from '@/lib/projectModel.mjs';
import {appendRequirements,replaceRequirement,removeRequirement,updateOffering,removeOffering,updateDocumentMetadata,removeDocumentMetadata,updateEvidenceMark,resolveSourcePage,acceptReadingRepair} from '@/lib/projectMutations.mjs';
import {recoverMetadata} from '@/lib/workflowModel.mjs';
const newId = () => crypto.randomUUID();
const invalidate = (rows, ids) => Object.fromEntries(Object.entries(rows).map(([id, row]) => [id, ids.includes(id) ? { ...row, comparison: STATUS.pending, assessment: null, decisionSource: null } : row]));
const safeStorage = {
  getItem(name) { try { return typeof window === 'undefined' ? null : window.localStorage.getItem(name); } catch { return null; } },
  setItem(name, value) { try { window.localStorage.setItem(name, value); } catch { window.dispatchEvent(new Event('tor-storage-error')); throw new Error('พื้นที่เก็บข้อมูลเบราว์เซอร์เต็มหรือถูกปิด ส่งออกโครงการเพื่อสำรองงาน'); } },
  removeItem(name) { window.localStorage.removeItem(name); },
};
export const useProjectStore = create()(persist((set, get) => {
  let revision=0;
  const edit = (id, transform, undoable=false) => set(state => {
    const before=state.projects.find(p=>p.id===id);if(!before)throw new Error('ไม่พบโครงการ');
    revision=Math.max(Date.now(),revision+1);
    const next={...transform(before),updatedAt:new Date(revision).toISOString()};
    return {projects:state.projects.map(p=>p.id===id?next:p),undo:undoable?{before,revision:next.updatedAt}:null};
  });
  return {
    projects: [],
    undo:null,
    undoLast(id){const p=get().projects.find(p=>p.id===id),restored=recoverMetadata(p,get().undo);edit(id,()=>restored);},
    createProject({ name, torDocId = null, torFilename = '', requirements = [], unreadablePages = [], mode = 'manual', domain = 'Internet', template = null, sourceType = 'tor', sourceTable = null,sourceWarnings=[],sourceUnresolvedRows=[],sourcePageCount=null }) {
      const id = newId();
      const distinct = uniqueRequirements(requirements);
      const project = migrateProject({ id, name: name.trim() || 'โครงการใหม่', createdAt: new Date().toISOString(), torDocId, torFilename, requirements: distinct, unreadablePages, mode, domain, template, sourceType, sourceTable,sourceWarnings,sourceUnresolvedRows,sourcePageCount,sourceCoveragePending:sourceWarnings.length>0||sourceUnresolvedRows.length>0, rows: {} });
      set(state => ({ projects: [project, ...state.projects] }));
      return id;
    },
    importProject(project) {
      set(state => ({ projects: [migrateProject(project), ...state.projects] }));
      return project.id;
    },
    rename(id, name) { edit(id, p => ({ ...p, name })); },
    settings(id, patch) { edit(id, p => ({ ...p, ...patch, rows: patch.mode==='manual'?invalidate(p.rows,Object.entries(p.rows).filter(([,r])=>!r.mode&&r.decisionSource==='auto').map(([id])=>id)):p.rows })); },
    deleteProject(id) { set(state => ({ projects: state.projects.filter(p => p.id !== id) })); },
    addRequirements(id, incoming, ocrPage = null,options={}) {
      const project = get().projects.find(p => p.id === id);
      const additions = uniqueRequirements(incoming, project.requirements).map(r => ({...r,reviewed:false}));
      edit(id,p=>appendRequirements(p,incoming,{...options,ocrPage}));
      return additions;
    },
    updateRequirement(id, reqId, patch) {
      edit(id,p=>replaceRequirement(p,reqId,patch),true);
    },
    deleteRequirement(id, reqId) {
      edit(id,p=>removeRequirement(p,reqId),true);
    },
    resolveTorPage(id,page,options){edit(id,p=>resolveSourcePage(p,page,options));},
    setSourcePageCount(id,count){if(!Number.isInteger(count)||count<1)throw new Error('จำนวนหน้า TOR ไม่ถูกต้อง');if(get().projects.find(p=>p.id===id)?.sourcePageCount===count)return;edit(id,p=>({...p,sourcePageCount:count}));},
    confirmSourceCoverage(id,{confirmed,reason}){if(confirmed!==true||!String(reason||'').trim())throw new Error('ตรวจต้นฉบับทุกแถวและระบุผลการตรวจความครบถ้วนก่อน');edit(id,p=>({...p,sourceCoveragePending:false,sourceCoverageResolution:{reason:String(reason).trim(),confirmedAt:new Date().toISOString()},rows:invalidate(p.rows,p.requirements.map(r=>r.id))}));},
    updateProduct(id,itemId,patch){edit(id,p=>updateOffering(p,itemId,patch),true);},
    updateDocument(id,docId,patch){edit(id,p=>updateDocumentMetadata(p,docId,patch),true);},
    acceptSourceCorrection(id,reqId,patch,{confirmed,expectedText}={}){
      edit(id,p=>acceptReadingRepair(p,reqId,patch,{confirmed,expectedText}),true);
    },
    addProduct(id, item) {
      const itemId = newId();
      edit(id, p => ({ ...p, products: [...p.products, { ...item, id: itemId }] }));
      return itemId;
    },
    removeProduct(id, itemId) {
      edit(id,p=>removeOffering(p,itemId),true);
    },
    addDocument(id, document) {
      if (!eligibleDocument(document)) throw new Error('กรุณากำหนดประเภทเอกสารหลักฐาน');
      edit(id, p => ({ ...p, docs: [...p.docs, document] }));
    },
    removeDocument(id, docId) {
      edit(id,p=>removeDocumentMetadata(p,docId),true);
    },
    addEvidence(id, mark) {
      const evidenceId = newId();
      edit(id, p => ({ ...p, evidence: mergeMark(p, { ...mark, id: evidenceId }), rows: invalidate(p.rows, linkedRequirements(mark)) }));
      return evidenceId;
    },
    updateEvidence(id, evidenceId, patch) {
      edit(id,p=>updateEvidenceMark(p,evidenceId,patch),true);
    },
    removeEvidence(id, evidenceId, reqId) {
      edit(id, p => {
        const mark = p.evidence.find(m => m.id === evidenceId);
        if (!mark) return p;
        const remaining = reqId ? linkedRequirements(mark).filter(n => n !== reqId) : [];
        return { ...p, evidence: p.evidence.flatMap(m => m.id !== evidenceId ? [m] : remaining.length ? [{ ...m, requirementIds: remaining }] : []), rows: invalidate(p.rows, reqId ? [reqId] : linkedRequirements(mark)) };
      },true);
    },
    setRow(id, reqId, patch) {
      edit(id, p => {
        const previous = p.rows[reqId] || emptyResponse(reqId);
        const next = { ...previous, ...patch };
        if (!('comparison' in patch) && ('proposal' in patch || 'itemIds' in patch)) { next.comparison = STATUS.pending; next.assessment = null; next.decisionSource=null; }
        if('comparison' in patch)next.decisionSource='manual';
        if('mode' in patch&&(next.mode||p.mode)==='manual'&&previous.decisionSource==='auto'){next.comparison=STATUS.pending;next.decisionSource=null;}
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
        const row = { ...p.rows[reqId], assessment, proposal: p.rows[reqId].proposal || proposal, comparison: STATUS.pending, decisionSource: null };
        const result = { ...p, evidence, rows: { ...p.rows, [reqId]: row } };
        if ((row.mode || p.mode) === 'auto' && !p.sourceCoveragePending && !p.unreadablePages.length && p.requirements.every(r=>r.reviewed)) {
          if (assessment.status === 'fail') {row.comparison = STATUS.fail;row.decisionSource='auto';}
          if (assessment.status === 'pass' && !passProblems(result, reqId).length) {row.comparison = STATUS.pass;row.decisionSource='auto';}
        }
        return result;
      });
    },
  };
}, { name: 'tor-comply-web-v2', version: 4, storage: createJSONStorage(() => safeStorage), migrate: state => ({ projects: (state.projects || []).map(migrateProject) }), partialize: state => ({ projects: state.projects }) }));
