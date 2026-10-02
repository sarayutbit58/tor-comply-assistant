'use client';
import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';
import {useProjectStore} from '@/store/projectStore';
import {compareReadings,readingRisks,readingInBox} from '@/lib/readingModel.mjs';
import {getFile} from '@/lib/localFiles';
import {aiSession} from '@/lib/aiSession.mjs';
import {ocrProgressMessage} from '@/lib/localOcr.mjs';
const PdfStage=dynamic(()=>import('./PdfStage'),{ssr:false});
export function ReadingRepair({project,requirement,run,busy,onAccepted,compact=false,onPage,externalBox,displayedPage}) {
 const [before]=useState(requirement.textSnapshot),[draft,setDraft]=useState(requirement.textSnapshot),[page,setPage]=useState(requirement.sourcePage||1),[box,setBox]=useState(requirement.sourceRegions?.find(r=>r.page===requirement.sourcePage)?.box||null),[confirmed,setConfirmed]=useState(false),[method,setMethod]=useState('manual'),[progress,setProgress]=useState(''),[reading,setReading]=useState(false);
 const pdf=project.torDocId&&/\.pdf$/i.test(project.torFilename),comparison=compareReadings(before,draft),risks=readingRisks(before);
 const visibleSource=!compact||!pdf||displayedPage===page;
 const activeBox=compact&&visibleSource?(externalBox??box):box;
 useEffect(()=>{if(compact)setConfirmed(false);},[compact,externalBox,displayedPage]);
 const change=value=>{setDraft(value);setConfirmed(false);};
 async function reread(ocr) {
  onPage?.(page);
  setReading(true);try{await run(async()=>{
   const file=await getFile(project.torDocId);if(!file)throw new Error('ไม่พบต้นฉบับ TOR');
   if(!ocr){change(activeBox?readingInBox(file.pages?.find(p=>p.page===page),activeBox):file.pageTexts?.[page-1]||'');setMethod('geometry');return;}
   const ticket=aiSession.captureLocalOcr();
   const [{loadPdf,paintPage},{recognizeImage}]=await Promise.all([import('@/lib/pdfBrowser'),import('@/lib/ocrBrowser')]);
   const handle=await loadPdf(file.blob);
   try {
    const canvas=document.createElement('canvas');await paintPage(handle,page,canvas,2);
    const bounds=activeBox||[0,0,1,1],crop=document.createElement('canvas');crop.width=Math.max(1,Math.ceil(bounds[2]*canvas.width));crop.height=Math.max(1,Math.ceil(bounds[3]*canvas.height));
    crop.getContext('2d').drawImage(canvas,bounds[0]*canvas.width,bounds[1]*canvas.height,crop.width,crop.height,0,0,crop.width,crop.height);
    const result=await recognizeImage(crop.toDataURL('image/png'),ticket,{onProgress:p=>setProgress(ocrProgressMessage(p))});
    change(result.text);setMethod('local-ocr');
   }finally{setProgress('');await handle.destroy();}
  },'อ่านข้อความใหม่แล้ว ตรวจส่วนที่เปลี่ยนก่อนยอมรับ');}finally{setReading(false);}
 }
 return <div className="repair-grid">
  <section className="repair-source">{pdf?<><label className="form-label">หน้า PDF ต้นฉบับ<input type="number" min="1" max={project.sourcePageCount} className="form-input" value={page} disabled={busy} onChange={e=>{const next=Math.max(1,Math.min(project.sourcePageCount||1,Number(e.target.value)||1));setPage(next);setBox(null);setConfirmed(false);onPage?.(next);}}/></label>{compact?<p className="notice">ดูต้นฉบับหน้า {page} ในแผง TOR · ลากกรอบบนต้นฉบับเพื่ออ่านเฉพาะจุด<button className="text-button" disabled={busy} onClick={()=>onPage?.(page)}>แสดงหน้านี้</button></p>:<PdfStage docId={project.torDocId} pageNumber={page} resetToken={page} onBox={busy?undefined:b=>{setBox(b);setConfirmed(false);}} focusBox={box}/>}</>:<div className="notice">ต้นฉบับ {project.torFilename||'ข้อความที่กรอกเอง'}{requirement.sourceRow!==undefined?' · แถว '+requirement.sourceRow:''}<p>Office ไม่มีหน้า PDF จำลอง เปิดไฟล์ต้นฉบับจากเมนูข้อ TOR เพื่อตรวจเทียบ</p></div>}
   {pdf&&<div className="response-actions"><button className="outline-button" disabled={busy} onClick={()=>reread(false)}>อ่านชั้นข้อความจากกรอบ</button><button className="outline-button" disabled={busy} onClick={()=>reread(true)}>OCR ในเครื่องจากกรอบ</button>{reading&&<button className="text-button danger" onClick={()=>aiSession.cancelJobs()}>ยกเลิก OCR</button>}</div>}
   {progress&&<p role="status">{progress}</p>}
  </section>
  <section className="stack-form"><strong>ตรวจแก้ข้อ {requirement.id}</strong>
   {risks.map(r=><p className="notice" key={r.code}>{r.label} · {r.reason}</p>)}
   <label className="form-label">ก่อนแก้<textarea className="form-input" rows="4" readOnly value={before}/></label>
   <label className="form-label">ข้อความที่เสนอใหม่<textarea aria-label="ข้อความที่เสนอใหม่" className="form-input" rows="6" disabled={busy} value={draft} onChange={e=>{change(e.target.value);setMethod('manual');}}/></label>
   {comparison.criticalChanged&&<p className="error-message">ตัวเลข หน่วย หรือคำกำหนดเปลี่ยน · หายไป: {comparison.removed.join(', ')||'—'} · เพิ่ม: {comparison.added.join(', ')||'—'}</p>}
   {!visibleSource&&<p className="notice">แสดงต้นฉบับหน้า {page} ในแผง TOR ก่อนตรวจยืนยันข้อความ</p>}
   <label className="intake-confirm"><input type="checkbox" disabled={busy||!visibleSource} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>ตรวจข้อความใหม่ ตัวเลข หน่วย คำปฏิเสธ และเลขข้อเทียบต้นฉบับแล้ว</label>
   {pdf&&<p className="notice">ข้อความใหม่ทั้งข้อจะอ้างอิงหน้า {page} และกรอบที่เลือก หากข้อเดิมข้ามหลายหน้า ให้ตรวจว่าถอดข้อความครบแล้วก่อนยอมรับ หรือใช้เครื่องมือแก้ข้อเพื่อคงหน้าเดิม</p>}
   <button className="brand-button" disabled={busy||!confirmed||!visibleSource||!draft.trim()} onClick={()=>run(async()=>{useProjectStore.getState().acceptSourceCorrection(project.id,requirement.id,{textSnapshot:draft.trim(),method,page:pdf?page:null,box:pdf?activeBox:null},{confirmed,expectedText:before});onAccepted();},'รับข้อความที่ตรวจแล้ว ผล Comply เดิมถูกยกเลิก')}>ยอมรับข้อความใหม่</button>
   <details><summary>ข้อความและประวัติที่เก็บไว้</summary><p className="evidence-quote">{requirement.rawTextSnapshot||before}</p>{requirement.sourceCorrections?.map((c,i)=><p key={i} className="muted">{c.method} · {c.at||c.acceptedAt||''}<br/>{c.previousText} → {c.nextText}</p>)}</details>
   <p className="muted">ข้อความในโครงการจะเปลี่ยนเมื่อกดยอมรับเท่านั้น</p>
  </section>
 </div>;
}
