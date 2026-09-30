import {eligibleDocument,evidenceFor} from './projectModel.mjs';
const normalized=text=>String(text||'').replace(/\s+/g,' ').trim();
export function clauseFingerprint(project,id) {
  if(!project)return '';
  const row=project.rows[id],req=project.requirements.find(r=>r.id===id);
  return JSON.stringify({
    id:project.id,req,row,mode:project.mode,unreadable:project.unreadablePages,
    reviews:project.requirements.map(r=>[r.id,r.reviewed]),
    products:project.products.filter(p=>row?.itemIds?.includes(p.id)),
    docs:project.docs.filter(d=>eligibleDocument(d)&&(row?.scope==='bidder'?d.role==='bidder':d.itemIds.some(i=>row?.itemIds?.includes(i)))),
    evidence:evidenceFor(project,id),
  });
}
export function aiCandidates(project,id,candidates) {
  const row=project.rows[id];
  const docs=project.docs.filter(d=>eligibleDocument(d)&&(row.scope==='bidder'?d.role==='bidder':d.itemIds.some(i=>row.itemIds.includes(i))));
  const ids=new Set(docs.map(d=>d.id)),seen=new Set(),physical=[];
  return [...evidenceFor(project,id),...candidates].filter(c=>{
    if(!ids.has(c.docId)||!c.quote?.trim()||seen.has(c.id))return false;
    if(physical.some(old=>old.docId===c.docId&&old.pdfPage===c.pdfPage&&normalized(old.quote)===normalized(c.quote)&&old.box?.every((value,i)=>Math.abs(value-c.box?.[i])<.003)))return false;
    seen.add(c.id);physical.push(c);return true;
  }).slice(0,16).map(c=>({...c,role:docs.find(d=>d.id===c.docId).role}));
}
export function validateDraft(result,requirement,candidates) {
  if(!Array.isArray(result?.conditions)||!result.conditions.length||result.conditions.length>24||!Array.isArray(result.draft)||result.draft.length>12)throw new Error('ผล LLM ไม่ตรงรูปแบบที่ตรวจสอบได้');
  for(const condition of result.conditions) {
    if(typeof condition.sourceQuote!=='string'||!normalized(condition.sourceQuote)||!normalized(requirement).includes(normalized(condition.sourceQuote))||typeof condition.description!=='string'||condition.description.length>2000)throw new Error('เงื่อนไข LLM ไม่มีข้อความตาม TOR ต้นฉบับ');
  }
  for(const statement of result.draft) {
    if(typeof statement.text!=='string'||!statement.text.trim()||statement.text.length>4000||!Array.isArray(statement.citations)||!statement.citations.length||statement.citations.length>8)throw new Error('ร่างคำตอบไม่มีเอกสารอ้างอิง');
    for(const citation of statement.citations) {
      const source=candidates.find(c=>c.id===citation.id);
      if(!source||typeof citation.quote!=='string'||!normalized(citation.quote)||!normalized(source.quote).includes(normalized(citation.quote)))throw new Error('ข้อความอ้างอิง LLM ไม่อยู่ในหลักฐานที่ส่ง');
    }
  }
  return {
    conditions:result.conditions.map(c=>({sourceQuote:c.sourceQuote,description:c.description})),
    draft:result.draft.map(s=>({text:s.text,citations:s.citations.map(c=>({id:c.id,quote:c.quote}))})),
  };
}
export function validateSemantic(result,candidates) {
  if(typeof result?.model!=='string'||!/^jev-(latest|\d+\.\d+(?:\.\d+)?)$/.test(result.model)||!result.answers)throw new Error('ผล TypeSafe ไม่ตรงรูปแบบ');
  const answers={};
  for(let i=0;i<candidates.length;i++) {
    const answer=result.answers['e'+i],rank=result.answers['r'+i];
    if(answer?.type!=='choice'||!['supports','contradicts','not_mentioned','unclear'].includes(answer.choice)||!Number.isFinite(answer.confidence)||answer.confidence<0||answer.confidence>1||
       rank?.type!=='noul'||!Number.isFinite(rank.noul)||rank.noul<0||rank.noul>1)throw new Error('ผล TypeSafe ไม่ครบหรือค่าความน่าจะเป็นผิด');
    answers['e'+i]={type:'choice',choice:answer.choice,confidence:answer.confidence};
    answers['r'+i]={type:'noul',noul:rank.noul};
  }
  return {model:result.model,answers};
}
