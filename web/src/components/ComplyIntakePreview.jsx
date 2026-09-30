'use client';
import {useEffect,useMemo,useState} from 'react';
import {compatibleTable,extractComplyRequirements,inferSourceMapping,pdfTableRows} from '@/lib/complyIntake.mjs';
export function ComplyIntakePreview({prepared,onReady}) {
  const first=prepared.tables.find(t=>t.id===prepared.defaultTableId);
  const [tableId,setTableId]=useState(first.id),[mapping,setMapping]=useState(()=>inferSourceMapping(first.headers));
  const [included,setIncluded]=useState(()=>prepared.tables.filter(t=>compatibleTable(t,first)).map(t=>t.id));
  const [layout,setLayout]=useState(prepared.pdfLayout),[confirmed,setConfirmed]=useState(false);
  const pdfRows=useMemo(()=>{
    if(prepared.format!=='pdf')return null;
    try{return {rows:pdfTableRows(prepared.pages,layout),error:null};}
    catch(error){return {rows:[],error:error.message};}
  },[prepared,layout]);
  const tables=useMemo(()=>pdfRows?prepared.tables.map(t=>({...t,rows:pdfRows.rows})):prepared.tables,[prepared,pdfRows]);
  const main=tables.find(t=>t.id===tableId)||tables[0];
  const selected=useMemo(()=>tables.filter(t=>included.includes(t.id)&&compatibleTable(t,main)),[tables,included,main]);
  const parsed=useMemo(()=>{
    try{if(pdfRows?.error)throw new Error(pdfRows.error);return {...extractComplyRequirements(selected,mapping),error:null};}
    catch(error){return {requirements:[],warnings:[],error:error.message};}
  },[selected,mapping,pdfRows]);
  const ready=useMemo(()=>({main,selected,mapping,requirements:parsed.requirements,warnings:parsed.warnings,error:parsed.error,confirmed,pdfLayout:layout}),[main,selected,mapping,parsed,confirmed,layout]);
  useEffect(()=>onReady(ready),[ready,onReady]);
  function choose(id) {
    const table=tables.find(t=>t.id===id);setTableId(id);setMapping(inferSourceMapping(table.headers));
    setIncluded(tables.filter(t=>compatibleTable(t,table)).map(t=>t.id));setConfirmed(false);
  }
  function changeMapping(patch){setMapping(m=>({...m,...patch}));setConfirmed(false);}
  function changeLayout(patch){setLayout(l=>({...l,...patch,pageLayouts:undefined}));setConfirmed(false);}
  return <div className="intake-preview">
    <div className="intake-preview-heading"><strong>อ่านหัวตารางแล้ว · {parsed.requirements.length} ข้อ TOR</strong><span>คำตอบและผลเดิมถูกละไว้</span></div>
    {prepared.format==='xlsx'&&<p className="muted">แผ่นงานแรกที่อ่าน: {main.sheetName}</p>}
    {tables.length>1&&<>
      <label className="form-label">ตารางหลักสำหรับแม่แบบ<select className="form-input" value={tableId} onChange={e=>choose(e.target.value)}>{tables.map((t,i)=><option key={t.id} value={t.id}>ตาราง {i+1} · {t.rows.length} แถว</option>)}</select></label>
      <fieldset className="intake-tables"><legend>นำเข้าตารางที่ใช้หัวคอลัมน์เดียวกัน</legend>{tables.filter(t=>compatibleTable(t,main)).map(t=><label key={t.id}><input type="checkbox" checked={included.includes(t.id)} disabled={t.id===tableId} onChange={e=>{setIncluded(ids=>e.target.checked?[...ids,t.id]:ids.filter(id=>id!==t.id));setConfirmed(false);}}/>ตาราง {tables.indexOf(t)+1} · {t.rows.length} แถว</label>)}</fieldset>
    </>}
    <div className="form-grid"><label className="form-label">คอลัมน์เลขข้อ<select className="form-input" value={mapping.numberColumn??'inline'} onChange={e=>changeMapping({numberColumn:e.target.value==='inline'?null:Number(e.target.value)})}><option value="inline">เลขข้ออยู่ในข้อความ TOR</option>{main.headers.map((h,i)=><option key={i} value={i}>{i+1}. {h||'ไม่ระบุหัวคอลัมน์'}</option>)}</select></label><label className="form-label">คอลัมน์ข้อกำหนด TOR<select className="form-input" value={mapping.textColumn} onChange={e=>changeMapping({textColumn:Number(e.target.value)})}>{main.headers.map((h,i)=><option key={i} value={i}>{i+1}. {h||'ไม่ระบุหัวคอลัมน์'}</option>)}</select></label></div>
    {prepared.format==='pdf'&&<details className="intake-pdf-controls"><summary>ปรับขอบเขตคอลัมน์ PDF เมื่อข้อความเข้าผิดช่อง</summary><p className="muted">ตำแหน่งเป็นเปอร์เซ็นต์ของหน้า จากซ้ายไปขวา ปรับแล้วตรวจ preview ใหม่</p><div className="intake-edges">{layout.edges.map((value,i)=><label className="form-label" key={i}>{i===0?'ขอบซ้าย':i===layout.edges.length-1?'ขอบขวา':'เส้น '+i}<input className="form-input" type="number" step=".1" min="0" max="100" value={Number((value*100).toFixed(2))} onChange={e=>{const edges=[...layout.edges];edges[i]=Number(e.target.value)/100;changeLayout({edges});}}/></label>)}</div><div className="form-grid"><label className="form-label">เริ่มข้อมูลใต้หัวตาราง (%)<input className="form-input" type="number" min="0" max="100" step=".1" value={Number((layout.headerBottom*100).toFixed(2))} onChange={e=>changeLayout({headerBottom:Number(e.target.value)/100})}/></label><label className="form-label">ขอบล่างตาราง (%)<input className="form-input" type="number" min="0" max="100" step=".1" value={Number((layout.bottom*100).toFixed(2))} onChange={e=>changeLayout({bottom:Number(e.target.value)/100})}/></label></div></details>}
    {parsed.error&&<p role="alert" className="error-message">{parsed.error}</p>}
    {parsed.warnings.map(w=><p key={w} className="notice">{w}</p>)}
    <div className="intake-clause-list">{parsed.requirements.map(req=><div key={req.id}><strong>ข้อ {req.id}</strong><p>{req.textSnapshot}</p><small>{req.sourcePage?'PDF หน้า '+req.sourcePage:'แถว '+req.sourceRow}{req.duplicateOf?' · เลขข้อซ้ำ ต้องแก้ก่อนส่งออก':''}</small></div>)}</div>
    <p className="muted">ไฟล์เดียวนี้จะเก็บเป็นต้นฉบับและแม่แบบ ช่องรายละเอียดที่เสนอ ผลเปรียบเทียบ และเอกสารอ้างอิงเริ่มใหม่ทั้งหมด</p>
    <label className="intake-confirm"><input type="checkbox" checked={confirmed} disabled={!!parsed.error||!parsed.requirements.length} onChange={e=>setConfirmed(e.target.checked)}/>เลือกคอลัมน์เลขข้อและข้อกำหนดถูกต้องแล้ว</label>
    <p className="muted">หลังสร้างโครงการ ยังต้องตรวจและยืนยันข้อความ TOR แต่ละข้อก่อนใช้ Auto</p>
  </div>;
}
