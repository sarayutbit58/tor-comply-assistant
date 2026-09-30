import {STATUS,eligibleDocument,evidenceFor,exportProblems,passProblems,rowMode} from './projectModel.mjs';
export function planBatch(project) {
 const ready=[],skipped=[],globalReview=!project.sourceCoveragePending&&!project.unreadablePages.length&&project.requirements.every(r=>r.reviewed);
 for(const req of project.requirements) {
  const row=project.rows[req.id];let reason='';
  if(!req.reviewed)reason='ตรวจ TOR ข้อนี้ก่อน';
  else if(rowMode(project,req.id)==='auto'&&!globalReview)reason='Auto ต้องตรวจ TOR ครบทุกข้อและทุกหน้า';
  else if(!row?.itemIds?.length&&row?.scope!=='bidder')reason='เลือกสินค้า/บริการก่อน';
  else if(!project.docs.some(d=>eligibleDocument(d)&&(row.scope==='bidder'?d.role==='bidder':d.itemIds.some(id=>row.itemIds.includes(id)))))reason='เพิ่มและจัดกลุ่มไฟล์หลักฐานก่อน';
  if(reason)skipped.push({id:req.id,reason});else ready.push(req.id);
 }
 return {ready,skipped};
}
export function workflowSummary(project) {
 const checks=project.requirements.map(r=>({id:r.id,reviewed:r.reviewed,row:project.rows[r.id],marks:evidenceFor(project,r.id)}));
 const blockers=exportProblems(project),plan=planBatch(project);
 const next=project.sourceCoveragePending?{action:'pages',label:'ตรวจความครบถ้วนของต้นฉบับที่มีคำเตือน'}:project.unreadablePages.length?{action:'pages',label:'ตรวจหน้าที่อ่านไม่ครบ '+project.unreadablePages.join(', ')}:
  !checks.length?{action:'add',label:'เพิ่มหรือนำเข้าข้อ TOR'}:
  checks.some(c=>!c.reviewed)?{action:'review',id:checks.find(c=>!c.reviewed).id,label:'ตรวจข้อความ TOR เทียบต้นฉบับ'}:
  plan.skipped.length?{action:'library',id:plan.skipped[0].id,label:plan.skipped[0].reason}:
  checks.some(c=>!c.marks.length)?{action:'search',id:checks.find(c=>!c.marks.length).id,label:'ค้นหลักฐานด้วยกฎในโค้ด'}:
  checks.some(c=>c.marks.some(m=>m.reviewed!==true))?{action:'proof',id:checks.find(c=>c.marks.some(m=>m.reviewed!==true)).id,label:'ตรวจข้อความที่อ้างและกรอบไฮไลต์'}:
  checks.some(c=>!c.row?.proposal?.trim())?{action:'response',id:checks.find(c=>!c.row?.proposal?.trim()).id,label:'กรอกรายละเอียดที่เสนอ'}:
  checks.some(c=>c.row?.comparison!==STATUS.pass)?{action:'decision',id:checks.find(c=>c.row?.comparison!==STATUS.pass).id,label:'ตรวจผลกฎและยืนยันผลรายข้อ'}:
  {action:'export',label:'ตรวจตารางแล้วส่งออก'};
 return {next,blockers,readyCount:plan.ready.length,readyToSubmit:checks.length>0&&!blockers.length&&checks.every(c=>c.row?.comparison===STATUS.pass&&!passProblems(project,c.id).length),reviewed:checks.filter(c=>c.reviewed).length,total:checks.length};
}
export function recoverMetadata(project,record) {
 if(!record?.before||record.before.id!==project.id)throw new Error('ไม่มีรายการให้ย้อนกลับ');
 if(record.revision!==project.updatedAt)throw new Error('ข้อมูลเปลี่ยนหลังรายการนี้แล้ว ย้อนกลับไม่ได้');
 return record.before;
}
