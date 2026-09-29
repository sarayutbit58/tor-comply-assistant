import { referenceText, STATUS } from './projectModel.mjs';
export const FIELDS = { requirement:'รายละเอียด TOR', number:'เลขข้อ', proposal:'รายละเอียดที่เสนอ', comparison:'ผลเปรียบเทียบ', references:'เอกสารอ้างอิง' };
export const DEFAULT_PROFILE = {
  columns: [
    {heading:'รายละเอียดการดำเนินงาน',field:'requirement',width:34},
    {heading:'รายละเอียดการดำเนินงานที่ผู้เสนอราคาเสนอ',field:'proposal',width:28},
    {heading:'เปรียบเทียบรายละเอียดการดำเนินงานที่ผู้เสนอราคาเสนอ',field:'comparison',width:16},
    {heading:'เอกสารอ้างอิง ไฟล์ใด หน้าใด',field:'references',width:22},
  ],
  font:'Tahoma',fontSize:10,headerFill:'262629',headerColor:'FFFFFF',borderColor:'B8BBC2',
  pageWidth:842,pageHeight:595,margin:30,heading:'ตาราง Comply TOR',headerText:'',footerText:'',
};
export function guessField(heading,index) {
  if (/ลำดับ|เลขข้อ|^ข้อ$/.test(heading)) return 'number';
  if (/อ้างอิง|reference/i.test(heading)) return 'references';
  if (/เปรียบเทียบ|ผล|comply|compliance/i.test(heading)) return 'comparison';
  if (/เสนอ|offer|propos/i.test(heading)) return 'proposal';
  return index===0 || /กำหนด|รายละเอียด|requirement/i.test(heading) ? 'requirement' : 'proposal';
}
export function profileFor(project) {
  const raw = {...DEFAULT_PROFILE,...project.template?.profile};
  return {...raw,columns:raw.columns?.length ? raw.columns : DEFAULT_PROFILE.columns};
}
export function tableRows(project) {
  const profile=profileFor(project), separateNumber=profile.columns.some(c=>c.field==='number');
  return project.requirements.map(req=>{
    const row=project.rows[req.id]||{};
    const data={number:req.id,requirement:(separateNumber?'':'ข้อ '+req.id+' ')+req.textSnapshot,proposal:row.proposal||'',comparison:row.comparison||STATUS.pending,references:referenceText(project,req.id)};
    return profile.columns.map(col=>data[col.field]||'');
  });
}
export function validateProfile(profile) {
  if (!profile?.columns || profile.columns.length<2 || profile.columns.length>12) throw new Error('แม่แบบต้องมี 2–12 คอลัมน์');
  if (!profile.columns.some(c=>c.field==='requirement') || !profile.columns.some(c=>c.field==='proposal')) throw new Error('ต้องมีคอลัมน์ TOR และรายละเอียดที่เสนอ');
  if (profile.columns.some(c=>!(c.field in FIELDS)||!c.heading.trim()||!Number.isFinite(c.width)||c.width<=0)) throw new Error('หัวตารางหรือความกว้างไม่ถูกต้อง');
  for(const key of ['headerFill','headerColor','borderColor']) if(!/^[a-f0-9]{6}$/i.test(profile[key])) throw new Error('สีแม่แบบไม่ถูกต้อง');
  if (!(profile.fontSize>=7 && profile.fontSize<=24) || !(profile.pageWidth>=300&&profile.pageWidth<=1600) || !(profile.pageHeight>=300&&profile.pageHeight<=1600)) throw new Error('ขนาดหน้า/ตัวอักษรไม่ถูกต้อง');
  return profile;
}
