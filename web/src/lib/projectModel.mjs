export const STATUS = { pass: 'ตรงตามข้อกำหนด', fail: 'ไม่ตรงตามข้อกำหนด', pending: 'รอตรวจสอบ' };
export const FILE_ROLES = { tor: 'TOR ต้นฉบับ', product: 'หลักฐานสินค้า', service: 'หลักฐานบริการ', bidder: 'หลักฐานคุณสมบัติผู้ยื่นข้อเสนอ', template: 'แม่แบบตาราง Comply' };
export const EVIDENCE_ROLES = new Set(['product', 'service', 'bidder']);
export const linkedRequirements = mark => mark.requirementIds || (mark.requirementId ? [mark.requirementId] : []);
export const selectedItems = row => row?.itemIds || (row?.productId ? [row.productId] : []);
export function eligibleDocument(document) { return EVIDENCE_ROLES.has(document.role); }
export function evidenceFor(project, id) { return project.evidence.filter(mark => linkedRequirements(mark).includes(id)); }
export function rowMode(project, id) { return project.rows[id]?.mode || project.mode || 'manual'; }
export function emptyResponse(id) { return { requirementId: id, itemIds: [], proposal: '', comparison: STATUS.pending, mode: null, assessment: null }; }
export function migrateProject(project) {
  const requirements = (project.requirements || []).map(req => ({ ...req, reviewed: Boolean(req.reviewed), sourceMethod: req.sourceMethod || 'text' }));
  return {
    ...project, schemaVersion: 3, mode: project.mode || 'manual', domain: project.domain || 'Internet',
    requirements, unreadablePages: project.unreadablePages || [], ocrPages: project.ocrPages || [], template: project.template || null,
    products: (project.products || []).map(item => ({ ...item, kind: item.kind || 'product', brand: item.brand || '' })),
    docs: (project.docs || []).map(doc => ({ ...doc, role: doc.role || (doc.productId ? 'product' : 'bidder'), itemIds: doc.itemIds || (doc.productId ? [doc.productId] : []) })),
    evidence: (project.evidence || []).map(mark => ({ ...mark, requirementIds: linkedRequirements(mark), quote: mark.quote || mark.keyword || '', reviewed: Boolean(mark.reviewed), sourceMethod: mark.sourceMethod || 'text' })),
    rows: Object.fromEntries(requirements.map(req => [req.id, { ...emptyResponse(req.id), ...project.rows?.[req.id], itemIds: selectedItems(project.rows?.[req.id]) }])),
  };
}
export function validateMark(project, mark) {
  const doc = project.docs.find(d => d.id === mark.docId);
  if (!doc || !eligibleDocument(doc)) throw new Error('ไฟล์ TOR และแม่แบบใช้เป็นหลักฐานไม่ได้');
  if (!linkedRequirements(mark).length || linkedRequirements(mark).some(id => !project.requirements.some(r => r.id === id))) throw new Error('ไม่พบข้อ TOR ที่ผูกหลักฐาน');
  if (!Number.isInteger(mark.pdfPage) || mark.pdfPage < 1 || mark.pdfPage > doc.pageCount) throw new Error('หน้าเอกสารไม่ถูกต้อง');
  const [x, y, w, h] = mark.box || [];
  if (![x, y, w, h].every(Number.isFinite) || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1.001 || y + h > 1.001) throw new Error('กรอบไฮไลต์ไม่ถูกต้อง');
}
export function mergeMark(project, incoming) {
  validateMark(project, incoming);
  const existing = project.evidence.find(mark => mark.docId === incoming.docId && mark.pdfPage === incoming.pdfPage && mark.box.every((v, i) => Math.abs(v - incoming.box[i]) < .003));
  if (!existing) return [...project.evidence, incoming];
  return project.evidence.map(mark => mark.id === existing.id ? { ...mark, requirementIds: [...new Set([...linkedRequirements(mark), ...linkedRequirements(incoming)])] } : mark);
}
export function passProblems(project, id) {
  const req = project.requirements.find(r => r.id === id);
  const row = project.rows[id];
  const marks = evidenceFor(project, id);
  const problems = [];
  if (!req?.reviewed) problems.push('ยังไม่ได้ตรวจ TOR');
  if (!row?.proposal.trim()) problems.push('ยังไม่มีรายละเอียดที่เสนอ');
  if (!selectedItems(row).length && row?.scope!=='bidder') problems.push('ยังไม่ได้เลือกสินค้า/บริการ');
  if (!marks.length) problems.push('ยังไม่มีหลักฐาน');
  if (marks.some(m => m.sourceMethod === 'ocr' && !m.reviewed)) problems.push('ยังไม่ได้ตรวจข้อความหลักฐาน OCR');
  const docs = marks.map(m => project.docs.find(d => d.id === m.docId)).filter(Boolean);
  if (row?.scope==='bidder'&&!docs.some(d=>d.role==='bidder')) problems.push('ยังไม่มีหลักฐานคุณสมบัติผู้ยื่นข้อเสนอ');
  if (marks.some(m=>!m.quote?.trim())) problems.push('หลักฐานไม่มีข้อความที่อ้าง');
  if (docs.some(d => !eligibleDocument(d))) problems.push('ประเภทไฟล์หลักฐานไม่ถูกต้อง');
  for (const itemId of selectedItems(row)) if (!docs.some(doc => doc.itemIds?.includes(itemId))) problems.push('หลักฐานยังไม่ครบทุกรายการที่ใช้ร่วมกัน');
  return [...new Set(problems)];
}
export function exportProblems(project) {
  const errors = [];
  if (project.requirements.some(r => r.duplicateOf)) errors.push('แก้เลขข้อ TOR ซ้ำก่อนส่งออก');
  if (project.unreadablePages.length) errors.push('ยังมีหน้า TOR ที่ต้อง OCR');
  if (project.requirements.some(r => !r.reviewed)) errors.push('ตรวจและยืนยัน TOR ทุกข้อก่อนส่งออก');
  if (project.evidence.some(m => m.sourceMethod === 'ocr' && !m.reviewed)) errors.push('ตรวจข้อความหลักฐาน OCR ที่อ้างก่อนส่งออก');
  for (const req of project.requirements) if (project.rows[req.id]?.comparison === STATUS.pass) errors.push(...passProblems(project, req.id).map(e => 'ข้อ ' + req.id + ': ' + e));
  return [...new Set(errors)];
}
export function referenceText(project, id) {
  return evidenceFor(project, id).map(mark => {
    const doc = project.docs.find(d => d.id === mark.docId);
    return (doc?.name || mark.docId) + ' · ' + (mark.printedPage ? 'หน้า ' + mark.printedPage + ' (PDF ' + mark.pdfPage + ')' : 'หน้า PDF ' + mark.pdfPage);
  }).join('\n');
}
export function projectFileIds(project) {
  return [...new Set([project.torDocId, project.template?.id, ...project.docs.map(d => d.id)].filter(Boolean))];
}
