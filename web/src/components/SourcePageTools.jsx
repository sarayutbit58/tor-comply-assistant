'use client';
import dynamic from 'next/dynamic';
import {useState} from 'react';
import {useProjectStore} from '@/store/projectStore';
import {parsePages} from '@/lib/torModel.mjs';
import {compareReadings} from '@/lib/readingModel.mjs';
import {getFile} from '@/lib/localFiles';
import {aiSession} from '@/lib/aiSession.mjs';
import {ocrProgressMessage} from '@/lib/localOcr.mjs';
const PdfStage=dynamic(()=>import('./PdfStage'),{ssr:false});
export function SourcePageTools({project,count,run,busy,onAdded,onPage}) {
 const [page,setPage]=useState(project.unreadablePages[0]||1),[draft,setDraft]=useState(''),[method,setMethod]=useState('manual'),[progress,setProgress]=useState(''),[rawDraft,setRawDraft]=useState(''),[reading,setReading]=useState(false);
 const requirements=project.requirements.filter(r=>r.sourcePage===page||r.sourcePages?.includes(page)),actions=useProjectStore.getState();
 const savedReading=project.sourceReadings?.find(entry=>entry.page===page);
 async function read(local) {
  const capture={page,docId:project.torDocId};
  setReading(true);try{await run(async()=>{
   const ticket=local?aiSession.captureLocalOcr():aiSession.captureFor('ocr'),file=await getFile(capture.docId);if(!file)throw new Error('ไม่พบ TOR ต้นฉบับ');
   const [{ocrPdfPage},{recognizeImage}]=await Promise.all([import('@/lib/pdfBrowser'),import('@/lib/ocrBrowser')]);
   try{const result=await recognizeImage(await ocrPdfPage(file.blob,capture.page),ticket,{onProgress:p=>setProgress(ocrProgressMessage(p))});setDraft(result.text);setRawDraft(result.text);setMethod(ticket.provider==='local'?'local-ocr':'ocr');}finally{setProgress('');}
  },'อ่านแล้ว ตรวจเลขข้อและแก้ข้อความเทียบภาพก่อนเพิ่ม');}finally{setReading(false);}
 }
 return <section className="ocr-section stack-form"><h3>อ่านหน้า TOR / ถอดข้อความเอง</h3><p className="muted">หน้าที่ยังไม่ครบ: {project.unreadablePages.join(', ')||'ไม่มี'} · OCR ในเครื่องไม่ใช้ API Key และไม่ส่งภาพให้บริการ AI</p>
  <label className="form-label">หน้า PDF สำหรับอ่าน<input className="form-input" type="number" min="1" max={count} value={page} disabled={busy} onChange={e=>{const next=Math.max(1,Math.min(count,Number(e.target.value)||1));setPage(next);onPage(next);setDraft('');setRawDraft('');setMethod('manual');}}/></label>
  <div className="source-page-image"><PdfStage docId={project.torDocId} pageNumber={page} resetToken={page}/></div>
  <div className="response-actions"><button className="outline-button" disabled={busy} onClick={()=>read(true)}>OCR หน้านี้ในเครื่อง</button><button className="text-button" disabled={busy} onClick={()=>read(false)}>OCR ตามบริการที่ตั้งไว้</button>{reading&&<button className="text-button danger" onClick={()=>aiSession.cancelJobs()}>ยกเลิก OCR</button>}</div>{progress&&<p role="status">{progress}</p>}
  <form className="stack-form" onSubmit={e=>{e.preventDefault();run(async()=>{const parsed=parsePages([{page,text:draft}],method);if(!parsed.requirements.length)throw new Error('ใส่เลขข้อและข้อความแต่ละข้อ เช่น 5.1 ข้อกำหนด');const added=actions.addRequirements(project.id,parsed.requirements,method.includes('ocr')?page:null,{pageReading:{page,rawText:rawDraft,acceptedText:draft,method}});setDraft('');setRawDraft('');setMethod('manual');onAdded(added[0]?.id);},'เพิ่มข้อแล้ว ตรวจข้อความทีละข้อก่อนยืนยันความครบถ้วนทั้งหน้า');}}><label className="form-label">ข้อความตามภาพ (กรอกเองได้)<textarea className="form-input" aria-label="ถอดข้อความหน้า TOR" rows="5" value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)} placeholder="5.1 ข้อกำหนดแรก\n5.2 ข้อกำหนดถัดไป"/></label><button className="dark-button" disabled={busy||!draft.trim()}>เพิ่มข้อจากข้อความหน้านี้</button></form>
  {rawDraft&&<details><summary>ข้อความ OCR ก่อนแก้</summary><p className="evidence-quote">{rawDraft}</p></details>}{rawDraft&&compareReadings(rawDraft,draft).criticalChanged&&<p className="notice">ตัวเลข หน่วย หรือคำกำหนดเปลี่ยนจากข้อความที่อ่านครั้งแรก ตรวจเทียบภาพก่อนเพิ่มข้อ</p>}
  {savedReading&&<details><summary>ประวัติการอ่านหน้านี้</summary><strong>ข้อความที่อ่านครั้งแรก</strong><p className="evidence-quote">{savedReading.rawText||'ถอดข้อความจากภาพด้วยตนเอง'}</p><strong>ข้อความที่เพิ่มเป็นข้อ</strong><p className="evidence-quote">{savedReading.acceptedText}</p></details>}
  {project.unreadablePages.includes(page)&&<form className="stack-form resource-editor" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);run(async()=>actions.resolveTorPage(project.id,page,{draft,confirmed:data.get('confirmed')==='on',kind:requirements.length?'transcribed':'no-requirements',requirementIds:requirements.map(r=>r.id),reason:String(data.get('reason')||'')}),'ยืนยันความครบถ้วนหน้านี้แล้ว');}}><strong>ยืนยันหน้า {page} อ่านครบแล้ว</strong>{draft.trim()&&<p className="notice">ยังมีข้อความที่ไม่ได้เพิ่มเป็นข้อ เพิ่มข้อและตรวจ หรือเคลียร์ข้อความที่ไม่ใช้ก่อนยืนยันหน้านี้</p>}<p className="muted">ข้อในหน้านี้: {requirements.map(r=>r.id).join(', ')||'ยังไม่มี'} · ตรวจทุกข้อก่อนยืนยัน หากเป็นหน้าปก/ว่างให้ระบุเหตุผล</p><label className="form-label">ผลการตรวจทั้งหน้า<input className="form-input" name="reason" required placeholder="เช่น เพิ่มครบ 2 ข้อแล้ว / หน้าปก ไม่มีข้อกำหนด" disabled={busy}/></label><label className="intake-confirm"><input type="checkbox" name="confirmed" required disabled={busy}/>เทียบทั้งหน้ากับต้นฉบับแล้ว ข้อกำหนดครบ ไม่มีข้อความตกหล่น</label><button className="brand-button" disabled={busy||!!draft.trim()||requirements.some(r=>!r.reviewed)}>ยืนยันหน้านี้ครบแล้ว</button></form>}
 </section>;
}
