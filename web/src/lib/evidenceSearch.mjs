import { keywordTerms, normalizeText, evaluateRequirement } from './complianceRules.mjs';
import { eligibleDocument, evidenceFor, rowMode } from './projectModel.mjs';
export function unionBox(items) {
  const x = Math.min(...items.map(i => i.box[0])), y = Math.min(...items.map(i => i.box[1]));
  return [x,y,Math.min(1, Math.max(...items.map(i => i.box[0] + i.box[2]))) - x,Math.min(1, Math.max(...items.map(i => i.box[1] + i.box[3]))) - y];
}
export function textInBox(page, box) {
  return (page?.items || []).filter(({box: [x,y,w,h]}) => x+w > box[0] && x < box[0]+box[2] && y+h > box[1] && y < box[1]+box[3]).map(i => i.text).join(' ');
}
export function pageCandidates(requirement, document, pages) {
  if (!eligibleDocument(document)) return [];
  const terms = keywordTerms(requirement);
  const result = [];
  for (const page of pages) {
    let line = [];
    const lines = [];
    for (const item of page.items || []) {
      if (line.length && Math.abs(item.box[1] - line[0].box[1]) > .008) { lines.push(line); line = []; }
      line.push(item);
      if (item.end) { lines.push(line); line = []; }
    }
    if (line.length) lines.push(line);
    for (let i = 0; i < lines.length; i++) {
      const items = lines.slice(i, i+2).flat();
      const text = items.map(it => it.text).join(' ');
      const normalized = normalizeText(text);
      const score = terms.filter(t => normalized.includes(t)).length + (evaluateRequirement(requirement, [{id:'candidate',text}]).status === 'pass' ? 10 : 0);
      if (score && items.length) result.push({ id: document.id + ':' + page.page + ':' + i, docId: document.id, pdfPage: page.page, quote: text, keyword: text.slice(0,80), box: unionBox(items), sourceMethod: page.sourceMethod || 'text', reviewed: page.sourceMethod !== 'ocr', score });
    }
  }
  return result.sort((a,b) => b.score-a.score).filter((item,index,all) => !all.slice(0,index).some(old => old.pdfPage===item.pdfPage && Math.abs(old.box[1]-item.box[1]) < .015)).slice(0,8);
}
export function rankItems(project, requirement) {
  const terms = keywordTerms(requirement);
  return project.products.map(item => {
    const docs = project.docs.filter(d => eligibleDocument(d) && d.itemIds.includes(item.id));
    const text = normalizeText([item.name,item.brand,item.model,...docs.map(d=>d.searchText)].join(' '));
    return { ...item, score: terms.filter(t => text.includes(t)).length, documentCount: docs.length };
  }).sort((a,b) => b.score-a.score);
}
export async function assessClause(project, requirementId, readFile) {
  const req = project.requirements.find(r => r.id === requirementId);
  const row = project.rows[requirementId];
  if (!req?.reviewed) throw new Error('ตรวจและยืนยันข้อความ TOR ข้อนี้ก่อนประเมิน');
  if (rowMode(project,requirementId)==='auto'&&(project.unreadablePages.length||project.requirements.some(r=>!r.reviewed))) throw new Error('ตรวจ TOR ครบทุกข้อและทุกหน้าก่อนใช้ Auto');
  if (!row.itemIds.length && row.scope!=='bidder') throw new Error('เลือกสินค้า/บริการที่จะใช้ร่วมกันก่อนประเมิน');
  const docs = project.docs.filter(d => eligibleDocument(d) && (row.scope==='bidder'?d.role==='bidder':d.itemIds.some(id => row.itemIds.includes(id))));
  const candidates = [];
  for (const doc of docs) {
    const file = await readFile(doc.id);
    if (!file) throw new Error('ไม่พบไฟล์ ' + doc.name + ' กรุณานำเข้าไฟล์โครงการที่มีเอกสารครบ');
    candidates.push(...pageCandidates(req.textSnapshot, doc, file.pages || []));
  }
  const manual = evidenceFor(project, requirementId).filter(m => {
    const doc = project.docs.find(d=>d.id===m.docId);
    return doc && eligibleDocument(doc) && (row.scope==='bidder'?doc.role==='bidder':doc.itemIds.some(id=>row.itemIds.includes(id)));
  });
  const snippets = [...manual, ...candidates].map(m => ({...m,text:m.quote}));
  const assessment = evaluateRequirement(req.textSnapshot, snippets);
  if (snippets.some(s=>s.sourceMethod==='ocr'&&!s.reviewed)) {
    assessment.status = 'pending'; assessment.checks.push({label:'OCR',outcome:'pending',reason:'ตรวจข้อความหลักฐาน OCR ที่อ้างก่อนยืนยัน'});
  }
  const proposal = project.products.filter(i=>row.itemIds.includes(i.id)).map(i => [i.name,i.brand,i.model].filter(Boolean).join(' ')).join(' + ') + '\n' + candidates.slice(0,3).map(c=>c.quote).join('\n');
  return { assessment, candidates, proposal };
}
