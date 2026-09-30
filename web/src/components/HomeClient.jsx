'use client';
import {useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {AppShell} from './AppShell';
import {ComplyIntakePreview} from './ComplyIntakePreview';
import {useProjectStore} from '@/store/projectStore';
import {parsePages} from '@/lib/torModel.mjs';
import {deleteFile,putFile} from '@/lib/localFiles';
import {projectFileIds} from '@/lib/projectModel.mjs';
import {DEFAULT_PROFILE,validateProfile} from '@/lib/tableModel.mjs';
import {isComplyTable} from '@/lib/complyIntake.mjs';
export function HomeClient() {
  const router=useRouter();
  const projects=useProjectStore(s=>s.projects);
  const createProject=useProjectStore(s=>s.createProject),deleteProject=useProjectStore(s=>s.deleteProject);
  const [mounted,setMounted]=useState(false),[name,setName]=useState(''),[file,setFile]=useState(null);
  const [sourceType,setSourceType]=useState('comply-table'),[prepared,setPrepared]=useState(null),[selection,setSelection]=useState(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>setMounted(true),[]);
  const onReady=useCallback(value=>setSelection(value),[]);
  function chooseFile(next) {
    setFile(next);setPrepared(null);setSelection(null);setError('');
    if(next)setName(current=>current.trim()?current:next.name.replace(/\.[^.]+$/,'').slice(0,160));
  }
  async function create(event) {
    event.preventDefault();setBusy(true);setError('');
    let savedId=null;
    try {
      if(file&&file.size>40*1024*1024)throw new Error('ไฟล์ต้นฉบับเกิน 40 MB');
      if(sourceType==='comply-table'&&!prepared) {
        if(!file)throw new Error('เลือกตาราง Comply ก่อน');
        const {readComplyDocument}=await import('@/lib/complyBrowser');
        setPrepared(await readComplyDocument(file));
        return;
      }
      let requirements=[],unreadablePages=[],pages=[],template=null,sourceTable=null,sourceWarnings=[],sourceUnresolvedRows=[];
      if(sourceType==='comply-table') {
        if(!selection?.confirmed||selection.error||!selection.requirements.length)throw new Error('ตรวจ preview และยืนยันคอลัมน์เลขข้อ/ข้อกำหนดก่อน');
        const {templateForSource}=await import('@/lib/complyBrowser');
        const originalTable=prepared.tables.find(t=>t.id===selection.main.id);
        const base=selection.main.id===prepared.defaultTableId&&selection.main.headerRow===originalTable.headerRow?prepared.template:await templateForSource(file,prepared,selection.main);
        const columns=base.profile.columns.map((col,i)=>({...col,field:i===selection.mapping.textColumn?'requirement':i===selection.mapping.numberColumn?'number':['number','requirement'].includes(col.field)?'proposal':col.field}));
        for(const field of ['proposal','comparison','references'])if(!columns.some(c=>c.field===field))columns.push(structuredClone(DEFAULT_PROFILE.columns.find(c=>c.field===field)));
        const profile={...base.profile,columns};validateProfile(profile);
        const selectedTables=selection.selected.map(t=>({tableIndex:t.tableIndex,headerRow:t.headerRow}));
        const excludedTables=prepared.tables.filter(t=>isComplyTable(t)&&!selection.selected.some(s=>s.id===t.id)).map(t=>t.tableIndex).filter(Number.isInteger);
        template={...base,name:file.name,profile,native:{...base.native,sourceTables:prepared.format==='docx'?selectedTables:undefined,excludedTables,rebuildTable:base.native?.rebuildTable||columns.length!==selection.main.headers.length}};
        requirements=selection.requirements;pages=prepared.pages;
        sourceWarnings=selection.warnings||[];sourceUnresolvedRows=selection.unresolvedRows||[];
        sourceTable={tableIds:selection.selected.map(t=>t.id),numberColumn:selection.mapping.numberColumn,textColumn:selection.mapping.textColumn,headers:selection.main.headers};
      } else if(file) {
        if(/\.pdf$/i.test(file.name)) {
          const {extractPdf}=await import('@/lib/pdfBrowser');pages=await extractPdf(file);
          ({requirements,unreadablePages}=parsePages(pages));
        } else if(/\.docx$/i.test(file.name)) {
          const {extractDocx}=await import('@/lib/docxBrowser');const parsed=await extractDocx(file);({requirements,unreadablePages}=parsed);sourceWarnings=parsed.warnings||[];
        } else throw new Error('TOR ต้นฉบับรองรับ PDF หรือ DOCX');
      }
      if(file) {
        savedId=crypto.randomUUID();await putFile(savedId,file,pages.map(p=>p.text),pages);
        if(template)template.id=savedId;
      }
      const id=createProject({name,torDocId:savedId,torFilename:file?.name||'',requirements,unreadablePages,template,sourceType,sourceTable,sourceWarnings,sourceUnresolvedRows});
      router.push('/project/'+id);
    } catch(cause) {
      if(savedId&&!useProjectStore.getState().projects.some(p=>projectFileIds(p).includes(savedId)))await deleteFile(savedId).catch(()=>{});
      setError(cause.message||'นำเข้าตารางไม่สำเร็จ');
    } finally {setBusy(false);}
  }
  async function remove(project) {
    if(!window.confirm('ลบโครงการ '+project.name+' และไฟล์ที่เก็บในเครื่องนี้?'))return;
    try{await Promise.all(projectFileIds(project).map(deleteFile));deleteProject(project.id);}
    catch(cause){setError(cause.message||'ลบโครงการไม่สำเร็จ');}
  }
  async function restore(event) {
    const file=event.target.files?.[0];if(!file)return;
    setBusy(true);setError('');let result;
    try{const {importProjectArchive}=await import('@/lib/projectArchive');result=await importProjectArchive(file);const id=useProjectStore.getState().importProject(result.project);router.push('/project/'+id);}
    catch(cause){if(result)await result.rollback();setError(cause.message||'นำเข้าโครงการไม่สำเร็จ');}
    finally{setBusy(false);event.target.value='';}
  }
  return <AppShell>
    <section className="intake-home-grid">
      <div className="intake-home-intro"><p className="eyebrow">Presales workspace / TOR Comply</p><h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight">เริ่มจากตาราง Comply<br/><span className="text-[#ff0038]">แล้วให้หลักฐานตอบทุกข้อ</span></h1><p className="mt-5 text-sm leading-7 text-zinc-600">นำเข้าตารางที่มีข้อกำหนด ช่องคำตอบจะว่างหรือเคยกรอกแล้วก็ได้ ใช้ไฟล์เดียวเป็นต้นฉบับและแม่แบบ จากนั้นเพิ่มเอกสารสินค้า/บริการเพื่อค้นและไฮไลต์หลักฐาน</p><div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold"><span className="flow-chip">ตารางต้นฉบับ</span><b className="text-[#ff0038]">→</b><span className="flow-chip">ตรวจ TOR</span><b className="text-[#ff0038]">→</b><span className="flow-chip">ผูกหลักฐาน</span></div><p className="mt-5 text-xs leading-6 text-zinc-500">ไฟล์ตารางกับคำตอบเก่าจะไม่ถูกค้นเป็นหลักฐาน เอกสารและข้อมูลโครงการอยู่ในเครื่องที่ใช้งาน</p></div>
      <form className="intake-create-form" onSubmit={create}>
        <p className="eyebrow">01 / โครงการใหม่</p><h2 className="mb-5 mt-2 text-xl font-bold">นำเข้าไฟล์แรกของโครงการ</h2>
        <div className="segmented"><button type="button" disabled={busy} aria-pressed={sourceType==='comply-table'} onClick={()=>{setSourceType('comply-table');chooseFile(null);}}>ตาราง Comply + แม่แบบ</button><button type="button" disabled={busy} aria-pressed={sourceType==='tor'} onClick={()=>{setSourceType('tor');chooseFile(null);}}>TOR ต้นฉบับ</button></div>
        <label className="form-label">ชื่อโครงการ<input className="form-input" value={name} onChange={e=>setName(e.target.value)} maxLength={160} required/></label>
        <label className="form-label mt-4">{sourceType==='comply-table'?'ตาราง Comply (DOCX / PDF / XLSX)':'ไฟล์ TOR (PDF หรือ DOCX)'}<input key={sourceType} className="form-input" type="file" accept={sourceType==='comply-table'?'.docx,.pdf,.xlsx':'.pdf,.docx'} required={sourceType==='comply-table'} disabled={busy||!mounted} onChange={e=>chooseFile(e.target.files?.[0]||null)}/></label>
        <p className="mt-3 text-xs leading-5 text-zinc-500">{sourceType==='comply-table'?'อ่านเฉพาะหัวตาราง เลขข้อ และข้อกำหนด ต้องมีข้อความให้อ่านในไฟล์ PDF':'นำเข้าข้อกำหนดหรือเริ่มกรอกเอง แล้วเลือกแม่แบบเพิ่มเติมในโครงการได้'}</p>
        {prepared&&sourceType==='comply-table'&&<ComplyIntakePreview prepared={prepared} onReady={onReady}/>}
        {error&&<p role="alert" className="error-message mt-3">{error}</p>}
        <button className="brand-button mt-5 w-full" disabled={busy||!mounted||(sourceType==='comply-table'&&prepared&&(!selection?.confirmed||selection?.error||!selection?.requirements.length))}>{busy?'กำลังอ่านไฟล์…':sourceType==='comply-table'?(prepared?'สร้างโครงการจากตารางนี้':'อ่านตารางและตรวจคอลัมน์'):'สร้างโครงการและอ่าน TOR'}</button>
      </form>
    </section>
    <section className="border-t border-zinc-200 pt-7"><div className="flex items-center justify-between"><h2 className="text-base font-bold">โครงการในเครื่องนี้</h2><label className="outline-button cursor-pointer">นำเข้าไฟล์โครงการ<input className="hidden" type="file" accept=".torproj,.zip" disabled={busy||!mounted} onChange={restore}/></label></div>
      {!mounted?<p className="mt-3 text-sm text-zinc-500">กำลังโหลดโครงการ…</p>:projects.length===0?<p className="mt-3 text-sm text-zinc-500">ยังไม่มีโครงการ</p>:<ul className="mt-4 grid gap-2">{projects.map(project=><li key={project.id} className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white p-4"><button className="min-w-0 flex-1 text-left" onClick={()=>router.push('/project/'+project.id)}><strong className="block truncate text-sm">{project.name}</strong><span className="mt-1 block text-xs text-zinc-500">{project.requirements.length} ข้อ TOR · {project.docs.length} เอกสาร</span></button><button className="text-xs font-semibold text-red-700" onClick={()=>remove(project)} type="button">ลบ</button></li>)}</ul>}
    </section><p className="mt-8 text-xs text-zinc-500">ข้อมูลอยู่ในเบราว์เซอร์นี้ ย้ายงานด้วยไฟล์โครงการ และไม่ซิงก์เอกสารขึ้นเซิร์ฟเวอร์</p>
  </AppShell>;
}
