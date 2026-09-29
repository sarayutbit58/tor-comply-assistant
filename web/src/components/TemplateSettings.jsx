'use client';
import {useState} from 'react';
import {FIELDS,profileFor,validateProfile,tableRows} from '@/lib/tableModel.mjs';
import {useProjectStore} from '@/store/projectStore';
export function TemplateSettings({project,run,onLibrary}) {
  const [profile,setProfile]=useState(()=>structuredClone(profileFor(project)));
  const update=(key,value)=>setProfile(p=>({...p,[key]:value}));
  const updateColumn=(index,patch)=>setProfile(p=>({...p,columns:p.columns.map((c,i)=>i===index?{...c,...patch}:c)}));
  const preview={...project,template:{...project.template,profile}};
  return <div className="stack-form">
    <div className="notice">{project.template?project.template.name:'ใช้รูปแบบมาตรฐาน · เพิ่มแม่แบบ DOCX, PDF หรือ XLSX ได้หนึ่งไฟล์ต่อโครงการ'}<button className="text-button" onClick={onLibrary}>เลือกแม่แบบ</button></div>
    {project.template?.notices?.map(n=><p key={n} className="muted">{n}</p>)}
    <p className="muted">กำหนดว่าคอลัมน์ใดรับข้อมูลอะไร คำตอบเก่าในแม่แบบจะไม่ถูกนำเข้ามา</p>
    {profile.columns.map((col,i)=><div className="template-column" key={i}><label className="form-label">หัวคอลัมน์ {i+1}<input className="form-input" value={col.heading} onChange={e=>updateColumn(i,{heading:e.target.value})}/></label><label className="form-label">ข้อมูล<select className="form-input" value={col.field} onChange={e=>updateColumn(i,{field:e.target.value})}>{Object.entries(FIELDS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label className="form-label">ความกว้าง<input type="number" min="1" className="form-input" value={col.width} onChange={e=>updateColumn(i,{width:Number(e.target.value)})}/></label></div>)}
    <div className="form-grid"><label className="form-label">ขนาดตัวอักษร<input className="form-input" type="number" min="7" max="24" value={profile.fontSize} onChange={e=>update('fontSize',Number(e.target.value))}/></label><label className="form-label">ชื่อแบบอักษร<input className="form-input" value={profile.font} onChange={e=>update('font',e.target.value)}/></label><label className="form-label">สีหัวตาราง<input type="color" value={'#'+profile.headerFill} onChange={e=>update('headerFill',e.target.value.slice(1))}/></label><label className="form-label">สีข้อความหัวตาราง<input type="color" value={'#'+profile.headerColor} onChange={e=>update('headerColor',e.target.value.slice(1))}/></label></div>
    <label className="form-label">ชื่อเอกสารส่งออก<input className="form-input" value={profile.heading} onChange={e=>update('heading',e.target.value)}/></label>
    <div className="table-preview"><table><thead><tr>{profile.columns.map((c,i)=><th key={i} style={{background:'#'+profile.headerFill,color:'#'+profile.headerColor}}>{c.heading}</th>)}</tr></thead><tbody>{tableRows(preview).slice(0,2).map((row,i)=><tr key={i}>{row.map((text,c)=><td key={c}>{text||'—'}</td>)}</tr>)}</tbody></table></div>
    <button className="brand-button" onClick={()=>run(async()=>{validateProfile(profile);useProjectStore.getState().settings(project.id,{template:{...project.template,profile}});},'บันทึกแม่แบบแล้ว')}>บันทึกการจับคู่คอลัมน์</button>
    <p className="muted">DOCX ที่ใช้แม่แบบ DOCX จะคงรูปแบบเซลล์เดิม ส่วน PDF และ Excel ใช้รูปแบบที่อ่านได้ด้านบน การแปลงข้ามชนิดไฟล์อาจจัดหน้าต่างจากต้นฉบับ</p>
  </div>;
}
