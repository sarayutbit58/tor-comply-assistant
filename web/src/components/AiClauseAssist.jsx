'use client';
import {useEffect,useState} from 'react';
import {useProjectStore} from '@/store/projectStore';
import {aiSession} from '@/lib/aiSession.mjs';
import {aiCandidates,clauseFingerprint,validateDraft,validateSemantic} from '@/lib/aiIntegrity.mjs';
import {assessClause} from '@/lib/evidenceSearch.mjs';
import {getFile} from '@/lib/localFiles';
import {useAiSession} from './AiSettings';
const LABELS={supports:'รองรับตามข้อความ',contradicts:'ขัดแย้ง',not_mentioned:'ไม่กล่าวถึง',unclear:'บางส่วน / ยังไม่ชัดเจน'};
export function AiClauseAssist({project,requirement,run,busy}) {
  const session=useAiSession(),[result,setResult]=useState(null),[reviewed,setReviewed]=useState(false);
  const fingerprint=clauseFingerprint(project,requirement.id);
  useEffect(()=>{setResult(null);setReviewed(false);},[fingerprint]);
  useEffect(()=>{setResult(null);setReviewed(false);},[session]);
  async function request(kind) {
    setResult(null);setReviewed(false);
    await run(async()=>{
      const ticket=aiSession.capture(kind==='draft'?'openai':'typesafe');
      const snapshot=useProjectStore.getState().projects.find(p=>p.id===project.id),captured=clauseFingerprint(snapshot,requirement.id);
      const assessed=await assessClause(snapshot,requirement.id,getFile);
      const candidates=aiCandidates(snapshot,requirement.id,assessed.candidates);
      if(clauseFingerprint(useProjectStore.getState().projects.find(p=>p.id===project.id),requirement.id)!==captured)throw new Error('ข้อมูลข้อ TOR เปลี่ยนแล้ว กรุณาเรียกใหม่');
      const payload={requirement:requirement.textSnapshot,candidates:candidates.map(c=>({id:c.id,quote:c.quote,role:c.role}))};
      const response=await aiSession.request(kind==='draft'?'openai':'typesafe',kind,payload,ticket);
      if(clauseFingerprint(useProjectStore.getState().projects.find(p=>p.id===project.id),requirement.id)!==captured)throw new Error('ข้อมูลข้อ TOR/สินค้า/หลักฐานเปลี่ยน ผล AI เดิมจึงไม่ถูกใช้');
      if(kind==='draft')validateDraft(response.result,requirement.textSnapshot,candidates);
      else validateSemantic(response,candidates);
      setResult({kind,response,candidates,fingerprint:captured,ticket});
    },'AI เสนอผลแล้ว ตรวจข้อความและหลักฐานก่อนใช้ · ยังไม่เปลี่ยนผล Comply');
  }
  function applyDraft() {
    if(!result||!reviewed||result.fingerprint!==clauseFingerprint(useProjectStore.getState().projects.find(p=>p.id===project.id),requirement.id))return;
    run(async()=>{
      aiSession.assertTicket(result.ticket);
      useProjectStore.getState().setRow(project.id,requirement.id,{proposal:result.response.result.draft.map(s=>s.text).join('\n')});
    },'ใช้ร่างคำตอบแล้ว · ประเมินกฎและตรวจหลักฐานก่อนยืนยันผล');
  }
  function openSource(candidate) {
    window.dispatchEvent(new CustomEvent('tor-open-ai-source',{detail:{projectId:project.id,requirementId:requirement.id,docId:candidate.docId,page:candidate.pdfPage,box:candidate.box}}));
  }
  return <details className="ai-clause-assist"><summary>AI ช่วยข้อนี้ · ช่วงทดสอบ</summary>
    <p className="muted">ส่ง TOR ข้อนี้และข้อความหลักฐานของรายการที่เลือก กฎตัวเลข หน่วย และผล Comply ยังคุมด้วยโค้ดและการตรวจของ Presales</p>
    <div className="response-actions"><button className="outline-button" disabled={busy||!requirement.reviewed||session.openai.phase!=='ready'||!session.consent} onClick={()=>request('draft')}>LLM แยกเงื่อนไข / ร่างคำตอบ</button><button className="outline-button" disabled={busy||!requirement.reviewed||session.typesafe.phase!=='ready'||!session.consent} onClick={()=>request('semantic')}>TypeSafe จัดอันดับ / ตรวจความหมาย</button></div>
    {!session.consent&&<p className="muted">เชื่อม API Key และอนุญาตส่งข้อมูลใน AI / API Keys ก่อน</p>}
    {result?.kind==='draft'&&<div className="ai-result"><small className="muted">LLM: {result.response.model} · เป็นข้อเสนอให้ตรวจ</small><h4>เงื่อนไขจาก TOR</h4>{result.response.result.conditions.map((c,i)=><div key={i}><strong>{c.description}</strong><blockquote>{c.sourceQuote}</blockquote></div>)}<h4>ร่างรายละเอียดที่เสนอ</h4>{result.response.result.draft.map((statement,i)=><div key={i}><p>{statement.text}</p>{statement.citations.map((citation,j)=>{const c=result.candidates.find(c=>c.id===citation.id);return <button className="ai-source" key={j} onClick={()=>openSource(c)}>{project.docs.find(d=>d.id===c.docId)?.name} · หน้า {c.pdfPage}<span>{citation.quote}</span></button>;})}</div>)}{!result.response.result.draft.length&&<p className="muted">หลักฐานยังไม่เพียงพอสำหรับร่างคำตอบ</p>}<label className="ai-consent"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> ตรวจเงื่อนไข ความครบถ้วน และข้อความอ้างเทียบต้นฉบับแล้ว</label><button className="brand-button" disabled={busy||!reviewed||!result.response.result.draft.length} onClick={applyDraft}>ใช้ร่างคำตอบ · คงรอตรวจ</button></div>}
    {result?.kind==='semantic'&&<div className="ai-result"><small className="muted">System One: {result.response.model} · confidence ไม่ใช่โอกาสที่ผล Comply ถูกต้อง</small>{result.candidates.map((candidate,i)=>({candidate,i,rank:result.response.answers['r'+i].noul})).sort((a,b)=>b.rank-a.rank).map(({candidate,i,rank})=>{const answer=result.response.answers['e'+i];return <div key={candidate.id}><strong>{LABELS[answer.choice]}</strong><small> · เกี่ยวข้อง {(rank*100).toFixed(0)}% · confidence {(answer.confidence*100).toFixed(0)}%</small><button className="ai-source" onClick={()=>openSource(candidate)}>{project.docs.find(d=>d.id===candidate.docId)?.name} · หน้า {candidate.pdfPage}<span>{candidate.quote}</span></button></div>;})}<p className="muted">ผลนี้ช่วยเปิดอ่านหลักฐาน ไม่สร้างไฮไลต์หรือเปลี่ยนสถานะผ่านเอง</p></div>}
  </details>;
}
