import { migrateProject, projectFileIds, validateMark, STATUS } from './projectModel.mjs';
export const ARCHIVE_VERSION = 1;
export const MAX_ARCHIVE_BYTES = 160 * 1024 * 1024;
export function validateManifest(data) {
  if (data?.format !== 'tor-comply-project' || data.version !== ARCHIVE_VERSION) throw new Error('ไม่รองรับรุ่นไฟล์โครงการนี้');
  const p = data.project;
  if (!p || typeof p.name !== 'string' || p.name.length > 160 || !Array.isArray(p.requirements) || !Array.isArray(p.docs) || !Array.isArray(p.products) || !Array.isArray(p.evidence) || !p.rows || !Array.isArray(data.files)) throw new Error('โครงสร้างไฟล์โครงการไม่ถูกต้อง');
  if (p.requirements.length > 5000 || p.docs.length > 250 || p.evidence.length > 25000) throw new Error('โครงการมีข้อมูลเกินขนาดที่รองรับ');
  for (const key of ['requirements','docs','products','evidence']) {
    const ids = p[key].map(i => i.id);
    if (ids.some(id => typeof id !== 'string' || !id.trim() || id.length>120 || /[\u0000-\u001f]/u.test(id) || ['__proto__','constructor','prototype'].includes(id)) || new Set(ids).size !== ids.length) throw new Error('รหัสข้อมูลซ้ำหรือไม่ถูกต้อง');
  }
  for (const req of p.requirements) if (typeof req.textSnapshot !== 'string' || req.textSnapshot.length > 100000) throw new Error('ข้อความ TOR ไม่ถูกต้อง');
  if(Object.keys(p.rows).length!==p.requirements.length||p.requirements.some(req=>!Object.hasOwn(p.rows,req.id)))throw new Error('คำตอบไม่ตรงกับเลขข้อ TOR');
  for (const d of p.docs) if (!['product','service','bidder'].includes(d.role) || !Number.isInteger(d.pageCount) || d.pageCount < 1 || !Array.isArray(d.itemIds) || d.itemIds.some(id=>!p.products.some(i=>i.id===id))) throw new Error('ประเภทหรือการผูกไฟล์หลักฐานไม่ถูกต้อง');
  for (const row of Object.values(p.rows)) if (!Array.isArray(row.itemIds) || row.itemIds.some(id=>!p.products.some(i=>i.id===id)) || !Object.values(STATUS).includes(row.comparison) || typeof row.proposal !== 'string') throw new Error('คำตอบในโครงการไม่ถูกต้อง');
  for (const mark of p.evidence) validateMark(p, mark);
  if (new Set(data.files.map(f=>f.id)).size !== data.files.length) throw new Error('ไฟล์แนบซ้ำ');
  const expected = projectFileIds(p);
  if (data.files.length !== expected.length || expected.some(id=>!data.files.some(f=>f.id===id))) throw new Error('ไฟล์แนบโครงการไม่ครบ');
  for (const file of data.files) if (!/^files\/\d+\.bin$/.test(file.path) || !/^metadata\/\d+\.json$/.test(file.metaPath) || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isInteger(file.size) || file.size<0) throw new Error('รายการไฟล์แนบไม่ถูกต้อง');
  if (data.files.reduce((n,f)=>n+f.size,0)>MAX_ARCHIVE_BYTES) throw new Error('ไฟล์โครงการใหญ่เกิน 160 MB');
  return migrateProject(p);
}
export function remapProject(project, makeId) {
  const mapping = Object.fromEntries(projectFileIds(project).map(id=>[id,makeId()]));
  return { mapping, project: { ...project, id: makeId(), name: project.name, torDocId: mapping[project.torDocId] || null, template: project.template ? {...project.template,id:mapping[project.template.id]} : null, docs: project.docs.map(d=>({...d,id:mapping[d.id]})), evidence: project.evidence.map(m=>({...m,id:makeId(),docId:mapping[m.docId]})) } };
}
