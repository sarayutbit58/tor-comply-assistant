import { keywordTerms, normalizeText, evaluateRequirement } from './complianceRules.mjs';
import { eligibleDocument, evidenceFor, rowMode } from './projectModel.mjs';
import {readingInBox,reconstructReading} from './readingModel.mjs';
export function unionBox(items) {
  const x = Math.min(...items.map(i => i.box[0])), y = Math.min(...items.map(i => i.box[1]));
  return [x,y,Math.min(1, Math.max(...items.map(i => i.box[0] + i.box[2]))) - x,Math.min(1, Math.max(...items.map(i => i.box[1] + i.box[3]))) - y];
}
export function textInBox(page, box) {
  return readingInBox(page,box);
}
const sameRegion=(a,b)=>a.docId===b.docId&&a.pdfPage===b.pdfPage&&a.box?.length===4&&a.box.every((v,i)=>Math.abs(v-b.box?.[i])<.003);
function scoreText(requirement,text) {
 const terms=keywordTerms(requirement),local=evaluateRequirement(requirement,[{id:'candidate',text}]);
 return terms.filter(t=>normalizeText(text).includes(t)).length+(local.status==='pass'?10:local.checks.some(c=>c.outcome==='fail'&&c.sourceIds?.includes('candidate'))?8:0);
}
export function pageCandidates(requirement, document, pages) {
  if (!eligibleDocument(document)) return [];
  const result = [];
  for (const page of pages) {
    const lines = reconstructReading(page.items || []).lines;
    for (let i = 0; i < lines.length; i++) {
      const items = lines[i].items;
      const text = lines[i].text;
      const score = scoreText(requirement,text);
      if (score && items.length) result.push({ id: document.id + ':' + page.page + ':' + i, docId: document.id, pdfPage: page.page, quote: text, keyword: text.slice(0,80), box: unionBox(items), sourceMethod: page.sourceMethod || 'text', reviewed: false, score });
    }
  }
  return result.sort((a,b) => b.score-a.score).filter((item,index,all) => !all.slice(0,index).some(old => old.pdfPage===item.pdfPage && Math.abs(old.box[1]-item.box[1]) < .015)).slice(0,8);
}
export function rankItems(project, requirement) {
  const terms = keywordTerms(requirement);
  return project.products.map(item => {
    const docs = project.docs.filter(d => eligibleDocument(d) && d.itemIds.includes(item.id));
    const text = normalizeText([item.name,item.brand,item.model,...docs.map(d=>d.searchText)].join(' '));
    const hint=evaluateRequirement(requirement,docs.map(d=>({id:d.id,text:d.searchText||''})));
    const matchedChecks=hint.checks.filter(c=>c.outcome==='pass').length;
    return { ...item, score: matchedChecks/hint.checks.length*100+terms.filter(t => text.includes(t)).length, matchedChecks,totalChecks:hint.checks.length,documentCount: docs.length };
  }).sort((a,b) => b.score-a.score);
}
export async function assessClause(project, requirementId, readFile) {
  const req = project.requirements.find(r => r.id === requirementId);
  const row = project.rows[requirementId];
  if (!req?.reviewed) throw new Error('ตรวจและยืนยันข้อความ TOR ข้อนี้ก่อนประเมิน');
  if (rowMode(project,requirementId)==='auto'&&(project.sourceCoveragePending||project.unreadablePages.length||project.requirements.some(r=>!r.reviewed))) throw new Error('ตรวจ TOR ครบทุกข้อและทุกหน้าก่อนใช้ Auto');
  if (!row.itemIds.length && row.scope!=='bidder') throw new Error('เลือกสินค้า/บริการที่จะใช้ร่วมกันก่อนประเมิน');
  const docs = project.docs.filter(d => eligibleDocument(d) && (row.scope==='bidder'?d.role==='bidder':d.itemIds.some(id => row.itemIds.includes(id))));
  let candidates = [];
  for (const doc of docs) {
    const file = await readFile(doc.id);
    if (!file) throw new Error('ไม่พบไฟล์ ' + doc.name + ' กรุณานำเข้าไฟล์โครงการที่มีเอกสารครบ');
    candidates.push(...pageCandidates(req.textSnapshot, doc, file.pages || []));
  }
  const manual = evidenceFor(project, requirementId).filter(m => {
    const doc = project.docs.find(d=>d.id===m.docId);
    return doc && eligibleDocument(doc) && (row.scope==='bidder'?doc.role==='bidder':doc.itemIds.some(id=>row.itemIds.includes(id)));
  });
  const saved=project.evidence.filter(m=>docs.some(d=>d.id===m.docId));
  candidates=candidates.map(c=>{const existing=saved.find(m=>sameRegion(m,c));return existing?{...existing,score:scoreText(req.textSnapshot,existing.quote)}:c;});
  for(const m of saved)if(!manual.some(old=>old.id===m.id)&&scoreText(req.textSnapshot,m.quote)>0)candidates.push({...m,score:scoreText(req.textSnapshot,m.quote)});
  candidates=candidates.filter((c,i,all)=>!manual.some(m=>sameRegion(m,c))&&!all.slice(0,i).some(m=>sameRegion(m,c)));
  const snippets = [...manual, ...candidates].map(m => ({...m,text:m.quote}));
  const assessment = evaluateRequirement(req.textSnapshot, snippets);
  if (snippets.some(s=>s.reviewed!==true)) {
    assessment.status = 'pending'; assessment.checks.push({label:'ตรวจต้นฉบับ',outcome:'pending',reason:'ตรวจข้อความหลักฐานที่อ้างและไฮไลต์ก่อนยืนยัน'});
  }
  const proposal = project.products.filter(i=>row.itemIds.includes(i.id)).map(i => [i.name,i.brand,i.model,i.provider].filter(Boolean).join(' ')).join(' + ') + '\n' + [...manual,...candidates].slice(0,3).map(c=>c.quote).join('\n');
  return { assessment, candidates, proposal };
}
