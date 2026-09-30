'use client';
import {useState} from 'react';
import {useProjectStore} from '@/store/projectStore';
import {linkedRequirements} from '@/lib/projectModel.mjs';
export function EvidenceEditor({project,mark,reqId,run,busy}) {
 const [quote,setQuote]=useState(mark.quote||mark.keyword||''),[printed,setPrinted]=useState(mark.printedPage||''),actions=useProjectStore.getState();
 const changed=quote.trim()!==mark.quote||printed.trim()!==(mark.printedPage||'');
 return <div className="mark-editor"><div className="pane-subheading"><strong>อ้างอิงข้อ {linkedRequirements(mark).join(', ')}</strong><button className="text-button danger" disabled={busy} onClick={()=>run(async()=>actions.removeEvidence(project.id,mark.id,reqId),'ยกเลิกการผูกกับข้อนี้แล้ว · ย้อนกลับได้')}>ยกเลิกข้อนี้</button></div>
  <textarea aria-label="แก้ข้อความหลักฐาน" value={quote} disabled={busy} onChange={e=>setQuote(e.target.value)}/><div className="mark-line"><input aria-label="แก้เลขหน้าที่พิมพ์" value={printed} disabled={busy} onChange={e=>setPrinted(e.target.value)}/><button className="outline-button" disabled={busy||!changed||!quote.trim()} onClick={()=>run(async()=>actions.updateEvidence(project.id,mark.id,{quote:quote.trim(),printedPage:printed.trim()}),'บันทึกข้อความแล้ว ตรวจเทียบกรอบไฮไลต์อีกครั้ง')}>บันทึกข้อความ</button></div>
  <button className="outline-button" disabled={busy||changed||mark.reviewed===true} onClick={()=>run(async()=>actions.updateEvidence(project.id,mark.id,{reviewed:true}),'ตรวจข้อความหลักฐานแล้ว กรุณาประเมินอีกครั้ง')}>{mark.reviewed?'ตรวจหลักฐานแล้ว':'ตรวจข้อความเทียบภาพแล้ว'}</button>
  <details><summary>ใช้หลักฐานจุดนี้กับข้ออื่น</summary><div className="shared-clauses">{project.requirements.map(r=><label key={r.id}><input type="checkbox" disabled={busy} checked={linkedRequirements(mark).includes(r.id)} onChange={e=>run(async()=>{const ids=e.target.checked?[...linkedRequirements(mark),r.id]:linkedRequirements(mark).filter(id=>id!==r.id);if(!ids.length)throw new Error('ใช้ปุ่มยกเลิกเพื่อลบการผูกสุดท้าย');actions.updateEvidence(project.id,mark.id,{requirementIds:ids});})}/>ข้อ {r.id}</label>)}</div></details>
  <button className="text-button danger" disabled={busy} onClick={()=>{if(window.confirm('ลบหลักฐานจุดนี้จากทุกข้อที่ผูกไว้?'))run(async()=>actions.removeEvidence(project.id,mark.id),'ลบหลักฐานแล้ว · ย้อนกลับได้');}}>ลบจุดนี้จากทุกข้อ</button>
  <p className="muted">แก้ข้อความจุดที่ใช้ร่วมกันจะยกเลิกผลทุกข้อที่ผูกไว้ ปรับกรอบโดยลากกรอบใหม่ แล้วผูกแทนจุดเดิม</p>
 </div>;
}
