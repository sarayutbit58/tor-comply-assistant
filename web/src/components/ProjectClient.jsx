'use client';
import {DeleteButton} from './DeleteButton';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useProjectStore} from '@/store/projectStore';
import {STATUS,FILE_ROLES,evidenceFor,linkedRequirements,exportProblems} from '@/lib/projectModel.mjs';
import {PRIORITIES} from '@/lib/complianceRules.mjs';
import {assessClause,textInBox} from '@/lib/evidenceSearch.mjs';
import {SourcePageTools} from './SourcePageTools';
import {getFile,putFile} from '@/lib/localFiles';
import {downloadBlob,clearDownload} from '@/lib/download';
import {ClauseResponse} from './ClauseResponse';
import {RequirementEditor} from './RequirementEditor';
import {WorkbenchDock} from './WorkbenchDock';
import {AiSettings,AiSettingsButton} from './AiSettings';
import {clauseFingerprint} from '@/lib/aiIntegrity.mjs';
import {aiSession} from '@/lib/aiSession.mjs';
import {workflowSummary,planBatch} from '@/lib/workflowModel.mjs';
import {EvidenceEditor} from './EvidenceEditor';
const ReadingRepair=dynamic(()=>import('./ReadingRepair').then(m=>m.ReadingRepair));
const PdfStage=dynamic(()=>import('./PdfStage'),{ssr:false,loading:()=> <div className="document-empty">กำลังเปิดเอกสาร…</div>});
const LibraryManager=dynamic(()=>import('./LibraryManager').then(m=>m.LibraryManager));
const TemplateSettings=dynamic(()=>import('./TemplateSettings').then(m=>m.TemplateSettings));
function Pager({label,page,count,onChange}){
  return <div className="pager"><button aria-label={label+' หน้าก่อน'} disabled={page<=1} onClick={()=>onChange(page-1)}>‹</button><span>หน้า <input aria-label={label+' เลขหน้า'} type="number" min="1" max={count} value={page} onChange={e=>onChange(Math.max(1,Math.min(count,Number(e.target.value)||1)))}/> / {count}</span><button aria-label={label+' หน้าถัดไป'} disabled={page>=count} onClick={()=>onChange(page+1)}>›</button></div>;
}
function Splitter({label,value,onChange}){
  const [start,setStart]=useState(null);
  return <div className="pane-splitter" role="separator" aria-label={label} aria-orientation="vertical" aria-valuenow={value} tabIndex={0}
    onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();onChange(value+(e.key==='ArrowLeft'?-1:1));}}}
    onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);setStart({x:e.clientX,value});}}
    onPointerMove={e=>{if(start)onChange(start.value+(e.clientX-start.x)/window.innerWidth*100);}}
    onPointerUp={()=>setStart(null)} onPointerCancel={()=>setStart(null)}/>;
}
export function ProjectClient({projectId}){
  const project=useProjectStore(s=>s.projects.find(p=>p.id===projectId));
  const [mounted,setMounted]=useState(false),[selected,setSelected]=useState(null),[view,setView]=useState({docId:null,page:1,focus:null}),[torPage,setTorPage]=useState(1),[torCount,setTorCount]=useState(1);
  const [libraryView,setLibraryView]=useState('documents'),[repairBox,setRepairBox]=useState(null);
  const [dialog,setDialog]=useState(null),[reviewOpen,setReviewOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false);
  const [filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[tableWidth,setTableWidth]=useState(40),[middleWidth,setMiddleWidth]=useState(30);
  const [box,setBox]=useState(null),[quote,setQuote]=useState(''),[quoteMethod,setQuoteMethod]=useState('text'),[quoteReviewed,setQuoteReviewed]=useState(false),[printedPage,setPrintedPage]=useState(''),[selectedMark,setSelectedMark]=useState(null);
  const [job,setJob]=useState(null);
  const [downloadFile,setDownloadFile]=useState(null);
  const jobEpoch=useRef(0),undo=useProjectStore(s=>s.undo);
  const pendingReference=useRef(null);
  const activeRequirement=useRef(null);
  const currentCapture=useRef(null);
  currentCapture.current={reqId:project?.requirements.some(r=>r.id===selected)?selected:project?.requirements[0]?.id,view,box,torDocId:project?.torDocId};
  useEffect(()=>{
    const open=event=>{
      const detail=event.detail;
      if(detail.projectId===projectId&&project?.docs.some(d=>d.id===detail.docId)){
        setSelected(detail.requirementId);setView({docId:detail.docId,page:detail.page,focus:detail.box});setSelectedMark(null);setBox(null);
      }
    };
    window.addEventListener('tor-open-ai-source',open);return()=>window.removeEventListener('tor-open-ai-source',open);
  },[projectId,project?.docs]);
  useEffect(()=>setMounted(true),[]);
  useEffect(()=>{
    const ready=e=>{const value=e.detail;if(typeof value?.url==='string'&&value.url.startsWith('blob:'+window.location.origin+'/')&&typeof value.filename==='string'&&Number.isFinite(value.size))setDownloadFile({...value,href:typeof value.href==='string'&&value.href.length<1_400_000&&/^data:application\/octet-stream;base64,[A-Za-z0-9+/]*={0,2}$/.test(value.href)?value.href:value.url});};
    const expired=e=>setDownloadFile(value=>value?.url===e.detail?.url?null:value);
    window.addEventListener('tor-download-ready',ready);window.addEventListener('tor-download-expired',expired);
    return()=>{window.removeEventListener('tor-download-ready',ready);window.removeEventListener('tor-download-expired',expired);clearDownload();};
  },[]);
  useEffect(()=>()=>{jobEpoch.current++;aiSession.cancelJobs();},[]);
  useEffect(()=>{const fail=()=>{setMessage('พื้นที่เก็บข้อมูลเต็มหรือถูกปิด ส่งออกโครงการเพื่อสำรองงาน');setError(true);};window.addEventListener('tor-storage-error',fail);return()=>window.removeEventListener('tor-storage-error',fail);},[]);
  const reqId=project?.requirements.some(r=>r.id===selected)?selected:project?.requirements[0]?.id;
  const requirement=project?.requirements.find(r=>r.id===reqId);
  useEffect(()=>{activeRequirement.current=reqId;},[reqId]);
  const marks=useMemo(()=>project&&reqId?evidenceFor(project,reqId):[],[project?.evidence,reqId]);
  const doc=project?.docs.find(d=>d.id===view.docId);
  const selectedEvidence=project?.evidence.find(m=>m.id===selectedMark);
  const actions=useProjectStore.getState();
  const run=useCallback(async(task,success='')=>{
    setBusy(true);setError(false);setMessage('');
    try{await task();if(success)setMessage(success);return true;}
    catch(e){setMessage(e.message||'ทำรายการไม่สำเร็จ');setError(true);return false;}
    finally{setBusy(false);}
  },[]);
  useEffect(()=>{
    let cancelled=false;
    if(!project?.torDocId)return;
    getFile(project.torDocId).then(file=>{if(!cancelled&&file)setTorCount(file.pageTexts?.length||Math.max(1,...project.requirements.map(r=>r.sourcePage||1),...project.unreadablePages));}).catch(e=>{if(!cancelled){setMessage(e.message||'เปิดพื้นที่เก็บไฟล์ไม่ได้');setError(true);}});
    return()=>{cancelled=true;};
  },[project?.torDocId,project?.requirements,project?.unreadablePages]);
  useEffect(()=>{
    if(!requirement)return;
    const first=pendingReference.current&&linkedRequirements(pendingReference.current).includes(reqId)?pendingReference.current:marks[0];
    pendingReference.current=null;
    setTorPage(requirement.sourcePage||1);setRepairBox(null);
    setView({docId:first?.docId||null,page:first?.pdfPage||1,focus:first?.box||null});
    setSelectedMark(first?.id||null);setBox(null);setQuote('');setQuoteReviewed(false);
  // Document navigation follows clause selection, not unrelated row edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[reqId]);
  const pageMarks=useMemo(()=>project?.evidence.filter(m=>m.docId===view.docId&&m.pdfPage===view.page).map(m=>({...m,number:linkedRequirements(m).join(', '),active:linkedRequirements(m).includes(reqId)}))||[],[project?.evidence,view.docId,view.page,reqId]);
  const visible=useMemo(()=>project?.requirements.filter(r=>{
    const status=project.rows[r.id]?.comparison||STATUS.pending;
    return (filter==='all'||(filter==='unreviewed'?!r.reviewed:status===STATUS[filter]))&&(!query||[r.id,r.textSnapshot,project.rows[r.id]?.proposal].join(' ').toLowerCase().includes(query.toLowerCase()));
  })||[],[project,filter,query]);
  const counts=useMemo(()=>Object.fromEntries(Object.entries(STATUS).map(([key,value])=>[key,project?.requirements.filter(r=>project.rows[r.id]?.comparison===value).length||0])),[project]);
  const workflow=useMemo(()=>project?workflowSummary(project):null,[project]);
  const registerSourceCount=useCallback(count=>{setTorCount(count);useProjectStore.getState().setSourcePageCount(projectId,count);},[projectId]);
  function cancelJob(){jobEpoch.current++;aiSession.cancelJobs();setJob(v=>v?{...v,cancelled:true}:null);}
  function nextTask(){
    const next=workflow.next;setFilter('all');setQuery('');if(next.id)setSelected(next.id);
    if(['add','pages'].includes(next.action))setDialog('tor');
    else if(next.action==='review')setReviewOpen(true);
    else if(next.action==='library')setDialog('library');
    else if(next.action==='search')assess(next.id);
    else if(next.action==='proof'){const mark=evidenceFor(project,next.id).find(m=>m.reviewed!==true);if(mark){pendingReference.current=mark;openMark(mark);}}
    else setMessage(next.action==='export'?'ตารางพร้อมตรวจครั้งสุดท้าย เลือกรูปแบบส่งออกด้านบน':'ตรวจคำตอบและผลในแผงใต้ตาราง');
  }
  async function readIndexed(id){
    let file=await getFile(id);
    if(file&&(!file.pages?.length)){
      const {extractPdf}=await import('@/lib/pdfBrowser');const pages=await extractPdf(file.blob);await putFile(id,file.blob,pages.map(p=>p.text),pages);file={...file,pages,pageTexts:pages.map(p=>p.text)};
    }return file;
  }
  async function onBox(nextBox){
    setBox(nextBox);setSelectedMark(null);setQuote('');setQuoteReviewed(false);setQuoteMethod('text');
    if(nextBox&&view.docId)await run(async()=>{const capture={docId:view.docId,page:view.page,box:nextBox};const file=await readIndexed(capture.docId);if(currentCapture.current.view.docId!==capture.docId||currentCapture.current.view.page!==capture.page||JSON.stringify(currentCapture.current.box)!==JSON.stringify(capture.box))return;const text=textInBox(file?.pages?.find(p=>p.page===capture.page),nextBox);setQuote(text);setQuoteMethod('text');setQuoteReviewed(false);},'');
  }
  function openMark(mark){
    setView({docId:mark.docId,page:mark.pdfPage,focus:mark.box});setSelectedMark(mark.id);setBox(null);
  }
  async function assess(id){
    const epoch=jobEpoch.current;
    await run(async()=>{
      const snapshot=useProjectStore.getState().projects.find(p=>p.id===projectId);
      const fingerprint=clauseFingerprint(snapshot,id);
      const {assessment,candidates,proposal}=await assessClause(snapshot,id,readIndexed);
      if(epoch!==jobEpoch.current)throw new Error('ยกเลิกการค้นหลักฐานแล้ว');
      if(clauseFingerprint(useProjectStore.getState().projects.find(p=>p.id===projectId),id)!==fingerprint)throw new Error('ข้อมูลข้อนี้เปลี่ยนระหว่างประเมิน กรุณาประเมินใหม่');
      actions.applyAssessment(projectId,id,assessment,candidates,proposal);
      const first=evidenceFor(useProjectStore.getState().projects.find(p=>p.id===projectId),id)[0];if(first&&id===activeRequirement.current)openMark(first);
    },'ประเมินแล้ว · ตรวจเหตุผลและหลักฐานของแต่ละเงื่อนไข');
  }
  async function assessAll(){
    const epoch=++jobEpoch.current;
    await run(async()=>{
      const snapshot=useProjectStore.getState().projects.find(p=>p.id===projectId);
      const plan=planBatch(snapshot);setJob({done:0,total:plan.ready.length,skipped:plan.skipped});
      if(!plan.ready.length)throw new Error(plan.skipped.map(s=>'ข้อ '+s.id+': '+s.reason).join(' · ')||'ยังไม่มีข้อ TOR');
      let count=0;
      for(const id of plan.ready){
        if(epoch!==jobEpoch.current)throw new Error('ยกเลิกแล้ว ผลที่ทำเสร็จยังอยู่ในโครงการ');
        const current=useProjectStore.getState().projects.find(p=>p.id===projectId);
        const fingerprint=clauseFingerprint(current,id);
        const result=await assessClause(current,id,readIndexed);
        if(epoch!==jobEpoch.current)throw new Error('ยกเลิกแล้ว ผลข้อนี้ไม่ได้บันทึก');
        if(clauseFingerprint(useProjectStore.getState().projects.find(p=>p.id===projectId),id)!==fingerprint)throw new Error('ข้อมูลข้อ '+id+' เปลี่ยนระหว่างค้น กรุณาค้นใหม่');
        actions.applyAssessment(projectId,id,result.assessment,result.candidates,result.proposal);count++;setJob({done:count,total:plan.ready.length,skipped:plan.skipped});
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      const latest=useProjectStore.getState().projects.find(p=>p.id===projectId);
      const first=evidenceFor(latest,activeRequirement.current)[0];if(first)openMark(first);
    },'ค้นด้วยกฎในโค้ดแล้ว ตรวจข้อความที่อ้างก่อนยืนยันผล');
  }
  async function ocrSelection(){
    if(!box||!doc)return;
    const capture={box:[...box],docId:doc.id,page:view.page,reqId};
    await run(async()=>{
      const ticket=aiSession.captureFor('ocr');
      const file=await getFile(capture.docId);
      const [{loadPdf,paintPage},{recognizeImage}]=await Promise.all([import('@/lib/pdfBrowser'),import('@/lib/ocrBrowser')]);
      const pdf=await loadPdf(file.blob);
      try{
        const full=document.createElement('canvas');await paintPage(pdf,capture.page,full,2.5);
        const crop=document.createElement('canvas');crop.width=Math.max(1,Math.ceil(capture.box[2]*full.width));crop.height=Math.max(1,Math.ceil(capture.box[3]*full.height));
        crop.getContext('2d').drawImage(full,capture.box[0]*full.width,capture.box[1]*full.height,crop.width,crop.height,0,0,crop.width,crop.height);
        const result=await recognizeImage(crop.toDataURL('image/png'),ticket);
        const latest=currentCapture.current;
        if(latest.reqId!==capture.reqId||latest.view.docId!==capture.docId||latest.view.page!==capture.page||JSON.stringify(latest.box)!==JSON.stringify(capture.box))throw new Error('เปลี่ยนหน้า/กรอบแล้ว ผล OCR เดิมถูกยกเลิก');
        setQuote(result.text);setQuoteMethod('ocr');setQuoteReviewed(false);
      }finally{await pdf.destroy();}
    },'อ่าน OCR เฉพาะกรอบแล้ว ตรวจข้อความก่อนยืนยัน');
  }
  async function saveMark(event){
    event.preventDefault();
    await run(async()=>{
      if(!box||!doc||!reqId)throw new Error('เลือกข้อ TOR และลากกรอบหลักฐานก่อน');
      if(!quote.trim())throw new Error('กรอกข้อความที่เห็นในกรอบหรือใช้ OCR ก่อนบันทึก');
      actions.addEvidence(projectId,{docId:doc.id,pdfPage:view.page,box,quote:quote.trim(),keyword:quote.trim().slice(0,80),sourceMethod:quoteMethod,reviewed:quoteReviewed,printedPage:printedPage.trim(),requirementIds:[reqId]});
      setBox(null);setQuote('');setPrintedPage('');
    },'ผูกหลักฐานแล้ว');
  }
  async function exportTable(format){
    await run(async()=>{
      const snapshot=useProjectStore.getState().projects.find(p=>p.id===projectId);
      const problems=exportProblems(snapshot);if(problems.length)throw new Error(problems.join(' · '));
      if(!snapshot.requirements.length)throw new Error('ยังไม่มีข้อ TOR');
      let blob;
      if(format==='xlsx'){const {buildXlsx}=await import('@/lib/xlsx.mjs');blob=new Blob([buildXlsx(snapshot)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
      if(format==='docx'){const {exportComplyWord}=await import('@/lib/exportWord');blob=await exportComplyWord(snapshot);}
      if(format==='pdf'){const {exportTablePdf}=await import('@/lib/exportTablePdf');blob=await exportTablePdf(snapshot);}
      downloadBlob(blob,'comply-tor.'+format);
    },'สร้างไฟล์ส่งออกแล้ว');
  }
  async function exportBundle(){
    await run(async()=>{const {exportProjectArchive}=await import('@/lib/projectArchive');const snapshot=useProjectStore.getState().projects.find(p=>p.id===projectId);downloadBlob(await exportProjectArchive(snapshot),'tor-project.torproj');},'ส่งออกโครงการพร้อมเอกสารต้นฉบับครบแล้ว');
  }
  function showTorPage(page){if(page!==torPage)setRepairBox(null);setTorPage(page);}
  function renderToolPanel(panel){return <>
    {panel==='answer'&&(requirement?<ClauseResponse key={reqId} project={project} requirement={requirement} run={run} busy={busy} onAssess={assess} onManageItems={()=>{setLibraryView('offerings');setDialog('library');}}/>:<div className="pane-empty">เลือกหรือเพิ่มข้อ TOR เพื่อเริ่มเขียนคำตอบ</div>)}
    {panel==='ai'&&<AiSettings/>}
      {panel==='repair'&&requirement&&<ReadingRepair key={reqId+':'+requirement.textSnapshot} compact externalBox={repairBox} displayedPage={torPage} onPage={showTorPage} project={project} requirement={requirement} run={run} busy={busy} onAccepted={()=>setDialog(null)}/>}
      {panel==='library'&&<LibraryManager compact view={libraryView} onViewChange={setLibraryView} project={project} run={run} busy={busy} onTemplate={()=>setDialog('template')}/>}
      {panel==='template'&&<TemplateSettings key={project.template?.id||'default'} project={project} run={run} onLibrary={()=>{setLibraryView('documents');setDialog('library');}}/>}
      {panel==='settings'&&<div className="stack-form"><label className="form-label">ชื่อโครงการ<input className="form-input" value={project.name} maxLength={160} onChange={e=>actions.rename(projectId,e.target.value)}/></label><label className="form-label">ประเภทงาน<select className="form-input" value={project.domain} onChange={e=>actions.settings(projectId,{domain:e.target.value})}>{[...PRIORITIES,'Software','Surveillance','Parking','Room Booking','Access Control','A/V','PBX / IPBX / Hybrid','อื่น ๆ'].map(d=><option key={d}>{d}</option>)}</select></label><p className="notice">ใช้กฎในโค้ดเป็นหลัก · AI/OCR ผ่าน API เป็นตัวเลือกช่วงทดสอบ เปิดจาก AI / API Keys</p><p className="muted">โหมด Auto จะตัดสินเฉพาะเงื่อนไขที่พิสูจน์ได้จากเอกสารของรายการที่เลือก ข้อที่ยังพิสูจน์ไม่ครบจะเป็นรอตรวจ</p></div>}
      {panel==='tor'&&<div className="stack-form">
        {project.torDocId&&<button className="outline-button" onClick={()=>run(async()=>{const file=await getFile(project.torDocId);if(!file)throw new Error('ไม่พบไฟล์ TOR');downloadBlob(file.blob,project.torFilename);})}>ดาวน์โหลด TOR ต้นฉบับ</button>}
        {project.sourceWarnings?.length>0&&<details open={project.sourceCoveragePending}><summary>คำเตือนจากการอ่านต้นฉบับ</summary>{project.sourceWarnings.map((w,i)=><p className="notice" key={i}>{w}</p>)}</details>}
        {project.sourceCoveragePending&&<form className="stack-form resource-editor" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);run(async()=>actions.confirmSourceCoverage(projectId,{confirmed:data.get('confirmed')==='on',reason:data.get('reason')}),'ยืนยันความครบถ้วนต้นฉบับแล้ว');}}><strong>ตรวจความครบถ้วนจากไฟล์ต้นฉบับ</strong><p className="muted">เปิดไฟล์เดิม ตรวจทุกตาราง/แผ่นงาน เพิ่มข้อที่ตกหล่นด้วยเครื่องมือด้านล่างก่อนยืนยัน</p><label className="form-label">ผลการตรวจ / แถวที่เพิ่มหรือไม่มีข้อกำหนด<input className="form-input" name="reason" required/></label><label className="intake-confirm"><input type="checkbox" name="confirmed" required/>ตรวจครบทุกข้อและทุกแถวที่เตือนแล้ว</label><button className="brand-button" disabled={busy}>ยืนยันต้นฉบับครบถ้วน</button></form>}
        {project.torDocId&&/\.pdf$/i.test(project.torFilename)&&<SourcePageTools compact initialPage={torPage} displayedPage={torPage} project={project} count={torCount} run={run} busy={busy} onPage={showTorPage} onAdded={id=>{if(id)setSelected(id);}}/>}
        <form className="stack-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget,data=new FormData(form);run(async()=>{const id=String(data.get('number')).trim();if(project.requirements.some(r=>r.id===id))throw new Error('เลขข้อซ้ำ');actions.addRequirements(projectId,[{id,title:String(data.get('text')).slice(0,120),textSnapshot:String(data.get('text')),sourcePage:Number(data.get('page'))||null,sourceMethod:'manual',reviewed:false}]);setSelected(id);form.reset();},'เพิ่มข้อ TOR แล้ว');}}>
          <h3>เพิ่มข้อ TOR</h3><div className="form-grid"><label className="form-label">เลขข้อ<input className="form-input" name="number" required pattern="[0-9๐-๙]+([.][0-9๐-๙]+)*" placeholder="5.1"/></label><label className="form-label">หน้า PDF ต้นฉบับ<input className="form-input" name="page" type="number" min="1" max={torCount}/></label></div><label className="form-label">ข้อความตาม TOR<textarea className="form-input" name="text" required rows="4"/></label><button className="dark-button" disabled={busy}>เพิ่มข้อกำหนด</button>
        </form>
      </div>}
  </>;}
  if(!mounted)return <div className="loading-workspace">กำลังเปิดพื้นที่ทำงาน…</div>;
  if(!project)return <div className="loading-workspace">ไม่พบโครงการในเครื่องนี้ <Link href="/">กลับหน้าโครงการ</Link></div>;
  return <div className="workbench">
    <aside className="workspace-rail"><Link href="/" className="rail-brand" aria-label="โครงการทั้งหมด">1<span>to</span>All</Link><button disabled={busy} onClick={()=>setDialog('library')} title="สินค้า บริการ และไฟล์"><b>▧</b><span>ไฟล์</span></button><button disabled={busy} onClick={()=>setDialog('tor')} title="นำเข้า OCR และเพิ่มข้อ"><b>≡</b><span>ข้อ TOR</span></button><button disabled={busy} onClick={()=>setDialog('template')} title="แม่แบบส่งออก"><b>▤</b><span>แม่แบบ</span></button><button disabled={busy} onClick={()=>setDialog('settings')} title="ตั้งค่าโครงการ"><b>⚙</b><span>ตั้งค่า</span></button><div className="rail-bottom">LOCAL<br/>เก็บในเครื่อง</div></aside>
    <div className="workspace-main">
      <header className="workspace-header"><div><div className="workspace-breadcrumb"><Link href="/">โครงการ</Link><span>/</span><span>{project.domain}</span></div><h1>{project.name}</h1></div><div className="workspace-menu"><AiSettingsButton onOpen={()=>{if(!busy)setDialog('ai');}}/><select aria-label="โหมดหลักของโครงการ" value={project.mode} onChange={e=>actions.settings(projectId,{mode:e.target.value})}><option value="manual">ตรวจยืนยันเอง</option><option value="auto">Auto ตามกฎ</option></select><button className="outline-button" disabled={busy} onClick={assessAll}>ค้นหลักฐานทุกข้อพร้อมทำ</button><button className="outline-button" disabled={busy} onClick={exportBundle}>สำรองโครงการ</button><details className="export-menu"><summary className="brand-button">ส่งออกตาราง ↓</summary><div>{[['pdf','PDF'],['docx','Word DOCX'],['xlsx','Excel XLSX']].map(([f,label])=><button key={f} disabled={busy} onClick={()=>exportTable(f)}>{label}</button>)}</div></details></div></header>
      <div className="workspace-status"><div className="status-counts"><span><i className="check-dot pass"/>{counts.pass} Comply</span><span><i className="check-dot pending"/>{counts.pending} รอตรวจ</span><span><i className="check-dot fail"/>{counts.fail} ไม่ Comply</span></div><span>{project.requirements.filter(r=>r.reviewed).length}/{project.requirements.length} ตรวจ TOR แล้ว · ใช้กฎในโค้ด</span></div>
      {message&&<div role={error?'alert':'status'} className={'workspace-notice '+(error?'notice-error':'')}><span>{message}</span><button aria-label="ปิดข้อความ" onClick={()=>setMessage('')}>×</button></div>}
      {downloadFile&&<div className="workspace-notice"><span>ไฟล์พร้อมแล้ว · หากไม่เริ่มดาวน์โหลด กดลิงก์นี้ภายใน 2 นาที</span><a className="text-button" href={downloadFile.href} download={downloadFile.filename}>ดาวน์โหลด {downloadFile.filename}</a><button aria-label="ปิดลิงก์ดาวน์โหลด" onClick={clearDownload}>×</button></div>}
      <div className="copilot-bar"><div><strong>Copilot · ใช้กฎในโค้ด</strong><span>{workflow.next.label}</span></div><button className="outline-button" disabled={busy} onClick={nextTask}>ทำขั้นตอนถัดไป</button>{busy&&<button className="text-button danger" onClick={cancelJob}>ยกเลิกงานที่กำลังทำ</button>}{undo?.before.id===projectId&&<button className="text-button" disabled={busy} onClick={()=>run(async()=>actions.undoLast(projectId),'ย้อนกลับรายการล่าสุดแล้ว')}>ย้อนกลับรายการล่าสุด</button>}{job&&<details><summary>{job.cancelled?'ยกเลิก':job.done+'/'+job.total+' ข้อ'} · ข้าม {job.skipped.length} ข้อ</summary>{job.skipped.map(s=><p key={s.id}>ข้อ {s.id}: {s.reason}</p>)}</details>}</div>
      <div className="workspace-panes" style={{gridTemplateColumns:'minmax(340px,'+tableWidth+'fr) 7px minmax(240px,'+middleWidth+'fr) 7px minmax(240px,'+(100-tableWidth-middleWidth)+'fr)'}}>
        <section className="work-pane table-pane"><div className="pane-title"><div><span className="pane-index">01</span><h2>ตาราง Comply</h2></div><span>{visible.length} ข้อ</span></div>
          <div className="table-toolbar"><input aria-label="ค้นหาข้อ TOR" placeholder="ค้นเลขข้อหรือข้อความ…" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="กรองสถานะ" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">ทุกข้อ</option><option value="pending">รอตรวจ</option><option value="pass">Comply</option><option value="fail">ไม่ Comply</option><option value="unreviewed">ยังไม่ตรวจ TOR</option></select></div>
          <div className="clause-tools"><button className="text-button" disabled={busy} onClick={()=>setDialog('tor')}>+ เพิ่มข้อ</button><button className="text-button" disabled={busy||!requirement} onClick={()=>setReviewOpen(true)}>แก้ / ตรวจข้อ</button><button className="text-button" disabled={busy||!requirement} onClick={()=>setDialog('repair')}>ตรวจแก้การอ่าน</button><DeleteButton key={reqId} label="ลบข้อ" confirmation={'ยืนยันลบข้อ '+reqId} disabled={busy||!requirement} onConfirm={()=>run(async()=>{actions.deleteRequirement(projectId,reqId);setSelected(null);},'ลบข้อแล้ว · ย้อนกลับรายการล่าสุดได้')}/></div>
          <div className="comply-scroll"><table className="comply-grid"><thead><tr><th>ข้อ / รายละเอียด TOR</th><th>รายละเอียดที่เสนอ</th><th>ผลเปรียบเทียบ</th><th>เอกสารอ้างอิง</th></tr></thead><tbody>{visible.map(req=>{
            const row=project.rows[req.id],refs=evidenceFor(project,req.id),status=row?.comparison||STATUS.pending;
            return <tr key={req.id} className={req.id===reqId?'selected-row':''} aria-selected={req.id===reqId}><td><button className="clause-select" onClick={()=>setSelected(req.id)}><strong>{req.id}<span className={req.reviewed?'reviewed-label':'unreviewed-label'}>{req.reviewed?'ตรวจแล้ว':'ตรวจ TOR'}</span></strong><span>{req.textSnapshot}</span></button></td><td><button className="cell-select" onClick={()=>setSelected(req.id)}>{row?.proposal||<span className="muted">เลือกสินค้า/บริการแล้วเขียนคำตอบ</span>}</button></td><td><button className="cell-select" onClick={()=>setSelected(req.id)}><span className={'status-pill '+(status===STATUS.pass?'pass':status===STATUS.fail?'fail':'pending')}>{status===STATUS.pass?'Comply':status===STATUS.fail?'ไม่ Comply':'รอตรวจ'}</span><small>{row?.decisionSource==='auto'?'Auto':row?.decisionSource==='manual'?'ยืนยันเอง':''}</small></button></td><td>{refs.length?refs.map(mark=><button key={mark.id} className="reference-cell" onClick={()=>{if(req.id!==reqId)pendingReference.current=mark;setSelected(req.id);openMark(mark);}} title={project.docs.find(d=>d.id===mark.docId)?.name}>{project.docs.find(d=>d.id===mark.docId)?.name}<small>PDF {mark.pdfPage}{mark.printedPage?' · หน้าพิมพ์ '+mark.printedPage:''}</small></button>):<span className="empty-reference">ยังไม่ผูกหลักฐาน</span>}</td></tr>;
          })}</tbody></table>{!visible.length&&<div className="pane-empty"><strong>เริ่มจากข้อกำหนด TOR</strong><p>นำเข้า TOR หรือเพิ่มเลขข้อ แล้วตรวจข้อความก่อนประเมิน</p><button className="outline-button" onClick={()=>setDialog('tor')}>จัดการข้อ TOR</button></div>}</div>
          <WorkbenchDock active={dialog} onChange={setDialog} busy={busy} renderPanel={renderToolPanel}/>
        </section>
        <Splitter label="ปรับความกว้างตาราง" value={tableWidth} onChange={v=>setTableWidth(Math.max(28,Math.min(50,v)))}/>
        <section className="work-pane"><div className="pane-title"><div><span className="pane-index">02</span><h2>TOR ต้นฉบับ</h2></div><button className="text-button" onClick={()=>setReviewOpen(v=>!v)} disabled={!requirement}>{requirement?.reviewed?'ตรวจอีกครั้ง':'ตรวจข้อความ'}</button></div>
          <div className="document-caption" title={project.torFilename}>{project.torFilename||'ข้อกำหนดที่กรอกเอง'}<span>ข้อ {reqId||'—'}</span></div>
          {project.torDocId&&/\.pdf$/i.test(project.torFilename)?<><Pager label="TOR" page={torPage} count={torCount} onChange={showTorPage}/><PdfStage selectionLabel="ลากกรอบเพื่ออ่านข้อความ TOR" docId={project.torDocId} pageNumber={torPage} resetToken={reqId} focusBox={dialog==='repair'?repairBox||requirement?.sourceRegions?.find(r=>r.page===torPage)?.box:requirement?.sourceRegions?.find(r=>r.page===torPage)?.box} onBox={dialog==='repair'&&!busy?setRepairBox:undefined} onPageCount={registerSourceCount}/></>:<div className="tor-text-preview"><p className="muted">{project.sourceType==='comply-table'?'ข้อกำหนดที่อ่านจากคอลัมน์ TOR ในตารางต้นฉบับ · เปิดไฟล์เดิมได้จากเมนูข้อ TOR':'ข้อความจาก DOCX / ข้อที่กรอกเอง · DOCX ไม่มีเลขหน้า PDF ต้นฉบับ'}</p>{requirement?<><h3>ข้อ {reqId}</h3><p>{requirement.textSnapshot}</p></>:<p>เลือกข้อ TOR</p>}</div>}
          {reviewOpen&&requirement&&<div className="inline-review"><RequirementEditor key={reqId+':'+(requirement.sourceCorrections?.length||0)} requirement={requirement} maxPage={project.sourcePageCount} onSave={patch=>{actions.updateRequirement(projectId,reqId,patch);const latest=useProjectStore.getState().projects.find(p=>p.id===projectId).requirements.find(r=>r.id===patch.id);setSelected(patch.id);setReviewOpen(!latest.reviewed);setMessage(latest.reviewed?'ตรวจ TOR แล้ว':'บันทึกข้อความใหม่แล้ว ตรวจยืนยันข้อความที่บันทึกอีกครั้ง');}} onDelete={()=>{actions.deleteRequirement(projectId,reqId);setSelected(null);}}/></div>}
        </section>
        <Splitter label="ปรับความกว้าง TOR" value={middleWidth} onChange={v=>setMiddleWidth(Math.max(20,Math.min(45,v)))}/>
        <section className="work-pane evidence-pane"><div className="pane-title"><div><span className="pane-index">03</span><h2>หลักฐาน</h2></div><button className="text-button" onClick={()=>{setLibraryView('documents');setDialog('library');}}>+ เพิ่มไฟล์</button></div>
          <div className="evidence-picker"><select aria-label="เอกสารหลักฐาน" disabled={busy} value={view.docId||''} onChange={e=>{setView({docId:e.target.value||null,page:1,focus:null});setBox(null);setSelectedMark(null);}}><option value="">ยังไม่ผูกหลักฐาน · เลือกไฟล์เพื่อเพิ่ม</option>{project.docs.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></div>
          {doc&&<div className="evidence-association"><strong>{FILE_ROLES[doc.role]}</strong><span>{doc.role==='bidder'?'เอกสารที่จัดไว้สำหรับผู้ยื่นข้อเสนอ':'จัดกลุ่มไว้กับ: '+doc.itemIds.map(id=>project.products.find(item=>item.id===id)).filter(Boolean).map(item=>[item.name,item.brand,item.model,item.provider].filter(Boolean).join(' ')).join(' · ')}</span></div>}
          {marks.length>0&&<div className="evidence-tabs">{marks.map((mark,i)=><button className={mark.id===selectedMark?'active':''} key={mark.id} onClick={()=>openMark(mark)} title={project.docs.find(d=>d.id===mark.docId)?.name}>{i+1} · PDF {mark.pdfPage}{mark.printedPage?' · หน้าพิมพ์ '+mark.printedPage:''}{mark.reviewed!==true?' · รอตรวจ':''}</button>)}</div>}
          {doc&&<Pager label="หลักฐาน" page={view.page} count={doc.pageCount} onChange={page=>{setView(v=>({...v,page,focus:null}));setBox(null);setSelectedMark(null);}}/>}
          <PdfStage docId={doc?.id} pageNumber={view.page} marks={pageMarks} resetToken={reqId+':'+project.evidence.length} onBox={busy?undefined:onBox} focusBox={view.focus}/>
          {box&&<form className="mark-editor" onSubmit={saveMark}><div className="pane-subheading"><strong>หลักฐานใหม่ · ข้อ {reqId}</strong><button className="text-button" disabled={busy} type="button" onClick={ocrSelection}>OCR เฉพาะกรอบ</button></div><textarea aria-label="ข้อความหลักฐานที่เลือก" disabled={busy} value={quote} onChange={e=>{setQuote(e.target.value);setQuoteMethod('manual');setQuoteReviewed(false);}} placeholder="กรอกข้อความที่เห็นในกรอบ หรือกด OCR เฉพาะกรอบ"/><div className="mark-line"><input aria-label="เลขหน้าที่พิมพ์" placeholder="เลขหน้าที่พิมพ์ (ถ้ามี)" value={printedPage} onChange={e=>setPrintedPage(e.target.value)}/><label><input type="checkbox" checked={quoteReviewed} disabled={busy} onChange={e=>setQuoteReviewed(e.target.checked)}/>ตรวจข้อความเทียบภาพแล้ว</label><button className="brand-button" disabled={busy}>ผูกหลักฐาน</button></div></form>}
          {selectedEvidence&&!box&&<EvidenceEditor key={selectedEvidence.id+':'+selectedEvidence.quote+':'+selectedEvidence.printedPage} project={project} mark={selectedEvidence} reqId={reqId} run={run} busy={busy}/>}
          {doc&&<button className="evidence-export" disabled={busy} onClick={()=>run(async()=>{const snapshot=useProjectStore.getState().projects.find(p=>p.id===projectId);if(snapshot.evidence.some(m=>m.docId===doc.id&&m.reviewed!==true))throw new Error('ตรวจข้อความหลักฐานที่อ้างก่อนส่งออก');const {exportAnnotatedPdf}=await import('@/lib/exportPdf');downloadBlob(await exportAnnotatedPdf(snapshot,doc.id),'marked-'+doc.name);},'ส่งออกหลักฐานพร้อมไฮไลต์แล้ว')}>↓ PDF หลักฐานพร้อมเลขข้อ</button>}
        </section>
      </div>
      <footer className="workspace-footer"><span>เอกสารอยู่ในเครื่องนี้ · สำรองไฟล์โครงการเพื่อย้ายงาน</span><span>ลากเส้นคั่นเพื่อปรับพื้นที่ · {busy?'กำลังทำงาน…':'พร้อมทำงาน'}</span></footer>
    </div>

  </div>;
}
