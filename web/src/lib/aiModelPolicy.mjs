// Maintained capabilities from official model cards, checked 2026-09-30.
export const MODEL_OPTIONS=[
  {id:'gpt-6-luna',tier:'easy',label:'งานง่าย · ค่าเริ่มต้น',description:'เริ่มจากตัวนี้สำหรับข้อความและภาพชัดเจน'},
  {id:'gpt-5.6-luna',tier:'easy',label:'งานง่าย · ทางเลือก',description:'ทางเลือกสำหรับงานเฉพาะเรื่องที่ไม่ซับซ้อน'},
  {id:'gpt-6.1-sol',tier:'medium',label:'งานปานกลาง',description:'เงื่อนไขหลายส่วน หรือเอกสารที่ตัวเริ่มต้นอ่านไม่ครบ'},
  {id:'gpt-6-sol',tier:'medium',label:'งานปานกลาง · ทางเลือก',description:'ทดสอบเปรียบเทียบงานหลายเงื่อนไข'},
  {id:'gpt-6-astra',tier:'hard',label:'งานยาก · เลือกเอง',description:'ใช้เมื่อโมเดลง่าย/กลางทำไม่ได้ ไม่มีการเลื่อนรุ่นอัตโนมัติ'},
];
export function allowedOpenAiModel(id) {
  return typeof id==='string'&&MODEL_OPTIONS.some(m=>id===m.id||new RegExp('^'+m.id.replaceAll('.','\\.')+'-\\d{4}-\\d{2}-\\d{2}$').test(id));
}
export function recommendedModels(raw) {
  if(!Array.isArray(raw?.data))throw new Error('รายการโมเดล OpenAI ไม่ถูกต้อง');
  const ids=raw.data.map(m=>m?.id).filter(id=>typeof id==='string');
  return MODEL_OPTIONS.flatMap(option=>{
    const id=ids.includes(option.id)?option.id:ids.filter(id=>allowedOpenAiModel(id)&&id.startsWith(option.id+'-')).sort().at(-1);
    return id?[{...option,id}]:[];
  });
}
export function defaultEasyModel(models) {return models.find(m=>m.tier==='easy')?.id||'';}
export function pickSystemOneModel(raw) {
  if(!Array.isArray(raw?.models))throw new Error('รายการโมเดล TypeSafe ไม่ถูกต้อง');
  const ids=raw.models.map(m=>m?.name).filter(id=>typeof id==='string');
  return ids.includes('jev-latest')?'jev-latest':ids.filter(id=>/^jev-\d+\.\d+(?:\.\d+)?$/.test(id)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).at(-1)||'';
}
