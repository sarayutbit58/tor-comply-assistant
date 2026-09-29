'use client';
import {useState} from 'react';
import {useProjectStore} from '@/store/projectStore';
import {putFile,deleteFile,getFile} from '@/lib/localFiles';
import {FILE_ROLES} from '@/lib/projectModel.mjs';
import {downloadBlob} from '@/lib/download';
export function LibraryManager({project,run,busy,onTemplate}) {
  const [kind,setKind]=useState('product'),[role,setRole]=useState(''),[items,setItems]=useState([]);
  const actions=useProjectStore.getState();
  async function addItem(event){
    event.preventDefault();const form=event.currentTarget,data=new FormData(form);
    await run(async()=>{
      actions.addProduct(project.id,{kind,name:String(data.get('name')).trim(),brand:String(data.get('brand')||'').trim(),model:String(data.get('model')||'').trim(),provider:String(data.get('provider')||'').trim(),endpoints:String(data.get('endpoints')||'').trim(),bandwidth:String(data.get('bandwidth')||'').trim()});form.reset();
    },'เพิ่มรายการแล้ว');
  }
  async function upload(event){
    event.preventDefault();const form=event.currentTarget,file=form.elements.sourceFile.files?.[0];
    await run(async()=>{
      if(!role||!file)throw new Error('เลือกประเภทไฟล์และไฟล์ก่อน');
      if(file.size>40*1024*1024)throw new Error('ไฟล์ต้องไม่เกิน 40 MB');
      if(role==='template'){
        const {readTemplate}=await import('@/lib/templateBrowser');
        const template=await readTemplate(file),id=crypto.randomUUID();
        await putFile(id,file);
        try{actions.settings(project.id,{template:{...template,id,name:file.name}});}catch(error){await deleteFile(id);throw error;}
        if(project.template?.id)await deleteFile(project.template.id);
        form.reset();onTemplate();return;
      }
      if(!/\.pdf$/i.test(file.name))throw new Error('เอกสารหลักฐานใช้ PDF เพื่อเก็บหน้าและตำแหน่งไฮไลต์');
      if(role!=='bidder'&&!items.length)throw new Error('เลือกสินค้า/บริการที่เอกสารนี้อ้างถึง');
      const {extractPdf}=await import('@/lib/pdfBrowser'),pages=await extractPdf(file),id=crypto.randomUUID();
      await putFile(id,file,pages.map(p=>p.text),pages);
      try{actions.addDocument(project.id,{id,name:file.name,role,itemIds:items,pageCount:pages.length,searchText:pages.map(p=>p.text).join(' ').slice(0,60000),addedAt:new Date().toISOString()});}catch(error){await deleteFile(id);throw error;}
      form.reset();
    },'อ่านและจัดประเภทไฟล์แล้ว');
  }
  const linkedItems=project.products.filter(i=>role==='bidder'||i.kind===role);
  return <div className="library-grid"><section>
    <div className="segmented"><button aria-pressed={kind==='product'} onClick={()=>setKind('product')}>สินค้า</button><button aria-pressed={kind==='service'} onClick={()=>setKind('service')}>บริการ</button></div>
    <form key={kind} className="stack-form" onSubmit={addItem}>
      <label className="form-label">ชื่อ{kind==='product'?'สินค้า':'บริการ'}<input className="form-input" name="name" required maxLength={160}/></label>
      {kind==='product'?<div className="form-grid"><label className="form-label">ยี่ห้อ<input name="brand" className="form-input" required/></label><label className="form-label">รุ่น<input name="model" className="form-input" required/></label></div>:<>
        <label className="form-label">ผู้ให้บริการ<input name="provider" className="form-input"/></label>
        <label className="form-label">จุดต้นทาง–ปลายทาง / พื้นที่ให้บริการ<input name="endpoints" className="form-input"/></label>
        <label className="form-label">ความเร็ว / รายละเอียดบริการ<input name="bandwidth" className="form-input"/></label>
      </>}
      <button className="dark-button" disabled={busy}>เพิ่ม{kind==='product'?'สินค้า':'บริการ'}</button>
    </form>
    <div className="item-list">{project.products.filter(i=>i.kind===kind).map(item=><div key={item.id}><div><strong>{item.name}</strong><small>{[item.brand,item.model,item.provider,item.bandwidth,item.endpoints].filter(Boolean).join(' · ')}</small></div><button className="text-button danger" onClick={()=>{if(window.confirm('ลบรายการนี้และยกเลิกผลที่เกี่ยวข้อง?'))actions.removeProduct(project.id,item.id);}}>ลบ</button></div>)}</div>
  </section><section>
    <h3>จัดประเภทเอกสาร</h3><p className="muted">TOR และแม่แบบจะไม่ถูกนำมาค้นเป็นหลักฐาน</p>
    <form className="stack-form" onSubmit={upload}>
      <label className="form-label">ประเภทไฟล์<select className="form-input" required value={role} onChange={e=>{setRole(e.target.value);setItems([]);}}><option value="">เลือกประเภทไฟล์…</option>{Object.entries(FILE_ROLES).filter(([id])=>id!=='tor').map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      {role&&role!=='template'&&<fieldset className="check-list"><legend>เอกสารนี้ยืนยันรายการใดบ้าง</legend>{linkedItems.length?linkedItems.map(item=><label key={item.id}><input type="checkbox" checked={items.includes(item.id)} onChange={e=>setItems(old=>e.target.checked?[...old,item.id]:old.filter(id=>id!==item.id))}/>{item.name}</label>):<p className="muted">เพิ่ม{role==='service'?'บริการ':'สินค้า'}ก่อน หรือเลือกหลักฐานคุณสมบัติผู้ยื่นข้อเสนอ</p>}</fieldset>}
      <label className="form-label">{role==='template'?'แม่แบบ DOCX / PDF / XLSX':'หลักฐาน PDF'}<input className="form-input" name="sourceFile" type="file" accept={role==='template'?'.docx,.pdf,.xlsx':'.pdf'} required disabled={!role}/></label>
      <button className="brand-button" disabled={busy||!role}>{busy?'กำลังอ่านไฟล์…':'เพิ่มไฟล์ตามประเภทที่เลือก'}</button>
    </form>
    <div className="file-inventory">
      <div><span className="file-role">TOR</span><span>{project.torFilename||'กรอกข้อ TOR เอง'}</span></div>
      {project.template&&<div><span className="file-role">แม่แบบ</span><span>{project.template.name}</span><button className="text-button" onClick={onTemplate}>ตั้งค่า</button></div>}
      {project.docs.map(doc=><div key={doc.id}><span className="file-role">{FILE_ROLES[doc.role]}</span><span>{doc.name}<small>{doc.pageCount} หน้า · {doc.itemIds.map(id=>project.products.find(i=>i.id===id)?.name).filter(Boolean).join(', ')||'ทั้งโครงการ'}</small></span><button className="text-button" onClick={()=>run(async()=>{const entry=await getFile(doc.id);if(!entry)throw new Error('ไม่พบต้นฉบับ');downloadBlob(entry.blob,doc.name);})}>ต้นฉบับ</button><button className="text-button danger" onClick={()=>{if(window.confirm('ลบเอกสารและไฮไลต์ที่เกี่ยวข้อง?'))run(async()=>{actions.removeDocument(project.id,doc.id);await deleteFile(doc.id);},'ลบเอกสารแล้ว');}}>ลบ</button></div>)}
    </div>
  </section></div>;
}
