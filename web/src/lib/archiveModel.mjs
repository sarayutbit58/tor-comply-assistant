import { migrateProject, projectFileIds, validateMark, STATUS } from './projectModel.mjs';
export const ARCHIVE_VERSION = 1;
export const MAX_ARCHIVE_BYTES = 160 * 1024 * 1024;
const has=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
function record(value,message) {if(!value || typeof value!=='object' || Array.isArray(value))throw new Error(message);}
function string(value,message,required=false) {if(typeof value!=='string' || value.length>1000000 || (required&&!value.trim()))throw new Error(message);}
function strings(value,keys,message) {for(const key of keys)if(has(value,key))string(value[key],message);}
function array(value,key,message) {
  if(!has(value,key))return [];
  if(!Array.isArray(value[key]) || value[key].length>10000)throw new Error(message);
  return value[key];
}
function sourcePage(value,count) {if(!Number.isInteger(value) || value<1 || (count&&value>count))throw new Error('หน้า TOR ต้นฉบับไม่ถูกต้อง');}
function box(value) {
  if(!Array.isArray(value) || value.length!==4 || value.some(n=>!Number.isFinite(n)))throw new Error('กรอบต้นฉบับหรือหลักฐานไม่ถูกต้อง');
  const [x,y,w,h]=value;if(x<0 || y<0 || w<=0 || h<=0 || x+w>1.001 || y+h>1.001)throw new Error('กรอบต้นฉบับหรือหลักฐานไม่ถูกต้อง');
}
function date(value,message) {string(value,message,true);if(!Number.isFinite(Date.parse(value)))throw new Error(message);}
function validateSourceMetadata(project) {
  const count=project.sourcePageCount;
  if(has(project,'sourcePageCount') && count!==null)sourcePage(count,null);
  if(has(project,'sourceReviewPolicy') && ![1,2].includes(project.sourceReviewPolicy))throw new Error('นโยบายตรวจต้นฉบับไม่ถูกต้อง');
  if(has(project,'sourceCoveragePending') && typeof project.sourceCoveragePending!=='boolean')throw new Error('สถานะความครบถ้วนต้นฉบับไม่ถูกต้อง');
  const unreadable=array(project,'unreadablePages','รายการหน้า TOR ต้นฉบับไม่ถูกต้อง');
  const ocr=array(project,'ocrPages','รายการหน้า OCR ต้นฉบับไม่ถูกต้อง');
  for(const list of [unreadable,ocr]){for(const page of list)sourcePage(page,count);if(new Set(list).size!==list.length)throw new Error('รายการหน้า TOR ต้นฉบับซ้ำ');}
  const warnings=array(project,'sourceWarnings','คำเตือนข้อความต้นฉบับไม่ถูกต้อง');
  for(const warning of warnings)string(warning,'คำเตือนข้อความต้นฉบับไม่ถูกต้อง');
  const readingPages=new Set();
  for(const reading of array(project,'sourceReadings','ข้อความการอ่านหน้า TOR ต้นฉบับไม่ถูกต้อง')){
    record(reading,'ข้อความการอ่านหน้า TOR ต้นฉบับไม่ถูกต้อง');sourcePage(reading.page,count);
    if(readingPages.has(reading.page))throw new Error('ข้อความการอ่านหน้า TOR ต้นฉบับซ้ำ');readingPages.add(reading.page);
    for(const key of ['rawText','acceptedText']){string(reading[key],'ข้อความการอ่านหน้า TOR ต้นฉบับไม่ถูกต้อง');if(reading[key].length>100000)throw new Error('ข้อความการอ่านหน้า TOR ต้นฉบับใหญ่เกินไป');}
    if(!['manual','local-ocr','ocr'].includes(reading.method))throw new Error('วิธีอ่านข้อความหน้า TOR ต้นฉบับไม่ถูกต้อง');
  }
  const unresolved=array(project,'sourceUnresolvedRows','แถวต้นฉบับที่ยังอ่านไม่ครบไม่ถูกต้อง');
  for(const row of unresolved){
    record(row,'แถวต้นฉบับที่ยังอ่านไม่ครบไม่ถูกต้อง');
    if(!Number.isInteger(row.row) || row.row<1 || row.row>1048576)throw new Error('เลขแถวต้นฉบับไม่ถูกต้อง');
    strings(row,['tableId','number','reason'],'ข้อความแถวต้นฉบับไม่ถูกต้อง');
    if(has(row,'page') && row.page!==null)sourcePage(row.page,count);
  }
  for(const requirement of project.requirements){
    strings(requirement,['title','rawTextSnapshot','sourceMethod','duplicateOf'],'ข้อความข้อ TOR ต้นฉบับไม่ถูกต้อง');
    if(has(requirement,'reviewed') && typeof requirement.reviewed!=='boolean')throw new Error('สถานะตรวจ TOR ต้นฉบับไม่ถูกต้อง');
    if(has(requirement,'sourcePage') && requirement.sourcePage!==null)sourcePage(requirement.sourcePage,count);
    const pages=array(requirement,'sourcePages','รายการหน้า TOR ต้นฉบับไม่ถูกต้อง');
    for(const page of pages)sourcePage(page,count);
    if(new Set(pages).size!==pages.length)throw new Error('รายการหน้า TOR ต้นฉบับซ้ำ');
    const declared=new Set([requirement.sourcePage,...pages].filter(Number.isInteger));
    for(const region of array(requirement,'sourceRegions','กรอบหน้า TOR ต้นฉบับไม่ถูกต้อง')){
      record(region,'กรอบหน้า TOR ต้นฉบับไม่ถูกต้อง');sourcePage(region.page,count);box(region.box);
      if((has(requirement,'sourcePages') || requirement.sourcePage!==null && requirement.sourcePage!==undefined) && !declared.has(region.page))throw new Error('หน้าในกรอบ TOR ไม่ตรงกับหน้าข้อกำหนด');
    }
    for(const correction of array(requirement,'sourceCorrections','ประวัติข้อความต้นฉบับไม่ถูกต้อง')){
      record(correction,'ประวัติข้อความต้นฉบับไม่ถูกต้อง');
      strings(correction,['method','reason','previousId','nextId','previousText','nextText'],'ประวัติข้อความต้นฉบับไม่ถูกต้อง');
      if(has(correction,'page') && correction.page!==null)sourcePage(correction.page,count);
      if(has(correction,'box') && correction.box!==null)box(correction.box);
      for(const key of ['at','acceptedAt'])if(has(correction,key))date(correction[key],'วันที่ประวัติข้อความต้นฉบับไม่ถูกต้อง');
    }
    for(const issue of array(requirement,'readingIssues','คำเตือนข้อความต้นฉบับไม่ถูกต้อง')){
      record(issue,'คำเตือนข้อความต้นฉบับไม่ถูกต้อง');strings(issue,['code','severity','label','reason'],'คำเตือนข้อความต้นฉบับไม่ถูกต้อง');
    }
  }
  for(const mark of project.evidence){
    strings(mark,['quote','keyword','printedPage','rawQuote','sourceMethod'],'ข้อความหรือเลขหน้าหลักฐานไม่ถูกต้อง');
    if(has(mark,'reviewed') && typeof mark.reviewed!=='boolean')throw new Error('สถานะตรวจหลักฐานไม่ถูกต้อง');
    box(mark.box);
  }
  const resolutions=array(project,'sourcePageResolutions','การยืนยันหน้า TOR ต้นฉบับไม่ถูกต้อง'),seen=new Set();
  for(const resolution of resolutions){
    record(resolution,'การยืนยันหน้า TOR ต้นฉบับไม่ถูกต้อง');sourcePage(resolution.page,count);
    if(seen.has(resolution.page) || unreadable.includes(resolution.page))throw new Error('การยืนยันหน้า TOR ซ้ำหรือยังรอตรวจ');seen.add(resolution.page);
    string(resolution.reason,'เหตุผลยืนยันหน้า TOR ต้นฉบับไม่ถูกต้อง',true);
    if(!['transcribed','no-requirements'].includes(resolution.kind) || !Array.isArray(resolution.requirementIds) || resolution.requirementIds.some(id=>typeof id!=='string') || new Set(resolution.requirementIds).size!==resolution.requirementIds.length)throw new Error('ข้อ TOR ในการยืนยันหน้าไม่ถูกต้อง');
    const onPage=project.requirements.filter(req=>req.sourcePage===resolution.page || req.sourcePages?.includes(resolution.page));
    if(resolution.kind==='no-requirements' && (onPage.length || resolution.requirementIds.length))throw new Error('หน้า TOR ที่ยืนยันว่าไม่มีข้อกำหนดยังมีข้อ TOR');
    if(resolution.kind==='transcribed' && (!onPage.length || onPage.length!==resolution.requirementIds.length || onPage.some(req=>!resolution.requirementIds.includes(req.id))))throw new Error('ข้อ TOR ในการยืนยันหน้าไม่ครบหรือผิดหน้า');
    if(has(resolution,'confirmedAt'))date(resolution.confirmedAt,'วันที่ยืนยันหน้า TOR ต้นฉบับไม่ถูกต้อง');
  }
  if(has(project,'sourceCoverageResolution')){
    record(project.sourceCoverageResolution,'การยืนยันความครบถ้วนต้นฉบับไม่ถูกต้อง');
    string(project.sourceCoverageResolution.reason,'เหตุผลยืนยันความครบถ้วนต้นฉบับไม่ถูกต้อง',true);
    if(has(project.sourceCoverageResolution,'confirmedAt'))date(project.sourceCoverageResolution.confirmedAt,'วันที่ยืนยันความครบถ้วนต้นฉบับไม่ถูกต้อง');
  }
  const pending=warnings.length>0 || unresolved.length>0;
  if(project.sourceCoveragePending===false && pending && !project.sourceCoverageResolution)throw new Error('ต้นฉบับที่มีคำเตือนยังไม่มีการยืนยันความครบถ้วน');
  return has(project,'sourceCoveragePending') ? project.sourceCoveragePending : pending&&!project.sourceCoverageResolution;
}
export function validateManifest(data) {
  if (data?.format !== 'tor-comply-project' || data.version !== ARCHIVE_VERSION) throw new Error('ไม่รองรับรุ่นไฟล์โครงการนี้');
  const p = data.project;
  if (!p || typeof p.name !== 'string' || p.name.length > 160 || !Array.isArray(p.requirements) || !Array.isArray(p.docs) || !Array.isArray(p.products) || !Array.isArray(p.evidence) || !p.rows || !Array.isArray(data.files)) throw new Error('โครงสร้างไฟล์โครงการไม่ถูกต้อง');
  if (p.requirements.length > 5000 || p.docs.length > 250 || p.evidence.length > 25000) throw new Error('โครงการมีข้อมูลเกินขนาดที่รองรับ');
  for (const key of ['requirements','docs','products','evidence']) {
    for(const value of p[key])record(value,'โครงสร้างข้อมูลโครงการไม่ถูกต้อง');
    const ids = p[key].map(i => i.id);
    if (ids.some(id => typeof id !== 'string' || !id.trim() || id.length>120 || /[\u0000-\u001f]/u.test(id) || ['__proto__','constructor','prototype'].includes(id)) || new Set(ids).size !== ids.length) throw new Error('รหัสข้อมูลซ้ำหรือไม่ถูกต้อง');
  }
  for (const req of p.requirements) if (typeof req.textSnapshot !== 'string' || req.textSnapshot.length > 100000) throw new Error('ข้อความ TOR ไม่ถูกต้อง');
  const sourceCoveragePending=validateSourceMetadata(p);
  if(Object.keys(p.rows).length!==p.requirements.length||p.requirements.some(req=>!Object.hasOwn(p.rows,req.id)))throw new Error('คำตอบไม่ตรงกับเลขข้อ TOR');
  for (const d of p.docs) if (!['product','service','bidder'].includes(d.role) || !Number.isInteger(d.pageCount) || d.pageCount < 1 || !Array.isArray(d.itemIds) || d.itemIds.some(id=>!p.products.some(i=>i.id===id))) throw new Error('ประเภทหรือการผูกไฟล์หลักฐานไม่ถูกต้อง');
  for (const row of Object.values(p.rows)) if (!Array.isArray(row.itemIds) || row.itemIds.some(id=>!p.products.some(i=>i.id===id)) || !Object.values(STATUS).includes(row.comparison) || typeof row.proposal !== 'string') throw new Error('คำตอบในโครงการไม่ถูกต้อง');
  for (const mark of p.evidence) validateMark(p, mark);
  if (new Set(data.files.map(f=>f.id)).size !== data.files.length) throw new Error('ไฟล์แนบซ้ำ');
  const expected = projectFileIds(p);
  if (data.files.length !== expected.length || expected.some(id=>!data.files.some(f=>f.id===id))) throw new Error('ไฟล์แนบโครงการไม่ครบ');
  for (const file of data.files) if (!/^files\/\d+\.bin$/.test(file.path) || !/^metadata\/\d+\.json$/.test(file.metaPath) || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isInteger(file.size) || file.size<0) throw new Error('รายการไฟล์แนบไม่ถูกต้อง');
  if (data.files.reduce((n,f)=>n+f.size,0)>MAX_ARCHIVE_BYTES) throw new Error('ไฟล์โครงการใหญ่เกิน 160 MB');
  return migrateProject({...p,sourceCoveragePending});
}
export function remapProject(project, makeId) {
  const mapping = Object.fromEntries(projectFileIds(project).map(id=>[id,makeId()]));
  return { mapping, project: { ...project, id: makeId(), name: project.name, torDocId: mapping[project.torDocId] || null, template: project.template ? {...project.template,id:mapping[project.template.id]} : null, docs: project.docs.map(d=>({...d,id:mapping[d.id]})), evidence: project.evidence.map(m=>({...m,id:makeId(),docId:mapping[m.docId]})) } };
}
