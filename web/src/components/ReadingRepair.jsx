'use client';
import dynamic from 'next/dynamic';
import {useState} from 'react';
import {useProjectStore} from '@/store/projectStore';
import {compareReadings,readingRisks,readingInBox} from '@/lib/readingModel.mjs';
import {getFile} from '@/lib/localFiles';
import {aiSession} from '@/lib/aiSession.mjs';
const PdfStage=dynamic(()=>import('./PdfStage'),{ssr:false});
export function ReadingRepair({project,requirement,run,busy,onAccepted}) {
 const [before]=useState(requirement.textSnapshot),[draft,setDraft]=useState(requirement.textSnapshot),[page,setPage]=useState(requirement.sourcePage||1),[box,setBox]=useState(requirement.sourceRegions?.find(r=>r.page===requirement.sourcePage)?.box||null),[confirmed,setConfirmed]=useState(false),[method,setMethod]=useState('manual'),[progress,setProgress]=useState(''),[reading,setReading]=useState(false);
 const pdf=project.torDocId&&/\.pdf$/i.test(project.torFilename),comparison=compareReadings(before,draft),risks=readingRisks(before);
 const change=value=>{setDraft(value);setConfirmed(false);};
 async function reread(ocr) {
  setReading(true);try{await run(async()=>{
   const file=await getFile(project.torDocId);if(!file)throw new Error('ไม่พบต้นฉบับ TOR');
   if(!ocr){change(box?readingInBox(file.pages?.find(p=>p.page===page),box):file.pageTexts?.[page-1]||'');setMethod('geometry');return;}
   const ticket=aiSession.captureLocalOcr();
   const [{loadPdf,paintPage},{recognizeImage}]=await Promise.all([import('@/lib/pdfBrowser'),import('@/lib/ocrBrowser')]);
   const handle=await loadPdf(file.blob);
   try {
    const canvas=document.createElement('canvas');await paintPage(handle,page,canvas,2);
    const bounds=box||[0,0,1,1],crop=document.createElement('canvas');crop.width=Math.max(1,Math.ceil(bounds[2]*canvas.width));crop.height=Math.max(1,Math.ceil(bounds[3]*canvas.height));
    crop.getContext('2d').drawImage(canvas,bounds[0]*canvas.width,bounds[1]*canvas.height,crop.width,crop.height,0,0,crop.width,crop.height);
    const result=await recognizeImage(crop.toDataURL('image/png'),ticket,{onProgress:p=>setProgress(p.status+' '+Math.round((p.progress||0)*100)+'%')});
    change(result.text);setMethod('local-ocr');
   }finally{setProgress('');await handle.destroy();}
  },'อ่านข้อความใหม่แล้ว ตรวจส่วนที่เปลี่ยนก่อนยอมรับ');}finally{setReading(false);}
 }
 return <div className="repair-grid">
  <section className="repair-source">{pdf?<><label className="form-label">หน้า PDF ต้นฉบับ<input type="number" min="1" max={project.sourcePageCount} className="form-input" value={page} disabled={busy} onChange={e=>{setPage(Math.max(1,Math.min(project.sourcePageCount||1,Number(e.target.value)||1)));setBox(null);setConfirmed(false);}}/></label><PdfStage docId={project.torDocId} pageNumber={page} resetToken={page} onBox={busy?undefined:b=>{setBox(b);setConfirmed(false);}} focusBox={box}/></>:<div className="notice">ต้นฉบับ {project.torFilename||'ข้อความที่กรอกเอง'}{requirement.sourceRow!==undefined?' · แถว '+(requirement.sourceRow+1):''}<p>Office ไม่มีหน้า PDF จำลอง เปิดไฟล์ต้นฉบับจากเมนูข้อ TOR เพื่อตรวจเทียบ</p></div>}
   {pdf&&<div className="response-actions"><button className="outline-button" disabled={busy} onClick={()=>reread(false)}>อ่านชั้นข้อความจากกรอบ</button><button className="outline-button" disabled={busy} onClick={()=>reread(true)}>OCR ในเครื่องจากกรอบ</button>{reading&&<button className="text-button danger" onClick={()=>aiSession.cancelJobs()}>ยกเลิก OCR</button>}</div>}
   {progress&&<p role="status">{progress}</p>}
  </section>
  <section className="stack-form"><strong>ตรวจแก้ข้อ {requirement.id}</strong>
   {risks.map(r=><p className="notice" key={r.code}>{r.label} · {r.reason}</p>)}
   <label className="form-label">ก่อนแก้<textarea className="form-input" rows="4" readOnly value={before}/></label>
   <label className="form-label">ข้อความที่เสนอใหม่<textarea aria-label="ข้อความที่เสนอใหม่" className="form-input" rows="6" disabled={busy} value={draft} onChange={e=>{change(e.target.value);setMethod('manual');}}/></label>
   {comparison.criticalChanged&&<p className="error-message">ตัวเลข หน่วย หรือคำกำหนดเปลี่ยน · หายไป: {comparison.removed.join(', ')||'—'} · เพิ่ม: {comparison.added.join(', ')||'—'}</p>}
   <label className="intake-confirm"><input type="checkbox" disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>ตรวจข้อความใหม่ ตัวเลข หน่วย คำปฏิเสธ และเลขข้อเทียบต้นฉบับแล้ว</label>
   {pdf&&<p className="notice">ข้อความใหม่ทั้งข้อจะอ้างอิงหน้า {page} และกรอบที่เลือก หากข้อเดิมข้ามหลายหน้า ให้ตรวจว่าถอดข้อความครบแล้วก่อนยอมรับ หรือใช้เครื่องมือแก้ข้อเพื่อคงหน้าเดิม</p>}
   <button className="brand-button" disabled={busy||!confirmed||!draft.trim()} onClick={()=>run(async()=>{useProjectStore.getState().acceptSourceCorrection(project.id,requirement.id,{textSnapshot:draft.trim(),method,page:pdf?page:null,box:pdf?box:null},{confirmed,expectedText:before});onAccepted();},'รับข้อความที่ตรวจแล้ว ผล Comply เดิมถูกยกเลิก')}>ยอมรับข้อความใหม่</button>
   <details><summary>ข้อความและประวัติที่เก็บไว้</summary><p className="evidence-quote">{requirement.rawTextSnapshot||before}</p>{requirement.sourceCorrections?.map((c,i)=><p key={i} className="muted">{c.method} · {c.at||c.acceptedAt||''}<br/>{c.previousText} → {c.nextText}</p>)}</details>
   <p className="muted">ปิดหน้าต่างเพื่อทิ้งข้อเสนอ ข้อความในโครงการจะเปลี่ยนเมื่อกดยอมรับเท่านั้น</p>
  </section>
 </div>;
}
